'use client';

import type { EmailJob } from '@/lib/types';
import { CheckCircle, ExternalLink, Paperclip, Star, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { StatusBadge } from './ScheduledEmailsTable';
import { RichEmptyState } from './RichEmptyState';
import { Send, Edit3 } from 'lucide-react';

function SkeletonRow() {
  return (
    <tr className="border-b border-slate-100">
      {[140, 180, 100, 90, 70, 60, 40].map((w, i) => (
        <td key={i} className="px-5 py-4">
          <div className="skeleton h-3.5 rounded" style={{ width: `${w}px` }} />
        </td>
      ))}
    </tr>
  );
}

interface SentEmailsTableProps {
  jobs: EmailJob[];
  loading: boolean;
  onStar?: (id: string, current: boolean) => void;
  onDelete?: (id: string) => void;
  onCompose?: () => void;
}

export function SentEmailsTable({ jobs, loading, onStar, onDelete, onCompose }: SentEmailsTableProps) {
  if (!loading && jobs.length === 0) {
    return (
      <RichEmptyState
        icon={<Send className="w-9 h-9 text-emerald-600" />}
        badge="Outbox Ready"
        title="No Dispatched Emails Yet"
        description="Once your scheduled campaigns execute, all delivered and dispatched emails will appear here with live timestamps, status checks, and Ethereal preview links."
        actionText="Schedule First Email"
        actionIcon={<Edit3 className="w-4 h-4" />}
        onAction={onCompose}
        features={[
          {
            icon: '🔗',
            title: 'Ethereal Previews',
            desc: 'Inspect rendered HTML emails in your browser via test preview links.',
          },
          {
            icon: '🔎',
            title: 'Elasticsearch Indexed',
            desc: 'Instant full-text search across recipients, subjects, and sender addresses.',
          },
          {
            icon: '⭐',
            title: 'Star & Organize',
            desc: 'Bookmark important dispatches for one-click access in your Starred folder.',
          },
        ]}
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200">
            {['Recipient', 'Subject', 'Sender', 'Sent At', 'Status', 'Preview', ''].map((h, idx) => (
              <th key={idx} className={`px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap ${idx === 6 ? 'text-right' : 'text-left'}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
            : jobs.map(job => (
                <tr key={job.id} className="border-b border-slate-100 hover:bg-slate-50/70 transition-colors group">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 font-semibold text-xs flex-shrink-0">
                        {job.recipientEmail.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-slate-800 truncate max-w-[160px]">{job.recipientEmail}</p>
                        {job.recipientName && <p className="text-xs text-slate-400">{job.recipientName}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-700 truncate max-w-[200px]">{job.campaignSubject}</span>
                      {job.hasAttachments && <Paperclip className="w-3 h-3 text-slate-400 flex-shrink-0" />}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap">
                    {job.senderEmail ?? '—'}
                  </td>
                  <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap">
                    {job.sentAt ? format(new Date(job.sentAt), 'MMM d, h:mm a') : '—'}
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={job.status} />
                    {job.errorMessage && (
                      <p className="text-xs text-red-500 mt-0.5 truncate max-w-[140px]" title={job.errorMessage}>
                        {job.errorMessage}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    {job.previewUrl ? (
                      <a
                        href={job.previewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium hover:underline"
                      >
                        <ExternalLink className="w-3 h-3" /> View
                      </a>
                    ) : (
                      <span className="text-slate-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {onStar && (
                        <button
                          type="button"
                          onClick={() => onStar(job.id, !!job.isStarred)}
                          title={job.isStarred ? 'Unstar' : 'Star'}
                          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-yellow-500 transition-colors cursor-pointer"
                        >
                          <Star className={`w-3.5 h-3.5 ${job.isStarred ? 'fill-yellow-400 text-yellow-400' : 'text-slate-300'}`} />
                        </button>
                      )}
                      {onDelete && (
                        <button
                          type="button"
                          onClick={() => onDelete(job.id)}
                          title="Move to Trash"
                          className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}
