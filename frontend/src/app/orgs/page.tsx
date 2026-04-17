'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import OrgList from '@/components/OrgManager/OrgList';
import OrgForm from '@/components/OrgManager/OrgForm';
import { OrgPublic } from '@/lib/api';
import { Plus } from 'lucide-react';

export default function OrgsPage() {
  const [showForm, setShowForm] = useState(false);
  const [editOrg, setEditOrg] = useState<OrgPublic | undefined>();
  const qc = useQueryClient();

  const handleEdit = (org: OrgPublic) => {
    setEditOrg(org);
    setShowForm(true);
  };

  const handleNew = () => {
    setEditOrg(undefined);
    setShowForm(true);
  };

  const handleSaved = () => {
    qc.invalidateQueries({ queryKey: ['orgs'] });
    setShowForm(false);
    setEditOrg(undefined);
  };

  const handleClose = () => {
    setShowForm(false);
    setEditOrg(undefined);
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Data Cloud Orgs</h1>
          <p className="text-gray-500 text-sm mt-1">
            Register and manage your Salesforce Data Cloud org connections.
          </p>
        </div>
        <button
          onClick={handleNew}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Register Org
        </button>
      </div>

      <OrgList onEdit={handleEdit} />

      {showForm && (
        <OrgForm org={editOrg} onSaved={handleSaved} onClose={handleClose} />
      )}
    </div>
  );
}
