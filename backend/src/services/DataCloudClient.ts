import axios, { AxiosInstance, AxiosError } from 'axios';
import CryptoJS from 'crypto-js';
import {
  Org,
  DataCloudCredentials,
  DataCloudTokenResponse,
  DataCloudQueryResponse,
  DmoSchema,
  DmoField,
  DmoRelationship,
  IndividualCandidate,
} from '../types';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '';

function decryptCredentials(encrypted: string): DataCloudCredentials {
  const bytes = CryptoJS.AES.decrypt(encrypted, ENCRYPTION_KEY);
  const decrypted = bytes.toString(CryptoJS.enc.Utf8);
  return JSON.parse(decrypted) as DataCloudCredentials;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class DataCloudClient {
  private org: Org;
  private credentials: DataCloudCredentials;
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;
  private httpClient: AxiosInstance;

  constructor(org: Org) {
    this.org = org;
    this.credentials = decryptCredentials(org.credentials_encrypted);
    this.httpClient = axios.create({
      baseURL: org.instance_url,
      timeout: 30000,
    });
  }

  async getToken(): Promise<string> {
    const now = Date.now();
    if (this.accessToken && now < this.tokenExpiresAt - 60000) {
      return this.accessToken;
    }

    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.credentials.clientId,
      client_secret: this.credentials.clientSecret,
    });

    const response = await axios.post<DataCloudTokenResponse>(
      `${this.org.instance_url}/services/oauth2/token`,
      params.toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    );

    this.accessToken = response.data.access_token;
    const expiresIn = response.data.expires_in ?? 7200;
    this.tokenExpiresAt = now + expiresIn * 1000;
    return this.accessToken;
  }

  async query(soql: string, retries = 3): Promise<DataCloudQueryResponse> {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const token = await this.getToken();
        const response = await this.httpClient.post<DataCloudQueryResponse>(
          `/services/data/v59.0/ssot/queryv2`,
          { sql: soql },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        );
        return response.data;
      } catch (err) {
        const axiosErr = err as AxiosError;
        if (axiosErr.response?.status === 401) {
          // Force token refresh
          this.accessToken = null;
          this.tokenExpiresAt = 0;
          if (attempt === retries - 1) throw err;
          continue;
        }
        if (axiosErr.response?.status === 429) {
          const retryAfter = parseInt(
            (axiosErr.response.headers['retry-after'] as string) || '5',
            10
          );
          const delay = (retryAfter || 5) * 1000 * Math.pow(2, attempt);
          console.warn(`[DataCloudClient] Rate limited. Retrying in ${delay}ms...`);
          await sleep(delay);
          if (attempt === retries - 1) throw err;
          continue;
        }
        throw err;
      }
    }
    throw new Error('Max retries exceeded');
  }

  async introspectSchema(): Promise<DmoSchema[]> {
    const token = await this.getToken();

    // Fetch all entities (DMOs) from the metadata API
    const metaResponse = await this.httpClient.get<{
      entities: Array<{
        name: string;
        label: string;
        fields?: Array<{
          name: string;
          label: string;
          type: string;
          nillable?: boolean;
          relationshipName?: string;
          referenceTo?: string[];
        }>;
        relationships?: Array<{
          relationshipName: string;
          field: string;
          childSObject: string;
        }>;
      }>;
    }>('/services/data/v59.0/ssot/metadata/entities', {
      headers: { Authorization: `Bearer ${token}` },
    });

    const schemas: DmoSchema[] = [];

    for (const entity of metaResponse.data.entities || []) {
      const fields: DmoField[] = (entity.fields || []).map((f) => ({
        name: f.name,
        label: f.label || f.name,
        type: f.type || 'string',
        nullable: f.nillable ?? true,
        isRelationship: !!f.relationshipName,
        relationshipTarget: f.referenceTo?.[0],
      }));

      const relationships: DmoRelationship[] = [];

      // Extract relationships from field definitions
      for (const field of entity.fields || []) {
        if (field.referenceTo && field.referenceTo.length > 0) {
          relationships.push({
            targetDmo: field.referenceTo[0],
            sourceField: field.name,
            targetField: 'Id',
            type: 'lookup',
          });
        }
      }

      // Also include child relationships
      for (const rel of entity.relationships || []) {
        if (rel.childSObject && rel.field) {
          relationships.push({
            targetDmo: rel.childSObject,
            sourceField: 'Id',
            targetField: rel.field,
            type: 'child',
          });
        }
      }

      schemas.push({
        apiName: entity.name,
        label: entity.label || entity.name,
        fields,
        relationships,
      });
    }

    return schemas;
  }

  async resolveIndividual(
    searchType: 'email' | 'name' | 'phone',
    searchValue: string
  ): Promise<IndividualCandidate[]> {
    let soql: string;

    if (searchType === 'email') {
      soql = `
        SELECT Id, ssot__IndividualId__c, ssot__FirstName__c, ssot__LastName__c,
               ssot__EmailAddress__c
        FROM ssot__ContactPointEmail__dlm
        WHERE ssot__EmailAddress__c = '${searchValue.replace(/'/g, "\\'")}'
        LIMIT 20
      `;
    } else if (searchType === 'phone') {
      soql = `
        SELECT Id, ssot__IndividualId__c, ssot__FormattedE164PhoneNumber__c
        FROM ssot__ContactPointPhone__dlm
        WHERE ssot__FormattedE164PhoneNumber__c = '${searchValue.replace(/'/g, "\\'")}'
        LIMIT 20
      `;
    } else {
      // name search
      const parts = searchValue.trim().split(/\s+/);
      const firstName = parts[0] || '';
      const lastName = parts.slice(1).join(' ') || '';
      soql = `
        SELECT Id, ssot__IndividualId__c, ssot__FirstName__c, ssot__LastName__c
        FROM ssot__Individual__dlm
        WHERE ssot__FirstName__c = '${firstName.replace(/'/g, "\\'")}'
          AND ssot__LastName__c = '${lastName.replace(/'/g, "\\'")}'
        LIMIT 20
      `;
    }

    const result = await this.query(soql);
    const candidates: IndividualCandidate[] = [];

    for (const row of result.data || []) {
      const record = row as Record<string, unknown>;
      candidates.push({
        id: (record['Id'] as string) || '',
        unifiedIndividualId:
          (record['ssot__IndividualId__c'] as string) ||
          (record['ssot__UnifiedIndividualId__c'] as string) ||
          (record['Id'] as string) ||
          '',
        firstName: (record['ssot__FirstName__c'] as string | null) ?? null,
        lastName: (record['ssot__LastName__c'] as string | null) ?? null,
        email:
          (record['ssot__EmailAddress__c'] as string | null) ??
          null,
        phone:
          (record['ssot__FormattedE164PhoneNumber__c'] as string | null) ?? null,
        confidence: 1.0,
      });
    }

    return candidates;
  }

  getOrgInstanceUrl(): string {
    return this.org.instance_url;
  }
}
