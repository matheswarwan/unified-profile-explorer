'use client';

import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { GraphNodeData } from '@/lib/api';
import { Database, AlertCircle, Circle } from 'lucide-react';

const STATUS_STYLES = {
  reachable: {
    border: 'border-green-600',
    bg: 'bg-green-900/20',
    dot: 'bg-green-400',
    label: 'Linked',
  },
  unreachable: {
    border: 'border-yellow-600',
    bg: 'bg-yellow-900/20',
    dot: 'bg-yellow-400',
    label: 'Unreachable',
  },
  'no-data': {
    border: 'border-gray-700',
    bg: 'bg-gray-900',
    dot: 'bg-gray-600',
    label: 'No Data',
  },
};

function DmoNode({ data, selected }: NodeProps<GraphNodeData>) {
  const style = STATUS_STYLES[data.status];

  return (
    <div
      className={`min-w-[160px] max-w-[220px] rounded-xl border-2 ${style.border} ${style.bg} shadow-lg cursor-pointer transition-all ${
        selected ? 'ring-2 ring-indigo-500 ring-offset-1 ring-offset-gray-950' : ''
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-600 !border-gray-500" />
      <Handle type="target" position={Position.Left} className="!bg-gray-600 !border-gray-500" />

      <div className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Database className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <span className="text-xs font-semibold text-gray-100 truncate flex-1">{data.label}</span>
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`}
            title={style.label}
          />
        </div>

        <div className="text-[10px] text-gray-600 font-mono mt-1 truncate">{data.apiName}</div>

        {data.recordCount !== null && (
          <div className="text-[10px] text-gray-500 mt-1">
            {data.recordCount.toLocaleString()} records
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-gray-600 !border-gray-500" />
      <Handle type="source" position={Position.Right} className="!bg-gray-600 !border-gray-500" />
    </div>
  );
}

export default memo(DmoNode);
