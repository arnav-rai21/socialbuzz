import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ChevronLeft,
  CloudUpload,
  FlipHorizontal,
  PenLine,
  Settings,
  Sparkles,
  Upload,
  User,
} from 'lucide-react';
import { toast } from 'sonner';

import AdminLogin from './components/AdminLogin';
import AdminPanel from './components/AdminPanel';
import LandingPage from './components/LandingPage';
import CanvasPreview from './components/CanvasPreview';
import CropModal from './components/CropModal';
import EventDashboard from './components/EventDashboard';
import ImageUpload from './components/ImageUpload';
import ShareButtons from './components/ShareButtons';
import UserForm from './components/UserForm';

import { IS_GAS, IS_GAS_ADMIN, INITIAL_EVENT_SLUG, INITIAL_MODE, callSaveTemplate, callUploadImage, loadBootstrap, loadBootstrapAsync } from './lib/server';
import type { EventMeta, FieldSettings, FontSettings, GeneratedAsset, ImageSlot, SharingSettings, TemplateConfig, TextSlot, UserProfile } from './types';
import { DEFAULT_FIELD_SETTINGS, DEFAULT_FONT_SETTINGS, DEFAULT_SHARING_SETTINGS } from './types';

const initialTemplate = loadBootstrap();

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [templateConfig, setTemplateConfig]             = useState<TemplateConfig>(initialTemplate);
  const [templateUploadDataUrl, setTemplateUploadDataUrl] = useState('');
  const [isSavingTemplate, setIsSavingTemplate]         = useState(false);
  const [fontSettings,    setFontSettings]              = useState<FontSettings>(initialTemplate.fontSettings    || DEFAULT_FONT_SETTINGS);
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
  const templateFileInputRef                           = useRef<HTMLInputElement>(null);
  const [templateIsDragOver, setTemplateIsDragOver]   = useState(false);

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

  // Fetch bootstrap data from /api/bootstrap on mount
  useEffect(() => {
    loadBootstrapAsync(eventSlug).then(data => {
      if (!data) return;
      if (data.templateConfig) {
        setTemplateConfig(data.templateConfig);
        if (data.templateConfig.fontSettings)    setFontSettings(data.templateConfig.fontSettings);
        if (data.templateConfig.sharingSettings) setSharingSettings(data.templateConfig.sharingSettings);
        if (data.templateConfig.fieldSettings)   setFieldSettings(data.templateConfig.fieldSettings);
      }
      if (Array.isArray(data.eventsList)) setEventsList(data.eventsList);
    });
  }, []);

  const hasTemplate   = Boolean(templateConfig.templateDataUrl);
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

  function handleTemplateLoad(dataUrl: string, fileName: string) {
    setTemplateUploadDataUrl(dataUrl);
    setTemplateConfig(prev => ({ ...prev, hasTemplate: true, templateName: fileName, templateDataUrl: dataUrl, textSlot: undefined }));
    setGeneratedAsset(null);
    setIsMappingMode(true);
  }

  function handleSlotChange(slot: ImageSlot) {
    setTemplateConfig(prev => ({ ...prev, imageSlot: slot }));
    setGeneratedAsset(null);
  }

  function handleTextSlotChange(slot: TextSlot | undefined) {
    setTemplateConfig(prev => ({ ...prev, textSlot: slot }));
    setGeneratedAsset(null);
  }

  function handleToggleMapping() {
    if (!templateConfig.hasTemplate) { toast.error('Upload a template first.'); return; }
    const next = !isMappingMode;
    setIsMappingMode(next);
    if (next) setIsTextMappingMode(false);
    toast.info(next ? 'Photo mapping — drag the blue box or handles.' : 'Photo mapping off.');
  }

  function handleToggleTextMapping() {
    if (!templateConfig.hasTemplate) { toast.error('Upload a template first.'); return; }
    const next = !isTextMappingMode;
    setIsTextMappingMode(next);
    if (next) setIsMappingMode(false);
    toast.info(next ? 'Text mapping — drag the green box or handles.' : 'Text mapping off.');
  }

  function handleSaveMapping() {
    const dataUrl = templateUploadDataUrl || templateConfig.templateDataUrl;
    if (!dataUrl) { toast.error('Select a template image first.'); return; }
    setIsSavingTemplate(true);
    const payloadTextSlot = templateConfig.textSlot; // capture before async
    callSaveTemplate(
      { fileName: templateConfig.templateName || `template_${Date.now()}.png`, templateDataUrl: dataUrl, imageSlot: templateConfig.imageSlot, textSlot: payloadTextSlot, eventSlug, fontSettings, sharingSettings, fieldSettings },
      (config) => {
        // Server may omit textSlot when Cloudinary re-fetch fails on load-back; preserve what was just saved.
        setTemplateConfig({ ...config, textSlot: config.textSlot ?? payloadTextSlot });
        if (config.fontSettings)    setFontSettings(config.fontSettings);
        if (config.sharingSettings) setSharingSettings(config.sharingSettings);
        if (config.fieldSettings)   setFieldSettings(config.fieldSettings);
        setTemplateUploadDataUrl('');
        setIsSavingTemplate(false);
        setIsAdminOpen(false);
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
  }

  function handleRemovePhoto() {
    setUserRawDataUrl('');
    setUserCroppedDataUrl('');
    setGeneratedAsset(null);
  }

  const handleCanvasDataUrl = useCallback((dataUrl: string) => { setFinalImageDataUrl(dataUrl); }, []);

  // ── Generate ──────────────────────────────────────────────────────────────

  function handleGenerate() {
    if (!templateConfig.templateDataUrl) { toast.error('No template loaded.'); return; }
    if (!userCroppedDataUrl) { toast.error('Upload and crop your photo first.'); return; }
    if (!finalImageDataUrl)  { toast.error('Preview not ready — wait a moment.'); return; }
    setIsGenerating(true);

    // Compress to JPEG before upload — ~4–6× smaller than PNG, significantly faster round-trip.
    const uploadCanvas = document.createElement('canvas');
    const uploadCtx    = uploadCanvas.getContext('2d');
    const img          = new Image();
    img.onload = () => {
      uploadCanvas.width  = img.width;
      uploadCanvas.height = img.height;
      uploadCtx!.drawImage(img, 0, 0);
      const jpegBase64 = uploadCanvas.toDataURL('image/jpeg', 0.82).replace(/^data:image\/jpeg;base64,/, '');
      callUploadImage(
        jpegBase64,
        profile,
        (asset) => { setGeneratedAsset(asset); setIsGenerating(false); setCurrentView('generate'); window.scrollTo({ top: 0, behavior: 'instant' }); toast.success('Your post is ready!'); },
        (err)   => { setIsGenerating(false); toast.error(`Generation failed: ${(err as Error)?.message ?? err}`); }
      );
    };
    img.src = finalImageDataUrl;
  }

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

  // Landing page — shown on root URL when not authenticated
  if (showLanding) {
    return <LandingPage onAuthenticated={handleAuthenticated} />;
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

      {/* Main content — two-column on desktop */}
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
                  : templateConfig.hasTemplate ? 'border-green-400 bg-green-50 hover:bg-green-100/60'
                  : 'border-slate-300 bg-white hover:border-blue-400 hover:bg-blue-50/40',
              ].join(' ')}
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center flex-shrink-0">
                {templateConfig.hasTemplate
                  ? <FlipHorizontal size={18} className="text-green-600" />
                  : <CloudUpload size={18} className="text-blue-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-700 truncate">
                  {templateConfig.hasTemplate ? templateConfig.templateName : 'Click or drag to upload template'}
                </p>
                <p className="text-[11px] text-slate-400">PNG, JPG or WEBP</p>
              </div>
              {templateConfig.hasTemplate && (
                <span className="text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full flex-shrink-0">Loaded</span>
              )}
              <input ref={templateFileInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAdminTemplateFile(f); e.target.value = ''; }} />
            </div>
          )}

          {/* Canvas */}
          <div className="flex-1 bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm min-h-0 flex items-center justify-center">
            <CanvasPreview
              templateConfig={templateConfig}
              userCroppedDataUrl={userCroppedDataUrl}
              profile={profile}
              fontSettings={fontSettings}
              isMappingMode={isMappingMode && isAdminActive}
              isTextMappingMode={isTextMappingMode && isAdminActive}
              showSlotIndicators={isAdminActive}
              onSlotChange={handleSlotChange}
              onTextSlotChange={handleTextSlotChange}
              onCanvasDataUrl={handleCanvasDataUrl}
            />
          </div>

          {/* Desktop Generate button — form view only */}
          {currentView === 'form' && (
            <button
              onClick={handleGenerate}
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
                          templateConfig={templateConfig}
                          isMappingMode={isMappingMode}
                          isTextMappingMode={isTextMappingMode}
                          fontSettings={fontSettings}
                          sharingSettings={sharingSettings}
                          fieldSettings={fieldSettings}
                          isSavingTemplate={isSavingTemplate}
                          hideTemplateUpload={true}
                          onTemplateLoad={handleTemplateLoad}
                          onSlotChange={handleSlotChange}
                          onTextSlotChange={handleTextSlotChange}
                          onSaveMapping={handleSaveMapping}
                          onToggleMapping={handleToggleMapping}
                          onToggleTextMapping={handleToggleTextMapping}
                          onFontChange={setFontSettings}
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
                        <img src={templateConfig.templateDataUrl} alt="template" className="w-full h-full object-cover" />
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
                  <button onClick={goBackToForm}
                    className="flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold text-violet-600 hover:bg-violet-50 cursor-pointer transition-colors active:bg-violet-100">
                    Change photo
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

      </div>{/* end two-column layout */}

      {/* Bottom CTA — only shown on form view (mobile only; desktop has button in right column) */}
      {currentView === 'form' && (
        <div className="lg:hidden sticky bottom-0 z-10 bg-white border-t border-slate-100 px-4 py-3 sm:px-5" style={{ paddingBottom: 'calc(0.75rem + var(--safe-bottom))' }}>
          <button
            onClick={handleGenerate}
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
      <CropModal open={cropModalOpen} imageSrc={userRawDataUrl} slot={templateConfig.imageSlot} onApply={handleCropApply} onClose={() => setCropModalOpen(false)} />
    </div>
  );
}
