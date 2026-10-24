import React, { useState, useEffect, useCallback } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { Navbar } from './components/Navbar';
import { StatsCards } from './components/StatsCards';
import { TabNavigation } from './components/TabNavigation';
import { SearchBar } from './components/SearchBar';
import { ScheduledTable } from './components/ScheduledTable';
import { SentTable } from './components/SentTable';
import { QueueMonitor } from './components/QueueMonitor';
import { ComposeModal } from './components/ComposeModal';
import { SlackModal } from './components/SlackModal';
import { LoginModal } from './components/LoginModal';
import { api } from './services/api';
import { User, ScheduledEmailItem, DashboardStats, SlackStatus } from './types';

export const App: React.FC = () => {
  // User Session
  const [user, setUser] = useState<User | null>(null);

  // Dashboard state
  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent' | 'queue'>('scheduled');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [slackStatus, setSlackStatus] = useState<SlackStatus | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Email lists
  const [scheduledEmails, setScheduledEmails] = useState<ScheduledEmailItem[]>([]);
  const [sentEmails, setSentEmails] = useState<ScheduledEmailItem[]>([]);
  const [loadingEmails, setLoadingEmails] = useState(true);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchResults, setSearchResults] = useState<ScheduledEmailItem[] | null>(null);
  const [searchEngine, setSearchEngine] = useState<'elasticsearch' | 'database_fallback'>('database_fallback');
  const [isSearching, setIsSearching] = useState(false);

  // Modals
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isSlackOpen, setIsSlackOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  // Initial Auth Check
  useEffect(() => {
    const savedUser = localStorage.getItem('reachinbox_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('reachinbox_user');
      }
    } else {
      // Default to demo user for a friction-free evaluation experience
      api.demoLogin().then((data) => {
        setUser(data.user);
        localStorage.setItem('reachinbox_token', data.token);
        localStorage.setItem('reachinbox_user', JSON.stringify(data.user));
      });
    }
  }, []);

  // Fetch Dashboard Stats & Slack Status
  const fetchStatsAndSlack = useCallback(async () => {
    try {
      const [statsData, slackData] = await Promise.all([
        api.getStats(),
        api.getSlackStatus(),
      ]);
      setStats(statsData);
      setSlackStatus(slackData);
    } catch (err) {
      console.warn('Failed to fetch stats/slack:', err);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  // Fetch Emails
  const fetchEmails = useCallback(async () => {
    try {
      const [scheduledRes, sentRes] = await Promise.all([
        api.getScheduledEmails(1, 50),
        api.getSentEmails(1, 50),
      ]);
      setScheduledEmails(scheduledRes.items);
      setSentEmails(sentRes.items);
    } catch (err) {
      console.warn('Failed to fetch emails:', err);
    } finally {
      setLoadingEmails(false);
    }
  }, []);

  // Initial and periodic polling
  useEffect(() => {
    fetchStatsAndSlack();
    fetchEmails();

    const interval = setInterval(() => {
      fetchStatsAndSlack();
      fetchEmails();
    }, 4000);

    return () => clearInterval(interval);
  }, [fetchStatsAndSlack, fetchEmails]);

  // Handle Search with debounce
  useEffect(() => {
    if (!searchQuery.trim() && !statusFilter) {
      setSearchResults(null);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await api.searchEmails(searchQuery, statusFilter || undefined, 1, 50);
        setSearchResults(res.items);
        setSearchEngine(res.engine);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, statusFilter]);

  // Actions
  const handleCancelEmail = async (id: string) => {
    try {
      await api.cancelScheduledEmail(id);
      toast.success('Scheduled email removed');
      fetchEmails();
      fetchStatsAndSlack();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to cancel email');
    }
  };

  const handleLoginSuccess = (newUser: User, token: string) => {
    setUser(newUser);
    localStorage.setItem('reachinbox_token', token);
    localStorage.setItem('reachinbox_user', JSON.stringify(newUser));
    fetchStatsAndSlack();
    fetchEmails();
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('reachinbox_token');
    localStorage.removeItem('reachinbox_user');
    toast.success('Logged out successfully');
  };

  // Determine current items to display (search vs tab list)
  const isSearchActive = Boolean(searchQuery.trim() || statusFilter);
  const displayedScheduled = isSearchActive
    ? (searchResults || []).filter((e) => ['SCHEDULED', 'PROCESSING', 'RATE_LIMITED'].includes(e.status))
    : scheduledEmails;

  const displayedSent = isSearchActive
    ? (searchResults || []).filter((e) => ['SENT', 'FAILED'].includes(e.status))
    : sentEmails;

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-100 flex flex-col">
      <Toaster position="bottom-right" toastOptions={{ style: { background: '#1E293B', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' } }} />

      {/* Top Navbar */}
      <Navbar
        user={user}
        slackStatus={slackStatus}
        onOpenSlackModal={() => setIsSlackOpen(true)}
        onOpenLoginModal={() => setIsLoginOpen(true)}
        onLogout={handleLogout}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Title Section */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Email Job Scheduler & Automation
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Production-grade outbound scheduler with BullMQ delayed queues, Redis rate-limiting, and Ethereal SMTP.
          </p>
        </div>

        {/* Stats Cards */}
        <StatsCards stats={stats} loading={loadingStats} />

        {/* Tab Navigation & Compose CTA */}
        <TabNavigation
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onOpenComposeModal={() => setIsComposeOpen(true)}
          scheduledCount={stats?.scheduledCount ?? scheduledEmails.length}
          sentCount={stats?.sentCount ?? sentEmails.length}
        />

        {/* Search Bar (visible on scheduled & sent tabs) */}
        {activeTab !== 'queue' && (
          <div className="mb-6">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              onClear={() => setSearchQuery('')}
              statusFilter={statusFilter}
              onStatusChange={setStatusFilter}
              isSearching={isSearching}
              engine={searchEngine}
            />
          </div>
        )}

        {/* Tab Views */}
        {activeTab === 'scheduled' && (
          <ScheduledTable
            emails={displayedScheduled}
            loading={loadingEmails}
            onCancel={handleCancelEmail}
            onOpenCompose={() => setIsComposeOpen(true)}
          />
        )}

        {activeTab === 'sent' && (
          <SentTable
            emails={displayedSent}
            loading={loadingEmails}
            onOpenCompose={() => setIsComposeOpen(true)}
          />
        )}

        {activeTab === 'queue' && <QueueMonitor />}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-6 bg-slate-950/60 mt-12 text-center text-xs text-slate-500">
        <p>ReachInbox.ai Engineering Hiring Assignment • Full-stack Email Job Scheduler</p>
        <p className="text-[11px] text-slate-600 mt-1">
          TypeScript • Express.js • BullMQ • Redis • PostgreSQL • Ethereal Email • Elasticsearch
        </p>
      </footer>

      {/* Modals */}
      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        onSuccess={() => {
          fetchEmails();
          fetchStatsAndSlack();
        }}
        defaultSender={stats?.defaultSender || 'reachinbox.sender@ethereal.email'}
      />

      <SlackModal
        isOpen={isSlackOpen}
        onClose={() => setIsSlackOpen(false)}
        slackStatus={slackStatus}
        onStatusUpdated={fetchStatsAndSlack}
      />

      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />
    </div>
  );
};
