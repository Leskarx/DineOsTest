import Link from 'next/link';

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between max-w-4xl mx-auto">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500 flex items-center justify-center">
            <span className="text-xs font-black text-slate-900">D</span>
          </div>
          <span className="font-semibold text-white">Dine&amp;Stay OS</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm text-slate-400">
          <Link href="/terms"   className="hover:text-white transition-colors">Terms</Link>
          <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
          <Link href="/login"   className="hover:text-white transition-colors">Sign In</Link>
        </nav>
      </header>
      <main className="max-w-4xl mx-auto px-6 py-12">
        {children}
      </main>
      <footer className="border-t border-slate-800 py-6 text-center text-xs text-slate-600">
        © {new Date().getFullYear()} Dine&amp;Stay OS. All rights reserved.
      </footer>
    </div>
  );
}
