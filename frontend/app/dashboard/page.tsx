'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Mail, Clock, CheckCircle, Users, RefreshCw, Layers } from 'lucide-react';
import { jobsApi, sendersApi } from '@/lib/api';
import type { EmailJob, Sender, QueueStats } from '@/lib/types';
import { ScheduledEmailsTable } from '@/components/ScheduledEmailsTable';
import { SentEmailsTable } from '@/components/SentEmailsTable';
import { ComposeModal } from '@/components/ComposeModal';
import toast from 'react-hot-toast';

type Tab = 'scheduled' | 'sent';

function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div className="glass rounded-2xl p-5 animate-fadein">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
            {label}
          </p>
          <p className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
        </div>
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: `${color}20` }}
        >
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<Tab>('scheduled');
  const [scheduledJobs, setScheduledJobs] = useState<EmailJob[]>([]);
  const [sentJobs, setSentJobs] = useState<EmailJob[]>([]);
  const [senders, setSenders] = useState<Sender[]>([]);
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
  const [loadingScheduled, setLoadingScheduled] = useState(true);
  const [loadingSent, setLoadingSent] = useState(true);
  const [composeOpen, setComposeOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchData = useCallback(async () => {
    try {
      const [scheduled, sent, stats, sendersData] = await Promise.all([
        jobsApi.scheduled(),
        jobsApi.sent(),
        jobsApi.stats().catch(() => null),
        sendersApi.list(),
      ]);
      setScheduledJobs(scheduled.jobs);
      setSentJobs(sent.jobs);
      setSenders(sendersData.senders);
      if (stats) setQueueStats(stats.queue);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingScheduled(false);
      setLoadingSent(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshKey]);

  // Auto-refresh every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => setRefreshKey((k) => k + 1), 15000);
    return () => clearInterval(interval);
  }, []);

  const handleCampaignCreated = () => {
    setComposeOpen(false);
    toast.success('Campaign scheduled successfully! 🚀');
    setTimeout(() => setRefreshKey((k) => k + 1), 1000);
  };

  const totalScheduled = scheduledJobs.length;
  const totalSent = sentJobs.filter((j) => j.status === 'sent').length;
  const totalFailed = sentJobs.filter((j) => j.status === 'failed').length;
  const successRate = totalSent + totalFailed > 0
    ? Math.round((totalSent / (totalSent + totalFailed)) * 100)
    : 100;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Email Dashboard
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Schedule and track your email campaigns
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            className="p-2.5 rounded-xl transition-all hover:scale-105"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
          </button>
          <button
            id="compose-btn"
            onClick={() => setComposeOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all hover:scale-105 active:scale-95"
            style={{
              background: 'linear-gradient(135deg, var(--accent), #a78bfa)',
              color: 'white',
              boxShadow: '0 4px 16px var(--accent-glow)',
            }}
          >
            <Plus className="w-4 h-4" />
            Compose Email
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={Clock} label="Scheduled" value={totalScheduled} color="var(--accent)" />
        <StatCard icon={CheckCircle} label="Sent" value={totalSent} color="var(--success)" />
        <StatCard icon={Mail} label="Failed" value={totalFailed} color="var(--danger)" />
        <StatCard icon={Layers} label="Success Rate" value={`${successRate}%`} color="#f59e0b" />
      </div>

      {/* Queue Stats Bar */}
      {queueStats && (
        <div
          className="glass rounded-2xl p-4 mb-6 flex items-center gap-6 overflow-x-auto"
        >
          <div className="flex items-center gap-2 text-sm whitespace-nowrap">
            <div className="w-2 h-2 rounded-full" style={{ background: 'var(--warning)' }} />
            <span style={{ color: 'var(--text-muted)' }}>Waiting:</span>
            <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{queueStats.waiting}</span>
          </div>
          <div className="flex items-center gap-2 text-sm whitespace-nowrap">
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--accent)' }} />
            <span style={{ color: 'var(--text-muted)' }}>Active:</span>
            <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{queueStats.active}</span>
          </div>
          <div className="flex items-center gap-2 text-sm whitespace-nowrap">
            <div className="w-2 h-2 rounded-full" style={{ background: '#8b5cf6' }} />
            <span style={{ color: 'var(--text-muted)' }}>Delayed:</span>
            <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{queueStats.delayed}</span>
          </div>
          <div className="flex items-center gap-2 text-sm whitespace-nowrap">
            <div className="w-2 h-2 rounded-full" style={{ background: 'var(--success)' }} />
            <span style={{ color: 'var(--text-muted)' }}>Completed:</span>
            <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{queueStats.completed}</span>
          </div>
          <div className="flex items-center gap-2 text-sm whitespace-nowrap">
            <div className="w-2 h-2 rounded-full" style={{ background: 'var(--danger)' }} />
            <span style={{ color: 'var(--text-muted)' }}>Failed:</span>
            <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{queueStats.failed}</span>
          </div>
          <div className="ml-auto flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
            <RefreshCw className="w-3 h-3" />
            Auto-refreshes every 15s
          </div>
        </div>
      )}

      {/* Tabs */}
      <div
        className="glass rounded-2xl overflow-hidden"
      >
        <div
          className="flex border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          {(['scheduled', 'sent'] as Tab[]).map((tab) => (
            <button
              key={tab}
              id={`tab-${tab}`}
              onClick={() => setActiveTab(tab)}
              className="flex items-center gap-2 px-6 py-4 text-sm font-medium transition-all relative"
              style={{
                color: activeTab === tab ? 'var(--accent-light)' : 'var(--text-secondary)',
                background: activeTab === tab ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
              }}
            >
              {tab === 'scheduled' ? <Clock className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
              {tab.charAt(0).toUpperCase() + tab.slice(1)} Emails
              {activeTab === tab && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-0.5"
                  style={{ background: 'linear-gradient(90deg, transparent, var(--accent), transparent)' }}
                />
              )}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === 'scheduled' && (
            <ScheduledEmailsTable jobs={scheduledJobs} loading={loadingScheduled} />
          )}
          {activeTab === 'sent' && (
            <SentEmailsTable jobs={sentJobs} loading={loadingSent} />
          )}
        </div>
      </div>

      {/* Compose Modal */}
      {composeOpen && (
        <ComposeModal
          senders={senders}
          onClose={() => setComposeOpen(false)}
          onSuccess={handleCampaignCreated}
        />
      )}
    </div>
  );
}
