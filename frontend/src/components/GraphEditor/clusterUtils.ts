import { ReactFlowNode, ReactFlowEdge, GraphNodeData } from '@/lib/api';

export type ClusterCategory = 'Identity' | 'Behavioral' | 'Transactional' | 'Custom';

// Map DMO API name prefixes to cluster categories
const DMO_CATEGORY_MAP: Array<{ prefix: string; category: ClusterCategory }> = [
  { prefix: 'ssot__UnifiedIndividual', category: 'Identity' },
  { prefix: 'ssot__Individual', category: 'Identity' },
  { prefix: 'ssot__ContactPoint', category: 'Identity' },
  { prefix: 'ssot__PartyIdentification', category: 'Identity' },
  { prefix: 'ssot__Engagement', category: 'Behavioral' },
  { prefix: 'ssot__WebEvent', category: 'Behavioral' },
  { prefix: 'ssot__EmailEngagement', category: 'Behavioral' },
  { prefix: 'ssot__MobileAppEvent', category: 'Behavioral' },
  { prefix: 'ssot__Order', category: 'Transactional' },
  { prefix: 'ssot__SalesOrder', category: 'Transactional' },
  { prefix: 'ssot__Case', category: 'Transactional' },
  { prefix: 'ssot__Opportunity', category: 'Transactional' },
  { prefix: 'ssot__Product', category: 'Transactional' },
];

const CATEGORY_COLORS: Record<ClusterCategory, { bg: string; border: string; text: string }> = {
  Identity:     { bg: '#1e1b4b', border: '#6366f1', text: '#a5b4fc' },
  Behavioral:   { bg: '#14302a', border: '#16a34a', text: '#86efac' },
  Transactional:{ bg: '#1c1917', border: '#d97706', text: '#fcd34d' },
  Custom:       { bg: '#1a1a2e', border: '#6b7280', text: '#d1d5db' },
};

const X_CLUSTER_GAP = 350;
const Y_NODE_GAP = 130;
const CLUSTER_PADDING = 40;

export function categorize(apiName: string): ClusterCategory {
  for (const { prefix, category } of DMO_CATEGORY_MAP) {
    if (apiName.startsWith(prefix)) return category;
  }
  return 'Custom';
}

export interface ClusterNode {
  id: string;
  type: 'clusterNode';
  position: { x: number; y: number };
  data: {
    category: ClusterCategory;
    label: string;
    nodeCount: number;
    collapsed: boolean;
    color: { bg: string; border: string; text: string };
    childIds: string[];
  };
  style: { width: number; height: number };
}

/**
 * Build a clustered view from flat nodes.
 * Returns cluster header nodes + member nodes (hidden when collapsed).
 */
export function buildClusteredLayout(
  nodes: ReactFlowNode[],
  edges: ReactFlowEdge[],
  collapsedClusters: Set<ClusterCategory>
): { nodes: Array<ReactFlowNode | ClusterNode>; edges: ReactFlowEdge[] } {
  const categories: ClusterCategory[] = ['Identity', 'Behavioral', 'Transactional', 'Custom'];

  // Group nodes by category
  const groups = new Map<ClusterCategory, ReactFlowNode[]>();
  categories.forEach((c) => groups.set(c, []));

  for (const node of nodes) {
    const cat = categorize((node.data as GraphNodeData).apiName);
    groups.get(cat)!.push(node);
  }

  const resultNodes: Array<ReactFlowNode | ClusterNode> = [];
  const hiddenIds = new Set<string>();

  let clusterX = 0;

  for (const cat of categories) {
    const members = groups.get(cat)!;
    if (members.length === 0) continue;

    const collapsed = collapsedClusters.has(cat);
    const color = CATEGORY_COLORS[cat];

    const clusterHeight = collapsed
      ? 60
      : CLUSTER_PADDING * 2 + members.length * Y_NODE_GAP;

    const clusterWidth = 220;

    // Cluster header node
    const clusterId = `cluster-${cat}`;
    const clusterNode: ClusterNode = {
      id: clusterId,
      type: 'clusterNode',
      position: { x: clusterX, y: 0 },
      data: {
        category: cat,
        label: `${cat} (${members.length})`,
        nodeCount: members.length,
        collapsed,
        color,
        childIds: members.map((n) => n.id),
      },
      style: { width: clusterWidth, height: clusterHeight },
    };
    resultNodes.push(clusterNode);

    if (collapsed) {
      members.forEach((n) => hiddenIds.add(n.id));
    } else {
      // Position member nodes inside cluster
      members.forEach((node, i) => {
        resultNodes.push({
          ...node,
          position: {
            x: clusterX + CLUSTER_PADDING,
            y: CLUSTER_PADDING + i * Y_NODE_GAP,
          },
          parentNode: clusterId,
          extent: 'parent' as const,
        } as ReactFlowNode);
      });
    }

    clusterX += clusterWidth + X_CLUSTER_GAP;
  }

  // Filter edges: hide edges where either end is hidden
  const visibleEdges = edges.filter(
    (e) => !hiddenIds.has(e.source) && !hiddenIds.has(e.target)
  );

  return { nodes: resultNodes, edges: visibleEdges };
}
