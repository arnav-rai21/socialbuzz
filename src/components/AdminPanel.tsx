import React, { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Briefcase, Building2, CloudUpload, Crosshair, FlipHorizontal, Loader, Mail, Save, Type, User } from 'lucide-react';
import { toast } from 'sonner';
import type { FieldSettings, FontSettings, ImageSlot, SharingSettings, TemplateConfig, TextSlot } from '../types';
import { DEFAULT_FIELD_SETTINGS, DEFAULT_FONT_SETTINGS, DEFAULT_SHARING_SETTINGS } from '../types';

interface AdminPanelProps {
  open: boolean;
  templateConfig: TemplateConfig;
  isMappingMode: boolean;
  isTextMappingMode: boolean;
  fontSettings: FontSettings;
  sharingSettings: SharingSettings;
  fieldSettings: FieldSettings;
  onTemplateLoad: (dataUrl: string, fileName: string) => void;
  onSlotChange: (slot: ImageSlot) => void;
  onTextSlotChange: (slot: TextSlot | undefined) => void;
  isSavingTemplate: boolean;
  hideTemplateUpload?: boolean;
  onSaveMapping: () => void;
  onToggleMapping: () => void;
  onToggleTextMapping: () => void;
  onFontChange: (s: FontSettings) => void;
  onSharingChange: (s: SharingSettings) => void;
  onFieldSettingsChange: (s: FieldSettings) => void;
  eventSlug?: string;
  onViewDashboard?: () => void;
}

