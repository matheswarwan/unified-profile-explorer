'use client';

import { useState } from 'react';
import { lookupApi, IndividualCandidate, DmoProfileResult } from '@/lib/api';
import ProfileCard from './ProfileCard';
import { Loader2, User2, Copy, Check } from 'lucide-react';

interface ProfileViewProps {
  candidate: IndividualCandidate;
  orgId: string;
}

export default function ProfileView({ candidate, orgId }: ProfileViewProps) {
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<DmoProfileResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const loadProfile = async () => {
    if (loaded) return;
    setLoading(true);
    setError(null);
    try {
      const res = await lookupApi.profile(orgId, candidate.unifiedIndividualId);
      setProfile(res.profile);
      setLoaded(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load profile';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const copyId = async () => {
    await navigator.clipboard.writeText(candidate.unifiedIndividualId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Auto-load on first render
  if (!loaded && !loading && !error) {
    loadProfile();
  }

  const identity = profile?.filter((d) => d.dmoName.toLowerCase().includes('individual')) ?? [];
  const rest = profile?.filter((d) => !d.dmoName.toLowerCase().includes('individual')) ?? [];
  const ordered = [...identity, ...rest];

  return (
    <div className="space-y-4">
      {/* Individual header */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
          <User2 className="w-7 h-7 text-indigo-400" />
        </div>
        <div className="flex-1">
          <div className="text-lg font-semibold text-gray-100">
            {candidate.firstName || candidate.lastName
              ? `${candidate.firstName ?? ''} ${candidate.lastName ?? ''}`.trim()
              : 'Unknown Name'}
          </div>
          <div className="text-sm text-gray-400">{candidate.email ?? candidate.phone}</div>
          <div className="flex items-center gap-2 mt-1">
            <code className="text-xs text-gray-500 font-mono truncate max-w-[300px]">
              {candidate.unifiedIndividualId}
            </code>
            <button onClick={copyId} className="text-gray-600 hover:text-gray-300 transition-colors">
              {copied ? (
                <Check className="w-3.5 h-3.5 text-green-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {profile !== null && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">
              {profile.length} DMO{profile.length !== 1 ? 's' : ''} loaded
            </span>
            <span className="text-xs text-gray-600">
              {profile.filter((d) => d.source === 'team-defined').length} team-defined linkage
              {profile.filter((d) => d.source === 'team-defined').length !== 1 ? 's' : ''}
            </span>
          </div>

          {ordered.map((dmo) => (
            <ProfileCard key={dmo.dmoName} dmo={dmo} defaultOpen={dmo.records.length > 0} />
          ))}
        </div>
      )}

      {loaded && profile?.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p>No DMO data found for this individual.</p>
          <p className="text-sm mt-1">The org may have no reachable DMOs linked to this Unified Individual ID.</p>
        </div>
      )}
    </div>
  );
}
