'use client';

import { useState, useRef, useCallback } from 'react';
import { X, Upload, Users, Clock, Mail, FileText, ChevronRight, ChevronLeft, Loader2, Plus } from 'lucide-react';
import type { Sender, CreateCampaignPayload, Recipient } from '@/lib/types';
import { campaignsApi, sendersApi } from '@/lib/api';
import Papa from 'papaparse';
import toast from 'react-hot-toast';

interface ComposeModalProps {
  senders: Sender[];
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 1 | 2 | 3;

function parseEmailsFromCSV(file: File): Promise<Recipient[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const recipients: Recipient[] = [];
        for (const row of results.data) {
          // Look for email column (case-insensitive)
          const emailKey = Object.keys(row).find((k) =>
            k.toLowerCase().includes('email')
          );
          const nameKey = Object.keys(row).find((k) =>
            k.toLowerCase().includes('name')
          );
          const email = emailKey ? row[emailKey]?.trim() : null;
          const name = nameKey ? row[nameKey]?.trim() : undefined;
          if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            recipients.push({ email, name });
          }
        }
        resolve(recipients);
      },
      error: reject,
    });
  });
}

function parseEmailsFromText(text: string): Recipient[] {
  const emailRegex = /[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+/g;
  const matches = text.match(emailRegex) ?? [];
  const seen = new Set<string>();
  return matches
    .filter((e) => {
      const lower = e.toLowerCase();
      if (seen.has(lower)) return false;
      seen.add(lower);
      return true;
    })
    .map((email) => ({ email }));
}

export function ComposeModal({ senders, onClose, onSuccess }: ComposeModalProps) {
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [creatingSender, setCreatingSender] = useState(false);
  const [availableSenders, setAvailableSenders] = useState(senders);

  // Form state
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [rawEmailInput, setRawEmailInput] = useState('');
  const [selectedSenderId, setSelectedSenderId] = useState(senders[0]?.id ?? '');
  const [scheduledAt, setScheduledAt] = useState('');
  const [delayBetweenMs, setDelayBetweenMs] = useState(2000);
  const [hourlyLimit, setHourlyLimit] = useState(100);
  const [fileName, setFileName] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback(async (file: File) => {
    setFileName(file.name);
    try {
      const parsed = await parseEmailsFromCSV(file);
      if (parsed.length === 0) {
        toast.error('No valid email addresses found in file');
        return;
      }
      setRecipients(parsed);
      toast.success(`Found ${parsed.length} email addresses`);
    } catch (err) {
      toast.error('Failed to parse file');
    }
  }, []);

  const handleTextEmailParse = () => {
    const parsed = parseEmailsFromText(rawEmailInput);
    if (parsed.length === 0) {
      toast.error('No valid emails detected');
      return;
    }
    setRecipients(parsed);
    toast.success(`Detected ${parsed.length} email addresses`);
  };

  const handleCreateSender = async () => {
    setCreatingSender(true);
    try {
      const { sender } = await sendersApi.create({ name: 'New Sender' });
      setAvailableSenders((prev) => [...prev, sender]);
      setSelectedSenderId(sender.id);
      toast.success(`Created sender: ${sender.email}`);
    } catch {
      toast.error('Failed to create sender');
    } finally {
      setCreatingSender(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedSenderId) { toast.error('Please select a sender'); return; }
    if (!subject.trim()) { toast.error('Subject is required'); return; }
    if (!body.trim()) { toast.error('Body is required'); return; }
    if (recipients.length === 0) { toast.error('At least 1 recipient required'); return; }
    if (!scheduledAt) { toast.error('Scheduled time is required'); return; }
    if (new Date(scheduledAt) < new Date()) { toast.error('Schedule time must be in the future'); return; }

    setLoading(true);
    try {
      const payload: CreateCampaignPayload = {
        senderId: selectedSenderId,
        subject,
        body,
        recipients,
        scheduledAt: new Date(scheduledAt).toISOString(),
        delayBetweenMs,
        hourlyLimit,
      };
      await campaignsApi.create(payload);
      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create campaign';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { num: 1, label: 'Content' },
    { num: 2, label: 'Recipients' },
    { num: 3, label: 'Schedule' },
  ];

  // Get tomorrow as default min datetime
  const minDateTime = new Date(Date.now() + 60000).toISOString().slice(0, 16);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 cursor-pointer"
        style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-2xl glass-elevated rounded-2xl overflow-hidden animate-fadein"
        style={{ maxHeight: '90vh', boxShadow: '0 25px 80px rgba(0,0,0,0.5)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, var(--accent), #a78bfa)' }}
            >
              <Mail className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              Compose Campaign
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
            style={{ color: 'var(--text-muted)' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator */}
        <div
          className="flex items-center px-6 py-3 gap-2"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}
        >
          {steps.map((s, i) => (
            <div key={s.num} className="flex items-center gap-2">
              <div
                className="flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold transition-all"
                style={{
                  background: step >= s.num ? 'var(--accent)' : 'var(--bg-elevated)',
                  color: step >= s.num ? 'white' : 'var(--text-muted)',
                }}
              >
                {s.num}
              </div>
              <span
                className="text-xs font-medium"
                style={{ color: step >= s.num ? 'var(--text-primary)' : 'var(--text-muted)' }}
              >
                {s.label}
              </span>
              {i < steps.length - 1 && (
                <div className="w-8 h-px mx-1" style={{ background: 'var(--border)' }} />
              )}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-6" style={{ maxHeight: 'calc(90vh - 180px)' }}>
          {/* Step 1: Content */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Subject *
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Your campaign subject line..."
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Email Body *
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Write your email body here (HTML supported)..."
                  rows={8}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all font-mono resize-y"
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                    minHeight: '160px',
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
                />
                <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
                  HTML is supported. Use {'<b>, <i>, <a href="...">'} etc.
                </p>
              </div>
            </div>
          )}

          {/* Step 2: Recipients */}
          {step === 2 && (
            <div className="space-y-5">
              {/* File upload */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Upload CSV / Text file
                </label>
                <div
                  className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all hover:border-indigo-500"
                  style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files[0];
                    if (file) handleFileUpload(file);
                  }}
                >
                  <Upload className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--accent-light)' }} />
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {fileName || 'Drop CSV here or click to browse'}
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    Column named "email" will be parsed automatically
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                />
              </div>

              {/* Or paste emails */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  — or paste email addresses
                </label>
                <textarea
                  value={rawEmailInput}
                  onChange={(e) => setRawEmailInput(e.target.value)}
                  placeholder="john@example.com, jane@example.com..."
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all resize-none"
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
                />
                <button
                  onClick={handleTextEmailParse}
                  className="mt-2 text-xs px-3 py-1.5 rounded-lg transition-colors"
                  style={{
                    background: 'rgba(99,102,241,0.15)',
                    color: 'var(--accent-light)',
                    border: '1px solid rgba(99,102,241,0.2)',
                  }}
                >
                  Parse Emails
                </button>
              </div>

              {/* Preview count */}
              {recipients.length > 0 && (
                <div
                  className="flex items-center gap-3 px-4 py-3 rounded-xl"
                  style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}
                >
                  <Users className="w-5 h-5" style={{ color: 'var(--success)' }} />
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--success)' }}>
                      {recipients.length} recipients detected
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {recipients.slice(0, 3).map((r) => r.email).join(', ')}
                      {recipients.length > 3 && ` +${recipients.length - 3} more`}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Schedule */}
          {step === 3 && (
            <div className="space-y-5">
              {/* Sender */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Sender *
                </label>
                {availableSenders.length === 0 ? (
                  <div className="flex items-center gap-3">
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No senders configured.</p>
                    <button
                      onClick={handleCreateSender}
                      disabled={creatingSender}
                      className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg"
                      style={{ background: 'rgba(99,102,241,0.15)', color: 'var(--accent-light)' }}
                    >
                      {creatingSender ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                      Create Ethereal Sender
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {availableSenders.map((sender) => (
                      <label
                        key={sender.id}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all"
                        style={{
                          background: selectedSenderId === sender.id ? 'rgba(99,102,241,0.12)' : 'var(--bg-elevated)',
                          border: `1px solid ${selectedSenderId === sender.id ? 'rgba(99,102,241,0.4)' : 'var(--border)'}`,
                        }}
                      >
                        <input
                          type="radio"
                          name="sender"
                          value={sender.id}
                          checked={selectedSenderId === sender.id}
                          onChange={() => setSelectedSenderId(sender.id)}
                          className="hidden"
                        />
                        <div
                          className="w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all"
                          style={{
                            borderColor: selectedSenderId === sender.id ? 'var(--accent)' : 'var(--text-muted)',
                          }}
                        >
                          {selectedSenderId === sender.id && (
                            <div className="w-2 h-2 rounded-full" style={{ background: 'var(--accent)' }} />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{sender.name}</p>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{sender.email}</p>
                        </div>
                      </label>
                    ))}
                    <button
                      onClick={handleCreateSender}
                      disabled={creatingSender}
                      className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg mt-1"
                      style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--accent-light)' }}
                    >
                      {creatingSender ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                      Add New Sender
                    </button>
                  </div>
                )}
              </div>

              {/* Start time */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Start Time *
                </label>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  min={minDateTime}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                    colorScheme: 'dark',
                  }}
                />
              </div>

              {/* Delay */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Delay Between Emails: <span style={{ color: 'var(--accent-light)' }}>{delayBetweenMs / 1000}s</span>
                </label>
                <input
                  type="range"
                  min={1000}
                  max={60000}
                  step={500}
                  value={delayBetweenMs}
                  onChange={(e) => setDelayBetweenMs(Number(e.target.value))}
                  className="w-full"
                  style={{ accentColor: 'var(--accent)' }}
                />
                <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  <span>1s</span><span>60s</span>
                </div>
              </div>

              {/* Hourly limit */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Hourly Limit: <span style={{ color: 'var(--accent-light)' }}>{hourlyLimit} emails/hr</span>
                </label>
                <input
                  type="range"
                  min={1}
                  max={500}
                  step={1}
                  value={hourlyLimit}
                  onChange={(e) => setHourlyLimit(Number(e.target.value))}
                  className="w-full"
                  style={{ accentColor: 'var(--accent)' }}
                />
                <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  <span>1/hr</span><span>500/hr</span>
                </div>
              </div>

              {/* Summary */}
              <div
                className="rounded-xl p-4 space-y-2"
                style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)' }}
              >
                <h4 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--accent-light)' }}>
                  Campaign Summary
                </h4>
                {[
                  ['Recipients', recipients.length.toString()],
                  ['Subject', subject || '—'],
                  ['Sender', availableSenders.find((s) => s.id === selectedSenderId)?.email || '—'],
                  ['Delay', `${delayBetweenMs / 1000}s between sends`],
                  ['Rate Limit', `${hourlyLimit}/hr per sender`],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between text-sm">
                    <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                    <span className="font-medium truncate max-w-[200px]" style={{ color: 'var(--text-primary)' }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <button
            onClick={step === 1 ? onClose : () => setStep((s) => (s - 1) as Step)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={{
              background: 'var(--bg-elevated)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
            }}
          >
            {step > 1 && <ChevronLeft className="w-4 h-4" />}
            {step === 1 ? 'Cancel' : 'Back'}
          </button>

          {step < 3 ? (
            <button
              onClick={() => {
                if (step === 1 && (!subject.trim() || !body.trim())) {
                  toast.error('Subject and body are required');
                  return;
                }
                if (step === 2 && recipients.length === 0) {
                  toast.error('At least one recipient is required');
                  return;
                }
                setStep((s) => (s + 1) as Step);
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all hover:scale-105"
              style={{
                background: 'linear-gradient(135deg, var(--accent), #a78bfa)',
                color: 'white',
                boxShadow: '0 4px 12px var(--accent-glow)',
              }}
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all hover:scale-105 disabled:opacity-50"
              style={{
                background: 'linear-gradient(135deg, var(--accent), #a78bfa)',
                color: 'white',
                boxShadow: '0 4px 12px var(--accent-glow)',
              }}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              {loading ? 'Scheduling...' : 'Schedule Campaign'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
