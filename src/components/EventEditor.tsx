import { type ReactNode, useEffect, useState } from 'react';
import {
  AlertTriangle,
  BarChart2,
  Check,
  ChevronDown,
  ChevronLeft,
  Code2,
  Copy,
  ExternalLink,
  Facebook,
  FileText,
  Image as ImageIcon,
  Instagram,
  Link2,
  Linkedin,
  ListChecks,
  Loader,
  Lock,
  MessageCircle,
  Save,
  Scissors,
  Settings as SettingsIcon,
  Share2,
  Sparkles,
  Trash2,
  Twitter,
  Wand2,
} from 'lucide-react';
import { toast } from 'sonner';

import AdminPanel from './AdminPanel';
import CanvasPreview from './CanvasPreview';
import { StatsView } from './EventDashboard';
import { buildWidgetSnippet } from '../lib/server';
import type {
  EventMeta,
  EventStats,
  FieldSettings,
  FontSettings,
  ImageSlot,
  PhotoToolsSettings,
  SharingSettings,
  TemplateConfig,
  TextSlot,
  UserProfile,
} from '../types';
import { DEFAULT_PHOTO_TOOLS_SETTINGS, DEFAULT_SHARING_SETTINGS, X_CHAR_LIMIT } from '../types';

// ── Types ──────────────────────────────────────────────────────────────────────

type Section =
  | 'basic' | 'design' | 'fields' | 'sharing' | 'phototools'
  | 'analytics' | 'share' | 'settings';

interface EventEditorProps {
  eventSlug:          string;
  eventName:          string;
  eventsList:         EventMeta[];
  plan:               'free' | 'pro';
  isPro:              boolean;
  templatesLoading:   boolean;

  templates:          TemplateConfig[];
  activeKey:          string;
  activeTemplate:     TemplateConfig;
  activeFont:         FontSettings;
  profile:            UserProfile;
  userCroppedDataUrl: string;
  isMappingMode:      boolean;
  isTextMappingMode:  boolean;
  isSaving:           boolean;

  sharingSettings:    SharingSettings;
  fieldSettings:      FieldSettings;
  photoToolsSettings: PhotoToolsSettings;

  editStats:          EventStats | null;
  editStatsLoading:   boolean;
  isDeletingEvent:    boolean;

  onSwitchEvent:      (slug: string) => void;
  onBackToDashboard:  () => void;
  onOpenLiveEvent:    () => void;
  onUpgrade:          () => void;

  onTemplateLoad:      (dataUrl: string, fileName: string) => void;
  onSelectTemplate:    (key: string) => void;
  onDeleteTemplate:    (t: TemplateConfig) => void;
  onSlotChange:        (slot: ImageSlot) => void;
  onClearPhotoSlot:    () => void;
  onTextSlotChange:    (slot: TextSlot | undefined) => void;
  onToggleMapping:     () => void;
  onToggleTextMapping: () => void;
  onFontChange:        (fs: FontSettings) => void;
  onSaveTemplate:      () => void;

  onSharingChange:      (s: SharingSettings) => void;
  onFieldSettingsChange:(s: FieldSettings) => void;
  onPhotoToolsChange:   (s: PhotoToolsSettings) => void;
  onSaveEventSettings:  (onDone?: () => void) => void;
  onRenameEvent:        (name: string, onDone?: () => void) => void;

  onLoadStats:      (slug: string) => void;
  onDeleteActivity: (visitorId?: string) => void;
  onDeleteEvent:    () => void;
}

// ── Nav model ────────────────────────────────────────────────────────────────

const SECTION_TITLES: Record<Section, string> = {
  basic:      'Basic Details',
  design:     'Templates & Design',
  fields:     'Form Fields',
  sharing:    'Sharing',
  phototools: 'Photo Tools',
  analytics:  'Analytics & Reporting',
  share:      'Share & Embed',
  settings:   'Settings',
};

// Sections whose "Save changes" persists something.
const SAVEABLE: Section[] = ['design', 'fields', 'sharing', 'phototools'];

const noop = () => {};

const joinCap = (cap: string, tags: string) =>
  [cap.trim(), tags.trim()].filter(Boolean).join('\n\n');

// ── Component ──────────────────────────────────────────────────────────────────

