'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Connection,
  NodeMouseHandler,
  Edge,
  Node,
  BackgroundVariant,
  ReactFlowProvider,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { schemaApi, annotationsApi, Annotation, GraphLayout, ReactFlowNode, ReactFlowEdge, GraphNodeData } from '@/lib/api';
import { showToast } from '@/app/layout';
import { joinOrgRoom, leaveOrgRoom, onAnnotationEvent } from '@/lib/socket';
import { useAuth } from '@/lib/auth';
import DmoNode from './DmoNode';
import ClusterNode from './ClusterNode';
import AnnotationForm from './AnnotationForm';
import NodeDetailPanel from './NodeDetailPanel';
import { buildClusteredLayout, ClusterCategory } from './clusterUtils';
import { RefreshCw, Search, Eye, EyeOff, Download, Layers } from 'lucide-react';

const NODE_TYPES = { dmoNode: DmoNode, clusterNode: ClusterNode };

interface GraphEditorInnerProps {
  orgId: string;
}

function GraphEditorInner({ orgId }: GraphEditorInnerProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAnnotationForm, setShowAnnotationForm] = useState(false);
  const [annotationSource, setAnnotationSource] = useState<string>('');
  const [annotationTarget, setAnnotationTarget] = useState<string>('');
  const [selectedAnnotation, setSelectedAnnotation] = useState<Annotation | undefined>();
  const [selectedNode, setSelectedNode] = useState<Node<GraphNodeData> | null>(null);
  const [filterText, setFilterText] = useState('');
  const [reachableOnly, setReachableOnly] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [clusterMode, setClusterMode] = useState(false);
  const [collapsedClusters, setCollapsedClusters] = useState<Set<ClusterCategory>>(new Set());
  const { token } = useAuth();

  const { fitView } = useReactFlow();

  const loadGraph = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const graph: GraphLayout = await schemaApi.getGraph(orgId);
      const flowNodes = graph.nodes.map((n: ReactFlowNode) => ({
        ...n,
        type: 'dmoNode',
      }));
      const flowEdges = graph.edges.map((e: ReactFlowEdge) => ({
        ...e,
        style: e.data?.isAnnotated
          ? { stroke: '#f59e0b', strokeDasharray: '5,5' }
          : { stroke: '#4f46e5' },
        animated: e.data?.isAnnotated,
        labelStyle: { fill: '#9ca3af', fontSize: 10 },
      }));
      setNodes(flowNodes);
      setEdges(flowEdges);
      setTimeout(() => fitView({ padding: 0.1 }), 100);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load graph';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [orgId, setNodes, setEdges, fitView]);

  useEffect(() => {
    loadGraph();
  }, [loadGraph]);

  // Real-time annotation sync via WebSocket
  useEffect(() => {
    if (!token) return;
    const s = joinOrgRoom(token, orgId);
    const unsub = onAnnotationEvent(s, (event) => {
      if (event.type === 'annotation:created' || event.type === 'annotation:updated') {
        showToast(`Annotation ${event.type === 'annotation:created' ? 'added' : 'updated'} by another user`, 'info');
        void loadGraph();
      } else if (event.type === 'annotation:deleted') {
        showToast('An annotation was deleted by another user', 'info');
        void loadGraph();
      }
    });
    return () => {
      unsub();
      leaveOrgRoom(orgId);
    };
  }, [token, orgId, loadGraph]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await schemaApi.refresh(orgId);
      showToast(`Graph refreshed: ${res.nodeCount} nodes, ${res.edgeCount} edges`, 'success');
      await loadGraph();
    } catch {
      showToast('Refresh failed', 'error');
    } finally {
      setRefreshing(false);
    }
  };

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      // Find DMO API names from node IDs
      const sourceNode = nodes.find((n) => n.id === connection.source);
      const targetNode = nodes.find((n) => n.id === connection.target);
      if (!sourceNode || !targetNode) return;

      setAnnotationSource((sourceNode.data as GraphNodeData).apiName);
      setAnnotationTarget((targetNode.data as GraphNodeData).apiName);
      setSelectedAnnotation(undefined);
      setShowAnnotationForm(true);
    },
    [nodes]
  );

  const handleNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    setSelectedNode(node as Node<GraphNodeData>);
  }, []);

  const handleEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      if (edge.data?.isAnnotated && edge.data?.annotationId) {
        annotationsApi.list(orgId).then((all) => {
          const ann = all.find((a) => a.id === edge.data.annotationId);
          if (ann) {
            setAnnotationSource(ann.source_dmo ?? '');
            setAnnotationTarget(ann.target_dmo ?? '');
            setSelectedAnnotation(ann);
            setShowAnnotationForm(true);
          }
        });
      }
    },
    [orgId]
  );

  const handleAnnotationSaved = async () => {
    setShowAnnotationForm(false);
    showToast('Annotation saved — refreshing graph…', 'success');
    await loadGraph();
  };

  const handleSaveLayout = useCallback(async () => {
    try {
      const layout: GraphLayout = {
        nodes: nodes.map((n) => ({
          id: n.id,
          type: n.type ?? 'dmoNode',
          position: n.position,
          data: n.data as GraphNodeData,
        })) as ReactFlowNode[],
        edges: edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          type: e.type ?? 'default',
          animated: e.animated,
          style: e.style as Record<string, unknown>,
          data: e.data,
          label: typeof e.label === 'string' ? e.label : undefined,
        })) as ReactFlowEdge[],
      };
      await schemaApi.saveLayout(orgId, layout);
      showToast('Layout saved', 'success');
    } catch {
      showToast('Failed to save layout', 'error');
    }
  }, [nodes, edges, orgId]);

  const toggleCluster = useCallback((category: ClusterCategory) => {
    setCollapsedClusters((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }, []);

  const { filteredNodes, filteredEdges } = useMemo(() => {
    // Base filter: text + reachable-only
    const baseNodes = nodes.map((n) => {
      const data = n.data as GraphNodeData;
      const nameMatch =
        !filterText ||
        data.label.toLowerCase().includes(filterText.toLowerCase()) ||
        data.apiName.toLowerCase().includes(filterText.toLowerCase());
      const reachableMatch = !reachableOnly || data.status === 'reachable';
      return { ...n, hidden: !nameMatch || !reachableMatch };
    });

    const visibleNodes = baseNodes.filter((n) => !n.hidden);

    if (!clusterMode || visibleNodes.length < 8) {
      return { filteredNodes: baseNodes, filteredEdges: edges };
    }

    // Build clustered layout — inject toggle callback into cluster node data
    const clustered = buildClusteredLayout(visibleNodes, edges, collapsedClusters);
    const clusteredWithToggle = clustered.nodes.map((n) => {
      if (n.type === 'clusterNode') {
        return { ...n, data: { ...n.data, onToggle: toggleCluster } };
      }
      return n;
    });

    return { filteredNodes: clusteredWithToggle as typeof baseNodes, filteredEdges: clustered.edges };
  }, [nodes, edges, filterText, reachableOnly, clusterMode, collapsedClusters, toggleCluster]);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-950">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Building data model graph…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-950">
        <div className="text-center">
          <p className="text-red-400 mb-3">{error}</p>
          <button
            onClick={loadGraph}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {/* Toolbar */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Search DMOs…"
            className="bg-gray-900 border border-gray-700 rounded-lg pl-8 pr-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500 w-48"
          />
        </div>

        <button
          onClick={() => setReachableOnly((r) => !r)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-colors ${
            reachableOnly
              ? 'bg-indigo-600 border-indigo-500 text-white'
              : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-600'
          }`}
        >
          {reachableOnly ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          {reachableOnly ? 'Reachable only' : 'Show all'}
        </button>

        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-gray-900 border border-gray-700 text-gray-400 hover:border-gray-600 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>

        <button
          onClick={() => setClusterMode((c) => !c)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-colors ${
            clusterMode
              ? 'bg-indigo-600 border-indigo-500 text-white'
              : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-600'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          {clusterMode ? 'Clustered' : 'Cluster'}
        </button>

        <button
          onClick={handleSaveLayout}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-gray-900 border border-gray-700 text-gray-400 hover:border-gray-600"
        >
          <Download className="w-3.5 h-3.5" />
          Save Layout
        </button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-10 bg-gray-900/90 border border-gray-800 rounded-lg px-3 py-2 flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-green-400" /> Linked
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" /> Unreachable
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-gray-600" /> No Data
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-6 border-b-2 border-dashed border-amber-400" /> Team-defined
        </span>
      </div>

      <ReactFlow
        nodes={filteredNodes}
        edges={filteredEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        nodeTypes={NODE_TYPES}
        fitView
        className="bg-gray-950"
        defaultEdgeOptions={{ type: 'smoothstep' }}
      >
        <Background variant={BackgroundVariant.Dots} color="#374151" gap={20} size={1} />
        <Controls className="!bg-gray-900 !border-gray-700" />
        <MiniMap
          nodeColor={(n) => {
            const d = n.data as GraphNodeData;
            return d.status === 'reachable'
              ? '#16a34a'
              : d.status === 'unreachable'
              ? '#ca8a04'
              : '#374151';
          }}
          className="!bg-gray-900 !border-gray-700"
        />
      </ReactFlow>

      {/* Node detail panel */}
      {selectedNode && (
        <NodeDetailPanel
          node={selectedNode}
          orgId={orgId}
          onClose={() => setSelectedNode(null)}
          onAnnotate={(dmoName) => {
            setAnnotationSource(dmoName);
            setAnnotationTarget('');
            setSelectedAnnotation(undefined);
            setShowAnnotationForm(true);
            setSelectedNode(null);
          }}
        />
      )}

      {/* Annotation form */}
      {showAnnotationForm && (
        <AnnotationForm
          orgId={orgId}
          annotation={selectedAnnotation}
          prefilledSource={annotationSource}
          prefilledTarget={annotationTarget}
          onSaved={handleAnnotationSaved}
          onClose={() => setShowAnnotationForm(false)}
        />
      )}
    </div>
  );
}

export default function GraphEditor({ orgId }: { orgId: string }) {
  return (
    <ReactFlowProvider>
      <GraphEditorInner orgId={orgId} />
    </ReactFlowProvider>
  );
}
