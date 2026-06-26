import { Check } from 'lucide-react';
import type { TemplateConfig } from '../types';

interface TemplateGalleryProps {
  templates: TemplateConfig[];
  activeKey: string;
  keyOf:     (t: TemplateConfig) => string;
  onSelect:  (key: string) => void;
}

// Attendee-facing picker: choose which template to personalize. Shown only when
// the event has more than one template.
export default function TemplateGallery({ templates, activeKey, keyOf, onSelect }: TemplateGalleryProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-full bg-violet-50 border border-violet-100 flex items-center justify-center flex-shrink-0">
          <span className="text-violet-600 text-sm font-black">{templates.length}</span>
        </div>
        <div>
          <p className="font-bold text-slate-900 text-sm">Choose a template</p>
          <p className="text-xs text-slate-400">Pick the design you want to personalize.</p>
        </div>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
        {templates.map((t) => {
          const k = keyOf(t);
          const isActive = k === activeKey;
          return (
            <button
              key={k}
              type="button"
              onClick={() => onSelect(k)}
              className={[
                'relative aspect-square rounded-xl overflow-hidden border-2 transition-all cursor-pointer bg-slate-100',
                isActive ? 'border-violet-600 ring-2 ring-violet-200' : 'border-slate-200 hover:border-violet-300',
              ].join(' ')}
              title={t.templateName}
            >
              {t.templateDataUrl && (
                <img src={t.templateDataUrl} alt={t.templateName} className="w-full h-full object-cover" />
              )}
              {isActive && (
                <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-violet-600 flex items-center justify-center shadow">
                  <Check size={12} className="text-white" strokeWidth={3} />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