export default function EventEditor(props: EventEditorProps) {
  const {
    eventSlug, eventName, eventsList, plan, isPro, templatesLoading,
    templates, activeKey, activeTemplate, activeFont, profile, userCroppedDataUrl,
    isMappingMode, isTextMappingMode, isSaving,
    sharingSettings, fieldSettings, photoToolsSettings,
    editStats, editStatsLoading, isDeletingEvent,
    onSwitchEvent, onBackToDashboard, onOpenLiveEvent, onUpgrade,
    onTemplateLoad, onSelectTemplate, onDeleteTemplate, onSlotChange, onClearPhotoSlot,
    onTextSlotChange, onToggleMapping, onToggleTextMapping, onFontChange, onSaveTemplate,
    onSharingChange, onFieldSettingsChange, onPhotoToolsChange, onSaveEventSettings,
    onRenameEvent, onLoadStats, onDeleteActivity, onDeleteEvent,
  } = props;

  const [section, setSection]       = useState<Section>('design');
  const [eventMenuOpen, setEventMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Basic Details: editable event name.
  const [nameDraft, setNameDraft] = useState(eventName);
  const [renaming,  setRenaming]  = useState(false);
  useEffect(() => { setNameDraft(eventName); }, [eventName]);
  const nameChanged = nameDraft.trim().length > 0 && nameDraft.trim() !== eventName;
  function saveName() {
    if (!nameChanged || renaming) return;
    setRenaming(true);
    onRenameEvent(nameDraft.trim(), () => setRenaming(false));
  }

  // Embed widget config (Share & Embed section)
  const [embedPosition, setEmbedPosition] = useState<'right' | 'left'>('right');
  const [embedStyle,    setEmbedStyle]    = useState<'solid' | 'gradient'>('gradient');
  const [embedColor1,   setEmbedColor1]   = useState('#7c3aed');
  const [embedColor2,   setEmbedColor2]   = useState('#db2777');

  const ss  = sharingSettings    || DEFAULT_SHARING_SETTINGS;
  const pts = photoToolsSettings || DEFAULT_PHOTO_TOOLS_SETTINGS;

  const eventUrl  = typeof window !== 'undefined'
    ? window.location.origin + window.location.pathname + '?event=' + encodeURIComponent(eventSlug)
    : '';
  const embedCode = buildWidgetSnippet({ slug: eventSlug, position: embedPosition, colorStyle: embedStyle, color1: embedColor1, color2: embedColor2 });

  // Auto-load analytics when entering the section (or after an event switch resets it).
  useEffect(() => {
    if (section === 'analytics' && !editStats && !editStatsLoading) onLoadStats(eventSlug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, eventSlug, editStats]);

  const switchable = eventsList.filter(e => e.slug !== 'default');

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text).then(() => toast.success(label)).catch(() => toast.error('Copy failed'));
  }

  function handleSaveChanges() {
    if (section === 'design' && activeTemplate.templateDataUrl) onSaveTemplate();
    else onSaveEventSettings();
  }

  function selectSection(key: Section, locked: boolean) {
    if (locked) { onUpgrade(); return; }
    setSection(key);
  }

  // ── Sidebar item ──────────────────────────────────────────────────────────

  const NavItem = ({ id, label, Icon, locked = false, indent = false }: {
    id: Section; label: string; Icon: any; locked?: boolean; indent?: boolean;
  }) => {
    const active = section === id;
    return (
      <button
        onClick={() => selectSection(id, locked)}
        className={[
          'w-full flex items-center gap-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer',
          indent ? 'pl-3 pr-3 py-2' : 'px-3 py-2.5',
          active ? 'bg-violet-50 text-violet-700' : 'text-slate-600 hover:bg-slate-100',
        ].join(' ')}
      >
        <Icon size={16} className={active ? 'text-violet-600' : 'text-slate-400'} />
        <span className="flex-1 text-left truncate">{label}</span>
        {locked && <Lock size={12} className="text-slate-300" />}
      </button>
    );
  };

  const GroupLabel = ({ children }: { children: string }) => (
    <p className="px-3 pt-4 pb-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">{children}</p>
  );

  return (
    <div className="flex h-[100dvh] w-full bg-slate-50 overflow-hidden">

      {/* ── Sidebar ── */}
      <aside className="w-60 flex-shrink-0 border-r border-slate-200 bg-white flex flex-col overflow-y-auto">
        <div className="p-3 border-b border-slate-100">
          <button
            onClick={onBackToDashboard}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold text-white cursor-pointer transition-all active:scale-[0.98] hover:brightness-110"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #db2777)' }}
          >
            <ChevronLeft size={16} /> Back To Dashboard
          </button>
        </div>

        <nav className="flex-1 px-2 pb-4">
          <GroupLabel>Event Setup</GroupLabel>
          <NavItem id="basic"      label="Basic Details"        Icon={FileText}  indent />
          <NavItem id="design"     label="Templates & Design"   Icon={ImageIcon} indent />
          <NavItem id="fields"     label="Form Fields"          Icon={ListChecks} indent />
          <NavItem id="sharing"    label="Sharing"              Icon={Share2}    indent />
          <NavItem id="phototools" label="Photo Tools"          Icon={Wand2}     indent />

          <GroupLabel>Analytics &amp; Reporting</GroupLabel>
          <NavItem id="analytics"  label="Analytics"            Icon={BarChart2} locked={!isPro} indent />

          <GroupLabel>Share &amp; Embed</GroupLabel>
          <NavItem id="share"      label="Share & Embed"        Icon={Link2}     indent />

          <GroupLabel>Settings</GroupLabel>
          <NavItem id="settings"   label="Settings"             Icon={SettingsIcon} indent />
        </nav>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top bar */}
        <header className="flex-shrink-0 border-b border-slate-200 bg-white flex items-center justify-between gap-3 px-5 sm:px-6 h-16">
          <div className="min-w-0">
            <h1 className="text-lg font-black text-slate-900 leading-tight truncate">{SECTION_TITLES[section]}</h1>
            <p className="text-xs text-slate-400 leading-tight truncate">
              Editing{' '}
              <button onClick={onOpenLiveEvent} className="font-semibold text-violet-600 hover:text-violet-800 cursor-pointer inline-flex items-center gap-0.5">
                {eventName} <ExternalLink size={11} />
              </button>
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Event switcher */}
            <div className="relative">
              <button
                onClick={() => setEventMenuOpen(o => !o)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors max-w-[200px]"
              >
                <span className="truncate">{eventName}</span>
                <ChevronDown size={15} className="text-slate-400 flex-shrink-0" />
              </button>
              {eventMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setEventMenuOpen(false)} />
                  <div className="absolute right-0 mt-2 w-64 z-50 rounded-2xl border border-slate-100 bg-white shadow-xl overflow-hidden max-h-80 overflow-y-auto">
                    <p className="px-4 pt-3 pb-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Switch event</p>
                    {switchable.length === 0 && (
                      <p className="px-4 py-3 text-sm text-slate-400">No other events.</p>
                    )}
                    {switchable.map(e => (
                      <button
                        key={e.slug}
                        onClick={() => { setEventMenuOpen(false); if (e.slug !== eventSlug) onSwitchEvent(e.slug); }}
                        className={['w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left hover:bg-slate-50 cursor-pointer transition-colors',
                          e.slug === eventSlug ? 'text-violet-700 font-bold' : 'text-slate-700'].join(' ')}
                      >
                        <span className="flex-1 truncate">{e.name}</span>
                        {e.slug === eventSlug && <Check size={14} className="text-violet-600" />}
                      </button>
                    ))}
                    <button
                      onClick={() => { setEventMenuOpen(false); onBackToDashboard(); }}
                      className="w-full px-4 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-50 cursor-pointer text-left border-t border-slate-100"
                    >
                      All events →
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Save changes */}
            {SAVEABLE.includes(section) && (
              <button
                onClick={handleSaveChanges}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-bold cursor-pointer transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed hover:brightness-110"
                style={{ background: 'linear-gradient(135deg, #f43f5e, #db2777)' }}
              >
                {isSaving ? <Loader size={15} className="animate-spin" /> : <Save size={15} />}
                Save changes
              </button>
            )}
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto bg-slate-50">
          {templatesLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-32 text-center">
              <Loader size={28} className="animate-spin text-violet-500" />
              <p className="text-sm text-slate-400 font-medium">Loading event…</p>
            </div>
          ) : (
            <div className="px-5 sm:px-8 py-6">

              {/* ── Basic Details ── */}
              {section === 'basic' && (
                <div className="max-w-2xl flex flex-col gap-5">
                  <SectionCard title="Event details" desc="Identity and public link for this event.">
                    <Field label="Event name">
                      <div className="flex items-center gap-2 flex-wrap">
                        <input
                          type="text"
                          value={nameDraft}
                          maxLength={120}
                          onChange={(e) => setNameDraft(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveName(); }}
                          className="flex-1 min-w-[220px] px-3 py-2.5 rounded-xl border-[1.5px] border-slate-200 bg-white text-slate-900 text-sm font-semibold outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 transition-all"
                        />
                        <button
                          onClick={saveName}
                          disabled={!nameChanged || renaming}
                          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-bold cursor-pointer hover:bg-violet-700 transition-colors active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {renaming ? <Loader size={14} className="animate-spin" /> : <Save size={14} />} Save name
                        </button>
                      </div>
                    </Field>
                    <Field label="Slug">
                      <code className="text-sm font-mono text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 inline-block">{eventSlug}</code>
                    </Field>
                    <Field label="Plan">
                      <span className={['inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full',
                        isPro ? 'bg-violet-50 text-violet-700 border border-violet-100' : 'bg-slate-100 text-slate-500'].join(' ')}>
                        {isPro ? <><Sparkles size={12} /> Pro</> : 'Free'}
                      </span>
                    </Field>
                    <Field label="Public event link">
                      <div className="flex items-center gap-2 flex-wrap">
                        <code className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 truncate max-w-full">{eventUrl}</code>
                        <button onClick={() => copy(eventUrl, 'Link copied!')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-bold cursor-pointer hover:bg-violet-700 transition-colors active:scale-95">
                          <Copy size={13} /> Copy
                        </button>
                        <a href={eventUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 text-xs font-bold cursor-pointer hover:bg-slate-50 transition-colors active:scale-95">
                          <ExternalLink size={13} /> Open
                        </a>
                      </div>
                    </Field>
                  </SectionCard>
                </div>
              )}

              {/* ── Templates & Design ── */}
              {section === 'design' && (
                <div className="flex flex-col xl:flex-row gap-6">
                  <div className="xl:w-[420px] flex-shrink-0">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                      <AdminPanel
                        open
                        templateConfig={activeTemplate}
                        imageSlotSet={activeTemplate.imageSlotSet}
                        templates={templates}
                        activeKey={activeKey}
                        isMappingMode={isMappingMode}
                        isTextMappingMode={isTextMappingMode}
                        fontSettings={activeFont}
                        sharingSettings={sharingSettings}
                        fieldSettings={fieldSettings}
                        isSavingTemplate={isSaving}
                        hideTemplateUpload={false}
                        showHeader={false}
                        showSharing={false}
                        showFields={false}
                        showSave={false}
                        onTemplateLoad={onTemplateLoad}
                        onSelectTemplate={onSelectTemplate}
                        onDeleteTemplate={onDeleteTemplate}
                        onSlotChange={onSlotChange}
                        onTextSlotChange={onTextSlotChange}
                        onSaveMapping={onSaveTemplate}
                        onToggleMapping={onToggleMapping}
                        onToggleTextMapping={onToggleTextMapping}
                        onFontChange={onFontChange}
                        onSharingChange={onSharingChange}
                        onFieldSettingsChange={onFieldSettingsChange}
                        eventSlug={eventSlug}
                      />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 xl:sticky xl:top-0">
                      <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">Live preview</p>
                      <div className="rounded-2xl overflow-hidden border border-slate-100 bg-slate-50 aspect-square max-h-[70vh] flex items-center justify-center">
                        <CanvasPreview
                          templateConfig={activeTemplate}
                          imageSlotSet={activeTemplate.imageSlotSet}
                          userCroppedDataUrl={userCroppedDataUrl}
                          profile={profile}
                          fontSettings={activeFont}
                          isMappingMode={isMappingMode}
                          isTextMappingMode={isTextMappingMode}
                          showSlotIndicators
                          onSlotChange={onSlotChange}
                          onClearPhotoSlot={onClearPhotoSlot}
                          onTextSlotChange={onTextSlotChange}
                          onCanvasDataUrl={noop}
                        />
                      </div>
                      <p className="text-[11px] text-slate-400 mt-2">Toggle mapping mode on the left, then drag the photo/text areas here.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Form Fields ── */}
              {section === 'fields' && (
                <div className="max-w-2xl">
                  <SectionCard title="Form Fields" desc="Choose which fields attendees fill in when creating their post.">
                    <FormFieldsEditor fieldSettings={fieldSettings} onChange={onFieldSettingsChange} />
                  </SectionCard>
                </div>
              )}

              {/* ── Sharing ── */}
              {section === 'sharing' && (
                <SharingSection ss={ss} onChange={onSharingChange} template={activeTemplate} />
              )}

              {/* ── Photo Tools ── */}
              {section === 'phototools' && (
                <div className="max-w-2xl flex flex-col gap-5">
                  <SectionCard title="AI Photo Tools" desc="Control which one-tap photo tools attendees can use in the crop step.">
                    {!isPro && (
                      <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-100 rounded-xl p-3 mb-1">
                        <Sparkles size={15} className="text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-700">These are Pro features. Attendees can only use them while this event is on the Pro plan — but you can set your preference now.</p>
                      </div>
                    )}
                    <ToolToggle
                      Icon={Scissors}
                      title="Remove background"
                      desc="Let attendees cut out the background of their photo."
                      checked={pts.removeBgEnabled}
                      onChange={(v) => onPhotoToolsChange({ ...pts, removeBgEnabled: v })}
                    />
                    <ToolToggle
                      Icon={Sparkles}
                      title="Enhance"
                      desc="Let attendees sharpen and upscale their photo."
                      checked={pts.enhanceEnabled}
                      onChange={(v) => onPhotoToolsChange({ ...pts, enhanceEnabled: v })}
                    />
                  </SectionCard>
                </div>
              )}

              {/* ── Analytics ── */}
              {section === 'analytics' && (
                <div className="max-w-5xl">
                  {editStatsLoading ? (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center gap-3 py-20">
                      <Loader size={26} className="animate-spin text-violet-500" />
                      <p className="text-sm text-slate-400 font-medium">Loading analytics…</p>
                    </div>
                  ) : editStats ? (
                    <StatsView slug={eventSlug} stats={editStats} eventName={eventName} embedded onDeleteActivity={onDeleteActivity} />
                  ) : (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm py-16 text-center">
                      <button onClick={() => onLoadStats(eventSlug)} className="text-sm font-semibold text-violet-600 hover:text-violet-800 cursor-pointer">Load analytics</button>
                    </div>
                  )}
                </div>
              )}

              {/* ── Share & Embed ── */}
              {section === 'share' && (
                <div className="max-w-2xl flex flex-col gap-5">
                  <SectionCard title="Share link" desc="Share this link with attendees, or open the live event page.">
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
                      <code className="text-xs text-slate-600 truncate flex-1">{eventUrl}</code>
                    </div>
                    <div className="flex gap-2 mt-1">
                      <button onClick={() => copy(eventUrl, 'Link copied!')} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-bold cursor-pointer hover:bg-violet-700 transition-colors active:scale-95">
                        <Link2 size={14} /> Copy Link
                      </button>
                      <a href={eventUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-bold cursor-pointer hover:bg-slate-50 transition-colors active:scale-95">
                        <ExternalLink size={14} /> Open event
                      </a>
                    </div>
                  </SectionCard>

                  <SectionCard title="Website Widget" desc="Floating button + popup panel. Paste before </body> on any page.">
                    {!isPro ? (
                      <div className="flex flex-col items-start gap-3 py-4">
                        <div className="flex items-center gap-2 text-slate-500 text-sm"><Lock size={15} /> The embeddable widget is a Pro feature.</div>
                        <button onClick={onUpgrade} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-bold cursor-pointer transition-all active:scale-95" style={{ background: 'linear-gradient(135deg, #7c3aed, #ec4899)' }}>
                          <Sparkles size={14} /> Upgrade to Pro
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-4">
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
                              <input type="color" value={embedColor1} onChange={e => setEmbedColor1(e.target.value)} className="w-9 h-9 rounded-lg border border-slate-200 cursor-pointer p-0.5 bg-white" />
                            </label>
                            {embedStyle === 'gradient' && (
                              <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                                End
                                <input type="color" value={embedColor2} onChange={e => setEmbedColor2(e.target.value)} className="w-9 h-9 rounded-lg border border-slate-200 cursor-pointer p-0.5 bg-white" />
                              </label>
                            )}
                          </div>
                          <div className="flex items-center gap-2 px-4 h-11 self-start rounded-full text-white text-sm font-bold shadow"
                            style={{ background: embedStyle === 'gradient' ? `linear-gradient(135deg, ${embedColor1} 0%, ${embedColor2} 100%)` : embedColor1 }}>
                            <Sparkles size={15} /> Start Social Buzz
                          </div>
                        </div>
                        <div className="bg-slate-900 rounded-xl overflow-hidden">
                          <pre className="text-xs text-emerald-400 font-mono px-4 py-4 overflow-x-auto leading-relaxed whitespace-pre">{embedCode}</pre>
                        </div>
                        <button onClick={() => copy(embedCode, 'Widget code copied!')} className="self-start flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-bold cursor-pointer hover:bg-violet-700 transition-colors active:scale-95">
                          <Code2 size={15} /> Copy Widget Code
                        </button>
                      </div>
                    )}
                  </SectionCard>
                </div>
              )}

              {/* ── Settings (danger zone) ── */}
              {section === 'settings' && (
                <div className="max-w-2xl">
                  <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-6 flex flex-col gap-4">
                    <div>
                      <h3 className="text-base font-black text-red-600">Danger Zone</h3>
                      <p className="text-sm text-slate-500 mt-1">Permanently delete <span className="font-semibold text-slate-700">{eventName}</span>, including all its templates and analytics. This cannot be undone.</p>
                    </div>
                    {eventSlug === 'default' ? (
                      <p className="text-sm text-slate-400">The default event cannot be deleted.</p>
                    ) : confirmDelete ? (
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-sm font-semibold text-red-700 flex items-center gap-1.5"><AlertTriangle size={15} /> Delete this event?</span>
                        <button onClick={onDeleteEvent} disabled={isDeletingEvent}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-bold cursor-pointer hover:bg-red-700 transition-colors active:scale-95 disabled:opacity-50">
                          {isDeletingEvent ? <Loader size={13} className="animate-spin" /> : <Trash2 size={13} />} Yes, delete
                        </button>
                        <button onClick={() => setConfirmDelete(false)} className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold cursor-pointer hover:bg-slate-50 transition-colors">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmDelete(true)}
                        className="self-start flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-50 text-red-600 border border-red-200 text-sm font-bold cursor-pointer hover:bg-red-100 transition-colors active:scale-95">
                        <Trash2 size={15} /> Delete event
                      </button>
                    )}
                  </div>
                </div>
              )}

            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// ── Small presentational helpers ──────────────────────────────────────────────

function SectionCard({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
      <div>
        <h3 className="text-base font-black text-slate-900">{title}</h3>
        {desc && <p className="text-sm text-slate-500 mt-1">{desc}</p>}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</p>
      {children}
    </div>
  );
}

function ToolToggle({ Icon, title, desc, checked, onChange }: {
  Icon: any; title: string; desc: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className={['flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all', checked ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-100'].join(' ')}>
      <div className={['w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0', checked ? 'bg-violet-50' : 'bg-slate-100'].join(' ')}>
        <Icon size={16} className={checked ? 'text-violet-600' : 'text-slate-400'} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-800">{title}</p>
        <p className="text-xs text-slate-400">{desc}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={['w-11 h-6 rounded-full transition-all duration-200 relative flex-shrink-0 cursor-pointer', checked ? 'bg-violet-600' : 'bg-slate-200'].join(' ')}
      >
        <span className={['absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-200', checked ? 'left-[22px]' : 'left-0.5'].join(' ')} />
      </button>
    </div>
  );
}

// ── Form Fields editor (reused layout from AdminPanel) ─────────────────────────

const FIELD_DEFS = [
  { key: 'name'    as const, label: 'Full Name'        },
  { key: 'title'   as const, label: 'Role/Designation' },
  { key: 'company' as const, label: 'Company'          },
  { key: 'email'   as const, label: 'Email Address'    },
];

function FormFieldsEditor({ fieldSettings, onChange }: { fieldSettings: FieldSettings; onChange: (s: FieldSettings) => void }) {
  return (
    <div className="flex flex-col gap-2">
      {FIELD_DEFS.map(({ key, label }) => {
        const cfg = fieldSettings[key];
        return (
          <div key={key} className={['flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all', cfg.visible ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-100 opacity-60'].join(' ')}>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-sm font-semibold text-slate-700 truncate">{label}</span>
              {key === 'name' && cfg.visible && (
                <span className="text-[10px] font-bold text-violet-500 bg-violet-50 border border-violet-100 rounded px-1.5 py-0.5 flex-shrink-0">always required</span>
              )}
            </div>
            <label className="flex items-center gap-1.5 cursor-pointer flex-shrink-0">
              <span className="text-[11px] font-medium text-slate-500">Show</span>
              <button
                type="button"
                onClick={() => onChange({ ...fieldSettings, [key]: { ...cfg, visible: !cfg.visible, required: key === 'name' ? true : (cfg.visible ? false : cfg.required) } })}
                className={['w-9 h-5 rounded-full transition-all duration-200 relative flex-shrink-0', cfg.visible ? 'bg-violet-600' : 'bg-slate-200'].join(' ')}
              >
                <span className={['absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-200', cfg.visible ? 'left-[18px]' : 'left-0.5'].join(' ')} />
              </button>
            </label>
            {key !== 'name' && (
              <label className="flex items-center gap-1.5 cursor-pointer flex-shrink-0">
                <span className="text-[11px] font-medium text-slate-500">Required</span>
                <button
                  type="button"
                  disabled={!cfg.visible}
                  onClick={() => onChange({ ...fieldSettings, [key]: { ...cfg, required: !cfg.required } })}
                  className={['w-9 h-5 rounded-full transition-all duration-200 relative flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed', cfg.required && cfg.visible ? 'bg-pink-500' : 'bg-slate-200'].join(' ')}
                >
                  <span className={['absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-200', cfg.required && cfg.visible ? 'left-[18px]' : 'left-0.5'].join(' ')} />
                </button>
              </label>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Sharing section: caption + X caption + hashtags + live post preview ────────

const PREVIEW_PLATFORMS = [
  { key: 'linkedin',  label: 'LinkedIn',  Icon: Linkedin,      color: '#0a66c2' },
  { key: 'x',         label: 'X',         Icon: Twitter,       color: '#000000' },
  { key: 'instagram', label: 'Instagram', Icon: Instagram,     color: '#dc2743' },
  { key: 'whatsapp',  label: 'WhatsApp',  Icon: MessageCircle, color: '#16a34a' },
  { key: 'facebook',  label: 'Facebook',  Icon: Facebook,      color: '#1877f2' },
] as const;

type PreviewPlatform = typeof PREVIEW_PLATFORMS[number]['key'];

function SharingSection({ ss, onChange, template }: { ss: SharingSettings; onChange: (s: SharingSettings) => void; template: TemplateConfig }) {
  const [platform, setPlatform] = useState<PreviewPlatform>('linkedin');

  const caption   = ss.defaultCaption  || '';
  const hashtags  = ss.defaultHashtags || '';
  const xCaption  = ss.xCaption || '';

  const xFull = joinCap(caption, hashtags);      // what X would post from the default caption
  const xOver = xFull.length > X_CHAR_LIMIT;
  const xCapLen = xCaption.length;

  const inputCls = 'w-full px-3 py-2.5 rounded-xl border-[1.5px] border-slate-200 bg-white text-slate-900 text-sm font-medium outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 transition-all';

  // Effective text for the preview (X uses its own caption when provided).
  const previewText = platform === 'x'
    ? joinCap(xCaption || caption, hashtags)
    : joinCap(caption, hashtags);

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Editor */}
      <div className="flex-1 min-w-0 max-w-2xl">
        <SectionCard title="Default Caption & Hashtags" desc="Pre-filled for attendees when they share. They can still edit before posting.">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Default Caption</label>
            <textarea
              value={caption}
              onChange={(e) => onChange({ ...ss, defaultCaption: e.target.value })}
              placeholder="Pre-filled caption shown to users when they share…"
              rows={6}
              className={inputCls + ' resize-y'}
            />
            <div className="flex items-center justify-between mt-1.5 text-xs">
              <span className="text-slate-400">{caption.length} characters</span>
              <span className={xOver ? 'text-red-500 font-bold' : 'text-slate-400'}>{xFull.length}/{X_CHAR_LIMIT} for X</span>
            </div>
          </div>

          {xOver && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
              <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">
                Your caption is over X's {X_CHAR_LIMIT}-character limit. Add a shorter version below — X will use it instead.
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              X Caption <span className="font-normal text-slate-400">(used only for X)</span>
            </label>
            <textarea
              value={xCaption}
              onChange={(e) => onChange({ ...ss, xCaption: e.target.value })}
              placeholder="Optional shorter caption for X…"
              rows={3}
              className={inputCls + ' resize-y'}
            />
            <div className="flex items-center justify-end mt-1.5 text-xs">
              <span className={xCapLen > X_CHAR_LIMIT ? 'text-red-500 font-bold' : 'text-slate-400'}>{xCapLen}/{X_CHAR_LIMIT}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Default Hashtags</label>
            <input
              type="text"
              value={hashtags}
              onChange={(e) => onChange({ ...ss, defaultHashtags: e.target.value })}
              placeholder="#socialmedia #networking #socialbuzz"
              className={inputCls}
            />
            <p className="text-xs text-slate-400 mt-1">Automatically appended to every post.</p>
          </div>
        </SectionCard>
      </div>

      {/* Preview */}
      <div className="lg:w-[380px] flex-shrink-0">
        <div className="lg:sticky lg:top-0">
          <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">Post Preview</p>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {PREVIEW_PLATFORMS.map(p => {
              const active = platform === p.key;
              return (
                <button key={p.key} onClick={() => setPlatform(p.key)}
                  className={['flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer transition-colors',
                    active ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'].join(' ')}>
                  <p.Icon size={13} /> {p.label}
                </button>
              );
            })}
          </div>
          <PostPreview platform={platform} text={previewText} template={template} />
        </div>
      </div>
    </div>
  );
}

function PostPreview({ platform, text, template }: { platform: PreviewPlatform; text: string; template: TemplateConfig }) {
  const img = template.hasTemplate ? template.templateDataUrl : '';
  const ImagePlaceholder = (
    <div className="w-full aspect-square bg-gradient-to-br from-violet-100 to-pink-100 flex items-center justify-center text-violet-300">
      <ImageIcon size={40} />
    </div>
  );
  const image = img
    ? <img src={img} alt="post" className="w-full h-auto block" />
    : ImagePlaceholder;

  const bodyText = text || 'Your caption will appear here…';

  // WhatsApp — chat bubble
  if (platform === 'whatsapp') {
    return (
      <div className="rounded-2xl border border-slate-200 bg-[#e5ddd5] p-4 shadow-sm">
        <div className="ml-auto max-w-[260px] rounded-2xl rounded-tr-sm bg-[#dcf8c6] overflow-hidden shadow">
          <div className="p-1">{image}</div>
          <p className="text-[13px] text-slate-800 whitespace-pre-wrap break-words px-2 pb-2 leading-snug">{bodyText}</p>
        </div>
      </div>
    );
  }

  // Instagram — image first, caption below
  if (platform === 'instagram') {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="flex items-center gap-2 px-3 py-2.5">
          <div className="w-7 h-7 rounded-full" style={{ background: 'linear-gradient(135deg,#f09433,#dc2743,#bc1888)' }} />
          <span className="text-[13px] font-bold text-slate-800">your_handle</span>
        </div>
        {image}
        <p className="text-[13px] text-slate-800 whitespace-pre-wrap break-words px-3 py-3 leading-snug">
          <span className="font-bold mr-1.5">your_handle</span>{bodyText}
        </p>
      </div>
    );
  }

  // LinkedIn / X / Facebook — header, caption, image, action bar
  const header = platform === 'x'
    ? { name: 'Your Name', sub: '@yourhandle', accent: '#000000' }
    : platform === 'facebook'
      ? { name: 'Your Name', sub: 'Just now', accent: '#1877f2' }
      : { name: 'Your Name', sub: 'Head of Marketing · now', accent: '#0a66c2' };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      <div className="flex items-center gap-2.5 px-4 pt-4 pb-2">
        <div className="w-9 h-9 rounded-full flex-shrink-0" style={{ background: `linear-gradient(135deg, ${header.accent}, #a78bfa)` }} />
        <div className="min-w-0">
          <p className="text-[13px] font-bold text-slate-900 truncate">{header.name}</p>
          <p className="text-[11px] text-slate-400 truncate">{header.sub}</p>
        </div>
      </div>
      <p className="text-[13px] text-slate-800 whitespace-pre-wrap break-words px-4 pb-3 leading-snug">{bodyText}</p>
      {image}
      <div className="flex items-center justify-around px-4 py-2.5 border-t border-slate-100 text-[11px] font-semibold text-slate-400">
        <span>Like</span><span>Comment</span><span>{platform === 'x' ? 'Repost' : 'Share'}</span><span>Send</span>
      </div>
    </div>
  );
}
