jest.mock('../db/connection');
jest.mock('../services/DataCloudClient');
jest.mock('../services/SchemaBuilder');

import { ProfileAssembler } from '../services/ProfileAssembler';
import { DataCloudClient } from '../services/DataCloudClient';
import { SchemaBuilder } from '../services/SchemaBuilder';
import { mockQuery } from '../__mocks__/db';
import { AdjacencyNode } from '../types';

const MockedDataCloudClient = DataCloudClient as jest.MockedClass<typeof DataCloudClient>;
const MockedSchemaBuilder = SchemaBuilder as jest.MockedClass<typeof SchemaBuilder>;

const UNIFIED_DMO = 'ssot__UnifiedIndividual__dlm';
const INDIVIDUAL_DMO = 'ssot__Individual__dlm';
const EMAIL_DMO = 'ssot__ContactPointEmail__dlm';
const CUSTOM_DMO = 'Custom__dlm';

function makeNode(
  dmoApiName: string,
  edges: Array<{ targetDmo: string; sourceField: string; targetField: string; type: string }> = [],
  annotatedEdges: AdjacencyNode['annotatedEdges'] = []
): AdjacencyNode {
  return {
    dmoApiName,
    label: dmoApiName,
    edges,
    annotatedEdges,
    recordCount: 5,
    fields: [
      { name: 'Id', label: 'ID', type: 'id', nullable: false },
      { name: 'ssot__UnifiedIndividualId__c', label: 'Unified ID', type: 'reference', nullable: true },
    ],
  };
}

const mockGraph = new Map<string, AdjacencyNode>([
  [
    UNIFIED_DMO,
    makeNode(UNIFIED_DMO, [
      { targetDmo: INDIVIDUAL_DMO, sourceField: 'Id', targetField: 'ssot__UnifiedIndividualId__c', type: 'lookup' },
    ]),
  ],
  [INDIVIDUAL_DMO, makeNode(INDIVIDUAL_DMO)],
  [EMAIL_DMO, makeNode(EMAIL_DMO)],
]);

describe('ProfileAssembler', () => {
  let assembler: ProfileAssembler;
  let mockQuery_instance: jest.Mock;
  let mockGetAdjacencyList: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    assembler = new ProfileAssembler('org-123');

    // Mock org DB lookup
    mockQuery.mockResolvedValue({ rows: [{ id: 'org-123', instance_url: 'https://test.sf.com', credentials_encrypted: 'enc' }] });

    // Mock SchemaBuilder
    mockGetAdjacencyList = jest.fn().mockResolvedValue(mockGraph);
    MockedSchemaBuilder.mockImplementation(() => ({
      getAdjacencyList: mockGetAdjacencyList,
      buildGraph: jest.fn(),
      getGraph: jest.fn(),
      getReachableNodes: jest.fn(),
      clearCache: jest.fn(),
    }) as unknown as SchemaBuilder);

    // Mock DataCloudClient query
    mockQuery_instance = jest.fn().mockResolvedValue({
      data: [{ Id: 'rec-1', ssot__UnifiedIndividualId__c: 'uid-1' }],
      metadata: {},
    });
    MockedDataCloudClient.mockImplementation(() => ({
      query: mockQuery_instance,
      getToken: jest.fn().mockResolvedValue('token'),
      introspectSchema: jest.fn(),
      resolveIndividual: jest.fn(),
      getOrgInstanceUrl: jest.fn().mockReturnValue('https://test.sf.com'),
    }) as unknown as DataCloudClient);
  });

  describe('assemble()', () => {
    it('queries all DMOs reachable from UnifiedIndividual via BFS', async () => {
      const results = await assembler.assemble('uid-1');

      // Should have queried Individual DMO (direct edge from Unified)
      expect(mockQuery_instance).toHaveBeenCalled();
      // Should return results for INDIVIDUAL_DMO
      expect(results.some((r) => r.dmoName === INDIVIDUAL_DMO)).toBe(true);
    });

    it('does not query the UnifiedIndividual DMO itself', async () => {
      const results = await assembler.assemble('uid-1');

      expect(results.every((r) => r.dmoName !== UNIFIED_DMO)).toBe(true);
    });

    it('tags native results with source: native', async () => {
      const results = await assembler.assemble('uid-1');

      expect(results.every((r) => r.source === 'native')).toBe(true);
    });

    it('tags team-defined results with source: team-defined', async () => {
      const graphWithAnnotated = new Map(mockGraph);
      graphWithAnnotated.set(
        UNIFIED_DMO,
        makeNode(UNIFIED_DMO, [], [
          {
            targetDmo: CUSTOM_DMO,
            sourceField: 'Id',
            targetField: 'UId__c',
            joinType: 'inner' as const,
            annotationId: 'ann-1',
            rationale: null,
            status: 'validated' as const,
          },
        ])
      );
      graphWithAnnotated.set(CUSTOM_DMO, makeNode(CUSTOM_DMO));
      mockGetAdjacencyList.mockResolvedValue(graphWithAnnotated);

      const results = await assembler.assemble('uid-1');

      const customResult = results.find((r) => r.dmoName === CUSTOM_DMO);
      expect(customResult).toBeDefined();
      expect(customResult?.source).toBe('team-defined');
      expect(customResult?.annotationId).toBe('ann-1');
    });

    it('still returns partial results when one DMO query fails', async () => {
      mockQuery_instance
        .mockResolvedValueOnce({ data: [{ Id: 'rec-1' }] })
        .mockRejectedValueOnce(new Error('DMO query failed'));

      // Add a second DMO to the graph
      const graphWithTwo = new Map(mockGraph);
      graphWithTwo.get(UNIFIED_DMO)!.edges.push({
        targetDmo: EMAIL_DMO,
        sourceField: 'Id',
        targetField: 'ssot__IndividualId__c',
        type: 'lookup',
      });
      mockGetAdjacencyList.mockResolvedValue(graphWithTwo);

      const results = await assembler.assemble('uid-1');

      // Both DMOs should appear in results
      expect(results).toHaveLength(2);
      // The failed one should have an error field
      const failed = results.find((r) => r.error !== undefined);
      expect(failed).toBeDefined();
      expect(failed?.records).toHaveLength(0);
    });

    it('sorts identity DMOs first', async () => {
      const graphWithMultiple = new Map([
        [
          UNIFIED_DMO,
          makeNode(UNIFIED_DMO, [
            { targetDmo: CUSTOM_DMO, sourceField: 'Id', targetField: 'UId', type: 'lookup' },
            { targetDmo: EMAIL_DMO, sourceField: 'Id', targetField: 'UId', type: 'lookup' },
            { targetDmo: INDIVIDUAL_DMO, sourceField: 'Id', targetField: 'UId', type: 'lookup' },
          ]),
        ],
        [CUSTOM_DMO, makeNode(CUSTOM_DMO)],
        [EMAIL_DMO, makeNode(EMAIL_DMO)],
        [INDIVIDUAL_DMO, makeNode(INDIVIDUAL_DMO)],
      ]);
      mockGetAdjacencyList.mockResolvedValue(graphWithMultiple);
      mockQuery_instance.mockResolvedValue({ data: [] });

      const results = await assembler.assemble('uid-1');

      const idx = (name: string) => results.findIndex((r) => r.dmoName === name);
      expect(idx(INDIVIDUAL_DMO)).toBeLessThan(idx(CUSTOM_DMO));
      expect(idx(EMAIL_DMO)).toBeLessThan(idx(CUSTOM_DMO));
    });

    it('throws if org is not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(assembler.assemble('uid-1')).rejects.toThrow('Org org-123 not found');
    });
  });
});
