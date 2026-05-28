'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAdmin } from '../admin-context';

interface Session {
  id: string;
  studentId: string;
  title: string;
  description?: string;
  date: string;
  duration: number;
  status: string;
  studentName: string;
  studentType: string;
}

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  type: string;
}

const SESSIONS_PER_PAGE = 10;

const avatarPalette = [
  { bg: '#ddf1f3', text: '#4338ca' },
  { bg: '#ecfdf5', text: '#047857' },
  { bg: '#fdf4ff', text: '#a21caf' },
  { bg: '#eff6ff', text: '#1d4ed8' },
  { bg: '#fefce8', text: '#a16207' },
  { bg: '#fef2f2', text: '#b91c1c' },
  { bg: '#f0fdfa', text: '#0f766e' },
];

// Calendar card color palettes — soft muted pastels matching Apple Calendar style
const calCardPalettes = [
  { bg: '#dce6f8', text: '#2c4578' },       // periwinkle blue
  { bg: '#f8ecd0', text: '#7a5c1e' },       // warm sand
  { bg: '#e4daf5', text: '#4a3275' },        // soft lavender
  { bg: '#d4ecf7', text: '#1a5276' },        // sky blue
  { bg: '#f5d9d9', text: '#7a2c2c' },        // blush rose
  { bg: '#d4f0e9', text: '#1a6b52' },        // mint
  { bg: '#fce3c8', text: '#7a4a12' },        // peach
  { bg: '#e8d8f0', text: '#5a2d7a' },        // orchid
  { bg: '#d8e4f0', text: '#2a4460' },        // slate blue
  { bg: '#f0ddd0', text: '#6b3a1f' },        // terracotta
];

function getCalCardStyle(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return calCardPalettes[Math.abs(hash) % calCardPalettes.length];
}

function getAvatarStyle(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return avatarPalette[Math.abs(hash) % avatarPalette.length];
}

function getInitials(name: string) {
  const parts = name.split(' ');
  return (parts[0]?.charAt(0) + (parts[1]?.charAt(0) || '')).toUpperCase();
}

// Assign side-by-side columns for overlapping sessions (Google Calendar style)
function computeOverlapColumns(
  daySessions: Session[]
): Map<string, { col: number; totalCols: number }> {
  const result = new Map<string, { col: number; totalCols: number }>();
  if (daySessions.length === 0) return result;

  const items = daySessions.map(s => {
    const sd = new Date(s.date);
    const startMins = sd.getHours() * 60 + sd.getMinutes();
    return { id: s.id, startMins, endMins: startMins + s.duration };
  });
  items.sort((a, b) => a.startMins - b.startMins || b.endMins - a.endMins);

  // 1. Build overlap groups (connected components)
  const groups: typeof items[] = [];
  const visited = new Set<string>();
  for (let i = 0; i < items.length; i++) {
    if (visited.has(items[i].id)) continue;
    const group = [items[i]];
    visited.add(items[i].id);
    let groupEnd = items[i].endMins;
    for (let j = i + 1; j < items.length; j++) {
      if (visited.has(items[j].id)) continue;
      if (items[j].startMins < groupEnd) {
        group.push(items[j]);
        visited.add(items[j].id);
        groupEnd = Math.max(groupEnd, items[j].endMins);
      }
    }
    groups.push(group);
  }

  // 2. Within each group, assign columns greedily
  for (const group of groups) {
    // columns[c] = endMins of the last session placed in column c
    const columns: number[] = [];
    const colMap = new Map<string, number>();

    for (const item of group) {
      // Find first column where this session fits (no overlap)
      let placed = false;
      for (let c = 0; c < columns.length; c++) {
        if (item.startMins >= columns[c]) {
          columns[c] = item.endMins;
          colMap.set(item.id, c);
          placed = true;
          break;
        }
      }
      if (!placed) {
        colMap.set(item.id, columns.length);
        columns.push(item.endMins);
      }
    }

    const totalCols = columns.length;
    for (const item of group) {
      result.set(item.id, { col: colMap.get(item.id)!, totalCols });
    }
  }

  return result;
}

function getWeekRange(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { monday, sunday };
}

