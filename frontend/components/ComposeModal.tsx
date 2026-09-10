'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { 
  X, Loader2, Bold, Italic, Underline, Strikethrough, 
  List, ListOrdered, Link, Code, Calendar, Send, CloudUpload,
  ChevronDown, Paperclip, Mail, RotateCcw
} from 'lucide-react';
import type { Sender, CreateCampaignPayload, Recipient } from '@/lib/types';
import { campaignsApi } from '@/lib/api';
import Papa from 'papaparse';
import toast from 'react-hot-toast';

const DRAFT_STORAGE_KEY = 'mailzy_compose_draft';

interface ComposeModalProps {
  senders: Sender[];
  onClose: () => void;
  onSuccess: () => void;
}

function parseEmailsFromCSV(file: File): Promise<Recipient[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const recipients: Recipient[] = [];
        for (const row of results.data) {
          const emailKey = Object.keys(row).find((k) => k.toLowerCase().includes('email'));
          const nameKey = Object.keys(row).find((k) => k.toLowerCase().includes('name'));
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
  const [loading, setLoading] = useState(false);
  
  // Form state
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [recipientInput, setRecipientInput] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  
  // Schedule state
  const [sendDate, setSendDate] = useState('');
  const [sendTime, setSendTime] = useState('');
  
  // Job Config
  const [delayBetweenMs, setDelayBetweenMs] = useState(2000);
  const [hourlyLimit, setHourlyLimit] = useState(100);
  const [selectedSenderId, setSelectedSenderId] = useState(senders[0]?.id ?? '');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  // Restore draft from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.subject) setSubject(parsed.subject);
        if (Array.isArray(parsed.recipients) && parsed.recipients.length > 0) setRecipients(parsed.recipients);
        if (parsed.sendDate) setSendDate(parsed.sendDate);
        if (parsed.sendTime) setSendTime(parsed.sendTime);
        if (parsed.delayBetweenMs) setDelayBetweenMs(parsed.delayBetweenMs);
        if (parsed.hourlyLimit) setHourlyLimit(parsed.hourlyLimit);
        if (parsed.selectedSenderId) setSelectedSenderId(parsed.selectedSenderId);
        if (parsed.body) {
          setBody(parsed.body);
          const el = document.getElementById('rich-editor');
          if (el) el.innerHTML = parsed.body;
        }
      }
    } catch {
      /* ignore invalid json */
    }
  }, []);

  // Auto-save draft helper
  const saveDraft = useCallback(() => {
    try {
      const html = document.getElementById('rich-editor')?.innerHTML || body;
      const draft = {
        subject,
        body: html,
        recipients,
        sendDate,
        sendTime,
        delayBetweenMs,
        hourlyLimit,
        selectedSenderId,
      };
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch {
      /* ignore storage errors */
    }
  }, [subject, body, recipients, sendDate, sendTime, delayBetweenMs, hourlyLimit, selectedSenderId]);

  // Keep draft updated
  useEffect(() => {
    saveDraft();
  }, [saveDraft]);

  // Handle escape key to close and save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        saveDraft();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveDraft, onClose]);

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      saveDraft();
      onClose();
    }
  };

  // Reset entire form
  const handleReset = () => {
    if (!confirm('Are you sure you want to reset and clear this compose draft?')) return;
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch { /* ignore */ }
    setSubject('');
    setBody('');
    setRecipients([]);
    setRecipientInput('');
    setAttachments([]);
    setSendDate('');
    setSendTime('');
    setDelayBetweenMs(2000);
    setHourlyLimit(100);
    const el = document.getElementById('rich-editor');
    if (el) el.innerHTML = '';
    toast.success('Compose container reset');
  };

  const handleFileUpload = useCallback(async (file: File) => {
    try {
      const parsed = await parseEmailsFromCSV(file);
      if (parsed.length === 0) {
        toast.error('No valid email addresses found in file');
        return;
      }
      setRecipients(prev => [...prev, ...parsed]);
      toast.success(`Added ${parsed.length} recipients`);
    } catch {
      toast.error('Failed to parse file');
    }
  }, []);

  const handleAttachmentUpload = (files: FileList | null) => {
    if (!files) return;
    const newFiles = Array.from(files);
    setAttachments(prev => [...prev, ...newFiles]);
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleRecipientKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
      e.preventDefault();
      const newRecipients = parseEmailsFromText(recipientInput);
      if (newRecipients.length > 0) {
        setRecipients(prev => [...prev, ...newRecipients]);
        setRecipientInput('');
      } else if (recipientInput.trim().length > 0) {
        toast.error('Invalid email address format');
      }
    }
  };

  const removeRecipient = (index: number) => {
    setRecipients(prev => prev.filter((_, i) => i !== index));
  };

  const handleFormat = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    const el = document.getElementById('rich-editor');
    if (el) el.focus();
  };

  const handleSubmit = async () => {
    if (!selectedSenderId) { toast.error('Please configure a sender in the dashboard first'); return; }
    if (!subject.trim()) { toast.error('Subject is required'); return; }
    
    const htmlBody = document.getElementById('rich-editor')?.innerHTML || '';
    if (!htmlBody.trim() || htmlBody === '<br>') { toast.error('Body is required'); return; }

    if (recipients.length === 0) { toast.error('At least 1 recipient required'); return; }
    if (!sendDate || !sendTime) { toast.error('Schedule date and time are required'); return; }

    const scheduledAt = new Date(`${sendDate}T${sendTime}`);
    if (scheduledAt < new Date()) { toast.error('Schedule time must be in the future'); return; }

    setLoading(true);
    try {
      const payload: CreateCampaignPayload = {
        senderId: selectedSenderId,
        subject,
        body: htmlBody,
        recipients,
        scheduledAt: scheduledAt.toISOString(),
        delayBetweenMs,
        hourlyLimit,
        hasAttachments: attachments.length > 0,
      };
      await campaignsApi.create(payload);
      try {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch { /* ignore */ }
      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create campaign';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/20 backdrop-blur-[2px] transition-all animate-fadein font-sans"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-4xl h-[84vh] max-h-[720px] min-h-[540px] rounded-2xl shadow-2xl border border-slate-200/80 flex flex-col overflow-hidden animate-fadein relative"
      >
        {/* TOP HEADER */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-100 shrink-0 bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs shadow-sm">
              <Mail className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 leading-none">Compose Campaign</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">Draft auto-saved locally</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-red-600 hover:bg-red-50 border border-slate-200 hover:border-red-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer shadow-sm"
              title="Reset and clear all inputs in this compose container"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset Form
            </button>
            <button
              type="button"
              onClick={() => {
                saveDraft();
                onClose();
              }}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              title="Close (auto-saves draft)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* MAIN CONTENT SPLIT */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* LEFT PANE - COMPOSER (Single Unified Scroll for To, Subject, Dynamic Body, and Attachments) */}
          <div className="flex-1 flex flex-col overflow-y-auto border-r border-slate-100 p-6 min-h-0 space-y-4">
            {/* To Field */}
            <div className="flex items-start border-b border-slate-100 pb-3">
              <div className="w-16 text-sm font-medium text-slate-500 pt-1 shrink-0">To:</div>
              <div className="flex-1 flex flex-wrap gap-1.5 items-center">
                {recipients.map((rec, i) => (
                  <div key={i} className="flex items-center gap-1.5 bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg text-xs font-medium border border-slate-200">
                    <span>{rec.email}</span>
                    <button type="button" onClick={() => removeRecipient(i)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <input 
                  type="text" 
                  value={recipientInput}
                  onChange={(e) => setRecipientInput(e.target.value)}
                  onKeyDown={handleRecipientKeyDown}
                  placeholder={recipients.length === 0 ? "Add recipients..." : "Add more..."}
                  className="flex-1 min-w-[160px] py-1 text-sm font-normal outline-none bg-transparent placeholder:text-slate-400 text-slate-800 font-sans"
                />
              </div>
              <button 
                type="button"
                onClick={() => csvInputRef.current?.click()}
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 ml-3 shrink-0 flex items-center gap-1 cursor-pointer bg-emerald-50 hover:bg-emerald-100/80 px-2.5 py-1 rounded-lg transition-colors mt-0.5"
                title="Import recipients from CSV"
              >
                <CloudUpload className="w-3.5 h-3.5" /> CSV
              </button>
              <input 
                type="file" 
                ref={csvInputRef} 
                className="hidden" 
                accept=".csv,.txt"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleFileUpload(e.target.files[0]);
                  e.target.value = '';
                }}
              />
            </div>

            {/* Subject Field */}
            <div className="flex items-center border-b border-slate-100 pb-3 shrink-0">
              <div className="w-16 text-sm font-medium text-slate-500 shrink-0">Subject:</div>
              <input 
                type="text" 
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Enter subject line..."
                className="flex-1 py-1 text-sm font-normal outline-none bg-transparent placeholder:text-slate-400 text-slate-800 font-sans"
                maxLength={100}
              />
              <div className="text-[11px] font-medium text-slate-400 ml-3 shrink-0">{subject.length}/100</div>
            </div>

            {/* Editor & Attachments Merged Container (Expands Dynamically) */}
            <div className="w-full flex flex-col border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white shrink-0">
              {/* Toolbar */}
              <div className="flex items-center gap-1 p-1.5 border-b border-slate-100 bg-slate-50/70 flex-wrap shrink-0">
                <button type="button" className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200 rounded transition-colors mr-1">
                  Normal Text <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>
                <div className="w-px h-4 bg-slate-300 mx-1"></div>
                <button type="button" onClick={() => handleFormat('bold')} className="p-1 text-slate-600 hover:bg-slate-200 rounded transition-colors cursor-pointer" title="Bold"><Bold className="w-3.5 h-3.5" /></button>
                <button type="button" onClick={() => handleFormat('italic')} className="p-1 text-slate-600 hover:bg-slate-200 rounded transition-colors cursor-pointer" title="Italic"><Italic className="w-3.5 h-3.5" /></button>
                <button type="button" onClick={() => handleFormat('underline')} className="p-1 text-slate-600 hover:bg-slate-200 rounded transition-colors cursor-pointer" title="Underline"><Underline className="w-3.5 h-3.5" /></button>
                <button type="button" onClick={() => handleFormat('strikeThrough')} className="p-1 text-slate-600 hover:bg-slate-200 rounded transition-colors cursor-pointer" title="Strikethrough"><Strikethrough className="w-3.5 h-3.5" /></button>
                <div className="w-px h-4 bg-slate-300 mx-1"></div>
                <button type="button" onClick={() => handleFormat('insertUnorderedList')} className="p-1 text-slate-600 hover:bg-slate-200 rounded transition-colors cursor-pointer" title="Bullet List"><List className="w-3.5 h-3.5" /></button>
                <button type="button" onClick={() => handleFormat('insertOrderedList')} className="p-1 text-slate-600 hover:bg-slate-200 rounded transition-colors cursor-pointer" title="Numbered List"><ListOrdered className="w-3.5 h-3.5" /></button>
                <div className="w-px h-4 bg-slate-300 mx-1"></div>
                <button type="button" onClick={() => {
                  const url = prompt('Enter link URL:');
                  if (url) handleFormat('createLink', url);
                }} className="p-1 text-slate-600 hover:bg-slate-200 rounded transition-colors cursor-pointer" title="Insert Link"><Link className="w-3.5 h-3.5" /></button>
                <button type="button" onClick={() => handleFormat('formatBlock', 'PRE')} className="p-1 text-slate-600 hover:bg-slate-200 rounded transition-colors cursor-pointer" title="Insert Code Block"><Code className="w-3.5 h-3.5" /></button>
                <div className="flex-1"></div>
                <button type="button" className="flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-600 text-xs font-semibold rounded hover:bg-emerald-100 transition-colors">
                  <span className="font-mono">{'{}'}</span> Variables
                </button>
              </div>
              
              {/* Rich Text Editor Area - Dynamic Height with fixed width & wrap */}
              <div 
                id="rich-editor"
                contentEditable
                className="w-full max-w-full min-h-[180px] p-4 text-sm font-normal text-slate-800 font-sans outline-none leading-relaxed focus:ring-0 break-words whitespace-pre-wrap [overflow-wrap:anywhere] overflow-x-hidden [&>ul]:list-disc [&>ul]:ml-4 [&>ol]:list-decimal [&>ol]:ml-4 [&_a]:text-emerald-600 [&_a]:underline"
                onInput={(e) => setBody(e.currentTarget.innerHTML)}
              />
              
              {/* Attachments List */}
              {attachments.length > 0 && (
                <div className="px-4 pb-2 pt-1.5 flex flex-wrap gap-2 border-t border-slate-100 mt-auto shrink-0">
                  {attachments.map((file, i) => (
                    <div key={i} className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1 text-xs animate-fadein">
                      <Paperclip className="w-3 h-3 text-slate-400" />
                      <span className="text-slate-700 max-w-[120px] truncate" title={file.name}>{file.name}</span>
                      <span className="text-[10px] text-slate-400">{(file.size / 1024 / 1024).toFixed(1)}MB</span>
                      <button 
                        type="button"
                        onClick={() => removeAttachment(i)}
                        className="ml-0.5 text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                        title="Remove attachment"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Merged Attachments Dropzone */}
              <div 
                className="border-t border-slate-100 bg-slate-50/80 px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-all text-slate-500 shrink-0"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  handleAttachmentUpload(e.dataTransfer.files);
                }}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                    <CloudUpload className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-700">Attach files or drag & drop</p>
                  </div>
                </div>
                <span className="text-[11px] text-slate-400">Up to 10MB</span>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  multiple
                  onChange={(e) => handleAttachmentUpload(e.target.files)}
                />
              </div>
            </div>
          </div>

          {/* RIGHT PANE - SETTINGS */}
          <div className="w-72 bg-slate-50 border-l border-slate-100 flex flex-col p-5 overflow-y-auto shrink-0">
            {/* Schedule Settings */}
            <div className="mb-5">
              <h3 className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
                <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                Schedule Settings
              </h3>
              <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-3 shadow-sm">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Send Date</label>
                  <input 
                    type="date" 
                    value={sendDate}
                    onChange={(e) => setSendDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 font-sans"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Send Time</label>
                  <input 
                    type="time" 
                    value={sendTime}
                    onChange={(e) => setSendTime(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 font-sans"
                  />
                </div>
              </div>
            </div>

            {/* Job Configuration */}
            <div className="mb-5">
              <h3 className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                Job Limits
              </h3>
              <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-3 shadow-sm">
                <div>
                  <div className="flex justify-between items-end mb-1">
                    <label className="block text-xs font-medium text-slate-500">Delay Between Sends</label>
                    <span className="text-xs font-bold text-emerald-600">{delayBetweenMs / 1000}s</span>
                  </div>
                  <input
                    type="range"
                    min={1000}
                    max={60000}
                    step={500}
                    value={delayBetweenMs}
                    onChange={(e) => setDelayBetweenMs(Number(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-end mb-1">
                    <label className="block text-xs font-medium text-slate-500">Hourly Limit</label>
                    <span className="text-xs font-bold text-emerald-600">{hourlyLimit}/hr</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={500}
                    step={1}
                    value={hourlyLimit}
                    onChange={(e) => setHourlyLimit(Number(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Sender Identity</label>
                  <div className="relative">
                    <select 
                      value={selectedSenderId}
                      onChange={(e) => setSelectedSenderId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 appearance-none cursor-pointer font-sans"
                    >
                      {senders.length === 0 ? (
                        <option value="">No senders available</option>
                      ) : (
                        senders.map(s => <option key={s.id} value={s.id}>{s.name ? `${s.name} <${s.email}>` : s.email}</option>)
                      )}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-auto pt-3 border-t border-slate-200">
              <button 
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-xs transition-colors shadow-sm shadow-emerald-500/25 disabled:opacity-50 cursor-pointer"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Schedule Campaign
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
