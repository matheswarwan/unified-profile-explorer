'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { orgsApi, OrgPublic } from '@/lib/api';
import { showToast } from '@/app/layout';
import { CheckCircle2, XCircle, Clock, Trash2, Pencil, Zap, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface OrgListProps {
  onEdit: (org: OrgPublic) => void;
}

export default function OrgList({ onEdit }: OrgListProps) {
  const qc = useQueryClient();
  const [testingId, setTestingId] = useState<string | null>(null);

  const { data: orgs = [], isLoading } = useQuery({
    queryKey: ['orgs'],
    queryFn: orgsApi.list,
  });

  const deleteMut = useMutation({
    mutationFn: orgsApi.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orgs'] });
      showToast('Org deleted', 'success');
    },
    onError: () => showToast('Delete failed', 'error'),
  });

  const handleTest = async (id: string) => {
    setTestingId(id);
    try {
      const res = await orgsApi.testConnection(id);
      showToast(res.message, res.success ? 'success' : 'error');
      qc.invalidateQueries({ queryKey: ['orgs'] });
    } catch {
      showToast('Connection test failed', 'error');
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = (org: OrgPublic) => {
    if (confirm(`Delete "${org.display_name}"? This cannot be undone.`)) {
      deleteMut.mutate(org.id);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-gray-800 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (orgs.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500">
        <p className="text-lg font-medium">No orgs registered yet</p>
        <p className="text-sm mt-1">Register your first Data Cloud org to get started.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {orgs.map((org) => (
        <div
          key={org.id}
          className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-4"
        >
          <StatusBadge status={org.last_tested_status} />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-100 truncate">{org.display_name}</span>
              <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
                {org.client_name}
              </span>
            </div>
            <div className="text-xs text-gray-500 mt-0.5 truncate">{org.instance_url}</div>
            {org.last_tested_at && (
              <div className="text-xs text-gray-600 mt-0.5">
                Last tested: {new Date(org.last_tested_at).toLocaleString()}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={`/graph/${org.id}`}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-indigo-400 hover:bg-indigo-500/10 border border-indigo-500/20 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Graph
            </Link>

            <button
              onClick={() => handleTest(org.id)}
              disabled={testingId === org.id}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:bg-gray-800 border border-gray-700 transition-colors disabled:opacity-50"
            >
              <Zap className="w-3.5 h-3.5" />
              {testingId === org.id ? 'Testing…' : 'Test'}
            </button>

            <button
              onClick={() => onEdit(org)}
              className="p-1.5 rounded-lg text-gray-500 hover:text-gray-200 hover:bg-gray-800 transition-colors"
            >
              <Pencil className="w-4 h-4" />
            </button>

            <button
              onClick={() => handleDelete(org)}
              className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-gray-800 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: OrgPublic['last_tested_status'] }) {
  if (status === 'success') {
    return <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />;
  }
  if (status === 'failed') {
    return <XCircle className="w-5 h-5 text-red-400 shrink-0" />;
  }
  return <Clock className="w-5 h-5 text-gray-500 shrink-0" />;
}
