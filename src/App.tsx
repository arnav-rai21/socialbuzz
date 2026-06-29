import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  BarChart2,
  Camera,
  ChevronLeft,
  CloudUpload,
  Code2,
  ExternalLink,
  ImageIcon,
  Link2,
  Loader,
  PenLine,
  Settings,
  Sparkles,
  Trash2,
  Upload,
  User,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import AdminLogin from './components/AdminLogin';
import AdminPanel from './components/AdminPanel';
import MarketingPage from './components/MarketingPage';
import CanvasPreview from './components/CanvasPreview';
import CropModal from './components/CropModal';
import EventDashboard, { StatsView } from './components/EventDashboard';
import ImageUpload from './components/ImageUpload';
import ShareButtons from './components/ShareButtons';
import TemplateGallery from './components/TemplateGallery';
import UserForm from './components/UserForm';

import { IS_GAS, IS_GAS_ADMIN, INITIAL_EVENT_SLUG, INITIAL_MODE, DEFAULT_SLOT, buildWidgetSnippet, callDeleteActivity, callDeleteEvent, callDeleteTemplate, callGetEventStats, callLogOpen, callSaveTemplate, callUploadImage, loadBootstrap, loadBootstrapAsync } from './lib/server';
import type { EventMeta, EventStats, FieldSettings, FontSettings, GeneratedAsset, ImageSlot, SharingSettings, TemplateConfig, TextSlot, UserProfile } from './types';
import { DEFAULT_FIELD_SETTINGS, DEFAULT_FONT_SETTINGS, DEFAULT_SHARING_SETTINGS } from './types';

const initialTemplate = loadBootstrap();

// ── App ───────────────────────────────────────────────────────────────────────

// Stable client key for a template: its DB id, or 'new' for an unsaved draft.
const keyOf = (t: TemplateConfig): string => (t.id != null ? String(t.id) : 'new');

