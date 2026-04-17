'use client';

import { IndividualCandidate } from '@/lib/api';
import { User, ChevronRight } from 'lucide-react';

interface CandidateListProps {
  candidates: IndividualCandidate[];
  onSelect: (candidate: IndividualCandidate) => void;
  selectedId?: string;
}

export default function CandidateList({ candidates, onSelect, selectedId }: CandidateListProps) {
  if (candidates.length === 0) return null;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-300">
          {candidates.length} match{candidates.length !== 1 ? 'es' : ''} found
        </h3>
      </div>
      <div className="divide-y divide-gray-800">
        {candidates.map((c) => (
          <button
            key={c.id}
            onClick={() => onSelect(c)}
            className={`w-full flex items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-gray-800 ${
              selectedId === c.id ? 'bg-indigo-500/10 border-l-2 border-l-indigo-500' : ''
            }`}
          >
            <div className="w-10 h-10 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center shrink-0">
              <User className="w-5 h-5 text-gray-500" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="font-medium text-gray-100 text-sm">
                {c.firstName || c.lastName
                  ? `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim()
                  : 'Unknown Name'}
              </div>
              <div className="text-xs text-gray-500 mt-0.5 truncate">
                {c.email ?? c.phone ?? 'No contact info'}
              </div>
              <div className="text-xs text-gray-600 font-mono mt-0.5 truncate">
                ID: {c.unifiedIndividualId}
              </div>
            </div>

            {c.confidence !== undefined && (
              <ConfidenceBadge score={c.confidence} />
            )}

            <ChevronRight className="w-4 h-4 text-gray-600 shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}

function ConfidenceBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color =
    pct >= 80
      ? 'text-green-400 bg-green-900/30 border-green-800'
      : pct >= 50
      ? 'text-yellow-400 bg-yellow-900/30 border-yellow-800'
      : 'text-red-400 bg-red-900/30 border-red-800';

  return (
    <span className={`text-xs px-2 py-1 rounded-full border font-medium shrink-0 ${color}`}>
      {pct}%
    </span>
  );
}
