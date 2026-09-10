'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Mail, Edit3, Clock, Send, Star, Trash2, LayoutDashboard,
  Search, RefreshCw, LogOut, CheckCircle2, XCircle, Activity,
  ChevronRight, Paperclip, ExternalLink, X,
  TrendingUp, Users, RotateCcw,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { jobsApi, sendersApi, slackApi } from '@/lib/api';
import type { EmailJob, QueueStats } from '@/lib/types';
import { ComposeModal } from '@/components/ComposeModal';
import { SlackModal } from '@/components/SlackModal';
import { ScheduledEmailsTable } from '@/components/ScheduledEmailsTable';
import { SentEmailsTable } from '@/components/SentEmailsTable';
import { StatusBadge } from '@/components/ScheduledEmailsTable';
import { RichEmptyState } from '@/components/RichEmptyState';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

type Folder = 'overview' | 'scheduled' | 'sent' | 'starred' | 'trash' | 'senders';

// ── Small reusable stat card ──────────────────────────────────────────────────
function StatCard({
  label, value, sub, icon, color,
}: { label: string; value: string | number; sub?: string; icon: React.ReactNode; color: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</span>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>{icon}</div>
      </div>
      <div className="text-3xl font-bold text-slate-900 mb-1">{value}</div>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

// ── Queue pill ────────────────────────────────────────────────────────────────
function QueuePill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={`w-2 h-2 rounded-full ${color}`} />
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-800">{value}</span>
    </div>
  );
}

