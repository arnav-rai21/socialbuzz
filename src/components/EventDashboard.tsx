import { type ReactNode, useEffect, useState } from 'react';
import {
  ArrowLeft,
  BarChart2,
  Building2,
  CalendarDays,
  Clock,
  Code2,
  ExternalLink,
  Image as ImageIcon,
  Loader,
  Link2,
  PenLine,
  Percent,
  Plus,
  Share2,
  ShieldOff,
  Trash2,
  TrendingUp,
  UserCheck,
  UserX,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  callGetEventsList,
  callCreateEvent,
  callDeleteEvent,
  callGetEventStats,
  callGetPendingRequests,
  callApproveAccessRequest,
  callDenyAccessRequest,
  callRevokeAdminAccess,
  type AccessRequest,
} from '../lib/server';
import type { EventMeta, EventStats } from '../types';

// ── Props ─────────────────────────────────────────────────────────────────────

interface EventDashboardProps {
  eventsList: EventMeta[];
  adminEmail: string;
  adminName?: string;
  onEditEvent: (slug: string) => void;
  onClose: () => void;
  onLogout: () => void;
}

// ── Promise wrappers (server functions use callback pattern) ──────────────────

function getEventsList(): Promise<EventMeta[]> {
  return new Promise((resolve, reject) => {
    callGetEventsList(
      result => resolve(result.events ?? []),
      err => reject(typeof err === 'string' ? new Error(err) : err),
    );
  });
}

function createEvent(slug: string, name: string): Promise<{ success: boolean; slug: string; name: string }> {
  return new Promise((resolve, reject) => {
    callCreateEvent(
      slug,
      name,
      result => resolve(result),
      err => reject(typeof err === 'string' ? new Error(err) : err),
    );
  });
}

function deleteEvent(slug: string): Promise<{ success: boolean }> {
  return new Promise((resolve, reject) => {
    callDeleteEvent(
      slug,
      result => resolve(result),
      err => reject(typeof err === 'string' ? new Error(err) : err),
    );
  });
}

function getEventStats(slug: string): Promise<EventStats> {
  return new Promise((resolve, reject) => {
    callGetEventStats(
      slug,
      stats => resolve(stats),
      err => reject(typeof err === 'string' ? new Error(err) : err),
    );
  });
}

function getPendingRequests(adminEmail: string): Promise<{ requests: AccessRequest[]; approvedAdmins: string[] }> {
  return new Promise((resolve, reject) => {
    callGetPendingRequests(
      adminEmail,
      result => resolve(result),
      err => reject(typeof err === 'string' ? new Error(err) : err),
    );
  });
}

function approveRequest(email: string, adminEmail: string): Promise<{ success: boolean }> {
  return new Promise((resolve, reject) => {
    callApproveAccessRequest(
      email,
      adminEmail,
      result => resolve(result),
      err => reject(typeof err === 'string' ? new Error(err) : err),
    );
  });
}

function denyRequest(email: string, adminEmail: string): Promise<{ success: boolean }> {
  return new Promise((resolve, reject) => {
    callDenyAccessRequest(
      email,
      adminEmail,
      result => resolve(result),
      err => reject(typeof err === 'string' ? new Error(err) : err),
    );
  });
}

