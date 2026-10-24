import React, { useState, useEffect } from 'react';
import { X, Slack, Bell, ShieldCheck, CheckCircle2, AlertCircle, Send, Trash2 } from 'lucide-react';
import { api } from '../services/api';
import { SlackStatus } from '../types';
import toast from 'react-hot-toast';

interface SlackModalProps {
  isOpen: boolean;
  onClose: () => void;
  slackStatus: SlackStatus | null;
  onStatusUpdated: () => void;
}

export const SlackModal: React.FC<SlackModalProps> = ({
  isOpen,
  onClose,
  slackStatus,
  onStatusUpdated,
}) => {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [channel, setChannel] = useState('#email-alerts');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    if (slackStatus?.channel) {
      setChannel(slackStatus.channel);
    }
  }, [slackStatus]);

  if (!isOpen) return null;

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookUrl.trim() && !slackStatus?.connected) {
      toast.error('Please enter a valid Slack Incoming Webhook URL');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.connectSlack(webhookUrl.trim(), channel.trim());
      toast.success('Slack alerts successfully connected!');
      onStatusUpdated();
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to connect Slack');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTestAlert = async () => {
    setIsTesting(true);
    try {
      await api.testSlackAlert(webhookUrl.trim() || undefined);
      toast.success('Test alert delivered to your Slack channel! Check your Slack app.');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to send test alert');
    } finally {
      setIsTesting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await api.disconnectSlack();
      toast.success('Slack disconnected. Rate limit alerts paused.');
      setWebhookUrl('');
      onStatusUpdated();
    } catch (error: any) {
      toast.error('Failed to disconnect');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative w-full max-w-lg bg-[#0F172A] border border-white/10 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-[#4A154B] flex items-center justify-center shadow-lg shadow-purple-900/40">
              <Slack className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Slack Rate-Limit Integration</h3>
              <p className="text-xs text-slate-400">Live alerts when an hourly throttle limit is hit</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/5 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Status banner */}
          <div
            className={`p-4 rounded-2xl border flex items-start space-x-3 ${
              slackStatus?.connected
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-slate-800/40 border-white/10 text-slate-300'
            }`}
          >
            {slackStatus?.connected ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="h-5 w-5 text-indigo-400 shrink-0 mt-0.5" />
            )}
            <div className="text-xs">
              <p className="font-semibold text-white">
                {slackStatus?.connected ? 'Slack Alerts Active' : 'No Slack Webhook Connected'}
              </p>
              <p className="text-slate-400 mt-0.5">
                {slackStatus?.connected
                  ? `Notifications will be dispatched to ${slackStatus.channel || '#email-alerts'} the instant any sender reaches their hourly rate limit.`
                  : 'Connect your Slack Incoming Webhook URL below to receive live rate-limit breach notifications.'}
              </p>
              {slackStatus?.webhookMasked && (
                <p className="font-mono text-[11px] text-emerald-400/80 mt-1">
                  Active Webhook: {slackStatus.webhookMasked}
                </p>
              )}
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleConnect} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Slack Incoming Webhook URL
              </label>
              <input
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://hooks.slack.com/services/T.../B.../..."
                className="w-full px-4 py-2.5 rounded-xl glass-input text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Obtain from: Slack App Directory → Incoming WebHooks → Add to Slack.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Target Channel
              </label>
              <input
                type="text"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                placeholder="#email-alerts or #general"
                className="w-full px-4 py-2.5 rounded-xl glass-input text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none"
              />
            </div>

            {/* Action Buttons */}
            <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
              {slackStatus?.connected ? (
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Disconnect</span>
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleTestAlert}
                  disabled={isTesting || (!webhookUrl && !slackStatus?.connected)}
                  className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 transition disabled:opacity-40"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>{isTesting ? 'Sending...' : 'Test Alert'}</span>
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting || (!webhookUrl && !slackStatus?.connected)}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save & Connect'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
