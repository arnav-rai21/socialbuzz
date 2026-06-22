import type {
  FontSettings,
  GeneratedAsset,
  ImageSlot,
  SharingSettings,
  TemplateConfig,
  UserProfile,
} from '../types';

// ── Constants ─────────────────────────────────────────────────────────────────

export const IS_GAS: boolean = false; // Always Vercel — GAS removed

const _env = (import.meta as any).env ?? {};
export const ADMIN_EMAIL:          string = 'sachitanand.rai@timesinternet.in';
export const GAS_USER_EMAIL:       string = '';
export const IS_GAS_ADMIN:         boolean = false;
export const LINKEDIN_REDIRECT_URI: string = '';

export const GOOGLE_CLIENT_ID: string =
  (_env.VITE_GOOGLE_CLIENT_ID as string) || '';
export const GOOGLE_REDIRECT_URI_G: string =
  (_env.VITE_GOOGLE_REDIRECT_URI as string) ||
  'https://etb2b-events.vercel.app/api/google-callback';

export const INITIAL_EVENT_SLUG: string =
  (new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('event')) ||
  'default';

export const INITIAL_MODE: string =
  (new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('mode')) ||
  '';

export const DEFAULT_SLOT: ImageSlot = { x: 880, y: 640, width: 520, height: 520, radius: 32 };

export const DEFAULT_TEMPLATE_CONFIG: TemplateConfig = {
  hasTemplate:     false,
  templateName:    '',
  templateDataUrl: '',
  imageSlot:       { ...DEFAULT_SLOT },
};

/** Synchronous load — always returns empty config since bootstrap is async on Vercel. */
export function loadBootstrap(): TemplateConfig {
  return { ...DEFAULT_TEMPLATE_CONFIG, imageSlot: { ...DEFAULT_SLOT } };
}

// ── Route map: action → API endpoint ─────────────────────────────────────────

const ACTION_ROUTES: Record<string, string> = {
  saveTemplate:          '/api/template',
  uploadImage:           '/api/upload',
  logShare:              '/api/log-share',
  getEventsList:         '/api/events',
  createEvent:           '/api/events',
  deleteEvent:           '/api/events',
  getEventStats:         '/api/stats',
  getLinkedInAuthUrl:    '/api/linkedin',
  postToLinkedIn:        '/api/linkedin',
  checkLinkedInToken:    '/api/linkedin',
  storeGoogleSession:    '/api/auth',
  checkGoogleToken:      '/api/auth',
  checkAdminAccess:      '/api/admin',
  requestAdminAccess:    '/api/admin',
  getPendingRequests:    '/api/admin',
  approveAccessRequest:  '/api/admin',
  denyAccessRequest:     '/api/admin',
  revokeAdminAccess:     '/api/admin',
};

async function callApi<T>(body: Record<string, unknown>): Promise<T> {
  const action   = (body.action as string) || '';
  const endpoint = ACTION_ROUTES[action];
  if (!endpoint) throw new Error(`Unknown action: ${action}`);

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });
  } catch {
    throw new Error('API_UNAVAILABLE');
  }

  const text = await res.text();
  if (!text.trimStart().startsWith('{')) throw new Error('API_UNAVAILABLE');
  const json = JSON.parse(text) as { success: boolean; data?: T; error?: string };
  if (!json.success) throw new Error(json.error || 'API call failed');
  return json.data as T;
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

export async function loadBootstrapAsync(eventSlug: string): Promise<{
  templateConfig:      TemplateConfig;
  adminEmail:          string;
  eventsList?:         import('../types').EventMeta[];
  linkedInRedirectUri?: string;
  googleClientId?:     string;
  googleRedirectUri?:  string;
} | null> {
  try {
    const mode = INITIAL_MODE;
    const url  = `/api/bootstrap?event=${encodeURIComponent(eventSlug)}${mode ? `&mode=${encodeURIComponent(mode)}` : ''}`;
    const res  = await fetch(url);
    const text = await res.text();
    if (!text.trimStart().startsWith('{')) return null;
    const json = JSON.parse(text);
    if (json.success && json.data) return json.data;
  } catch (_) {}
  return null;
}

// ── Template save ─────────────────────────────────────────────────────────────

export interface SaveTemplatePayload {
  fileName:         string;
  templateDataUrl:  string;
  imageSlot:        ImageSlot;
  textSlot?:        import('../types').TextSlot;
  fontSettings?:    FontSettings;
  sharingSettings?: SharingSettings;
  fieldSettings?:   import('../types').FieldSettings;
  eventSlug:        string;
}

export function callSaveTemplate(
  payload:   SaveTemplatePayload,
  onSuccess: (config: TemplateConfig) => void,
  onFailure: (err: Error | string) => void
): void {
  callApi<TemplateConfig>({ action: 'saveTemplate', payload })
    .then(onSuccess)
    .catch(onFailure);
}

// ── Image upload ───────────────────────────────────────────────────────────────

export function callUploadImage(
  base64Data: string,
  profile:    UserProfile,
  onSuccess:  (asset: GeneratedAsset) => void,
  onFailure:  (err: Error | string) => void
): void {
  callApi<GeneratedAsset>({ action: 'uploadImage', base64Data, profile })
    .then(onSuccess)
    .catch(onFailure);
}

// ── Share event logging ───────────────────────────────────────────────────────

export interface ShareEventData {
  name:        string;
  designation: string;
  company:     string;
  email?:      string;
  platform:    string;
  imageUrl:    string;
  caption:     string;
  eventSlug:   string;
}

