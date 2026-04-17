'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { patternsApi, Annotation } from '@/lib/api';
import { Library, ArrowRight, CheckCircle2, Clock, XCircle, Search } from 'lucide-react';

interface PatternLibraryProps {
  onApply?: (pattern: Annotation) => void;
  showApplyButton?: boolean;
}

export default function PatternLibrary({ onApply, showApplyButton = false }: PatternLibraryProps) {
  const [filter, setFilter] = useState('');

  const { data: patterns = [], isLoading } = useQuery({
    queryKey: ['patterns'],
    queryFn: patternsApi.list,
  });

  const filtered = patterns.filter((p) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (
      (p.source_dmo ?? '').toLowerCase().includes(q) ||
      (p.target_dmo ?? '').toLowerCase().includes(q) ||
      (p.pattern_description ?? '').toLowerCase().includes(q) ||
      (p.rationale ?? '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500 pointer-events-none" />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search patterns…"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
          />
        </div>
        <span className="text-sm text-gray-500">
          {filtered.length} pattern{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="text-center py-16 text-gray-500">
          <Library className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">No patterns yet</p>
          <p className="text-sm mt-1">
            Mark annotations as &quot;reusable patterns&quot; in the graph editor to surface them here.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((p) => (
          <PatternCard key={p.id} pattern={p} onApply={onApply} showApplyButton={showApplyButton} />
        ))}
      </div>
    </div>
  );
}

function PatternCard({
  pattern: p,
  onApply,
  showApplyButton,
}: {
  pattern: Annotation;
  onApply?: (p: Annotation) => void;
  showApplyButton: boolean;
}) {
  const statusIcon =
    p.status === 'validated' ? (
      <CheckCircle2 className="w-4 h-4 text-green-400" />
    ) : p.status === 'deprecated' ? (
      <XCircle className="w-4 h-4 text-gray-500" />
    ) : (
      <Clock className="w-4 h-4 text-blue-400" />
    );

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col gap-3 hover:border-gray-700 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          {statusIcon}
          <span className="capitalize">{p.status}</span>
        </div>
        <span className="text-xs text-gray-600">{p.org_display_name ?? p.client_name}</span>
      </div>

      {/* DMO flow */}
      {p.source_dmo && p.target_dmo && (
        <div className="flex items-center gap-2 text-sm">
          <code className="text-xs text-indigo-300 bg-indigo-900/30 px-2 py-1 rounded truncate max-w-[120px]">
            {p.source_dmo}
          </code>
          <ArrowRight className="w-4 h-4 text-gray-600 shrink-0" />
          <code className="text-xs text-indigo-300 bg-indigo-900/30 px-2 py-1 rounded truncate max-w-[120px]">
            {p.target_dmo}
          </code>
        </div>
      )}

      {p.source_field && p.target_field && (
        <div className="text-xs text-gray-500">
          <span className="font-mono">{p.source_field}</span>
          {' → '}
          <span className="font-mono">{p.target_field}</span>
          {p.join_type && (
            <span className="ml-1 text-gray-600">({p.join_type.toUpperCase()} JOIN)</span>
          )}
        </div>
      )}

      {/* Pattern description */}
      {p.pattern_description && (
        <p className="text-sm text-gray-300 leading-relaxed">{p.pattern_description}</p>
      )}

      {/* Rationale */}
      {p.rationale && (
        <p className="text-xs text-gray-500 line-clamp-2">{p.rationale}</p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-800">
        <span className="text-xs text-gray-600">
          by {p.creator_name ?? 'Unknown'}
        </span>
        {showApplyButton && onApply && (
          <button
            onClick={() => onApply(p)}
            className="text-xs text-indigo-400 hover:text-indigo-300 hover:underline"
          >
            Apply to org →
          </button>
        )}
      </div>
    </div>
  );
}
