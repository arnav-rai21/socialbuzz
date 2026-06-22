import { useState } from 'react';
import AdminLogin from './AdminLogin';

interface Props {
  onAuthenticated: (email: string, name: string) => void;
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

export default function LandingPage({ onAuthenticated }: Props) {
  const [showLogin, setShowLogin] = useState(false);

  return (
    <>
      <div className="min-h-screen flex flex-col lg:flex-row">

        {/* ── LEFT — value prop ── */}
        <div
          className="lg:w-[55%] relative flex flex-col justify-center px-8 py-16 lg:px-16 overflow-hidden"
          style={{ background: 'linear-gradient(140deg, #1e0a4a 0%, #3b0d8a 25%, #6d28d9 55%, #a21caf 80%, #be185d 100%)' }}
        >
          {/* Glow orbs */}
          <div className="pointer-events-none absolute -top-20 -right-16 w-80 h-80 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.38) 0%, transparent 70%)', filter: 'blur(60px)' }} />
          <div className="pointer-events-none absolute -bottom-20 -left-16 w-80 h-80 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(109,40,217,0.45) 0%, transparent 70%)', filter: 'blur(60px)' }} />
          <div className="pointer-events-none absolute top-1/2 left-2/3 w-48 h-48 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(251,191,36,0.08) 0%, transparent 70%)', filter: 'blur(40px)' }} />

          <div className="relative z-10 max-w-lg">
            {/* Live badge */}
            <div className="inline-flex items-center gap-2 mb-7 px-4 py-1.5 rounded-full border border-white/20 bg-white/10 backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-pulse" />
              <span className="text-[11px] font-bold tracking-widest uppercase text-white/90">Now in Beta</span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl lg:text-[46px] font-black text-white leading-[1.1] tracking-tight mb-5">
              Create your event post{' '}
              <span style={{ background: 'linear-gradient(90deg, #f9a8d4, #c4b5fd)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                in minutes.
              </span>
            </h1>

            <p className="text-[15px] text-white/65 leading-relaxed mb-10 max-w-md">
              Join thousands of professionals building personalized social media cards to amplify their presence at every event.
            </p>

            {/* Mock preview card */}
            <div
              className="bg-white rounded-2xl overflow-hidden max-w-[300px] transition-all duration-300 ease-out hover:-translate-y-1.5"
              style={{ boxShadow: '0 32px 64px rgba(0,0,0,0.38), 0 0 0 1px rgba(255,255,255,0.08)', transform: 'rotate(-1.5deg)' }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'rotate(0deg)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'rotate(-1.5deg)')}
            >
              {/* Banner */}
              <div className="h-[68px] flex items-end px-4 pb-2.5 relative"
                style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 60%, #ec4899 100%)' }}>
                <span className="text-[9px] font-bold uppercase tracking-widest text-white/75">ETB2B Summit 2025 · Mumbai</span>
                <span className="absolute top-2.5 right-3 text-[9px] font-bold text-white rounded px-2 py-0.5 border border-white/30 bg-white/15">✦ Speaker</span>
              </div>

              {/* Avatar */}
              <div className="px-4 flex items-end -mt-5 mb-2">
                <div className="w-10 h-10 rounded-full border-[2.5px] border-white flex items-center justify-center text-sm font-black text-white flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #ec4899)', boxShadow: '0 4px 12px rgba(124,58,237,0.4)' }}>
                  SR
                </div>
              </div>

              {/* Body */}
              <div className="px-4 pb-4">
                <p className="font-bold text-slate-900 text-[15px]">Sachitanand Rai</p>
                <p className="text-slate-500 text-[11px] mt-0.5">Senior Product Manager</p>
                <p className="text-violet-600 text-[11px] font-bold mt-0.5">Times Internet Ltd.</p>
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-1 text-slate-400 text-[10px]">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="#0a66c2"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
                    sachitanand-rai
                  </div>
                  <button className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-white text-[10px] font-bold"
                    style={{ background: 'linear-gradient(135deg, #7c3aed, #ec4899)' }}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                    Share Post
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* ── RIGHT — admin login ── */}
        <div className="lg:w-[45%] flex flex-col items-center justify-center bg-white px-8 py-16 lg:px-14">
          <div className="w-full max-w-[340px]">

            {/* Logo */}
            <div className="flex items-center gap-2.5 mb-10">
              <div className="w-9 h-9 rounded-[10px] flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #ec4899)', boxShadow: '0 4px 14px rgba(124,58,237,0.4)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"/>
                </svg>
              </div>
              <span className="text-[17px] font-black tracking-tight"
                style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed 50%, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                ETB2B Social Buzz
              </span>
            </div>

            <h2 className="text-[26px] font-black text-slate-900 tracking-tight mb-2">Admin Portal</h2>
            <p className="text-sm text-slate-500 leading-relaxed mb-8">
              Sign in with your{' '}
              <span className="font-semibold text-violet-600">@timesinternet.in</span>{' '}
              Google account to manage events and templates.
            </p>

            {/* Sign in button */}
            <button
              onClick={() => setShowLogin(true)}
              className="w-full flex items-center justify-center gap-3 px-5 py-3.5 rounded-2xl border-[1.5px] border-slate-200 bg-white text-slate-800 font-semibold text-[14px] cursor-pointer transition-all duration-200 shadow-sm hover:border-violet-300 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98]"
            >
              <GoogleIcon />
              Sign in with Google
            </button>

            {/* Info note */}
            <div className="mt-5 p-4 rounded-xl bg-violet-50 border border-violet-100/80">
              <p className="text-[12px] text-violet-600/80 text-center leading-relaxed">
                Event links are shared directly with attendees.<br/>
                <span className="font-semibold text-violet-700">Admins only</span> sign in here to manage events.
              </p>
            </div>

            {/* Footer */}
            <p className="mt-8 text-center text-[11px] text-slate-400 leading-relaxed">
              By signing in you agree to our{' '}
              <span className="text-violet-400">Terms of Service</span>
              {' '}and{' '}
              <span className="text-violet-400">Privacy Policy</span>
            </p>
          </div>
        </div>

      </div>

      {showLogin && (
        <AdminLogin
          onAuthenticated={(email, name) => {
            setShowLogin(false);
            onAuthenticated(email, name);
          }}
          onClose={() => setShowLogin(false)}
        />
      )}
    </>
  );
}
