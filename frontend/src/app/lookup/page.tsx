'use client';

import { useState } from 'react';
import ProfileSearch from '@/components/ProfileView/ProfileSearch';
import CandidateList from '@/components/ProfileView/CandidateList';
import ProfileView from '@/components/ProfileView/ProfileView';
import { IndividualCandidate } from '@/lib/api';
import { History } from 'lucide-react';

interface SearchRecord {
  orgId: string;
  searchType: string;
  searchValue: string;
  timestamp: Date;
}

export default function LookupPage() {
  const [candidates, setCandidates] = useState<IndividualCandidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<IndividualCandidate | null>(null);
  const [currentOrgId, setCurrentOrgId] = useState('');
  const [history, setHistory] = useState<SearchRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const handleCandidates = (
    results: IndividualCandidate[],
    orgId: string,
    query: { searchType: string; searchValue: string }
  ) => {
    setCandidates(results);
    setSelectedCandidate(null);
    setCurrentOrgId(orgId);
    // Store in history (last 20)
    setHistory((prev) =>
      [{ ...query, orgId, timestamp: new Date() }, ...prev].slice(0, 20)
    );
  };

  const handleSelectCandidate = (candidate: IndividualCandidate) => {
    setSelectedCandidate(candidate);
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Individual Lookup</h1>
          <p className="text-gray-500 text-sm mt-1">
            Search for a unified individual across any registered Data Cloud org.
          </p>
        </div>
        <button
          onClick={() => setShowHistory((s) => !s)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-800 border border-gray-700 transition-colors"
        >
          <History className="w-4 h-4" />
          History ({history.length})
        </button>
      </div>

      {showHistory && history.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Recent Searches</h3>
          <div className="space-y-1">
            {history.map((h, i) => (
              <div key={i} className="flex items-center gap-3 text-sm text-gray-500 py-1">
                <span className="text-xs bg-gray-800 px-2 py-0.5 rounded">{h.searchType}</span>
                <span className="text-gray-300">{h.searchValue}</span>
                <span className="text-xs text-gray-600 ml-auto">
                  {h.timestamp.toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <ProfileSearch onCandidates={handleCandidates} />

      {candidates.length > 0 && (
        <div className={`grid gap-6 ${selectedCandidate ? 'grid-cols-[340px_1fr]' : 'grid-cols-1'}`}>
          <CandidateList
            candidates={candidates}
            onSelect={handleSelectCandidate}
            selectedId={selectedCandidate?.id}
          />
          {selectedCandidate && (
            <ProfileView candidate={selectedCandidate} orgId={currentOrgId} />
          )}
        </div>
      )}
    </div>
  );
}
