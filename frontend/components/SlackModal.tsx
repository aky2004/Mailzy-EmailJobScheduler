'use client';

import { useState, useEffect } from 'react';
import { X, CheckCircle2, AlertTriangle, Send, Link2, Unlink, Bell, ExternalLink } from 'lucide-react';
import { slackApi } from '@/lib/api';
import { auth } from '@/lib/firebase';
import toast from 'react-hot-toast';

interface SlackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStatusChange?: () => void;
}

export function SlackModal({ isOpen, onClose, onStatusChange }: SlackModalProps) {
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<{
    connected: boolean;
    teamName?: string;
    channelName?: string;
    webhookUrl?: string;
  } | null>(null);

  const [webhookUrl, setWebhookUrl] = useState('');
  const [channelName, setChannelName] = useState('#email-alerts');

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const data = await slackApi.getStatus();
      setStatus(data);
    } catch (err) {
      console.error('Failed to fetch Slack status', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleOAuthConnect = async () => {
    const user = auth.currentUser;
    if (!user) {
      toast.error('You must be logged in to connect Slack');
      return;
    }
    const token = await user.getIdToken();
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    window.location.href = `${apiUrl}/api/slack/auth?token=${encodeURIComponent(token)}`;
  };

  const handleSaveWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookUrl.trim()) {
      toast.error('Please enter a valid Slack Webhook URL');
      return;
    }

    try {
      setLoading(true);
      await slackApi.saveWebhook(webhookUrl.trim(), channelName.trim());
      toast.success('Slack webhook saved successfully!');
      setWebhookUrl('');
      await fetchStatus();
      if (onStatusChange) onStatusChange();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } }; message?: string };
      toast.error(error.response?.data?.error || error.message || 'Failed to save webhook');
    } finally {
      setLoading(false);
    }
  };

  const handleTestNotification = async () => {
    try {
      setTesting(true);
      const res = await slackApi.testNotification();
      toast.success(res.message || 'Test alert sent to Slack!');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } }; message?: string };
      toast.error(error.response?.data?.error || error.message || 'Failed to send test alert');
    } finally {
      setTesting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Slack notifications?')) return;
    try {
      setLoading(true);
      await slackApi.disconnect();
      toast.success('Slack disconnected');
      await fetchStatus();
      if (onStatusChange) onStatusChange();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } }; message?: string };
      toast.error(error.response?.data?.error || error.message || 'Failed to disconnect Slack');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadein">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#4A154B] flex items-center justify-center text-white font-bold text-base shadow-sm">
              #
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Slack Notifications</h2>
              <p className="text-xs text-slate-500">Real-time alerts when sender hourly rate limits are hit</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Status Banner */}
          <div className={`p-4 rounded-xl border flex items-start justify-between gap-3 ${
            status?.connected 
              ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900' 
              : 'bg-slate-50 border-slate-200 text-slate-700'
          }`}>
            <div className="flex items-start gap-3">
              {status?.connected ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              ) : (
                <Bell className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
              )}
              <div>
                <div className="font-semibold text-sm">
                  {status?.connected ? 'Slack Connected & Active' : 'Slack Not Connected'}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {status?.connected
                    ? `Posting alerts to ${status.teamName || 'Workspace'} (${status.channelName || '#alerts'})`
                    : 'Rate limit hits will silently delay jobs without sending chat alerts.'}
                </div>
              </div>
            </div>

            {status?.connected && (
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={loading}
                className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 font-medium px-2 py-1 rounded bg-red-50 hover:bg-red-100 border border-red-200 transition-colors cursor-pointer"
              >
                <Unlink className="w-3.5 h-3.5" />
                <span>Disconnect</span>
              </button>
            )}
          </div>

          {/* If Connected: Test notification action */}
          {status?.connected && (
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
              <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Live Verification
              </div>
              <p className="text-xs text-slate-500">
                Trigger a live message into your Slack channel to verify webhook delivery and alert formatting.
              </p>
              <button
                type="button"
                onClick={handleTestNotification}
                disabled={testing}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>{testing ? 'Sending Test Alert...' : 'Send Live Test Ping to Slack'}</span>
              </button>
            </div>
          )}

          {/* Connection Methods */}
          <div className="space-y-4">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              {status?.connected ? 'Update Connection' : 'Connect Slack'}
            </div>

            {/* Method 1: OAuth Flow */}
            <div className="border border-slate-200 rounded-xl p-4 space-y-2 hover:border-slate-300 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-slate-800">1-Click OAuth Authorization</span>
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-wider bg-purple-50 text-[#4A154B] px-2 py-0.5 rounded border border-purple-200">
                  OAuth 2.0
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Authorize the app to post directly into your Slack workspace using official OAuth.
              </p>
              <button
                type="button"
                onClick={handleOAuthConnect}
                className="mt-2 w-full flex items-center justify-center gap-2 py-2 px-3 border border-[#4A154B] text-[#4A154B] hover:bg-[#4A154B] hover:text-white rounded-lg text-xs font-semibold transition-all cursor-pointer"
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>Authorize with Slack OAuth</span>
              </button>
            </div>

            {/* Method 2: Custom Incoming Webhook */}
            <form onSubmit={handleSaveWebhook} className="border border-slate-200 rounded-xl p-4 space-y-3 hover:border-slate-300 transition-colors">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-slate-800">Custom Incoming Webhook URL</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
                  Direct Webhook
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Paste any custom Slack incoming webhook URL for instant delivery into your private or public channel.
              </p>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Webhook URL</label>
                <input
                  type="url"
                  placeholder="https://hooks.slack.com/services/T.../B.../..."
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  className="w-full text-xs font-mono px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Target Channel Name</label>
                <input
                  type="text"
                  placeholder="#email-alerts"
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
              >
                <span>Save Webhook</span>
              </button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            <span>Jobs are automatically delayed & retried on limit hit</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
