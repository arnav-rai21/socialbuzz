export interface ImageSlot {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
}

export interface TextSlot {
  x:      number;
  y:      number;
  width:  number;
  height: number;
}

export interface FontSettings {
  nameColor:     string;
  subColor:      string;
  fontFamily:    string;
  nameSizeScale: number;
  subSizeScale:  number;
  strokeEnabled: boolean;
  nameCase:      'upper' | 'sentence';  // 'upper' = ALL CAPS (default), 'sentence' = as typed
}

export const DEFAULT_FONT_SETTINGS: FontSettings = {
  nameColor:     '#ffffff',
  subColor:      '#ffffff',
  fontFamily:    'Inter, Arial, sans-serif',
  nameSizeScale: 1.0,
  subSizeScale:  1.0,
  strokeEnabled: true,
  nameCase:      'upper',
};

export interface SharingSettings {
  defaultCaption:  string;
  defaultHashtags: string;
}

export const DEFAULT_SHARING_SETTINGS: SharingSettings = {
  defaultCaption:  '',
  defaultHashtags: '',
};

export interface FieldConfig {
  visible:  boolean;
  required: boolean;
}

export interface FieldSettings {
  name:    FieldConfig;
  title:   FieldConfig;
  company: FieldConfig;
  email:   FieldConfig;
}

export const DEFAULT_FIELD_SETTINGS: FieldSettings = {
  name:    { visible: true, required: true  },
  title:   { visible: true, required: false },
  company: { visible: true, required: false },
  email:   { visible: true, required: false },
};

export interface TemplateConfig {
  id?:              number;      // DB id of the template row (undefined = unsaved/new)
  hasTemplate:      boolean;
  templateName:     string;
  templateDataUrl:  string;
  imageSlot:        ImageSlot;
  imageSlotSet?:    boolean;   // client-only: false on a fresh draft until a box is drawn
  textSlot?:        TextSlot;
  isDefault?:       boolean;
  position?:        number;
  updatedAt?:       string;
  error?:           string;
  fontSettings?:    FontSettings;
  // Event-level settings — present on the bootstrap default template for back-compat.
  sharingSettings?: SharingSettings;
  fieldSettings?:   FieldSettings;
}

export interface GeneratedAsset {
  fileId:    string;
  fileName:  string;
  driveUrl:  string;
  publicUrl: string;
  imageUrl?: string;
}

export interface UserProfile {
  name:       string;
  title:      string;
  company:    string;
  email?:     string;
  eventSlug?: string; // passed to GAS for per-event logging
}

export interface EventMeta {
  slug:      string;
  name:      string;
  createdAt: string;
  updatedAt: string;
}

export interface EventStats {
  totalGenerates:  number;
  totalShares:     number;
  byPlatform:      Record<string, number>;
  uniqueUsers?:    number;
  uniqueCompanies?: number;
  shareRate?:      number;   // shares / generates, as a percentage
  generatesToday?: number;
  generates7d?:    number;
  lastActivity?:   string;
  totalViews?:     number;   // 'Opened' events (widget + direct)
  widgetOpens?:    number;
  pageViews?:      number;
  conversionRate?: number;   // generates / views, as a percentage
  uniqueVisitors?: number;   // distinct visitor_id
  journeys?:       Array<{
    visitorId: string;
    name:      string;
    company:   string;
    email:     string;
    visits:    number;
    generates: number;
    shares:    number;
    platforms: string;
    firstSeen: string;
    lastSeen:  string;
  }>;
  topCompanies?:   Array<{ company: string; count: number }>;
  daily?:          Array<{ day: string; generates: number; shares: number }>;
  recentUsers:     Array<{
    timestamp: string;
    eventType: string;
    name:      string;
    title?:    string;
    company:   string;
    email:     string;
    platform:  string;
    imageUrl?: string;
  }>;
}
