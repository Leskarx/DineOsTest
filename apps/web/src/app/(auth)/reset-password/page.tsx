'use client';
import { Suspense } from 'react';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { ChefHat, Lock, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const userId = params.get('userId') ?? '';

  const [form, setForm] = useState({ newPassword: '', confirm: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const validLink = !!token && !!userId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.newPassword.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (form.newPassword !== form.confirm) { setError('Passwords do not match'); return; }
    setLoading(true);
    try {
      await api.post('/api/v1/auth/reset-password', { userId, token, newPassword: form.newPassword });
      setSuccess(true);
      setTimeout(() => router.push('/login'), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Link may have expired. Please request a new one.');
    } finally {
      setLoading(false);
    }
  };

  const strength = (pw: string) => {
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    return score;
  };
  const s = strength(form.newPassword);
  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][s];
  const strengthColor = ['', 'bg-red-500', 'bg-amber-500', 'bg-yellow-400', 'bg-emerald-500'][s];

  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/20 mb-4">
          <ChefHat size={28} className="text-amber-600 dark:text-amber-400" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Reset Password</h1>
        <p className="text-slate-900 dark:text-slate-400 text-sm mt-1">Choose a new password for your account</p>
      </div>

      {!validLink ? (
        <div className="card text-center space-y-4">
          <AlertCircle size={40} className="text-red-600 dark:text-red-400 mx-auto" />
          <p className="text-slate-900 dark:text-white font-semibold">Invalid Reset Link</p>
          <p className="text-slate-900 dark:text-slate-400 text-sm">This link is missing required parameters. Please request a new password reset.</p>
          <Link href="/forgot-password" className="btn-primary w-full flex items-center justify-center">Request New Link</Link>
        </div>
      ) : success ? (
        <div className="card text-center space-y-4">
          <CheckCircle size={48} className="text-emerald-600 dark:text-emerald-400 mx-auto" />
          <div>
            <p className="text-slate-900 dark:text-white font-semibold">Password Reset!</p>
            <p className="text-slate-900 dark:text-slate-400 text-sm mt-1">Your password has been updated. Redirecting to login...</p>
          </div>
          <Link href="/login" className="btn-primary w-full flex items-center justify-center">Go to Login</Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="card space-y-4">
          {error && (
            <div className="flex items-start gap-2 bg-red-100 dark:bg-red-900/20 border border-red-700 rounded-xl p-3 text-sm text-red-600 dark:text-red-400">
              <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          <div>
            <label className="label">New Password</label>
            <div className="relative">
              <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-900 dark:text-slate-400" />
              <input
                className="input pl-9 pr-10"
                type={showPw ? 'text' : 'password'}
                placeholder="Min 8 characters"
                value={form.newPassword}
                onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
                required
                autoFocus
              />
              <button type="button" onClick={() => setShowPw((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-900 dark:text-slate-400 hover:text-slate-900 dark:text-white">
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {form.newPassword && (
              <div className="mt-2 space-y-1">
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= s ? strengthColor : 'bg-slate-200 dark:bg-slate-700'}`} />
                  ))}
                </div>
                <p className="text-xs text-slate-900 dark:text-slate-500">{strengthLabel}</p>
              </div>
            )}
          </div>
          <div>
            <label className="label">Confirm Password</label>
            <div className="relative">
              <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-900 dark:text-slate-400" />
              <input
                className="input pl-9"
                type={showPw ? 'text' : 'password'}
                placeholder="Repeat new password"
                value={form.confirm}
                onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                required
              />
              {form.confirm && (
                <span className={`absolute right-3 top-1/2 -translate-y-1/2 ${form.confirm === form.newPassword ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {form.confirm === form.newPassword ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
                </span>
              )}
            </div>
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
          <Link href="/login" className="block text-center text-sm text-slate-900 dark:text-slate-400 hover:text-slate-900 dark:text-white transition-colors">
            Back to Login
          </Link>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <Suspense fallback={
        <div className="text-slate-900 dark:text-slate-400 text-sm">Loading...</div>
      }>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
