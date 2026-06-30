import { useState } from 'react';
import {
  Sparkles, LayoutTemplate, Wand2, Share2, BarChart3, Code2,
  ArrowRight, Zap, Users, CheckCircle2, Check,
} from 'lucide-react';

interface Props {
  /** Advance to the login step (Google sign-in). */
  onGetStarted: () => void;
}

interface PricingTier {
  name: string;
  tagline: string;
  priceMonthly?: number; // omitted for custom/contact tiers
  priceCustom?: boolean;
  contact?: boolean;     // CTA is a mailto instead of sign-in
  cta: string;
  highlight: boolean;
  note?: string;
  features: string[];
}

const BRAND_GRADIENT = 'linear-gradient(135deg, #4f46e5, #7c3aed 50%, #ec4899)';
const HERO_GRADIENT =
  'linear-gradient(140deg, #1e0a4a 0%, #3b0d8a 25%, #6d28d9 55%, #a21caf 80%, #be185d 100%)';

const FEATURES = [
  {
    Icon: LayoutTemplate,
    title: 'Multiple templates per event',
    body: 'Design several branded layouts for a single event and let attendees pick the one they love from a gallery.',
  },
  {
    Icon: Wand2,
    title: 'One-tap photo magic',
    body: 'Remove backgrounds and auto-enhance attendee photos right in the editor — no design skills required.',
  },
  {
    Icon: Share2,
    title: 'Rich social sharing',
    body: 'Share to LinkedIn, X, Facebook and WhatsApp with the image and caption baked in — previews render beautifully.',
  },
  {
    Icon: BarChart3,
    title: 'Premium analytics',
    body: 'Track generates, shares, share-rate, unique attendees, top companies and daily trends from one dashboard.',
  },
  {
    Icon: Code2,
    title: 'Embed anywhere',
    body: 'Drop a floating widget onto your event site with a single snippet — your post builder, right where attendees are.',
  },
  {
    Icon: Zap,
    title: 'Live in minutes',
    body: 'Sign in, upload a template, map the photo and text slots, and publish a shareable event link instantly.',
  },
];

const STEPS = [
  { n: '01', title: 'Create your event', body: 'Sign in, add an event and upload one or more branded templates.' },
  { n: '02', title: 'Attendees personalize', body: 'They open your link, add their photo and details, and generate a card.' },
  { n: '03', title: 'They share, you measure', body: 'Posts go out across social platforms while your dashboard tracks the buzz.' },
];

// Annual billing = 10% off the monthly rate.
const ANNUAL_DISCOUNT = 0.10;
const CONTACT_EMAIL = 'admin@socialbuzz.app';

const PRICING: PricingTier[] = [
  {
    name: 'Starter',
    tagline: 'For trying it out',
    priceMonthly: 0,
    cta: 'Get started',
    highlight: false,
    note: 'No credit card required',
    features: [
      '1 event',
      '1 template per event',
      'Manual photo upload',
      'Basic generate & share counts',
      'Share to LinkedIn, X, Facebook & WhatsApp',
      'Community support',
    ],
  },
  {
    name: 'Pro',
    tagline: 'For active organizers',
    priceMonthly: 50,
    cta: 'Get started',
    highlight: true,
    features: [
      'Unlimited events',
      'Multiple templates + attendee gallery',
      'Remove background + Enhance',
      'Premium analytics, journeys & CSV export',
      'Rich link previews (Open Graph)',
      'Embeddable widget',
      'Email support',
    ],
  },
  {
    name: 'Enterprise',
    tagline: 'For brands & agencies',
    priceCustom: true,
    contact: true,
    cta: 'Contact sales',
    highlight: false,
    features: [
      'Everything in Pro',
      'LinkedIn auto-posting',
      'White-label & custom domain',
      'Exports / API access',
      'SSO & advanced security',
      'Priority support & onboarding',
    ],
  },
];

