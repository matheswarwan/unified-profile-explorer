'use client';

import { useState } from 'react';
import { annotationsApi, CreateAnnotationPayload, Annotation, AnnotationType, AnnotationStatus, SeverityLevel } from '@/lib/api';
import { showToast } from '@/app/layout';
import { X, MessageSquare, Plus, Trash2 } from 'lucide-react';

interface AnnotationFormProps {
  orgId: string;
  annotation?: Annotation;
  prefilledSource?: string;
  prefilledTarget?: string;
  onSaved: (annotation: Annotation) => void;
  onClose: () => void;
}

export default function AnnotationForm({
  orgId,
  annotation,
  prefilledSource,
  prefilledTarget,
  onSaved,
  onClose,
}: AnnotationFormProps) {
  const [form, setForm] = useState<CreateAnnotationPayload>({
    org_id: orgId,
    annotation_type: annotation?.annotation_type ?? 'edge',
    source_dmo: annotation?.source_dmo ?? prefilledSource ?? '',
    target_dmo: annotation?.target_dmo ?? prefilledTarget ?? '',
    source_field: annotation?.source_field ?? '',
    target_field: annotation?.target_field ?? '',
    join_type: annotation?.join_type ?? 'inner',
    rationale: annotation?.rationale ?? '',
    status: annotation?.status ?? 'proposed',
    is_reusable_pattern: annotation?.is_reusable_pattern ?? false,
    pattern_description: annotation?.pattern_description ?? '',
    severity: annotation?.severity ?? undefined,
  });
  const [comments, setComments] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [commentLoading, setCommentLoading] = useState(false);

  const set = <K extends keyof CreateAnnotationPayload>(key: K, val: CreateAnnotationPayload[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      let saved: Annotation;
      if (annotation) {
        saved = await annotationsApi.update(annotation.id, form);
        showToast('Annotation updated', 'success');
      } else {
        saved = await annotationsApi.create(form);
        showToast('Annotation saved', 'success');
      }
      onSaved(saved);
    } catch {
      showToast('Save failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!annotation || !comments.trim()) return;
    setCommentLoading(true);
    try {
      await annotationsApi.addComment(annotation.id, comments.trim());
      setComments('');
      showToast('Comment added', 'success');
    } catch {
      showToast('Failed to add comment', 'error');
    } finally {
      setCommentLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/40">
      <div className="h-full w-full max-w-lg bg-gray-900 border-l border-gray-800 shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
          <h2 className="text-lg font-semibold text-gray-100">
            {annotation ? 'Edit Annotation' : 'New Annotation'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Type */}
          <div>
            <label className="label">Type</label>
            <div className="grid grid-cols-2 gap-2">
              {(['edge', 'node_note', 'gap_flag', 'pattern'] as AnnotationType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => set('annotation_type', t)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                    form.annotation_type === t
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  {t.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* DMO fields (for edge type) */}
          {form.annotation_type === 'edge' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Field
                  label="Source DMO"
                  value={form.source_dmo ?? ''}
                  onChange={(v) => set('source_dmo', v)}
                  placeholder="ssot__Individual__dlm"
                  required
                />
                <Field
                  label="Target DMO"
                  value={form.target_dmo ?? ''}
                  onChange={(v) => set('target_dmo', v)}
                  placeholder="Custom__dlm"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field
                  label="Source Field"
                  value={form.source_field ?? ''}
                  onChange={(v) => set('source_field', v)}
                  placeholder="ssot__Id__c"
                />
                <Field
                  label="Target Field"
                  value={form.target_field ?? ''}
                  onChange={(v) => set('target_field', v)}
                  placeholder="IndividualId__c"
                />
              </div>
              <div>
                <label className="label">Join Type</label>
                <div className="flex gap-2">
                  {(['inner', 'left'] as const).map((jt) => (
                    <button
                      key={jt}
                      type="button"
                      onClick={() => set('join_type', jt)}
                      className={`px-4 py-2 rounded-lg text-xs font-medium border transition-colors ${
                        form.join_type === jt
                          ? 'bg-indigo-600 border-indigo-500 text-white'
                          : 'bg-gray-800 border-gray-700 text-gray-400'
                      }`}
                    >
                      {jt.toUpperCase()} JOIN
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Node / gap flag fields */}
          {(form.annotation_type === 'node_note' || form.annotation_type === 'gap_flag') && (
            <Field
              label="DMO"
              value={form.source_dmo ?? ''}
              onChange={(v) => set('source_dmo', v)}
              placeholder="DMO API name"
              required
            />
          )}

          {form.annotation_type === 'gap_flag' && (
            <div>
              <label className="label">Severity</label>
              <div className="flex gap-2">
                {(['info', 'warning', 'blocker'] as SeverityLevel[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => set('severity', s)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      form.severity === s
                        ? s === 'blocker'
                          ? 'bg-red-700 border-red-600 text-white'
                          : s === 'warning'
                          ? 'bg-yellow-700 border-yellow-600 text-white'
                          : 'bg-blue-700 border-blue-600 text-white'
                        : 'bg-gray-800 border-gray-700 text-gray-400'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Rationale */}
          <div>
            <label className="label">Rationale</label>
            <textarea
              value={form.rationale ?? ''}
              onChange={(e) => set('rationale', e.target.value)}
              rows={3}
              className="input resize-none"
              placeholder="Why is this linkage proposed? What does it enable?"
            />
          </div>

          {/* Status */}
          <div>
            <label className="label">Status</label>
            <div className="flex gap-2">
              {(['proposed', 'validated', 'deprecated'] as AnnotationStatus[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => set('status', s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    form.status === s
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-gray-800 border-gray-700 text-gray-400'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Reusable pattern */}
          <div className="flex items-center gap-3 bg-gray-800 rounded-lg px-4 py-3">
            <input
              type="checkbox"
              id="reusable"
              checked={form.is_reusable_pattern ?? false}
              onChange={(e) => set('is_reusable_pattern', e.target.checked)}
              className="w-4 h-4 rounded accent-indigo-500"
            />
            <label htmlFor="reusable" className="text-sm text-gray-300 cursor-pointer">
              Mark as reusable pattern (visible firm-wide)
            </label>
          </div>

          {form.is_reusable_pattern && (
            <div>
              <label className="label">Pattern Description</label>
              <textarea
                value={form.pattern_description ?? ''}
                onChange={(e) => set('pattern_description', e.target.value)}
                rows={2}
                className="input resize-none"
                placeholder="Describe when/how this pattern applies to other orgs..."
              />
            </div>
          )}

          {/* Comment thread (edit mode only) */}
          {annotation && (
            <div className="border-t border-gray-800 pt-4">
              <label className="label flex items-center gap-1">
                <MessageSquare className="w-3.5 h-3.5" />
                Add Comment
              </label>
              <div className="flex gap-2">
                <textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  rows={2}
                  className="input resize-none flex-1"
                  placeholder="Leave a comment..."
                />
                <button
                  type="button"
                  onClick={handleAddComment}
                  disabled={commentLoading || !comments.trim()}
                  className="px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm disabled:opacity-50 self-end"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-gray-700 text-gray-300 text-sm hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium disabled:opacity-50"
            >
              {loading ? 'Saving…' : annotation ? 'Update' : 'Save Annotation'}
            </button>
          </div>
        </form>
      </div>

      <style jsx>{`
        .label {
          display: block;
          font-size: 0.75rem;
          font-weight: 500;
          color: #9ca3af;
          margin-bottom: 0.25rem;
        }
        .input {
          width: 100%;
          background: #1f2937;
          border: 1px solid #374151;
          border-radius: 0.5rem;
          padding: 0.5rem 0.75rem;
          color: #f3f4f6;
          font-size: 0.875rem;
          outline: none;
        }
        .input:focus {
          border-color: #6366f1;
        }
      `}</style>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 text-sm focus:outline-none focus:border-indigo-500"
      />
    </div>
  );
}
