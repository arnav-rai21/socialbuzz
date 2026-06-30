// Google Identity Services (One Tap) loader + prompt helper.
//
// The production bundle is built with vite-plugin-singlefile (everything inlined),
// so the GSI client script must be injected at runtime rather than referenced
// statically in the HTML.

const GSI_SRC = 'https://accounts.google.com/gsi/client';

let gsiPromise: Promise<boolean> | null = null;

function loadGsi(): Promise<boolean> {
  if (gsiPromise) return gsiPromise;
  gsiPromise = new Promise<boolean>((resolve) => {
    if (typeof document === 'undefined') { resolve(false); return; }
    if ((window as any).google?.accounts?.id) { resolve(true); return; }
    const existing = document.querySelector(`script[src="${GSI_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(true));
      existing.addEventListener('error', () => resolve(false));
      return;
    }
    const s = document.createElement('script');
    s.src = GSI_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
  return gsiPromise;
}

/**
 * Show Google One Tap. Invokes `onCredential` with the ID-token JWT when the
 * visitor selects an account. Resolves to a no-op if GSI can't load, the client
 * id is missing, the visitor isn't signed into Google, or they dismiss the prompt
 * (incl. cross-origin iframe restrictions inside the embedded widget).
 */
export async function promptOneTap(
  clientId: string,
  onCredential: (credential: string) => void,
  opts: { autoSelect?: boolean } = {},
): Promise<void> {
  if (!clientId) return;
  const ok = await loadGsi();
  if (!ok) return;
  const id = (window as any).google?.accounts?.id;
  if (!id) return;
  try {
    id.initialize({
      client_id: clientId,
      callback: (resp: { credential?: string }) => {
        if (resp?.credential) onCredential(resp.credential);
      },
      auto_select: opts.autoSelect !== false, // silent re-issue on repeat visits; false forces the chooser ("switch account")
      itp_support: true,                       // Safari / ITP support
      use_fedcm_for_prompt: true,              // required by Chrome's FedCM migration
      cancel_on_tap_outside: false,
    });
    id.prompt();
  } catch {
    /* One Tap unavailable (e.g. blocked in cross-origin iframe) — fall back to the manual form. */
  }
}

/** Stop One Tap from silently re-signing the visitor in (call on sign-out). */
export function disableOneTapAutoSelect(): void {
  try { (window as any).google?.accounts?.id?.disableAutoSelect?.(); } catch { /* no-op */ }
}

/**
 * Render Google's official "Sign in with Google" button into `container`.
 * Clicking it reliably opens the account chooser (unlike the passive One Tap
 * prompt, it isn't subject to display cooldowns) — so it's the dependable
 * sign-in / switch-account entry point and a guaranteed recovery affordance.
 */
export async function renderGoogleButton(
  container: HTMLElement,
  clientId: string,
  onCredential: (credential: string) => void,
): Promise<void> {
  if (!clientId || !container) return;
  const ok = await loadGsi();
  if (!ok) return;
  const id = (window as any).google?.accounts?.id;
  if (!id) return;
  try {
    id.initialize({
      client_id: clientId,
      callback: (resp: { credential?: string }) => { if (resp?.credential) onCredential(resp.credential); },
      use_fedcm_for_prompt: true,
      itp_support: true,
    });
    container.innerHTML = '';
    id.renderButton(container, { type: 'standard', theme: 'outline', size: 'medium', text: 'signin_with', shape: 'pill' });
  } catch {
    /* no-op */
  }
}
