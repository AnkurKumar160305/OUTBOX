import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import { X, Upload, FileText, Clock, ShieldAlert, Send, Sparkles, Check, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import toast from 'react-hot-toast';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultSender: string;
}

export const ComposeModal: React.FC<ComposeModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  defaultSender,
}) => {
  const [senderEmail, setSenderEmail] = useState(defaultSender || 'reachinbox.sender@ethereal.email');
  const [subject, setSubject] = useState('Transform your outbound outreach with ReachInbox AI');
  const [body, setBody] = useState(
    'Hi there,\n\nWe saw your recent growth in pipeline demand. ReachInbox automates lead enrichment and AI personalization at scale.\n\nWould you be open to a 10-minute demo this week?\n\nBest,\nReachInbox Team'
  );
  const [recipients, setRecipients] = useState<string[]>([
    'sarah.connor@cyberdyne.io',
    'john.doe@enterprise.com',
    'alex.rivera@fintech.co',
  ]);
  const [manualInput, setManualInput] = useState('');
  const [startTimePreset, setStartTimePreset] = useState<'now' | '10m' | 'custom'>('now');
  const [customDateTime, setCustomDateTime] = useState('');
  const [delayBetweenEmails, setDelayBetweenEmails] = useState(2);
  const [hourlyLimit, setHourlyLimit] = useState(50);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // CSV / Text Lead File Parsing
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

    if (file.name.endsWith('.csv')) {
      Papa.parse(file, {
        complete: (results) => {
          const flat = results.data.flat().join(' ');
          const matches = flat.match(emailRegex) || [];
          const unique = Array.from(new Set(matches.map((m) => m.toLowerCase())));
          if (unique.length > 0) {
            setRecipients(unique);
            toast.success(`Successfully parsed ${unique.length} email lead(s) from CSV!`);
          } else {
            toast.error('No valid email addresses found in the CSV file.');
          }
        },
        error: (err) => {
          toast.error('Failed to parse CSV: ' + err.message);
        },
      });
    } else {
      // Plain text file
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const matches = text.match(emailRegex) || [];
        const unique = Array.from(new Set(matches.map((m) => m.toLowerCase())));
        if (unique.length > 0) {
          setRecipients(unique);
          toast.success(`Detected ${unique.length} email lead(s) from text file!`);
        } else {
          toast.error('No valid email addresses found.');
        }
      };
      reader.readAsText(file);
    }
  };

  const handleAddManualEmail = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const trimmed = manualInput.trim().toLowerCase();
    if (emailRegex.test(trimmed)) {
      if (!recipients.includes(trimmed)) {
        setRecipients([...recipients, trimmed]);
        setManualInput('');
        toast.success(`Added ${trimmed}`);
      } else {
        toast.error('Email already in recipient list');
      }
    } else {
      toast.error('Please enter a valid email address');
    }
  };

  const handleRemoveRecipient = (email: string) => {
    setRecipients(recipients.filter((r) => r !== email));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (recipients.length === 0) {
      toast.error('Please upload or enter at least one recipient email.');
      return;
    }

    if (!subject.trim()) {
      toast.error('Subject is required.');
      return;
    }

    let startIso: string | undefined = undefined;
    if (startTimePreset === '10m') {
      startIso = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    } else if (startTimePreset === 'custom' && customDateTime) {
      startIso = new Date(customDateTime).toISOString();
    }

    setIsSubmitting(true);
    try {
      const response = await api.scheduleEmails({
        senderEmail: senderEmail || defaultSender,
        subject,
        body,
        recipients,
        startTime: startIso,
        delayBetweenEmails,
        hourlyLimit,
      });

      toast.success(response.message || `Scheduled ${recipients.length} emails into BullMQ queue!`);
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Scheduling error:', error);
      toast.error(error.response?.data?.error || 'Failed to schedule emails');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative w-full max-w-2xl bg-[#0F172A] border border-white/10 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <Send className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Compose & Schedule Outreach</h3>
              <p className="text-xs text-slate-400">Powered by BullMQ delayed queues & rate limiting</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/5 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Sender */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Sender Email (SMTP)
            </label>
            <input
              type="email"
              value={senderEmail}
              onChange={(e) => setSenderEmail(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl glass-input text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none"
              placeholder="e.g. outreach@reachinbox.ai"
              required
            />
          </div>

          {/* Subject */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Subject Line
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl glass-input text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none"
              placeholder="Cold email subject..."
              required
            />
          </div>

          {/* Body */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Email Body
              </label>
              <span className="text-[11px] text-indigo-400 flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Supports plain text & HTML
              </span>
            </div>
            <textarea
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl glass-input text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none font-sans"
              placeholder="Write your email body here..."
              required
            />
          </div>

          {/* Lead CSV/Text File Upload & Detected Leads */}
          <div className="p-4 rounded-2xl bg-slate-900/50 border border-white/5">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Upload className="h-4 w-4 text-indigo-400" />
                <span>Upload Leads (CSV or TXT)</span>
              </label>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                {recipients.length} Leads Detected
              </span>
            </div>

            {/* Upload Area */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-white/10 hover:border-indigo-500/50 rounded-xl p-4 text-center cursor-pointer transition bg-slate-800/20 hover:bg-indigo-500/5"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
              <FileText className="h-6 w-6 text-indigo-400 mx-auto mb-1.5" />
              <p className="text-xs font-medium text-slate-200">
                Drop your CSV lead list here or <span className="text-indigo-400 underline">browse</span>
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">Automatically extracts and deduplicates email addresses</p>
            </div>

            {/* Add Manual Recipient */}
            <div className="flex gap-2 mt-3">
              <input
                type="email"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="Or type an email and hit Add..."
                className="flex-1 px-3 py-1.5 rounded-lg glass-input text-xs text-white placeholder-slate-500 focus:outline-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddManualEmail();
                  }
                }}
              />
              <button
                type="button"
                onClick={handleAddManualEmail}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-medium border border-white/10 transition"
              >
                Add
              </button>
            </div>

            {/* Recipient Chips */}
            {recipients.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3 max-h-24 overflow-y-auto pt-1">
                {recipients.map((email) => (
                  <span
                    key={email}
                    className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] bg-slate-800 border border-white/10 text-slate-200"
                  >
                    <span>{email}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveRecipient(email)}
                      className="text-slate-400 hover:text-rose-400"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Scheduling & Rate Limiting Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Start Time */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Start Time
              </label>
              <select
                value={startTimePreset}
                onChange={(e: any) => setStartTimePreset(e.target.value)}
                className="w-full px-3 py-2 rounded-xl glass-input text-xs text-white focus:outline-none"
              >
                <option value="now" className="bg-slate-900 text-white">Send Now (Immediate)</option>
                <option value="10m" className="bg-slate-900 text-white">In 10 Minutes</option>
                <option value="custom" className="bg-slate-900 text-white">Custom Date & Time</option>
              </select>
              {startTimePreset === 'custom' && (
                <input
                  type="datetime-local"
                  value={customDateTime}
                  onChange={(e) => setCustomDateTime(e.target.value)}
                  className="w-full mt-2 px-3 py-1.5 rounded-lg glass-input text-xs text-white focus:outline-none"
                  required
                />
              )}
            </div>

            {/* Delay between emails */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Delay Between Emails
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="60"
                  value={delayBetweenEmails}
                  onChange={(e) => setDelayBetweenEmails(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-2 rounded-xl glass-input text-xs text-white focus:outline-none pr-8"
                />
                <span className="absolute right-3 top-2 text-xs text-slate-400 pointer-events-none">sec</span>
              </div>
            </div>

            {/* Hourly Limit */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Hourly Rate Limit
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={hourlyLimit}
                  onChange={(e) => setHourlyLimit(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3 py-2 rounded-xl glass-input text-xs text-white focus:outline-none pr-10"
                />
                <span className="absolute right-3 top-2 text-xs text-slate-400 pointer-events-none">/ hr</span>
              </div>
            </div>
          </div>

          {/* Footer Submit Button */}
          <div className="pt-3 border-t border-white/10 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-white/5 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <span className="h-4 w-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Enqueuing Jobs...</span>
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  <span>Schedule {recipients.length} Email(s)</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
