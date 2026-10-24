import React from 'react';
import { ExternalLink, RefreshCw, Zap, Shield, Layers } from 'lucide-react';

export const QueueMonitor: React.FC = () => {
  const [iframeKey, setIframeKey] = React.useState(0);

  const handleRefresh = () => {
    setIframeKey((prev) => prev + 1);
  };

  return (
    <div className="space-y-4">
      {/* Banner / Header */}
      <div className="glass-panel rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border border-white/5">
        <div className="flex items-center space-x-3">
          <div className="h-9 w-9 rounded-xl bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Zap className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <span>Live BullMQ Queue Monitor</span>
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            </h4>
            <p className="text-xs text-slate-400">
              Direct real-time insight into Delayed, Waiting, Active, and Completed jobs
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleRefresh}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 transition"
          >
            <RefreshCw className="h-3.5 w-3.5 text-indigo-400" />
            <span>Reload Board</span>
          </button>
          <a
            href={`${(import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '')}/admin/queues`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-sm"
          >
            <span>Open in Tab</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      {/* Embedded Bull-Board iframe */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-white/10 shadow-2xl h-[650px] relative">
        <iframe
          key={iframeKey}
          src={`${(import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '')}/admin/queues`}
          title="BullMQ Live Queue Monitor"
          className="w-full h-full border-0 bg-slate-950"
        />
      </div>
    </div>
  );
};
