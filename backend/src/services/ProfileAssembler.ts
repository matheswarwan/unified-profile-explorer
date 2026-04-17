import pool from '../db/connection';
import { DataCloudClient } from './DataCloudClient';
import { SchemaBuilder } from './SchemaBuilder';
import {
  Org,
  DmoProfileResult,
  AdjacencyNode,
  AnnotationEdge,
} from '../types';

const MAX_PARALLEL_QUERIES = 5;
const UNIFIED_INDIVIDUAL_DMO = 'ssot__UnifiedIndividual__dlm';

async function getOrgById(orgId: string): Promise<Org | null> {
  const result = await pool.query<Org>('SELECT * FROM orgs WHERE id = $1', [orgId]);
  return result.rows[0] ?? null;
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

interface DmoQueryTask {
  dmoApiName: string;
  label: string;
  joinField: string;
  isAnnotated: boolean;
  annotationEdge?: AnnotationEdge;
  sourceDmo?: string;
}

export class ProfileAssembler {
  private orgId: string;

  constructor(orgId: string) {
    this.orgId = orgId;
  }

  async assemble(individualId: string): Promise<DmoProfileResult[]> {
    const org = await getOrgById(this.orgId);
    if (!org) throw new Error(`Org ${this.orgId} not found`);

    const client = new DataCloudClient(org);
    const schemaBuilder = new SchemaBuilder(this.orgId);

    // Get the adjacency list
    let graph: Map<string, AdjacencyNode>;
    try {
      graph = await schemaBuilder.getAdjacencyList();
    } catch (err) {
      console.error('[ProfileAssembler] Failed to get adjacency list:', err);
      throw new Error('Failed to load org schema');
    }

    // BFS to find reachable DMOs and build query tasks
    const tasks = this.buildQueryTasks(graph, individualId);

    // Execute in parallel batches
    const results: DmoProfileResult[] = [];
    const chunks = chunkArray(tasks, MAX_PARALLEL_QUERIES);

    for (const chunk of chunks) {
      const settled = await Promise.allSettled(
        chunk.map((task) => this.executeTask(client, task, individualId, graph))
      );

      for (let i = 0; i < settled.length; i++) {
        const outcome = settled[i];
        const task = chunk[i];
        if (outcome.status === 'fulfilled') {
          results.push(outcome.value);
        } else {
          console.error(
            `[ProfileAssembler] Failed to query ${task.dmoApiName}:`,
            outcome.reason
          );
          results.push({
            dmoName: task.dmoApiName,
            displayName: task.label,
            fields: graph.get(task.dmoApiName)?.fields || [],
            records: [],
            source: task.isAnnotated ? 'team-defined' : 'native',
            error: String(outcome.reason),
          });
        }
      }
    }

    // Sort: identity first, then behavioural, then transactional, then custom
    return this.sortResults(results);
  }

  private buildQueryTasks(
    graph: Map<string, AdjacencyNode>,
    individualId: string
  ): DmoQueryTask[] {
    const visited = new Set<string>();
    const tasks: DmoQueryTask[] = [];
    const queue: Array<{ dmo: string; isAnnotated: boolean; annotationEdge?: AnnotationEdge; sourceDmo?: string }> = [
      { dmo: UNIFIED_INDIVIDUAL_DMO, isAnnotated: false },
    ];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current.dmo)) continue;
      visited.add(current.dmo);

      const node = graph.get(current.dmo);
      if (!node) continue;

      // Add as task (skip the root unified individual node itself)
      if (current.dmo !== UNIFIED_INDIVIDUAL_DMO) {
        tasks.push({
          dmoApiName: current.dmo,
          label: node.label,
          joinField: this.inferJoinField(current.dmo),
          isAnnotated: current.isAnnotated,
          annotationEdge: current.annotationEdge,
          sourceDmo: current.sourceDmo,
        });
      }

      // Enqueue native edges
      for (const edge of node.edges) {
        if (!visited.has(edge.targetDmo)) {
          queue.push({ dmo: edge.targetDmo, isAnnotated: false });
        }
      }

      // Enqueue annotated edges
      for (const edge of node.annotatedEdges) {
        if (!visited.has(edge.targetDmo)) {
          queue.push({
            dmo: edge.targetDmo,
            isAnnotated: true,
            annotationEdge: edge,
            sourceDmo: current.dmo,
          });
        }
      }
    }

    return tasks;
  }

  private inferJoinField(dmoApiName: string): string {
    // Common join field patterns in Data Cloud
    const commonFields = [
      'ssot__UnifiedIndividualId__c',
      'ssot__IndividualId__c',
      'IndividualId',
      'UnifiedIndividualId',
    ];
    // Return the most common; actual field resolution happens at query time
    return commonFields[0];
  }

  private async executeTask(
    client: DataCloudClient,
    task: DmoQueryTask,
    individualId: string,
    graph: Map<string, AdjacencyNode>
  ): Promise<DmoProfileResult> {
    const node = graph.get(task.dmoApiName);
    const fields = node?.fields || [];

    if (task.isAnnotated && task.annotationEdge && task.sourceDmo) {
      return this.executeAnnotatedTask(client, task, individualId, fields, graph);
    }

    // Native query: SELECT * FROM dmo WHERE joinField = individualId
    const soql = `
      SELECT *
      FROM ${task.dmoApiName}
      WHERE ${task.joinField} = '${individualId.replace(/'/g, "\\'")}'
      LIMIT 100
    `;

    const result = await client.query(soql);

    return {
      dmoName: task.dmoApiName,
      displayName: task.label,
      fields,
      records: result.data || [],
      source: 'native',
    };
  }

  private async executeAnnotatedTask(
    client: DataCloudClient,
    task: DmoQueryTask,
    individualId: string,
    fields: Array<{ name: string; label: string; type: string; nullable: boolean }>,
    graph: Map<string, AdjacencyNode>
  ): Promise<DmoProfileResult> {
    const edge = task.annotationEdge!;
    const sourceDmo = task.sourceDmo!;

    // Build a JOIN query for team-defined linkage
    const soql = `
      SELECT b.*
      FROM ${sourceDmo} a
      JOIN ${task.dmoApiName} b
        ON a.${edge.sourceField} = b.${edge.targetField}
      WHERE a.ssot__UnifiedIndividualId__c = '${individualId.replace(/'/g, "\\'")}'
      LIMIT 100
    `;

    const result = await client.query(soql);

    return {
      dmoName: task.dmoApiName,
      displayName: task.label,
      fields,
      records: result.data || [],
      source: 'team-defined',
      annotationId: edge.annotationId,
    };
  }

  private sortResults(results: DmoProfileResult[]): DmoProfileResult[] {
    const order: Record<string, number> = {
      // Identity DMOs first
      'ssot__UnifiedIndividual__dlm': 0,
      'ssot__Individual__dlm': 1,
      'ssot__ContactPointEmail__dlm': 2,
      'ssot__ContactPointPhone__dlm': 3,
      'ssot__ContactPointAddress__dlm': 4,
    };

    return results.sort((a, b) => {
      const aOrder = order[a.dmoName] ?? 100;
      const bOrder = order[b.dmoName] ?? 100;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.dmoName.localeCompare(b.dmoName);
    });
  }
}
