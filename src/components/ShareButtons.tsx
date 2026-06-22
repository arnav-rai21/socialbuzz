import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  CheckCircle,
  Copy,
  Download,
  Facebook,
  Instagram,
  Linkedin,
  Loader,
  MessageCircle,
  Share2,
  Twitter,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import type { GeneratedAsset, SharingSettings, UserProfile } from '../types';
import { DEFAULT_SHARING_SETTINGS } from '../types';
import {
  LINKEDIN_REDIRECT_URI,
  callCheckLinkedInToken,
  callGetLinkedInAuthUrl,
  callLogShareEvent,
  callPostToLinkedIn,
} from '../lib/server';

interface ShareButtonsProps {
  generatedAsset:    GeneratedAsset | null;
  finalImageDataUrl: string;
  profile:           UserProfile;
  sharingSettings?:  SharingSettings;
  eventSlug?:        string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchBlob(src: string): Promise<Blob> {
  if (src.startsWith('data:')) return (await fetch(src)).blob();
  return (await fetch(src, { mode: 'cors' })).blob();
}

async function copyBlobToClipboard(blob: Blob): Promise<boolean> {
  try {
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    return true;
  } catch (_) { return false; }
}

function downloadBlob(blob: Blob, fileName = 'social-post.png') {
  const url = URL.createObjectURL(blob);
  const a   = Object.assign(document.createElement('a'), { href: url, download: fileName });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const isMac    = /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent);
const pasteKey = isMac ? '⌘V' : 'Ctrl+V';

// ── Platform definitions ──────────────────────────────────────────────────────

const PLATFORMS = [
  { key: 'linkedin',  label: 'LinkedIn',  Icon: Linkedin,      bg: '#0a66c2', composeUrl: ''                           },
  { key: 'x',        label: 'X',         Icon: Twitter,       bg: '#000000', composeUrl: 'https://x.com/compose/post' },
  { key: 'facebook', label: 'Facebook',  Icon: Facebook,      bg: '#1877f2', composeUrl: 'https://www.facebook.com/'  },
  { key: 'whatsapp', label: 'WhatsApp',  Icon: MessageCircle, bg: '#16a34a', composeUrl: ''                           },
  { key: 'instagram',label: 'Instagram', Icon: Instagram,     bg: 'ig',      composeUrl: 'https://www.instagram.com/' },
] as const;

type PlatformKey = typeof PLATFORMS[number]['key'];

// ── LinkedIn phase ────────────────────────────────────────────────────────────

type LiPhase = 'idle' | 'connecting' | 'waiting' | 'posting' | 'success' | 'error';

// ── Component ─────────────────────────────────────────────────────────────────

export default function ShareButtons({
  generatedAsset,
  finalImageDataUrl,
  profile,
  sharingSettings,
  eventSlug,
}: ShareButtonsProps) {
  if (!generatedAsset) return null;

  const imageSrc  = generatedAsset.imageUrl || finalImageDataUrl;
  const ss        = sharingSettings || DEFAULT_SHARING_SETTINGS;

  // Pre-share modal
  const [activePlatform, setActivePlatform] = useState<PlatformKey | null>(null);
  const [caption,        setCaption]         = useState('');
  const [hashtags,       setHashtags]        = useState('');

  // LinkedIn OAuth states
  const [liPhase,  setLiPhase]  = useState<LiPhase>('idle');
  const [liError,  setLiError]  = useState('');
  const [liPostUrl, setLiPostUrl] = useState('');
  const popupRef    = useRef<Window | null>(null);
  const intervalsRef = useRef<{ token: ReturnType<typeof setInterval>; closed: ReturnType<typeof setInterval> } | null>(null);

  useEffect(() => () => {
    if (intervalsRef.current) {
      clearInterval(intervalsRef.current.token);
      clearInterval(intervalsRef.current.closed);
    }
    if (popupRef.current && !popupRef.current.closed) popupRef.current.close();
  }, []);

  // Close modal on Escape key
  useEffect(() => {
    if (!activePlatform) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePlatform]);

  // Open modal for a platform
  function openModal(key: PlatformKey) {
    setActivePlatform(key);
    setCaption(ss.defaultCaption || '');
    setHashtags(ss.defaultHashtags || '');
    setLiPhase('idle');
    setLiError('');
    setLiPostUrl('');
  }

  function closeModal() {
    setActivePlatform(null);
    if (intervalsRef.current) {
      clearInterval(intervalsRef.current.token);
      clearInterval(intervalsRef.current.closed);
      intervalsRef.current = null;
    }
    if (popupRef.current && !popupRef.current.closed) popupRef.current.close();
  }

  function fullCaption() {
    return [caption.trim(), hashtags.trim()].filter(Boolean).join('\n\n');
  }

  function logShare(platform: string) {
    callLogShareEvent({
      name:        profile.name,
      designation: profile.title,
      company:     profile.company,
      email:       profile.email || '',
      platform,
      imageUrl:    generatedAsset?.imageUrl || '',
      caption:     fullCaption(),
      eventSlug:   eventSlug || profile.eventSlug || 'default',
    });
  }

  // ── Generic share (non-LinkedIn) ──────────────────────────────────────────

  async function executeShare(platform: typeof PLATFORMS[number]) {
    const blob     = await fetchBlob(finalImageDataUrl).catch(() => fetchBlob(imageSrc));
    const fileName = generatedAsset.fileName || 'social-post.png';
    const cap      = fullCaption();
    const cloudUrl = generatedAsset.imageUrl || '';

    // ── Mobile: Web Share API ──────────────────────────────────────────────
    if (navigator.share) {
      try {
        const file        = new File([blob], fileName, { type: blob.type });
        const canShareFile = typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });

        if (!canShareFile && !cloudUrl) throw new Error('no-share-target');

        closeModal();

        if (canShareFile) {
          await navigator.share({ title: 'My Social Media Post', text: cap, files: [file] });
        } else {
          await navigator.share({ title: 'My Social Media Post', text: [cap, cloudUrl].filter(Boolean).join('\n\n') });
        }
        toast.success('Shared!');
        logShare(platform.key);
        return;
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
      }
    }

