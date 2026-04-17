'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { orgsApi, lookupApi, IndividualCandidate } from '@/lib/api';
import { Search, ChevronDown } from 'lucide-react';

interface ProfileSearchProps {
  onCandidates: (
    candidates: IndividualCandidate[],
    orgId: string,
    query: { searchType: string; searchValue: string }
  ) => void;
}

type SearchType = 'email' | 'name' | 'phone';

export default function ProfileSearch({ onCandidates }: ProfileSearchProps) {
  const [orgId, setOrgId] = useState('');
  const [searchType, setSearchType] = useState<SearchType>('email');
  const [searchValue, setSearchValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: orgs = [] } = useQuery({
    queryKey: ['orgs'],
    queryFn: orgsApi.list,
  });

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId || !searchValue.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const result = await lookupApi.search(orgId, searchType, searchValue.trim());
      onCandidates(result.candidates, orgId, { searchType, searchValue: searchValue.trim() });
      if (result.candidates.length === 0) {
        setError(result.message ?? 'No individuals found matching your search.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Search failed';
      setError(msg);
      onCandidates([], orgId, { searchType, searchValue: searchValue.trim() });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSearch} className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <h2 className="text-lg font-semibold text-gray-100 mb-4">Individual Lookup</h2>

      <div className="flex gap-3 flex-wrap">
        {/* Org selector */}
        <div className="relative min-w-[200px]">
          <select
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
            required
            className="w-full appearance-none bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 pr-8 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
          >
            <option value="">Select org…</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.display_name}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-3 w-4 h-4 text-gray-500 pointer-events-none" />
        </div>

        {/* Search type */}
        <div className="relative">
          <select
            value={searchType}
            onChange={(e) => setSearchType(e.target.value as SearchType)}
            className="w-full appearance-none bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 pr-8 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
          >
            <option value="email">Email</option>
            <option value="name">Name</option>
            <option value="phone">Phone</option>
          </select>
          <ChevronDown className="absolute right-2 top-3 w-4 h-4 text-gray-500 pointer-events-none" />
        </div>

        {/* Search input */}
        <div className="flex-1 min-w-[200px] relative">
          <input
            type={searchType === 'email' ? 'email' : 'text'}
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder={
              searchType === 'email'
                ? 'user@example.com'
                : searchType === 'name'
                ? 'First Last'
                : '+1 (555) 000-0000'
            }
            required
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 pr-10 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !orgId}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
        >
          <Search className="w-4 h-4" />
          {loading ? 'Searching…' : 'Search'}
        </button>
      </div>

      {error && (
        <p className="mt-3 text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-4 py-2">
          {error}
        </p>
      )}
    </form>
  );
}
