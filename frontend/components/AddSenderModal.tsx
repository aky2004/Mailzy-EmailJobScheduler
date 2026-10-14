'use client';

import { useState } from 'react';
import { X, Loader2, CheckCircle2, XCircle, ChevronDown, Mail, Lock, Server } from 'lucide-react';
import { sendersApi } from '@/lib/api';
import toast from 'react-hot-toast';

const PRESETS = [
  { label: 'Gmail / Google Workspace', host: 'smtp.gmail.com', port: 465, secure: true, hint: 'Use your Gmail address and a 16-character App Password from Google Account → Security → App Passwords.' },
  { label: 'Outlook / Office 365', host: 'smtp-mail.outlook.com', port: 587, secure: false, hint: 'Use your Outlook email and App Password from Microsoft Account → Security.' },
  { label: 'Yahoo Mail', host: 'smtp.mail.yahoo.com', port: 465, secure: true, hint: 'Use your Yahoo email and an App Password from Yahoo Account → Security.' },
  { label: 'Custom SMTP', host: '', port: 587, secure: false, hint: 'Enter your SMTP server details manually.' },
];

interface AddSenderModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function AddSenderModal({ onClose, onSuccess }: AddSenderModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [smtpHost, setSmtpHost] = useState('smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState(465);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpSecure, setSmtpSecure] = useState(true);
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const applyPreset = (idx: number) => {
    setSelectedPreset(idx);
    const p = PRESETS[idx];
    if (p.host) setSmtpHost(p.host);
    setSmtpPort(p.port);
    setSmtpSecure(p.secure);
    setTestResult(null);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await sendersApi.testConnection({ smtpHost, smtpPort, smtpUser, smtpPass, smtpSecure });
      setTestResult(result);
      if (result.success) toast.success('SMTP connection verified!');
      else toast.error(result.error || 'Connection failed');
    } catch {
      setTestResult({ success: false, error: 'Network error' });
      toast.error('Failed to test connection');
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !email.trim() || !smtpHost.trim() || !smtpUser.trim() || !smtpPass.trim()) {
      toast.error('Please fill in all fields');
      return;
    }
    setSaving(true);
    try {
      const res = await sendersApi.create({ name, email, smtpHost, smtpPort, smtpUser, smtpPass, smtpSecure });
      if (res.verified) {
        toast.success('Sender added & verified!');
      } else {
        toast.success(`Sender saved. Verification: ${res.verifyError || 'pending'}`);
      }
      onSuccess();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to add sender');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fadein">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Add SMTP Sender</h2>
            <p className="text-xs text-slate-400 mt-0.5">Configure your email mailbox for campaign dispatch</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Provider Presets */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Email Provider</label>
            <div className="grid grid-cols-2 gap-2">
              {PRESETS.map((p, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => applyPreset(i)}
                  className={`text-left px-3 py-2.5 rounded-xl border text-sm font-medium transition-all cursor-pointer ${
                    selectedPreset === i
                      ? 'border-emerald-400 bg-emerald-50 text-emerald-700 shadow-sm'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">{PRESETS[selectedPreset].hint}</p>
          </div>

          {/* Sender Identity */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Display Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="John Doe"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">From Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="john@gmail.com"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
              />
            </div>
          </div>

          {/* SMTP Config */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-semibold text-slate-500 mb-1 block">SMTP Host</label>
              <div className="relative">
                <Server className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={smtpHost}
                  onChange={e => setSmtpHost(e.target.value)}
                  placeholder="smtp.gmail.com"
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Port</label>
              <input
                type="number"
                value={smtpPort}
                onChange={e => setSmtpPort(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
              />
            </div>
          </div>

          {/* Credentials */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">SMTP Username</label>
              <div className="relative">
                <Mail className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={smtpUser}
                  onChange={e => setSmtpUser(e.target.value)}
                  placeholder="john@gmail.com"
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">App Password</label>
              <div className="relative">
                <Lock className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  value={smtpPass}
                  onChange={e => setSmtpPass(e.target.value)}
                  placeholder="xxxx xxxx xxxx xxxx"
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                />
              </div>
            </div>
          </div>

          {/* SSL Toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSmtpSecure(!smtpSecure)}
              className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${smtpSecure ? 'bg-emerald-500' : 'bg-slate-300'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${smtpSecure ? 'translate-x-5' : ''}`} />
            </button>
            <span className="text-sm text-slate-600">SSL/TLS ({smtpSecure ? 'Port 465' : 'STARTTLS Port 587'})</span>
          </div>

          {/* Test Result */}
          {testResult && (
            <div className={`flex items-center gap-2 p-3 rounded-xl text-sm font-medium ${
              testResult.success
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {testResult.success ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              {testResult.success ? 'Connection verified successfully' : testResult.error || 'Connection failed'}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl">
          <button
            type="button"
            onClick={handleTest}
            disabled={testing || !smtpHost || !smtpUser || !smtpPass}
            className="flex items-center gap-2 text-sm font-semibold text-slate-600 px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Server className="w-4 h-4" />}
            Test Connection
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-sm font-medium text-slate-500 px-4 py-2 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !name || !email || !smtpHost || !smtpUser || !smtpPass}
              className="flex items-center gap-2 text-sm font-semibold bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2 rounded-xl shadow-sm shadow-emerald-500/25 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Sender
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
