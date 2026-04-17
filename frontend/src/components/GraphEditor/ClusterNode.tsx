'use client';

import { memo } from 'react';
import { NodeProps } from 'reactflow';
import { ChevronDown, ChevronRight, Layers } from 'lucide-react';
import { ClusterCategory } from './clusterUtils';

interface ClusterNodeData {
  category: ClusterCategory;
  label: string;
  nodeCount: number;
  collapsed: boolean;
  color: { bg: string; border: string; text: string };
  childIds: string[];
  onToggle?: (category: ClusterCategory) => void;
}

function ClusterNode({ data }: NodeProps<ClusterNodeData>) {
  return (
    <div
      style={{
        backgroundColor: data.color.bg,
        borderColor: data.color.border,
        color: data.color.text,
        width: '100%',
        height: '100%',
        minHeight: data.collapsed ? 52 : undefined,
      }}
      className="rounded-xl border-2 overflow-hidden"
    >
      {/* Header */}
      <button
        onClick={() => data.onToggle?.(data.category)}
        className="w-full flex items-center gap-2 px-3 py-3 hover:opacity-80 transition-opacity"
        style={{ color: data.color.text }}
      >
        {data.collapsed ? (
          <ChevronRight className="w-4 h-4 shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 shrink-0" />
        )}
        <Layers className="w-4 h-4 shrink-0" />
        <span className="text-xs font-bold tracking-wide truncate">{data.category}</span>
        <span
          className="ml-auto text-xs px-1.5 py-0.5 rounded-full shrink-0"
          style={{ background: data.color.border + '33' }}
        >
          {data.nodeCount}
        </span>
      </button>

      {data.collapsed && (
        <div className="px-3 pb-2 text-[10px] opacity-60">
          {data.nodeCount} DMO{data.nodeCount !== 1 ? 's' : ''} — click to expand
        </div>
      )}
    </div>
  );
}

export default memo(ClusterNode);