// ── Nav item ──────────────────────────────────────────────────────────────────
function NavItem({
  icon, label, badge, active, onClick,
}: { icon: React.ReactNode; label: string; badge?: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer ${
        active
          ? 'bg-emerald-500 text-white font-semibold shadow-sm shadow-emerald-500/25'
          : 'text-slate-600 hover:bg-slate-100/90 hover:text-slate-900'
      }`}
    >
      <div className="flex items-center gap-3">
        <span className={active ? 'text-white' : 'text-slate-400'}>{icon}</span>
        <span>{label}</span>
      </div>
      {badge !== undefined && (
        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
          active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
        }`}>
          {badge}
        </span>
      )}
    </button>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({
  title, subtitle, action, children, className = '',
}: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col ${className}`}>
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
        <div>
          <h2 className="text-base font-semibold text-slate-800">{title}</h2>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="flex-1 flex flex-col overflow-y-auto min-h-0">
        {children}
      </div>
    </div>
  );
}

// ── Simple email row (for starred / trash / search) ────────────────────────────
function SimpleEmailRow({
  job,
  onStar,
  onDelete,
  onRestore,
  isTrash,
}: {
  job: EmailJob;
  onStar: (id: string, cur: boolean) => void;
  onDelete: (id: string) => void;
  onRestore?: (id: string) => void;
  isTrash?: boolean;
}) {
  return (
    <div className="flex items-center gap-4 px-6 py-4 border-b border-slate-100 hover:bg-slate-50/60 transition-colors group">
      <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-semibold text-xs flex-shrink-0">
        {job.recipientEmail.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-medium text-slate-800 text-sm truncate">{job.recipientEmail}</span>
          <StatusBadge status={job.status} />
          {job.hasAttachments && <Paperclip className="w-3 h-3 text-slate-400" />}
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="truncate max-w-[200px]">{job.campaignSubject}</span>
          {job.senderEmail && <span>· From: {job.senderEmail}</span>}
          {job.sentAt && <span>· {format(new Date(job.sentAt), 'MMM d, h:mm a')}</span>}
          {!job.sentAt && job.scheduledAt && <span>· Scheduled: {format(new Date(job.scheduledAt), 'MMM d, h:mm a')}</span>}
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {!isTrash && (
          <button
            type="button"
            onClick={() => onStar(job.id, !!job.isStarred)}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-yellow-500 transition-colors cursor-pointer"
            title={job.isStarred ? 'Unstar' : 'Star'}
          >
            <Star className={`w-4 h-4 ${job.isStarred ? 'fill-yellow-400 text-yellow-400' : 'text-slate-300'}`} />
          </button>
        )}
        {job.previewUrl && (
          <a
            href={job.previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
            title="Preview Email"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        )}
        {isTrash && onRestore && (
          <button
            type="button"
            onClick={() => onRestore(job.id)}
            className="p-1.5 hover:bg-emerald-50 rounded-lg text-slate-400 hover:text-emerald-600 transition-colors cursor-pointer"
            title="Restore from Trash"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        )}
        <button
          type="button"
          onClick={() => onDelete(job.id)}
          className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
          title={isTrash ? 'Permanently Delete' : 'Move to Trash'}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { firebaseUser, signOut: authSignOut } = useAuth();
  const [folder, setFolder] = useState<Folder>('overview');
  const [scheduledJobs, setScheduledJobs] = useState<EmailJob[]>([]);
  const [sentJobs, setSentJobs] = useState<EmailJob[]>([]);
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
  const [senders, setSenders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [composeOpen, setComposeOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [esResults, setEsResults] = useState<EmailJob[] | null>(null);
  const [esLoading, setEsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [slackModalOpen, setSlackModalOpen] = useState(false);
  const [slackConnected, setSlackConnected] = useState(false);

  const fetchData = useCallback(async (isManual = false) => {
    try {
      const [sched, sent, sndrs, stats, slackInfo] = await Promise.all([
        jobsApi.scheduled(),
        jobsApi.sent(),
        sendersApi.list(),
        jobsApi.stats(),
        slackApi.getStatus().catch(() => ({ connected: false })),
      ]);
      setScheduledJobs(sched.jobs);
      setSentJobs(sent.jobs);
      setSenders(sndrs.senders);
      setQueueStats(stats.queue);
      setSlackConnected(!!slackInfo.connected);
      if (isManual) {
        toast.success('Dashboard refreshed');
      }
    } catch (err) {
      console.error(err);
      if (isManual) {
        toast.error('Failed to load data');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await fetchData(true);
  };

  useEffect(() => { 
    fetchData(); 
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('slack_connected') === 'true') {
        toast.success('Slack connected successfully!');
        window.history.replaceState({}, '', window.location.pathname);
      }
    }

    // Auto-poll every 3 seconds to reflect scheduled/sent/queue state changes live
    const interval = setInterval(() => {
      fetchData(false);
    }, 3000);

    return () => clearInterval(interval);
  }, [fetchData]);

  // ES search debounce
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    clearTimeout(searchTimer.current);
    if (!searchQuery.trim()) { setEsResults(null); return; }
    setEsLoading(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const token = await firebaseUser?.getIdToken();
        const res = await fetch(`http://localhost:4000/api/search?q=${encodeURIComponent(searchQuery)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setEsResults(data.results);
        }
      } catch { /* silent */ } finally {
        setEsLoading(false);
      }
    }, 400);
    return () => clearTimeout(searchTimer.current);
  }, [searchQuery, firebaseUser]);

  const toggleStar = async (id: string, current: boolean) => {
    const next = !current;
    setScheduledJobs(p => p.map(j => j.id === id ? { ...j, isStarred: next } : j));
    setSentJobs(p => p.map(j => j.id === id ? { ...j, isStarred: next } : j));
    try { await jobsApi.updateState(id, { isStarred: next }); } catch { /* silent */ }
  };

  const moveToTrash = async (id: string) => {
    setScheduledJobs(p => p.map(j => j.id === id ? { ...j, isDeleted: true } : j));
    setSentJobs(p => p.map(j => j.id === id ? { ...j, isDeleted: true } : j));
    try {
      await jobsApi.updateState(id, { isDeleted: true });
      toast.success('Moved to Trash');
    } catch { /* silent */ }
  };

  const restoreFromTrash = async (id: string) => {
    setScheduledJobs(p => p.map(j => j.id === id ? { ...j, isDeleted: false } : j));
    setSentJobs(p => p.map(j => j.id === id ? { ...j, isDeleted: false } : j));
    try {
      await jobsApi.updateState(id, { isDeleted: false });
      toast.success('Restored from Trash');
    } catch {
      toast.error('Failed to restore email');
    }
  };

  const permanentDelete = async (id: string) => {
    setScheduledJobs(p => p.filter(j => j.id !== id));
    setSentJobs(p => p.filter(j => j.id !== id));
    try {
      await jobsApi.delete(id);
      toast.success('Permanently deleted');
    } catch { /* silent */ }
  };

  const deleteSender = async (id: string) => {
    if (!confirm('Are you sure you want to remove this sender profile?')) return;
    try {
      await sendersApi.delete(id);
      setSenders(p => p.filter(s => s.id !== id));
      toast.success('Sender profile removed');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete sender';
      toast.error(msg);
    }
  };

  const handleDelete = (id: string) => {
    folder === 'trash' ? permanentDelete(id) : moveToTrash(id);
  };

  const allJobs = [...scheduledJobs, ...sentJobs];
  const activeScheduled = scheduledJobs.filter(j => !j.isDeleted);
  const activeSent = sentJobs.filter(j => !j.isDeleted);
  const starred = allJobs.filter(j => !j.isDeleted && j.isStarred);
  const trash = allJobs.filter(j => j.isDeleted);

  const sentCount = activeSent.filter(j => j.status === 'sent').length;
  const failedCount = activeSent.filter(j => j.status === 'failed').length;
  const successRate = sentCount + failedCount > 0
    ? Math.round((sentCount / (sentCount + failedCount)) * 100)
    : 0;

  const displayName = firebaseUser?.displayName || 'User';
  const displayEmail = firebaseUser?.email || '';
  const avatarLetter = displayName.charAt(0).toUpperCase();



  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50">

      {/* ── LEFT SIDEBAR ─────────────────────────────────────────────────── */}
      <aside className="w-64 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col h-full">

        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-100">
          <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center shadow-sm">
            <Mail className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-slate-900 text-lg tracking-tight">mailZy</span>
        </div>

        {/* Compose button */}
        <div className="px-4 py-4">
          <button
            onClick={() => setComposeOpen(true)}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm shadow-emerald-500/25 text-sm"
          >
            <Edit3 className="w-4 h-4" /> Compose Email
          </button>
        </div>

        {/* Navigation */}
        <nav className="px-3 flex-1 overflow-y-auto py-2 space-y-5">
          {/* Main Menu */}
          <div>
            <p className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Dashboard
            </p>
            <div className="space-y-1">
              <NavItem
                icon={<LayoutDashboard className="w-4 h-4" />}
                label="Overview"
                active={folder === 'overview'}
                onClick={() => setFolder('overview')}
              />
            </div>
          </div>

          {/* Email Folders */}
          <div>
            <p className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Email Folders
            </p>
            <div className="space-y-1">
              <NavItem
                icon={<Clock className="w-4 h-4" />}
                label="Scheduled"
                badge={activeScheduled.length}
                active={folder === 'scheduled'}
                onClick={() => setFolder('scheduled')}
              />
              <NavItem
                icon={<Send className="w-4 h-4" />}
                label="Sent"
                badge={activeSent.length}
                active={folder === 'sent'}
                onClick={() => setFolder('sent')}
              />
              <NavItem
                icon={<Star className="w-4 h-4" />}
                label="Starred"
                badge={starred.length}
                active={folder === 'starred'}
                onClick={() => setFolder('starred')}
              />
              <NavItem
                icon={<Trash2 className="w-4 h-4" />}
                label="Trash"
                badge={trash.length}
                active={folder === 'trash'}
                onClick={() => setFolder('trash')}
              />
              <NavItem
                icon={<Users className="w-4 h-4" />}
                label="Configured Senders"
                badge={senders.length}
                active={folder === 'senders'}
                onClick={() => setFolder('senders')}
              />
            </div>
          </div>
        </nav>

        {/* Queue stats in sidebar */}
        {queueStats && (
          <div className="mx-3 mb-3 bg-slate-50 rounded-xl p-3 border border-slate-100">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Queue Status</p>
            <div className="space-y-1.5">
              <QueuePill label="Waiting"   value={queueStats.waiting}   color="bg-yellow-400" />
              <QueuePill label="Active"    value={queueStats.active}    color="bg-blue-400" />
              <QueuePill label="Delayed"   value={queueStats.delayed}   color="bg-purple-400" />
              <QueuePill label="Completed" value={queueStats.completed} color="bg-emerald-400" />
              <QueuePill label="Failed"    value={queueStats.failed}    color="bg-red-400" />
            </div>
          </div>
        )}

        {/* User profile */}
        <div className="border-t border-slate-100 px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm flex-shrink-0">
            {avatarLetter}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">{displayName}</p>
            <p className="text-xs text-slate-400 truncate">{displayEmail}</p>
          </div>
          <button
            onClick={() => authSignOut()}
            title="Sign Out"
            className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded-lg hover:bg-red-50"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ─────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">

        {/* Top Bar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 flex-shrink-0">
          {/* Search */}
          <div className="relative w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search emails via Elasticsearch..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition-all"
            />
            {esLoading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            )}
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-3">
            {esResults && (
              <span className="text-xs text-slate-500 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                {esResults.length} ES results
              </span>
            )}
            {esResults && (
              <button onClick={() => { setEsResults(null); setSearchQuery(''); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            )}
            <div className="h-4 w-px bg-slate-200" />
            <button
              type="button"
              onClick={() => setSlackModalOpen(true)}
              className="flex items-center gap-2 text-sm text-slate-700 hover:text-slate-900 border border-slate-200 px-3.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 transition-all shadow-sm cursor-pointer"
              title="Configure Slack rate-limit alerts"
            >
              <div className={`w-2 h-2 rounded-full ${slackConnected ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-slate-300'}`} />
              <span className="font-medium text-xs">
                {slackConnected ? 'Slack: Connected' : 'Connect Slack'}
              </span>
            </button>
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 border border-slate-200 px-3.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 transition-all shadow-sm disabled:opacity-60 cursor-pointer"
              title="Refresh dashboard data"
            >
              <RefreshCw className={`w-3.5 h-3.5 transition-transform ${refreshing ? 'animate-spin text-emerald-600' : 'text-slate-500'}`} />
              <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>
        </header>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto flex flex-col min-h-0">

          {/* ── ES Search Results overlay ─────────────────────────────────── */}
          {esResults && (
            <div className="p-6 flex-1 flex flex-col min-h-0 animate-fadein">
              <Section className="flex-1 min-h-0" title={`Search Results (${esResults.length})`} subtitle="Elasticsearch · showing all matches">
                {esResults.length === 0 ? (
                  <RichEmptyState
                    icon={<Search className="w-9 h-9 text-slate-500" />}
                    badge="Search Query Completed"
                    badgeColor="bg-slate-100 text-slate-700 border-slate-200"
                    title="No Matching Emails Found"
                    description={`We couldn't find any emails matching "${searchQuery}". Try searching with a different recipient email, subject keyword, or sender address.`}
                    actionText="Clear Search Query"
                    actionIcon={<X className="w-4 h-4" />}
                    onAction={() => { setEsResults(null); setSearchQuery(''); }}
                    features={[
                      {
                        icon: '⚡',
                        title: 'Full-Text Search',
                        desc: 'Elasticsearch searches subjects, bodies, recipients, and senders.',
                      },
                      {
                        icon: '🔍',
                        title: 'Fuzzy Matching',
                        desc: 'Tolerates small typos and partial word matches for instant discovery.',
                      },
                      {
                        icon: '📊',
                        title: 'Real-Time Sync',
                        desc: 'Every scheduled and sent job is automatically indexed upon creation.',
                      },
                    ]}
                  />
                ) : (
                  esResults.map((job: any) => (
                    <SimpleEmailRow key={job.id} job={{ ...job, campaignSubject: job.subject } as EmailJob}
                      onStar={toggleStar} onDelete={handleDelete} />
                  ))
                )}
              </Section>
            </div>
          )}

          {/* ── OVERVIEW ─────────────────────────────────────────────────── */}
          {!esResults && folder === 'overview' && (
            <div className="p-6 space-y-6 animate-fadein">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">
                    Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, {displayName.split(' ')[0]} 👋
                  </h1>
                  <p className="text-sm text-slate-400 mt-1">Here's what's happening with your email campaigns today.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setComposeOpen(true)}
                  className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-sm shadow-emerald-500/25 text-sm cursor-pointer"
                >
                  <Edit3 className="w-4 h-4" /> Compose Email
                </button>
              </div>

              {/* Stat cards */}
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                <StatCard
                  label="Scheduled"
                  value={loading ? '—' : activeScheduled.length}
                  sub="emails waiting to send"
                  icon={<Clock className="w-4 h-4 text-blue-600" />}
                  color="bg-blue-50"
                />
                <StatCard
                  label="Sent"
                  value={loading ? '—' : sentCount}
                  sub="successfully delivered"
                  icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                  color="bg-emerald-50"
                />
                <StatCard
                  label="Failed"
                  value={loading ? '—' : failedCount}
                  sub="delivery errors"
                  icon={<XCircle className="w-4 h-4 text-red-500" />}
                  color="bg-red-50"
                />
                <StatCard
                  label="Success Rate"
                  value={loading ? '—' : `${successRate}%`}
                  sub="overall delivery rate"
                  icon={<TrendingUp className="w-4 h-4 text-orange-500" />}
                  color="bg-orange-50"
                />
              </div>

              {/* Queue stats bar */}
              {queueStats && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-6 py-4 flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-6 flex-wrap">
                    <QueuePill label="Waiting"   value={queueStats.waiting}   color="bg-yellow-400" />
                    <QueuePill label="Active"    value={queueStats.active}    color="bg-blue-400" />
                    <QueuePill label="Delayed"   value={queueStats.delayed}   color="bg-purple-400" />
                    <QueuePill label="Completed" value={queueStats.completed} color="bg-emerald-400" />
                    <QueuePill label="Failed"    value={queueStats.failed}    color="bg-red-400" />
                  </div>
                  <span className="text-xs text-slate-400 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5" /> Live BullMQ Queue
                  </span>
                </div>
              )}

              {/* Recent Activity */}
              <Section
                title="Recent Activity"
                subtitle="Latest 7 email jobs across all campaigns"
                action={
                  <button
                    type="button"
                    onClick={() => setFolder('sent')}
                    className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    View All <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                }
              >
                {loading ? (
                  <div className="p-6 space-y-3">
                    {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-10 rounded-xl" />)}
                  </div>
                ) : allJobs.filter(j => !j.isDeleted).length === 0 ? (
                  <div className="py-12 px-6 flex flex-col items-center justify-center text-center">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3.5 border border-emerald-100 shadow-sm">
                      <Mail className="w-6 h-6" />
                    </div>
                    <h3 className="text-base font-bold text-slate-800 mb-1">No Activity Recorded Yet</h3>
                    <p className="text-xs text-slate-400 max-w-sm mb-4">Click "Compose Email" above to schedule your first email campaign and track delivery progress in real-time.</p>
                    <button
                      type="button"
                      onClick={() => setComposeOpen(true)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm shadow-emerald-500/20 transition-all cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> Compose First Email
                    </button>
                  </div>
                ) : (
                  [...allJobs.filter(j => !j.isDeleted)]
                    .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime())
                    .slice(0, 7)
                    .map(job => (
                      <SimpleEmailRow key={job.id} job={job} onStar={toggleStar} onDelete={handleDelete} />
                    ))
                )}
              </Section>
            </div>
          )}

          {/* ── SCHEDULED ────────────────────────────────────────────────── */}
          {!esResults && folder === 'scheduled' && (
            <div className="p-6 flex-1 flex flex-col min-h-0 animate-fadein">
              <Section
                className="flex-1 min-h-0"
                title="Scheduled Emails"
                subtitle={`${activeScheduled.length} email${activeScheduled.length !== 1 ? 's' : ''} waiting to be dispatched`}
                action={
                  <button
                    type="button"
                    onClick={() => setComposeOpen(true)}
                    className="flex items-center gap-1.5 text-sm text-emerald-600 hover:text-emerald-700 font-semibold cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> New Campaign
                  </button>
                }
              >
                <ScheduledEmailsTable
                  jobs={activeScheduled}
                  loading={loading}
                  onStar={toggleStar}
                  onDelete={moveToTrash}
                  onCompose={() => setComposeOpen(true)}
                />
              </Section>
            </div>
          )}

          {/* ── SENT ─────────────────────────────────────────────────────── */}
          {!esResults && folder === 'sent' && (
            <div className="p-6 flex-1 flex flex-col min-h-0 animate-fadein">
              <Section
                className="flex-1 min-h-0"
                title="Sent Emails"
                subtitle={`${activeSent.length} email${activeSent.length !== 1 ? 's' : ''} dispatched`}
              >
                <SentEmailsTable
                  jobs={activeSent}
                  loading={loading}
                  onStar={toggleStar}
                  onDelete={moveToTrash}
                  onCompose={() => setComposeOpen(true)}
                />
              </Section>
            </div>
          )}

          {/* ── STARRED ──────────────────────────────────────────────────── */}
          {!esResults && folder === 'starred' && (
            <div className="p-6 flex-1 flex flex-col min-h-0 animate-fadein">
              <Section
                className="flex-1 min-h-0"
                title="Starred Emails"
                subtitle={`${starred.length} starred email${starred.length !== 1 ? 's' : ''}`}
              >
                {starred.length === 0 ? (
                  <RichEmptyState
                    icon={<Star className="w-9 h-9 text-amber-500 fill-amber-400" />}
                    badge="Priority Inbox"
                    badgeColor="bg-amber-50 text-amber-700 border-amber-200"
                    title="No Starred Emails Bookmarked"
                    description="Keep your important campaigns and deliveries within easy reach. Click the star icon on any scheduled or sent email to bookmark it here."
                    actionText="Browse Sent History"
                    actionIcon={<Send className="w-4 h-4" />}
                    onAction={() => setFolder('sent')}
                    features={[
                      {
                        icon: '⭐',
                        title: 'One-Click Pinning',
                        desc: 'Bookmark key messages directly from Scheduled or Sent tables.',
                      },
                      {
                        icon: '📌',
                        title: 'Database Synced',
                        desc: 'Bookmarks stay saved permanently across page refreshes and devices.',
                      },
                      {
                        icon: '🚀',
                        title: 'Instant Access',
                        desc: 'Filter high-priority follow-ups immediately without searching.',
                      },
                    ]}
                  />
                ) : (
                  starred.map(job => (
                    <SimpleEmailRow key={job.id} job={job} onStar={toggleStar} onDelete={moveToTrash} />
                  ))
                )}
              </Section>
            </div>
          )}

          {/* ── TRASH ────────────────────────────────────────────────────── */}
          {!esResults && folder === 'trash' && (
            <div className="p-6 flex-1 flex flex-col min-h-0 animate-fadein">
              <Section
                className="flex-1 min-h-0"
                title="Trash"
                subtitle="Emails moved to trash — click Empty Trash to permanently delete"
                action={
                  trash.length > 0 ? (
                    <button
                      type="button"
                      onClick={async () => {
                        if (confirm('Permanently delete all trashed emails?')) {
                          for (const j of trash) await permanentDelete(j.id);
                        }
                      }}
                      className="text-xs text-red-500 hover:text-red-600 font-semibold border border-red-100 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                    >
                      Empty Trash
                    </button>
                  ) : undefined
                }
              >
                {trash.length === 0 ? (
                  <RichEmptyState
                    icon={<Trash2 className="w-9 h-9 text-slate-500" />}
                    badge="Recycle Bin Empty"
                    badgeColor="bg-slate-100 text-slate-700 border-slate-200"
                    title="Trash is Completely Clean"
                    description="There are no deleted emails in your recycle bin. When you remove emails from Scheduled or Sent, they will stay stored here safely until permanent purge."
                    actionText="Return to Dashboard"
                    actionIcon={<LayoutDashboard className="w-4 h-4" />}
                    onAction={() => setFolder('overview')}
                    features={[
                      {
                        icon: '🛡️',
                        title: '2-Stage Soft Delete',
                        desc: 'Protects your records against accidental permanent data loss.',
                      },
                      {
                        icon: '♻️',
                        title: 'Safe Recovery',
                        desc: 'Restore deleted items back to scheduled or sent queues with ease.',
                      },
                      {
                        icon: '💥',
                        title: 'Permanent Purge',
                        desc: 'Permanently remove logs from PostgreSQL and Redis when ready.',
                      },
                    ]}
                  />
                ) : (
                  trash.map(job => (
                    <SimpleEmailRow
                      key={job.id}
                      job={job}
                      onStar={toggleStar}
                      onDelete={permanentDelete}
                      onRestore={restoreFromTrash}
                      isTrash
                    />
                  ))
                )}
              </Section>
            </div>
          )}

          {/* ── CONFIGURED SENDERS ────────────────────────────────────────── */}
          {!esResults && folder === 'senders' && (
            <div className="p-6 flex-1 flex flex-col min-h-0 animate-fadein">
              <Section
                className="flex-1 min-h-0"
                title="Configured Senders"
                subtitle={`${senders.length} active Ethereal mail senders configured for campaign dispatch`}
                action={
                  <button
                    type="button"
                    onClick={() => setComposeOpen(true)}
                    className="flex items-center gap-1.5 text-sm text-emerald-600 hover:text-emerald-700 font-semibold cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Compose Email
                  </button>
                }
              >
                {senders.length === 0 ? (
                  <RichEmptyState
                    icon={<Users className="w-9 h-9 text-emerald-600" />}
                    badge="Sender Profiles"
                    badgeColor="bg-emerald-50 text-emerald-700 border-emerald-200"
                    title="No Sender Identities Registered"
                    description="Sender profiles manage the SMTP mailboxes and credentials used to deliver emails. Seed the database to auto-generate Ethereal sender accounts."
                    actionText="Schedule New Campaign"
                    actionIcon={<Edit3 className="w-4 h-4" />}
                    onAction={() => setComposeOpen(true)}
                    features={[
                      {
                        icon: '👥',
                        title: 'Multi-Sender Rotation',
                        desc: 'Distribute campaigns across multiple sender identities seamlessly.',
                      },
                      {
                        icon: '🔒',
                        title: 'Isolated Credentials',
                        desc: 'Dedicated Ethereal credentials per sender profile for testing.',
                      },
                      {
                        icon: '⚡',
                        title: 'Per-Sender Limits',
                        desc: 'Individual hourly rate limit counters tracked in Redis per account.',
                      },
                    ]}
                  />
                ) : (
                  <div className="divide-y divide-slate-100">
                    {senders.map((s: any) => (
                      <div key={s.id} className="p-5 flex items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-700 font-bold text-base flex items-center justify-center flex-shrink-0 shadow-sm shadow-emerald-500/10">
                            {(s.name || s.email).charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <h3 className="font-semibold text-slate-800 text-sm truncate">{s.name}</h3>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 font-medium">
                                Active
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 font-mono truncate">{s.email}</p>
                            <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1">
                              <span>SMTP Host: {s.smtpHost || 'smtp.ethereal.email'}</span>
                              <span>· Port: {s.smtpPort || 587}</span>
                              {s.createdAt && <span>· Added: {format(new Date(s.createdAt), 'MMM d, yyyy')}</span>}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => setComposeOpen(true)}
                            className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-sm transition-colors cursor-pointer"
                          >
                            <Send className="w-3.5 h-3.5 text-emerald-600" />
                            Send Mail
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteSender(s.id)}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl border border-transparent hover:border-red-100 transition-colors cursor-pointer"
                            title="Remove Sender Profile"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            </div>
          )}

        </div>
      </main>

      {/* ── COMPOSE MODAL ──────────────────────────────────────────────────── */}
      {composeOpen && (
        <ComposeModal
          senders={senders}
          onClose={() => setComposeOpen(false)}
          onSuccess={() => {
            setComposeOpen(false);
            toast.success('Campaign scheduled!');
            fetchData();
          }}
        />
      )}

      {/* ── SLACK MODAL ────────────────────────────────────────────────────── */}
      <SlackModal
        isOpen={slackModalOpen}
        onClose={() => setSlackModalOpen(false)}
        onStatusChange={fetchData}
      />
    </div>
  );
}
