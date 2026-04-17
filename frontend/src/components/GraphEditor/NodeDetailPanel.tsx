'use client';

import { useEffect, useState } from 'react';
import { annotationsApi, Annotation, GraphNodeData } from '@/lib/api';
import { X, Database, List, AlertTriangle, MessageSquare, Clock } from 'lucide-react';

interface NodeDetailPanelProps {
  node: { id: string; data: GraphNodeData };
  orgId: string;
  onClose: () => void;
  onAnnotate: (dmoName: string) => void;
}

export default function NodeDetailPanel({ node, orgId, onClose, onAnnotate }: NodeDetailPanelProps) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    annotationsApi.list(orgId).then((all) => {
      setAnnotations(
        all.filter(
          (a) => a.source_dmo === node.data.apiName || a.target_dmo === node.data.apiName
        )
      );
      setLoading(false);
    });
  }, [orgId, node.data.apiName]);

  const d = node.data;
  const statusColor =
    d.status === 'reachable'
      ? 'text-green-400'
      : d.status === 'unreachable'
      ? 'text-yellow-400'
      : 'text-gray-500';

  return (
    <div className="absolute top-4 right-4 z-20 w-80 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl flex flex-col max-h-[80vh] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-indigo-400" />
          <span className="font-semibold text-gray-100 text-sm truncate">{d.label}</span>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-300 ml-2">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Meta */}
        <div className="space-y-2 text-sm">
          <Row label="API Name" value={<code className="text-xs text-gray-400">{d.apiName}</code>} />
          <Row
            label="Status"
            value={<span className={`text-xs font-medium ${statusColor}`}>{d.status}</span>}
          />
          {d.recordCount !== null && (
            <Row label="Records" value={d.recordCount.toLocaleString()} />
          )}
          {d.lastIngestionAt && (
            <Row
              label="Last Ingestion"
              value={
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <Clock className="w-3 h-3" />
                  {new Date(d.lastIngestionAt).toLocaleString()}
                </span>
              }
            />
          )}
        </div>

        {/* Fields */}
        {d.fields.length > 0 && (
          <div>
            <div className="flex items-center gap-1 text-xs font-medium text-gray-500 mb-2">
              <List className="w-3 h-3" />
              Fields ({d.fields.length})
            </div>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {d.fields.map((f) => (
                <div key={f.name} className="flex items-center justify-between text-xs">
                  <span className="text-gray-300 font-mono">{f.name}</span>
                  <span className="text-gray-600">{f.type}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Annotations */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1 text-xs font-medium text-gray-500">
              <MessageSquare className="w-3 h-3" />
              Annotations
            </div>
            <button
              onClick={() => onAnnotate(d.apiName)}
              className="text-xs text-indigo-400 hover:text-indigo-300 hover:underline"
            >
              + Add
            </button>
          </div>

          {loading && (
            <div className="h-12 bg-gray-800 rounded animate-pulse" />
          )}

          {!loading && annotations.length === 0 && (
            <div className="text-xs text-gray-600 py-2">No annotations on this DMO.</div>
          )}

          {annotations.map((a) => (
            <div
              key={a.id}
              className="bg-gray-800 rounded-lg p-3 mb-2 text-xs space-y-1"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    a.annotation_type === 'gap_flag' && a.severity === 'blocker'
                      ? 'bg-red-900 text-red-300'
                      : a.annotation_type === 'gap_flag' && a.severity === 'warning'
                      ? 'bg-yellow-900 text-yellow-300'
                      : 'bg-gray-700 text-gray-400'
                  }`}
                >
                  {a.annotation_type.replace('_', ' ')}
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    a.status === 'validated'
                      ? 'bg-green-900 text-green-300'
                      : a.status === 'deprecated'
                      ? 'bg-gray-700 text-gray-500'
                      : 'bg-blue-900 text-blue-300'
                  }`}
                >
                  {a.status}
                </span>
              </div>
              {a.rationale && <p className="text-gray-400">{a.rationale}</p>}
              {a.creator_name && (
                <p className="text-gray-600">by {a.creator_name}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 py-3 border-t border-gray-800">
        <button
          onClick={() => onAnnotate(d.apiName)}
          className="w-full px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors"
        >
          Add Annotation
        </button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