export default function MarketingPage({ onGetStarted }: Props) {
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');
  const isAnnual = billing === 'annual';
  return (
    <div className="min-h-screen w-full bg-white text-slate-900" style={{ minHeight: '100dvh' }}>

      {/* ── Nav ── */}
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/85 backdrop-blur-md">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5 sm:px-8">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-[9px]"
              style={{ background: BRAND_GRADIENT, boxShadow: '0 4px 14px rgba(124,58,237,0.4)' }}>
              <Sparkles size={17} color="white" strokeWidth={2.4} />
            </div>
            <span className="text-[17px] font-black tracking-tight"
              style={{ background: BRAND_GRADIENT, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              SocialBuzz
            </span>
          </div>
          <div className="flex items-center gap-3 sm:gap-5">
            <a href="#features" className="hidden text-[13px] font-semibold text-slate-600 transition-colors hover:text-violet-600 sm:block">Features</a>
            <a href="#pricing" className="hidden text-[13px] font-semibold text-slate-600 transition-colors hover:text-violet-600 sm:block">Pricing</a>
            <button
              onClick={onGetStarted}
              className="rounded-xl px-4 py-2 text-[13px] font-bold text-white transition-all duration-200 hover:-translate-y-0.5 active:scale-95"
              style={{ background: BRAND_GRADIENT, boxShadow: '0 4px 14px rgba(124,58,237,0.35)' }}
            >
              Admin Login
            </button>
          </div>
        </nav>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden px-5 pb-20 pt-16 sm:px-8 sm:pt-24" style={{ background: HERO_GRADIENT }}>
        {/* Glow orbs */}
        <div className="pointer-events-none absolute -right-20 -top-24 h-96 w-96 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.38) 0%, transparent 70%)', filter: 'blur(70px)' }} />
        <div className="pointer-events-none absolute -bottom-28 -left-20 h-96 w-96 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(109,40,217,0.5) 0%, transparent 70%)', filter: 'blur(70px)' }} />

        <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
          <div className="max-w-xl">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 backdrop-blur-sm">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-pink-400" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-white/90">Now in Beta</span>
            </div>

            <h1 className="mb-5 text-4xl font-black leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-[54px]">
              Turn every attendee into{' '}
              <span style={{ background: 'linear-gradient(90deg, #f9a8d4, #c4b5fd)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                your event&apos;s loudest fan.
              </span>
            </h1>

            <p className="mb-9 max-w-md text-[15px] leading-relaxed text-white/70 sm:text-base">
              SocialBuzz lets your attendees create personalized, on-brand social media cards in seconds —
              so your event spreads itself across LinkedIn, X and beyond.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                onClick={onGetStarted}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-3.5 text-[15px] font-bold text-slate-900 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-2xl active:scale-[0.98]"
              >
                Get started free
                <ArrowRight size={18} strokeWidth={2.4} />
              </button>
              <a
                href="#features"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/25 px-6 py-3.5 text-[15px] font-semibold text-white/90 backdrop-blur-sm transition-all duration-200 hover:bg-white/10"
              >
                See how it works
              </a>
            </div>

            <div className="mt-9 flex items-center gap-5 text-[12px] text-white/55">
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 size={14} /> No credit card</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 size={14} /> Set up in minutes</span>
            </div>
          </div>

          {/* Mock preview card */}
          <div className="flex justify-center lg:justify-end">
            <div
              className="w-full max-w-[320px] overflow-hidden rounded-2xl bg-white transition-transform duration-300 ease-out hover:-translate-y-1.5"
              style={{ boxShadow: '0 32px 64px rgba(0,0,0,0.42), 0 0 0 1px rgba(255,255,255,0.08)', transform: 'rotate(-1.5deg)' }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'rotate(0deg) translateY(-6px)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'rotate(-1.5deg)')}
            >
              <div className="relative flex h-[76px] items-end px-4 pb-2.5" style={{ background: BRAND_GRADIENT }}>
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/80">SocialBuzz Summit 2025 · Mumbai</span>
                <span className="absolute right-3 top-2.5 rounded border border-white/30 bg-white/15 px-2 py-0.5 text-[9px] font-bold text-white">✦ Speaker</span>
              </div>
              <div className="-mt-5 mb-2 flex items-end px-4">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border-[2.5px] border-white text-sm font-black text-white"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #ec4899)', boxShadow: '0 4px 12px rgba(124,58,237,0.4)' }}>
                  SR
                </div>
              </div>
              <div className="px-4 pb-4">
                <p className="text-[15px] font-bold text-slate-900">Sachitanand Rai</p>
                <p className="mt-0.5 text-[11px] text-slate-500">Senior Product Manager</p>
                <p className="mt-0.5 text-[11px] font-bold text-violet-600">Times Internet Ltd.</p>
                <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                  <span className="text-[10px] text-slate-400">in / sachitanand-rai</span>
                  <span className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-bold text-white" style={{ background: 'linear-gradient(135deg, #7c3aed, #ec4899)' }}>
                    <Share2 size={9} /> Share Post
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <p className="mb-3 text-[12px] font-bold uppercase tracking-widest text-violet-600">Everything you need</p>
          <h2 className="text-3xl font-black tracking-tight text-slate-900 sm:text-[40px]">
            Built to make your event unmissable
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-slate-500">
            From branded templates to real-time analytics — a complete toolkit for organizers and attendees alike.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ Icon, title, body }) => (
            <div key={title} className="group rounded-2xl border border-slate-100 bg-white p-6 transition-all duration-200 hover:-translate-y-1 hover:border-violet-200 hover:shadow-xl">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl text-white transition-transform duration-200 group-hover:scale-110"
                style={{ background: BRAND_GRADIENT, boxShadow: '0 6px 16px rgba(124,58,237,0.3)' }}>
                <Icon size={20} strokeWidth={2.2} />
              </div>
              <h3 className="mb-2 text-[16px] font-bold text-slate-900">{title}</h3>
              <p className="text-[13.5px] leading-relaxed text-slate-500">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="bg-slate-50 px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-14 text-center">
            <p className="mb-3 text-[12px] font-bold uppercase tracking-widest text-violet-600">How it works</p>
            <h2 className="text-3xl font-black tracking-tight text-slate-900 sm:text-[40px]">Three steps to liftoff</h2>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            {STEPS.map(({ n, title, body }) => (
              <div key={n} className="relative">
                <span className="text-5xl font-black text-transparent" style={{ background: BRAND_GRADIENT, WebkitBackgroundClip: 'text', backgroundClip: 'text' }}>{n}</span>
                <h3 className="mb-2 mt-3 text-[18px] font-bold text-slate-900">{title}</h3>
                <p className="text-[14px] leading-relaxed text-slate-500">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <div className="mx-auto mb-9 max-w-2xl text-center">
          <p className="mb-3 text-[12px] font-bold uppercase tracking-widest text-violet-600">Pricing</p>
          <h2 className="text-3xl font-black tracking-tight text-slate-900 sm:text-[40px]">Simple, transparent pricing</h2>
          <p className="mt-4 text-[15px] leading-relaxed text-slate-500">Start free. Upgrade when your events take off.</p>
        </div>

        {/* Billing toggle */}
        <div className="mb-12 flex items-center justify-center gap-3">
          <span className={`text-[13px] font-semibold ${isAnnual ? 'text-slate-400' : 'text-slate-900'}`}>Monthly</span>
          <button
            onClick={() => setBilling(isAnnual ? 'monthly' : 'annual')}
            role="switch"
            aria-checked={isAnnual}
            aria-label="Toggle annual billing"
            className="relative h-6 w-11 rounded-full transition-colors duration-200"
            style={{ background: isAnnual ? '#7c3aed' : '#cbd5e1' }}
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all duration-200 ${isAnnual ? 'left-[22px]' : 'left-0.5'}`} />
          </button>
          <span className={`flex items-center gap-1.5 text-[13px] font-semibold ${isAnnual ? 'text-slate-900' : 'text-slate-400'}`}>
            Annual
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-600">Save 10%</span>
          </span>
        </div>

        <div className="grid items-stretch gap-6 lg:grid-cols-3">
          {PRICING.map((tier) => {
            const hasPrice = tier.priceMonthly != null;
            const perMonth = tier.priceMonthly != null
              ? (isAnnual ? Math.round(tier.priceMonthly * (1 - ANNUAL_DISCOUNT)) : tier.priceMonthly)
              : 0;
            const annualTotal = tier.priceMonthly != null
              ? Math.round(tier.priceMonthly * 12 * (1 - ANNUAL_DISCOUNT))
              : 0;
            const ctaClasses = [
              'mb-6 block w-full rounded-2xl py-3 text-center text-[14px] font-bold transition-all duration-200 active:scale-[0.98]',
              tier.highlight ? 'text-white hover:-translate-y-0.5' : 'border border-slate-200 text-slate-800 hover:bg-slate-50',
            ].join(' ');
            return (
              <div
                key={tier.name}
                className={[
                  'relative flex flex-col rounded-3xl border bg-white p-7 transition-all duration-200',
                  tier.highlight ? 'border-violet-300 shadow-2xl lg:-translate-y-2' : 'border-slate-200 hover:border-violet-200 hover:shadow-lg',
                ].join(' ')}
              >
                {tier.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white" style={{ background: BRAND_GRADIENT }}>
                    Most popular
                  </span>
                )}

                <h3 className="text-[18px] font-black text-slate-900">{tier.name}</h3>
                <p className="mt-1 text-[13px] text-slate-500">{tier.tagline}</p>

                <div className="mb-1 mt-5 flex items-end gap-1">
                  {tier.priceCustom ? (
                    <span className="text-4xl font-black text-slate-900">Custom</span>
                  ) : perMonth === 0 ? (
                    <span className="text-4xl font-black text-slate-900">Free</span>
                  ) : (
                    <>
                      <span className="text-4xl font-black text-slate-900">${perMonth}</span>
                      <span className="mb-1 text-[13px] font-medium text-slate-400">/mo</span>
                    </>
                  )}
                </div>
                <p className="mb-6 h-4 text-[12px] text-slate-400">
                  {hasPrice && perMonth > 0
                    ? (isAnnual ? `billed $${annualTotal}/year` : 'billed monthly')
                    : ' '}
                </p>

                {tier.contact ? (
                  <a href={`mailto:${CONTACT_EMAIL}?subject=SocialBuzz%20Enterprise%20enquiry`} className={ctaClasses} style={tier.highlight ? { background: BRAND_GRADIENT } : undefined}>
                    {tier.cta}
                  </a>
                ) : (
                  <button onClick={onGetStarted} className={ctaClasses} style={tier.highlight ? { background: BRAND_GRADIENT } : undefined}>
                    {tier.cta}
                  </button>
                )}

                <ul className="mt-auto flex flex-col gap-3">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-[13.5px] text-slate-600">
                      <Check size={16} strokeWidth={2.6} className="mt-0.5 shrink-0 text-violet-600" />
                      {f}
                    </li>
                  ))}
                </ul>

                {tier.note && (
                  <p className="mt-5 text-center text-[11px] text-slate-400">{tier.note}</p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="px-5 py-20 sm:px-8">
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl px-8 py-16 text-center" style={{ background: HERO_GRADIENT }}>
          <div className="pointer-events-none absolute -right-10 -top-10 h-64 w-64 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.4) 0%, transparent 70%)', filter: 'blur(50px)' }} />
          <div className="relative z-10">
            <Users size={32} color="white" className="mx-auto mb-5 opacity-90" />
            <h2 className="mx-auto max-w-2xl text-3xl font-black leading-tight tracking-tight text-white sm:text-[40px]">
              Ready to amplify your next event?
            </h2>
            <p className="mx-auto mt-4 max-w-md text-[15px] text-white/70">
              Set up your first event in minutes and watch the shares roll in.
            </p>
            <button
              onClick={onGetStarted}
              className="mt-8 inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-7 py-3.5 text-[15px] font-bold text-slate-900 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-2xl active:scale-[0.98]"
            >
              Get started free
              <ArrowRight size={18} strokeWidth={2.4} />
            </button>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-100 px-5 py-10 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: BRAND_GRADIENT }}>
              <Sparkles size={14} color="white" strokeWidth={2.4} />
            </div>
            <span className="text-[15px] font-black tracking-tight"
              style={{ background: BRAND_GRADIENT, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              SocialBuzz
            </span>
          </div>
          <p className="text-[12px] text-slate-400">© 2026 SocialBuzz. Amplify every event.</p>
        </div>
      </footer>
    </div>
  );
}
