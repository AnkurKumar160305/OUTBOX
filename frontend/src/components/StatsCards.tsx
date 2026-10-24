import React from 'react';
import { DashboardStats } from '../types';
import { Clock, Send, ShieldAlert, Cpu } from 'lucide-react';

interface StatsCardsProps {
  stats: DashboardStats | null;
  loading: boolean;
}

export const StatsCards: React.FC<StatsCardsProps> = ({ stats, loading }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {/* Card 1: Scheduled */}
      <div className="glass-card rounded-2xl p-5 border border-white/5 hover:border-indigo-500/30 transition-all duration-300 group">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Scheduled Queue</p>
            <h3 className="text-2xl font-bold text-white mt-1 group-hover:text-indigo-400 transition">
              {loading ? '...' : stats?.scheduledCount ?? 0}
            </h3>
          </div>
          <div className="h-11 w-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Clock className="h-5 w-5" />
          </div>
        </div>
        <p className="text-[11px] text-slate-400 mt-3 flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
          <span>BullMQ delayed queue active</span>
        </p>
      </div>

      {/* Card 2: Sent */}
      <div className="glass-card rounded-2xl p-5 border border-white/5 hover:border-emerald-500/30 transition-all duration-300 group">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Sent Emails</p>
            <h3 className="text-2xl font-bold text-white mt-1 group-hover:text-emerald-400 transition">
              {loading ? '...' : stats?.sentCount ?? 0}
            </h3>
          </div>
          <div className="h-11 w-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Send className="h-5 w-5" />
          </div>
        </div>
        <p className="text-[11px] text-slate-400 mt-3 flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          <span>Delivered via Ethereal SMTP</span>
        </p>
      </div>

      {/* Card 3: Rate Limiting Events */}
      <div className="glass-card rounded-2xl p-5 border border-white/5 hover:border-purple-500/30 transition-all duration-300 group">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Rate Limits Triggered</p>
            <h3 className="text-2xl font-bold text-white mt-1 group-hover:text-purple-400 transition">
              {loading ? '...' : stats?.rateLimitEvents ?? 0}
            </h3>
          </div>
          <div className="h-11 w-11 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <ShieldAlert className="h-5 w-5" />
          </div>
        </div>
        <p className="text-[11px] text-slate-400 mt-3 flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
          <span>Rescheduled + Slack alerts</span>
        </p>
      </div>

      {/* Card 4: Worker Engine */}
      <div className="glass-card rounded-2xl p-5 border border-white/5 hover:border-cyan-500/30 transition-all duration-300 group">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Worker Concurrency</p>
            <h3 className="text-2xl font-bold text-white mt-1 group-hover:text-cyan-400 transition">
              5x Parallel
            </h3>
          </div>
          <div className="h-11 w-11 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <Cpu className="h-5 w-5" />
          </div>
        </div>
        <p className="text-[11px] text-slate-400 mt-3 truncate max-w-[220px]" title={stats?.defaultSender}>
          Sender: <span className="text-slate-300 font-mono text-[10px]">{stats?.defaultSender || 'ethereal'}</span>
        </p>
      </div>
    </div>
  );
};
