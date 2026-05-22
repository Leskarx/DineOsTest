import type { Metadata } from 'next';
import Link from 'next/link';
import {
  UtensilsCrossed, Hotel, BarChart3, Printer,
  Wifi, ShieldCheck, Zap, Users, Star,
  ArrowRight, CheckCircle2, ChefHat, CreditCard,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Dine&Stay OS — Restaurant & Hotel Management, Built for India',
  description:
    'All-in-one POS, kitchen display, billing, inventory, and hotel management software for restaurants and hospitality businesses. 14-day free trial.',
};

/* ─── Data ───────────────────────────────────────────────────────────────── */

const FEATURES = [
  {
    icon: UtensilsCrossed,
    title: 'Full-featured POS',
    desc: 'Table management, split bills, discounts, modifiers — everything your front-of-house needs to fly.',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-800/50',
  },
  {
    icon: ChefHat,
    title: 'Kitchen Display System',
    desc: 'Live ticket wall for your kitchen crew. Station filters, bump-all, audio alerts — no more paper tickets.',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10 border-orange-800/50',
  },
  {
    icon: BarChart3,
    title: 'Real-time Reports',
    desc: 'Daily sales, GST summaries, item-wise breakdowns, and shift reports — all in one tap.',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-800/50',
  },
  {
    icon: Hotel,
    title: 'Hotel Management',
    desc: 'Room reservations, check-in/out, folio billing, and housekeeping — integrated with your restaurant.',
    color: 'text-purple-400',
    bg: 'bg-purple-500/10 border-purple-800/50',
  },
  {
    icon: Printer,
    title: 'Thermal Printing',
    desc: 'Works with any 58mm or 80mm ESC/POS printer. Print KOTs, bills, and GST invoices in one click.',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-800/50',
  },
  {
    icon: Wifi,
    title: 'Works Offline',
    desc: 'Keep taking orders even when the internet goes down. Data syncs automatically when you reconnect.',
    color: 'text-sky-400',
    bg: 'bg-sky-500/10 border-sky-800/50',
  },
  {
    icon: ShieldCheck,
    title: 'DPDPA & GST Ready',
    desc: 'Built for Indian compliance from day one — GSTIN validation, e-invoicing support, and data residency in India.',
    color: 'text-rose-400',
    bg: 'bg-rose-500/10 border-rose-800/50',
  },
  {
    icon: Users,
    title: 'Multi-branch & Roles',
    desc: 'Manage multiple locations from one account. Fine-grained roles: Owner, Manager, Captain, Chef, Cashier.',
    color: 'text-violet-400',
    bg: 'bg-violet-500/10 border-violet-800/50',
  },
];

const PLANS = [
  {
    code: 'starter',
    name: 'Starter',
    price: '₹1,499',
    period: '/month',
    desc: 'Perfect for single-outlet cafes and QSRs getting started.',
    borderColor: 'border-slate-700',
    highlight: false,
    features: [
      '1 branch, up to 5 users',
      'Full POS & billing',
      'KDS (1 station)',
      'Basic reports',
      'Thermal printing',
      'Email support',
    ],
  },
  {
    code: 'growth',
    name: 'Growth',
    price: '₹3,999',
    period: '/month',
    desc: 'For growing restaurants that need analytics, inventory, and multi-staff.',
    borderColor: 'border-amber-500',
    highlight: true,
    features: [
      'Up to 3 branches, 20 users',
      'Everything in Starter',
      'Inventory & low-stock alerts',
      'Advanced reports + CSV export',
      'KDS (unlimited stations)',
      'Hotel management module',
      'Priority support',
    ],
  },
  {
    code: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    desc: 'For chains, cloud kitchens, and hospitality groups with specific needs.',
    borderColor: 'border-purple-700',
    highlight: false,
    features: [
      'Unlimited branches & users',
      'Everything in Growth',
      'White-label option',
      'Custom integrations (API)',
      'Dedicated account manager',
      'SLA-backed uptime',
    ],
  },
];

const TESTIMONIALS = [
  {
    name: 'Rahul Sharma',
    role: 'Owner, The Spice Route',
    city: 'Bengaluru',
    quote:
      'Switched from a ₹25,000 setup to Dine&Stay OS. My GST filing time dropped from 4 hours to 20 minutes.',
  },
  {
    name: 'Priya Nair',
    role: 'Manager, Sea Breeze Resort',
    city: 'Kochi',
    quote:
      'The hotel module finally connects our restaurant and rooms into one system. No more double entry.',
  },
  {
    name: 'Amitabh Singh',
    role: 'F&B Head, CloudKitchen Co.',
    city: 'Delhi',
    quote:
      'We run 8 kitchens from one dashboard. The KDS station filter is a game-changer for our team.',
  },
];

