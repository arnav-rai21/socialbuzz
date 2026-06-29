import { Building2, Briefcase, Mail, User } from 'lucide-react';
import type { FieldSettings, UserProfile } from '../types';
import { DEFAULT_FIELD_SETTINGS } from '../types';

interface UserFormProps {
  profile:        UserProfile;
  onChange:       (profile: UserProfile) => void;
  fieldSettings?: FieldSettings;
}

const ALL_FIELDS = [
  { key: 'name'    as const, label: 'Full name',          placeholder: 'e.g. Sachitanand Rai',   Icon: User,      type: 'text',  autoComplete: 'off',   autoCapitalize: 'words' },
  { key: 'title'   as const, label: 'Role / Designation', placeholder: 'e.g. Marketing Manager', Icon: Briefcase, type: 'text',  autoComplete: 'off',   autoCapitalize: 'words' },
  { key: 'company' as const, label: 'Company',            placeholder: 'e.g. Times Internet',    Icon: Building2, type: 'text',  autoComplete: 'off',   autoCapitalize: 'words' },
  { key: 'email'   as const, label: 'Email address',      placeholder: 'e.g. you@company.com',   Icon: Mail,      type: 'email', autoComplete: 'email', autoCapitalize: 'none'  },
];

export default function UserForm({ profile, onChange, fieldSettings }: UserFormProps) {
  const fs = fieldSettings || DEFAULT_FIELD_SETTINGS;

  const visibleFields = ALL_FIELDS.filter(f => fs[f.key]?.visible !== false);

  return (
    <div className="flex flex-col gap-4">
      {visibleFields.map(({ key, label, placeholder, Icon, type, autoComplete, autoCapitalize }) => {
        const cfg      = fs[key];
        const required = cfg?.required ?? (key === 'name');
        return (
          <div key={key}>
            <label className="block text-sm font-bold text-slate-800 mb-2">
              {label}
              {!required && (
                <span className="ml-1.5 text-[11px] font-medium text-slate-400 normal-case">(optional)</span>
              )}
            </label>
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <Icon size={15} />
              </div>
              <input
                type={type}
                value={profile[key] ?? ''}
                onChange={(e) => onChange({ ...profile, [key]: e.target.value })}
                placeholder={placeholder}
                autoComplete={autoComplete}
                autoCorrect="off"
                autoCapitalize={autoCapitalize}
                spellCheck={false}
                className="w-full pl-10 pr-4 py-3 rounded-xl border-[1.5px] border-slate-200 bg-white text-slate-900 text-sm font-medium outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-500/10 transition-all duration-150 placeholder:text-slate-400"
              />
            </div>
          </div>
        );
      })}
      <p className="text-[11px] leading-relaxed text-slate-400">
        Your details are used only to personalize your post. If you sign in with Google, we use your name and email to autofill this form.
      </p>
    </div>
  );
}