export function callLogShareEvent(data: ShareEventData): void {
  callApi({ action: 'logShare', data }).catch(() => {});
}

// ── Events list ────────────────────────────────────────────────────────────────

export function callGetEventsList(
  onSuccess: (result: { events: import('../types').EventMeta[] }) => void,
  onFailure: (err: Error | string) => void
): void {
  callApi<{ events: import('../types').EventMeta[] }>({ action: 'getEventsList' })
    .then(onSuccess)
    .catch(onFailure);
}

// ── Create event ───────────────────────────────────────────────────────────────

export function callCreateEvent(
  slug:      string,
  name:      string,
  onSuccess: (result: { success: boolean; slug: string; name: string }) => void,
  onFailure: (err: Error | string) => void
): void {
  callApi<{ success: boolean; slug: string; name: string }>({ action: 'createEvent', slug, name })
    .then(onSuccess)
    .catch(onFailure);
}

// ── Delete event ───────────────────────────────────────────────────────────────

export function callDeleteEvent(
  slug:      string,
  onSuccess: (result: { success: boolean }) => void,
  onFailure: (err: Error | string) => void
): void {
  callApi<{ success: boolean }>({ action: 'deleteEvent', slug })
    .then(onSuccess)
    .catch(onFailure);
}

// ── Event stats ────────────────────────────────────────────────────────────────

export function callGetEventStats(
  slug:      string,
  onSuccess: (stats: import('../types').EventStats) => void,
  onFailure: (err: Error | string) => void
): void {
  callApi<import('../types').EventStats>({ action: 'getEventStats', slug })
    .then(onSuccess)
    .catch(onFailure);
}

// ── Google OAuth ──────────────────────────────────────────────────────────────

export function callCheckGoogleToken(
  state:     string,
  onSuccess: (result: { ready: boolean; email: string; name: string; approved: boolean }) => void,
  onFailure: (err: Error | string) => void
): void {
  callApi<{ ready: boolean; email: string; name: string; approved: boolean }>({ action: 'checkGoogleToken', state })
    .then(onSuccess)
    .catch(onFailure);
}

export function callCheckAdminAccess(
  email:     string,
  onSuccess: (result: { approved: boolean }) => void,
  onFailure: (err: Error | string) => void
): void {
  callApi<{ approved: boolean }>({ action: 'checkAdminAccess', email })
    .then(onSuccess)
    .catch(onFailure);
}

export function callRequestAdminAccess(
  email:     string,
  name:      string,
  onSuccess: (result: { success: boolean; alreadyPending?: boolean }) => void,
  onFailure: (err: Error | string) => void
): void {
  callApi<{ success: boolean }>({ action: 'requestAdminAccess', email, name })
    .then(onSuccess)
    .catch(onFailure);
}

export interface AccessRequest {
  email:       string;
  name:        string;
  requestedAt: string;
  status:      'pending' | 'approved' | 'denied';
}

export function callGetPendingRequests(
  adminEmail: string,
  onSuccess:  (result: { requests: AccessRequest[]; approvedAdmins: string[] }) => void,
  onFailure:  (err: Error | string) => void
): void {
  callApi<{ requests: AccessRequest[]; approvedAdmins: string[] }>({ action: 'getPendingRequests', adminEmail })
    .then(onSuccess)
    .catch(onFailure);
}

export function callApproveAccessRequest(
  email:      string,
  adminEmail: string,
  onSuccess:  (result: { success: boolean }) => void,
  onFailure:  (err: Error | string) => void
): void {
  callApi<{ success: boolean }>({ action: 'approveAccessRequest', email, adminEmail })
    .then(onSuccess)
    .catch(onFailure);
}

export function callDenyAccessRequest(
  email:      string,
  adminEmail: string,
  onSuccess:  (result: { success: boolean }) => void,
  onFailure:  (err: Error | string) => void
): void {
  callApi<{ success: boolean }>({ action: 'denyAccessRequest', email, adminEmail })
    .then(onSuccess)
    .catch(onFailure);
}

export function callRevokeAdminAccess(
  email:      string,
  adminEmail: string,
  onSuccess:  (result: { success: boolean }) => void,
  onFailure:  (err: Error | string) => void
): void {
  callApi<{ success: boolean }>({ action: 'revokeAdminAccess', email, adminEmail })
    .then(onSuccess)
    .catch(onFailure);
}

// ── LinkedIn API ───────────────────────────────────────────────────────────────

interface LinkedInAuthData   { authUrl: string; state: string; redirectUri: string; }
interface LinkedInPostResult { success: boolean; postUrl: string; postUrn: string; }

export function callGetLinkedInAuthUrl(
  onSuccess: (data: LinkedInAuthData) => void,
  onFailure: (err: Error | string) => void
): void {
  callApi<LinkedInAuthData>({ action: 'getLinkedInAuthUrl' })
    .then(onSuccess)
    .catch(onFailure);
}

export function callPostToLinkedIn(
  state:     string,
  imageUrl:  string,
  caption:   string,
  onSuccess: (result: LinkedInPostResult) => void,
  onFailure: (err: Error | string) => void
): void {
  callApi<LinkedInPostResult>({ action: 'postToLinkedIn', state, imageUrl, caption })
    .then(onSuccess)
    .catch(onFailure);
}

export function callCheckLinkedInToken(
  state:     string,
  onSuccess: (result: { ready: boolean }) => void,
  onFailure: (err: Error | string) => void
): void {
  callApi<{ ready: boolean }>({ action: 'checkLinkedInToken', state })
    .then(onSuccess)
    .catch(onFailure);
}