const STATS = [
  { value: '500+',  label: 'Restaurants & hotels' },
  { value: '12L+',  label: 'Orders processed' },
  { value: '99.5%', label: 'Uptime guarantee' },
  { value: '< 2s',  label: 'Avg. bill print time' },
];

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 antialiased">

      {/* ── Navbar ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-slate-950/80 border-b border-slate-800/60">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-black text-slate-900">D</span>
            </div>
            <span className="font-bold text-white text-lg tracking-tight">Dine&amp;Stay OS</span>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm text-slate-400">
            <a href="#features"      className="hover:text-white transition-colors">Features</a>
            <a href="#pricing"       className="hover:text-white transition-colors">Pricing</a>
            <a href="#testimonials"  className="hover:text-white transition-colors">Reviews</a>
            <Link href="/terms"      className="hover:text-white transition-colors">Terms</Link>
            <Link href="/privacy"    className="hover:text-white transition-colors">Privacy</Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm text-slate-300 hover:text-white transition-colors px-3 py-1.5"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold text-sm px-4 py-2 rounded-lg transition-colors"
            >
              Start free trial
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-20 pb-24 px-5">
        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-amber-500/10 rounded-full blur-[100px]" />
        </div>

        <div className="relative max-w-4xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-full px-4 py-1.5 text-xs font-medium text-amber-400">
            <Zap size={12} />
            Now with Hotel Management — all in one platform
          </div>

          <h1 className="text-4xl md:text-6xl font-extrabold text-white leading-tight tracking-tight">
            Run your restaurant
            <br />
            <span className="text-amber-400">the smarter way</span>
          </h1>

          <p className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
            POS, KDS, billing, inventory, GST reports, and hotel management — one platform,
            zero paper chaos. Built for Indian restaurants, cafes, and resorts.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold px-6 py-3.5 rounded-xl text-sm transition-colors"
            >
              Start 14-day free trial
              <ArrowRight size={16} />
            </Link>
            <a
              href="#features"
              className="inline-flex items-center justify-center gap-2 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white px-6 py-3.5 rounded-xl text-sm transition-colors"
            >
              See all features
            </a>
          </div>

          <p className="text-xs text-slate-600">No credit card required · Cancel anytime · Data hosted in India</p>
        </div>
      </section>

      {/* ── Stats bar ──────────────────────────────────────────────────────── */}
      <section className="border-y border-slate-800 bg-slate-900/40 py-8">
        <div className="max-w-4xl mx-auto px-5 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {STATS.map(({ value, label }) => (
            <div key={label}>
              <div className="text-2xl font-extrabold text-amber-400">{value}</div>
              <div className="text-xs text-slate-500 mt-1">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────────────── */}
      <section id="features" className="py-20 px-5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 space-y-3">
            <h2 className="text-3xl font-bold text-white">Everything you need, nothing you don&apos;t</h2>
            <p className="text-slate-400 max-w-xl mx-auto text-sm">
              Dine&amp;Stay OS ships with every module out of the box — no hidden add-ons, no per-feature pricing.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map(({ icon: Icon, title, desc, color, bg }) => (
              <div key={title} className={`rounded-2xl border p-5 space-y-3 ${bg}`}>
                <Icon size={22} className={color} />
                <h3 className="font-semibold text-white text-sm">{title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ────────────────────────────────────────────────────────── */}
      <section id="pricing" className="py-20 px-5 bg-slate-900/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12 space-y-3">
            <h2 className="text-3xl font-bold text-white">Simple, transparent pricing</h2>
            <p className="text-slate-400 text-sm">All plans include a 14-day free trial. GST extra.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {PLANS.map((plan) => (
              <div
                key={plan.code}
                className={`relative rounded-2xl border p-6 space-y-5 bg-slate-900 ${plan.borderColor} ${
                  plan.highlight ? 'shadow-lg shadow-amber-500/10' : ''
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-slate-900 text-xs font-bold px-3 py-1 rounded-full">
                    Most popular
                  </div>
                )}

                <div>
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{plan.name}</div>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-white">{plan.price}</span>
                    {plan.period && <span className="text-sm text-slate-500">{plan.period}</span>}
                  </div>
                  <p className="text-xs text-slate-500 mt-2">{plan.desc}</p>
                </div>

                <ul className="space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs text-slate-300">
                      <CheckCircle2 size={13} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>

                <Link
                  href={plan.code === 'enterprise' ? 'mailto:sales@dinestay.app' : '/register'}
                  className={`block text-center py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                    plan.highlight
                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-900'
                      : 'border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white'
                  }`}
                >
                  {plan.code === 'enterprise' ? 'Contact sales' : 'Start free trial'}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ───────────────────────────────────────────────────── */}
      <section id="testimonials" className="py-20 px-5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12 space-y-3">
            <h2 className="text-3xl font-bold text-white">Loved by restaurateurs across India</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map(({ name, role, city, quote }) => (
              <div key={name} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} size={13} className="text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">&ldquo;{quote}&rdquo;</p>
                <div>
                  <div className="text-sm font-semibold text-white">{name}</div>
                  <div className="text-xs text-slate-500">{role} · {city}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ─────────────────────────────────────────────────────── */}
      <section className="py-16 px-5">
        <div className="max-w-3xl mx-auto bg-gradient-to-br from-amber-500/20 via-amber-600/10 to-transparent border border-amber-500/30 rounded-3xl p-10 text-center space-y-5">
          <CreditCard size={36} className="text-amber-400 mx-auto" />
          <h2 className="text-2xl font-bold text-white">Start your free 14-day trial today</h2>
          <p className="text-slate-400 text-sm max-w-md mx-auto">
            Set up in under 5 minutes. No credit card, no lock-in. Your data stays in India.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold px-8 py-3.5 rounded-xl text-sm transition-colors"
          >
            Create your free account
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-800 py-10 px-5">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-black text-slate-900">D</span>
            </div>
            <span className="font-bold text-white text-lg tracking-tight">Dine&amp;Stay OS</span>
          </div>

          <nav className="flex flex-wrap justify-center gap-5 text-xs text-slate-500">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#pricing"  className="hover:text-white transition-colors">Pricing</a>
            <Link href="/terms"   className="hover:text-white transition-colors">Terms of Service</Link>
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
            <a href="mailto:support@dinestay.app" className="hover:text-white transition-colors">Support</a>
            <a href="mailto:sales@dinestay.app"   className="hover:text-white transition-colors">Sales</a>
          </nav>

          <div className="text-xs text-slate-600 text-center md:text-right">
            <div>&copy; {new Date().getFullYear()} ProgressiveNovus Private Limited</div>
            <div className="mt-0.5">Bengaluru, India · GST compliant · DPDPA ready</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