    // ── Desktop / fallback ─────────────────────────────────────────────────

    if (platform.key === 'whatsapp') {
      downloadBlob(blob, fileName);
      const waText = [cap, cloudUrl].filter(Boolean).join('\n\n');
      setTimeout(() => window.open('https://wa.me/?text=' + encodeURIComponent(waText), '_blank', 'noopener,noreferrer'), 350);
      toast.info('Image downloaded — open WhatsApp, tap Attach and select the file.', { duration: 9000 });
      logShare(platform.key);
      closeModal();
      return;
    }

    if (platform.key === 'instagram') {
      downloadBlob(blob, fileName);
      setTimeout(() => window.open('https://www.instagram.com/', '_blank', 'noopener,noreferrer'), 350);
      toast.info('Image downloaded — open Instagram, tap + New Post, and select the downloaded file.', { duration: 10000 });
      logShare(platform.key);
      closeModal();
      return;
    }

    if (platform.key === 'x') {
      const copied    = await copyBlobToClipboard(blob);
      const tweetParts = [cap, cloudUrl].filter(Boolean);
      const tweetUrl  = 'https://x.com/compose/post?text=' + encodeURIComponent(tweetParts.join('\n\n'));
      setTimeout(() => window.open(tweetUrl, '_blank', 'noopener,noreferrer'), 300);
      if (copied) {
        toast.success(`Image copied! In the X compose window, press ${pasteKey} to attach it as a photo.`, { duration: 10000 });
      } else {
        downloadBlob(blob, fileName);
        toast.info('Image downloaded — attach it in the X compose window.', { duration: 8000 });
      }
      logShare(platform.key);
      closeModal();
      return;
    }

