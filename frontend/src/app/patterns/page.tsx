'use client';

import PatternLibrary from '@/components/PatternLibrary/PatternLibrary';
import { Library } from 'lucide-react';

export default function PatternsPage() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Library className="w-6 h-6 text-indigo-400" />
          <h1 className="text-2xl font-bold text-gray-100">Pattern Library</h1>
        </div>
        <p className="text-gray-500 text-sm">
          Reusable DMO linkage patterns discovered across all client orgs. These are firm-wide
          learnings applicable beyond the specific org they were found in.
        </p>
      </div>

      <PatternLibrary showApplyButton={false} />
    </div>
  );
}
