'use client';
import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { ChefHat, Mail, ArrowLeft, CheckCircle } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/api/v1/auth/forgot-password', { email });
      setSent(true);
    } catch {
      // Always show sent — prevents email enumeration
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 mb-4">
            <ChefHat size={28} className="text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Forgot Password</h1>
          <p className="text-slate-400 text-sm mt-1">We'll send a reset link to your email</p>
        </div>

        {sent ? (
          <div className="card text-center space-y-4">
            <div className="flex justify-center">
              <CheckCircle size={48} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-white font-semibold">Check your inbox</p>
              <p className="text-slate-400 text-sm mt-1">
                If an account exists for <span className="text-amber-400">{email}</span>, a password reset link has been sent.
              </p>
            </div>
            <p className="text-xs text-slate-500">The link expires in 1 hour. Check your spam folder if you don't see it.</p>
            <Link href="/login" className="btn-secondary w-full flex items-center justify-center gap-2">
              <ArrowLeft size={14} /> Back to Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card space-y-4">
            <div>
              <label className="label">Email Address</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  className="input pl-9"
                  type="email"
                  placeholder="you@restaurant.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
            <Link href="/login" className="flex items-center justify-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors">
              <ArrowLeft size={13} /> Back to Login
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
