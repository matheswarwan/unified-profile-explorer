import axios from 'axios';
import CryptoJS from 'crypto-js';
import { DataCloudClient } from '../services/DataCloudClient';
import { Org } from '../types';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Build a test org with encrypted credentials
const ENCRYPTION_KEY = 'test-key-32chars-padded-for-aes!!';
process.env.ENCRYPTION_KEY = ENCRYPTION_KEY;

function makeOrg(): Org {
  const creds = JSON.stringify({ clientId: 'test-client-id', clientSecret: 'test-secret' });
  const encrypted = CryptoJS.AES.encrypt(creds, ENCRYPTION_KEY).toString();
  return {
    id: 'org-1',
    display_name: 'Test Org',
    client_name: 'TestCo',
    instance_url: 'https://test.salesforce.com',
    tenant_id: 'tenant-1',
    credentials_encrypted: encrypted,
    notes: null,
    created_at: new Date(),
    last_tested_at: null,
    last_tested_status: 'untested',
  };
}

const TOKEN_RESPONSE = {
  data: { access_token: 'mock-token-abc', token_type: 'Bearer', expires_in: 7200 },
  status: 200,
};

const QUERY_RESPONSE = {
  data: {
    data: [{ Id: 'rec-1', ssot__EmailAddress__c: 'jane@example.com', ssot__IndividualId__c: 'uid-1' }],
    metadata: { count: 1 },
  },
  status: 200,
};

