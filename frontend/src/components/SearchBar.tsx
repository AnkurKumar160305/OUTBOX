import React from 'react';
import { Search, X, Filter, Database, Zap } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (val: string) => void;
  onClear: () => void;
  statusFilter: string;
  onStatusChange: (status: string) => void;
  isSearching: boolean;
  engine?: 'elasticsearch' | 'database_fallback';
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  onClear,
  statusFilter,
  onStatusChange,
  isSearching,
  engine,
}) => {
  return (
    <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
      {/* Input */}
      <div className="relative flex-1 w-full">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
          <Search className={`h-4 w-4 ${isSearching ? 'text-indigo-400 animate-spin' : 'text-slate-400'}`} />
        </div>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search by recipient, subject, body, or sender..."
          className="w-full pl-10 pr-10 py-2.5 rounded-xl glass-input text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none"
        />
        {value && (
          <button
            onClick={onClear}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Filter & Engine Badge */}
      <div className="flex items-center space-x-2 w-full sm:w-auto justify-between sm:justify-start">
        {/* Status Dropdown */}
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => onStatusChange(e.target.value)}
            className="appearance-none glass-input text-xs text-slate-200 py-2.5 pl-8 pr-8 rounded-xl focus:outline-none cursor-pointer"
          >
            <option value="" className="bg-slate-900 text-white">All Statuses</option>
            <option value="SCHEDULED" className="bg-slate-900 text-white">Scheduled</option>
            <option value="SENT" className="bg-slate-900 text-white">Sent</option>
            <option value="RATE_LIMITED" className="bg-slate-900 text-white">Rate Limited</option>
          </select>
          <Filter className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-3 pointer-events-none" />
        </div>

        {/* Search Engine Badge */}
        {value && (
          <div
            className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-[11px] font-medium border ${
              engine === 'elasticsearch'
                ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20'
            }`}
          >
            {engine === 'elasticsearch' ? <Zap className="h-3.5 w-3.5 text-amber-400" /> : <Database className="h-3.5 w-3.5 text-indigo-400" />}
            <span>{engine === 'elasticsearch' ? 'Elasticsearch' : 'PostgreSQL'}</span>
          </div>
        )}
      </div>
    </div>
  );
};
