'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Mail, Edit3, Clock, Send, Star, Trash2, LayoutDashboard,
  Search, RefreshCw, LogOut, CheckCircle2, XCircle, Activity,
  ChevronRight, Paperclip, ExternalLink, X,
  TrendingUp, Users, RotateCcw, Plus, Folder,
  Shield, Cpu, Copy, Check, Download, Save,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { jobsApi, sendersApi } from '@/lib/api';
import type { EmailJob, QueueStats } from '@/lib/types';
import { ComposeModal } from '@/components/ComposeModal';
import { AddSenderModal } from '@/components/AddSenderModal';
import { ScheduledEmailsTable } from '@/components/ScheduledEmailsTable';
import { SentEmailsTable } from '@/components/SentEmailsTable';
import { StatusBadge } from '@/components/ScheduledEmailsTable';
import { RichEmptyState } from '@/components/RichEmptyState';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

type Folder = 'overview' | 'scheduled' | 'sent' | 'starred' | 'trash' | 'senders' | 'profile';

// ── Small reusable stat card ──────────────────────────────────────────────────
function StatCard({
  label, value, sub, icon, color, trend,
}: { label: string; value: string | number; sub?: string; icon: React.ReactNode; color: string; trend?: string }) {
  return (
    <div className="group bg-[#161616] hover:bg-[#1a1a1a] rounded-xl border border-[#2E2E2E] hover:border-[#3E3F3E] p-4 sm:p-5 shadow-sm transition-all duration-200 flex flex-col justify-between">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-semibold text-[#8E8E8E] uppercase tracking-wider">{label}</span>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-transform group-hover:scale-105 ${color}`}>{icon}</div>
      </div>
      <div>
        <div className="text-2xl sm:text-3xl font-bold text-[#F0F2F0] tracking-tight mb-1 font-sans">{value}</div>
        <div className="flex items-center justify-between text-[11px]">
          {sub && <span className="text-[#757575] truncate">{sub}</span>}
          {trend && <span className="text-[10px] font-medium text-[#54C750] bg-[#54C750]/10 px-1.5 py-0.5 rounded border border-[#54C750]/20 shrink-0">{trend}</span>}
        </div>
      </div>
    </div>
  );
}

// ── Queue pill ────────────────────────────────────────────────────────────────
function QueuePill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2 text-xs font-medium bg-[#1a1a1a] border border-[#2E2E2E] px-2.5 py-1 rounded-lg">
      <span className={`w-1.5 h-1.5 rounded-full ${color}`} />
      <span className="text-zinc-400">{label}</span>
      <span className="font-mono font-semibold text-[#F0F2F0]">{value}</span>
    </div>
  );
}

