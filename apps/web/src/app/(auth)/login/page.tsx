'use client';
import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const [form, setForm] = useState({ email: '', password: '', tenantId: '' });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...form, tenantId: form.tenantId.trim() || undefined };
      const res = await api.post('/api/v1/auth/login', payload);
      const userData = res.data.data;
      login(userData);
      const role = userData?.user?.role;
      let redirectUrl = '/dashboard';
      if (role === 'superadmin') redirectUrl = '/admin';
      else if (role === 'owner') redirectUrl = '/executive';
      else if (role === 'manager') redirectUrl = '/executive';
      else if (role === 'restaurant_manager') redirectUrl = '/dashboard';
      else if (role === 'hotel_manager') redirectUrl = '/hotel/dashboard';
      else if (role === 'cashier') redirectUrl = '/cashier';
      else if (role === 'waiter') redirectUrl = '/waiter';
      else if (role === 'kitchen') redirectUrl = '/kds';
      else if (role === 'inventory') redirectUrl = '/inventory';
      else if (role === 'housekeeping') redirectUrl = '/hotel/housekeeping';
      else if (role === 'receptionist') redirectUrl = '/hotel';
      
      router.push(redirectUrl);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500 mb-4">
            <span className="text-2xl font-black text-slate-900">D</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dine&Stay OS</h1>
          <p className="text-slate-900 dark:text-slate-400 text-sm mt-1">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="label">Tenant ID <span className="text-slate-600 font-normal">(leave blank for superadmin)</span></label>
            <input className="input" placeholder="Your workspace ID" value={form.tenantId}
              onChange={(e) => setForm({ ...form, tenantId: e.target.value })} />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" placeholder="your@email.com" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="label mb-0">Password</label>
              <a href="/forgot-password" className="text-xs text-amber-600 dark:text-amber-400 hover:text-amber-600 dark:text-amber-300 transition-colors">Forgot password?</a>
            </div>
            <div className="relative">
              <input className="input pr-10" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })} required />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-900 dark:text-slate-500 hover:text-slate-600 dark:text-slate-300 transition-colors"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <button className="btn-primary w-full" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-sm text-slate-900 dark:text-slate-500 mt-4">
          New restaurant?{' '}
          <a href="/register" className="text-amber-600 dark:text-amber-400 hover:text-amber-600 dark:text-amber-300">Start free trial →</a>
        </p>
      </div>
    </div>
  );
}
