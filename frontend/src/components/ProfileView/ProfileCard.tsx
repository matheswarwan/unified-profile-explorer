'use client';

import { useState } from 'react';
import { DmoProfileResult } from '@/lib/api';
import { ChevronDown, ChevronRight, Code2, AlertTriangle } from 'lucide-react';

interface ProfileCardProps {
  dmo: DmoProfileResult;
  defaultOpen?: boolean;
}

export default function ProfileCard({ dmo, defaultOpen = true }: ProfileCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [showRaw, setShowRaw] = useState(false);

  const hasData = dmo.records.length > 0;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-5 py-3.5 cursor-pointer hover:bg-gray-800/50 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? (
          <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-100 text-sm truncate">{dmo.displayName}</span>
            {dmo.source === 'team-defined' && (
              <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-900/30 border border-amber-700 text-amber-400 shrink-0">
                <AlertTriangle className="w-3 h-3" />
                Team-defined
              </span>
            )}
          </div>
          <div className="text-xs text-gray-600 font-mono mt-0.5">{dmo.dmoName}</div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {dmo.error && (
            <span className="text-xs text-red-400 bg-red-900/20 px-2 py-0.5 rounded">Error</span>
          )}
          <span className="text-xs text-gray-500">
            {hasData ? `${dmo.records.length} record${dmo.records.length !== 1 ? 's' : ''}` : 'No records'}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowRaw((r) => !r);
            }}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 bg-gray-800 hover:bg-gray-700 px-2 py-1 rounded transition-colors"
          >
            <Code2 className="w-3.5 h-3.5" />
            {showRaw ? 'Hide JSON' : 'Raw JSON'}
          </button>
        </div>
      </div>

      {/* Body */}
      {open && (
        <div className="border-t border-gray-800">
          {dmo.error && (
            <div className="px-5 py-3 text-sm text-red-400 bg-red-900/10">
              Query error: {dmo.error}
            </div>
          )}

          {showRaw ? (
            <pre className="px-5 py-4 text-xs text-gray-300 overflow-x-auto bg-gray-950">
              {JSON.stringify({ fields: dmo.fields, records: dmo.records }, null, 2)}
            </pre>
          ) : hasData ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-950/50">
                    <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Field
                    </th>
                    <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Type
                    </th>
                    {dmo.records.map((_, i) => (
                      <th
                        key={i}
                        className="px-5 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide"
                      >
                        Record {i + 1}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {dmo.fields.map((field) => (
                    <tr key={field.name} className="hover:bg-gray-800/30">
                      <td className="px-5 py-2.5 text-gray-300 font-mono text-xs whitespace-nowrap">
                        {field.label || field.name}
                      </td>
                      <td className="px-5 py-2.5 text-gray-600 text-xs whitespace-nowrap">
                        {field.type}
                      </td>
                      {dmo.records.map((record, i) => {
                        const val = record[field.name];
                        const isNull = val === null || val === undefined;
                        return (
                          <td key={i} className="px-5 py-2.5 text-xs">
                            {isNull ? (
                              <span className="text-gray-700 italic">null</span>
                            ) : (
                              <span className="text-gray-200">{String(val)}</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-5 py-6 text-center text-gray-600 text-sm">
              No records linked to this individual
            </div>
          )}
        </div>
      )}
    </div>
  );
}
