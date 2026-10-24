import React from 'react';
import { ScheduledEmailItem } from '../types';
import { Clock, Trash2, Calendar, AlertTriangle, ArrowUpRight } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface ScheduledTableProps {
  emails: ScheduledEmailItem[];
  loading: boolean;
  onCancel: (id: string) => void;
  onOpenCompose: () => void;
}

export const ScheduledTable: React.FC<ScheduledTableProps> = ({
  emails,
  loading,
  onCancel,
  onOpenCompose,
}) => {
  if (loading) {
    return (
      <div className="glass-panel rounded-2xl overflow-hidden p-6 space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="animate-pulse flex items-center justify-between p-4 bg-slate-800/40 rounded-xl">
            <div className="space-y-2 flex-1">
              <div className="h-4 bg-slate-700/60 rounded w-1/3" />
              <div className="h-3 bg-slate-700/40 rounded w-1/2" />
            </div>
            <div className="h-6 bg-slate-700/40 rounded-full w-24" />
          </div>
        ))}
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="glass-panel rounded-2xl p-12 text-center border border-white/5 flex flex-col items-center justify-center">
        <div className="h-16 w-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-4">
          <Clock className="h-8 w-8" />
        </div>
        <h3 className="text-lg font-semibold text-white">No Scheduled Emails</h3>
        <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-sm">
          You don't have any outbound emails waiting in the BullMQ queue. Schedule a batch now!
        </p>
        <button
          onClick={onOpenCompose}
          className="mt-5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition"
        >
          Compose & Schedule
        </button>
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-2xl overflow-hidden border border-white/5 shadow-2xl">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs sm:text-sm">
          <thead className="bg-slate-900/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-white/5">
            <tr>
              <th className="py-3.5 px-4 font-semibold">Recipient</th>
              <th className="py-3.5 px-4 font-semibold">Subject</th>
              <th className="py-3.5 px-4 font-semibold">Sender</th>
              <th className="py-3.5 px-4 font-semibold">Scheduled For</th>
              <th className="py-3.5 px-4 font-semibold">Status</th>
              <th className="py-3.5 px-4 font-semibold text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-slate-200">
            {emails.map((email) => {
              const scheduledDate = new Date(email.scheduledAt);
              const isPast = scheduledDate.getTime() < Date.now();

              return (
                <tr key={email.id} className="hover:bg-white/[0.02] transition">
                  {/* Recipient */}
                  <td className="py-3.5 px-4 font-medium text-white">
                    <div className="flex items-center space-x-2">
                      <div className="h-7 w-7 rounded-lg bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-xs">
                        {email.recipientEmail.charAt(0).toUpperCase()}
                      </div>
                      <span className="truncate max-w-[180px]">{email.recipientEmail}</span>
                    </div>
                  </td>

                  {/* Subject */}
                  <td className="py-3.5 px-4 max-w-[220px]">
                    <div className="font-medium text-slate-100 truncate">{email.subject}</div>
                    <div className="text-[11px] text-slate-400 truncate mt-0.5">{email.body}</div>
                  </td>

                  {/* Sender */}
                  <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px] truncate max-w-[150px]">
                    {email.senderEmail}
                  </td>

                  {/* Scheduled Time */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center space-x-1.5 text-slate-300 font-medium">
                      <Calendar className="h-3.5 w-3.5 text-indigo-400" />
                      <span>{format(scheduledDate, 'MMM d, h:mm a')}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {isPast ? 'Processing shortly' : formatDistanceToNow(scheduledDate, { addSuffix: true })}
                    </div>
                  </td>

                  {/* Status Badge */}
                  <td className="py-3.5 px-4">
                    {email.status === 'RATE_LIMITED' ? (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-purple-500/15 text-purple-400 border border-purple-500/30">
                        <AlertTriangle className="h-3 w-3" />
                        <span>Rate Limited</span>
                      </span>
                    ) : email.status === 'PROCESSING' ? (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30 animate-pulse">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                        <span>Processing</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                        <Clock className="h-3 w-3" />
                        <span>Scheduled</span>
                      </span>
                    )}
                  </td>

                  {/* Action */}
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => onCancel(email.id)}
                      title="Cancel schedule"
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