function formatWeekRange(monday: Date, sunday: Date) {
  const mDay = String(monday.getDate()).padStart(2, '0');
  const sDay = String(sunday.getDate()).padStart(2, '0');
  const mMonth = monday.toLocaleString('en-US', { month: 'long' });
  const sMonth = sunday.toLocaleString('en-US', { month: 'long' });
  const year = monday.getFullYear();
  if (mMonth === sMonth) {
    return `${mDay}-${sDay} ${mMonth} ${year}`;
  }
  return `${mDay} ${mMonth} - ${sDay} ${sMonth} ${year}`;
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const CAL_START_HOUR = 0;
const CAL_END_HOUR = 24;
const HOUR_HEIGHT = 64;

export default function SessionsPage() {
  const { token, logout } = useAdmin();
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<'all' | 'today' | 'upcoming' | 'completed' | 'canceled'>('today');
  const [tick, setTick] = useState(() => Date.now());
  const [openMenu, setOpenMenu] = useState<{ id: string; top: number; left: number } | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [calWeekOffset, setCalWeekOffset] = useState(0);
  const [calExpanded, setCalExpanded] = useState(false);
  const [calOpenMenu, setCalOpenMenu] = useState<{ id: string; top: number; left: number } | null>(null);
  const calBodyRef = useRef<HTMLDivElement>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [calNewPopover, setCalNewPopover] = useState<{
    day: Date; minutes: number; x: number; y: number;
  } | null>(null);
  const [calNewTitle, setCalNewTitle] = useState('');
  const [calNewStudentId, setCalNewStudentId] = useState('');
  const [calNewDuration, setCalNewDuration] = useState(60);
  const [calNewSaving, setCalNewSaving] = useState(false);
  const [calNewError, setCalNewError] = useState('');
  const [calHover, setCalHover] = useState<{ di: number; minutes: number } | null>(null);
  const [calPreview, setCalPreview] = useState<{ id: string; top: number; left: number } | null>(null);
  const calPreviewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      try { return new Set(JSON.parse(localStorage.getItem('cal-pinned') || '[]')); } catch { /* ignore */ }
    }
    return new Set();
  });
  const togglePin = useCallback((id: string) => {
    setPinnedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      localStorage.setItem('cal-pinned', JSON.stringify([...next]));
      return next;
    });
  }, []);

  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const [sRes, stRes] = await Promise.all([
          fetch('/api/sessions', { headers: { Authorization: 'Bearer ' + token } }),
          fetch('/api/students', { headers: { Authorization: 'Bearer ' + token } }),
        ]);
        if (sRes.status === 401) { logout(); return; }
        if (sRes.ok) setSessions(await sRes.json());
        if (stRes.ok) setStudents(await stRes.json());
      } catch { /* silent */ }
      setLoading(false);
    })();
  }, [token, logout]);

  useEffect(() => {
    if (!openMenu) return;
    const handler = () => setOpenMenu(null);
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openMenu]);

  // Close calendar menu on outside click
  useEffect(() => {
    if (!calOpenMenu) return;
    const handler = () => setCalOpenMenu(null);
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [calOpenMenu]);

  // Close new-session popover on Escape
  useEffect(() => {
    if (!calNewPopover) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setCalNewPopover(null); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [calNewPopover]);

  // Close cancel modal on Escape
  useEffect(() => {
    if (!confirmCancel) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setConfirmCancel(null); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [confirmCancel]);

  // Toggle full-screen class on body; remove on unmount or when leaving calendar mode
  useEffect(() => {
    if (calExpanded && viewMode === 'calendar') {
      document.body.classList.add('cal-fs');
    } else {
      document.body.classList.remove('cal-fs');
    }
    return () => { document.body.classList.remove('cal-fs'); };
  }, [calExpanded, viewMode]);

  // Calendar week computation
  const calWeek = useMemo(() => {
    const base = new Date();
    base.setDate(base.getDate() + calWeekOffset * 7);
    const { monday, sunday } = getWeekRange(base);
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push(d);
    }
    return { monday, sunday, days };
  }, [calWeekOffset]);

  // Scroll calendar to the first bookable time when the view or week changes
  useEffect(() => {
    if (viewMode !== 'calendar' || !calBodyRef.current) return;

    const now = new Date();
    const weekHasToday = calWeek.days.some(d => d.toDateString() === now.toDateString());

    let targetMins: number;

    if (weekHasToday) {
      targetMins = now.getHours() * 60 + now.getMinutes();
    } else {
      const weekSessions = sessions.filter(s => {
        const d = new Date(s.date);
        return d >= calWeek.monday && d <= calWeek.sunday && s.status !== 'canceled';
      });
      if (weekSessions.length > 0) {
        const earliest = weekSessions.reduce((a, b) =>
          new Date(a.date).getTime() < new Date(b.date).getTime() ? a : b
        );
        const ed = new Date(earliest.date);
        targetMins = ed.getHours() * 60 + ed.getMinutes();
      } else {
        targetMins = CAL_START_HOUR * 60 + 60;
      }
    }

    const clampedMins = Math.max(CAL_START_HOUR * 60, Math.min(CAL_END_HOUR * 60 - 60, targetMins));
    const scrollTop = ((clampedMins - CAL_START_HOUR * 60) / 60) * HOUR_HEIGHT - HOUR_HEIGHT * 2;
    calBodyRef.current.scrollTop = Math.max(0, scrollTop);
  }, [viewMode, calWeek, sessions]);

  const [calStatusFilter, setCalStatusFilter] = useState<'all' | 'upcoming' | 'completed' | 'canceled'>('all');

  // Sessions filtered for current calendar week
  const calSessions = useMemo(() => {
    return sessions.filter(s => {
      const d = new Date(s.date);
      return d >= calWeek.monday && d <= calWeek.sunday;
    });
  }, [sessions, calWeek]);

  // Counts for calendar week
  const calAllCount = calSessions.length;
  const calUpcomingCount = calSessions.filter(s => s.status === 'scheduled' && new Date(s.date) >= new Date()).length;
  const calCompletedCount = calSessions.filter(s => s.status === 'completed').length;
  const calCanceledCount = calSessions.filter(s => s.status === 'canceled').length;

  const calFilteredSessions = useMemo(() => {
    if (calStatusFilter === 'all') return calSessions.filter(s => s.status !== 'canceled');
    if (calStatusFilter === 'upcoming') return calSessions.filter(s => s.status === 'scheduled' && new Date(s.date) >= new Date());
    if (calStatusFilter === 'completed') return calSessions.filter(s => s.status === 'completed');
    if (calStatusFilter === 'canceled') return calSessions.filter(s => s.status === 'canceled');
    return calSessions;
  }, [calSessions, calStatusFilter]);

  const now = new Date();
  const todayStr = now.toDateString();

  const isUpcoming = (s: Session) => s.status === 'scheduled' && new Date(s.date) >= now;

  const filteredSessions = sessions.filter(s => {
    if (statusFilter === 'today' && (new Date(s.date).toDateString() !== todayStr || s.status === 'canceled')) return false;
    if (statusFilter === 'upcoming' && !isUpcoming(s)) return false;
    if (statusFilter === 'completed' && s.status !== 'completed') return false;
    if (statusFilter === 'canceled' && s.status !== 'canceled') return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return s.title.toLowerCase().includes(term) ||
        s.studentName.toLowerCase().includes(term) ||
        (s.description || '').toLowerCase().includes(term);
    }
    return true;
  });

  // Sort: upcoming first, then completed, then canceled
  const sorted = [...filteredSessions].sort((a, b) => {
    const order: Record<string, number> = { scheduled: 0, completed: 1, canceled: 2 };
    const diff = (order[a.status] ?? 3) - (order[b.status] ?? 3);
    if (diff !== 0) return diff;
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / SESSIONS_PER_PAGE));
  const pagedSessions = sorted.slice((currentPage - 1) * SESSIONS_PER_PAGE, currentPage * SESSIONS_PER_PAGE);
  const showFrom = sorted.length === 0 ? 0 : (currentPage - 1) * SESSIONS_PER_PAGE + 1;
  const showTo = Math.min(currentPage * SESSIONS_PER_PAGE, sorted.length);

  // Stats (always from full dataset)
  const totalCount = sessions.length;
  const upcomingCount = sessions.filter(s => isUpcoming(s)).length;
  const completedCount = sessions.filter(s => s.status === 'completed').length;
  const canceledCount = sessions.filter(s => s.status === 'canceled').length;

  // Grouping for "all" view
  const upcomingGroup = pagedSessions.filter(s => s.status === 'scheduled');
  const completedGroup = pagedSessions.filter(s => s.status === 'completed');
  const canceledGroup = pagedSessions.filter(s => s.status === 'canceled');
  const showGrouped = statusFilter === 'all';

  // Canceled sessions shown as a trailing section in non-all, non-canceled views
  const canceledAll = [...sessions]
    .filter(s => s.status === 'canceled')
    .filter(s => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return s.title.toLowerCase().includes(term) || s.studentName.toLowerCase().includes(term);
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const showCanceledTrailing = !showGrouped && statusFilter !== 'canceled' && canceledAll.length > 0;

  // Current live session — one that is happening right now
  const currentSession = useMemo(() => {
    const nowMs = tick;
    return sessions.find(s => {
      if (s.status !== 'scheduled') return false;
      const startMs = new Date(s.date).getTime();
      const endMs = startMs + s.duration * 60000;
      return nowMs >= startMs && nowMs < endMs;
    }) || null;
  }, [sessions, tick]);

  function getStatusLabel(s: Session) {
    if (s.status === 'scheduled') return 'upcoming';
    return s.status;
  }

  // Snap minutes to nearest 15-min slot
  function snapMins(mins: number) {
    return Math.round(mins / 15) * 15;
  }

  function formatHHMM(totalMins: number) {
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  async function handleCalNewSave() {
    if (!calNewPopover || !calNewStudentId || !calNewTitle.trim()) return;
    setCalNewSaving(true);
    setCalNewError('');
    try {
      const d = new Date(calNewPopover.day);
      const snapped = snapMins(calNewPopover.minutes);
      d.setHours(Math.floor(snapped / 60), snapped % 60, 0, 0);
      const off = -d.getTimezoneOffset();
      const sign = off >= 0 ? '+' : '-';
      const ph = String(Math.floor(Math.abs(off) / 60)).padStart(2, '0');
      const pm2 = String(Math.abs(off) % 60).padStart(2, '0');
      const p = (n: number) => String(n).padStart(2, '0');
      const localDate = `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:00${sign}${ph}:${pm2}`;
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({
          studentId: calNewStudentId,
          title: calNewTitle.trim(),
          date: localDate,
          duration: calNewDuration,
          status: 'scheduled',
        }),
      });
      if (res.status === 401) { logout(); return; }
      if (res.status === 409) {
        const body = await res.json();
        setCalNewError(body.message || 'This time slot overlaps with another session.');
        setCalNewSaving(false);
        return;
      }
      if (res.ok) {
        const sRes = await fetch('/api/sessions', { headers: { Authorization: 'Bearer ' + token } });
        if (sRes.ok) setSessions(await sRes.json());
        setCalNewPopover(null);
        setCalNewTitle('');
        setCalNewStudentId('');
        setCalNewDuration(60);
        setCalNewError('');
      }
    } catch { /* silent */ }
    setCalNewSaving(false);
  }

  async function cancelSession(id: string) {
    try {
      const res = await fetch(`/api/sessions/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ status: 'canceled' }),
      });
      if (res.status === 401) { logout(); return; }
      if (res.ok) {
        setSessions(prev => prev.map(s => s.id === id ? { ...s, status: 'canceled' } : s));
      }
    } catch { /* silent */ }
    setConfirmCancel(null);
    setOpenMenu(null);
    setCalOpenMenu(null);
  }

  function getCountdownUnits(targetMs: number): { value: string; label: string }[] {
    const diff = Math.max(0, targetMs - tick);
    const sec = Math.floor(diff / 1000);
    const min = Math.floor(sec / 60);
    const hrs = Math.floor(min / 60);
    const days = Math.floor(hrs / 24);
    if (days > 0) return [
      { value: String(days), label: days === 1 ? 'DAY' : 'DAYS' },
      { value: String(hrs % 24).padStart(2, '0'), label: 'HRS' },
      { value: String(min % 60).padStart(2, '0'), label: 'MIN' },
    ];
    return [
      { value: String(hrs).padStart(2, '0'), label: 'HRS' },
      { value: String(min % 60).padStart(2, '0'), label: 'MIN' },
      { value: String(sec % 60).padStart(2, '0'), label: 'SEC' },
    ];
  }

  // Accent colors for the left bar - cycle based on student name hash
  const accentColors = ['#10b981', '#7c3aed', '#3b82f6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'];
  function getAccentColor(name: string) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return accentColors[Math.abs(hash) % accentColors.length];
  }

  function renderRow(s: Session, rowNum: number) {
    const avatar = getAvatarStyle(s.studentName);
    const d = new Date(s.date);
    const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const startTime = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const endDate = new Date(d.getTime() + s.duration * 60000);
    const endTime = endDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const statusLabel = getStatusLabel(s);
    const isUp = statusLabel === 'upcoming' && d.getTime() > tick;
    const isLiveNow = s.status === 'scheduled' && tick >= d.getTime() && tick < endDate.getTime();

    return (
      <tr
        key={s.id}
        className={`ss-row${isLiveNow ? ' ss-row-live' : ''}`}
        onClick={() => router.push(`/admin/sessions/${s.id}`)}
      >
        <td className="ss-cell-info">
          <div className="ss-row-info">
            <div className="ss-row-avatar" style={{ background: avatar.bg, color: avatar.text }}>
              {getInitials(s.studentName)}
            </div>
            <div className="ss-row-info-text">
              <div className="ss-row-title">{s.title}</div>
              <div className="ss-row-student">{s.studentName}</div>
            </div>
          </div>
        </td>
        <td className="ss-cell-countdown">
          {isLiveNow ? null : isUp ? (
            <div className="ss-countdown">
              {getCountdownUnits(d.getTime()).map((u, i) => (
                <div className="ss-cd-unit" key={i}>
                  <span className="ss-cd-val">{u.value}</span>
                  <span className="ss-cd-lbl">{u.label}</span>
                </div>
              ))}
            </div>
          ) : s.status === 'completed' ? (
            <div className="ss-mark-done">
              <svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              Completed
            </div>
          ) : s.status === 'canceled' ? (
            <div className="ss-mark-cancel">Canceled</div>
          ) : (
            <div className="ss-mark-past">Past</div>
          )}
        </td>
        <td className="ss-cell-type">
          <span className={`ss-row-type ${s.studentType}`}>{s.studentType}</span>
        </td>
        <td className="ss-cell-dur">
          <span className="ss-row-dur">{s.duration} min</span>
        </td>
        <td className="ss-cell-date">
          <div className="ss-row-date">
            <div className="ss-row-date-day">{dateStr}</div>
            <div className="ss-row-date-time">{startTime} – {endTime}</div>
          </div>
        </td>
        <td className="ss-cell-status">
          {isLiveNow ? (
            <Link
              href={`/admin/sessions/${s.id}`}
              className="ss-go-class-btn"
              onClick={e => e.stopPropagation()}
            >
              Go to Class
              <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
            </Link>
          ) : (
            <span className={`ss-row-status ${statusLabel}`}>
              {s.status === 'completed' ? 'Completed' : s.status === 'canceled' ? 'Canceled' : 'Upcoming'}
            </span>
          )}
        </td>
        <td className="ss-cell-menu" onClick={e => e.stopPropagation()}>
          {!isLiveNow && (
            <button
              className={`ss-row-menu${openMenu?.id === s.id ? ' open' : ''}`}
              onClick={e => {
                e.stopPropagation();
                if (openMenu?.id === s.id) { setOpenMenu(null); return; }
                const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                setOpenMenu({ id: s.id, top: rect.bottom + 6, left: rect.right - 170 });
              }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="3" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="8" cy="13" r="1.5"/></svg>
            </button>
          )}
        </td>
      </tr>
    );
  }

  function renderTableHead() {
    return (
      <thead className="ss-thead">
        <tr>
          <th className="ss-th ss-th-info">Session</th>
          <th className="ss-th ss-th-countdown">Countdown</th>
          <th className="ss-th ss-th-type">Type</th>
          <th className="ss-th ss-th-dur">Duration</th>
          <th className="ss-th ss-th-date">Date &amp; Time</th>
          <th className="ss-th ss-th-status">Status</th>
          <th className="ss-th ss-th-menu" />
        </tr>
      </thead>
    );
  }

  function renderSection(label: string, items: Session[], startNum: number) {
    if (items.length === 0) return null;
    return (
      <>
        <div className="ss-section-label">{label}</div>
        <table className="ss-table">
          {renderTableHead()}
          <tbody>
            {items.map((s, i) => renderRow(s, startNum + i))}
          </tbody>
        </table>
      </>
    );
  }

  return (
    <>
      <style jsx global>{`
        /* ── Animations ── */
        @keyframes ss-rise {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .ss-anim-1 { animation: ss-rise 0.4s ease-out 0.02s both; }
        .ss-anim-2 { animation: ss-rise 0.4s ease-out 0.08s both; }
        .ss-anim-3 { animation: ss-rise 0.4s ease-out 0.12s both; }
        .ss-anim-4 { animation: ss-rise 0.4s ease-out 0.18s both; }

        /* ── Header ── */
        .ss-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 26px;
        }
        .ss-title {
          font-family: 'Poppins', sans-serif;
          font-size: 1.4rem;
          font-weight: 700;
          color: #1a2e44;
          letter-spacing: -0.02em;
          line-height: 1;
        }
        .ss-subtitle {
          font-size: 0.8rem;
          color: #94a7b5;
          font-weight: 400;
          margin-top: 8px;
        }
        .ss-header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .ss-btn-new {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 9px 20px;
          font-family: 'Poppins', sans-serif;
          font-size: 0.8rem;
          font-weight: 600;
          color: #fff;
          background: #1a2e44;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.15s;
        }
        .ss-btn-new:hover { background: #243d56; }
        .ss-btn-new svg { width: 14px; height: 14px; stroke: currentColor; stroke-width: 2.5; fill: none; }

        /* ── Stat Cards with Ring ── */
        .ss-stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }
        .ss-stat {
          background: #fff;
          border-radius: 14px;
          padding: 20px 22px;
          box-shadow: 0 1px 4px rgba(0,0,0,0.04);
          border: 1px solid #f0f3f6;
          display: flex;
          align-items: center;
          gap: 16px;
          transition: box-shadow 0.2s;
        }
        .ss-stat:hover {
          box-shadow: 0 3px 12px rgba(0,0,0,0.06);
        }
        .ss-stat-ring {
          position: relative;
          width: 52px;
          height: 52px;
          flex-shrink: 0;
        }
        .ss-stat-ring svg {
          width: 52px;
          height: 52px;
          transform: rotate(-90deg);
        }
        .ss-stat-ring .ring-bg {
          fill: none;
          stroke-width: 3.5;
          stroke: #f0f3f6;
        }
        .ss-stat-ring .ring-fg {
          fill: none;
          stroke-width: 3.5;
          stroke-linecap: round;
          transition: stroke-dashoffset 0.8s ease;
        }
        .ss-stat.s-total .ring-fg { stroke: #6b7b8d; }
        .ss-stat.s-upcoming .ring-fg { stroke: #3b82f6; }
        .ss-stat.s-completed .ring-fg { stroke: #16a34a; }
        .ss-stat.s-canceled .ring-fg { stroke: #ef4444; }
        .ss-stat-ring-value {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Poppins', sans-serif;
          font-size: 1.05rem;
          font-weight: 700;
          color: #1a2e44;
          letter-spacing: -0.02em;
        }
        .ss-stat-text {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .ss-stat-label {
          font-size: 0.72rem;
          font-weight: 500;
          color: #94a7b5;
          letter-spacing: 0.01em;
        }
        .ss-stat-value {
          font-family: 'Poppins', sans-serif;
          font-size: 1.55rem;
          font-weight: 700;
          color: #1a2e44;
          letter-spacing: -0.03em;
          line-height: 1;
        }

        /* ── Live Session Banner ── */
        .ss-live-banner {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 12px 16px 12px 20px;
          margin-bottom: 20px;
          background: #fff;
          border: 1px solid #e2e9ef;
          border-radius: 10px;
          cursor: pointer;
          transition: background 0.15s;
          border-left: 4px solid #2563eb;
          position: relative;
          overflow: hidden;
        }
        .ss-live-banner:hover { background: #f9fafb; }
        .ss-live-dot {
          width: 7px; height: 7px;
          border-radius: 50%;
          background: #2563eb;
          flex-shrink: 0;
          animation: ss-live-pulse 1.6s ease-in-out infinite;
        }
        @keyframes ss-live-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
        .ss-live-title {
          font-size: 0.84rem;
          font-weight: 700;
          color: #1a2e44;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          min-width: 0;
        }
        .ss-live-sep {
          width: 1px; height: 14px;
          background: #e2e9ef;
          flex-shrink: 0;
        }
        .ss-live-time {
          font-size: 0.76rem;
          font-weight: 500;
          color: #5f7a8f;
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .ss-live-student {
          font-size: 0.76rem;
          font-weight: 500;
          color: #94a7b5;
          white-space: nowrap;
          flex-shrink: 0;
          margin-right: auto;
        }
        .ss-live-action {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 6px 14px;
          font-family: 'Poppins', sans-serif;
          font-size: 0.74rem;
          font-weight: 600;
          color: #2563eb;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          border-radius: 6px;
          white-space: nowrap;
          flex-shrink: 0;
          transition: background 0.12s;
        }
        .ss-live-banner:hover .ss-live-action { background: #dbeafe; }
        .ss-live-action svg {
          width: 12px; height: 12px;
          stroke: currentColor; stroke-width: 2.5; fill: none;
          stroke-linecap: round; stroke-linejoin: round;
        }
        @media (max-width: 640px) {
          .ss-live-banner { flex-wrap: wrap; gap: 8px 12px; }
          .ss-live-student { display: none; }
          .ss-live-title { flex: 1; }
          .ss-live-action { margin-left: auto; }
        }

        /* ── Unified Filter Bar ── */
        .ss-filter-bar {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 22px;
          flex-wrap: wrap;
        }
        .ss-search-inline {
          position: relative;
          width: 260px;
          flex-shrink: 0;
        }
        .ss-search-inline > svg {
          position: absolute;
          left: 11px; top: 50%; transform: translateY(-50%);
          width: 14px; height: 14px;
          stroke: #b8c9d6; stroke-width: 2; fill: none;
          pointer-events: none; stroke-linecap: round; stroke-linejoin: round;
        }
        .ss-search {
          width: 100%;
          padding: 8px 12px 8px 34px;
          font-family: 'Poppins', sans-serif;
          font-size: 0.8rem;
          color: #1a2e44;
          background: #fff;
          border: 1px solid #e2e9ef;
          border-radius: 8px;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .ss-search::placeholder { color: #b8c9d6; }
        .ss-search:focus { border-color: #2db5c0; box-shadow: 0 0 0 3px rgba(45,181,192,0.07); }

        .ss-filter-divider {
          width: 1px;
          height: 24px;
          background: #e8eef3;
          flex-shrink: 0;
        }

        .ss-tabs {
          display: flex;
          gap: 2px;
          overflow-x: auto;
          scrollbar-width: none;
          background: #f5f7fa;
          border-radius: 8px;
          padding: 3px;
        }
        .ss-tabs::-webkit-scrollbar { display: none; }
        .ss-tab {
          padding: 7px 14px;
          font-family: 'Poppins', sans-serif;
          font-size: 0.78rem;
          font-weight: 500;
          color: #7a8f9e;
          background: none;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.18s;
          white-space: nowrap;
          line-height: 1;
        }
        .ss-tab:hover { color: #3d5468; }
        .ss-tab.active {
          color: #1a2e44;
          font-weight: 600;
          background: #fff;
          box-shadow: 0 1px 3px rgba(0,0,0,0.06);
        }

        @keyframes ss-drop-in {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* ── Section label ── */
        .ss-section-label {
          font-family: 'Poppins', sans-serif;
          font-size: 0.78rem;
          font-weight: 600;
          color: #1a2e44;
          margin: 20px 0 8px;
          padding-left: 2px;
        }
        .ss-section-label:first-child { margin-top: 0; }

        /* ── Session Table ── */
        .ss-table {
          width: 100%;
          border-collapse: collapse;
          background: #fff;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: none;
          border: 1px solid #d8e3ec;
          margin-bottom: 4px;
          table-layout: fixed;
        }

        .ss-thead { border-bottom: 1px solid #f0f3f6; }
        .ss-th {
          padding: 10px 14px;
          font-size: 0.68rem;
          font-weight: 600;
          color: #94a7b5;
          text-transform: uppercase;
          letter-spacing: 0.07em;
          text-align: left;
          white-space: nowrap;
          background: #fafcfd;
        }
        .ss-th-info    { width: auto; padding-left: 20px; }
        .ss-th-countdown { width: 160px; }
        .ss-th-type    { width: 88px; }
        .ss-th-dur     { width: 72px; }
        .ss-th-date    { width: 148px; }
        .ss-th-status  { width: 96px; }
        .ss-th-menu    { width: 44px; }

        .ss-row {
          border-bottom: 1px solid #f2f5f8;
          cursor: pointer;
          transition: background 0.15s ease;
        }
        .ss-row:last-child { border-bottom: none; }
        .ss-row:hover { background: #fafcfd; }

        .ss-row td {
          padding: 16px 14px;
          vertical-align: middle;
        }
        .ss-cell-info  { padding-left: 20px; }
        .ss-cell-menu  { padding-right: 16px; text-align: right; }

        /* Colored left accent bar */

        .ss-row-avatar {
          width: 38px; height: 38px; min-width: 38px;
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          font-family: 'Poppins', sans-serif;
          font-size: 0.68rem; font-weight: 700; letter-spacing: 0.03em;
        }

        .ss-row-info { min-width: 0; display: flex; align-items: center; gap: 14px; }
        .ss-row-info-text { min-width: 0; flex: 1; }
        .ss-row-title {
          font-family: 'Poppins', sans-serif;
          font-size: 0.84rem;
          font-weight: 600;
          color: #1a2e44;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-bottom: 3px;
          letter-spacing: -0.01em;
        }
        .ss-row-student {
          font-size: 0.73rem;
          color: #94a7b5;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }

        /* ── Countdown ── */
        .ss-countdown { display: flex; gap: 10px; align-items: flex-start; }
        .ss-cd-unit { display: flex; flex-direction: column; align-items: center; min-width: 32px; }
        .ss-cd-val {
          font-family: 'Poppins', sans-serif;
          font-size: 0.95rem; font-weight: 700; color: #1a2e44;
          font-variant-numeric: tabular-nums; line-height: 1;
        }
        .ss-cd-lbl {
          font-size: 0.48rem; font-weight: 600; color: #b0bfcc;
          text-transform: uppercase; letter-spacing: 0.08em; margin-top: 4px;
        }

        .ss-mark-done {
          display: flex; align-items: center; gap: 6px;
          font-size: 0.75rem; font-weight: 500; color: #10b981;
        }
        .ss-mark-done svg {
          width: 16px; height: 16px; stroke: #10b981; stroke-width: 2; fill: none;
          stroke-linecap: round; stroke-linejoin: round;
        }
        .ss-mark-cancel { font-size: 0.75rem; font-weight: 500; color: #9ca3af; }
        .ss-mark-past { font-size: 0.72rem; font-weight: 500; color: #c8d4de; letter-spacing: 0.02em; }
        .ss-row-live { background: #f0f7ff; }
        .ss-row-live:hover { background: #e8f1fd !important; }
        .ss-go-class-btn {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 5px 14px; border-radius: 6px;
          font-family: 'Poppins', sans-serif;
          font-size: 0.74rem; font-weight: 600;
          color: #fff; background: #2563eb;
          border: none;
          text-decoration: none; white-space: nowrap;
          transition: background 0.12s;
        }
        .ss-go-class-btn:hover { background: #1d4ed8; }
        .ss-go-class-btn svg {
          width: 12px; height: 12px; stroke: currentColor;
          stroke-width: 2.5; fill: none;
          stroke-linecap: round; stroke-linejoin: round;
        }

        .ss-row-type {
          display: inline-flex; align-items: center; justify-content: center;
          padding: 5px 14px; border-radius: 20px;
          font-size: 0.7rem; font-weight: 600; text-transform: capitalize; letter-spacing: 0.01em;
        }
        .ss-row-type.private { background: #f3f0ff; color: #7c3aed; }
        .ss-row-type.group { background: #ecfdf5; color: #059669; }

        .ss-row-dur {
          font-size: 0.78rem; color: #5f7a8f; font-weight: 500; text-align: center;
          white-space: nowrap;
        }

        .ss-row-date { min-width: 0; }
        .ss-row-date-day {
          font-family: 'Poppins', sans-serif;
          font-size: 0.8rem; font-weight: 600; color: #1a2e44;
          letter-spacing: -0.01em; white-space: nowrap;
        }
        .ss-row-date-time {
          font-size: 0.68rem; color: #94a7b5; margin-top: 2px; white-space: nowrap;
        }

        .ss-row-status {
          font-size: 0.76rem; font-weight: 600; text-align: center; white-space: nowrap;
        }
        .ss-row-status.upcoming { color: #ea8c00; }
        .ss-row-status.completed { color: #10b981; }
        .ss-row-status.canceled { color: #dc2626; }

        .ss-row-menu {
          display: flex; align-items: center; justify-content: center;
          width: 28px; height: 28px; background: none; border: none;
          cursor: pointer; border-radius: 6px; color: #c5d2dc;
          transition: all 0.15s; padding: 0;
        }
        .ss-row-menu:hover, .ss-row-menu.open { background: #f0f4f8; color: #5f7a8f; }
        .ss-dropdown {
          min-width: 170px; background: #fff; border: 1px solid #e8eef3;
          border-radius: 10px; box-shadow: 0 6px 20px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04);
          padding: 5px; animation: ss-drop-in 0.15s ease-out both;
        }
        .ss-drop-item {
          display: flex; align-items: center; gap: 9px; width: 100%;
          padding: 9px 12px; font-family: 'Poppins', sans-serif;
          font-size: 0.78rem; font-weight: 450; color: #3d5468;
          background: none; border: none; border-radius: 6px;
          cursor: pointer; transition: background 0.12s; text-align: left; white-space: nowrap;
        }
        .ss-drop-item:hover { background: #f5f8fa; }
        .ss-drop-item svg {
          width: 14px; height: 14px; stroke: #8ba3b5; stroke-width: 1.8; fill: none;
          stroke-linecap: round; stroke-linejoin: round; flex-shrink: 0;
        }
        .ss-drop-divider { height: 1px; background: #f0f4f8; margin: 3px 6px; }

        /* ── Pagination ── */
        .ss-pagination {
          display: flex; align-items: center; justify-content: space-between;
          padding-top: 10px; margin-top: 8px;
        }
        .ss-pagination-info { font-size: 0.78rem; color: #94a7b5; }
        .ss-pagination-btns { display: flex; gap: 3px; }
        .ss-page-btn {
          width: 30px; height: 30px;
          display: flex; align-items: center; justify-content: center;
          border-radius: 6px; border: 1px solid #e2e9ef; background: #fff;
          font-family: 'Poppins', sans-serif; font-size: 0.75rem; font-weight: 500;
          color: #5f7a8f; cursor: pointer; transition: all 0.15s;
        }
        .ss-page-btn:hover { border-color: #2db5c0; color: #2a6270; }
        .ss-page-btn.active { background: #1a2e44; border-color: #1a2e44; color: #fff; }

        /* ── Empty ── */
        @keyframes ss-empty-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .ss-empty {
          text-align: center; padding: 60px 20px 52px;
          animation: ss-empty-in 0.4s ease-out both;
        }
        .ss-empty svg {
          width: 40px; height: 40px; stroke: #c5d2dc; stroke-width: 1.2; fill: none;
          display: block; margin: 0 auto 16px; stroke-linecap: round; stroke-linejoin: round;
        }
        .ss-empty-title { font-size: 0.8125rem; font-weight: 500; color: #94a7b5; }
        .ss-empty-hint { font-size: 0.75rem; color: #b8c9d6; margin-top: 4px; }

        /* ── Loading ── */
        @keyframes ss-spin { to { transform: rotate(360deg); } }
        .ss-loading {
          display: flex; align-items: center; justify-content: center; height: 40vh;
          font-family: 'Poppins', sans-serif; font-size: 0.85rem; color: #94a7b5;
        }
        .ss-loading-ring {
          width: 16px; height: 16px; border: 2px solid #e2e9ef;
          border-top-color: #2db5c0; border-radius: 50%;
          animation: ss-spin 0.6s linear infinite; margin-right: 10px;
        }

        /* ── Responsive ── */
        @media (max-width: 1024px) {
          .ss-stats { grid-template-columns: repeat(2, 1fr); }
          .ss-cell-dur, .ss-cell-date, .ss-th-dur, .ss-th-date { display: none; }
          .ss-search-inline { width: 200px; }
        }
        @media (max-width: 768px) {
          .ss-header { flex-direction: column; gap: 14px; }
          .ss-stats { grid-template-columns: 1fr 1fr; }
          .ss-filter-bar { flex-direction: column; align-items: stretch; gap: 10px; }
          .ss-search-inline { width: 100%; }
          .ss-filter-divider { display: none; }
          .ss-cell-dur, .ss-cell-menu, .ss-th-dur, .ss-th-menu { display: none; }
          .ss-pagination { flex-direction: column; gap: 10px; align-items: flex-start; }
        }
        @media (max-width: 500px) {
          .ss-stats { grid-template-columns: 1fr; }
          .ss-cell-type, .ss-cell-countdown, .ss-cell-date, .ss-th-type, .ss-th-countdown, .ss-th-date { display: none; }
        }

        .ss-hidden { display: none !important; }

        /* ── Calendar full-screen mode (body.cal-fs) ── */
        body.cal-fs .sidebar {
          width: 56px;
          min-width: 56px;
          transition: width 0.25s cubic-bezier(0.4,0,0.2,1), min-width 0.25s cubic-bezier(0.4,0,0.2,1);
          overflow: hidden;
        }
        body.cal-fs .sidebar-brand { padding: 0 8px 10px; justify-content: center; }
        body.cal-fs .sidebar-brand .brand-icon { width: 36px; height: 36px; min-width: 36px; }
        body.cal-fs .sidebar-brand .brand-icon img { height: 36px; }
        body.cal-fs .sidebar-section-label { opacity: 0; height: 0; padding: 0; overflow: hidden; }
        body.cal-fs .sidebar-nav { padding: 4px 6px 0; }
        body.cal-fs .sidebar-nav li a { padding: 9px; justify-content: center; }
        body.cal-fs .nav-label { display: none; }
        body.cal-fs .sidebar-nav li a.active::before { display: none; }
        body.cal-fs .sidebar-footer { padding: 10px 6px 12px; }
        body.cal-fs .sidebar-user { padding: 8px; justify-content: center; }
        body.cal-fs .sidebar-user-info { display: none; }
        body.cal-fs .logout-btn { justify-content: center; padding: 9px; font-size: 0; gap: 0; }
        body.cal-fs .logout-btn svg { width: 14px; height: 14px; flex-shrink: 0; }
        body.cal-fs .main { transition: padding 0.25s ease; padding: 20px 20px !important; }
        body.cal-fs .ss-header { margin-bottom: 14px; }
        body.cal-fs .ss-subtitle { display: none; }
        body.cal-fs .ss-title { font-size: 1.1rem; }

        .cal-expand-btn {
          display: flex; align-items: center; justify-content: center;
          width: 28px; height: 28px; border-radius: 7px;
          background: none; border: 1px solid #e2e9ef;
          cursor: pointer; color: #5f7a8f; margin-left: auto;
          transition: all 0.15s; flex-shrink: 0;
        }
        .cal-expand-btn:hover { background: #f5f7fa; border-color: #c5d2dc; color: #1a2e44; }
        .cal-expand-btn svg { width: 13px; height: 13px; stroke: currentColor; stroke-width: 2; fill: none; stroke-linecap: round; stroke-linejoin: round; }

        /* ── View Toggle ── */
        .ss-view-toggle {
          display: flex;
          background: #f5f7fa;
          border-radius: 8px;
          padding: 3px;
          gap: 2px;
        }
        .ss-view-btn {
          display: flex; align-items: center; justify-content: center;
          width: 32px; height: 32px;
          background: none; border: none; border-radius: 6px;
          cursor: pointer; color: #94a7b5;
          transition: all 0.15s;
        }
        .ss-view-btn:hover { color: #3d5468; background: #eceff2; }
        .ss-view-btn.active { background: #fff; color: #1a2e44; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
        .ss-view-btn svg { width: 15px; height: 15px; stroke: currentColor; stroke-width: 1.8; fill: none; stroke-linecap: round; stroke-linejoin: round; }

        /* ── Calendar Wrapper ── */
        .cal-wrap {
          display: flex; flex-direction: column;
          background: #fff;
          border-radius: 14px;
          border: 1px solid #f0f3f6;
          box-shadow: 0 1px 4px rgba(0,0,0,0.04);
          overflow: hidden;
          width: 100%;
          height: calc(100vh - 180px);
          min-height: 500px;
          transition: height 0.25s ease, border-radius 0.25s ease;
        }
        body.cal-fs .cal-wrap {
          height: calc(100vh - 116px);
          border-radius: 12px;
        }

        /* ── Calendar Top Bar (two-row) ── */
        .cal-topbar {
          display: flex; flex-direction: column;
          border-bottom: 1px solid #f0f3f6;
        }
        .cal-topbar-row1 {
          display: flex; align-items: center;
          gap: 10px; padding: 14px 20px 10px;
          flex-wrap: wrap;
        }
        .cal-today-btn {
          padding: 7px 16px; border-radius: 8px;
          border: 1px solid #e2e9ef; background: #fff;
          font-family: 'Poppins', sans-serif;
          font-size: 0.78rem; font-weight: 600; color: #3d5468;
          cursor: pointer; transition: all 0.15s; white-space: nowrap;
        }
        .cal-today-btn:hover { background: #f5f7fa; color: #1a2e44; border-color: #c5d2dc; }
        .cal-nav {
          display: flex; align-items: center; gap: 0; flex-shrink: 0;
          border: 1px solid #e2e9ef; border-radius: 8px; overflow: hidden;
          background: #fff;
        }
        .cal-nav-btn {
          display: flex; align-items: center; justify-content: center;
          width: 32px; height: 32px;
          background: none; border: none; border-right: 1px solid #e2e9ef;
          cursor: pointer; color: #5f7a8f;
          transition: all 0.15s;
        }
        .cal-nav-btn:last-child { border-right: none; }
        .cal-nav-btn:hover { background: #f5f7fa; color: #1a2e44; }
        .cal-nav-btn svg { width: 13px; height: 13px; stroke: currentColor; stroke-width: 2; fill: none; stroke-linecap: round; stroke-linejoin: round; }
        .cal-date-badge {
          display: flex; align-items: center; gap: 8px;
          padding: 7px 14px; border-radius: 8px;
          border: 1px solid #e2e9ef; background: #fff;
          font-family: 'Poppins', sans-serif;
          font-size: 0.78rem; font-weight: 600; color: #1a2e44;
          letter-spacing: -0.01em; white-space: nowrap;
        }
        .cal-date-badge svg {
          width: 14px; height: 14px; stroke: #94a7b5; stroke-width: 1.8;
          fill: none; stroke-linecap: round; stroke-linejoin: round; flex-shrink: 0;
        }

        /* Row 2: filter tabs */
        .cal-topbar-row2 {
          display: flex; align-items: center;
          gap: 4px; padding: 0 20px 12px;
          flex-wrap: wrap;
        }
        .cal-filter-tab {
          display: flex; align-items: center; gap: 6px;
          padding: 6px 14px; border-radius: 6px;
          border: none; background: none;
          font-family: 'Poppins', sans-serif;
          font-size: 0.76rem; font-weight: 500; color: #7a8f9e;
          cursor: pointer; transition: all 0.15s; white-space: nowrap;
          position: relative;
        }
        .cal-filter-tab:hover { color: #3d5468; background: #f5f7fa; }
        .cal-filter-tab.active {
          color: #1a2e44; font-weight: 700;
          background: none;
        }
        .cal-filter-tab.active::after {
          content: ''; position: absolute;
          left: 14px; right: 14px; bottom: -1px;
          height: 2px; background: #1a2e44; border-radius: 2px;
        }
        .cal-filter-tab svg {
          width: 13px; height: 13px; stroke: currentColor; stroke-width: 1.8;
          fill: none; stroke-linecap: round; stroke-linejoin: round; flex-shrink: 0;
        }
        .cal-filter-count {
          font-size: 0.68rem; font-weight: 600; color: #94a7b5;
        }
        .cal-filter-tab.active .cal-filter-count { color: #5f7a8f; }

        /* ── Pinned sessions strip ── */
        .cal-pinned-strip {
          display: flex; gap: 12px;
          padding: 12px 20px 14px;
          overflow-x: auto; overflow-y: hidden;
          border-bottom: 1px solid #f0f3f6;
          scrollbar-width: none;
        }
        .cal-pinned-strip::-webkit-scrollbar { display: none; }
        @keyframes cal-pin-in {
          from { opacity: 0; transform: translateY(6px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .cal-pin-card {
          flex-shrink: 0;
          width: 240px;
          background: #fff;
          border: 1px solid #e8ecf0;
          border-radius: 12px;
          display: flex; flex-direction: column;
          cursor: pointer;
          transition: box-shadow 0.18s, border-color 0.18s;
          animation: cal-pin-in 0.22s ease-out both;
          overflow: hidden;
        }
        .cal-pin-card:hover {
          box-shadow: 0 4px 18px rgba(0,0,0,0.08);
          border-color: #d4dbe3;
        }
        .cal-pin-body {
          padding: 14px 16px 10px;
          display: flex; flex-direction: column; gap: 3px;
        }
        .cal-pin-row1 {
          display: flex; align-items: center; justify-content: space-between; gap: 8px;
        }
        .cal-pin-title {
          font-family: 'Poppins', sans-serif;
          font-size: 0.88rem; font-weight: 700; color: #1a2e44;
          line-height: 1.3;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          flex: 1;
        }
        .cal-pin-chevron {
          display: flex; align-items: center; justify-content: center;
          width: 28px; height: 28px; flex-shrink: 0;
          background: none; border: 1.5px solid #e2e9ef; border-radius: 50%;
          cursor: pointer; color: #94a7b5; transition: all 0.12s;
        }
        .cal-pin-chevron:hover { background: #f5f7fa; color: #5f7a8f; border-color: #c5d2dc; }
        .cal-pin-chevron svg {
          width: 12px; height: 12px; stroke: currentColor; stroke-width: 2;
          fill: none; stroke-linecap: round; stroke-linejoin: round;
        }
        .cal-pin-time {
          font-family: 'Poppins', sans-serif;
          font-size: 0.76rem; font-weight: 500; color: #7a8f9e;
        }
        .cal-pin-footer {
          display: flex; align-items: center; justify-content: space-between;
          padding: 8px 16px;
          margin-top: auto;
        }
        .cal-pin-status {
          display: flex; align-items: center; gap: 6px;
          font-family: 'Poppins', sans-serif;
          font-size: 0.72rem; font-weight: 600;
        }
        .cal-pin-status svg {
          width: 13px; height: 13px; stroke: currentColor; stroke-width: 2;
          fill: none; stroke-linecap: round; stroke-linejoin: round; flex-shrink: 0;
        }
        .cal-pin-action {
          font-family: 'Poppins', sans-serif;
          font-size: 0.72rem; font-weight: 600; color: inherit;
          background: none; border: none; cursor: pointer;
          text-decoration: underline; text-underline-offset: 2px;
          transition: opacity 0.12s;
        }
        .cal-pin-action:hover { opacity: 0.7; }
        .cal-pin-card.cal-pin-live {
          border-color: #bfdbfe;
          border-left: 3px solid #2563eb;
        }
        .cal-pin-card.cal-pin-live:hover { border-color: #93c5fd; }

        /* ── Calendar Grid ── */
        .cal-scroll-outer {
          overflow-x: auto;
          overflow-y: hidden;
          flex: 1;
          display: flex;
          flex-direction: column;
          min-height: 0;
        }
        .cal-head {
          display: grid;
          grid-template-columns: 52px repeat(7, minmax(0, 1fr));
          border-bottom: 1px solid #f0f3f6;
          position: sticky; top: 0; z-index: 10; background: #fff;
          min-width: 600px;
        }
        .cal-head-gutter {
          border-right: 1px solid #f0f3f6;
        }
        .cal-day-head {
          padding: 10px 8px;
          display: flex; flex-direction: column; align-items: center; gap: 3px;
          border-right: 1px solid #f0f3f6;
        }
        .cal-day-head:last-child { border-right: none; }
        .cal-day-num {
          font-family: 'Poppins', sans-serif;
          font-size: 1.05rem; font-weight: 700; color: #1a2e44;
          line-height: 1; letter-spacing: -0.02em;
        }
        .cal-day-name {
          font-size: 0.66rem; font-weight: 500; color: #94a7b5;
          text-transform: uppercase; letter-spacing: 0.06em;
        }
        .cal-day-head.today .cal-day-num {
          background: #1a2e44; color: #fff;
          width: 28px; height: 28px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 0.9rem;
        }
        .cal-day-head.today .cal-day-name { color: #2db5c0; }

        .cal-body {
          overflow-y: auto;
          overflow-x: hidden;
          flex: 1;
          min-height: 0;
          min-width: 600px;
        }
        .cal-body::-webkit-scrollbar { width: 5px; }
        .cal-body::-webkit-scrollbar-track { background: transparent; }
        .cal-body::-webkit-scrollbar-thumb { background: #e2e9ef; border-radius: 10px; }

        .cal-grid {
          display: grid;
          grid-template-columns: 52px repeat(7, minmax(0, 1fr));
          width: 100%;
        }

        /* Time gutter */
        .cal-times {
          display: flex; flex-direction: column;
          border-right: 1px solid #f0f3f6;
        }
        .cal-time-row {
          display: flex; align-items: flex-start; justify-content: flex-end;
          padding: 0 8px 0 0;
          flex-shrink: 0;
        }
        .cal-time-label {
          font-size: 0.62rem; font-weight: 500; color: #b8c9d6;
          margin-top: -7px; white-space: nowrap;
        }

        /* Day columns */
        .cal-col {
          position: relative;
          border-right: 1px solid #f2f4f7;
        }
        .cal-col:last-child { border-right: none; }
        .cal-col.today { background: rgba(45, 181, 192, 0.02); }
        .cal-past-overlay {
          position: absolute; left: 0; right: 0; top: 0;
          background: repeating-linear-gradient(
            -45deg,
            transparent,
            transparent 6px,
            rgba(0,0,0,0.025) 6px,
            rgba(0,0,0,0.025) 7px
          );
          pointer-events: none; z-index: 1;
        }
        .cal-hour-line {
          position: absolute; left: 0; right: 0;
          height: 1px; background: #f4f6f8;
        }

        /* Session cards on calendar */
        @keyframes cal-card-in {
          from { opacity: 0; transform: scaleY(0.92); }
          to { opacity: 1; transform: scaleY(1); }
        }
        .cal-session {
          position: absolute;
          left: 4px; right: 4px;
          border-radius: 6px;
          padding: 8px 10px;
          cursor: pointer;
          overflow: hidden;
          transition: box-shadow 0.18s, transform 0.18s;
          animation: cal-card-in 0.25s ease-out both;
          z-index: 2;
          display: flex;
          flex-direction: column;
        }
        .cal-session.cal-session-sm {
          padding: 4px 8px;
        }
        .cal-session:hover {
          box-shadow: 0 6px 20px rgba(0,0,0,0.12);
          transform: translateY(-1px) scale(1.02);
          z-index: 20 !important;
        }
        .cal-session-title {
          font-family: 'Poppins', sans-serif;
          font-size: 0.78rem; font-weight: 700;
          line-height: 1.2;
          overflow: hidden; text-overflow: ellipsis;
          white-space: nowrap;
          min-height: 0;
          flex-shrink: 1;
        }
        .cal-session-sm .cal-session-title {
          font-size: 0.68rem;
        }
        .cal-session-title.clamp2 {
          white-space: normal;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
        }
        .cal-session-time {
          font-size: 0.68rem; font-weight: 500;
          opacity: 0.7; margin-top: 2px; white-space: nowrap;
          flex-shrink: 0;
        }
        .cal-session-sm .cal-session-time {
          font-size: 0.6rem; margin-top: 1px;
        }
        .cal-session-footer {
          display: flex; align-items: center; gap: 6px;
          margin-top: auto; padding-top: 6px;
        }
        .cal-session-avatar {
          width: 22px; height: 22px; min-width: 22px;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 0.52rem; font-weight: 700;
          letter-spacing: 0.02em;
          border: 1.5px solid rgba(255,255,255,0.7);
        }
        .cal-session-student {
          font-size: 0.62rem; font-weight: 500;
          opacity: 0.65;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .cal-session-menu-btn {
          position: absolute; top: 5px; right: 5px;
          display: flex; align-items: center; justify-content: center;
          width: 20px; height: 20px;
          background: rgba(255,255,255,0.55); border: none; border-radius: 5px;
          cursor: pointer; font-size: 0.7rem; font-weight: 700;
          color: inherit; opacity: 0; transition: opacity 0.15s;
          line-height: 1; padding: 0;
          backdrop-filter: blur(4px);
        }
        .cal-session:hover .cal-session-menu-btn { opacity: 1; }
        .cal-session.cal-session-disabled {
          border: 1.5px dashed #c8d4de;
          opacity: 0.55;
        }
        .cal-session.cal-session-disabled:hover {
          box-shadow: none;
          transform: none;
        }
        .cal-session.cal-session-done {
          border: 1.5px dashed #b8c9d6;
          opacity: 0.6;
        }
        .cal-session.cal-session-done:hover {
          box-shadow: none;
          transform: none;
        }

        /* ── Calendar hover ghost ── */
        .cal-ghost {
          position: absolute; left: 3px; right: 3px;
          border-radius: 6px;
          background: rgba(45, 181, 192, 0.12);
          border: 1.5px dashed #2db5c0;
          pointer-events: none;
          display: flex; align-items: flex-start;
          padding: 4px 6px;
          z-index: 1;
          transition: top 0.06s ease;
        }
        .cal-ghost-time {
          font-family: 'Poppins', sans-serif;
          font-size: 0.65rem; font-weight: 600;
          color: #2db5c0; line-height: 1;
        }

        /* ── New-session popover ── */
        @keyframes cal-pop-in {
          from { opacity: 0; transform: translateY(6px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .cal-new-popover {
          position: fixed; z-index: 9999;
          width: 280px;
          background: #fff;
          border: 1px solid #e8eef3;
          border-radius: 12px;
          box-shadow: 0 12px 36px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.05);
          padding: 16px;
          animation: cal-pop-in 0.18s cubic-bezier(0.34,1.56,0.64,1) both;
          display: flex; flex-direction: column; gap: 10px;
        }
        .cal-new-pop-header {
          display: flex; align-items: flex-start; justify-content: space-between; gap: 8px;
        }
        .cal-new-pop-datetime { display: flex; flex-direction: column; gap: 2px; }
        .cal-new-pop-date {
          font-family: 'Poppins', sans-serif;
          font-size: 0.72rem; font-weight: 600; color: #94a7b5;
          text-transform: uppercase; letter-spacing: 0.06em;
        }
        .cal-new-pop-time {
          font-family: 'Poppins', sans-serif;
          font-size: 0.95rem; font-weight: 700; color: #1a2e44;
          letter-spacing: -0.02em;
        }
        .cal-new-pop-close {
          display: flex; align-items: center; justify-content: center;
          width: 24px; height: 24px; flex-shrink: 0;
          background: none; border: none; border-radius: 6px;
          cursor: pointer; color: #b0bfcc; transition: all 0.12s;
        }
        .cal-new-pop-close:hover { background: #f5f7fa; color: #5f7a8f; }
        .cal-new-pop-close svg { width: 13px; height: 13px; stroke: currentColor; stroke-width: 2; fill: none; stroke-linecap: round; }
        .cal-new-pop-title {
          width: 100%; padding: 8px 10px;
          font-family: 'Poppins', sans-serif;
          font-size: 0.84rem; color: #1a2e44;
          background: #f9fbfc; border: 1px solid #e2e9ef; border-radius: 8px;
          outline: none; transition: border-color 0.15s, box-shadow 0.15s;
        }
        .cal-new-pop-title::placeholder { color: #b8c9d6; }
        .cal-new-pop-title:focus { border-color: #2db5c0; box-shadow: 0 0 0 3px rgba(45,181,192,0.08); background: #fff; }
        .cal-new-pop-select {
          width: 100%; padding: 8px 10px;
          font-family: 'Poppins', sans-serif;
          font-size: 0.8rem; color: #1a2e44;
          background: #f9fbfc; border: 1px solid #e2e9ef; border-radius: 8px;
          outline: none; cursor: pointer; transition: border-color 0.15s;
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2394a7b5' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 10px center;
          padding-right: 28px;
        }
        .cal-new-pop-select:focus { border-color: #2db5c0; }
        .cal-new-pop-dur-row {
          display: flex; gap: 6px;
        }
        .cal-new-pop-dur {
          flex: 1; padding: 6px 0;
          font-family: 'Poppins', sans-serif;
          font-size: 0.72rem; font-weight: 600; color: #7a8f9e;
          background: #f5f7fa; border: 1px solid transparent; border-radius: 7px;
          cursor: pointer; transition: all 0.12s;
        }
        .cal-new-pop-dur:hover { background: #eceff2; color: #1a2e44; }
        .cal-new-pop-dur.active {
          background: #e8f9fa; color: #2db5c0;
          border-color: #b8edf1;
          font-weight: 700;
        }
        .cal-new-pop-actions {
          display: flex; gap: 8px; margin-top: 2px;
        }
        .cal-new-pop-cancel {
          flex: 1; padding: 8px;
          font-family: 'Poppins', sans-serif;
          font-size: 0.78rem; font-weight: 500; color: #7a8f9e;
          background: #f5f7fa; border: none; border-radius: 8px;
          cursor: pointer; transition: all 0.12s;
        }
        .cal-new-pop-cancel:hover { background: #eceff2; color: #3d5468; }
        .cal-new-pop-save {
          flex: 2; padding: 8px;
          font-family: 'Poppins', sans-serif;
          font-size: 0.78rem; font-weight: 600; color: #fff;
          background: #1a2e44; border: none; border-radius: 8px;
          cursor: pointer; transition: background 0.15s;
        }
        .cal-new-pop-save:hover:not(:disabled) { background: #243d56; }
        .cal-new-pop-save:disabled { opacity: 0.45; cursor: not-allowed; }
        .cal-new-pop-error {
          display: flex; align-items: flex-start; gap: 6px;
          padding: 8px 10px; border-radius: 7px;
          background: #fef2f2; border: 1px solid #fecaca;
          font-family: 'Poppins', sans-serif;
          font-size: 0.72rem; font-weight: 500; color: #dc2626;
          line-height: 1.4;
        }
        .cal-new-pop-error svg {
          width: 13px; height: 13px; flex-shrink: 0; margin-top: 1px;
          stroke: currentColor; stroke-width: 2; fill: none; stroke-linecap: round;
        }

        /* Cal portal dropdown */
        /* ── Session Hover Preview ── */
        .cal-preview {
          position: fixed; z-index: 9998;
          width: 260px;
          background: #fff;
          border: 1px solid #d8e3ec;
          border-radius: 10px;
          box-shadow: 0 8px 30px rgba(0,0,0,0.1);
          animation: cal-preview-in 0.15s ease;
          pointer-events: auto;
        }
        @keyframes cal-preview-in {
          from { opacity: 0; transform: translateX(-4px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .cal-preview-head {
          display: flex; align-items: center; gap: 10px;
          padding: 14px 16px 10px;
        }
        .cal-preview-avatar {
          width: 32px; height: 32px; min-width: 32px;
          border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          font-size: 0.62rem; font-weight: 700; letter-spacing: 0.02em;
        }
        .cal-preview-headinfo { flex: 1; min-width: 0; }
        .cal-preview-title {
          font-size: 0.84rem; font-weight: 700; color: #1a2e44;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          line-height: 1.3;
        }
        .cal-preview-student {
          font-size: 0.7rem; color: #5f7a8f; font-weight: 500; margin-top: 1px;
        }
        .cal-preview-rows {
          padding: 0 16px; display: flex; flex-direction: column; gap: 6px;
        }
        .cal-preview-row {
          display: flex; align-items: center; gap: 8px;
          font-size: 0.72rem; color: #1a2e44; font-weight: 500;
        }
        .cal-preview-row svg {
          width: 13px; height: 13px; stroke: #94a7b5; stroke-width: 1.8;
          fill: none; stroke-linecap: round; stroke-linejoin: round; flex-shrink: 0;
        }
        .cal-preview-dur {
          margin-left: auto; font-size: 0.66rem; color: #94a7b5; font-weight: 500;
        }
        .cal-preview-type { text-transform: capitalize; }
        .cal-preview-type.private { color: #7c3aed; }
        .cal-preview-type.group { color: #059669; }
        .cal-preview-desc-row { align-items: flex-start; }
        .cal-preview-desc {
          font-size: 0.68rem; color: #5f7a8f; font-weight: 400;
          line-height: 1.4;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .cal-preview-foot {
          display: flex; align-items: center; justify-content: space-between;
          padding: 10px 16px 12px; margin-top: 8px;
          border-top: 1px solid #f0f3f6;
        }
        .cal-preview-badge {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 0.66rem; font-weight: 600; padding: 3px 10px;
          border-radius: 20px;
        }
        .cal-preview-upcoming { background: #eff6ff; color: #2563eb; }
        .cal-preview-live { background: #eff6ff; color: #2563eb; }
        .cal-preview-completed { background: #f0fdf4; color: #16a34a; }
        .cal-preview-canceled { background: #fef2f2; color: #dc2626; }
        .cal-preview-link {
          font-size: 0.68rem; font-weight: 600; color: #5f7a8f;
          text-decoration: underline; text-underline-offset: 2px;
          cursor: pointer;
        }
        .cal-preview-link:hover { color: #1a2e44; }

        .cal-portal-dropdown {
          position: fixed; z-index: 9999;
          min-width: 148px;
          background: #fff;
          border: 1px solid #edf1f5;
          border-radius: 9px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.09), 0 1px 3px rgba(0,0,0,0.05);
          padding: 4px;
          animation: ss-drop-in 0.13s ease-out both;
        }
        .cal-portal-item {
          display: flex; align-items: center;
          width: 100%; padding: 8px 10px;
          font-family: 'Poppins', sans-serif;
          font-size: 0.76rem; font-weight: 500; color: #3d5468;
          background: none; border: none; border-radius: 6px;
          cursor: pointer; transition: background 0.1s; text-align: left; white-space: nowrap;
        }
        .cal-portal-item:hover { background: #f5f8fa; color: #1a2e44; }
        .cal-portal-divider { height: 1px; background: #f0f4f8; margin: 3px 4px; }
        .cal-portal-danger { color: #dc2626 !important; }
        .cal-portal-danger:hover { background: #fef2f2 !important; color: #b91c1c !important; }

        /* Danger item in list dropdown */
        .ss-drop-danger { color: #dc2626; }
        .ss-drop-danger:hover { background: #fef2f2; color: #b91c1c; }
        .ss-drop-danger svg { stroke: currentColor; }

        /* ── Cancel-session modal ── */
        @keyframes cancel-modal-backdrop-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes cancel-modal-in {
          from { opacity: 0; transform: translateY(10px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .cancel-modal-backdrop {
          position: fixed; inset: 0; z-index: 10000;
          background: rgba(15, 25, 40, 0.35);
          backdrop-filter: blur(2px);
          display: flex; align-items: center; justify-content: center;
          animation: cancel-modal-backdrop-in 0.15s ease both;
        }
        .cancel-modal {
          background: #fff;
          border-radius: 16px;
          padding: 28px 28px 24px;
          width: 340px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.14), 0 4px 16px rgba(0,0,0,0.06);
          display: flex; flex-direction: column; align-items: center; gap: 12px;
          text-align: center;
          animation: cancel-modal-in 0.18s cubic-bezier(0.34,1.2,0.64,1) both;
        }
        .cancel-modal-icon {
          width: 44px; height: 44px; border-radius: 12px;
          background: #fef2f2;
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 2px;
        }
        .cancel-modal-icon svg {
          width: 20px; height: 20px;
          stroke: #dc2626; stroke-width: 2; fill: none;
          stroke-linecap: round;
        }
        .cancel-modal-title {
          font-family: 'Poppins', sans-serif;
          font-size: 1rem; font-weight: 700; color: #1a2e44;
          letter-spacing: -0.02em; line-height: 1;
        }
        .cancel-modal-body {
          font-size: 0.8rem; color: #5f7a8f; line-height: 1.55;
          max-width: 260px;
        }
        .cancel-modal-body strong { color: #1a2e44; font-weight: 600; }
        .cancel-modal-actions {
          display: flex; gap: 8px; width: 100%; margin-top: 4px;
        }
        .cancel-modal-keep {
          flex: 1; padding: 10px;
          font-family: 'Poppins', sans-serif;
          font-size: 0.82rem; font-weight: 500; color: #5f7a8f;
          background: #f5f7fa; border: none; border-radius: 9px;
          cursor: pointer; transition: background 0.13s;
        }
        .cancel-modal-keep:hover { background: #e9edf1; color: #1a2e44; }
        .cancel-modal-confirm {
          flex: 1; padding: 10px;
          font-family: 'Poppins', sans-serif;
          font-size: 0.82rem; font-weight: 600; color: #fff;
          background: #dc2626; border: none; border-radius: 9px;
          cursor: pointer; transition: background 0.13s;
        }
        .cancel-modal-confirm:hover { background: #b91c1c; }
      `}</style>

      {loading ? (
        <div className="ss-loading"><div className="ss-loading-ring"></div> Loading sessions&hellip;</div>
      ) : (
        <>
          {/* Header */}
          <div className="ss-header ss-anim-1">
            <div>
              <h2 className="ss-title">Sessions</h2>
              <p className="ss-subtitle">Manage and view all class sessions across students.</p>
            </div>
            <div className="ss-header-actions">
              <div className="ss-view-toggle">
                <button
                  className={`ss-view-btn${viewMode === 'list' ? ' active' : ''}`}
                  onClick={() => setViewMode('list')}
                  title="List view"
                >
                  <svg viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                </button>
                <button
                  className={`ss-view-btn${viewMode === 'calendar' ? ' active' : ''}`}
                  onClick={() => setViewMode('calendar')}
                  title="Calendar view"
                >
                  <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                </button>
              </div>
              <Link href="/admin/sessions/create" className="ss-btn-new" style={{ textDecoration: 'none' }}>
                <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                New Session
              </Link>
            </div>
          </div>

          {/* Stat cards with rings */}
          <div className={`ss-stats ss-anim-2${viewMode === 'calendar' ? ' ss-hidden' : ''}`}>
            {([
              { key: 's-total', label: 'Total Sessions', count: totalCount, max: totalCount },
              { key: 's-upcoming', label: 'Upcoming', count: upcomingCount, max: totalCount },
              { key: 's-completed', label: 'Completed', count: completedCount, max: totalCount },
              { key: 's-canceled', label: 'Cancelled', count: canceledCount, max: totalCount },
            ] as const).map(stat => {
              const r = 20;
              const circ = 2 * Math.PI * r;
              const pct = stat.max > 0 ? stat.count / stat.max : 0;
              const offset = circ * (1 - pct);
              return (
                <div className={`ss-stat ${stat.key}`} key={stat.key}>
                  <div className="ss-stat-ring">
                    <svg viewBox="0 0 48 48">
                      <circle className="ring-bg" cx="24" cy="24" r={r} />
                      <circle className="ring-fg" cx="24" cy="24" r={r}
                        strokeDasharray={circ}
                        strokeDashoffset={offset}
                      />
                    </svg>
                    <div className="ss-stat-ring-value">{stat.count}</div>
                  </div>
                  <div className="ss-stat-text">
                    <span className="ss-stat-label">{stat.label}</span>
                    <div className="ss-stat-value">{stat.count}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Unified filter bar: search + tabs + dropdowns (list mode only) */}
          {viewMode === 'list' && (
            <div className="ss-filter-bar ss-anim-3">
              <div className="ss-search-inline">
                <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input
                  type="text"
                  className="ss-search"
                  placeholder="Search sessions…"
                  value={searchTerm}
                  onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                />
              </div>
              <div className="ss-filter-divider" />
              <div className="ss-tabs">
                {(['all', 'today', 'upcoming', 'completed'] as const).map(t => (
                  <button
                    key={t}
                    className={`ss-tab ${statusFilter === t ? 'active' : ''}`}
                    onClick={() => { setStatusFilter(t); setCurrentPage(1); }}
                  >
                    {t === 'all' ? 'All Sessions' : t === 'today' ? 'Today' : t === 'upcoming' ? 'Upcoming' : 'Completed'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Current live session banner */}
          {viewMode === 'list' && currentSession && (() => {
            const cs = currentSession;
            const csDate = new Date(cs.date);
            const csEnd = new Date(csDate.getTime() + cs.duration * 60000);
            const csStartTime = csDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
            const csEndTime = csEnd.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
            return (
              <Link href={`/admin/sessions/${cs.id}`} className="ss-live-banner ss-anim-3" style={{ textDecoration: 'none' }}>
                <span className="ss-live-dot" />
                <span className="ss-live-title">{cs.title}</span>
                <span className="ss-live-sep" />
                <span className="ss-live-time">{csStartTime} – {csEndTime}</span>
                <span className="ss-live-student">{cs.studentName}</span>
                <span className="ss-live-action">Start Class<svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg></span>
              </Link>
            );
          })()}

          {/* Session list */}
          {viewMode === 'list' && (
            <div className="ss-anim-4">
              {sorted.length === 0 ? (
                <div className="ss-empty">
                  {searchTerm ? (
                    <>
                      <svg viewBox="0 0 48 48"><circle cx="20" cy="20" r="14"/><line x1="30" y1="30" x2="42" y2="42"/><line x1="14" y1="20" x2="26" y2="20"/></svg>
                      <div className="ss-empty-title">No sessions match your search</div>
                      <div className="ss-empty-hint">Try a different title or student name</div>
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 48 48"><rect x="8" y="10" width="32" height="28" rx="3"/><line x1="8" y1="18" x2="40" y2="18"/><line x1="16" y1="6" x2="16" y2="14"/><line x1="32" y1="6" x2="32" y2="14"/><line x1="18" y1="26" x2="30" y2="26"/><line x1="18" y1="32" x2="26" y2="32"/></svg>
                      <div className="ss-empty-title">No {statusFilter !== 'all' ? statusFilter + ' ' : ''}sessions found</div>
                      <div className="ss-empty-hint">{statusFilter !== 'all' ? 'Try selecting a different filter' : 'Sessions will appear once classes are scheduled'}</div>
                    </>
                  )}
                </div>
              ) : (
                <>
                  {showGrouped ? (
                    <>
                      {renderSection('Upcoming Sessions', upcomingGroup, 1)}
                      {renderSection('Completed Sessions', completedGroup, upcomingGroup.length + 1)}
                      {renderSection('Canceled Sessions', canceledGroup, upcomingGroup.length + completedGroup.length + 1)}
                    </>
                  ) : (
                    <table className="ss-table">
                      {renderTableHead()}
                      <tbody>
                        {pagedSessions.map((s, i) => renderRow(s, showFrom + i))}
                      </tbody>
                    </table>
                  )}

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="ss-pagination">
                      <span className="ss-pagination-info">
                        Showing {showFrom} to {showTo} of {sorted.length} sessions
                      </span>
                      <div className="ss-pagination-btns">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                          <button key={p} className={`ss-page-btn ${p === currentPage ? 'active' : ''}`} onClick={() => setCurrentPage(p)}>{p}</button>
                        ))}
                      </div>
                    </div>
                  )}

                  {showCanceledTrailing && (
                    <>
                      <div className="ss-section-label" style={{ marginTop: 32 }}>Canceled Sessions</div>
                      <table className="ss-table">
                        {renderTableHead()}
                        <tbody>
                          {canceledAll.map((s, i) => renderRow(s, i))}
                        </tbody>
                      </table>
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {/* Calendar view */}
          {viewMode === 'calendar' && (
            <div className="ss-anim-3" style={{ width: '100%' }}>
              <div className="cal-wrap">
                {/* Top bar — row 1: Today + nav arrows + date range + expand */}
                <div className="cal-topbar">
                  <div className="cal-topbar-row1">
                    <button className="cal-today-btn" onClick={() => setCalWeekOffset(0)}>Today</button>
                    <div className="cal-nav">
                      <button className="cal-nav-btn" onClick={() => setCalWeekOffset(o => o - 1)}>
                        <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
                      </button>
                      <button className="cal-nav-btn" onClick={() => setCalWeekOffset(o => o + 1)}>
                        <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
                      </button>
                    </div>
                    <div className="cal-date-badge">
                      <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                      {formatWeekRange(calWeek.monday, calWeek.sunday)}
                    </div>
                    <button
                      className="cal-expand-btn"
                      onClick={() => setCalExpanded(x => !x)}
                      title={calExpanded ? 'Exit full view' : 'Full view'}
                    >
                      {calExpanded ? (
                        <svg viewBox="0 0 24 24"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="10" y1="14" x2="3" y2="21"/><line x1="21" y1="3" x2="14" y2="10"/></svg>
                      ) : (
                        <svg viewBox="0 0 24 24"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
                      )}
                    </button>
                  </div>
                  {/* Row 2: filter tabs with counts */}
                  <div className="cal-topbar-row2">
                    <button className={`cal-filter-tab${calStatusFilter === 'all' ? ' active' : ''}`} onClick={() => setCalStatusFilter('all')}>
                      <svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                      All Sessions
                      <span className="cal-filter-count">({calAllCount})</span>
                    </button>
                    <button className={`cal-filter-tab${calStatusFilter === 'upcoming' ? ' active' : ''}`} onClick={() => setCalStatusFilter('upcoming')}>
                      <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      Upcoming
                      <span className="cal-filter-count">({calUpcomingCount})</span>
                    </button>
                    <button className={`cal-filter-tab${calStatusFilter === 'completed' ? ' active' : ''}`} onClick={() => setCalStatusFilter('completed')}>
                      <svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                      Completed
                      <span className="cal-filter-count">({calCompletedCount})</span>
                    </button>
                  </div>
                </div>

                {/* Pinned sessions strip (includes live session) */}
                {(() => {
                  const pinned = sessions.filter(s => pinnedIds.has(s.id) && s.id !== currentSession?.id);
                  if (!currentSession && pinned.length === 0) return null;
                  return (
                    <div className="cal-pinned-strip">
                      {currentSession && (() => {
                        const cs = currentSession;
                        const csDate = new Date(cs.date);
                        const csEnd = new Date(csDate.getTime() + cs.duration * 60000);
                        const csStartTime = csDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                        const csEndTime = csEnd.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                        return (
                          <div
                            key="live"
                            className="cal-pin-card cal-pin-live"
                            onClick={() => router.push(`/admin/sessions/${cs.id}`)}
                          >
                            <div className="cal-pin-body">
                              <div className="cal-pin-row1">
                                <span className="cal-pin-title">{cs.title}</span>
                              </div>
                              <span className="cal-pin-time">{csStartTime} - {csEndTime}</span>
                            </div>
                            <div className="cal-pin-footer" style={{ background: 'linear-gradient(170deg, #eff6ff 0%, #eff6ff90 50%, #eff6ff30 100%)', color: '#2563eb' }}>
                              <span className="cal-pin-status" style={{ color: '#2563eb' }}>
                                <span className="ss-live-dot" style={{ width: 6, height: 6 }} />
                                Live Now
                              </span>
                              <button className="cal-pin-action" onClick={e => { e.stopPropagation(); router.push(`/admin/sessions/${cs.id}`); }} style={{ color: '#2563eb' }}>
                                Start Class
                              </button>
                            </div>
                          </div>
                        );
                      })()}
                      {pinned.map((s, i) => {
                        const sd = new Date(s.date);
                        const startTime = sd.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                        const endD = new Date(sd.getTime() + s.duration * 60000);
                        const endTime = endD.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                        const isToday = sd.toDateString() === todayStr;
                        const isUpc = s.status === 'scheduled' && sd >= now;
                        const isDone = s.status === 'completed';
                        const palette = getCalCardStyle(s.studentName);
                        return (
                          <div
                            key={s.id}
                            className="cal-pin-card"
                            style={{ animationDelay: `${i * 0.05}s` }}
                            onClick={() => router.push(`/admin/sessions/${s.id}`)}
                          >
                            <div className="cal-pin-body">
                              <div className="cal-pin-row1">
                                <span className="cal-pin-title">{s.title}</span>
                                <button className="cal-pin-chevron" onClick={e => { e.stopPropagation(); togglePin(s.id); }}>
                                  <svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
                                </button>
                              </div>
                              <span className="cal-pin-time">{startTime} - {endTime}</span>
                            </div>
                            <div className="cal-pin-footer" style={{ background: `linear-gradient(170deg, ${palette.bg} 0%, ${palette.bg}90 50%, ${palette.bg}30 100%)`, color: palette.text }}>
                              <span className="cal-pin-status" style={{ color: palette.text }}>
                                {isUpc ? (
                                  <><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>{isToday ? 'Today' : sd.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</>
                                ) : isDone ? (
                                  <><svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>Completed</>
                                ) : (
                                  <><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>Scheduled</>
                                )}
                              </span>
                              <button className="cal-pin-action" onClick={e => { e.stopPropagation(); router.push(`/admin/sessions/${s.id}`); }}>
                                View Details
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* Calendar grid wrapper */}
                <div className="cal-scroll-outer">
                  {/* Day headers */}
                  <div className="cal-head">
                    <div className="cal-head-gutter" />
                    {calWeek.days.map((d, i) => (
                      <div key={i} className={`cal-day-head${d.toDateString() === todayStr ? ' today' : ''}`}>
                        <span className="cal-day-num">{d.getDate()}</span>
                        <span className="cal-day-name">{DAY_NAMES[i]}</span>
                      </div>
                    ))}
                  </div>

                  {/* Scrollable time grid */}
                  <div className="cal-body" ref={calBodyRef}>
                    <div className="cal-grid">
                      {/* Time labels */}
                      <div className="cal-times">
                        {Array.from({ length: CAL_END_HOUR - CAL_START_HOUR }, (_, i) => (
                          <div
                            key={i}
                            className="cal-time-row"
                            style={{ height: HOUR_HEIGHT, flexShrink: 0 }}
                          >
                            <span className="cal-time-label">
                              {String(CAL_START_HOUR + i).padStart(2, '0')}:00
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Day columns */}
                      {calWeek.days.map((day, di) => {
                        const dayStr = day.toDateString();
                        const isToday = dayStr === todayStr;
                        const daySessions = calFilteredSessions.filter(s => new Date(s.date).toDateString() === dayStr);
                        const totalRows = CAL_END_HOUR - CAL_START_HOUR;

                        function getMinsFromY(e: React.MouseEvent<HTMLDivElement>) {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const y = e.clientY - rect.top;
                          return Math.max(0, Math.min((CAL_END_HOUR - CAL_START_HOUR) * 60 - 15,
                            CAL_START_HOUR * 60 + (y / HOUR_HEIGHT) * 60));
                        }

                        return (
                          <div
                            key={di}
                            className={`cal-col${isToday ? ' today' : ''}`}
                            style={{ height: totalRows * HOUR_HEIGHT, cursor: 'crosshair' }}
                            onMouseMove={e => {
                              if ((e.target as HTMLElement).closest('.cal-session')) return;
                              const mins = getMinsFromY(e);
                              const slotTime = new Date(day);
                              slotTime.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
                              if (slotTime.getTime() <= Date.now()) { setCalHover(null); return; }
                              setCalHover({ di, minutes: mins });
                            }}
                            onMouseLeave={() => setCalHover(null)}
                            onClick={e => {
                              if ((e.target as HTMLElement).closest('.cal-session')) return;
                              const mins = getMinsFromY(e);
                              const slotTime = new Date(day);
                              slotTime.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
                              if (slotTime.getTime() <= Date.now()) return;
                              setCalNewTitle('');
                              setCalNewStudentId(students[0]?.id ?? '');
                              setCalNewDuration(60);
                              setCalNewError('');
                              setCalNewPopover({ day, minutes: mins, x: e.clientX, y: e.clientY });
                            }}
                          >
                            {/* Past-time overlay */}
                            {(() => {
                              const now = new Date();
                              const dayStart = new Date(day); dayStart.setHours(CAL_START_HOUR, 0, 0, 0);
                              const dayEnd = new Date(day); dayEnd.setHours(CAL_END_HOUR, 0, 0, 0);
                              if (now <= dayStart) return null;
                              const cutoff = now >= dayEnd ? dayEnd : now;
                              const pastMins = (cutoff.getHours() * 60 + cutoff.getMinutes()) - CAL_START_HOUR * 60;
                              const pastPx = (pastMins / 60) * HOUR_HEIGHT;
                              return <div className="cal-past-overlay" style={{ height: pastPx }} />;
                            })()}

                            {/* Hour separator lines */}
                            {Array.from({ length: totalRows }, (_, i) => (
                              <div key={i} className="cal-hour-line" style={{ top: i * HOUR_HEIGHT }} />
                            ))}

                            {/* Hover ghost — clipped at top of any overlapping session */}
                            {calHover?.di === di && (() => {
                              const ghostStartMins = snapMins(calHover.minutes);
                              const ghostEndMins = ghostStartMins + 60;
                              const firstOverlapStart = daySessions.reduce<number | null>((acc, s) => {
                                const sd2 = new Date(s.date);
                                const sStart = (sd2.getHours() - CAL_START_HOUR) * 60 + sd2.getMinutes();
                                const sEnd = sStart + s.duration;
                                if (sStart >= ghostEndMins || sEnd <= ghostStartMins) return acc;
                                if (sStart <= ghostStartMins) return acc;
                                return acc === null ? sStart : Math.min(acc, sStart);
                              }, null);
                              const clippedEnd = firstOverlapStart !== null ? Math.min(ghostEndMins, firstOverlapStart) : ghostEndMins;
                              const effectiveMins = clippedEnd - ghostStartMins;
                              if (effectiveMins < 30) return null;
                              const effectiveHeight = Math.max(0, (effectiveMins / 60) * HOUR_HEIGHT - 4);
                              return (
                                <div
                                  className="cal-ghost"
                                  style={{
                                    top: `${((ghostStartMins - CAL_START_HOUR * 60) / 60) * HOUR_HEIGHT}px`,
                                    height: `${effectiveHeight}px`,
                                  }}
                                >
                                  <span className="cal-ghost-time">
                                    {formatHHMM(ghostStartMins)}
                                  </span>
                                </div>
                              );
                            })()}

                            {/* Session cards — side-by-side columns for overlaps */}
                            {(() => {
                              const colMap = computeOverlapColumns(daySessions);
                              const PAD = 3;
                              const GAP = 2;

                              return daySessions.map(s => {
                                const sd = new Date(s.date);
                                const startMins = (sd.getHours() - CAL_START_HOUR) * 60 + sd.getMinutes();
                                const top = Math.max(0, (startMins / 60) * HOUR_HEIGHT);
                                const height = Math.max(28, (s.duration / 60) * HOUR_HEIGHT - 4);
                                const palette = getCalCardStyle(s.studentName);
                                const avatar = getAvatarStyle(s.studentName);
                                const startTime = sd.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                                const endTime = new Date(sd.getTime() + s.duration * 60000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

                                const { col, totalCols } = colMap.get(s.id) ?? { col: 0, totalCols: 1 };
                                const colWidth = `calc((100% - ${PAD * 2 + GAP * (totalCols - 1)}px) / ${totalCols})`;
                                const leftPos = `calc(${PAD}px + ${col} * (((100% - ${PAD * 2 + GAP * (totalCols - 1)}px) / ${totalCols}) + ${GAP}px))`;

                                return (
                                  <div
                                    key={s.id}
                                    className={`cal-session${height < 60 ? ' cal-session-sm' : ''}${s.status === 'canceled' ? ' cal-session-disabled' : ''}${s.status === 'completed' ? ' cal-session-done' : ''}`}
                                    style={{
                                      top: `${top}px`,
                                      height: `${height}px`,
                                      left: leftPos,
                                      width: colWidth,
                                      right: 'auto',
                                      zIndex: 2 + col,
                                      background: s.status === 'canceled'
                                        ? 'transparent'
                                        : s.status === 'completed'
                                          ? `linear-gradient(180deg, ${palette.bg}66 0%, ${palette.bg}33 100%)`
                                          : `linear-gradient(180deg, ${palette.bg} 0%, ${palette.bg}88 40%, ${palette.bg}22 85%, ${palette.bg}00 100%)`,
                                      color: palette.text,
                                    }}
                                    onClick={() => router.push(`/admin/sessions/${s.id}`)}
                                    onMouseEnter={e => {
                                      if (calPreviewTimer.current) clearTimeout(calPreviewTimer.current);
                                      const el = e.currentTarget as HTMLElement;
                                      calPreviewTimer.current = setTimeout(() => {
                                        const rect = el.getBoundingClientRect();
                                        const previewW = 260;
                                        const previewH = 220;
                                        const nearRight = rect.right + previewW + 16 > window.innerWidth;
                                        const nearBottom = rect.top + previewH > window.innerHeight;
                                        const left = nearRight ? rect.left - previewW - 8 : rect.right + 8;
                                        const top = nearBottom ? Math.max(8, rect.bottom - previewH) : rect.top;
                                        setCalPreview({ id: s.id, top, left });
                                      }, 400);
                                    }}
                                    onMouseLeave={() => {
                                      if (calPreviewTimer.current) { clearTimeout(calPreviewTimer.current); calPreviewTimer.current = null; }
                                      setCalPreview(null);
                                    }}
                                  >
                                    {height >= 40 && <div className={`cal-session-title${height >= 72 ? ' clamp2' : ''}`}>{s.title}</div>}
                                    {height >= 28 && <div className="cal-session-time">{startTime} - {endTime}</div>}
                                    {height >= 72 && (
                                      <div className="cal-session-footer">
                                        <div className="cal-session-avatar" style={{ background: avatar.bg, color: avatar.text }}>
                                          {getInitials(s.studentName)}
                                        </div>
                                        <span className="cal-session-student">{s.studentName}</span>
                                      </div>
                                    )}
                                    <button
                                      className="cal-session-menu-btn"
                                      onClick={e => {
                                        e.stopPropagation();
                                        if (calOpenMenu?.id === s.id) { setCalOpenMenu(null); return; }
                                        const rect = (e.currentTarget as HTMLButtonElement).closest('.cal-session')!.getBoundingClientRect();
                                        setCalOpenMenu({ id: s.id, top: rect.top, left: rect.right + 6 });
                                      }}
                                    >···</button>
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* New-session popover — portal to escape overflow:hidden */}
          {calNewPopover && typeof document !== 'undefined' && createPortal(
            (() => {
              const snapped = snapMins(calNewPopover.minutes);
              const endMins = snapped + calNewDuration;
              const dateLabel = calNewPopover.day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
              // Position: to the right of click, flip left if near right edge
              const popW = 280;
              const viewW = typeof window !== 'undefined' ? window.innerWidth : 1200;
              const left = calNewPopover.x + 12 + popW > viewW ? calNewPopover.x - popW - 12 : calNewPopover.x + 12;
              const top = Math.min(calNewPopover.y - 16, (typeof window !== 'undefined' ? window.innerHeight : 800) - 360);
              return (
                <div
                  className="cal-new-popover"
                  style={{ top: Math.max(8, top), left }}
                  onMouseDown={e => e.stopPropagation()}
                >
                  <div className="cal-new-pop-header">
                    <div className="cal-new-pop-datetime">
                      <span className="cal-new-pop-date">{dateLabel}</span>
                      <span className="cal-new-pop-time">{formatHHMM(snapped)} – {formatHHMM(endMins)}</span>
                    </div>
                    <button className="cal-new-pop-close" onClick={() => setCalNewPopover(null)}>
                      <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>

                  <input
                    className="cal-new-pop-title"
                    placeholder="Session title"
                    value={calNewTitle}
                    onChange={e => setCalNewTitle(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleCalNewSave(); }}
                    autoFocus
                  />

                  <select
                    className="cal-new-pop-select"
                    value={calNewStudentId}
                    onChange={e => setCalNewStudentId(e.target.value)}
                  >
                    <option value="">Select student…</option>
                    {students.map(st => (
                      <option key={st.id} value={st.id}>{st.firstName} {st.lastName}</option>
                    ))}
                  </select>

                  <div className="cal-new-pop-dur-row">
                    {[30, 45, 60, 90].map(d => (
                      <button
                        key={d}
                        className={`cal-new-pop-dur${calNewDuration === d ? ' active' : ''}`}
                        onClick={() => setCalNewDuration(d)}
                      >{d}m</button>
                    ))}
                  </div>

                  {calNewError && (
                    <div className="cal-new-pop-error">
                      <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      {calNewError}
                    </div>
                  )}

                  <div className="cal-new-pop-actions">
                    <button className="cal-new-pop-cancel" onClick={() => setCalNewPopover(null)}>Cancel</button>
                    <button
                      className="cal-new-pop-save"
                      onClick={handleCalNewSave}
                      disabled={calNewSaving || !calNewTitle.trim() || !calNewStudentId}
                    >
                      {calNewSaving ? 'Saving…' : 'Create'}
                    </button>
                  </div>
                </div>
              );
            })(),
            document.body
          )}

          {/* Session hover preview */}
          {calPreview && typeof document !== 'undefined' && (() => {
            const ps = sessions.find(s => s.id === calPreview.id);
            if (!ps) return null;
            const psd = new Date(ps.date);
            const psEnd = new Date(psd.getTime() + ps.duration * 60000);
            const psStart = psd.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
            const psEndT = psEnd.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
            const psDay = psd.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
            const psAvatar = getAvatarStyle(ps.studentName);
            const psIsLive = ps.status === 'scheduled' && tick >= psd.getTime() && tick < psEnd.getTime();
            return createPortal(
              <div
                className="cal-preview"
                style={{ top: calPreview.top, left: calPreview.left }}
                onMouseEnter={() => { if (calPreviewTimer.current) { clearTimeout(calPreviewTimer.current); calPreviewTimer.current = null; } }}
                onMouseLeave={() => setCalPreview(null)}
              >
                <div className="cal-preview-head">
                  <div className="cal-preview-avatar" style={{ background: psAvatar.bg, color: psAvatar.text }}>{getInitials(ps.studentName)}</div>
                  <div className="cal-preview-headinfo">
                    <div className="cal-preview-title">{ps.title}</div>
                    <div className="cal-preview-student">{ps.studentName}</div>
                  </div>
                </div>
                <div className="cal-preview-rows">
                  <div className="cal-preview-row">
                    <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    <span>{psStart} – {psEndT}</span>
                    <span className="cal-preview-dur">{ps.duration} min</span>
                  </div>
                  <div className="cal-preview-row">
                    <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    <span>{psDay}</span>
                  </div>
                  <div className="cal-preview-row">
                    <svg viewBox="0 0 24 24"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                    <span className={`cal-preview-type ${ps.studentType}`}>{ps.studentType}</span>
                  </div>
                  {ps.description && (
                    <div className="cal-preview-row cal-preview-desc-row">
                      <svg viewBox="0 0 24 24"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg>
                      <span className="cal-preview-desc">{ps.description}</span>
                    </div>
                  )}
                </div>
                <div className="cal-preview-foot">
                  {psIsLive ? (
                    <span className="cal-preview-badge cal-preview-live"><span className="ss-live-dot" style={{ width: 5, height: 5 }} /> Live Now</span>
                  ) : ps.status === 'completed' ? (
                    <span className="cal-preview-badge cal-preview-completed">Completed</span>
                  ) : ps.status === 'canceled' ? (
                    <span className="cal-preview-badge cal-preview-canceled">Canceled</span>
                  ) : (
                    <span className="cal-preview-badge cal-preview-upcoming">Upcoming</span>
                  )}
                  <span className="cal-preview-link">View Details</span>
                </div>
              </div>,
              document.body
            );
          })()}

          {/* Calendar portal dropdown — rendered at body level to escape overflow:hidden */}
          {calOpenMenu && typeof document !== 'undefined' && createPortal(
            <div
              className="cal-portal-dropdown"
              style={{ top: calOpenMenu.top, left: calOpenMenu.left }}
              onMouseDown={e => e.stopPropagation()}
            >
              {sessions.find(s => s.id === calOpenMenu.id) && (() => {
                const s = sessions.find(s => s.id === calOpenMenu.id)!;
                return (
                  <>
                    <button className="cal-portal-item" onClick={() => { setCalOpenMenu(null); router.push(`/admin/sessions/${s.id}`); }}>
                      View Details
                    </button>
                    <button className="cal-portal-item" onClick={() => { setCalOpenMenu(null); router.push(`/admin/student/${s.studentId}`); }}>
                      View Student
                    </button>
                    <div className="cal-portal-divider" />
                    <button className="cal-portal-item" onClick={() => { togglePin(s.id); setCalOpenMenu(null); }}>
                      {pinnedIds.has(s.id) ? 'Unpin Session' : 'Pin Session'}
                    </button>
                    <button className="cal-portal-item" onClick={() => { navigator.clipboard.writeText(s.id); setCalOpenMenu(null); }}>
                      Copy ID
                    </button>
                    {s.status === 'scheduled' && (
                      <>
                        <div className="cal-portal-divider" />
                        <button className="cal-portal-item cal-portal-danger" onClick={() => { setCalOpenMenu(null); setConfirmCancel(s.id); }}>
                          Cancel Session
                        </button>
                      </>
                    )}
                  </>
                );
              })()}
            </div>,
            document.body
          )}

          {/* List-view row menu portal */}
          {openMenu && typeof document !== 'undefined' && createPortal(
            <div
              className="ss-dropdown"
              style={{ position: 'fixed', top: openMenu.top, left: openMenu.left, zIndex: 9999 }}
              onMouseDown={e => e.stopPropagation()}
            >
              {(() => {
                const s = sessions.find(x => x.id === openMenu.id);
                if (!s) return null;
                return (
                  <>
                    <button className="ss-drop-item" onClick={() => { setOpenMenu(null); router.push(`/admin/sessions/${s.id}`); }}>
                      <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      View Details
                    </button>
                    <button className="ss-drop-item" onClick={() => { setOpenMenu(null); router.push(`/admin/student/${s.studentId}`); }}>
                      <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                      View Student
                    </button>
                    <div className="ss-drop-divider" />
                    <button className="ss-drop-item" onClick={() => { navigator.clipboard.writeText(s.id); setOpenMenu(null); }}>
                      <svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                      Copy Session ID
                    </button>
                    {s.status === 'scheduled' && (
                      <>
                        <div className="ss-drop-divider" />
                        <button className="ss-drop-item ss-drop-danger" onClick={() => { setOpenMenu(null); setConfirmCancel(s.id); }}>
                          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                          Cancel Session
                        </button>
                      </>
                    )}
                  </>
                );
              })()}
            </div>,
            document.body
          )}

          {/* Cancel-session modal */}
          {confirmCancel && typeof document !== 'undefined' && createPortal(
            <div className="cancel-modal-backdrop" onMouseDown={() => setConfirmCancel(null)}>
              <div className="cancel-modal" onMouseDown={e => e.stopPropagation()}>
                <div className="cancel-modal-icon">
                  <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                </div>
                <div className="cancel-modal-title">Cancel Session</div>
                <div className="cancel-modal-body">
                  {(() => { const s = sessions.find(x => x.id === confirmCancel); return s ? <><strong>{s.title}</strong> with {s.studentName}</> : 'This session'; })()}
                  {' '}will be marked as canceled. This can&apos;t be undone.
                </div>
                <div className="cancel-modal-actions">
                  <button className="cancel-modal-keep" onClick={() => setConfirmCancel(null)}>Keep Session</button>
                  <button className="cancel-modal-confirm" onClick={() => cancelSession(confirmCancel)}>Cancel Session</button>
                </div>
              </div>
            </div>,
            document.body
          )}
        </>
      )}
    </>
  );
}
