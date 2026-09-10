'use client';

import type { EmailJob } from '@/lib/types';
import { Clock, Paperclip, Star, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { RichEmptyState } from './RichEmptyState';
import { Edit3 } from 'lucide-react';

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    pending:      { label: 'Pending',      className: 'bg-blue-50 text-blue-700 border-blue-100' },
    rate_limited: { label: 'Rate Limited', className: 'bg-purple-50 text-purple-700 border-purple-100' },
    sent:         { label: 'Sent',         className: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
    failed:       { label: 'Failed',       className: 'bg-red-50 text-red-700 border-red-100' },
    cancelled:    { label: 'Cancelled',    className: 'bg-slate-50 text-slate-500 border-slate-100' },
  };
  const s = map[status] ?? map.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${s.className}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      {s.label}
    </span>
  );
}

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr className="border-b border-slate-100">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-5 py-4">
          <div className="skeleton h-3.5 rounded" style={{ width: i === 0 ? '140px' : i === 1 ? '180px' : '80px' }} />
        </td>
      ))}
    </tr>
  );
}

interface ScheduledEmailsTableProps {
  jobs: EmailJob[];
  loading: boolean;
  onStar?: (id: string, current: boolean) => void;
  onDelete?: (id: string) => void;
  onCompose?: () => void;
}

export function ScheduledEmailsTable({ jobs, loading, onStar, onDelete, onCompose }: ScheduledEmailsTableProps) {
  const cols = 6;

  if (!loading && jobs.length === 0) {
    return (
      <RichEmptyState
        icon={<Clock className="w-9 h-9 text-emerald-600" />}
        badge="Queue Standing By"
        title="No Scheduled Emails in Queue"
        description="Your scheduler queue is currently clear. Schedule an email campaign with custom hourly limits and automatic delay intervals to dispatch emails at the exact time."
        actionText="Compose New Campaign"
        actionIcon={<Edit3 className="w-4 h-4" />}
        onAction={onCompose}
        features={[
          {
            icon: '⚡',
            title: 'BullMQ Delayed Jobs',
            desc: 'Accurate millisecond-level scheduling without OS cron dependencies.',
          },
          {
            icon: '🔄',
            title: 'Restart Resilient',
            desc: 'Future emails survive server restarts with zero dropped or duplicate sends.',
          },
          {
            icon: '🛡️',
            title: 'Rate Limit Protected',
            desc: 'Automatic throttling keeps your sender reputation clean and safe.',
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
            {['Recipient', 'Subject', 'Sender', 'Scheduled At', 'Status', ''].map((h, idx) => (
              <th key={idx} className={`px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap ${idx === 5 ? 'text-right' : 'text-left'}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} cols={cols} />)
            : jobs.map(job => (
                <tr key={job.id} className="border-b border-slate-100 hover:bg-slate-50/70 transition-colors group">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-semibold text-xs flex-shrink-0">
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
                    {format(new Date(job.scheduledAt), 'MMM d, h:mm a')}
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={job.status} />
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