    if (platform.key === 'facebook') {
      const copied = await copyBlobToClipboard(blob);
      if (cloudUrl) {
        const fbUrl = 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(cloudUrl);
        setTimeout(() => window.open(fbUrl, '_blank', 'noopener,noreferrer'), 300);
        if (!copied) downloadBlob(blob, fileName);
        toast.success('Opening Facebook share — your image URL is attached.', { duration: 7000 });
      } else {
        setTimeout(() => window.open('https://www.facebook.com/', '_blank', 'noopener,noreferrer'), 300);
        if (copied) {
          toast.success(`Image copied! Press ${pasteKey} to attach it in Facebook.`, { duration: 9000 });
        } else {
          downloadBlob(blob, fileName);
          toast.info('Image downloaded — attach it in the Facebook post composer.', { duration: 7000 });
        }
      }
      logShare(platform.key);
      closeModal();
      return;
    }

    const copied = await copyBlobToClipboard(blob);
    const url = platform.composeUrl as string;
    if (url) setTimeout(() => window.open(url, '_blank', 'noopener,noreferrer'), 300);
    if (copied) {
      toast.success(`Image copied! Press ${pasteKey} to attach it in ${platform.label}.`, { duration: 9000 });
    } else {
      downloadBlob(blob, fileName);
      toast.info(`Image downloaded — attach it in the ${platform.label} composer.`, { duration: 7000 });
    }
    logShare(platform.key);
    closeModal();
  }

  // ── LinkedIn OAuth + post ─────────────────────────────────────────────────

  function postWithState(state: string, imageSource: string, captionToUse: string) {
    setLiPhase('posting');
    callPostToLinkedIn(
      state, imageSource, captionToUse,
      (result) => {
        try { localStorage.setItem('li_session_state', state); } catch (_) {}
        setLiPhase('success');
        setLiPostUrl(result.postUrl || 'https://www.linkedin.com/feed/');
        toast.success('Posted to LinkedIn!');
        logShare('linkedin');
      },
      (err) => {
        // Token may have expired — clear saved session so next attempt re-auths
        try { localStorage.removeItem('li_session_state'); } catch (_) {}
        setLiPhase('error');
        setLiError(typeof err === 'string' ? err : (err as Error).message);
      }
    );
  }

  function openLinkedInOAuth(imageSource: string, captionToUse: string) {
    callGetLinkedInAuthUrl(
      ({ authUrl, state }) => {
        const pw = 800, ph = 760;
        const pl = Math.round((window.screen.width  - pw) / 2);
        const pt = Math.round((window.screen.height - ph) / 2);
        const popup = window.open(authUrl, 'linkedin_oauth', `width=${pw},height=${ph},left=${pl},top=${pt},scrollbars=yes`);
        if (!popup) { setLiPhase('error'); setLiError('Popup blocked — allow popups and try again.'); return; }
        popupRef.current = popup;
        setLiPhase('waiting');

        let pollActive = false;
        let tokenPoll: ReturnType<typeof setInterval>;
        let closedPoll: ReturnType<typeof setInterval>;

        tokenPoll = setInterval(() => {
          if (pollActive) return;
          pollActive = true;
          callCheckLinkedInToken(
            state,
            ({ ready }) => {
              pollActive = false;
              if (!ready) return;
              clearInterval(tokenPoll);
              clearInterval(closedPoll);
              intervalsRef.current = null;
              try { popup.close(); } catch (_) {}
              postWithState(state, imageSource, captionToUse);
            },
            () => { pollActive = false; }
          );
        }, 2000);

        closedPoll = setInterval(() => {
          if (!popup.closed) return;
          clearInterval(closedPoll);
          clearInterval(tokenPoll);
          intervalsRef.current = null;
          setLiPhase(prev => {
            if (prev === 'waiting') {
              setLiError('Authentication window closed without completing. Check that your LinkedIn Developer App has "Sign In with LinkedIn using OpenID Connect" and "Share on LinkedIn" Products enabled.');
              return 'error';
            }
            return prev;
          });
        }, 900);

        intervalsRef.current = { token: tokenPoll, closed: closedPoll };
      },
      (err) => { setLiPhase('error'); setLiError(typeof err === 'string' ? err : (err as Error).message); }
    );
  }

  function startLinkedInAuth() {
    let imageSource = generatedAsset?.imageUrl || '';
    if (!imageSource && finalImageDataUrl) {
      const m = finalImageDataUrl.match(/^data:[^;]+;base64,(.+)$/);
      imageSource = m ? m[1] : '';
    }
    if (!imageSource) { toast.error('Generate the image first.'); return; }

    const captionToUse = fullCaption();
    setLiPhase('connecting');
    setLiError('');

    // Check if a previous LinkedIn session is still valid — skip OAuth if so
    let savedState: string | null = null;
    try { savedState = localStorage.getItem('li_session_state'); } catch (_) {}

    if (savedState) {
      callCheckLinkedInToken(
        savedState,
        ({ ready }) => {
          if (ready) {
            postWithState(savedState!, imageSource, captionToUse);
          } else {
            try { localStorage.removeItem('li_session_state'); } catch (_) {}
            openLinkedInOAuth(imageSource, captionToUse);
          }
        },
        () => {
          try { localStorage.removeItem('li_session_state'); } catch (_) {}
          openLinkedInOAuth(imageSource, captionToUse);
        }
      );
    } else {
      openLinkedInOAuth(imageSource, captionToUse);
    }
  }

  // ── Utility buttons ───────────────────────────────────────────────────────

  async function handleCopy() {
    try {
      const blob = await fetchBlob(imageSrc);
      if (await copyBlobToClipboard(blob)) toast.success('Image copied to clipboard!');
      else { downloadBlob(blob, generatedAsset.fileName); toast.info('Clipboard unavailable — image downloaded.'); }
    } catch { toast.error('Could not copy image.'); }
  }

  async function handleDownload() {
    try {
      const src  = finalImageDataUrl || imageSrc;
      const blob = await fetchBlob(src);
      downloadBlob(blob, generatedAsset.fileName || 'social-post.png');
      toast.success('Image downloaded!');
    } catch { toast.error('Download failed.'); }
  }

  // ── Active platform data ──────────────────────────────────────────────────

  const activePlatformData = PLATFORMS.find(p => p.key === activePlatform);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4">

      {/* Platform grid — 3 columns × 2 rows (5 social + Copy) */}
      <div className="grid grid-cols-3 gap-x-3 gap-y-4">
        {PLATFORMS.map((p) => {
          const isIG = p.key === 'instagram';
          return (
            <button key={p.key} onClick={() => openModal(p.key)}
              className="flex flex-col items-center gap-1.5 cursor-pointer">
              <div className="w-14 h-14 rounded-full flex items-center justify-center shadow-sm active:scale-95 transition-transform"
                style={isIG ? { background: 'linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)' } : { background: p.bg }}>
                <p.Icon size={24} className="text-white" />
              </div>
              <span className="text-[11px] font-semibold text-slate-600">{p.label}</span>
            </button>
          );
        })}

        {/* Copy — 6th cell */}
        <button onClick={handleCopy} className="flex flex-col items-center gap-1.5 cursor-pointer">
          <div className="w-14 h-14 rounded-full flex items-center justify-center shadow-sm active:scale-95 transition-transform bg-slate-500">
            <Copy size={24} className="text-white" />
          </div>
          <span className="text-[11px] font-semibold text-slate-600">Copy</span>
        </button>
      </div>

      {/* Download — full-width row below grid */}
      <button onClick={handleDownload}
        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-2xl border border-slate-200 text-slate-600 text-sm font-semibold cursor-pointer hover:bg-slate-50 active:scale-[0.98] transition-all">
        <Download size={15} /> Download Image
      </button>

      {/* ── Pre-share modal ─────────────────────────────────────────────── */}
      {activePlatform && activePlatformData && createPortal(
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>

          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden max-h-[90vh] overflow-y-auto">

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-sm"
                  style={activePlatform === 'instagram'
                    ? { background: 'linear-gradient(135deg,#f09433,#dc2743,#bc1888)' }
                    : { background: activePlatformData.bg }}>
                  <activePlatformData.Icon size={15} />
                </div>
                <span className="font-bold text-slate-900 text-sm">Share to {activePlatformData.label}</span>
              </div>
              <button onClick={closeModal}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 cursor-pointer transition-colors">
                <X size={15} />
              </button>
            </div>

            <div className="px-5 pb-5 flex flex-col gap-3">

              {/* Caption + hashtags — shown when idle or after error */}
              {(liPhase === 'idle' || liPhase === 'error') && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Write about this post</label>
                    <textarea
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      placeholder="What would you like to say? (optional)"
                      rows={4}
                      className="w-full text-sm border border-slate-200 rounded-2xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-slate-50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Hashtags</label>
                    <input
                      type="text"
                      value={hashtags}
                      onChange={(e) => setHashtags(e.target.value)}
                      placeholder="#socialmedia #networking"
                      className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-slate-50"
                    />
                  </div>
                </>
              )}

              {/* LinkedIn-specific status messages */}
              {activePlatform === 'linkedin' && liPhase === 'error' && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-2xl p-3">
                  <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-600 break-words">{liError}</p>
                </div>
              )}
              {activePlatform === 'linkedin' && liPhase === 'connecting' && (
                <div className="flex items-center gap-2 text-sm text-slate-600 py-2">
                  <Loader size={14} className="animate-spin text-[#0a66c2] shrink-0" /> Connecting to LinkedIn…
                </div>
              )}
              {activePlatform === 'linkedin' && liPhase === 'waiting' && (
                <div className="flex items-center gap-2 text-sm text-slate-600 py-2">
                  <Loader size={14} className="animate-spin text-[#0a66c2] shrink-0" /> Complete sign-in in the popup…
                </div>
              )}
              {activePlatform === 'linkedin' && liPhase === 'posting' && (
                <div className="flex items-center gap-2 text-sm text-slate-600 py-2">
                  <Loader size={14} className="animate-spin text-[#0a66c2] shrink-0" /> Uploading &amp; publishing your post…
                </div>
              )}
              {activePlatform === 'linkedin' && liPhase === 'success' && (
                <div className="flex items-center gap-3 bg-green-50 border border-green-100 rounded-2xl p-3">
                  <CheckCircle size={18} className="text-green-500 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-green-700">Post published!</p>
                    <a href={liPostUrl} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-[#0a66c2] underline underline-offset-2">Open LinkedIn feed →</a>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2 mt-1">
                <button onClick={closeModal}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold cursor-pointer hover:bg-slate-50 transition-colors">
                  {liPhase === 'success' ? 'Close' : 'Cancel'}
                </button>
                {liPhase !== 'success' && (
                  <button
                    onClick={() => activePlatform === 'linkedin' ? startLinkedInAuth() : executeShare(activePlatformData as any)}
                    disabled={liPhase === 'connecting' || liPhase === 'waiting' || liPhase === 'posting'}
                    style={activePlatform === 'instagram'
                      ? { background: 'linear-gradient(135deg,#f09433,#dc2743,#bc1888)' }
                      : { background: activePlatformData.bg }}
                    className="flex-[2] flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-bold cursor-pointer transition-all disabled:opacity-60 disabled:cursor-not-allowed hover:brightness-110"
                  >
                    {liPhase === 'connecting' || liPhase === 'waiting' || liPhase === 'posting'
                      ? <><Loader size={14} className="animate-spin" /> Working…</>
                      : <><Share2 size={14} /> Post to {activePlatformData.label}</>
                    }
                  </button>
                )}
              </div>

            </div>
          </div>
        </div>
      , document.body)}

    </div>
  );
}
