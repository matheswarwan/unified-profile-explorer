'use client';

import { use, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { orgsApi, exportApi } from '@/lib/api';
import GraphEditor from '@/components/GraphEditor/GraphEditor';
import { ArrowLeft, Download, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';

interface Props {
  params: Promise<{ orgId: string }>;
}

export default function GraphPage({ params }: Props) {
  const { orgId } = use(params);
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  const { data: org } = useQuery({
    queryKey: ['orgs', orgId],
    queryFn: () => orgsApi.get(orgId),
  });

  const [showExport, setShowExport] = useState(false);

  const handleExport = (format: 'json' | 'markdown') => {
    const url =
      format === 'json'
        ? exportApi.downloadJson(orgId)
        : exportApi.downloadMarkdown(orgId);
    window.open(url, '_blank');
    setShowExport(false);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Sub-header */}
      <div className="flex items-center justify-between px-6 py-3 bg-gray-900 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/orgs"
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-300"
          >
            <ArrowLeft className="w-4 h-4" />
            Orgs
          </Link>
          <span className="text-gray-700">/</span>
          <span className="text-sm text-gray-300 font-medium">
            {org?.display_name ?? 'Loading…'}
          </span>
          {org?.client_name && (
            <span className="text-xs text-gray-600 bg-gray-800 px-2 py-0.5 rounded-full">
              {org.client_name}
            </span>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => setShowExport((s) => !s)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-gray-800 border border-gray-700 text-gray-400 hover:border-gray-600"
          >
            <Download className="w-3.5 h-3.5" />
            Export
            <ChevronDown className="w-3 h-3" />
          </button>

          {showExport && (
            <div className="absolute right-0 top-full mt-1 w-40 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
              <button
                onClick={() => handleExport('json')}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-800"
              >
                Export as JSON
              </button>
              <button
                onClick={() => handleExport('markdown')}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-800"
              >
                Export as Markdown
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Graph fills remaining space */}
      <div className="flex-1 overflow-hidden">
        <GraphEditor orgId={orgId} />
      </div>
    </div>
  );
}