describe('DataCloudClient', () => {
  let client: DataCloudClient;
  let mockHttpPost: jest.Mock;
  let mockHttpGet: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock the instance-level http client created in constructor
    mockHttpPost = jest.fn();
    mockHttpGet = jest.fn();

    mockedAxios.create = jest.fn().mockReturnValue({
      post: mockHttpPost,
      get: mockHttpGet,
    });
    mockedAxios.post = jest.fn().mockResolvedValue(TOKEN_RESPONSE);

    client = new DataCloudClient(makeOrg());
  });

  describe('getToken()', () => {
    it('fetches a token via client_credentials OAuth flow', async () => {
      const token = await client.getToken();

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://test.salesforce.com/services/oauth2/token',
        expect.stringContaining('grant_type=client_credentials'),
        expect.objectContaining({ headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
      );
      expect(token).toBe('mock-token-abc');
    });

    it('caches the token and does not refetch before expiry', async () => {
      await client.getToken();
      await client.getToken();

      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    });

    it('includes client_id and client_secret in the request', async () => {
      await client.getToken();

      const body = (mockedAxios.post as jest.Mock).mock.calls[0][1] as string;
      expect(body).toContain('client_id=test-client-id');
      expect(body).toContain('client_secret=test-secret');
    });
  });

  describe('query()', () => {
    it('sends a POST to the Data Cloud query API with Bearer token', async () => {
      mockHttpPost.mockResolvedValueOnce(QUERY_RESPONSE);

      const result = await client.query('SELECT Id FROM ssot__Individual__dlm LIMIT 1');

      expect(mockHttpPost).toHaveBeenCalledWith(
        '/services/data/v59.0/ssot/queryv2',
        { sql: 'SELECT Id FROM ssot__Individual__dlm LIMIT 1' },
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer mock-token-abc' }),
        })
      );
      expect(result.data).toHaveLength(1);
    });

    it('refreshes token and retries on 401', async () => {
      const error401 = { response: { status: 401 } };
      mockHttpPost
        .mockRejectedValueOnce(error401)
        .mockResolvedValueOnce(QUERY_RESPONSE);

      const result = await client.query('SELECT Id FROM ssot__Individual__dlm LIMIT 1');

      // Token should have been re-fetched (called twice: initial + refresh)
      expect(mockedAxios.post).toHaveBeenCalledTimes(2);
      expect(result.data).toHaveLength(1);
    });

    it('retries with backoff on 429 rate limit', async () => {
      // Use a very short retry-after so the test doesn't hang
      const error429 = { response: { status: 429, headers: { 'retry-after': '0' } } };
      mockHttpPost
        .mockRejectedValueOnce(error429)
        .mockResolvedValueOnce(QUERY_RESPONSE);

      const result = await client.query('SELECT Id FROM test LIMIT 1');

      expect(mockHttpPost).toHaveBeenCalledTimes(2);
      expect(result.data).toHaveLength(1);
    }, 10000);

    it('throws after max retries exceeded', async () => {
      const error500 = new Error('Server error');
      mockHttpPost.mockRejectedValue(error500);

      await expect(client.query('SELECT bad query')).rejects.toThrow();
    });
  });

  describe('resolveIndividual()', () => {
    it('queries ContactPointEmail DMO for email search', async () => {
      mockHttpPost.mockResolvedValueOnce(QUERY_RESPONSE);

      const candidates = await client.resolveIndividual('email', 'jane@example.com');

      const calledSql = mockHttpPost.mock.calls[0][1].sql as string;
      expect(calledSql).toContain('ssot__ContactPointEmail__dlm');
      expect(calledSql).toContain("ssot__EmailAddress__c = 'jane@example.com'");
      expect(candidates).toHaveLength(1);
      expect(candidates[0].email).toBe('jane@example.com');
      expect(candidates[0].unifiedIndividualId).toBe('uid-1');
    });

    it('queries ContactPointPhone DMO for phone search', async () => {
      mockHttpPost.mockResolvedValueOnce({ data: { data: [] } });

      await client.resolveIndividual('phone', '+15550001234');

      const calledSql = mockHttpPost.mock.calls[0][1].sql as string;
      expect(calledSql).toContain('ssot__ContactPointPhone__dlm');
      expect(calledSql).toContain("ssot__FormattedE164PhoneNumber__c = '+15550001234'");
    });

    it('queries Individual DMO for name search and splits first/last', async () => {
      mockHttpPost.mockResolvedValueOnce({ data: { data: [] } });

      await client.resolveIndividual('name', 'Jane Doe');

      const calledSql = mockHttpPost.mock.calls[0][1].sql as string;
      expect(calledSql).toContain('ssot__Individual__dlm');
      expect(calledSql).toContain("ssot__FirstName__c = 'Jane'");
      expect(calledSql).toContain("ssot__LastName__c = 'Doe'");
    });

    it('returns empty array when no records found', async () => {
      mockHttpPost.mockResolvedValueOnce({ data: { data: [] } });

      const candidates = await client.resolveIndividual('email', 'notfound@example.com');

      expect(candidates).toHaveLength(0);
    });
  });

  describe('introspectSchema()', () => {
    it('returns parsed DMO schemas from metadata API', async () => {
      mockHttpGet.mockResolvedValueOnce({
        data: {
          entities: [
            {
              name: 'ssot__Individual__dlm',
              label: 'Individual',
              fields: [
                { name: 'Id', label: 'ID', type: 'id', nillable: false },
                {
                  name: 'ssot__UnifiedIndividualId__c',
                  label: 'Unified Individual ID',
                  type: 'reference',
                  nillable: true,
                  referenceTo: ['ssot__UnifiedIndividual__dlm'],
                },
              ],
              relationships: [],
            },
          ],
        },
      });

      const schemas = await client.introspectSchema();

      expect(schemas).toHaveLength(1);
      expect(schemas[0].apiName).toBe('ssot__Individual__dlm');
      expect(schemas[0].fields).toHaveLength(2);
      // Should have extracted a relationship from the reference field
      expect(schemas[0].relationships.some((r) => r.targetDmo === 'ssot__UnifiedIndividual__dlm')).toBe(true);
    });

    it('handles empty entities list gracefully', async () => {
      mockHttpGet.mockResolvedValueOnce({ data: { entities: [] } });

      const schemas = await client.introspectSchema();
      expect(schemas).toHaveLength(0);
    });
  });
});
