'use client';

import type { EmailJob } from '@/lib/types';
import { Clock, ExternalLink, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

function StatusBadge({ status }: { status: EmailJob['status'] }) {
  const config: Record<string, { label: string; bg: string; color: string }> = {
    pending: { label: 'Pending', bg: 'rgba(99,102,241,0.15)', color: 'var(--accent-light)' },
    rate_limited: { label: 'Rate Limited', bg: 'rgba(139,92,246,0.15)', color: '#a78bfa' },
    sent: { label: 'Sent', bg: 'rgba(16,185,129,0.15)', color: 'var(--success)' },
    failed: { label: 'Failed', bg: 'rgba(239,68,68,0.15)', color: 'var(--danger)' },
    cancelled: { label: 'Cancelled', bg: 'rgba(100,116,139,0.15)', color: 'var(--text-muted)' },
  };
  const c = config[status] ?? config.pending;
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
      style={{ background: c.bg, color: c.color }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.color }} />
      {c.label}
    </span>
  );
}

function SkeletonRow() {
  return (
    <tr>
      {[1, 2, 3, 4, 5].map((i) => (
        <td key={i} className="px-4 py-3">
          <div className="skeleton h-4 w-full" style={{ maxWidth: i === 1 ? '160px' : '120px' }} />
        </td>
      ))}
    </tr>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-16">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
        style={{ background: 'rgba(99,102,241,0.1)' }}
      >
        <Clock className="w-7 h-7" style={{ color: 'var(--accent-light)' }} />
      </div>
      <h3 className="text-base font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
        No scheduled emails
      </h3>
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        Click &ldquo;Compose Email&rdquo; to schedule your first campaign.
      </p>
    </div>
  );
}

interface ScheduledEmailsTableProps {
  jobs: EmailJob[];
  loading: boolean;
}

export function ScheduledEmailsTable({ jobs, loading }: ScheduledEmailsTableProps) {
  if (!loading && jobs.length === 0) return <EmptyState />;

  return (
    <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid var(--border)' }}>
      <table className="w-full">
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(99,102,241,0.04)' }}>
            {['Recipient', 'Subject', 'Sender', 'Scheduled At', 'Status'].map((h) => (
              <th
                key={h}
                className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'var(--text-muted)' }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
            : jobs.map((job, idx) => (
                <tr
                  key={job.id}
                  className="transition-colors hover:bg-white/[0.02]"
                  style={{ borderBottom: idx < jobs.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}
                >
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {job.recipientEmail}
                      </p>
                      {job.recipientName && (
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{job.recipientName}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm max-w-[200px] truncate" style={{ color: 'var(--text-secondary)' }}>
                      {job.campaignSubject}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{job.senderEmail}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {format(new Date(job.scheduledAt), 'MMM d, h:mm a')}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={job.status} />
                  </td>
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}
