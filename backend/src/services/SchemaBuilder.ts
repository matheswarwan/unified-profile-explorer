import { createClient, RedisClientType } from 'redis';
import pool from '../db/connection';
import { DataCloudClient } from './DataCloudClient';
import {
  Org,
  DmoSchema,
  AdjacencyNode,
  ReactFlowNode,
  ReactFlowEdge,
  ReactFlowLayout,
  Annotation,
  AnnotationEdge,
} from '../types';

const UNIFIED_INDIVIDUAL_DMO = 'ssot__UnifiedIndividual__dlm';
const REDIS_TTL_SECONDS = 3600; // 60 minutes

let redisClient: RedisClientType | null = null;

async function getRedisClient(): Promise<RedisClientType | null> {
  if (!process.env.REDIS_URL) return null;
  if (redisClient) return redisClient;

  try {
    redisClient = createClient({ url: process.env.REDIS_URL }) as RedisClientType;
    redisClient.on('error', (err: Error) => {
      console.error('[Redis] Client error:', err);
    });
    await redisClient.connect();
    return redisClient;
  } catch (err) {
    console.warn('[Redis] Could not connect, caching disabled:', err);
    return null;
  }
}

async function getOrgById(orgId: string): Promise<Org | null> {
  const result = await pool.query<Org>('SELECT * FROM orgs WHERE id = $1', [orgId]);
  return result.rows[0] ?? null;
}

async function getAnnotationsForOrg(orgId: string): Promise<Annotation[]> {
  const result = await pool.query<Annotation>(
    `SELECT * FROM annotations
     WHERE org_id = $1
       AND annotation_type = 'edge'
       AND status != 'deprecated'`,
    [orgId]
  );
  return result.rows;
}

function buildAdjacencyList(schemas: DmoSchema[]): Map<string, AdjacencyNode> {
  const graph = new Map<string, AdjacencyNode>();

  for (const schema of schemas) {
    graph.set(schema.apiName, {
      dmoApiName: schema.apiName,
      label: schema.label,
      edges: schema.relationships,
      annotatedEdges: [],
      recordCount: schema.recordCount ?? null,
      fields: schema.fields,
    });
  }

  return graph;
}

function overlayAnnotations(
  graph: Map<string, AdjacencyNode>,
  annotations: Annotation[]
): Map<string, AdjacencyNode> {
  for (const ann of annotations) {
    if (!ann.source_dmo || !ann.target_dmo) continue;

    const node = graph.get(ann.source_dmo);
    if (!node) {
      // Create a placeholder node if not in schema
      graph.set(ann.source_dmo, {
        dmoApiName: ann.source_dmo,
        label: ann.source_dmo,
        edges: [],
        annotatedEdges: [],
        recordCount: null,
      });
    }

    const sourceNode = graph.get(ann.source_dmo)!;
    const annotatedEdge: AnnotationEdge = {
      targetDmo: ann.target_dmo,
      sourceField: ann.source_field || '',
      targetField: ann.target_field || '',
      joinType: ann.join_type || 'inner',
      annotationId: ann.id,
      rationale: ann.rationale,
      status: ann.status,
    };

    // Avoid duplicates
    const exists = sourceNode.annotatedEdges.some(
      (e) => e.targetDmo === ann.target_dmo && e.annotationId === ann.id
    );
    if (!exists) {
      sourceNode.annotatedEdges.push(annotatedEdge);
    }
  }

  return graph;
}

function runBFS(
  graph: Map<string, AdjacencyNode>,
  startNode: string
): Set<string> {
  const visited = new Set<string>();
  const queue: string[] = [startNode];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    const node = graph.get(current);
    if (!node) continue;

    for (const edge of node.edges) {
      if (!visited.has(edge.targetDmo)) {
        queue.push(edge.targetDmo);
      }
    }

    for (const edge of node.annotatedEdges) {
      if (!visited.has(edge.targetDmo)) {
        queue.push(edge.targetDmo);
      }
    }
  }

  return visited;
}

function graphToReactFlow(
  graph: Map<string, AdjacencyNode>,
  reachableNodes: Set<string>
): ReactFlowLayout {
  const nodes: ReactFlowNode[] = [];
  const edges: ReactFlowEdge[] = [];
  const edgeIds = new Set<string>();

  let xOffset = 0;
  let yOffset = 0;
  let col = 0;
  const COLS = 5;
  const X_GAP = 250;
  const Y_GAP = 150;

  // Place Unified Individual first
  const sortedKeys = [
    UNIFIED_INDIVIDUAL_DMO,
    ...Array.from(graph.keys()).filter((k) => k !== UNIFIED_INDIVIDUAL_DMO),
  ];

  for (const dmoName of sortedKeys) {
    const node = graph.get(dmoName);
    if (!node) continue;

    const isReachable = reachableNodes.has(dmoName);
    const hasData =
      node.recordCount !== null && node.recordCount !== undefined && node.recordCount > 0;

    let status: 'reachable' | 'unreachable' | 'no-data';
    if (isReachable) {
      status = hasData ? 'reachable' : 'no-data';
    } else {
      status = 'unreachable';
    }

    nodes.push({
      id: dmoName,
      type: 'dmoNode',
      position: {
        x: (col % COLS) * X_GAP,
        y: Math.floor(col / COLS) * Y_GAP,
      },
      data: {
        label: node.label,
        apiName: dmoName,
        recordCount: node.recordCount ?? null,
        status,
        fields: node.fields || [],
        lastIngestionAt: null,
      },
    });

    col++;

    // Add native edges
    for (const edge of node.edges) {
      const edgeId = `native-${dmoName}-${edge.targetDmo}-${edge.sourceField}`;
      if (!edgeIds.has(edgeId)) {
        edgeIds.add(edgeId);
        edges.push({
          id: edgeId,
          source: dmoName,
          target: edge.targetDmo,
          type: 'smoothstep',
          data: {
            sourceField: edge.sourceField,
            targetField: edge.targetField,
            isAnnotated: false,
          },
          label: `${edge.sourceField} → ${edge.targetField}`,
        });
      }
    }

    // Add annotated edges
    for (const edge of node.annotatedEdges) {
      const edgeId = `annotated-${edge.annotationId}`;
      if (!edgeIds.has(edgeId)) {
        edgeIds.add(edgeId);
        edges.push({
          id: edgeId,
          source: dmoName,
          target: edge.targetDmo,
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#f59e0b', strokeDasharray: '5,5' },
          data: {
            sourceField: edge.sourceField,
            targetField: edge.targetField,
            isAnnotated: true,
            annotationId: edge.annotationId,
            rationale: edge.rationale ?? undefined,
            status: edge.status,
          },
          label: `${edge.sourceField} → ${edge.targetField}`,
        });
      }
    }

    xOffset = (col % COLS) * X_GAP;
    yOffset = Math.floor(col / COLS) * Y_GAP;
  }

  void xOffset;
  void yOffset;

  return { nodes, edges };
}

