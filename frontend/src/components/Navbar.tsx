import React from 'react';
import { User, SlackStatus } from '../types';
import { Mail, Sparkles, Bell, ExternalLink, LogOut, ShieldCheck, Slack } from 'lucide-react';

interface NavbarProps {
  user: User | null;
  slackStatus: SlackStatus | null;
  onOpenSlackModal: () => void;
  onOpenLoginModal: () => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  slackStatus,
  onOpenSlackModal,
  onOpenLoginModal,
  onLogout,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-[#0B0F19]/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand / Logo */}
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <Mail className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-lg text-white tracking-tight">ReachInbox</span>
              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/20">
                Scheduler
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">AI-Driven Outreach Engine • Outbox Labs</p>
          </div>
        </div>

        {/* Center / Status Indicators */}
        <div className="hidden md:flex items-center space-x-3">
          {/* Slack Integration Button */}
          <button
            onClick={onOpenSlackModal}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium transition border ${
              slackStatus?.connected
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                : 'bg-slate-800/80 text-slate-300 border-white/10 hover:bg-slate-700/80'
            }`}
          >
            <Slack className={`h-3.5 w-3.5 ${slackStatus?.connected ? 'text-emerald-400' : 'text-slate-400'}`} />
            <span>
              {slackStatus?.connected ? `Slack: ${slackStatus.channel || '#email-alerts'}` : 'Connect Slack'}
            </span>
            <span className={`h-2 w-2 rounded-full ${slackStatus?.connected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
          </button>

          {/* BullMQ Dashboard External Link */}
          <a
            href={`${(import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '')}/admin/queues`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 hover:bg-indigo-500/20 transition"
          >
            <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
            <span>BullMQ Board</span>
            <ExternalLink className="h-3 w-3 opacity-70" />
          </a>
        </div>

        {/* User Profile / Auth Area */}
        <div className="flex items-center space-x-3">
          {user ? (
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2.5 bg-slate-900/80 border border-white/10 py-1 px-3 rounded-full">
                <img
                  src={user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`}
                  alt={user.name}
                  className="h-7 w-7 rounded-full bg-slate-800 border border-indigo-500/30"
                />
                <div className="text-left hidden sm:block">
                  <p className="text-xs font-medium text-white leading-tight">{user.name}</p>
                  <p className="text-[10px] text-slate-400 leading-tight truncate max-w-[140px]">{user.email}</p>
                </div>
              </div>

              <button
                onClick={onLogout}
                title="Log out"
                className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenLoginModal}
              className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition"
            >
              <ShieldCheck className="h-4 w-4" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
