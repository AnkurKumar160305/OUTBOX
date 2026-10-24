import React from 'react';
import { Clock, Send, Plus, Activity } from 'lucide-react';

interface TabNavigationProps {
  activeTab: 'scheduled' | 'sent' | 'queue';
  onTabChange: (tab: 'scheduled' | 'sent' | 'queue') => void;
  onOpenComposeModal: () => void;
  scheduledCount: number;
  sentCount: number;
}

export const TabNavigation: React.FC<TabNavigationProps> = ({
  activeTab,
  onTabChange,
  onOpenComposeModal,
  scheduledCount,
  sentCount,
}) => {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
      {/* Tabs list */}
      <div className="flex items-center space-x-1.5 p-1 bg-slate-900/90 border border-white/10 rounded-2xl w-full sm:w-auto">
        {/* Scheduled Tab */}
        <button
          onClick={() => onTabChange('scheduled')}
          className={`flex-1 sm:flex-initial flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition ${
            activeTab === 'scheduled'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Clock className="h-4 w-4" />
          <span>Scheduled Emails</span>
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] ${
              activeTab === 'scheduled' ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
            }`}
          >
            {scheduledCount}
          </span>
        </button>

        {/* Sent Tab */}
        <button
          onClick={() => onTabChange('sent')}
          className={`flex-1 sm:flex-initial flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition ${
            activeTab === 'sent'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Send className="h-4 w-4" />
          <span>Sent Emails</span>
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] ${
              activeTab === 'sent' ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
            }`}
          >
            {sentCount}
          </span>
        </button>

        {/* Queue Live Monitor */}
        <button
          onClick={() => onTabChange('queue')}
          className={`flex-1 sm:flex-initial flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition ${
            activeTab === 'queue'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Activity className="h-4 w-4 text-emerald-400" />
          <span>Queue Live</span>
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
        </button>
      </div>

      {/* Primary Compose CTA Button */}
      <button
        onClick={onOpenComposeModal}
        className="w-full sm:w-auto flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-xs sm:text-sm font-semibold shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-0.5 active:translate-y-0 transition duration-200"
      >
        <Plus className="h-4 w-4 stroke-[3]" />
        <span>Compose New Email</span>
      </button>
    </div>
  );
};