const FONT_FAMILIES = [
  { label: 'Inter', value: 'Inter, Arial, sans-serif' },
  { label: 'Poppins', value: 'Poppins, Arial, sans-serif' },
  { label: 'Plus Jakarta Sans', value: '"Plus Jakarta Sans", Arial, sans-serif' },
  { label: 'Barlow Condensed', value: '"Barlow Condensed", Arial, sans-serif' },
  { label: 'Montserrat', value: 'Montserrat, Arial, sans-serif' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
];

export default function AdminPanel({
  open, templateConfig, isMappingMode, isTextMappingMode,
  fontSettings, sharingSettings, fieldSettings, isSavingTemplate, hideTemplateUpload,
  onTemplateLoad, onSlotChange, onTextSlotChange, onSaveMapping, onToggleMapping, onToggleTextMapping,
  onFontChange, onSharingChange, onFieldSettingsChange,
  eventSlug, onViewDashboard,
}: AdminPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const slot = templateConfig.imageSlot;
  const textSlot = templateConfig.textSlot;
  const fs = fontSettings || DEFAULT_FONT_SETTINGS;
  const ss = sharingSettings || DEFAULT_SHARING_SETTINGS;
  const flds = fieldSettings || DEFAULT_FIELD_SETTINGS;

  const FIELD_DEFS = [
    { key: 'name' as const, label: 'Full Name', Icon: User },
    { key: 'title' as const, label: 'Role/Designation', Icon: Briefcase },
    { key: 'company' as const, label: 'Company', Icon: Building2 },
    { key: 'email' as const, label: 'Email Address', Icon: Mail },
  ];

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) { toast.error('Please select a valid image file.'); return; }
    try {
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((res, rej) => {
        reader.onload = () => res(reader.result as string);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });
      onTemplateLoad(dataUrl, file.name);
      toast.info(`Template "${file.name}" loaded — drag the slot, then save.`);
    } catch { toast.error('Could not read the template file.'); }
  }

  const inputCls =
    'w-full px-3 py-2.5 rounded-xl border-[1.5px] border-slate-200 bg-white text-slate-900 text-sm font-medium outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-500/10 transition-all duration-150';

  const SectionLabel = ({ children }: { children: string }) => (
    <p className="text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider">{children}</p>
  );

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          key="admin-panel"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          className="overflow-hidden"
        >
          <div className="flex flex-col gap-5 pt-1">

            {/* Header: back link + event slug badge */}
            <div className="flex items-center justify-between">
              {onViewDashboard && (
                <button
                  type="button"
                  onClick={onViewDashboard}
                  className="text-xs font-semibold text-violet-600 hover:text-violet-800 transition-colors cursor-pointer bg-transparent border-none p-0"
                >
                  ← All Events
                </button>
              )}
              <span className="ml-auto text-xs font-medium text-slate-500 bg-slate-100 border border-slate-200 rounded-full px-2.5 py-0.5">
                Editing: {eventSlug || 'default'}
              </span>
            </div>

            {/* Photo mapping mode */}
            <div className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-white border border-slate-200">
              <p className="text-xs text-slate-500 leading-relaxed flex-1">
                Drag the photo slot directly on the preview.
              </p>
              <button
                onClick={onToggleMapping}
                disabled={!templateConfig.hasTemplate}
                className={[
                  'flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed',
                  isMappingMode
                    ? 'bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-lg shadow-violet-500/25'
                    : 'bg-indigo-50 text-indigo-800 hover:bg-indigo-100',
                ].join(' ')}
              >
                <Crosshair size={14} />
                {isMappingMode ? 'Stop Photo Mapping' : 'Map Photo Slot'}
              </button>
            </div>

            {/* Text area mapping mode */}
            <div className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-white border border-slate-200">
              <p className="text-xs text-slate-500 leading-relaxed flex-1">
                Drag the text area to control where name / designation / company appear.
              </p>
              <button
                onClick={onToggleTextMapping}
                disabled={!templateConfig.hasTemplate}
                className={[
                  'flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed',
                  isTextMappingMode
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25'
                    : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100',
                ].join(' ')}
              >
                <Type size={14} />
                {isTextMappingMode ? 'Stop Text Mapping' : 'Map Text Area'}
              </button>
            </div>

            {/* Template upload — hidden on desktop when parent has moved it to right column */}
            <div className={hideTemplateUpload ? 'lg:hidden' : ''}>
              <SectionLabel>Template Image</SectionLabel>
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setIsDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                className={[
                  'border-2 border-dashed rounded-2xl p-5 flex flex-col items-center gap-3 text-center cursor-pointer transition-all duration-200',
                  isDragOver ? 'border-blue-500 bg-blue-50'
                    : templateConfig.hasTemplate ? 'border-green-400 bg-green-50 hover:bg-green-100/60'
                      : 'border-slate-300 bg-white hover:border-blue-400 hover:bg-blue-50/40',
                ].join(' ')}
              >
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
                  {templateConfig.hasTemplate
                    ? <FlipHorizontal size={22} className="text-green-600" />
                    : <CloudUpload size={22} className="text-blue-600" />}
                </div>
                <div>
                  <span className="block text-sm font-bold text-slate-800">
                    {templateConfig.hasTemplate ? templateConfig.templateName : 'Click to upload template'}
                  </span>
                  <span className="text-xs text-slate-500">PNG, JPG or WEBP</span>
                </div>
                <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
              </div>
            </div>

            {/* Photo slot coordinates */}
            <div>
              <SectionLabel>Photo Slot Coordinates</SectionLabel>
              <div className="grid grid-cols-2 gap-3">
                {([
                  { id: 'x', label: 'Photo X', min: 0 },
                  { id: 'y', label: 'Photo Y', min: 0 },
                  { id: 'width', label: 'Width', min: 1 },
                  { id: 'height', label: 'Height', min: 1 },
                  { id: 'radius', label: 'Corner Radius', min: 0 },
                ] as { id: keyof ImageSlot; label: string; min: number }[]).map(({ id, label, min }) => (
                  <div key={id} className={id === 'radius' ? 'col-span-2' : ''}>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
                    <input type="number" min={min} step={1} value={slot[id]}
                      onChange={(e) => onSlotChange({ ...slot, [id]: Number(e.target.value) || 0 })}
                      className={inputCls} />
                  </div>
                ))}
              </div>
            </div>

            {/* Text area coordinates */}
            <div>
              <SectionLabel>Text Area Coordinates</SectionLabel>
              <p className="text-xs text-slate-400 mb-2">Leave blank to auto-position text below the photo.</p>
              <div className="grid grid-cols-2 gap-3">
                {([
                  { id: 'x', label: 'Text X' },
                  { id: 'y', label: 'Text Y' },
                  { id: 'width', label: 'Width' },
                  { id: 'height', label: 'Height' },
                ] as { id: keyof TextSlot; label: string }[]).map(({ id, label }) => (
                  <div key={id}>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
                    <input type="number" min={0} step={1}
                      value={textSlot?.[id] ?? ''}
                      placeholder="auto"
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        const base = textSlot ?? { x: 0, y: 0, width: 400, height: 200 };
                        onTextSlotChange({ ...base, [id]: val });
                      }}
                      className={inputCls} />
                  </div>
                ))}
              </div>
              {textSlot && (
                <button
                  type="button"
                  onClick={() => onTextSlotChange(undefined)}
                  className="mt-2 text-xs text-slate-400 hover:text-red-500 underline cursor-pointer transition-colors"
                >
                  Reset to auto-position
                </button>
              )}
            </div>

            {/* Typography */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 flex flex-col gap-3">
              <SectionLabel>Typography</SectionLabel>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Font Family</label>
                <select value={fs.fontFamily}
                  onChange={(e) => onFontChange({ ...fs, fontFamily: e.target.value })}
                  className={inputCls}>
                  {FONT_FAMILIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>

              {/* Row 1: Name Colour + Name Size */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Name Colour</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={fs.nameColor}
                      onChange={(e) => onFontChange({ ...fs, nameColor: e.target.value })}
                      className="w-10 h-9 rounded-lg border border-slate-200 cursor-pointer p-0.5 bg-white" />
                    <span className="text-xs text-slate-500 font-mono">{fs.nameColor}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Name Size <span className="font-normal text-slate-400">{Math.round(fs.nameSizeScale * 100)}%</span>
                  </label>
                  <input type="range" min={0.5} max={2} step={0.05} value={fs.nameSizeScale}
                    onChange={(e) => onFontChange({ ...fs, nameSizeScale: Number(e.target.value) })}
                    className="w-full accent-blue-600 mt-2.5" />
                </div>
              </div>

              {/* Row 2: Sub-text Colour + Sub-text Size */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Sub-text Colour</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={fs.subColor}
                      onChange={(e) => onFontChange({ ...fs, subColor: e.target.value })}
                      className="w-10 h-9 rounded-lg border border-slate-200 cursor-pointer p-0.5 bg-white" />
                    <span className="text-xs text-slate-500 font-mono">{fs.subColor}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Sub-text Size <span className="font-normal text-slate-400">{Math.round(fs.subSizeScale * 100)}%</span>
                  </label>
                  <input type="range" min={0.5} max={2} step={0.05} value={fs.subSizeScale}
                    onChange={(e) => onFontChange({ ...fs, subSizeScale: Number(e.target.value) })}
                    className="w-full accent-blue-600 mt-2.5" />
                </div>
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input type="checkbox" checked={fs.strokeEnabled}
                  onChange={(e) => onFontChange({ ...fs, strokeEnabled: e.target.checked })}
                  className="w-4 h-4 rounded accent-blue-600 cursor-pointer" />
                <span className="text-xs font-semibold text-slate-700">
                  Dark outline (improves readability on light backgrounds)
                </span>
              </label>

              <div>
                <p className="text-xs font-semibold text-slate-600 mb-2">Name Case</p>
                <div className="flex gap-2">
                  {(['upper', 'sentence'] as const).map((val) => (
                    <button key={val} type="button"
                      onClick={() => onFontChange({ ...fs, nameCase: val })}
                      className={[
                        'flex-1 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer',
                        (fs.nameCase || 'upper') === val
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300',
                      ].join(' ')}>
                      {val === 'upper' ? 'ALL CAPS' : 'Sentence case'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Caption & hashtags */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 flex flex-col gap-3">
              <SectionLabel>Default Caption &amp; Hashtags</SectionLabel>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Default Caption</label>
                <textarea value={ss.defaultCaption}
                  onChange={(e) => onSharingChange({ ...ss, defaultCaption: e.target.value })}
                  placeholder="Pre-filled caption shown to users when they share…"
                  rows={3} className={inputCls + ' resize-none'} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Default Hashtags</label>
                <input type="text" value={ss.defaultHashtags}
                  onChange={(e) => onSharingChange({ ...ss, defaultHashtags: e.target.value })}
                  placeholder="#socialmedia #networking #socialbuzz"
                  className={inputCls} />
                <p className="text-xs text-slate-400 mt-1">Automatically appended to every post.</p>
              </div>
            </div>

            {/* Form Fields */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 flex flex-col gap-3">
              <SectionLabel>Form Fields</SectionLabel>
              <p className="text-xs text-slate-400 -mt-1">Choose which fields attendees fill in when creating their banner.</p>

              <div className="flex flex-col gap-2">
                {FIELD_DEFS.map(({ key, label, Icon }) => {
                  const cfg = flds[key];
                  return (
                    <div key={key} className={['flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all', cfg.visible ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-100 opacity-60'].join(' ')}>
                      {/* Field icon + label */}
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className={['w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0', cfg.visible ? 'bg-violet-50' : 'bg-slate-100'].join(' ')}>
                          <Icon size={13} className={cfg.visible ? 'text-violet-600' : 'text-slate-400'} />
                        </div>
                        <span className="text-sm font-semibold text-slate-700 truncate">{label}</span>
                        {key === 'name' && cfg.visible && (
                          <span className="text-[10px] font-bold text-violet-500 bg-violet-50 border border-violet-100 rounded px-1.5 py-0.5 flex-shrink-0">always required</span>
                        )}
                      </div>
                      {/* Visible toggle */}
                      <label className="flex items-center gap-1.5 cursor-pointer flex-shrink-0">
                        <span className="text-[11px] font-medium text-slate-500">Show</span>
                        <button
                          type="button"
                          onClick={() => {
                            const next = { ...flds, [key]: { ...cfg, visible: !cfg.visible, required: key === 'name' ? true : (cfg.visible ? false : cfg.required) } };
                            onFieldSettingsChange(next);
                          }}
                          className={['w-9 h-5 rounded-full transition-all duration-200 relative flex-shrink-0', cfg.visible ? 'bg-violet-600' : 'bg-slate-200'].join(' ')}
                        >
                          <span className={['absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-200', cfg.visible ? 'left-[18px]' : 'left-0.5'].join(' ')} />
                        </button>
                      </label>
                      {/* Required toggle — hidden for name (always required) */}
                      {key !== 'name' && (
                        <label className="flex items-center gap-1.5 cursor-pointer flex-shrink-0">
                          <span className="text-[11px] font-medium text-slate-500">Required</span>
                          <button
                            type="button"
                            disabled={!cfg.visible}
                            onClick={() => onFieldSettingsChange({ ...flds, [key]: { ...cfg, required: !cfg.required } })}
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
            </div>

            {/* Save */}
            <button
              onClick={onSaveMapping}
              disabled={!templateConfig.templateDataUrl || isSavingTemplate}
              className="flex items-center justify-center gap-2 w-full py-3 px-5 rounded-xl bg-gradient-to-r from-red-500 to-violet-600 text-white text-sm font-bold cursor-pointer hover:shadow-lg hover:shadow-violet-500/25 transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
            >
              {isSavingTemplate
                ? <><Loader size={15} className="animate-spin" /> Saving…</>
                : <><Save size={16} /> Save Template &amp; Settings</>}
            </button>

          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
