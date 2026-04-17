// We test the pure functions extracted from SchemaBuilder via the class methods
// DB and Redis are mocked so we can test graph logic in isolation.

jest.mock('../db/connection');
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    on: jest.fn(),
    connect: jest.fn(),
    get: jest.fn().mockResolvedValue(null),
    setEx: jest.fn(),
    del: jest.fn(),
  })),
}));

import { SchemaBuilder } from '../services/SchemaBuilder';
import { mockQuery } from '../__mocks__/db';
import { DmoSchema } from '../types';

const UNIFIED_DMO = 'ssot__UnifiedIndividual__dlm';

function makeSchema(
  apiName: string,
  relationships: Array<{ targetDmo: string; sourceField: string; targetField: string; type: string }> = []
): DmoSchema {
  return {
    apiName,
    label: apiName,
    fields: [{ name: 'Id', label: 'Id', type: 'string', nullable: false }],
    relationships,
    recordCount: 10,
  };
}

describe('SchemaBuilder', () => {
  let builder: SchemaBuilder;

  beforeEach(() => {
    builder = new SchemaBuilder('org-123');
    jest.clearAllMocks();
  });

  describe('getAdjacencyList()', () => {
    it('builds adjacency list from DB-cached schemas', async () => {
      // getOrgById
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'org-123' }] });
      // getSchemasFromDb
      const schemas = [
        makeSchema(UNIFIED_DMO),
        makeSchema('ssot__Individual__dlm', [
          { targetDmo: UNIFIED_DMO, sourceField: 'ssot__UnifiedIndividualId__c', targetField: 'Id', type: 'lookup' },
        ]),
        makeSchema('ssot__ContactPointEmail__dlm'),
      ];
      mockQuery.mockResolvedValueOnce({
        rows: schemas.map((s) => ({ schema_json: s })),
      });
      // getAnnotationsForOrg (no annotated edges)
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const graph = await builder.getAdjacencyList();

      expect(graph.size).toBe(3);
      expect(graph.has(UNIFIED_DMO)).toBe(true);
      expect(graph.has('ssot__Individual__dlm')).toBe(true);

      const indNode = graph.get('ssot__Individual__dlm')!;
      expect(indNode.edges).toHaveLength(1);
      expect(indNode.edges[0].targetDmo).toBe(UNIFIED_DMO);
    });

    it('overlays annotated edges from DB', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'org-123' }] });
      const schemas = [
        makeSchema(UNIFIED_DMO),
        makeSchema('ssot__Individual__dlm'),
        makeSchema('Custom__dlm'),
      ];
      mockQuery.mockResolvedValueOnce({
        rows: schemas.map((s) => ({ schema_json: s })),
      });
      // Annotated edge: Individual -> Custom
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'ann-1',
            org_id: 'org-123',
            annotation_type: 'edge',
            source_dmo: 'ssot__Individual__dlm',
            target_dmo: 'Custom__dlm',
            source_field: 'ssot__Id__c',
            target_field: 'IndividualId__c',
            join_type: 'inner',
            status: 'proposed',
          },
        ],
      });

      const graph = await builder.getAdjacencyList();

      const indNode = graph.get('ssot__Individual__dlm')!;
      expect(indNode.annotatedEdges).toHaveLength(1);
      expect(indNode.annotatedEdges[0].targetDmo).toBe('Custom__dlm');
      expect(indNode.annotatedEdges[0].annotationId).toBe('ann-1');
    });
  });

  describe('getReachableNodes()', () => {
    it('returns only nodes reachable from UnifiedIndividual via BFS', () => {
      const graph = new Map([
        [
          UNIFIED_DMO,
          {
            dmoApiName: UNIFIED_DMO,
            label: UNIFIED_DMO,
            edges: [{ targetDmo: 'A', sourceField: 'Id', targetField: 'UId', type: 'lookup' }],
            annotatedEdges: [],
            recordCount: 1,
            fields: [],
          },
        ],
        [
          'A',
          {
            dmoApiName: 'A',
            label: 'A',
            edges: [{ targetDmo: 'B', sourceField: 'AId', targetField: 'Id', type: 'lookup' }],
            annotatedEdges: [],
            recordCount: 5,
            fields: [],
          },
        ],
        [
          'B',
          {
            dmoApiName: 'B',
            label: 'B',
            edges: [],
            annotatedEdges: [],
            recordCount: 3,
            fields: [],
          },
        ],
        [
          'Isolated',
          {
            dmoApiName: 'Isolated',
            label: 'Isolated',
            edges: [],
            annotatedEdges: [],
            recordCount: 0,
            fields: [],
          },
        ],
      ]);

      const reachable = builder.getReachableNodes(graph);

      expect(reachable.has(UNIFIED_DMO)).toBe(true);
      expect(reachable.has('A')).toBe(true);
      expect(reachable.has('B')).toBe(true);
      expect(reachable.has('Isolated')).toBe(false);
    });

    it('includes nodes reachable via annotated edges', () => {
      const graph = new Map([
        [
          UNIFIED_DMO,
          {
            dmoApiName: UNIFIED_DMO,
            label: UNIFIED_DMO,
            edges: [],
            annotatedEdges: [
              {
                targetDmo: 'AnnotatedDMO',
                sourceField: 'Id',
                targetField: 'UId',
                joinType: 'inner' as const,
                annotationId: 'ann-1',
                rationale: null,
                status: 'proposed' as const,
              },
            ],
            recordCount: 1,
            fields: [],
          },
        ],
        [
          'AnnotatedDMO',
          {
            dmoApiName: 'AnnotatedDMO',
            label: 'AnnotatedDMO',
            edges: [],
            annotatedEdges: [],
            recordCount: 2,
            fields: [],
          },
        ],
      ]);

      const reachable = builder.getReachableNodes(graph);
      expect(reachable.has('AnnotatedDMO')).toBe(true);
    });

    it('handles cycles without infinite loop', () => {
      const graph = new Map([
        [
          UNIFIED_DMO,
          {
            dmoApiName: UNIFIED_DMO,
            label: UNIFIED_DMO,
            edges: [{ targetDmo: 'A', sourceField: 'Id', targetField: 'Id', type: 'lookup' }],
            annotatedEdges: [],
            recordCount: 1,
            fields: [],
          },
        ],
        [
          'A',
          {
            dmoApiName: 'A',
            label: 'A',
            // Cycle back to UnifiedIndividual
            edges: [{ targetDmo: UNIFIED_DMO, sourceField: 'Id', targetField: 'Id', type: 'lookup' }],
            annotatedEdges: [],
            recordCount: 1,
            fields: [],
          },
        ],
      ]);

      expect(() => builder.getReachableNodes(graph)).not.toThrow();
      const reachable = builder.getReachableNodes(graph);
      expect(reachable.has('A')).toBe(true);
    });

    it('returns only root node when graph has no edges from it', () => {
      const graph = new Map([
        [
          UNIFIED_DMO,
          {
            dmoApiName: UNIFIED_DMO,
            label: UNIFIED_DMO,
            edges: [],
            annotatedEdges: [],
            recordCount: 1,
            fields: [],
          },
        ],
        [
          'Orphan',
          {
            dmoApiName: 'Orphan',
            label: 'Orphan',
            edges: [],
            annotatedEdges: [],
            recordCount: 5,
            fields: [],
          },
        ],
      ]);

      const reachable = builder.getReachableNodes(graph);
      expect(reachable.size).toBe(1);
      expect(reachable.has(UNIFIED_DMO)).toBe(true);
    });
  });
});