function revokeAccess(email: string, adminEmail: string): Promise<{ success: boolean }> {
  return new Promise((resolve, reject) => {
    callRevokeAdminAccess(
      email,
      adminEmail,
      result => resolve(result),
      err => reject(typeof err === 'string' ? new Error(err) : err),
    );
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

const SLUG_RE = /^[a-z0-9-]+$/;

function formatTs(ts: string): string {
  try {
    return new Date(ts).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return ts;
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

const TINTS: Record<string, { chip: string; icon: string }> = {
  violet:  { chip: 'bg-violet-50 border-violet-100',   icon: 'text-violet-600'  },
  pink:    { chip: 'bg-pink-50 border-pink-100',       icon: 'text-pink-600'    },
  emerald: { chip: 'bg-emerald-50 border-emerald-100', icon: 'text-emerald-600' },
  amber:   { chip: 'bg-amber-50 border-amber-100',     icon: 'text-amber-600'   },
  sky:     { chip: 'bg-sky-50 border-sky-100',         icon: 'text-sky-600'     },
  indigo:  { chip: 'bg-indigo-50 border-indigo-100',   icon: 'text-indigo-600'  },
};

function KpiCard({
  icon, label, value, sub, tint = 'violet',
}: {
  icon: ReactNode;
  label: string;
  value: number | string;
  sub?:  string;
  tint?: keyof typeof TINTS | string;
}) {
  const t = TINTS[tint as string] ?? TINTS.violet;
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col gap-3 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className={['w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0', t.chip].join(' ')}>
          <span className={t.icon}>{icon}</span>
        </div>
      </div>
      <div>
        <p className="text-[26px] font-black text-slate-900 leading-none tabular-nums">{value}</p>
        <p className="text-xs text-slate-500 font-semibold mt-1.5">{label}</p>
        {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// Activity-over-time bar chart (last 14 days), filled client-side so empty days show too.
function TrendChart({ daily }: { daily: EventStats['daily'] }) {
  const map = new Map((daily ?? []).map(d => [d.day, d]));
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const series: Array<{ date: Date; generates: number; shares: number }> = [];
  for (let i = 13; i >= 0; i--) {
    const dt = new Date(today); dt.setDate(dt.getDate() - i);
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    const rec = map.get(key);
    series.push({ date: dt, generates: rec?.generates ?? 0, shares: rec?.shares ?? 0 });
  }
  const maxV = Math.max(1, ...series.map(s => Math.max(s.generates, s.shares)));

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Activity · last 14 days</h3>
        <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-500">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-violet-500" /> Generates</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-pink-400" /> Shares</span>
        </div>
      </div>
      <div className="flex items-end gap-1.5 h-[150px]">
        {series.map((s, i) => (
          <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1 group relative h-full">
            <div className="w-full flex items-end justify-center gap-[2px] h-full">
              <div className="w-1/2 max-w-[14px] rounded-t bg-violet-500/90 transition-all hover:bg-violet-600" style={{ height: `${(s.generates / maxV) * 100}%`, minHeight: s.generates ? 3 : 0 }} />
              <div className="w-1/2 max-w-[14px] rounded-t bg-pink-400/90 transition-all hover:bg-pink-500" style={{ height: `${(s.shares / maxV) * 100}%`, minHeight: s.shares ? 3 : 0 }} />
            </div>
            <span className="text-[9px] text-slate-400 font-medium whitespace-nowrap">{s.date.getDate()}</span>
            {/* Tooltip */}
            <div className="absolute -top-9 hidden group-hover:flex flex-col items-center px-2 py-1 rounded-lg bg-slate-900 text-white text-[10px] font-semibold whitespace-nowrap z-10 pointer-events-none">
              {s.date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}: {s.generates}g · {s.shares}s
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Stats View ────────────────────────────────────────────────────────────────

export function StatsView({
  stats,
  eventName,
  onBack,
  embedded = false,
}: {
  slug:       string;
  stats:      EventStats;
  eventName:  string;
  onBack?:    () => void;
  embedded?:  boolean;
}) {
  const platforms = stats.byPlatform ?? {};
  const platformEntries = Object.entries(platforms).sort((a, b) => b[1] - a[1]);
  const maxPlatformCount = platformEntries.length > 0 ? platformEntries[0][1] : 1;
  const recentActivity   = stats.recentUsers ?? [];
  const topCompanies     = stats.topCompanies ?? [];
  const maxCompanyCount  = topCompanies.length > 0 ? topCompanies[0].count : 1;

  const hasNoData =
    (stats.totalGenerates ?? 0) === 0 &&
    (stats.totalShares    ?? 0) === 0 &&
    recentActivity.length === 0;

  return (
    <div className="flex flex-col gap-5">

      {/* Back + heading — hidden when embedded inside the edit workspace */}
      {!embedded && (
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer active:scale-95 flex-shrink-0"
          >
            <ArrowLeft size={17} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-400 font-medium">Event stats</p>
            <h2 className="text-lg font-black text-slate-900 truncate">{eventName}</h2>
          </div>
          {stats.lastActivity && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 font-medium flex-shrink-0">
              <Clock size={13} /> Last activity {formatTs(stats.lastActivity)}
            </div>
          )}
        </div>
      )}

      {/* No data empty state */}
      {hasNoData ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center gap-3 py-16 text-center">
          <BarChart2 size={40} className="text-slate-300" />
          <p className="text-slate-500 font-semibold">No data yet for this event</p>
          <p className="text-slate-400 text-sm max-w-xs">
            Share the event link to start collecting generates and shares.
          </p>
        </div>
      ) : (
        <>
          {/* KPI grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <KpiCard tint="violet"  icon={<TrendingUp size={18} />}   label="Total Generates"  value={stats.totalGenerates ?? 0} />
            <KpiCard tint="pink"    icon={<Share2 size={18} />}       label="Total Shares"     value={stats.totalShares ?? 0} />
            <KpiCard tint="emerald" icon={<Percent size={18} />}      label="Share Rate"       value={`${stats.shareRate ?? 0}%`} sub="shares per generate" />
            <KpiCard tint="sky"     icon={<Users size={18} />}        label="Unique Attendees" value={stats.uniqueUsers ?? 0} sub="by email" />
            <KpiCard tint="indigo"  icon={<Building2 size={18} />}    label="Companies"        value={stats.uniqueCompanies ?? 0} />
            <KpiCard tint="amber"   icon={<CalendarDays size={18} />} label="Last 7 days"      value={stats.generates7d ?? 0} sub={`${stats.generatesToday ?? 0} today`} />
          </div>

          {/* Trend chart */}
          <TrendChart daily={stats.daily} />

          {/* Platform breakdown + Top companies */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2"><Share2 size={13} /> Platform Breakdown</h3>
              {platformEntries.length === 0 ? (
                <p className="text-sm text-slate-400 py-6 text-center">No shares recorded yet.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {platformEntries.map(([platform, count]) => (
                    <div key={platform} className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-slate-700 w-28 flex-shrink-0 capitalize truncate">{platform}</span>
                      <div className="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-violet-500 to-pink-500 rounded-full transition-all" style={{ width: `${Math.round((count / maxPlatformCount) * 100)}%` }} />
                      </div>
                      <span className="text-sm font-bold text-slate-900 w-8 text-right flex-shrink-0 tabular-nums">{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2"><Building2 size={13} /> Top Companies</h3>
              {topCompanies.length === 0 ? (
                <p className="text-sm text-slate-400 py-6 text-center">No company data yet.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {topCompanies.map(({ company, count }) => (
                    <div key={company} className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-slate-700 w-36 flex-shrink-0 truncate" title={company}>{company}</span>
                      <div className="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${Math.round((count / maxCompanyCount) * 100)}%` }} />
                      </div>
                      <span className="text-sm font-bold text-slate-900 w-8 text-right flex-shrink-0 tabular-nums">{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent activity */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Recent Activity</h3>
              <span className="text-[11px] font-semibold text-slate-400">Latest {recentActivity.length}</span>
            </div>

            {recentActivity.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-slate-400">
                <BarChart2 size={32} className="opacity-30" />
                <p className="text-sm font-medium">No activity recorded yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[640px]">
                  <thead>
                    <tr className="bg-slate-50 text-left">
                      <th className="px-4 py-3 text-xs font-bold text-slate-500 w-14">Image</th>
                      <th className="px-4 py-3 text-xs font-bold text-slate-500">Attendee</th>
                      <th className="px-4 py-3 text-xs font-bold text-slate-500">Company</th>
                      <th className="px-4 py-3 text-xs font-bold text-slate-500">Type</th>
                      <th className="px-4 py-3 text-xs font-bold text-slate-500">Platform</th>
                      <th className="px-4 py-3 text-xs font-bold text-slate-500 text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recentActivity.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          {row.imageUrl ? (
                            <a href={row.imageUrl} target="_blank" rel="noopener noreferrer" className="block w-10 h-10 rounded-lg overflow-hidden border border-slate-200 bg-slate-50 hover:ring-2 hover:ring-violet-300 transition-all" title="Open generated image">
                              <img src={row.imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                            </a>
                          ) : (
                            <div className="w-10 h-10 rounded-lg border border-slate-100 bg-slate-50 flex items-center justify-center text-slate-300">
                              <ImageIcon size={15} />
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 min-w-0">
                          <p className="text-slate-900 font-semibold truncate max-w-[200px]">{row.name || '—'}</p>
                          {(row.title || row.email) && (
                            <p className="text-[11px] text-slate-400 truncate max-w-[200px]">{row.title || row.email}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600 truncate max-w-[180px]">{row.company || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={[
                            'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold',
                            row.eventType === 'Generated' ? 'bg-violet-50 text-violet-700' : 'bg-emerald-50 text-emerald-700',
                          ].join(' ')}>
                            {row.eventType === 'Generated' ? 'Generated' : 'Shared'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 capitalize">{row.platform || '—'}</td>
                        <td className="px-4 py-3 text-slate-400 text-xs text-right whitespace-nowrap">{formatTs(row.timestamp)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function EventDashboard({
  eventsList,
  adminEmail,
  adminName,
  onEditEvent,
  onClose,
  onLogout,
}: EventDashboardProps) {

  // ── State ──────────────────────────────────────────────────────────────────

  const [events,          setEvents]          = useState<EventMeta[]>(eventsList);
  const [showCreateForm,  setShowCreateForm]  = useState(false);
  const [newEventName,    setNewEventName]    = useState('');
  const [newEventSlug,    setNewEventSlug]    = useState('');
  const [slugManualEdit,  setSlugManualEdit]  = useState(false);
  const [isCreating,      setIsCreating]      = useState(false);
  const [isDeleting,      setIsDeleting]      = useState<string | null>(null);

  // Access management
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [approvedAdmins, setApprovedAdmins] = useState<string[]>([]);
  const [isLoadingAccess, setIsLoadingAccess] = useState(false);
  const [accessActionBusy, setAccessActionBusy] = useState<string | null>(null);
  const [confirmDeleteSlug, setConfirmDeleteSlug] = useState<string | null>(null);
  const [embedSlug,         setEmbedSlug]         = useState<string | null>(null);
  const [embedPosition,     setEmbedPosition]     = useState<'right' | 'left'>('right');

  // ── Mount: refresh list + access requests ─────────────────────────────────

  useEffect(() => {
    getEventsList()
      .then(list => setEvents(list))
      .catch(() => { /* silently keep props-seeded list */ });

    if (adminEmail) {
      setIsLoadingAccess(true);
      getPendingRequests(adminEmail)
        .then(r => { setAccessRequests(r.requests); setApprovedAdmins(r.approvedAdmins); })
        .catch(() => { })
        .finally(() => setIsLoadingAccess(false));
    }
  }, [adminEmail]);

  // ── Derived ───────────────────────────────────────────────────────────────

  // The 'default' event is the root-URL fallback — managed implicitly, hidden from the list.
  const visibleEvents = events.filter(e => e.slug !== 'default');

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleNameChange(value: string) {
    setNewEventName(value);
    if (!slugManualEdit) {
      setNewEventSlug(slugify(value));
    }
  }

  function handleSlugChange(value: string) {
    setSlugManualEdit(true);
    setNewEventSlug(value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
  }

  function resetCreateForm() {
    setShowCreateForm(false);
    setNewEventName('');
    setNewEventSlug('');
    setSlugManualEdit(false);
  }

  async function handleCreateEvent() {
    const name = newEventName.trim();
    const slug = newEventSlug.trim();

    if (!name) {
      toast.error('Event name is required.');
      return;
    }
    if (!slug || !SLUG_RE.test(slug)) {
      toast.error('Slug must contain only lowercase letters, numbers, and hyphens.');
      return;
    }

    setIsCreating(true);
    try {
      await createEvent(slug, name);
      const list = await getEventsList();
      setEvents(list);
      resetCreateForm();
      toast.success(`Event "${name}" created!`);
    } catch (err) {
      toast.error(`Failed to create event: ${(err as Error)?.message ?? String(err)}`);
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDeleteEvent(slug: string, name: string) {
    setConfirmDeleteSlug(null);
    setIsDeleting(slug);
    try {
      await deleteEvent(slug);
      setEvents(prev => prev.filter(e => e.slug !== slug));
      toast.success(`Event "${name}" deleted.`);
    } catch (err) {
      toast.error(`Failed to delete: ${(err as Error)?.message ?? String(err)}`);
    } finally {
      setIsDeleting(null);
    }
  }

  function handleCopyLink(slug: string) {
    const url =
      window.location.origin +
      window.location.pathname +
      '?event=' + encodeURIComponent(slug);
    navigator.clipboard
      .writeText(url)
      .then(() => toast.success('Link copied!'))
      .catch(() => toast.error('Could not copy link — please copy it manually.'));
  }

  async function handleApproveRequest(email: string) {
    setAccessActionBusy(email);
    try {
      await approveRequest(email, adminEmail);
      const r = await getPendingRequests(adminEmail);
      setAccessRequests(r.requests);
      setApprovedAdmins(r.approvedAdmins);
      toast.success(`Access approved for ${email}`);
    } catch (err) {
      toast.error(`Failed: ${(err as Error)?.message ?? String(err)}`);
    } finally {
      setAccessActionBusy(null);
    }
  }

  async function handleDenyRequest(email: string) {
    setAccessActionBusy(email);
    try {
      await denyRequest(email, adminEmail);
      setAccessRequests(prev => prev.filter(r => r.email !== email));
      toast.success(`Request denied for ${email}`);
    } catch (err) {
      toast.error(`Failed: ${(err as Error)?.message ?? String(err)}`);
    } finally {
      setAccessActionBusy(null);
    }
  }

  async function handleRevokeAccess(email: string) {
    const confirmed = window.confirm(`Revoke admin access for ${email}?`);
    if (!confirmed) return;
    setAccessActionBusy(email);
    try {
      await revokeAccess(email, adminEmail);
      const r = await getPendingRequests(adminEmail);
      setAccessRequests(r.requests);
      setApprovedAdmins(r.approvedAdmins);
      toast.success(`Access revoked for ${email}`);
    } catch (err) {
      toast.error(`Failed: ${(err as Error)?.message ?? String(err)}`);
    } finally {
      setAccessActionBusy(null);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const initials = (adminName || adminEmail || 'A')
    .split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const displayName = adminName || adminEmail.split('@')[0];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">

      {/* ── Header ── */}
      <header className="sticky top-0 z-20 flex-shrink-0 border-b border-white/10"
        style={{ background: 'linear-gradient(135deg, #1e0a4a 0%, #3b0d8a 35%, #6d28d9 70%, #9d174d 100%)' }}>
        <div className="flex min-h-[60px] items-center justify-between px-4 sm:px-6 gap-3">

          {/* Left: logo + title */}
          <div className="flex items-center gap-3 min-w-0">
            {/* Logo icon */}
            <div className="w-8 h-8 rounded-lg bg-white/15 border border-white/20 flex items-center justify-center flex-shrink-0">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z" />
              </svg>
            </div>
            <div className="min-w-0">
              <h1 className="text-[13px] font-black text-white tracking-tight truncate leading-tight">
                Social Buzz
              </h1>
              <p className="text-[10px] text-white/50 leading-tight truncate">
                {`${visibleEvents.length} event${visibleEvents.length !== 1 ? 's' : ''}`}
              </p>
            </div>
          </div>

          {/* Right: new event + user + logout */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => { resetCreateForm(); setShowCreateForm(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 border border-white/20 text-white text-[11px] font-bold hover:bg-white/25 cursor-pointer transition-colors active:scale-95"
            >
              <Plus size={13} /> New Event
            </button>

            {/* User pill */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/15">
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black text-white flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #a78bfa, #f472b6)' }}>
                {initials}
              </div>
              <span className="text-[11px] font-semibold text-white/90 max-w-[120px] truncate">{displayName}</span>
            </div>

            {/* Logout */}
            <button
              onClick={onLogout}
              title="Sign out"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-white/80 text-[11px] font-semibold hover:bg-red-500/25 hover:border-red-400/40 hover:text-white cursor-pointer transition-all active:scale-95"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Body ── */}
      <main className="flex-1 px-4 sm:px-6 py-6 w-full mx-auto max-w-5xl flex flex-col gap-5">

          <>
            {/* Create form */}
            {showCreateForm && (
              <div className="bg-white rounded-2xl border border-violet-200 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-black text-slate-800">Create New Event</h2>
                  <button
                    onClick={resetCreateForm}
                    className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 cursor-pointer transition-colors active:scale-95"
                  >
                    <X size={14} />
                  </button>
                </div>

                <div className="flex flex-col gap-3">
                  {/* Name */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-600">Event Name</label>
                    <input
                      type="text"
                      value={newEventName}
                      onChange={e => handleNameChange(e.target.value)}
                      placeholder="e.g. SocialBuzz Summit 2025"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-violet-400 transition"
                      disabled={isCreating}
                    />
                  </div>

                  {/* Slug */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-600">
                      Slug <span className="font-normal text-slate-400">(URL-friendly, auto-derived)</span>
                    </label>
                    <input
                      type="text"
                      value={newEventSlug}
                      onChange={e => handleSlugChange(e.target.value)}
                      placeholder="e.g. socialbuzz-summit-2025"
                      className={[
                        'w-full px-4 py-2.5 rounded-xl border text-sm font-mono placeholder-slate-300 focus:outline-none focus:ring-2 transition',
                        newEventSlug && !SLUG_RE.test(newEventSlug)
                          ? 'border-red-300 focus:ring-red-400 focus:border-red-400 text-red-700'
                          : 'border-slate-200 focus:ring-violet-400 focus:border-violet-400 text-slate-900',
                      ].join(' ')}
                      disabled={isCreating}
                    />
                    {newEventSlug && !SLUG_RE.test(newEventSlug) && (
                      <p className="text-xs text-red-500">Only lowercase letters, numbers, and hyphens allowed.</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={handleCreateEvent}
                      disabled={isCreating || !newEventName.trim() || !newEventSlug.trim() || !SLUG_RE.test(newEventSlug)}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 cursor-pointer transition-colors active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isCreating ? (
                        <Loader size={14} className="animate-spin" />
                      ) : (
                        <Plus size={14} />
                      )}
                      {isCreating ? 'Creating…' : 'Create Event'}
                    </button>
                    <button
                      onClick={resetCreateForm}
                      disabled={isCreating}
                      className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 cursor-pointer transition-colors active:scale-95 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Empty state */}
            {visibleEvents.length === 0 && !showCreateForm && (
              <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
                  <BarChart2 size={28} className="text-slate-300" />
                </div>
                <div>
                  <p className="text-slate-700 font-bold text-base">No events yet</p>
                  <p className="text-slate-400 text-sm mt-1">Create your first event to get started.</p>
                </div>
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 cursor-pointer transition-colors active:scale-95"
                >
                  <Plus size={15} /> Create First Event
                </button>
              </div>
            )}

            {/* ── Access Requests panel ── */}
            {(accessRequests.filter(r => r.status === 'pending').length > 0 || approvedAdmins.length > 0) && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h2 className="text-xs font-black uppercase tracking-widest text-slate-500">Admin Access</h2>
                  {isLoadingAccess && <Loader size={13} className="animate-spin text-slate-400" />}
                </div>

                {/* Pending requests */}
                {accessRequests.filter(r => r.status === 'pending').map(req => (
                  <div key={req.email} className="flex items-center gap-3 px-5 py-3 border-b border-slate-50 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{req.name || req.email}</p>
                      <p className="text-xs text-slate-400 truncate">{req.email}</p>
                      <p className="text-[10px] text-slate-300 mt-0.5">{formatTs(req.requestedAt)}</p>
                    </div>
                    <span className="text-[10px] bg-amber-50 text-amber-600 font-bold px-2 py-0.5 rounded-full flex-shrink-0">Pending</span>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => handleApproveRequest(req.email)}
                        disabled={accessActionBusy === req.email}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 text-xs font-semibold hover:bg-emerald-100 cursor-pointer transition-colors active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {accessActionBusy === req.email ? <Loader size={11} className="animate-spin" /> : <UserCheck size={11} />}
                        Approve
                      </button>
                      <button
                        onClick={() => handleDenyRequest(req.email)}
                        disabled={accessActionBusy === req.email}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-50 text-red-500 text-xs font-semibold hover:bg-red-100 cursor-pointer transition-colors active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <UserX size={11} /> Deny
                      </button>
                    </div>
                  </div>
                ))}

                {/* Approved admins (excluding super-admin) */}
                {approvedAdmins.filter(e => e !== adminEmail).map(email => (
                  <div key={email} className="flex items-center gap-3 px-5 py-3 border-b border-slate-50 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{email}</p>
                    </div>
                    <span className="text-[10px] bg-emerald-50 text-emerald-600 font-bold px-2 py-0.5 rounded-full flex-shrink-0">Admin</span>
                    <button
                      onClick={() => handleRevokeAccess(email)}
                      disabled={accessActionBusy === email}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-500 text-xs font-semibold hover:bg-red-50 hover:text-red-500 cursor-pointer transition-colors active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                    >
                      {accessActionBusy === email ? <Loader size={11} className="animate-spin" /> : <ShieldOff size={11} />}
                      Revoke
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Event boxes */}
            {visibleEvents.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {visibleEvents.map(event => {
                  const initials = (event.name || event.slug).split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
                  return (
                    <div
                      key={event.slug}
                      className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col gap-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-white text-sm font-black"
                          style={{ background: 'linear-gradient(135deg,#7c3aed,#db2777)' }}>
                          {initials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-slate-900 text-base truncate" title={event.name}>{event.name}</p>
                          <code className="text-xs text-slate-400 font-mono">{event.slug}</code>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-auto">
                        <button
                          onClick={() => onEditEvent(event.slug)}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-bold cursor-pointer hover:bg-violet-700 transition-colors active:scale-95"
                        >
                          <PenLine size={14} /> Edit event
                        </button>
                        <button
                          onClick={() => setEmbedSlug(event.slug)}
                          className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold cursor-pointer hover:bg-slate-50 transition-colors active:scale-95"
                          title="Get embed code"
                        >
                          <Code2 size={14} /> Embed
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          </>

      </main>

      {/* ── Embed widget modal ── */}
      {embedSlug && (() => {
        const widgetSrc  = window.location.origin + '/widget.js';
        const embedCode  =
          `<script\n  src="${widgetSrc}"\n  data-event="${embedSlug}"\n  data-position="${embedPosition}"\n  async>\n<\/script>`;
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.55)' }}
            onClick={() => setEmbedSlug(null)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col gap-5 p-6"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Code2 size={16} className="text-violet-600" />
                  <div>
                    <h3 className="font-bold text-slate-900 text-base leading-tight">Website Widget</h3>
                    <p className="text-[11px] text-slate-400 leading-tight">Floating button + popup panel</p>
                  </div>
                </div>
                <button
                  onClick={() => setEmbedSlug(null)}
                  className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 cursor-pointer transition-colors"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Position toggle */}
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold text-slate-600">Button position</p>
                <div className="flex gap-2">
                  {(['right', 'left'] as const).map(pos => (
                    <button
                      key={pos}
                      onClick={() => setEmbedPosition(pos)}
                      className={`flex-1 py-2 rounded-xl text-xs font-semibold border cursor-pointer transition-colors ${
                        embedPosition === pos
                          ? 'bg-violet-600 text-white border-violet-600'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      Bottom {pos.charAt(0).toUpperCase() + pos.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Code block */}
              <div className="bg-slate-900 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 pt-3 pb-1">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">HTML snippet</span>
                </div>
                <pre className="text-xs text-emerald-400 font-mono px-4 pb-4 overflow-x-auto leading-relaxed whitespace-pre">{embedCode}</pre>
              </div>

              {/* How it works */}
              <div className="bg-slate-50 rounded-xl p-3 flex flex-col gap-1.5">
                <p className="text-[11px] font-semibold text-slate-600">How it works</p>
                <ul className="text-[11px] text-slate-500 flex flex-col gap-1 list-disc list-inside">
                  <li>Paste the snippet before <code className="bg-white px-1 rounded border border-slate-200">&lt;/body&gt;</code> on your page</li>
                  <li>A floating button appears in the {embedPosition} corner</li>
                  <li>Clicking it opens a popup with the full event panel</li>
                  <li>Works on both desktop and mobile</li>
                </ul>
              </div>

              {/* Copy */}
              <button
                onClick={() => {
                  navigator.clipboard.writeText(embedCode).then(() => {
                    toast.success('Widget code copied!');
                    setEmbedSlug(null);
                  }).catch(() => toast.error('Copy failed'));
                }}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 cursor-pointer transition-colors active:scale-95"
              >
                Copy Widget Code
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