export default function App() {
  // ── Multi-template state ──────────────────────────────────────────────────
  // `templates` holds every template for the current event; at most one may be an
  // unsaved draft (id === undefined). `activeKey` selects which one is shown/edited.
  const [templates, setTemplates]                       = useState<TemplateConfig[]>([]);
  const [activeKey, setActiveKey]                       = useState<string>('');
  const [templateUploadDataUrl, setTemplateUploadDataUrl] = useState('');
  const [isSavingTemplate, setIsSavingTemplate]         = useState(false);
  // sharing & field settings are event-level (shared by all templates).
  const [sharingSettings, setSharingSettings]           = useState<SharingSettings>(initialTemplate.sharingSettings || DEFAULT_SHARING_SETTINGS);
  const [fieldSettings,   setFieldSettings]             = useState<FieldSettings>(initialTemplate.fieldSettings   || DEFAULT_FIELD_SETTINGS);
  const [userRawDataUrl,     setUserRawDataUrl]         = useState('');
  const [userCroppedDataUrl, setUserCroppedDataUrl]     = useState('');
  const [cropModalOpen,      setCropModalOpen]          = useState(false);
  const [finalImageDataUrl,  setFinalImageDataUrl]      = useState('');
  const [generatedAsset,     setGeneratedAsset]         = useState<GeneratedAsset | null>(null);
  const [isGenerating,       setIsGenerating]           = useState(false);
  // Restore admin session from sessionStorage so reloads don't bounce to login
  const _savedAuth = (() => {
    try {
      const raw = sessionStorage.getItem('socialbuzz_admin_auth');
      return raw ? JSON.parse(raw) as { email: string; name: string } : null;
    } catch { return null; }
  })();

  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(IS_GAS_ADMIN || !!_savedAuth);
  const [adminEmail,     setAdminEmail]                 = useState(_savedAuth?.email ?? '');
  const [adminName,      setAdminName]                  = useState(_savedAuth?.name ?? '');
  const [showAdminLogin, setShowAdminLogin]              = useState(false);
  const [isAdminOpen,    setIsAdminOpen]                = useState(false);
  const [isMappingMode,     setIsMappingMode]     = useState(false);
  const [isTextMappingMode, setIsTextMappingMode] = useState(false);
  const [currentView,    setCurrentView]               = useState<'form' | 'generate'>('form');
  const [adminTab,       setAdminTab]                  = useState<'settings' | 'user'>('settings');
  // Edit-event workspace top-nav section (Template editor lives under 'template')
  const [editorSection,  setEditorSection]             = useState<'template' | 'analytics' | 'share' | 'embed' | 'delete'>('template');
  const [editStats,      setEditStats]                 = useState<EventStats | null>(null);
  const [editStatsLoading, setEditStatsLoading]        = useState(false);
  const [embedPosition,  setEmbedPosition]             = useState<'right' | 'left'>('right');
  const [embedStyle,     setEmbedStyle]                = useState<'solid' | 'gradient'>('gradient');
  const [embedColor1,    setEmbedColor1]               = useState('#7c3aed');
  const [embedColor2,    setEmbedColor2]               = useState('#db2777');
  const [confirmDeleteEvent, setConfirmDeleteEvent]    = useState(false);
  const [isDeletingEvent, setIsDeletingEvent]          = useState(false);
  const templateFileInputRef                           = useRef<HTMLInputElement>(null);
  const [templateIsDragOver, setTemplateIsDragOver]   = useState(false);

  // ── Picker / webcam (shared between form upload and generate-view "Change photo") ──
  const galleryInputRef        = useRef<HTMLInputElement>(null);
  const cameraInputRef         = useRef<HTMLInputElement>(null);
  const videoRef               = useRef<HTMLVideoElement>(null);
  const streamRef              = useRef<MediaStream | null>(null);
  const pendingAutoGenerateRef = useRef(false);
  // Updated every render so it always holds a fresh closure over current state
  const triggerUploadRef       = useRef<((dataUrl: string) => void) | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [showWebcam, setShowWebcam] = useState(false);
  const [camReady,   setCamReady]   = useState(false);

  // Show landing when: no saved session AND no specific event slug in URL
  const [showLanding, setShowLanding] = useState(
    !_savedAuth && INITIAL_EVENT_SLUG === 'default'
  );

  // ── Multi-event state ─────────────────────────────────────────────────────
  const [eventSlug, setEventSlug] = useState(INITIAL_EVENT_SLUG);
  const [appMode,   setAppMode]   = useState<'app' | 'admin-dashboard'>(
    _savedAuth ? 'admin-dashboard' : 'app'
  );
  const [eventsList, setEventsList] = useState<EventMeta[]>([]);

  const [profile, setProfile] = useState<UserProfile>({ name: '', title: '', company: '', email: '', eventSlug });

  // Keep eventSlug in profile in sync with eventSlug state
  useEffect(() => { setProfile(prev => ({ ...prev, eventSlug })); }, [eventSlug]);

  // Attach webcam stream to video element once modal opens
  useEffect(() => {
    if (showWebcam && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
    if (!showWebcam) setCamReady(false);
  }, [showWebcam]);

  // Release camera on unmount
  useEffect(() => () => { streamRef.current?.getTracks().forEach(t => t.stop()); }, []);

  // Fetch bootstrap data from /api/bootstrap on mount
  useEffect(() => {
    loadBootstrapAsync(eventSlug).then(data => {
      if (!data) return;
      // Prefer the templates[] array; fall back to the single templateConfig for old responses.
      const list = (data.templates && data.templates.length)
        ? data.templates
        : (data.templateConfig?.hasTemplate ? [data.templateConfig] : []);
      setTemplates(list);
      const def = list.find(t => t.isDefault) || list[0];
      if (def) setActiveKey(keyOf(def));

      const sharing = data.sharingSettings ?? data.templateConfig?.sharingSettings;
      const fields  = data.fieldSettings   ?? data.templateConfig?.fieldSettings;
      if (sharing) setSharingSettings(sharing);
      if (fields)  setFieldSettings(fields);

      if (Array.isArray(data.eventsList)) setEventsList(data.eventsList);
    });
    // Re-fetch whenever the event being edited/viewed changes (e.g. switching
    // events from the admin dashboard), otherwise the template list stays stale.
  }, [eventSlug]);

  // Reach tracking: log a visit once per mount for real attendee views (not an
  // admin/editor). Source is inferred from context — inside the widget iframe →
  // 'widget', a top-level tab → 'direct'. The visitor id (attached in callLogOpen)
  // stitches this visit to any later Generate/Share into one journey.
  useEffect(() => {
    const inIframe = typeof window !== 'undefined' && window.top !== window.self;
    if (!_savedAuth && INITIAL_MODE !== 'admin') {
      callLogOpen(INITIAL_EVENT_SLUG, inIframe ? 'widget' : 'direct');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Derived active template ────────────────────────────────────────────────
  const activeTemplate: TemplateConfig =
    templates.find(t => keyOf(t) === activeKey) ?? templates[0] ?? initialTemplate;
  const activeFont: FontSettings = activeTemplate.fontSettings || DEFAULT_FONT_SETTINGS;

  // Patch the currently-active template inside the templates list.
  const updateActive = useCallback((patch: Partial<TemplateConfig>) => {
    setTemplates(prev => {
      if (!prev.length) return prev;
      const key = activeKey || keyOf(prev[0]);
      return prev.map(t => (keyOf(t) === key ? { ...t, ...patch } : t));
    });
  }, [activeKey]);

  const hasTemplate   = Boolean(activeTemplate.templateDataUrl);
  const hasUserPhoto  = Boolean(userCroppedDataUrl);
  const detailsFilled = (['name', 'title', 'company', 'email'] as const).every(key => {
    const cfg = fieldSettings[key];
    if (!cfg.visible || !cfg.required) return true;
    return Boolean(profile[key]?.trim());
  });
  const canGenerate   = hasTemplate && hasUserPhoto && detailsFilled;
  const isAdminActive = isAdminOpen && isAdminAuthenticated;

  // Canvas column visible on mobile only when mapping mode is active
  const showCanvasOnMobile = (isMappingMode || isTextMappingMode) && isAdminActive;

  // ── Admin ─────────────────────────────────────────────────────────────────

  function handleAdminToggle() {
    if (!isAdminAuthenticated) { setShowAdminLogin(true); return; }
    if (appMode === 'admin-dashboard') { setAppMode('app'); return; }
    const next = !isAdminOpen;
    setIsAdminOpen(next);
    if (!next) { setIsMappingMode(false); setIsTextMappingMode(false); }
  }

  function handleAuthenticated(email: string, name: string) {
    try { sessionStorage.setItem('socialbuzz_admin_auth', JSON.stringify({ email, name })); } catch {}
    setAdminEmail(email);
    setAdminName(name);
    setIsAdminAuthenticated(true);
    setShowAdminLogin(false);
    setShowLanding(false);
    setAppMode('admin-dashboard');
  }

  function handleLogout() {
    try { sessionStorage.removeItem('socialbuzz_admin_auth'); } catch {}
    setIsAdminAuthenticated(false);
    setAdminEmail('');
    setAdminName('');
    setIsAdminOpen(false);
    setAppMode('app');
    setShowLanding(true);
  }

  // ── Template ──────────────────────────────────────────────────────────────

  // Upload of a fresh image always creates a NEW draft template (one draft at a time).
  function handleTemplateLoad(dataUrl: string, fileName: string) {
    const draft: TemplateConfig = {
      hasTemplate: true, templateName: fileName, templateDataUrl: dataUrl,
      imageSlot: { ...DEFAULT_SLOT }, imageSlotSet: false, fontSettings: DEFAULT_FONT_SETTINGS,
    };
    setTemplates(prev => [...prev.filter(t => t.id != null), draft]); // replace any prior draft
    setTemplateUploadDataUrl(dataUrl);
    setActiveKey('new');
    setGeneratedAsset(null);
    setIsMappingMode(true);
  }

  function handleSelectTemplate(key: string) {
    setActiveKey(key);
    setGeneratedAsset(null);
  }

  function handleDeleteTemplate(t: TemplateConfig) {
    // Unsaved draft — just drop it locally.
    if (t.id == null) {
      setTemplates(prev => {
        const next = prev.filter(x => keyOf(x) !== 'new');
        setActiveKey(next.length ? keyOf(next[0]) : '');
        return next;
      });
      setTemplateUploadDataUrl('');
      return;
    }
    const dropLocally = () => setTemplates(prev => {
      const next = prev.filter(x => x.id !== t.id);
      if (keyOf(t) === activeKey) setActiveKey(next.length ? keyOf(next[0]) : '');
      return next;
    });
    callDeleteTemplate(eventSlug, t.id,
      () => { dropLocally(); toast.success('Template deleted.'); },
      (err) => {
        const msg = (err as Error)?.message ?? String(err);
        // Stale local state: the row is already gone server-side — clean it up quietly.
        if (/not found/i.test(msg)) { dropLocally(); toast.info('Template was already removed.'); return; }
        toast.error(`Delete failed: ${msg}`);
      }
    );
  }

  function handleSlotChange(slot: ImageSlot) {
    // Any edit to the photo slot (drawing, dragging, resizing, typing coords) marks it as set.
    updateActive({ imageSlot: slot, imageSlotSet: true });
    setGeneratedAsset(null);
  }

  function handleClearPhotoSlot() {
    updateActive({ imageSlotSet: false });
    setGeneratedAsset(null);
  }

  function handleTextSlotChange(slot: TextSlot | undefined) {
    updateActive({ textSlot: slot });
    setGeneratedAsset(null);
  }

  function handleFontChange(fs: FontSettings) {
    updateActive({ fontSettings: fs });
  }

  function handleToggleMapping() {
    if (!activeTemplate.hasTemplate) { toast.error('Upload a template first.'); return; }
    const next = !isMappingMode;
    setIsMappingMode(next);
    if (next) setIsTextMappingMode(false);
    toast.info(next ? 'Photo mapping — drag the blue box or handles.' : 'Photo mapping off.');
  }

  function handleToggleTextMapping() {
    if (!activeTemplate.hasTemplate) { toast.error('Upload a template first.'); return; }
    const next = !isTextMappingMode;
    setIsTextMappingMode(next);
    if (next) setIsMappingMode(false);
    toast.info(next ? 'Text mapping — drag the green box or handles.' : 'Text mapping off.');
  }

  function handleSaveMapping() {
    const t = activeTemplate;
    const dataUrl = templateUploadDataUrl || t.templateDataUrl;
    if (!dataUrl) { toast.error('Select a template image first.'); return; }
    if (t.imageSlotSet === false) { toast.error('Map the photo area first — drag on the preview to draw it.'); return; }
    setIsSavingTemplate(true);
    const prevKey = keyOf(t);
    const payloadTextSlot = t.textSlot; // capture before async
    callSaveTemplate(
      { templateId: t.id, fileName: t.templateName || `template_${Date.now()}.png`, templateDataUrl: dataUrl, imageSlot: t.imageSlot, textSlot: payloadTextSlot, eventSlug, fontSettings: t.fontSettings || activeFont, sharingSettings, fieldSettings },
      (config) => {
        // Server may omit textSlot when the image re-fetch fails on load-back; preserve what was just saved.
        const merged: TemplateConfig = { ...config, textSlot: config.textSlot ?? payloadTextSlot };
        setTemplates(prev => {
          const others = prev.filter(x => keyOf(x) !== prevKey);
          return [...others, merged].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
        });
        setActiveKey(keyOf(merged));
        if (config.sharingSettings) setSharingSettings(config.sharingSettings);
        if (config.fieldSettings)   setFieldSettings(config.fieldSettings);
        setTemplateUploadDataUrl('');
        setIsSavingTemplate(false);
        setIsMappingMode(false);
        setIsTextMappingMode(false);
        toast.success('Template & settings saved!');
      },
      (err) => { setIsSavingTemplate(false); toast.error(`Save failed: ${(err as Error)?.message ?? err}`); }
    );
  }

  function handleAdminTemplateFile(file: File) {
    if (!file.type.startsWith('image/')) { toast.error('Please select a valid image file.'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      handleTemplateLoad(reader.result as string, file.name);
      toast.info(`Template "${file.name}" loaded — map the slot, then save.`);
    };
    reader.onerror = () => toast.error('Could not read the template file.');
    reader.readAsDataURL(file);
  }

  // ── Editor sections (top-nav workspace) ────────────────────────────────────

  function loadEditStats(slug: string) {
    setEditStatsLoading(true);
    callGetEventStats(
      slug,
      (stats) => { setEditStats(stats); setEditStatsLoading(false); },
      (err)   => { setEditStatsLoading(false); toast.error(`Could not load stats: ${(err as Error)?.message ?? err}`); }
    );
  }

  function selectEditorSection(section: typeof editorSection) {
    setEditorSection(section);
    if (section === 'analytics' && !editStats && !editStatsLoading) loadEditStats(eventSlug);
  }

  function handleDeleteCurrentEvent() {
    if (eventSlug === 'default') { toast.error('The default event cannot be deleted.'); return; }
    setIsDeletingEvent(true);
    callDeleteEvent(
      eventSlug,
      () => {
        setIsDeletingEvent(false);
        setConfirmDeleteEvent(false);
        setEventsList(prev => prev.filter(e => e.slug !== eventSlug));
        toast.success('Event deleted.');
        setIsAdminOpen(false);
        setAppMode('admin-dashboard');
      },
      (err) => { setIsDeletingEvent(false); toast.error(`Delete failed: ${(err as Error)?.message ?? err}`); }
    );
  }

  // ── Photo ─────────────────────────────────────────────────────────────────

  function handleFileSelected(file: File) {
    const reader = new FileReader();
    reader.onload = () => { setUserRawDataUrl(reader.result as string); setCropModalOpen(true); };
    reader.readAsDataURL(file);
  }

  function handleCropApply(croppedDataUrl: string) {
    setUserCroppedDataUrl(croppedDataUrl);
    setCropModalOpen(false);
    setGeneratedAsset(null);
    // If the user changed their photo while already on the generate view, auto-regenerate
    if (currentView === 'generate') pendingAutoGenerateRef.current = true;
  }

  function handleRemovePhoto() {
    setUserRawDataUrl('');
    setUserCroppedDataUrl('');
    setGeneratedAsset(null);
  }

  const handleCanvasDataUrl = useCallback((dataUrl: string) => {
    setFinalImageDataUrl(dataUrl);
    // Auto-regenerate when the canvas updates after a "Change photo" on the generate view
    if (pendingAutoGenerateRef.current) {
      pendingAutoGenerateRef.current = false;
      triggerUploadRef.current?.(dataUrl);
    }
  }, []);

  // ── Generate ──────────────────────────────────────────────────────────────

  function handleGenerate(dataUrlOverride?: string) {
    const dataUrl = dataUrlOverride ?? finalImageDataUrl;
    if (!activeTemplate.templateDataUrl) { toast.error('No template loaded.'); return; }
    if (!userCroppedDataUrl) { toast.error('Upload and crop your photo first.'); return; }
    if (!dataUrl)  { toast.error('Preview not ready — wait a moment.'); return; }
    setIsGenerating(true);

    // Absolute safety net: reset loading state after 25 s no matter what happens.
    const safetyTimer = setTimeout(() => {
      setIsGenerating(false);
      toast.error('Generation timed out — please try again.');
    }, 25_000);

    // CanvasPreview already outputs JPEG — just strip the data URL header and upload.
    const base64 = dataUrl.replace(/^data:image\/[^;]+;base64,/, '');
    callUploadImage(
      base64,
      profile,
      (asset) => { clearTimeout(safetyTimer); setGeneratedAsset(asset); setIsGenerating(false); setCurrentView('generate'); window.scrollTo({ top: 0, behavior: 'instant' }); toast.success('Your post is ready!'); },
      (err)   => { clearTimeout(safetyTimer); setIsGenerating(false); toast.error(`Generation failed: ${(err as Error)?.message ?? err}`); }
    );
  }

  // ── Picker / webcam helpers ────────────────────────────────────────────────

  function openPicker() { setShowPicker(true); }

  async function handleOpenWebcam() {
    setShowPicker(false);
    if (!navigator.mediaDevices?.getUserMedia) { cameraInputRef.current?.click(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      setShowWebcam(true);
    } catch {
      cameraInputRef.current?.click();
    }
  }

  function stopWebcam() {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setShowWebcam(false);
  }

  function capturePhoto() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const canvas = document.createElement('canvas');
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Mirror horizontally to match the selfie preview (which is CSS-mirrored via scaleX(-1))
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(blob => {
      if (!blob) { toast.error('Failed to capture photo.'); return; }
      handleFileSelected(new File([blob], 'webcam-photo.jpg', { type: 'image/jpeg' }));
      stopWebcam();
    }, 'image/jpeg', 0.92);
  }

  // Keep triggerUploadRef fresh so handleCanvasDataUrl can call it without stale closure
  triggerUploadRef.current = (dataUrl: string) => handleGenerate(dataUrl);

  function goBackToForm() {
    setCurrentView('form');
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  // ── Download ──────────────────────────────────────────────────────────────

  async function handleDownload() {
    if (!finalImageDataUrl) { toast.error('Nothing to download yet.'); return; }
    try {
      const blob = await fetch(finalImageDataUrl).then(r => r.blob());
      const url  = URL.createObjectURL(blob);
      const a    = Object.assign(document.createElement('a'), { href: url, download: 'social-media-post.png' });
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch { toast.error('Download failed.'); }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  // Marketing homepage — shown on root URL when not authenticated.
  // Its CTAs open the Google sign-in popup directly (one click), with
  // AdminLogin's popup-blocked fallback as a safety net.
  if (showLanding) {
    return (
      <>
        <MarketingPage onGetStarted={() => setShowAdminLogin(true)} />
        {showAdminLogin && (
          <AdminLogin
            autoStart
            onAuthenticated={handleAuthenticated}
            onClose={() => setShowAdminLogin(false)}
          />
        )}
      </>
    );
  }

  // Admin dashboard mode — full-screen dashboard for event management
  if (appMode === 'admin-dashboard' && isAdminAuthenticated) {
    return (
      <EventDashboard
        eventsList={eventsList}
        adminEmail={adminEmail}
        adminName={adminName}
        onEditEvent={(slug) => {
          setEventSlug(slug);
          setAppMode('app');
          setIsAdminOpen(true);
          setEditorSection('template');
          setEditStats(null);
          setConfirmDeleteEvent(false);
        }}
        onClose={() => setAppMode('app')}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <div className="flex flex-col bg-slate-50 w-full" style={{ minHeight: '100dvh' }}>

      {/* Header */}
      <header className="flex-shrink-0 border-b border-slate-100 bg-white" style={{ paddingTop: 'var(--safe-top)' }}>
        <div className="flex min-h-[56px] items-center justify-between px-4 sm:px-5">
          <div className="flex items-center gap-2.5">
            <span className="text-[17px] font-black tracking-tight" style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed 50%, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Social Buzz</span>
          </div>
          <div className="flex items-center gap-1.5">
            {currentView === 'generate' && (
              <button onClick={goBackToForm} className="flex items-center gap-0.5 pl-1 pr-2.5 py-1.5 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer transition-colors active:scale-95 text-sm font-semibold">
                <ChevronLeft size={17} /> Back
              </button>
            )}
            {isAdminAuthenticated && appMode === 'app' && (
              <button onClick={() => setAppMode('admin-dashboard')} className="flex items-center gap-0.5 pl-1 pr-2.5 py-1.5 rounded-full bg-violet-50 text-violet-600 border border-violet-100 hover:bg-violet-100 cursor-pointer transition-colors active:scale-95 text-sm font-semibold">
                <ChevronLeft size={17} /> Dashboard
              </button>
            )}
            {isAdminAuthenticated && (
              <button onClick={handleAdminToggle} className={['w-8 h-8 flex items-center justify-center rounded-full cursor-pointer transition-colors active:scale-95', isAdminActive ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'].join(' ')}>
                <Settings size={15} />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Edit-event top navigation — admin editing only */}
      {isAdminActive && currentView === 'form' && (
        <div className="flex-shrink-0 border-b border-slate-200 bg-white overflow-x-auto">
          <div className="flex gap-1 px-3 sm:px-5 min-w-max">
            {([
              { key: 'template'  as const, label: 'Template',     Icon: PenLine },
              { key: 'analytics' as const, label: 'Analytics',    Icon: BarChart2 },
              { key: 'share'     as const, label: 'Share & Open', Icon: Link2 },
              { key: 'embed'     as const, label: 'Embed',        Icon: Code2 },
              { key: 'delete'    as const, label: 'Delete',       Icon: Trash2 },
            ]).map(({ key, label, Icon }) => {
              const active = editorSection === key;
              const danger = key === 'delete';
              return (
                <button key={key} onClick={() => selectEditorSection(key)}
                  className={['flex items-center gap-1.5 px-3 sm:px-4 py-3 text-sm font-bold border-b-2 -mb-px whitespace-nowrap cursor-pointer transition-colors',
                    active ? (danger ? 'border-red-500 text-red-600' : 'border-violet-600 text-violet-600')
                           : (danger ? 'border-transparent text-red-400 hover:text-red-600' : 'border-transparent text-slate-500 hover:text-slate-700')].join(' ')}>
                  <Icon size={15} /> {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Non-template sections render full-width in place of the editor (same page) */}
      {isAdminActive && currentView === 'form' && editorSection !== 'template' ? (
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 bg-slate-50">
          {(() => {
            const eventName = eventsList.find(e => e.slug === eventSlug)?.name || eventSlug;
            const eventUrl  = window.location.origin + window.location.pathname + '?event=' + encodeURIComponent(eventSlug);
            const embedCode = buildWidgetSnippet({ slug: eventSlug, position: embedPosition, colorStyle: embedStyle, color1: embedColor1, color2: embedColor2 });
            return (
              <div className="max-w-5xl mx-auto">
                {editorSection === 'analytics' && (
                  editStatsLoading
                    ? <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center gap-3 py-20"><Loader size={26} className="animate-spin text-violet-500" /><p className="text-sm text-slate-400 font-medium">Loading analytics…</p></div>
                    : editStats
                      ? <StatsView slug={eventSlug} stats={editStats} eventName={eventName} embedded
                          onDeleteActivity={(visitorId) => callDeleteActivity(
                            eventSlug, visitorId,
                            (r) => { toast.success(visitorId ? 'Entry deleted.' : `Cleared ${r.deleted} record${r.deleted === 1 ? '' : 's'}.`); loadEditStats(eventSlug); },
                            (err) => toast.error(`Delete failed: ${(err as Error)?.message ?? err}`),
                          )} />
                      : <div className="bg-white rounded-2xl border border-slate-200 shadow-sm py-16 text-center"><button onClick={() => loadEditStats(eventSlug)} className="text-sm font-semibold text-violet-600 hover:text-violet-800 cursor-pointer">Load analytics</button></div>
                )}

                {editorSection === 'share' && (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4 max-w-2xl">
                    <div>
                      <h3 className="text-base font-black text-slate-900">Share &amp; Open</h3>
                      <p className="text-sm text-slate-500 mt-1">Share this link with attendees, or open the live event page.</p>
                    </div>
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
                      <code className="text-xs text-slate-600 truncate flex-1">{eventUrl}</code>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => navigator.clipboard.writeText(eventUrl).then(() => toast.success('Link copied!')).catch(() => toast.error('Copy failed'))}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-bold cursor-pointer hover:bg-violet-700 transition-colors active:scale-95">
                        <Link2 size={14} /> Copy Link
                      </button>
                      <a href={eventUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-bold cursor-pointer hover:bg-slate-50 transition-colors active:scale-95">
                        <ExternalLink size={14} /> Open event
                      </a>
                    </div>
                  </div>
                )}

                {editorSection === 'embed' && (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4 max-w-2xl">
                    <div>
                      <h3 className="text-base font-black text-slate-900">Website Widget</h3>
                      <p className="text-sm text-slate-500 mt-1">Floating button + popup panel. Paste before <code className="bg-slate-100 px-1 rounded">&lt;/body&gt;</code> on any page.</p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <p className="text-xs font-semibold text-slate-600">Button position</p>
                      <div className="flex gap-2 max-w-xs">
                        {(['right', 'left'] as const).map(pos => (
                          <button key={pos} onClick={() => setEmbedPosition(pos)}
                            className={`flex-1 py-2 rounded-xl text-xs font-semibold border cursor-pointer transition-colors ${embedPosition === pos ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                            Bottom {pos.charAt(0).toUpperCase() + pos.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Button colour — solid or gradient */}
                    <div className="flex flex-col gap-2.5">
                      <p className="text-xs font-semibold text-slate-600">Button colour</p>
                      <div className="flex gap-2 max-w-xs">
                        {(['gradient', 'solid'] as const).map(st => (
                          <button key={st} onClick={() => setEmbedStyle(st)}
                            className={`flex-1 py-2 rounded-xl text-xs font-semibold border cursor-pointer transition-colors capitalize ${embedStyle === st ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                            {st}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-4 flex-wrap">
                        <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                          {embedStyle === 'gradient' ? 'Start' : 'Colour'}
                          <input type="color" value={embedColor1} onChange={e => setEmbedColor1(e.target.value)}
                            className="w-9 h-9 rounded-lg border border-slate-200 cursor-pointer p-0.5 bg-white" />
                          <span className="font-mono text-slate-500">{embedColor1}</span>
                        </label>
                        {embedStyle === 'gradient' && (
                          <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                            End
                            <input type="color" value={embedColor2} onChange={e => setEmbedColor2(e.target.value)}
                              className="w-9 h-9 rounded-lg border border-slate-200 cursor-pointer p-0.5 bg-white" />
                            <span className="font-mono text-slate-500">{embedColor2}</span>
                          </label>
                        )}
                      </div>
                      {/* Live preview */}
                      <div className="flex items-center gap-2 px-4 h-12 self-start rounded-full text-white text-sm font-bold shadow"
                        style={{ background: embedStyle === 'gradient' ? `linear-gradient(135deg, ${embedColor1} 0%, ${embedColor2} 100%)` : embedColor1 }}>
                        <Sparkles size={15} /> Start Social Buzz
                      </div>
                    </div>

                    <div className="bg-slate-900 rounded-xl overflow-hidden">
                      <pre className="text-xs text-emerald-400 font-mono px-4 py-4 overflow-x-auto leading-relaxed whitespace-pre">{embedCode}</pre>
                    </div>
                    <button onClick={() => navigator.clipboard.writeText(embedCode).then(() => toast.success('Widget code copied!')).catch(() => toast.error('Copy failed'))}
                      className="self-start flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-bold cursor-pointer hover:bg-violet-700 transition-colors active:scale-95">
                      <Code2 size={15} /> Copy Widget Code
                    </button>
                  </div>
                )}

                {editorSection === 'delete' && (
                  <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-6 flex flex-col gap-4 max-w-2xl">
                    <div>
                      <h3 className="text-base font-black text-red-600">Danger Zone</h3>
                      <p className="text-sm text-slate-500 mt-1">Permanently delete <span className="font-semibold text-slate-700">{eventName}</span>, including all its templates and analytics. This cannot be undone.</p>
                    </div>
                    {eventSlug === 'default' ? (
                      <p className="text-sm text-slate-400">The default event cannot be deleted.</p>
                    ) : confirmDeleteEvent ? (
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-sm font-semibold text-red-700">Delete this event?</span>
                        <button onClick={handleDeleteCurrentEvent} disabled={isDeletingEvent}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-bold cursor-pointer hover:bg-red-700 transition-colors active:scale-95 disabled:opacity-50">
                          {isDeletingEvent ? <Loader size={13} className="animate-spin" /> : <Trash2 size={13} />} Yes, delete
                        </button>
                        <button onClick={() => setConfirmDeleteEvent(false)} className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold cursor-pointer hover:bg-slate-50 transition-colors">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmDeleteEvent(true)}
                        className="self-start flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-50 text-red-600 border border-red-200 text-sm font-bold cursor-pointer hover:bg-red-100 transition-colors active:scale-95">
                        <Trash2 size={15} /> Delete event
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      ) : (
      /* Main content — two-column on desktop */
      <div className="flex-1 flex flex-col lg:flex-row" style={{ minHeight: 0 }}>

        {/* ── CANVAS COLUMN (right on desktop, top on mobile when mapping) ── */}
        {/* First in DOM so mapping canvas appears above controls on mobile */}
        <div className={[
          'flex flex-col gap-4 p-4 bg-slate-100/60 lg:border-l lg:border-slate-200',
          'lg:order-2 lg:w-[62%] lg:p-5 lg:sticky lg:top-[56px] lg:h-[calc(100vh-56px)] lg:overflow-hidden lg:flex',
          showCanvasOnMobile ? 'border-b border-slate-200' : 'hidden lg:flex',
        ].join(' ')}>

          {/* Template upload — desktop admin only, mirrors AdminPanel upload on mobile */}
          {isAdminActive && (
            <div
              onClick={() => templateFileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setTemplateIsDragOver(true); }}
              onDragLeave={() => setTemplateIsDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setTemplateIsDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleAdminTemplateFile(f); }}
              className={[
                'hidden lg:flex flex-shrink-0 items-center gap-3 px-4 py-3 rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-200',
                templateIsDragOver ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-300 bg-white hover:border-blue-400 hover:bg-blue-50/40',
              ].join(' ')}
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center flex-shrink-0">
                <CloudUpload size={18} className="text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-700 truncate">
                  Click or drag to add a template
                </p>
                <p className="text-[11px] text-slate-400">PNG, JPG or WEBP</p>
              </div>
              {templates.length > 0 && (
                <span className="text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full flex-shrink-0">{templates.length} added</span>
              )}
              <input ref={templateFileInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAdminTemplateFile(f); e.target.value = ''; }} />
            </div>
          )}

          {/* Canvas */}
          <div className="flex-1 bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm min-h-0 flex items-center justify-center">
            <CanvasPreview
              templateConfig={activeTemplate}
              imageSlotSet={activeTemplate.imageSlotSet}
              userCroppedDataUrl={userCroppedDataUrl}
              profile={profile}
              fontSettings={activeFont}
              isMappingMode={isMappingMode && isAdminActive}
              isTextMappingMode={isTextMappingMode && isAdminActive}
              showSlotIndicators={isAdminActive}
              onSlotChange={handleSlotChange}
              onClearPhotoSlot={handleClearPhotoSlot}
              onTextSlotChange={handleTextSlotChange}
              onCanvasDataUrl={handleCanvasDataUrl}
            />
          </div>

          {/* Desktop Generate button — form view only */}
          {currentView === 'form' && (
            <button
              onClick={() => handleGenerate()}
              disabled={!canGenerate || isGenerating}
              className={['relative overflow-hidden flex flex-col items-center justify-center py-3 px-10 rounded-2xl text-white font-bold cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-violet-600 to-pink-500 active:scale-[0.98]', isGenerating ? 'shimmer-btn' : ''].join(' ')}
            >
              {isGenerating ? (
                <span className="flex items-center gap-2 text-sm">
                  <span style={{ width: 15, height: 15, border: '2.5px solid rgba(255,255,255,0.35)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                  Generating…
                </span>
              ) : (
                <>
                  <span className="flex items-center gap-1.5 text-sm"><Sparkles size={14} /> Generate Preview</span>
                  <span className="text-[10px] opacity-70 mt-0.5">See how your post will look</span>
                </>
              )}
            </button>
          )}

          {/* Generate another — generate view only */}
          {currentView === 'generate' && (
            <button
              onClick={() => { setGeneratedAsset(null); goBackToForm(); }}
              className="flex items-center justify-center gap-2 py-3 px-10 rounded-2xl bg-white border-[1.5px] border-slate-200 text-slate-700 font-bold text-sm cursor-pointer hover:bg-slate-50 transition-colors active:scale-[0.98]"
            >
              <Sparkles size={14} className="text-violet-500" /> Generate another
            </button>
          )}

        </div>

        {/* ── LEFT COLUMN: Form/Generate views ── */}
        <div className="flex-1 flex flex-col lg:order-1 lg:w-[38%] lg:overflow-y-auto lg:h-[calc(100vh-56px)]">

        {/* ── VIEWS with slide transition ──────────────────────────────────── */}
        <AnimatePresence mode="wait" initial={false}>
          {currentView === 'form' ? (

            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="flex flex-col"
            >
              {/* Tab bar — desktop only, shown when admin panel is active */}
              {isAdminActive && (
                <div className="flex sticky top-0 z-10 bg-white border-b border-slate-200 flex-shrink-0">
                  {(['settings', 'user'] as const).map(tab => (
                    <button key={tab}
                      onClick={() => setAdminTab(tab)}
                      className={['flex-1 py-2.5 text-xs font-bold transition-colors cursor-pointer border-b-2 -mb-px', adminTab === tab ? 'text-violet-600 border-violet-600' : 'text-slate-500 border-transparent hover:text-slate-700'].join(' ')}>
                      {tab === 'settings' ? 'Template Settings' : 'Test User View'}
                    </button>
                  ))}
                </div>
              )}

              <div className="px-4 pb-5 pt-3 sm:px-5 flex flex-col gap-4">

                  {/* Admin panel — on desktop, hidden when 'user' tab is active */}
                  <AnimatePresence>
                    {isAdminActive && (
                      <motion.div key="admin" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}
                        className={['bg-white rounded-2xl border border-slate-200 p-4', adminTab === 'user' ? 'hidden' : ''].join(' ')}>
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-black uppercase tracking-widest text-slate-700">Template Setup</span>
                          <span className="text-[10px] bg-violet-100 text-violet-700 font-bold px-2.5 py-0.5 rounded-full">Admin</span>
                        </div>
                        <AdminPanel
                          open={true}
                          templateConfig={activeTemplate}
                          imageSlotSet={activeTemplate.imageSlotSet}
                          templates={templates}
                          activeKey={activeKey}
                          isMappingMode={isMappingMode}
                          isTextMappingMode={isTextMappingMode}
                          fontSettings={activeFont}
                          sharingSettings={sharingSettings}
                          fieldSettings={fieldSettings}
                          isSavingTemplate={isSavingTemplate}
                          hideTemplateUpload={true}
                          onTemplateLoad={handleTemplateLoad}
                          onSelectTemplate={handleSelectTemplate}
                          onDeleteTemplate={handleDeleteTemplate}
                          onSlotChange={handleSlotChange}
                          onTextSlotChange={handleTextSlotChange}
                          onSaveMapping={handleSaveMapping}
                          onToggleMapping={handleToggleMapping}
                          onToggleTextMapping={handleToggleTextMapping}
                          onFontChange={handleFontChange}
                          onSharingChange={setSharingSettings}
                          onFieldSettingsChange={setFieldSettings}
                          eventSlug={eventSlug}
                          onViewDashboard={() => setAppMode('admin-dashboard')}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* User-facing content — on desktop, hidden when admin is on settings tab */}
                  <div className={['flex flex-col gap-4', isAdminActive && adminTab === 'settings' ? 'hidden' : ''].join(' ')}>

                  {/* Template gallery — only when the event has more than one template */}
                  {templates.length > 1 && (
                    <TemplateGallery
                      templates={templates}
                      activeKey={activeKey}
                      keyOf={keyOf}
                      onSelect={handleSelectTemplate}
                    />
                  )}

                  {/* Hero banner */}
                  <div className="bg-gradient-to-br from-violet-50 via-purple-50 to-pink-50 rounded-3xl border border-violet-100/60 p-5 sm:p-6 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h1 className="text-[22px] font-black text-slate-900 leading-tight">
                        Create your<br/>
                        <span className="bg-gradient-to-r from-violet-600 to-pink-500 bg-clip-text text-transparent">event post</span>
                      </h1>
                      <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">Build a personalized social media card in minutes.</p>
                    </div>
                    <div className="w-[72px] h-[72px] flex-shrink-0 bg-white/80 rounded-2xl border border-white/80 shadow-inner overflow-hidden">
                      {hasTemplate ? (
                        <img src={activeTemplate.templateDataUrl} alt="template" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-2 opacity-25">
                          <div className="w-8 h-6 rounded bg-slate-400" />
                          <div className="w-6 h-1.5 rounded bg-slate-400" />
                          <div className="w-8 h-1 rounded bg-slate-400" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Your details */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-violet-50 border border-violet-100 flex items-center justify-center">
                          <User size={15} className="text-violet-600" />
                        </div>
                        <span className="font-bold text-slate-900 text-sm">Your details</span>
                      </div>
                    </div>
                    <UserForm profile={profile} onChange={setProfile} fieldSettings={fieldSettings} />
                  </div>

                  {/* Upload photo */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-5">
                    <div className="flex items-center gap-2.5 mb-4">
                      <div className="w-8 h-8 rounded-full bg-violet-50 border border-violet-100 flex items-center justify-center flex-shrink-0">
                        <Upload size={15} className="text-violet-600" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 text-sm">Upload photo</p>
                        <p className="text-xs text-slate-400">Add your photo to personalize the post.</p>
                      </div>
                    </div>
                    <ImageUpload
                      rawDataUrl={userRawDataUrl}
                      croppedDataUrl={userCroppedDataUrl}
                      onFileSelected={handleFileSelected}
                      onRemove={handleRemovePhoto}
                      onOpenPicker={openPicker}
                    />
                  </div>

                  </div>{/* end user-facing content */}
                </div>

            </motion.div>

          ) : (

            <motion.div
              key="generate"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="flex flex-col"
            >
              {/* Generate view heading */}
              <div className="px-4 pt-4 pb-1">
                <h2 className="text-[22px] font-black text-slate-900">Your post is ready ✨</h2>
                <p className="text-sm text-slate-400 mt-0.5">Preview, download, or share instantly.</p>
              </div>

              {/* Generated image — mobile only (desktop sees canvas column) */}
              {generatedAsset && (
                <div className="lg:hidden px-4 pb-1">
                  <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
                    <img
                      src={generatedAsset.imageUrl || finalImageDataUrl}
                      alt="Your social media post"
                      className="w-full h-auto block"
                    />
                  </div>
                </div>
              )}

              <div className="px-4 sm:px-5 flex flex-col gap-4 mt-3 pb-4">

                {/* Edit action row */}
                <div className="bg-white rounded-2xl border border-slate-200 flex overflow-hidden divide-x divide-slate-100">
                  <button onClick={goBackToForm}
                    className="flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold text-violet-600 hover:bg-violet-50 cursor-pointer transition-colors active:bg-violet-100">
                    <PenLine size={13} /> Edit details
                  </button>
                  <button onClick={openPicker}
                    className="flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold text-violet-600 hover:bg-violet-50 cursor-pointer transition-colors active:bg-violet-100">
                    <Camera size={13} /> Change photo
                  </button>
                </div>

                {/* Share instantly */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                  <p className="font-bold text-slate-900 text-sm mb-4">Share instantly</p>
                  {generatedAsset && (
                    <ShareButtons
                      generatedAsset={generatedAsset}
                      finalImageDataUrl={finalImageDataUrl}
                      profile={profile}
                      sharingSettings={sharingSettings}
                      eventSlug={eventSlug}
                    />
                  )}
                </div>

                {/* Generate another — mobile only (desktop button is in the canvas column) */}
                <button onClick={() => { setGeneratedAsset(null); goBackToForm(); }}
                  className="lg:hidden mx-auto px-10 py-3.5 rounded-2xl bg-white border-[1.5px] border-slate-200 text-slate-700 font-bold text-sm flex items-center justify-center gap-2 cursor-pointer hover:bg-slate-50 transition-colors active:scale-[0.98]">
                  <Sparkles size={14} className="text-violet-500" /> Generate another
                </button>

              </div>
            </motion.div>

          )}
        </AnimatePresence>

        </div>{/* end left column */}

      </div>
      )}{/* end two-column layout / section panels */}

      {/* Bottom CTA — only shown on form view (mobile only; desktop has button in right column) */}
      {currentView === 'form' && !(isAdminActive && editorSection !== 'template') && (
        <div className="lg:hidden sticky bottom-0 z-10 bg-white border-t border-slate-100 px-4 py-3 sm:px-5" style={{ paddingBottom: 'calc(0.75rem + var(--safe-bottom))' }}>
          <button
            onClick={() => handleGenerate()}
            disabled={!canGenerate || isGenerating}
            className={['relative overflow-hidden mx-auto flex flex-col items-center justify-center py-2.5 px-10 rounded-2xl text-white font-bold cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-violet-600 to-pink-500 active:scale-[0.98]', isGenerating ? 'shimmer-btn' : ''].join(' ')}
          >
            {isGenerating ? (
              <span className="flex items-center gap-2 text-sm">
                <span style={{ width: 15, height: 15, border: '2.5px solid rgba(255,255,255,0.35)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                Generating…
              </span>
            ) : (
              <>
                <span className="flex items-center gap-1.5 text-sm"><Sparkles size={14} /> Generate Preview</span>
                <span className="text-[10px] opacity-70 mt-0.5">See how your post will look</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Modals */}
      {showAdminLogin && <AdminLogin onAuthenticated={handleAuthenticated} onClose={() => setShowAdminLogin(false)} />}
      <CropModal open={cropModalOpen} imageSrc={userRawDataUrl} slot={activeTemplate.imageSlot} onApply={handleCropApply} onClose={() => setCropModalOpen(false)} />

      {/* Hidden file inputs */}
      <input ref={galleryInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelected(f); e.target.value = ''; }} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="user" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelected(f); e.target.value = ''; }} />

      {/* Source picker bottom sheet */}
      {showPicker && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center"
          style={{ background: 'rgba(0,0,0,.5)' }} onClick={() => setShowPicker(false)}>
          <div className="w-full max-w-sm bg-white rounded-t-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mt-3 mb-1" />
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-5 pt-3 pb-2">
              Select photo source
            </p>
            <button onClick={handleOpenWebcam}
              className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors cursor-pointer text-left">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(135deg,#7c3aed,#db2777)' }}>
                <Camera size={22} className="text-white" />
              </div>
              <div>
                <p className="font-bold text-slate-900 text-sm">Take a selfie</p>
                <p className="text-xs text-slate-400 mt-0.5">Open selfie camera and capture</p>
              </div>
            </button>
            <button onClick={() => { setShowPicker(false); galleryInputRef.current?.click(); }}
              className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors cursor-pointer text-left">
              <div className="w-12 h-12 rounded-2xl bg-violet-100 flex items-center justify-center flex-shrink-0">
                <ImageIcon size={22} className="text-violet-600" />
              </div>
              <div>
                <p className="font-bold text-slate-900 text-sm">Choose from Gallery</p>
                <p className="text-xs text-slate-400 mt-0.5">Browse your files or photos</p>
              </div>
            </button>
            <div className="h-px bg-slate-100 mx-5 mt-1" />
            <button onClick={() => setShowPicker(false)}
              className="w-full py-4 text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors cursor-pointer">
              Cancel
            </button>
            <div className="h-4" />
          </div>
        </div>
      )}

      {/* Webcam capture modal */}
      {showWebcam && (
        <div className="fixed inset-0 z-[60] bg-black flex flex-col">
          <div className="flex-1 relative overflow-hidden">
            <video ref={videoRef} autoPlay playsInline muted
              onCanPlay={() => setCamReady(true)}
              className="w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)' }} />
            {!camReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-black">
                <div className="w-10 h-10 rounded-full border-2 border-white/20 border-t-white animate-spin" />
              </div>
            )}
            <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-4 pb-2"
              style={{ background: 'linear-gradient(to bottom,rgba(0,0,0,.55),transparent)' }}>
              <button onClick={stopWebcam}
                className="w-10 h-10 rounded-full bg-black/40 flex items-center justify-center text-white backdrop-blur-sm">
                <X size={18} />
              </button>
              <p className="text-white text-sm font-semibold tracking-wide">Selfie Camera</p>
              <div className="w-10" />
            </div>
          </div>
          <div className="flex-shrink-0 flex items-center justify-center py-8 bg-black">
            <button onClick={capturePhoto} disabled={!camReady}
              className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center disabled:opacity-40 active:scale-95 transition-transform">
              <div className="w-[62px] h-[62px] rounded-full bg-white" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