// ── Full-width folder button ──────────────────────────────────────────────────
function FolderButton({
  icon,
  label,
  badge,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  badge?: number | string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-150 cursor-pointer active:scale-[0.98] ${
        active
          ? 'bg-[#54C750] text-[#060C06] shadow-[0_4px_16px_rgba(84,199,80,0.3)] border border-[#54C750]'
          : 'bg-[#1C1C1C] text-[#C0C4C0] hover:text-[#F0F2F0] hover:bg-[#242424] border border-[#262626] hover:border-[#383838]'
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span className={active ? 'text-[#060C06]' : 'text-[#8E928E]'}>
          {icon}
        </span>
        <span className="truncate">{label}</span>
      </div>
      {badge !== undefined && (
        <span
          className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold transition-all ${
            active
              ? 'bg-[#060C06]/20 text-[#060C06]'
              : 'bg-[#262626] text-[#8E8E8E] border border-[#333333]'
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

// ── Queue telemetry capsule ──────────────────────────────────────────────────
function QueueCapsule({
  label,
  count,
  dotColor,
  highlight = false,
}: {
  label: string;
  count: number;
  dotColor: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-[#1C1C1C] border border-[#262626] hover:border-[#383838] transition-all text-xs">
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${dotColor}`} />
        <span className="text-[#A0A4A0] text-xs font-medium">{label}</span>
      </div>
      <span className={`font-mono text-xs font-semibold ${highlight ? 'text-[#54C750]' : 'text-[#F0F2F0]'}`}>
        {count}
      </span>
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({
  title, subtitle, action, children, className = '',
}: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-[#1E1E1E] rounded-2xl border border-[#3E3F3E] shadow-sm overflow-hidden flex flex-col ${className}`}>
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#3E3F3E]/70 flex-shrink-0 bg-[#1E1E1E]">
        <div>
          <h2 className="text-base font-semibold text-[#F0F2F0] tracking-tight">{title}</h2>
          {subtitle && <p className="text-xs text-[#8E8E8E] mt-0.5">{subtitle}</p>}
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
    <div className="flex items-center gap-4 px-6 py-4 border-b border-[#3E3F3E]/60 hover:bg-[#262626]/60 transition-colors group">
      <div className="w-8 h-8 rounded-full bg-[#54C750]/15 border border-[#54C750]/30 flex items-center justify-center text-[#54C750] font-bold text-xs flex-shrink-0">
        {job.recipientEmail.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-medium text-[#F0F2F0] text-sm truncate">{job.recipientEmail}</span>
          <StatusBadge status={job.status} />
          {job.hasAttachments && <Paperclip className="w-3 h-3 text-[#5B5B5B]" />}
        </div>
        <div className="flex items-center gap-3 text-xs text-zinc-400">
          <span className="truncate max-w-[200px] text-zinc-300">{job.campaignSubject}</span>
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
            className="p-1.5 hover:bg-[#333333] rounded-lg text-zinc-400 hover:text-yellow-400 transition-colors cursor-pointer"
            title={job.isStarred ? 'Unstar' : 'Star'}
          >
            <Star className={`w-4 h-4 ${job.isStarred ? 'fill-yellow-400 text-yellow-400' : 'text-zinc-500'}`} />
          </button>
        )}
        {job.previewUrl && (
          <a
            href={job.previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 hover:bg-[#333333] rounded-lg text-zinc-400 hover:text-[#54C750] transition-colors"
            title="Preview Email"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        )}
        {isTrash && onRestore && (
          <button
            type="button"
            onClick={() => onRestore(job.id)}
            className="p-1.5 hover:bg-[#54C750]/20 rounded-lg text-zinc-400 hover:text-[#54C750] transition-colors cursor-pointer"
            title="Restore from Trash"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        )}
        <button
          type="button"
          onClick={() => onDelete(job.id)}
          className="p-1.5 hover:bg-red-500/15 rounded-lg text-zinc-400 hover:text-red-400 transition-colors cursor-pointer"
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
  const { firebaseUser, signOut: authSignOut, updateDisplayName } = useAuth();
  const [folder, setFolder] = useState<Folder>('overview');
  const [scheduledJobs, setScheduledJobs] = useState<EmailJob[]>([]);
  const [sentJobs, setSentJobs] = useState<EmailJob[]>([]);
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
  const [senders, setSenders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [composeOpen, setComposeOpen] = useState(false);
  const [addSenderOpen, setAddSenderOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [esResults, setEsResults] = useState<EmailJob[] | null>(null);
  const [esLoading, setEsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Profile state
  const [editName, setEditName] = useState(firebaseUser?.displayName || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedUid, setCopiedUid] = useState(false);

  useEffect(() => {
    if (firebaseUser?.displayName) {
      setEditName(firebaseUser.displayName);
    }
  }, [firebaseUser?.displayName]);

  const fetchData = useCallback(async (isManual = false) => {
    try {
      const [sched, sent, sndrs, stats] = await Promise.all([
        jobsApi.scheduled(),
        jobsApi.sent(),
        sendersApi.list(),
        jobsApi.stats(),
      ]);
      setScheduledJobs(sched.jobs);
      setSentJobs(sent.jobs);
      setSenders(sndrs.senders);
      setQueueStats(stats.queue);
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

    // Auto-poll every 3 seconds to reflect scheduled/sent/queue state changes live
    const interval = setInterval(() => {
      fetchData(false);
    }, 3000);

    return () => {
      clearInterval(interval);
    };
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

  const handleSaveProfile = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editName.trim()) {
      toast.error('Display name cannot be empty');
      return;
    }
    setSavingProfile(true);
    try {
      await updateDisplayName(editName.trim());
      toast.success('Profile updated successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const copyToClipboard = (text: string, type: 'email' | 'uid') => {
    navigator.clipboard.writeText(text);
    if (type === 'email') {
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
      toast.success('Email copied to clipboard');
    } else {
      setCopiedUid(true);
      setTimeout(() => setCopiedUid(false), 2000);
      toast.success('UID copied to clipboard');
    }
  };

  const handleExportCampaigns = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      user: {
        name: displayName,
        email: displayEmail,
        uid: firebaseUser?.uid,
      },
      summary: {
        totalScheduled: activeScheduled.length,
        totalSent: activeSent.length,
        totalStarred: starred.length,
        totalTrash: trash.length,
        totalSenders: senders.length,
      },
      queueTelemetry: queueStats,
      scheduledJobs: activeScheduled,
      sentJobs: activeSent,
      senders: senders.map(s => ({
        id: s.id,
        name: s.name,
        email: s.email,
        smtpHost: s.smtpHost,
        smtpPort: s.smtpPort,
        isVerified: s.isVerified,
      })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mailzy-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Campaign logs exported as JSON!');
  };

  const handleEmptyTrash = async () => {
    if (trash.length === 0) {
      toast.success('Trash is already empty');
      return;
    }
    if (!confirm(`Are you sure you want to permanently delete all ${trash.length} items in Trash?`)) return;
    const ids = trash.map(j => j.id);
    setScheduledJobs(p => p.filter(j => !j.isDeleted));
    setSentJobs(p => p.filter(j => !j.isDeleted));
    try {
      await Promise.all(ids.map(id => jobsApi.delete(id)));
      toast.success('Trash emptied successfully');
    } catch {
      toast.error('Failed to empty trash');
    }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#060C06] text-[#F0F2F0] font-sans p-4 sm:p-5 gap-4">

      {/* ── LEFT SIDEBAR ─────────────────────────────────────────────────── */}
      <aside className="w-72 flex-shrink-0 bg-[#1E1E1E] rounded-2xl border border-[#3E3F3E] shadow-xl flex flex-col h-full overflow-hidden p-3.5 gap-3">

        {/* Brand Symbol & Name with Always-Active Motion Animation */}
        <div className="flex items-center justify-between px-3 py-2.5 rounded-2xl bg-[#161616] border border-[#2E2E2E] shadow-sm flex-shrink-0">
          <div className="flex items-center gap-2.5">
            {/* Animated Brand Symbol */}
            <div className="relative flex items-center justify-center">
              {/* Pulsing ambient halo behind icon */}
              <span className="absolute -inset-1 rounded-xl bg-[#54C750]/35 blur-sm animate-pulse" />
              {/* Glowing tactile badge with breathing glow and floating motion */}
              <div className="relative w-8 h-8 rounded-xl bg-[#54C750] flex items-center justify-center text-[#060C06] animate-brand-glow shadow-md shadow-[#54C750]/30">
                <Mail className="w-4 h-4 stroke-[2.5] text-[#060C06] animate-float" />
              </div>
            </div>

            {/* Brand Typography */}
            <div className="flex flex-col">
              <span className="font-extrabold text-[#F0F2F0] text-base tracking-tight leading-none flex items-center gap-0.5">
                mail<span className="text-[#54C750]">Zy</span>
              </span>
              <span className="text-[10px] text-[#7E827E] font-mono mt-0.5 tracking-wide">
                Dispatcher v2.0
              </span>
            </div>
          </div>

          {/* Living Status Beacon */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#54C750]/10 border border-[#54C750]/25">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#54C750] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#54C750]"></span>
            </span>
            <span className="text-[10px] font-mono font-semibold text-[#54C750]">Live</span>
          </div>
        </div>

        {/* Compose Email Primary Action */}
        <button
          type="button"
          onClick={() => setComposeOpen(true)}
          className="w-full bg-[#54C750] hover:bg-[#48b544] active:scale-[0.98] text-[#060C06] font-extrabold py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2.5 shadow-[0_4px_20px_rgba(84,199,80,0.3)] hover:shadow-[0_6px_24px_rgba(84,199,80,0.4)] transition-all text-sm cursor-pointer flex-shrink-0"
        >
          <Edit3 className="w-4 h-4 stroke-[2.5]" />
          <span>Compose Email</span>
        </button>

        {/* Navigation & Telemetry Scroll Area */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-0.5 custom-scrollbar min-h-0">

          {/* Main Overview Button */}
          <button
            type="button"
            onClick={() => setFolder('overview')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer active:scale-[0.98] ${
              folder === 'overview'
                ? 'bg-[#54C750] text-[#060C06] shadow-[0_4px_16px_rgba(84,199,80,0.3)] border border-[#54C750]'
                : 'bg-[#161616] text-[#C0C4C0] hover:text-[#F0F2F0] hover:bg-[#202020] border border-[#2E2E2E] hover:border-[#3E3F3E]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <LayoutDashboard className={`w-4 h-4 ${folder === 'overview' ? 'text-[#060C06]' : 'text-[#8E928E]'}`} />
              <span>Overview</span>
            </div>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
              folder === 'overview'
                ? 'bg-[#060C06]/20 text-[#060C06] font-bold'
                : 'bg-[#222222] text-[#8E8E8E] border border-[#333333]'
            }`}>
              Main
            </span>
          </button>

          {/* Mailbox Folders Container */}
          <div className="bg-[#161616] rounded-2xl border border-[#2E2E2E] p-3 shadow-sm space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-bold text-[#6E726E] uppercase tracking-wider flex items-center gap-1.5">
                <Folder className="w-3.5 h-3.5 text-[#54C750]" />
                Mailbox Folders
              </span>
              <span className="text-[10px] font-mono text-[#8E8E8E] bg-[#222222] px-2 py-0.5 rounded-full border border-[#333333]">
                {activeScheduled.length + activeSent.length} Active
              </span>
            </div>

            <div className="space-y-1.5">
              <FolderButton
                icon={<Clock className="w-4 h-4" />}
                label="Scheduled"
                badge={activeScheduled.length}
                active={folder === 'scheduled'}
                onClick={() => setFolder('scheduled')}
              />
              <FolderButton
                icon={<Send className="w-4 h-4" />}
                label="Sent"
                badge={activeSent.length}
                active={folder === 'sent'}
                onClick={() => setFolder('sent')}
              />
              <FolderButton
                icon={<Star className="w-4 h-4" />}
                label="Starred"
                badge={starred.length}
                active={folder === 'starred'}
                onClick={() => setFolder('starred')}
              />
              <FolderButton
                icon={<Trash2 className="w-4 h-4" />}
                label="Trash"
                badge={trash.length}
                active={folder === 'trash'}
                onClick={() => setFolder('trash')}
              />
              <FolderButton
                icon={<Users className="w-4 h-4" />}
                label="Configured Senders"
                badge={senders.length}
                active={folder === 'senders'}
                onClick={() => setFolder('senders')}
              />
            </div>
          </div>

          {/* Telemetry Queue Engine (Wrapped in one card container) */}
          {queueStats && (
            <div className="bg-[#161616] rounded-2xl border border-[#2E2E2E] p-3 shadow-sm space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-bold text-[#6E726E] uppercase tracking-wider flex items-center gap-1.5">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#54C750] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#54C750]"></span>
                  </span>
                  Queue Engine
                </span>
                <span className="text-[10px] font-mono text-[#54C750] bg-[#54C750]/10 px-2 py-0.5 rounded-full border border-[#54C750]/20 font-medium">
                  Active
                </span>
              </div>

              <div className="space-y-1.5">
                <QueueCapsule label="Waiting" count={queueStats.waiting} dotColor="bg-yellow-400" />
                <QueueCapsule label="Active" count={queueStats.active} dotColor="bg-blue-400" />
                <QueueCapsule label="Delayed" count={queueStats.delayed} dotColor="bg-purple-400" />
                <QueueCapsule label="Completed" count={queueStats.completed} dotColor="bg-[#54C750]" highlight />
                <QueueCapsule label="Failed" count={queueStats.failed} dotColor="bg-red-400" />
              </div>
            </div>
          )}

        </div>

        {/* User profile card (Interactive navigation button to profile page) */}
        <div
          onClick={() => setFolder('profile')}
          className={`rounded-2xl border p-3 flex items-center gap-3 shadow-sm flex-shrink-0 cursor-pointer transition-all duration-200 group ${
            folder === 'profile'
              ? 'bg-[#54C750]/15 border-[#54C750] shadow-[0_0_16px_rgba(84,199,80,0.2)]'
              : 'bg-[#161616] border-[#2E2E2E] hover:border-[#3E3F3E] hover:bg-[#1a1a1a]'
          }`}
          title="Open User Profile & Account Settings"
        >
          <div className="w-9 h-9 rounded-xl bg-[#54C750]/20 border border-[#54C750]/30 flex items-center justify-center text-[#54C750] font-bold text-sm flex-shrink-0 shadow-sm group-hover:scale-105 transition-transform">
            {avatarLetter}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-semibold text-[#F0F2F0] truncate group-hover:text-[#54C750] transition-colors">
                {displayName}
              </p>
              {folder === 'profile' && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#54C750] animate-pulse flex-shrink-0" />
              )}
            </div>
            <p className="text-[11px] text-[#8E8E8E] truncate font-mono">{displayEmail}</p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              authSignOut();
            }}
            title="Sign Out"
            className="text-zinc-400 hover:text-red-400 hover:bg-red-500/15 p-1.5 rounded-xl border border-transparent hover:border-red-500/30 transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ─────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col h-full overflow-hidden gap-4 min-w-0">

        {/* Top Rounded Header Container */}
        <header className="h-16 bg-[#1E1E1E] rounded-2xl border border-[#3E3F3E] shadow-sm flex items-center justify-between px-6 flex-shrink-0">
          {/* Brand Logo & Sign + Breadcrumb */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#54C750] flex items-center justify-center shadow-lg shadow-[#54C750]/20 flex-shrink-0">
              <Mail className="w-4 h-4 text-[#060C06]" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-[#F0F2F0] text-base tracking-tight">
                mail<span className="text-[#54C750]">Zy</span>
              </span>
              <span className="text-[#3E3F3E]">/</span>
              <span className="text-xs text-[#8E8E8E] font-medium capitalize bg-[#161616] px-2.5 py-1 rounded-md border border-[#2E2E2E]">
                {folder}
              </span>
            </div>
          </div>

          {/* Search Box via Elasticsearch */}
          <div className="relative w-64 sm:w-80 md:w-96">
            <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5B5B5B]" />
            <input
              type="text"
              placeholder="Search emails via Elasticsearch..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-12 py-2 bg-[#161616] border border-[#2E2E2E] focus:border-[#54C750]/50 rounded-xl text-xs text-[#F0F2F0] placeholder-[#5B5B5B] focus:outline-none focus:ring-1 focus:ring-[#54C750]/20 transition-all font-sans"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none">
              {esLoading ? (
                <div className="w-3.5 h-3.5 border-2 border-[#54C750] border-t-transparent rounded-full animate-spin" />
              ) : (
                <kbd className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] font-mono text-[#5B5B5B] bg-[#222222] border border-[#333333]">⌘K</kbd>
              )}
            </div>
          </div>

          {/* Live Status & Refresh */}
          <div className="flex items-center gap-3">
            {esResults && (
              <span className="text-xs text-[#54C750] bg-[#54C750]/15 px-2.5 py-1 rounded-full border border-[#54C750]/30 font-medium">
                {esResults.length} ES results
              </span>
            )}
            {esResults && (
              <button
                type="button"
                onClick={() => { setEsResults(null); setSearchQuery(''); }}
                className="text-zinc-400 hover:text-[#F0F2F0] cursor-pointer p-1 rounded-lg hover:bg-[#262626]"
                title="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            <div className="hidden lg:flex items-center gap-2 text-xs text-zinc-400 bg-[#161616] border border-[#2E2E2E] px-3 py-1.5 rounded-xl">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#54C750] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#54C750]"></span>
              </span>
              <span className="text-[11px] text-[#A0A0A0]">Worker Live</span>
            </div>

            <div className="h-4 w-px bg-[#3E3F3E]/80" />

            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 text-xs text-zinc-300 hover:text-[#F0F2F0] border border-[#2E2E2E] hover:border-[#3E3F3E] px-3.5 py-2 rounded-xl bg-[#161616] hover:bg-[#202020] transition-all shadow-sm disabled:opacity-60 cursor-pointer"
              title="Refresh dashboard data"
            >
              <RefreshCw className={`w-3.5 h-3.5 transition-transform ${refreshing ? 'animate-spin text-[#54C750]' : 'text-zinc-400'}`} />
              <span>{refreshing ? 'Syncing...' : 'Refresh'}</span>
            </button>
          </div>
        </header>

        {/* Dynamic View Container */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">

          {/* ── ES Search Results overlay ─────────────────────────────────── */}
          {esResults && (
            <div className="flex-1 flex flex-col min-h-0 animate-fadein">
              <Section className="flex-1 min-h-0" title={`Search Results (${esResults.length})`} subtitle="Elasticsearch · showing all matches">
                {esResults.length === 0 ? (
                  <RichEmptyState
                    icon={<Search className="w-9 h-9 text-zinc-400" />}
                    badge="Search Query Completed"
                    badgeColor="bg-[#262626] text-zinc-300 border-[#3E3F3E]"
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
            <div className="flex-1 flex flex-col min-h-0 animate-fadein">
              <Section
                className="flex-1 min-h-0"
                title={`Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, ${displayName.split(' ')[0]} 👋`}
                subtitle="Here's what's happening with your email campaigns today."
                action={
                  <div className="flex items-center gap-2.5">
                    <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-[#8E8E8E] bg-[#161616] border border-[#2E2E2E] px-2.5 py-1 rounded-lg">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#54C750] animate-pulse"></span>
                      3s Live Polling
                    </span>
                    <button
                      type="button"
                      onClick={() => setComposeOpen(true)}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-[#54C750] hover:bg-[#46af42] text-[#060C06] shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_4px_12px_rgba(84,199,80,0.2)] cursor-pointer transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" /> New Campaign
                    </button>
                  </div>
                }
              >
                <div className="p-6 space-y-5 flex-1 flex flex-col min-h-0 overflow-y-auto">
                  {/* ── Unified Telemetry & Performance Container ── */}
                  <div className="bg-[#161616] rounded-2xl border border-[#2E2E2E] p-6 shadow-sm space-y-4 flex-shrink-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-[#54C750]/15 flex items-center justify-center text-[#54C750]">
                          <Activity className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-[#F0F2F0]">Campaign Telemetry & Dispatch Stats</h4>
                          <p className="text-[11px] text-[#8E8E8E]">Real-time delivery performance and active BullMQ pipeline status</p>
                        </div>
                      </div>
                      <span className="text-xs font-mono text-[#54C750] bg-[#54C750]/10 border border-[#54C750]/20 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#54C750] opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#54C750]"></span>
                        </span>
                        Engine Live
                      </span>
                    </div>

                    {/* 4 Mini Metric Cards */}
                    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                      {/* Scheduled */}
                      <div className="bg-[#1C1C1C] rounded-xl border border-[#2E2E2E] hover:border-[#3E3F3E] p-4 shadow-sm transition-all flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[11px] font-semibold text-[#8E8E8E] uppercase tracking-wider">Scheduled</span>
                          <div className="w-7 h-7 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                            <Clock className="w-4 h-4" />
                          </div>
                        </div>
                        <div>
                          <div className="text-2xl sm:text-3xl font-bold text-[#F0F2F0] tracking-tight mb-1 font-sans">
                            {loading ? '—' : activeScheduled.length}
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-[#757575] truncate">emails waiting in queue</span>
                            <span className="text-[10px] font-medium text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20 shrink-0">
                              {activeScheduled.length > 0 ? `${activeScheduled.length} queued` : 'Clear'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Sent */}
                      <div className="bg-[#1C1C1C] rounded-xl border border-[#2E2E2E] hover:border-[#3E3F3E] p-4 shadow-sm transition-all flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[11px] font-semibold text-[#8E8E8E] uppercase tracking-wider">Sent</span>
                          <div className="w-7 h-7 rounded-lg bg-[#54C750]/15 border border-[#54C750]/30 flex items-center justify-center text-[#54C750]">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                        </div>
                        <div>
                          <div className="text-2xl sm:text-3xl font-bold text-[#F0F2F0] tracking-tight mb-1 font-sans">
                            {loading ? '—' : sentCount}
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-[#757575] truncate">successfully delivered</span>
                            <span className="text-[10px] font-medium text-[#54C750] bg-[#54C750]/10 px-1.5 py-0.5 rounded border border-[#54C750]/20 shrink-0">
                              {sentCount > 0 ? 'Delivered' : 'Standing By'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Failed */}
                      <div className="bg-[#1C1C1C] rounded-xl border border-[#2E2E2E] hover:border-[#3E3F3E] p-4 shadow-sm transition-all flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[11px] font-semibold text-[#8E8E8E] uppercase tracking-wider">Failed</span>
                          <div className="w-7 h-7 rounded-lg bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400">
                            <XCircle className="w-4 h-4" />
                          </div>
                        </div>
                        <div>
                          <div className="text-2xl sm:text-3xl font-bold text-[#F0F2F0] tracking-tight mb-1 font-sans">
                            {loading ? '—' : failedCount}
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-[#757575] truncate">delivery error count</span>
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border shrink-0 ${
                              failedCount === 0
                                ? 'text-[#54C750] bg-[#54C750]/10 border-[#54C750]/20'
                                : 'text-red-400 bg-red-500/10 border-red-500/20'
                            }`}>
                              {failedCount === 0 ? 'Zero errors' : `${failedCount} failed`}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Success Rate */}
                      <div className="bg-[#1C1C1C] rounded-xl border border-[#2E2E2E] hover:border-[#3E3F3E] p-4 shadow-sm transition-all flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[11px] font-semibold text-[#8E8E8E] uppercase tracking-wider">Success Rate</span>
                          <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                            <TrendingUp className="w-4 h-4" />
                          </div>
                        </div>
                        <div>
                          <div className="text-2xl sm:text-3xl font-bold text-[#F0F2F0] tracking-tight mb-1 font-sans">
                            {loading ? '—' : `${successRate}%`}
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-[#757575] truncate">overall delivery rate</span>
                            <span className="text-[10px] font-medium text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 shrink-0">
                              Target 99%+
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Integrated Telemetry Pipeline Strip */}
                    {queueStats && (
                      <div className="bg-[#1C1C1C] rounded-xl border border-[#2E2E2E] p-3.5 flex items-center justify-between flex-wrap gap-3">
                        <div className="flex items-center gap-2">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#54C750] opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#54C750]"></span>
                          </span>
                          <span className="text-xs font-semibold text-[#8E8E8E] uppercase tracking-wider">
                            BullMQ Engine Pipeline:
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <QueuePill label="Waiting"   value={queueStats.waiting}   color="bg-yellow-400" />
                          <QueuePill label="Active"    value={queueStats.active}    color="bg-blue-400" />
                          <QueuePill label="Delayed"   value={queueStats.delayed}   color="bg-purple-400" />
                          <QueuePill label="Completed" value={queueStats.completed} color="bg-[#54C750]" />
                          <QueuePill label="Failed"    value={queueStats.failed}    color="bg-red-400" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Recent Activity inside the container */}
                  <div className="bg-[#161616] rounded-2xl border border-[#2E2E2E] shadow-sm overflow-hidden flex flex-col flex-1 min-h-[260px]">
                    <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#2E2E2E] bg-[#1a1a1a] flex-shrink-0">
                      <div>
                        <h3 className="text-sm font-semibold text-[#F0F2F0]">Recent Activity</h3>
                        <p className="text-[11px] text-[#707070] mt-0.5">Latest 7 email jobs across all campaigns</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFolder('sent')}
                        className="text-xs text-[#54C750] hover:text-[#46af42] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        View All <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto divide-y divide-[#2E2E2E]/80 min-h-0">
                      {loading ? (
                        <div className="p-6 space-y-3">
                          {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-10 rounded-xl" />)}
                        </div>
                      ) : allJobs.filter(j => !j.isDeleted).length === 0 ? (
                        <div className="py-12 px-6 flex flex-col items-center justify-center text-center">
                          <div className="w-12 h-12 rounded-2xl bg-[#54C750]/15 text-[#54C750] border border-[#54C750]/30 flex items-center justify-center mb-3 shadow-sm">
                            <Mail className="w-5 h-5" />
                          </div>
                          <h3 className="text-sm font-bold text-[#F0F2F0] mb-1">No Activity Recorded Yet</h3>
                          <p className="text-xs text-[#707070] max-w-sm mb-4">Click "New Campaign" above to schedule your first email campaign and track delivery progress in real-time.</p>
                          <button
                            type="button"
                            onClick={() => setComposeOpen(true)}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-full bg-[#54C750] hover:bg-[#46af42] text-[#060C06] shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_4px_12px_rgba(84,199,80,0.2)] transition-all cursor-pointer"
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
                    </div>
                  </div>
                </div>
              </Section>
            </div>
          )}

          {/* ── SCHEDULED ────────────────────────────────────────────────── */}
          {!esResults && folder === 'scheduled' && (
            <div className="flex-1 flex flex-col min-h-0 animate-fadein">
              <Section
                className="flex-1 min-h-0"
                title="Scheduled Emails"
                subtitle={`${activeScheduled.length} email${activeScheduled.length !== 1 ? 's' : ''} waiting to be dispatched`}
                action={
                  <button
                    type="button"
                    onClick={() => setComposeOpen(true)}
                    className="flex items-center gap-1.5 text-sm text-[#54C750] hover:text-[#46af42] font-semibold cursor-pointer"
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
            <div className="flex-1 flex flex-col min-h-0 animate-fadein">
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
            <div className="flex-1 flex flex-col min-h-0 animate-fadein">
              <Section
                className="flex-1 min-h-0"
                title="Starred Emails"
                subtitle={`${starred.length} starred email${starred.length !== 1 ? 's' : ''}`}
              >
                {starred.length === 0 ? (
                  <RichEmptyState
                    icon={<Star className="w-9 h-9 text-amber-400 fill-amber-400" />}
                    badge="Priority Inbox"
                    badgeColor="bg-amber-500/15 text-amber-300 border-amber-500/30"
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
            <div className="flex-1 flex flex-col min-h-0 animate-fadein">
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
                      className="text-xs text-red-400 hover:text-red-300 font-semibold border border-red-500/30 px-3 py-1.5 rounded-lg hover:bg-red-500/15 transition-colors cursor-pointer"
                    >
                      Empty Trash
                    </button>
                  ) : undefined
                }
              >
                {trash.length === 0 ? (
                  <RichEmptyState
                    icon={<Trash2 className="w-9 h-9 text-zinc-400" />}
                    badge="Recycle Bin Empty"
                    badgeColor="bg-[#262626] text-zinc-300 border-[#3E3F3E]"
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
            <div className="flex-1 flex flex-col min-h-0 animate-fadein">
              <Section
                className="flex-1 min-h-0"
                title="Configured Senders"
                subtitle={`${senders.length} active SMTP mail sender${senders.length === 1 ? '' : 's'} configured for campaign dispatch`}
                action={
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setAddSenderOpen(true)}
                      className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-[#54C750] hover:bg-[#46af42] text-[#060C06] shadow-lg shadow-[#54C750]/20 cursor-pointer transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Sender
                    </button>
                    <button
                      type="button"
                      onClick={() => setComposeOpen(true)}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border border-[#3E3F3E] bg-[#282828] hover:bg-[#333333] text-[#F0F2F0] cursor-pointer transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> Compose Email
                    </button>
                  </div>
                }
              >
                {senders.length === 0 ? (
                  <RichEmptyState
                    icon={<Users className="w-9 h-9 text-[#54C750]" />}
                    badge="Sender Profiles"
                    badgeColor="bg-[#54C750]/15 text-[#54C750] border-[#54C750]/30"
                    title="No Sender Identities Registered"
                    description="Connect your own SMTP mailbox (Gmail, Outlook, Yahoo, or Custom SMTP) to deliver scheduled emails directly to recipients' inboxes."
                    actionText="Connect Sender Profile"
                    actionIcon={<Plus className="w-4 h-4" />}
                    onAction={() => setAddSenderOpen(true)}
                    features={[
                      {
                        icon: '📬',
                        title: 'Direct Inbox Delivery',
                        desc: 'Deliver outbound emails directly to recipients using your verified credentials.',
                      },
                      {
                        icon: '🔒',
                        title: 'AES-256 Encrypted',
                        desc: 'All SMTP app passwords are encrypted at rest with industry-standard AES-256.',
                      },
                      {
                        icon: '⚡',
                        title: 'Per-Sender Limits',
                        desc: 'Individual hourly rate limit counters tracked in Redis per account.',
                      },
                    ]}
                  />
                ) : (
                  <div className="divide-y divide-[#3E3F3E]">
                    {senders.map((s: any) => (
                      <div key={s.id} className="p-5 flex items-center justify-between gap-4 hover:bg-[#262626]/50 transition-colors">
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="w-11 h-11 rounded-2xl bg-[#54C750]/15 border border-[#54C750]/30 text-[#54C750] font-bold text-base flex items-center justify-center flex-shrink-0 shadow-sm shadow-[#54C750]/10">
                            {(s.name || s.email).charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <h3 className="font-semibold text-[#F0F2F0] text-sm truncate">{s.name}</h3>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-[#54C750]/15 text-[#54C750] border border-[#54C750]/30 font-medium">
                                {s.isVerified ? 'Verified' : 'Active'}
                              </span>
                            </div>
                            <p className="text-xs text-zinc-400 font-mono truncate">{s.email}</p>
                            <div className="flex items-center gap-3 text-[11px] text-[#5B5B5B] mt-1">
                              <span>SMTP Host: {s.smtpHost || 'Custom SMTP'}</span>
                              <span>· Port: {s.smtpPort || 587}</span>
                              {s.createdAt && <span>· Added: {format(new Date(s.createdAt), 'MMM d, yyyy')}</span>}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => setComposeOpen(true)}
                            className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-xl border border-[#3E3F3E] bg-[#282828] hover:bg-[#333333] text-[#F0F2F0] shadow-sm transition-colors cursor-pointer"
                          >
                            <Send className="w-3.5 h-3.5 text-[#54C750]" />
                            Send Mail
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteSender(s.id)}
                            className="p-2 text-zinc-400 hover:text-red-400 hover:bg-red-500/15 rounded-xl border border-transparent hover:border-red-500/30 transition-colors cursor-pointer"
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

          {/* ── PROFILE & SETTINGS TAB ────────────────────────────────────────── */}
          {!esResults && folder === 'profile' && (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <Section
                title="User Profile & Settings"
                subtitle="Manage your identity, active telemetry quotas, dispatch preferences, and security controls"
                action={
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleExportCampaigns}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border border-[#3E3F3E] bg-[#262626] hover:bg-[#333333] text-[#F0F2F0] shadow-sm transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-[#54C750]" />
                      Export Logs (JSON)
                    </button>
                    <button
                      type="button"
                      onClick={() => authSignOut()}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 shadow-sm transition-colors cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Sign Out
                    </button>
                  </div>
                }
              >
                <div className="p-6 space-y-6 overflow-y-auto">
                  
                  {/* Identity Card */}
                  <div className="bg-[#161616] rounded-2xl border border-[#2E2E2E] p-6 shadow-sm">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-6 border-b border-[#2E2E2E]">
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <div className="w-16 h-16 rounded-2xl bg-[#54C750]/20 border-2 border-[#54C750]/40 flex items-center justify-center text-[#54C750] font-bold text-2xl shadow-lg shadow-[#54C750]/10">
                            {avatarLetter}
                          </div>
                          <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-[#54C750] border-2 border-[#161616] rounded-full shadow-sm" title="Active Session" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-lg font-bold text-[#F0F2F0]">{displayName}</h3>
                            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#54C750]/15 text-[#54C750] border border-[#54C750]/30">
                              Admin
                            </span>
                          </div>
                          <p className="text-xs text-zinc-400 font-mono flex items-center gap-2">
                            <span>{displayEmail}</span>
                            <span className="inline-flex items-center gap-1 text-[11px] text-[#54C750] bg-[#54C750]/10 px-2 py-0.5 rounded border border-[#54C750]/20 font-sans">
                              <CheckCircle2 className="w-3 h-3" /> Verified
                            </span>
                          </p>
                        </div>
                      </div>

                      {/* Display Name Edit Form */}
                      <form onSubmit={handleSaveProfile} className="flex items-center gap-2 w-full md:w-auto">
                        <div className="relative flex-1 md:w-64">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            placeholder="Update display name..."
                            className="w-full px-3 py-2 bg-[#1C1C1C] border border-[#2E2E2E] focus:border-[#54C750]/60 rounded-xl text-xs text-[#F0F2F0] placeholder-[#5B5B5B] focus:outline-none focus:ring-1 focus:ring-[#54C750]/50 transition-all font-sans"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={savingProfile || !editName.trim() || editName.trim() === displayName}
                          className="flex items-center gap-1.5 px-4 py-2 bg-[#54C750] hover:bg-[#48b344] disabled:bg-[#282828] disabled:text-[#5B5B5B] disabled:border-[#3E3F3E] text-[#060C06] font-semibold text-xs rounded-xl shadow-sm transition-all cursor-pointer disabled:cursor-not-allowed flex-shrink-0"
                        >
                          <Save className="w-3.5 h-3.5" />
                          {savingProfile ? 'Saving...' : 'Save Name'}
                        </button>
                      </form>
                    </div>

                    {/* Metadata details grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-4">
                      {/* Email Tile */}
                      <div className="bg-[#1C1C1C] rounded-xl border border-[#2E2E2E] p-3 flex items-center justify-between">
                        <div className="min-w-0 pr-2">
                          <p className="text-[10px] font-semibold text-[#8E8E8E] uppercase tracking-wider mb-0.5">Primary Email</p>
                          <p className="text-xs text-[#F0F2F0] font-mono truncate">{displayEmail}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(displayEmail, 'email')}
                          className="p-1.5 text-zinc-400 hover:text-[#54C750] hover:bg-[#2E2E2E] rounded-lg transition-colors cursor-pointer flex-shrink-0"
                          title="Copy Email"
                        >
                          {copiedEmail ? <Check className="w-3.5 h-3.5 text-[#54C750]" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>

                      {/* UID Tile */}
                      <div className="bg-[#1C1C1C] rounded-xl border border-[#2E2E2E] p-3 flex items-center justify-between">
                        <div className="min-w-0 pr-2">
                          <p className="text-[10px] font-semibold text-[#8E8E8E] uppercase tracking-wider mb-0.5">Firebase UID</p>
                          <p className="text-xs text-[#F0F2F0] font-mono truncate">{firebaseUser?.uid || 'N/A'}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(firebaseUser?.uid || '', 'uid')}
                          className="p-1.5 text-zinc-400 hover:text-[#54C750] hover:bg-[#2E2E2E] rounded-lg transition-colors cursor-pointer flex-shrink-0"
                          title="Copy UID"
                        >
                          {copiedUid ? <Check className="w-3.5 h-3.5 text-[#54C750]" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>

                      {/* Security Tier Tile */}
                      <div className="bg-[#1C1C1C] rounded-xl border border-[#2E2E2E] p-3 flex items-center justify-between">
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold text-[#8E8E8E] uppercase tracking-wider mb-0.5">Security Vault</p>
                          <div className="flex items-center gap-1.5 text-xs text-[#54C750] font-medium">
                            <Shield className="w-3.5 h-3.5" />
                            <span>AES-256 GCM Encrypted</span>
                          </div>
                        </div>
                        <span className="text-[10px] text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700">Protected</span>
                      </div>
                    </div>
                  </div>

                  {/* Telemetry & Quota Gauges */}
                  <div className="bg-[#161616] rounded-2xl border border-[#2E2E2E] p-6 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-[#54C750]/15 flex items-center justify-center text-[#54C750]">
                          <Activity className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-[#F0F2F0]">Telemetry & Tier Quotas</h4>
                          <p className="text-[11px] text-[#8E8E8E]">Current usage limits across your Mailzy dispatcher engine</p>
                        </div>
                      </div>
                      <span className="text-xs font-mono text-[#54C750] bg-[#54C750]/10 border border-[#54C750]/20 px-2.5 py-1 rounded-lg">
                        Standard Pro Plan
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {/* Daily Send Limit */}
                      <div className="bg-[#1C1C1C] rounded-xl border border-[#2E2E2E] p-4 flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-semibold text-[#8E8E8E] uppercase tracking-wider">Daily Send Quota</span>
                          <span className="text-xs font-mono text-[#F0F2F0] font-semibold">{activeSent.length} / 500</span>
                        </div>
                        <div className="w-full bg-[#2E2E2E] h-2 rounded-full overflow-hidden mb-2">
                          <div
                            className="bg-[#54C750] h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, Math.round((activeSent.length / 500) * 100))}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-[#5B5B5B]">Resets every 24h at 00:00 UTC</span>
                      </div>

                      {/* Active Senders */}
                      <div className="bg-[#1C1C1C] rounded-xl border border-[#2E2E2E] p-4 flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] font-semibold text-[#8E8E8E] uppercase tracking-wider">SMTP Senders</span>
                          <Users className="w-4 h-4 text-[#54C750]" />
                        </div>
                        <div className="text-2xl font-bold text-[#F0F2F0] font-mono">{senders.length} <span className="text-xs font-normal text-zinc-400">/ 10 max</span></div>
                        <span className="text-[10px] text-[#54C750]">Direct inbox authentication</span>
                      </div>

                      {/* Elasticsearch Cluster */}
                      <div className="bg-[#1C1C1C] rounded-xl border border-[#2E2E2E] p-4 flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] font-semibold text-[#8E8E8E] uppercase tracking-wider">Search Cluster</span>
                          <div className="flex h-2 w-2 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#54C750] opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#54C750]" />
                          </div>
                        </div>
                        <div className="text-sm font-bold text-[#F0F2F0] flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-[#54C750]" /> In-Sync
                        </div>
                        <span className="text-[10px] text-[#5B5B5B]">Elasticsearch 8.x indexing active</span>
                      </div>

                      {/* BullMQ Engine */}
                      <div className="bg-[#1C1C1C] rounded-xl border border-[#2E2E2E] p-4 flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] font-semibold text-[#8E8E8E] uppercase tracking-wider">BullMQ Engine</span>
                          <Cpu className="w-4 h-4 text-[#54C750]" />
                        </div>
                        <div className="text-sm font-bold text-[#F0F2F0] flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-[#54C750]" /> Concurrency: 5
                        </div>
                        <span className="text-[10px] text-[#5B5B5B]">Redis delayed-job scheduling</span>
                      </div>
                    </div>
                  </div>

                  {/* Data Management & Session Actions */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Backup Card */}
                    <div className="bg-[#161616] rounded-2xl border border-[#2E2E2E] p-6 shadow-sm flex flex-col justify-between space-y-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Download className="w-4 h-4 text-[#54C750]" />
                          <h4 className="text-sm font-semibold text-[#F0F2F0]">Backup & Export Workspace</h4>
                        </div>
                        <p className="text-[11px] text-zinc-400">
                          Export complete campaign history, scheduled queues, configured senders, and queue metrics to a single structured JSON archive.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleExportCampaigns}
                        className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl border border-[#3E3F3E] bg-[#262626] hover:bg-[#333333] text-[#F0F2F0] text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5 text-[#54C750]" />
                        Export Workspace Backup (.json)
                      </button>
                    </div>

                    {/* Danger / Maintenance Card */}
                    <div className="bg-[#161616] rounded-2xl border border-red-500/20 p-6 shadow-sm flex flex-col justify-between space-y-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Trash2 className="w-4 h-4 text-red-400" />
                          <h4 className="text-sm font-semibold text-[#F0F2F0]">Storage & Account Maintenance</h4>
                        </div>
                        <p className="text-[11px] text-zinc-400">
                          Permanently empty trashed campaign drafts or cleanly terminate your current browser session.
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={handleEmptyTrash}
                          disabled={trash.length === 0}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 disabled:bg-[#1C1C1C] disabled:border-[#2E2E2E] disabled:text-[#5B5B5B] text-red-400 text-xs font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Empty Trash ({trash.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => authSignOut()}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-[#3E3F3E] bg-[#262626] hover:bg-[#333333] text-[#F0F2F0] text-xs font-semibold transition-colors cursor-pointer"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          Sign Out
                        </button>
                      </div>
                    </div>
                  </div>

                </div>
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

      {/* ── ADD SENDER MODAL ────────────────────────────────────────────────── */}
      {addSenderOpen && (
        <AddSenderModal
          onClose={() => setAddSenderOpen(false)}
          onSuccess={() => {
            setAddSenderOpen(false);
            fetchData();
          }}
        />
      )}
    </div>
  );
}
