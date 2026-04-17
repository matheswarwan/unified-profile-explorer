'use client';

import { useState } from 'react';
import { orgsApi, OrgPublic, CreateOrgPayload } from '@/lib/api';
import { showToast } from '@/app/layout';
import { X, Eye, EyeOff } from 'lucide-react';

interface OrgFormProps {
  org?: OrgPublic;
  onSaved: (org: OrgPublic) => void;
  onClose: () => void;
}

export default function OrgForm({ org, onSaved, onClose }: OrgFormProps) {
  const [form, setForm] = useState({
    display_name: org?.display_name ?? '',
    client_name: org?.client_name ?? '',
    instance_url: org?.instance_url ?? '',
    tenant_id: org?.tenant_id ?? '',
    client_id: '',
    client_secret: '',
    notes: org?.notes ?? '',
  });
  const [showSecret, setShowSecret] = useState(false);
  const [loading, setLoading] = useState(false);

  const set = (key: string, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      let saved: OrgPublic;
      if (org) {
        const payload: Partial<CreateOrgPayload> = { ...form };
        if (!payload.client_id) delete payload.client_id;
        if (!payload.client_secret) delete payload.client_secret;
        saved = await orgsApi.update(org.id, payload);
        showToast('Org updated', 'success');
      } else {
        saved = await orgsApi.create(form as CreateOrgPayload);
        showToast('Org registered', 'success');
      }
      onSaved(saved);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-gray-100">
            {org ? 'Edit Org' : 'Register New Org'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Display Name"
              value={form.display_name}
              onChange={(v) => set('display_name', v)}
              placeholder="HealthEquity PROD"
              required
            />
            <Field
              label="Client Name"
              value={form.client_name}
              onChange={(v) => set('client_name', v)}
              placeholder="HealthEquity"
              required
            />
          </div>

          <Field
            label="Instance URL"
            value={form.instance_url}
            onChange={(v) => set('instance_url', v)}
            placeholder="https://your-org.my.salesforce.com"
            required
          />

          <Field
            label="Tenant ID"
            value={form.tenant_id}
            onChange={(v) => set('tenant_id', v)}
            placeholder="Data Cloud tenant ID"
            required
          />

          <Field
            label={org ? 'Client ID (leave blank to keep existing)' : 'Client ID'}
            value={form.client_id}
            onChange={(v) => set('client_id', v)}
            placeholder="Connected App Client ID"
            required={!org}
          />

          <div className="relative">
            <Field
              label={org ? 'Client Secret (leave blank to keep existing)' : 'Client Secret'}
              value={form.client_secret}
              onChange={(v) => set('client_secret', v)}
              placeholder="Connected App Client Secret"
              required={!org}
              type={showSecret ? 'text' : 'password'}
            />
            <button
              type="button"
              onClick={() => setShowSecret((s) => !s)}
              className="absolute right-3 top-8 text-gray-500 hover:text-gray-300"
            >
              {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              rows={3}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 text-sm focus:outline-none focus:border-indigo-500 resize-none"
              placeholder="Optional notes about this org..."
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-gray-700 text-gray-300 text-sm hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              {loading ? 'Saving…' : org ? 'Update Org' : 'Register Org'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-400 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 text-sm focus:outline-none focus:border-indigo-500"
      />
    </div>
  );
}