export class SchemaBuilder {
  private orgId: string;

  constructor(orgId: string) {
    this.orgId = orgId;
  }

  async buildGraph(): Promise<ReactFlowLayout> {
    const org = await getOrgById(this.orgId);
    if (!org) throw new Error(`Org ${this.orgId} not found`);

    const client = new DataCloudClient(org);

    let schemas: DmoSchema[];
    try {
      schemas = await client.introspectSchema();
    } catch (err) {
      console.warn('[SchemaBuilder] Failed to introspect schema, using cached data:', err);
      schemas = await this.getSchemasFromDb();
    }

    // Persist schemas to DB cache
    await this.persistSchemasToDb(schemas);

    // Build adjacency list
    let graph = buildAdjacencyList(schemas);

    // Overlay annotations
    const annotations = await getAnnotationsForOrg(this.orgId);
    graph = overlayAnnotations(graph, annotations);

    // BFS reachability
    const reachableNodes = runBFS(graph, UNIFIED_INDIVIDUAL_DMO);

    // Convert to React Flow format
    const layout = graphToReactFlow(graph, reachableNodes);

    // Cache in Redis
    await this.cacheLayout(layout);

    return layout;
  }

  async getGraph(): Promise<ReactFlowLayout> {
    // Try Redis cache first
    const cached = await this.getCachedLayout();
    if (cached) return cached;

    // Rebuild
    return this.buildGraph();
  }

  async getAdjacencyList(): Promise<Map<string, AdjacencyNode>> {
    const org = await getOrgById(this.orgId);
    if (!org) throw new Error(`Org ${this.orgId} not found`);

    const schemas = await this.getSchemasFromDb();
    let graph = buildAdjacencyList(schemas);

    const annotations = await getAnnotationsForOrg(this.orgId);
    graph = overlayAnnotations(graph, annotations);

    return graph;
  }

  getReachableNodes(graph: Map<string, AdjacencyNode>): Set<string> {
    return runBFS(graph, UNIFIED_INDIVIDUAL_DMO);
  }

  private async persistSchemasToDb(schemas: DmoSchema[]): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const schema of schemas) {
        await client.query(
          `INSERT INTO dmo_schema_cache (org_id, dmo_api_name, schema_json, record_count, cached_at, ttl_minutes)
           VALUES ($1, $2, $3, $4, NOW(), 60)
           ON CONFLICT (org_id, dmo_api_name)
           DO UPDATE SET schema_json = EXCLUDED.schema_json,
                         record_count = EXCLUDED.record_count,
                         cached_at = NOW()`,
          [this.orgId, schema.apiName, JSON.stringify(schema), schema.recordCount ?? null]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[SchemaBuilder] Failed to persist schemas:', err);
    } finally {
      client.release();
    }
  }

  private async getSchemasFromDb(): Promise<DmoSchema[]> {
    const result = await pool.query<{ schema_json: DmoSchema }>(
      `SELECT schema_json FROM dmo_schema_cache
       WHERE org_id = $1
         AND cached_at > NOW() - INTERVAL '1 hour'`,
      [this.orgId]
    );
    return result.rows.map((r) => r.schema_json);
  }

  private async cacheLayout(layout: ReactFlowLayout): Promise<void> {
    const redis = await getRedisClient();
    if (!redis) return;

    const key = `schema:${this.orgId}:layout`;
    try {
      await redis.setEx(key, REDIS_TTL_SECONDS, JSON.stringify(layout));
    } catch (err) {
      console.warn('[SchemaBuilder] Redis cache write failed:', err);
    }
  }

  private async getCachedLayout(): Promise<ReactFlowLayout | null> {
    const redis = await getRedisClient();
    if (!redis) return null;

    const key = `schema:${this.orgId}:layout`;
    try {
      const cached = await redis.get(key);
      if (cached) return JSON.parse(cached) as ReactFlowLayout;
    } catch (err) {
      console.warn('[SchemaBuilder] Redis cache read failed:', err);
    }
    return null;
  }

  async clearCache(): Promise<void> {
    const redis = await getRedisClient();
    if (!redis) return;

    const key = `schema:${this.orgId}:layout`;
    try {
      await redis.del(key);
    } catch (err) {
      console.warn('[SchemaBuilder] Redis cache clear failed:', err);
    }
  }
}
