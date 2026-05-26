'use client';
import { useAuthStore } from '@/store/auth.store';
import { ShoppingCart, Layout, BookOpen, Clock } from 'lucide-react';
import dayjs from 'dayjs';
import Link from 'next/link';

export default function WaiterDashboardPage() {
  const { user } = useAuthStore();

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white">Welcome, {user?.firstName}</h1>
        <p className="text-sm text-slate-400">Service Dashboard • {dayjs().format('dddd, D MMMM YYYY')}</p>
      </div>

      {/* Quick Actions */}
      <h2 className="text-lg font-semibold text-white mt-8 mb-2">Quick Actions</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/pos" className="group card hover:border-amber-500 transition-all cursor-pointer flex flex-col items-center justify-center p-8 text-center bg-gradient-to-br from-slate-800 to-slate-900">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 text-amber-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <ShoppingCart size={32} />
          </div>
          <h3 className="font-bold text-lg text-white mb-1">Take Order (POS)</h3>
          <p className="text-xs text-slate-400">Punch in new orders</p>
        </Link>

        <Link href="/tables" className="group card hover:border-purple-500 transition-all cursor-pointer flex flex-col items-center justify-center p-8 text-center bg-gradient-to-br from-slate-800 to-slate-900">
          <div className="w-16 h-16 rounded-2xl bg-purple-500/20 text-purple-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Layout size={32} />
          </div>
          <h3 className="font-bold text-lg text-white mb-1">Tables</h3>
          <p className="text-xs text-slate-400">View table statuses & manage guests</p>
        </Link>

        <Link href="/menu" className="group card hover:border-blue-500 transition-all cursor-pointer flex flex-col items-center justify-center p-8 text-center bg-gradient-to-br from-slate-800 to-slate-900">
          <div className="w-16 h-16 rounded-2xl bg-blue-500/20 text-blue-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <BookOpen size={32} />
          </div>
          <h3 className="font-bold text-lg text-white mb-1">Digital Menu</h3>
          <p className="text-xs text-slate-400">Browse items & check availability</p>
        </Link>
      </div>
      
      {/* Informational Widget */}
      <div className="mt-8 bg-slate-800/50 border border-slate-700 rounded-xl p-6 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
        <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
          <Clock size={24} />
        </div>
        <div>
          <h3 className="text-white font-semibold">Have a great shift!</h3>
          <p className="text-sm text-slate-400 mt-1">
            Remember to check table statuses regularly and ensure all orders are confirmed in the POS. 
            If you need assistance, contact your manager.
          </p>
        </div>
      </div>
    </div>
  );
}
