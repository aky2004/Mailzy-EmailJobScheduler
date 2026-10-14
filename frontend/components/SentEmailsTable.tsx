'use client';

import type { EmailJob } from '@/lib/types';
import { ExternalLink, Paperclip, Star, Trash2, Send, Edit3 } from 'lucide-react';
import { format } from 'date-fns';
import { StatusBadge } from './ScheduledEmailsTable';
import { RichEmptyState } from './RichEmptyState';

function SkeletonRow() {
  return (
    <tr className="border-b border-[#3E3F3E]/40">
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
        icon={<Send className="w-9 h-9 text-[#54C750]" />}
        badge="Outbox Ready"
        title="No Dispatched Emails Yet"
        description="Once your scheduled campaigns execute, all delivered and dispatched emails will appear here with live timestamps, status checks, and delivery records."
        actionText="Schedule First Email"
        actionIcon={<Edit3 className="w-4 h-4" />}
        onAction={onCompose}
        features={[
          {
            icon: '📬',
            title: 'Direct Inbox Delivery',
            desc: 'Real outbound SMTP delivery directly into your recipients\' inboxes.',
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
          <tr className="border-b border-[#3E3F3E] bg-[#171717]">
            {['Recipient', 'Subject', 'Sender', 'Sent At', 'Status', 'Preview', ''].map((h, idx) => (
              <th key={idx} className={`px-5 py-3 text-xs font-semibold text-[#5B5B5B] uppercase tracking-wider whitespace-nowrap ${idx === 6 ? 'text-right' : 'text-left'}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#3E3F3E]/40">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
            : jobs.map(job => (
                <tr key={job.id} className="hover:bg-[#262626]/70 transition-colors group">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-[#54C750]/15 text-[#54C750] border border-[#54C750]/30 flex items-center justify-center font-bold text-xs flex-shrink-0">
                        {job.recipientEmail.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-[#F0F2F0] truncate max-w-[160px]">{job.recipientEmail}</p>
                        {job.recipientName && <p className="text-xs text-[#A8ACA8]">{job.recipientName}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[#F0F2F0] truncate max-w-[200px]">{job.campaignSubject}</span>
                      {job.hasAttachments && <Paperclip className="w-3 h-3 text-[#5B5B5B] flex-shrink-0" />}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-[#A8ACA8] whitespace-nowrap">
                    {job.senderEmail ?? '—'}
                  </td>
                  <td className="px-5 py-3.5 text-[#A8ACA8] whitespace-nowrap">
                    {job.sentAt ? format(new Date(job.sentAt), 'MMM d, h:mm a') : '—'}
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={job.status} />
                    {job.errorMessage && (
                      <p className="text-xs text-red-400 mt-0.5 truncate max-w-[140px]" title={job.errorMessage}>
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
                        className="inline-flex items-center gap-1 text-xs text-[#54C750] hover:text-[#46af42] font-semibold hover:underline"
                      >
                        <ExternalLink className="w-3 h-3" /> View
                      </a>
                    ) : (
                      <span className="text-[#5B5B5B] text-xs">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {onStar && (
                        <button
                          type="button"
                          onClick={() => onStar(job.id, !!job.isStarred)}
                          title={job.isStarred ? 'Unstar' : 'Star'}
                          className="p-1.5 hover:bg-[#3E3F3E] rounded-lg text-[#5B5B5B] hover:text-yellow-400 transition-colors cursor-pointer"
                        >
                          <Star className={`w-3.5 h-3.5 ${job.isStarred ? 'fill-yellow-400 text-yellow-400' : 'text-[#5B5B5B]'}`} />
                        </button>
                      )}
                      {onDelete && (
                        <button
                          type="button"
                          onClick={() => onDelete(job.id)}
                          title="Move to Trash"
                          className="p-1.5 hover:bg-red-500/10 rounded-lg text-[#5B5B5B] hover:text-red-400 transition-colors cursor-pointer"
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
