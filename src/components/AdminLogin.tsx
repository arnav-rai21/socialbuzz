import { useEffect, useRef, useState } from 'react';
import { Loader, ShieldCheck, ShieldOff, X } from 'lucide-react';

import { ADMIN_EMAIL, GOOGLE_CLIENT_ID, GOOGLE_REDIRECT_URI_G, callCheckAdminAccess, callCheckGoogleToken, callRequestAdminAccess } from '../lib/server';

// ── Types ─────────────────────────────────────────────────────────────────────

type Phase =
  | 'idle'
  | 'waiting'
  | 'checking'
  | 'access_denied'
  | 'request_sent'
  | 'requesting'
  | 'error';

interface AdminLoginProps {
  onAuthenticated: (email: string, name: string) => void;
  onClose:         () => void;
}

// ── Google G SVG ──────────────────────────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function randomState(): string {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

function buildOAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id:     GOOGLE_CLIENT_ID,
    redirect_uri:  GOOGLE_REDIRECT_URI_G,
    response_type: 'code',
    scope:         'openid email profile',

    access_type:   'online',
    state,
    prompt:        'select_account',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminLogin({ onAuthenticated, onClose }: AdminLoginProps) {
  const [phase,         setPhase]         = useState<Phase>('idle');
  const [errorMsg,      setErrorMsg]      = useState('');
  const [pendingEmail,  setPendingEmail]  = useState('');
  const [pendingName,   setPendingName]   = useState('');

  const stateRef   = useRef<string>('');
  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const popupRef   = useRef<Window | null>(null);

  // ── Cleanup on unmount ────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // ── postMessage listener ──────────────────────────────────────────────────

  useEffect(() => {
    function onMessage(evt: MessageEvent) {
      if (!evt.data || evt.data.type !== 'google_auth_result') return;
      if (pollRef.current) clearInterval(pollRef.current);
      try { popupRef.current?.close(); } catch (_) {}

      const { status, email, name } = evt.data as {
        status: string;
        email:  string;
        name:   string;
        state:  string;
      };

      if (status === 'success') {
        handleGoogleSuccess(email, name);
      } else if (status === 'domain_error') {
        setPhase('error');
        setErrorMsg('Access was denied for this account.');
      } else {
        setPhase('error');
        setErrorMsg(evt.data.message || 'Google sign-in failed.');
      }
    }

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── OAuth popup ───────────────────────────────────────────────────────────

  function openGooglePopup() {
    if (!GOOGLE_CLIENT_ID) {
      setPhase('error');
      setErrorMsg('Google OAuth is not configured for this deployment.');
      return;
    }

    const state = randomState();
    stateRef.current = state;

    const url    = buildOAuthUrl(state);
    const width  = 500;
    const height = 620;
    const left   = Math.max(0, (window.innerWidth  - width)  / 2 + window.screenX);
    const top    = Math.max(0, (window.innerHeight - height) / 2 + window.screenY);

    popupRef.current = window.open(
      url,
      'google_oauth',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );

    if (!popupRef.current) {
      setPhase('error');
      setErrorMsg('Popup was blocked. Please allow popups for this site and try again.');
      return;
    }

    setPhase('waiting');

    // GAS polling fallback — postMessage may not arrive if popup is sandboxed
    let attempts = 0;
    pollRef.current = setInterval(() => {
      attempts++;

      // Check if popup closed without postMessage
      if (popupRef.current?.closed && phase === 'waiting' && attempts > 2) {
        clearInterval(pollRef.current!);
        // Try GAS poll in case callback posted session but window closed
        setPhase('checking');
        callCheckGoogleToken(
          stateRef.current,
          (result) => {
            if (result.ready) {
              handleGoogleSuccess(result.email, result.name);
            } else {
              // Popup closed, no session — user probably cancelled
              setPhase('idle');
            }
          },
          () => setPhase('idle')
        );
        return;
      }

      if (attempts > 60) {
        clearInterval(pollRef.current!);
        setPhase('error');
        setErrorMsg('Sign-in timed out. Please try again.');
        return;
      }

      callCheckGoogleToken(
        stateRef.current,
        (result) => {
          if (result.ready) {
            clearInterval(pollRef.current!);
            try { popupRef.current?.close(); } catch (_) {}
            handleGoogleSuccess(result.email, result.name);
          }
        },
        () => { /* keep polling */ }
      );
    }, 3000);
  }

  // ── After Google confirms email ───────────────────────────────────────────

  function handleGoogleSuccess(email: string, name: string) {
    setPendingEmail(email);
    setPendingName(name);
    setPhase('checking');

    // Super-admin is always approved — no round-trip needed
    if (email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
      onAuthenticated(email, name);
      return;
    }

    callCheckAdminAccess(
      email,
      (result) => {
        if (result.approved) {
          onAuthenticated(email, name);
        } else {
          setPhase('access_denied');
        }
      },
      () => setPhase('access_denied')
    );
  }

  // ── Request access ────────────────────────────────────────────────────────

  function handleRequestAccess() {
    setPhase('requesting');
    callRequestAdminAccess(
      pendingEmail,
      pendingName,
      (result) => {
        if (result.alreadyPending) {
          setPhase('request_sent');
          setErrorMsg('Your request is already pending approval.');
        } else if (result.success) {
          setPhase('request_sent');
          setErrorMsg('');
        } else {
          setPhase('error');
          setErrorMsg('Could not send request. Please try again.');
        }
      },
      (err) => {
        setPhase('error');
        setErrorMsg((err as Error)?.message ?? String(err));
      }
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 flex flex-col items-center gap-6 relative">

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 cursor-pointer transition-colors active:scale-95"
          aria-label="Close"
        >
          <X size={15} />
        </button>

        {/* Logo / Icon */}
        <div className="w-16 h-16 rounded-2xl bg-violet-50 border border-violet-100 flex items-center justify-center">
          {phase === 'access_denied' || phase === 'error' ? (
            <ShieldOff size={30} className="text-red-400" />
          ) : phase === 'request_sent' ? (
            <ShieldCheck size={30} className="text-emerald-500" />
          ) : (
            <ShieldCheck size={30} className="text-violet-600" />
          )}
        </div>

        {/* Heading */}
        <div className="text-center">
          {phase === 'request_sent' ? (
            <>
              <h2 className="text-xl font-black text-slate-900">Request Sent</h2>
              <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
                {errorMsg || 'Your access request has been submitted. You will be notified once an admin approves it.'}
              </p>
            </>
          ) : phase === 'access_denied' ? (
            <>
              <h2 className="text-xl font-black text-slate-900">Access Required</h2>
              <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
                <span className="font-semibold text-slate-700">{pendingEmail}</span> is signed in but does not have admin access yet.
              </p>
            </>
          ) : phase === 'error' ? (
            <>
              <h2 className="text-xl font-black text-slate-900">Sign-in Failed</h2>
              <p className="text-sm text-red-500 mt-1.5 leading-relaxed">{errorMsg}</p>
            </>
          ) : (
            <>
              <h2 className="text-xl font-black text-slate-900">Admin Sign In</h2>
              <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
                Use your Google account to access the admin dashboard.
              </p>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="w-full flex flex-col gap-3">

          {/* Primary action */}
          {(phase === 'idle' || phase === 'error') && (
            <button
              onClick={openGooglePopup}
              className="w-full flex items-center justify-center gap-3 px-5 py-3 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-sm cursor-pointer transition-colors active:scale-[0.98] shadow-sm"
            >
              <GoogleIcon />
              Sign in with Google
            </button>
          )}

          {(phase === 'waiting' || phase === 'checking' || phase === 'requesting') && (
            <div className="flex items-center justify-center gap-3 py-3 text-slate-500 text-sm">
              <Loader size={17} className="animate-spin text-violet-500" />
              {phase === 'waiting'   ? 'Waiting for Google sign-in…'
              : phase === 'checking' ? 'Verifying your account…'
              :                        'Sending access request…'}
            </div>
          )}

          {phase === 'access_denied' && (
            <>
              <button
                onClick={handleRequestAccess}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-violet-600 text-white font-bold text-sm cursor-pointer hover:bg-violet-700 transition-colors active:scale-[0.98]"
              >
                Request Admin Access
              </button>
              <button
                onClick={() => { setPhase('idle'); setPendingEmail(''); setPendingName(''); }}
                className="w-full flex items-center justify-center px-5 py-2.5 rounded-2xl border border-slate-200 text-slate-600 font-semibold text-sm cursor-pointer hover:bg-slate-50 transition-colors active:scale-[0.98]"
              >
                Try another account
              </button>
            </>
          )}

          {phase === 'request_sent' && (
            <button
              onClick={onClose}
              className="w-full flex items-center justify-center px-5 py-3 rounded-2xl bg-slate-100 text-slate-700 font-semibold text-sm cursor-pointer hover:bg-slate-200 transition-colors active:scale-[0.98]"
            >
              Close
            </button>
          )}

        </div>

        {/* Footer note */}
        {(phase === 'idle' || phase === 'error') && (
          <p className="text-xs text-slate-400 text-center">
            Sign in with any Google account.
          </p>
        )}

      </div>
    </div>
  );
}
