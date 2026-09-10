'use client';

import type { EmailJob } from '@/lib/types';
import { CheckCircle, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';

function StatusBadge({ status }: { status: EmailJob['status'] }) {
  const config = {
    sent: { label: 'Sent', bg: 'rgba(16,185,129,0.15)', color: 'var(--success)' },
    failed: { label: 'Failed', bg: 'rgba(239,68,68,0.15)', color: 'var(--danger)' },
    pending: { label: 'Pending', bg: 'rgba(99,102,241,0.15)', color: 'var(--accent-light)' },
    rate_limited: { label: 'Rate Limited', bg: 'rgba(139,92,246,0.15)', color: '#a78bfa' },
    cancelled: { label: 'Cancelled', bg: 'rgba(100,116,139,0.15)', color: 'var(--text-muted)' },
  } as Record<string, { label: string; bg: string; color: string }>;
  const c = config[status] ?? config.sent;
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
      {[1, 2, 3, 4, 5, 6].map((i) => (
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
        style={{ background: 'rgba(16,185,129,0.1)' }}
      >
        <CheckCircle className="w-7 h-7" style={{ color: 'var(--success)' }} />
      </div>
      <h3 className="text-base font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
        No sent emails yet
      </h3>
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        Emails will appear here after they have been sent.
      </p>
    </div>
  );
}

interface SentEmailsTableProps {
  jobs: EmailJob[];
  loading: boolean;
}

export function SentEmailsTable({ jobs, loading }: SentEmailsTableProps) {
  if (!loading && jobs.length === 0) return <EmptyState />;

  return (
    <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid var(--border)' }}>
      <table className="w-full">
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(16,185,129,0.04)' }}>
            {['Recipient', 'Subject', 'Sender', 'Sent At', 'Status', 'Preview'].map((h) => (
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
                    <p className="text-sm max-w-[180px] truncate" style={{ color: 'var(--text-secondary)' }}>
                      {job.campaignSubject}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{job.senderEmail}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {job.sentAt ? format(new Date(job.sentAt), 'MMM d, h:mm a') : '—'}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={job.status} />
                    {job.errorMessage && (
                      <p className="text-xs mt-1 truncate max-w-[120px]" style={{ color: 'var(--danger)' }} title={job.errorMessage}>
                        {job.errorMessage}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {job.previewUrl ? (
                      <a
                        href={job.previewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-all hover:scale-105"
                        style={{
                          color: 'var(--accent-light)',
                          background: 'rgba(99,102,241,0.1)',
                          border: '1px solid rgba(99,102,241,0.2)',
                        }}
                      >
                        <ExternalLink className="w-3 h-3" />
                        Preview
                      </a>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }} className="text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}
