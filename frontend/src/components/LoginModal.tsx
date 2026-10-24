import React, { useState } from 'react';
import { X, Mail, ShieldCheck, Sparkles, UserCheck } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { api } from '../services/api';
import { User } from '../types';
import toast from 'react-hot-toast';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: User, token: string) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onLoginSuccess }) => {
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleGoogleSuccess = async (credentialResponse: any) => {
    setLoading(true);
    try {
      const data = await api.googleLogin(credentialResponse.credential);
      onLoginSuccess(data.user, data.token);
      toast.success(`Welcome back, ${data.user.name}!`);
      onClose();
    } catch (err: any) {
      toast.error('Google Sign-In failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setLoading(true);
    try {
      const data = await api.demoLogin();
      onLoginSuccess(data.user, data.token);
      toast.success(`Logged in as ${data.user.name}!`);
      onClose();
    } catch (err: any) {
      toast.error('Demo login failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
      <div className="relative w-full max-w-md bg-[#0F172A] border border-white/10 rounded-3xl shadow-2xl overflow-hidden p-6 text-center animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/5 transition"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Icon & Title */}
        <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 flex items-center justify-center shadow-xl shadow-indigo-600/30 mx-auto mb-4">
          <Mail className="h-7 w-7 text-white" />
        </div>
        <h3 className="text-xl font-bold text-white tracking-tight">Sign In to ReachInbox</h3>
        <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
          Manage email scheduling, BullMQ queue throughput, and real-time outreach metrics.
        </p>

        {/* Auth options */}
        <div className="mt-6 space-y-3">
          {/* Real Google OAuth Login */}
          <div className="flex justify-center w-full">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => toast.error('Google Login Error')}
              theme="filled_black"
              shape="pill"
              size="large"
              text="signin_with"
            />
          </div>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-[#0F172A] px-2 text-slate-400">or reviewer fast-track</span>
            </div>
          </div>

          {/* Quick Reviewer Demo Sign In */}
          <button
            onClick={handleDemoLogin}
            disabled={loading}
            className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-white/10 transition shadow-md"
          >
            <UserCheck className="h-4 w-4 text-emerald-400" />
            <span>Instant Reviewer Demo Sign-In</span>
          </button>
        </div>

        <p className="text-[10px] text-slate-500 mt-5">
          ReachInbox Scheduling System • Outbox Labs Hiring Assignment
        </p>
      </div>
    </div>
  );
};
