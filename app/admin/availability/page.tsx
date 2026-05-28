'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useAdmin } from '../admin-context';

interface AvailabilitySlot {
  date: string;
  start: string;
  end: string;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}
function formatDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function formatDisplayDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}
function formatTime12(time: string) {
  const [h, m] = time.split(':').map(Number);
  const hour = h % 12 === 0 ? 12 : h % 12;
  const ampm = h < 12 ? 'AM' : 'PM';
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

function getDateRange(a: Date, b: Date): Date[] {
  const [from, to] = a <= b ? [a, b] : [b, a];
  const dates: Date[] = [];
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  const toTime = to.getTime();
  while (cursor.getTime() <= toTime) {
    dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

/* Timeline helpers */
const TL_START = 6;
const TL_END = 22;
function getTimePercent(time: string) {
  const [h, m] = time.split(':').map(Number);
  const mins = h * 60 + m;
  return Math.max(0, Math.min(100, ((mins - TL_START * 60) / ((TL_END - TL_START) * 60)) * 100));
}

const PRESETS = [
  { id: 'morning', label: 'Morning', desc: '8:00 AM \u2013 12:00 PM', start: '08:00', end: '12:00' },
  { id: 'afternoon', label: 'Afternoon', desc: '12:00 PM \u2013 5:00 PM', start: '12:00', end: '17:00' },
  { id: 'evening', label: 'Evening', desc: '5:00 PM \u2013 9:00 PM', start: '17:00', end: '21:00' },
  { id: 'fullday', label: 'Full Day', desc: '8:00 AM \u2013 9:00 PM', start: '08:00', end: '21:00' },
];

const TL_HOURS = [6, 9, 12, 15, 18, 21];

export default function AvailabilityPage() {
  const { token, logout } = useAdmin();
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  // Selection: supports single date or contiguous range
  const [selectedDays, setSelectedDays] = useState<Date[]>([]);

  // Drag state for range selection
  const [drag, setDrag] = useState<{ anchor: Date; end: Date } | null>(null);
  const dragRef = useRef(drag);
  dragRef.current = drag;

  const [addStart, setAddStart] = useState('09:00');
  const [addEnd, setAddEnd] = useState('17:00');
  const [saving, setSaving] = useState(false);
  const [savingPreset, setSavingPreset] = useState<string | null>(null);
  const [showCustom, setShowCustom] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<AvailabilitySlot | null>(null);
  const [deleting, setDeleting] = useState(false);

  const showToast = useCallback((msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const loadSlots = useCallback(async () => {
    try {
      const res = await fetch('/api/availability', { headers: { Authorization: 'Bearer ' + token } });
      if (res.status === 401) { logout(); return; }
      if (res.ok) setSlots(await res.json());
    } catch { showToast('Failed to load availability', 'err'); }
    setLoading(false);
  }, [token, logout, showToast]);

  useEffect(() => {
    if (!token) return;
    loadSlots();
  }, [token, loadSlots]);

  // Escape key: cancel drag, clear selection, or dismiss modal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (dragRef.current) { setDrag(null); return; }
      if (confirmDelete) { setConfirmDelete(null); return; }
      if (selectedDays.length > 0) setSelectedDays([]);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [confirmDelete, selectedDays.length]);

  // End drag on global mouseup
  useEffect(() => {
    if (!drag) return;
    const handler = () => {
      const d = dragRef.current;
      if (!d) return;
      const range = getDateRange(d.anchor, d.end).filter(dt => dt >= today);
      setSelectedDays(range.length > 0 ? range : []);
      setDrag(null);
    };
    document.addEventListener('mouseup', handler);
    return () => document.removeEventListener('mouseup', handler);
  }, [drag, today]);

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }
  function goToToday() {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
  }

  const isCurrentMonthView = viewYear === today.getFullYear() && viewMonth === today.getMonth();

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(viewYear, viewMonth, d));

  // Derived selection values
  const isSingleSelect = selectedDays.length === 1;
  const isMultiSelect = selectedDays.length > 1;
  const selectedDayKey = isSingleSelect ? formatDateKey(selectedDays[0]) : '';

  const selectedDaysSet = useMemo(() => {
    return new Set(selectedDays.map(d => formatDateKey(d)));
  }, [selectedDays]);

  // Drag preview range
  const dragRange = useMemo(() => {
    if (!drag) return new Set<string>();
    const range = getDateRange(drag.anchor, drag.end);
    return new Set(range.filter(d => d >= today).map(d => formatDateKey(d)));
  }, [drag, today]);

  const dragEndpoints = useMemo(() => {
    if (!drag) return new Set<string>();
    return new Set([formatDateKey(drag.anchor), formatDateKey(drag.end)]);
  }, [drag]);

  const selectedDaySlots = useMemo(() => {
    if (!isSingleSelect) return [];
    return slots.filter(s => s.date === selectedDayKey).sort((a, b) => a.start.localeCompare(b.start));
  }, [slots, selectedDayKey, isSingleSelect]);

  const availDates = useMemo(() => {
    const set = new Set<string>();
    slots.forEach(s => set.add(s.date));
    return set;
  }, [slots]);

  const slotCountByDate = useMemo(() => {
    const map = new Map<string, number>();
    slots.forEach(s => map.set(s.date, (map.get(s.date) || 0) + 1));
    return map;
  }, [slots]);

  const presetStates = useMemo(() => {
    const states: Record<string, 'available' | 'active' | 'overlap'> = {};
    if (!isSingleSelect) {
      for (const p of PRESETS) states[p.id] = 'available';
      return states;
    }
    for (const p of PRESETS) {
      const exact = selectedDaySlots.some(s => s.start === p.start && s.end === p.end);
      if (exact) { states[p.id] = 'active'; continue; }
      const pS = parseInt(p.start.split(':')[0]) * 60 + parseInt(p.start.split(':')[1]);
      const pE = parseInt(p.end.split(':')[0]) * 60 + parseInt(p.end.split(':')[1]);
      const overlap = selectedDaySlots.some(s => {
        const sS = parseInt(s.start.split(':')[0]) * 60 + parseInt(s.start.split(':')[1]);
        const sE = parseInt(s.end.split(':')[0]) * 60 + parseInt(s.end.split(':')[1]);
        return pS < sE && pE > sS;
      });
      states[p.id] = overlap ? 'overlap' : 'available';
    }
    return states;
  }, [selectedDaySlots, isSingleSelect]);

  // ── Drag handlers ──
  function handleCellMouseDown(cell: Date, e: React.MouseEvent) {
    if (cell < today) return;
    e.preventDefault();
    setDrag({ anchor: cell, end: cell });
  }

  function handleCellMouseEnter(cell: Date) {
    if (!dragRef.current) return;
    setDrag(prev => prev ? { ...prev, end: cell } : null);
  }

  // ── Add handlers ──
  async function handlePresetAdd(preset: typeof PRESETS[0]) {
    if (selectedDays.length === 0) return;
    if (isSingleSelect && presetStates[preset.id] !== 'available') return;

    setSavingPreset(preset.id);

    if (isMultiSelect) {
      let ok = 0, fail = 0;
      await Promise.all(selectedDays.map(async day => {
        try {
          const res = await fetch('/api/availability', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
            body: JSON.stringify({ date: formatDateKey(day), start: preset.start, end: preset.end }),
          });
          if (res.status === 401) { logout(); return; }
          if (res.ok) ok++; else fail++;
        } catch { fail++; }
      }));
      if (ok > 0 && fail === 0) showToast(`${preset.label} added to ${ok} ${ok === 1 ? 'day' : 'days'}`);
      else if (ok > 0) showToast(`Added to ${ok}/${ok + fail} days (${fail} skipped)`, 'err');
      else showToast('Failed to add availability', 'err');
      await loadSlots();
      setSavingPreset(null);
      return;
    }

    // Single day
    try {
      const res = await fetch('/api/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ date: selectedDayKey, start: preset.start, end: preset.end }),
      });
      if (res.status === 401) { logout(); return; }
      const data = await res.json();
      if (!res.ok) showToast(data.error || 'Failed to add', 'err');
      else { showToast(`${preset.label} slot added`); await loadSlots(); }
    } catch { showToast('Network error', 'err'); }
    setSavingPreset(null);
  }

  async function handleAdd() {
    if (selectedDays.length === 0) return;
    setSaving(true);

    if (isMultiSelect) {
      let ok = 0, fail = 0;
      await Promise.all(selectedDays.map(async day => {
        try {
          const res = await fetch('/api/availability', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
            body: JSON.stringify({ date: formatDateKey(day), start: addStart, end: addEnd }),
          });
          if (res.status === 401) { logout(); return; }
          if (res.ok) ok++; else fail++;
        } catch { fail++; }
      }));
      if (ok > 0 && fail === 0) showToast(`Added to ${ok} ${ok === 1 ? 'day' : 'days'}`);
      else if (ok > 0) showToast(`Added to ${ok}/${ok + fail} days (${fail} skipped)`, 'err');
      else showToast('Failed to add availability', 'err');
      await loadSlots();
      setAddStart('09:00'); setAddEnd('17:00'); setShowCustom(false);
      setSaving(false);
      return;
    }

    // Single day
    try {
      const res = await fetch('/api/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ date: selectedDayKey, start: addStart, end: addEnd }),
      });
      if (res.status === 401) { logout(); return; }
      const data = await res.json();
      if (!res.ok) showToast(data.error || 'Failed to add', 'err');
      else { showToast('Availability added'); await loadSlots(); setAddStart('09:00'); setAddEnd('17:00'); setShowCustom(false); }
    } catch { showToast('Network error', 'err'); }
    setSaving(false);
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/availability', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(confirmDelete),
      });
      if (res.status === 401) { logout(); return; }
      if (res.ok) { showToast('Availability removed'); await loadSlots(); }
      else { const data = await res.json(); showToast(data.error || 'Failed to delete', 'err'); }
    } catch { showToast('Network error', 'err'); }
    setDeleting(false);
    setConfirmDelete(null);
  }

  const upcomingGrouped = useMemo(() => {
    const todayKey = formatDateKey(today);
    const future = slots.filter(s => s.date >= todayKey).sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.start.localeCompare(b.start);
    });
    const grouped: { date: string; items: AvailabilitySlot[] }[] = [];
    for (const s of future) {
      const last = grouped[grouped.length - 1];
      if (last && last.date === s.date) last.items.push(s);
      else grouped.push({ date: s.date, items: [s] });
    }
    return grouped;
  }, [slots, today]);

  // ── Selection endpoint keys for visual highlighting ──
  const selectionEndpointKeys = useMemo(() => {
    if (selectedDays.length < 2) return new Set<string>();
    return new Set([
      formatDateKey(selectedDays[0]),
      formatDateKey(selectedDays[selectedDays.length - 1]),
    ]);
  }, [selectedDays]);

  return (
    <>
      <div className="av-page">
        {/* ── Header ── */}
        <div className="av-header">
          <div className="av-header-left">
            <h1 className="av-title">Availability</h1>
            <p className="av-subtitle">Set your teaching hours for student bookings</p>
          </div>
          <div className="av-stats-row">
            <div className="av-stat-pill">
              <span className="av-stat-num">{upcomingGrouped.length}</span>
              <span className="av-stat-lbl">days open</span>
            </div>
            <div className="av-stat-pill">
              <span className="av-stat-num">{slots.filter(s => s.date >= formatDateKey(today)).length}</span>
              <span className="av-stat-lbl">time slots</span>
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="av-body">
          {/* Calendar Column */}
          <div className="av-cal-col">
            <div className="av-cal-card">
              <div className="av-cal-nav">
                <button className="av-nav-arrow" onClick={prevMonth} disabled={isCurrentMonthView} aria-label="Previous month">
                  <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6" /></svg>
                </button>
                <div className="av-cal-center">
                  <span className="av-cal-month-label">{MONTH_NAMES[viewMonth]} {viewYear}</span>
                  {!isCurrentMonthView && (
                    <button className="av-today-link" onClick={goToToday}>Back to today</button>
                  )}
                </div>
                <button className="av-nav-arrow" onClick={nextMonth} aria-label="Next month">
                  <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6" /></svg>
                </button>
              </div>

              <div className="av-weekdays">
                {DAY_LABELS.map(d => <div key={d} className="av-wd">{d}</div>)}
              </div>

              <div className={`av-grid${drag ? ' is-dragging' : ''}`}>
                {cells.map((cell, idx) => {
                  if (!cell) return <div key={`e-${idx}`} className="av-cell empty" />;
                  const isPast = cell < today;
                  const isToday = sameDay(cell, today);
                  const dateKey = formatDateKey(cell);
                  const hasAvail = availDates.has(dateKey);
                  const count = slotCountByDate.get(dateKey) || 0;

                  // Drag preview
                  const isDragging = drag !== null;
                  const isInDragRange = isDragging && dragRange.has(dateKey) && !isPast;
                  const isDragEndpoint = isDragging && dragEndpoints.has(dateKey) && dragRange.has(dateKey) && !isPast;

                  // Finalized selection
                  const isSelected = !isDragging && selectedDaysSet.has(dateKey);
                  const isEndpoint = isSelected && (selectionEndpointKeys.has(dateKey) || selectedDays.length === 1);
                  const isInRange = isSelected && !isEndpoint && isMultiSelect;

                  return (
                    <div
                      key={cell.toISOString()}
                      className={[
                        'av-cell',
                        isPast ? 'past' : 'future',
                        isToday ? 'is-today' : '',
                        isEndpoint ? 'selected' : '',
                        isInRange ? 'in-range' : '',
                        isInDragRange && !isDragEndpoint ? 'in-drag-range' : '',
                        isDragEndpoint ? 'drag-endpoint' : '',
                        hasAvail && !isPast ? 'has-avail' : '',
                      ].filter(Boolean).join(' ')}
                      onMouseDown={e => handleCellMouseDown(cell, e)}
                      onMouseEnter={() => handleCellMouseEnter(cell)}
                      role={!isPast ? 'button' : undefined}
                      tabIndex={!isPast ? 0 : undefined}
                      onKeyDown={e => {
                        if (isPast || e.key !== 'Enter') return;
                        setSelectedDays([cell]);
                        setDrag(null);
                      }}
                    >
                      <span className="av-cell-num">{cell.getDate()}</span>
                      {hasAvail && !isPast && count > 0 && (
                        <span className="av-cell-dots">
                          {Array.from({ length: Math.min(count, 3) }).map((_, i) => (
                            <span key={i} className="av-dot" />
                          ))}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Drag hint */}
              <div className="av-cal-hint">
                <svg viewBox="0 0 24 24"><path d="M5 9l2-2m0 0l2 2M7 7v10M19 15l-2 2m0 0l-2-2m2 2V7" /></svg>
                Drag across dates to select a range
              </div>
            </div>

          </div>

          {/* ── Detail Panel ── */}
          <div className="av-panel-col">

            {/* ── Single date panel ── */}
            {isSingleSelect && (
              <div className="av-panel" key={selectedDayKey}>
                <div className="av-panel-top">
                  <div className="av-panel-date-block">
                    <span className="av-panel-big-num">{selectedDays[0].getDate()}</span>
                    <div className="av-panel-date-info">
                      <span className="av-panel-weekday">
                        {selectedDays[0].toLocaleDateString('en-US', { weekday: 'long' })}
                      </span>
                      <span className="av-panel-monthyr">
                        {selectedDays[0].toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="av-panel-body">
                  {selectedDaySlots.length > 0 && (
                    <div className="av-slots-block">
                      <div className="av-label">Current time slots</div>
                      {selectedDaySlots.length > 0 && (
                        <div className="av-tl">
                          <div className="av-tl-track">
                            {TL_HOURS.map(h => (
                              <div key={h} className="av-tl-tick" style={{ left: `${getTimePercent(`${String(h).padStart(2, '0')}:00`)}%` }}>
                                <span className="av-tl-label">{h > 12 ? h - 12 : h}{h < 12 ? 'a' : 'p'}</span>
                              </div>
                            ))}
                            {selectedDaySlots.map((s, i) => {
                              const left = getTimePercent(s.start);
                              const width = getTimePercent(s.end) - left;
                              return (
                                <div key={i} className="av-tl-bar" style={{ left: `${left}%`, width: `${Math.max(width, 2)}%` }} />
                              );
                            })}
                          </div>
                        </div>
                      )}
                      <div className="av-slots-list">
                        {selectedDaySlots.map((s, i) => (
                          <div key={i} className="av-slot-item" style={{ animationDelay: `${i * 40}ms` }}>
                            <div className="av-slot-times">
                              <span>{formatTime12(s.start)}</span>
                              <span className="av-slot-dash">&ndash;</span>
                              <span>{formatTime12(s.end)}</span>
                            </div>
                            <button className="av-slot-del" onClick={() => setConfirmDelete(s)} title="Remove slot">
                              <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="av-add-block">
                    <div className="av-label">Add availability</div>
                    <div className="av-presets">
                      {PRESETS.map(p => {
                        const state = presetStates[p.id] || 'available';
                        return (
                          <button
                            key={p.id}
                            className={`av-preset ${state}`}
                            onClick={() => handlePresetAdd(p)}
                            disabled={savingPreset !== null || state !== 'available'}
                          >
                            <div className="av-preset-text">
                              <span className="av-preset-name">{p.label}</span>
                              <span className="av-preset-range">{p.desc}</span>
                            </div>
                            {savingPreset === p.id && <span className="av-mini-spin" />}
                            {state === 'active' && (
                              <span className="av-preset-check"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg></span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {!showCustom ? (
                      <button className="av-custom-toggle" onClick={() => setShowCustom(true)}>
                        <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                        Custom hours
                      </button>
                    ) : (
                      <div className="av-custom">
                        <div className="av-custom-fields">
                          <div className="av-custom-field">
                            <label>From</label>
                            <input type="time" value={addStart} onChange={e => setAddStart(e.target.value)} />
                          </div>
                          <div className="av-custom-arrow-icon">
                            <svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                          </div>
                          <div className="av-custom-field">
                            <label>To</label>
                            <input type="time" value={addEnd} onChange={e => setAddEnd(e.target.value)} />
                          </div>
                        </div>
                        <div className="av-custom-actions">
                          <button className="av-custom-cancel" onClick={() => setShowCustom(false)}>Cancel</button>
                          <button className="av-custom-submit" onClick={handleAdd} disabled={saving || !addStart || !addEnd || addStart >= addEnd}>
                            {saving ? <><span className="av-mini-spin" /> Adding...</> : 'Add time slot'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── Multi-date panel ── */}
            {isMultiSelect && (
              <div className="av-panel av-multi" key={`multi-${selectedDays.length}-${formatDateKey(selectedDays[0])}`}>
                <div className="av-panel-top av-multi-top">
                  <div className="av-multi-head">
                    <div className="av-multi-badge">
                      <span className="av-multi-count">{selectedDays.length}</span>
                    </div>
                    <div className="av-multi-info">
                      <span className="av-multi-title">{selectedDays.length} dates selected</span>
                      <span className="av-multi-range">
                        {selectedDays[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        {' \u2013 '}
                        {selectedDays[selectedDays.length - 1].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                    <button className="av-multi-clear" onClick={() => setSelectedDays([])} title="Clear selection">
                      <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    </button>
                  </div>

                  {/* Date pills */}
                  <div className="av-multi-dates">
                    {selectedDays.map(d => {
                      const dk = formatDateKey(d);
                      const hasSlots = availDates.has(dk);
                      return (
                        <span key={dk} className={`av-multi-pill${hasSlots ? ' has-slots' : ''}`}>
                          {d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })}
                          {hasSlots && <span className="av-multi-pill-dot" />}
                        </span>
                      );
                    })}
                  </div>
                </div>

                <div className="av-panel-body">
                  <div className="av-add-block">
                    <div className="av-label">Add availability to all {selectedDays.length} dates</div>

                    <div className="av-presets">
                      {PRESETS.map(p => (
                        <button
                          key={p.id}
                          className="av-preset available"
                          onClick={() => handlePresetAdd(p)}
                          disabled={savingPreset !== null}
                        >
                          <div className="av-preset-text">
                            <span className="av-preset-name">{p.label}</span>
                            <span className="av-preset-range">{p.desc}</span>
                          </div>
                          {savingPreset === p.id && <span className="av-mini-spin" />}
                        </button>
                      ))}
                    </div>

                    {!showCustom ? (
                      <button className="av-custom-toggle" onClick={() => setShowCustom(true)}>
                        <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                        Custom hours
                      </button>
                    ) : (
                      <div className="av-custom">
                        <div className="av-custom-fields">
                          <div className="av-custom-field">
                            <label>From</label>
                            <input type="time" value={addStart} onChange={e => setAddStart(e.target.value)} />
                          </div>
                          <div className="av-custom-arrow-icon">
                            <svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                          </div>
                          <div className="av-custom-field">
                            <label>To</label>
                            <input type="time" value={addEnd} onChange={e => setAddEnd(e.target.value)} />
                          </div>
                        </div>
                        <div className="av-custom-actions">
                          <button className="av-custom-cancel" onClick={() => setShowCustom(false)}>Cancel</button>
                          <button className="av-custom-submit" onClick={handleAdd} disabled={saving || !addStart || !addEnd || addStart >= addEnd}>
                            {saving ? <><span className="av-mini-spin" /> Adding...</> : `Add to ${selectedDays.length} dates`}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── Empty panel ── */}
            {selectedDays.length === 0 && !drag && (
              <div className="av-empty-panel">
                <svg className="av-empty-icon" viewBox="0 0 24 24">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <h3>Select a date</h3>
                <p>Click or drag across dates to manage availability</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="av-overlay" onClick={() => !deleting && setConfirmDelete(null)}>
          <div className="av-modal" onClick={e => e.stopPropagation()}>
            <div className="av-modal-icon-wrap">
              <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
            </div>
            <h3>Remove this time slot?</h3>
            <p className="av-modal-detail">
              {formatDisplayDate(confirmDelete.date)}<br />
              {formatTime12(confirmDelete.start)} {'\u2013'} {formatTime12(confirmDelete.end)}
            </p>
            <div className="av-modal-actions">
              <button className="av-modal-cancel" onClick={() => setConfirmDelete(null)} disabled={deleting}>Cancel</button>
              <button className="av-modal-remove" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`av-toast ${toast.type}`}>{toast.msg}</div>}

      <style jsx global>{`
        /* ═══════════════════════════════════════════
           Availability Page — Minimal Admin
           ═══════════════════════════════════════════ */

        .av-page { width: 100%; }

        /* ── Header ── */
        .av-header {
          display: flex; align-items: flex-end; justify-content: space-between;
          margin-bottom: 28px; gap: 16px; flex-wrap: wrap;
        }
        .av-title {
          font-size: 1.3rem; font-weight: 700; color: var(--text);
          margin-bottom: 2px; letter-spacing: -0.02em;
        }
        .av-subtitle { font-size: 0.78rem; color: var(--muted); font-weight: 400; }
        .av-stats-row { display: flex; gap: 8px; }
        .av-stat-pill {
          display: flex; align-items: center; gap: 6px;
          background: var(--accent-soft); border: 1px solid rgba(45, 181, 192, 0.15);
          border-radius: 8px; padding: 6px 14px;
        }
        .av-stat-num { font-size: 0.88rem; font-weight: 700; color: var(--accent-hover); font-variant-numeric: tabular-nums; }
        .av-stat-lbl { font-size: 0.68rem; color: var(--muted); font-weight: 500; }

        /* ── Body ── */
        .av-body { display: flex; gap: 20px; align-items: flex-start; }

        /* ── Calendar Column ── */
        .av-cal-col {
          width: 380px; min-width: 380px;
          display: flex; flex-direction: column; gap: 12px;
        }
        .av-cal-card {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: 14px; padding: 22px;
        }

        /* Calendar Nav */
        .av-cal-nav {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 18px;
        }
        .av-cal-center { text-align: center; flex: 1; }
        .av-cal-month-label { font-size: 0.9rem; font-weight: 600; color: var(--text); display: block; }
        .av-today-link {
          font-size: 0.64rem; font-weight: 500; color: var(--accent);
          background: none; border: none; cursor: pointer; padding: 0;
          font-family: 'Poppins', sans-serif; margin-top: 2px; transition: color 0.12s;
        }
        .av-today-link:hover { color: var(--accent-hover); text-decoration: underline; }
        .av-nav-arrow {
          width: 32px; height: 32px; border: 1px solid var(--border); border-radius: 8px;
          background: var(--surface); cursor: pointer; display: flex;
          align-items: center; justify-content: center; color: var(--muted); transition: all 0.15s;
        }
        .av-nav-arrow:hover:not(:disabled) { background: var(--subtle); color: var(--text); border-color: transparent; }
        .av-nav-arrow:disabled { opacity: 0.3; cursor: not-allowed; }
        .av-nav-arrow svg { width: 15px; height: 15px; stroke: currentColor; stroke-width: 2; fill: none; }

        /* Weekdays */
        .av-weekdays { display: grid; grid-template-columns: repeat(7, 1fr); margin-bottom: 4px; }
        .av-wd {
          text-align: center; font-size: 0.62rem; font-weight: 600;
          color: var(--muted); padding: 5px 0; letter-spacing: 0.06em; text-transform: uppercase;
          opacity: 0.7;
        }

        /* Grid */
        .av-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; }
        .av-grid.is-dragging { user-select: none; -webkit-user-select: none; cursor: pointer; }
        .av-cell {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; aspect-ratio: 1;
          border-radius: 10px; font-size: 0.82rem; font-weight: 400;
          color: var(--muted); cursor: default; position: relative;
          transition: background 0.12s, color 0.12s, transform 0.12s;
          user-select: none; gap: 1px;
        }
        .av-cell.empty { pointer-events: none; }
        .av-cell.future { color: var(--text); cursor: pointer; font-weight: 500; }
        .av-cell.future:hover { background: var(--subtle); }
        .av-cell.past { color: #cdd7e0; }
        .av-cell.is-today { font-weight: 700; color: var(--accent); }
        .av-cell.is-today::after {
          content: ''; position: absolute; bottom: 3px;
          width: 4px; height: 4px; border-radius: 50%;
          background: var(--accent);
        }
        .av-cell.has-avail { background: var(--accent-soft); }
        .av-cell.has-avail:hover { background: rgba(45, 181, 192, 0.16); }

        /* Selected endpoints */
        .av-cell.selected {
          background: var(--accent) !important; color: #fff !important; font-weight: 600;
          transform: scale(1.04);
        }
        .av-cell.selected::after { display: none; }
        .av-cell.selected:hover { background: var(--accent-hover) !important; }

        /* In-range */
        .av-cell.in-range {
          background: var(--accent-soft) !important;
          color: var(--accent-hover) !important;
          font-weight: 600; border-radius: 6px;
        }
        .av-cell.in-range::after { display: none; }
        .av-cell.in-range:hover { background: rgba(45, 181, 192, 0.18) !important; }

        /* Drag preview: endpoints */
        .av-cell.drag-endpoint {
          background: var(--accent) !important; color: #fff !important;
          font-weight: 600; opacity: 0.8; transform: scale(1.02);
        }
        .av-cell.drag-endpoint::after { display: none; }

        /* Drag preview: range */
        .av-cell.in-drag-range {
          background: rgba(45, 181, 192, 0.1) !important;
          color: var(--accent-hover) !important;
          font-weight: 500; border-radius: 6px;
        }
        .av-cell.in-drag-range::after { display: none; }

        /* Dots */
        .av-cell-dots { display: flex; gap: 2px; height: 4px; align-items: center; }
        .av-dot { width: 3px; height: 3px; border-radius: 50%; background: var(--accent); }
        .av-cell.selected .av-dot,
        .av-cell.drag-endpoint .av-dot { background: rgba(255,255,255,0.7); }
        .av-cell.in-range .av-dot,
        .av-cell.in-drag-range .av-dot { background: var(--accent); }
        .av-cell-num { line-height: 1; position: relative; z-index: 1; }

        /* Calendar hint */
        .av-cal-hint {
          display: flex; align-items: center; gap: 6px;
          margin-top: 12px; padding-top: 10px;
          border-top: 1px solid var(--border);
          font-size: 0.64rem; color: var(--muted); font-weight: 400; opacity: 0.7;
        }
        .av-cal-hint svg {
          width: 13px; height: 13px; stroke: var(--muted);
          stroke-width: 1.8; fill: none; flex-shrink: 0; opacity: 0.5;
        }

        /* ── Detail Panel ── */
        .av-panel-col { flex: 1; min-width: 0; }
        .av-panel {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: 14px; overflow: hidden;
          animation: av-panel-enter 0.2s ease;
        }
        @keyframes av-panel-enter {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* Panel top */
        .av-panel-top {
          padding: 20px 24px 16px; border-bottom: 1px solid var(--border);
          background: var(--surface);
        }
        .av-panel-date-block { display: flex; align-items: center; gap: 14px; }
        .av-panel-big-num {
          font-size: 2.2rem; font-weight: 800; color: var(--accent);
          line-height: 1; letter-spacing: -0.03em; min-width: 44px; text-align: center;
        }
        .av-panel-date-info { display: flex; flex-direction: column; }
        .av-panel-weekday { font-size: 0.92rem; font-weight: 600; color: var(--text); line-height: 1.2; }
        .av-panel-monthyr { font-size: 0.74rem; color: var(--muted); font-weight: 400; margin-top: 1px; }

        /* Timeline */
        .av-tl { margin-bottom: 14px; }
        .av-tl-track {
          position: relative; height: 24px;
          background: var(--subtle); border-radius: 6px;
        }
        .av-tl-tick { position: absolute; top: 0; bottom: 0; width: 1px; background: rgba(0,0,0,0.04); }
        .av-tl-label {
          position: absolute; top: calc(100% + 3px); left: 50%;
          transform: translateX(-50%); font-size: 0.54rem;
          color: var(--muted); white-space: nowrap; font-variant-numeric: tabular-nums; opacity: 0.6;
        }
        .av-tl-bar {
          position: absolute; top: 3px; bottom: 3px;
          background: var(--accent); border-radius: 4px; opacity: 0.6;
        }

        /* Panel body */
        .av-panel-body { padding: 20px 24px 24px; }
        .av-label {
          font-size: 0.66rem; font-weight: 600; color: var(--muted);
          text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 10px;
        }

        /* Slots list */
        .av-slots-block { margin-bottom: 20px; }
        .av-slots-list { display: flex; flex-direction: column; gap: 4px; margin-top: 8px; }
        .av-slot-item {
          display: flex; align-items: center; gap: 10px;
          padding: 9px 12px; border-radius: 8px;
          background: var(--accent-soft); border: 1px solid rgba(45, 181, 192, 0.12);
          transition: all 0.12s; animation: av-slot-in 0.2s ease both;
        }
        @keyframes av-slot-in {
          from { opacity: 0; transform: translateX(-6px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .av-slot-times {
          display: flex; align-items: center; gap: 6px;
          font-size: 0.82rem; font-weight: 500; color: var(--accent-hover); flex: 1;
        }
        .av-slot-dash { color: var(--muted); opacity: 0.4; font-weight: 300; }
        .av-slot-del {
          background: none; border: none; cursor: pointer;
          padding: 4px; color: var(--muted); border-radius: 5px;
          transition: all 0.12s; display: flex; align-items: center; opacity: 0;
        }
        .av-slot-item:hover .av-slot-del { opacity: 1; }
        .av-slot-del:hover { color: #ef4444; background: #fef2f2; }
        .av-slot-del svg { width: 13px; height: 13px; stroke: currentColor; stroke-width: 2; fill: none; }

        /* ── Add Section ── */
        .av-add-block {}
        .av-presets { display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px; }
        .av-preset {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 14px; border-radius: 8px;
          border: 1px solid var(--border);
          background: var(--surface);
          cursor: pointer; transition: all 0.12s ease;
          font-family: 'Poppins', sans-serif; text-align: left;
          position: relative;
        }
        .av-preset:hover:not(:disabled) {
          border-color: var(--accent);
          background: var(--accent-soft);
        }
        .av-preset:active:not(:disabled) { transform: scale(0.99); }
        .av-preset:disabled { cursor: default; }

        .av-preset.active { opacity: 0.5; border-style: dashed; }
        .av-preset.overlap { opacity: 0.3; }

        .av-preset-text { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
        .av-preset-name { font-size: 0.8rem; font-weight: 600; color: var(--text); }
        .av-preset-range { font-size: 0.7rem; color: var(--muted); white-space: nowrap; }
        .av-preset-check {
          width: 18px; height: 18px; border-radius: 50%;
          background: var(--accent); display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .av-preset-check svg { width: 11px; height: 11px; stroke: #fff; stroke-width: 3; fill: none; }

        /* Custom time */
        .av-custom-toggle {
          display: flex; align-items: center; gap: 7px; width: 100%;
          padding: 9px 14px; border: 1px dashed var(--border);
          border-radius: 8px; background: none; cursor: pointer;
          font-family: 'Poppins', sans-serif; font-size: 0.78rem;
          font-weight: 500; color: var(--muted); transition: all 0.12s;
        }
        .av-custom-toggle:hover { border-color: var(--accent); color: var(--accent); background: rgba(45,181,192,0.03); }
        .av-custom-toggle svg { width: 14px; height: 14px; stroke: currentColor; stroke-width: 2; fill: none; }

        .av-custom {
          border: 1px solid var(--border); border-radius: 10px;
          padding: 14px; background: var(--subtle); animation: av-custom-in 0.15s ease;
        }
        @keyframes av-custom-in { from { opacity: 0; } to { opacity: 1; } }
        .av-custom-fields { display: flex; align-items: flex-end; gap: 8px; margin-bottom: 12px; }
        .av-custom-field { display: flex; flex-direction: column; gap: 3px; flex: 1; }
        .av-custom-field label { font-size: 0.64rem; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
        .av-custom-field input {
          border: 1px solid var(--border); border-radius: 7px;
          padding: 8px 10px; font-size: 0.82rem;
          font-family: 'Poppins', sans-serif; color: var(--text);
          background: #fff; outline: none; width: 100%;
          transition: border-color 0.12s;
        }
        .av-custom-field input:focus { border-color: var(--accent); }
        .av-custom-arrow-icon { padding-bottom: 10px; color: var(--muted); flex-shrink: 0; opacity: 0.4; }
        .av-custom-arrow-icon svg { width: 14px; height: 14px; stroke: currentColor; stroke-width: 2; fill: none; }
        .av-custom-actions { display: flex; gap: 6px; justify-content: flex-end; }
        .av-custom-cancel {
          padding: 7px 14px; border: 1px solid var(--border); border-radius: 7px;
          background: #fff; color: var(--muted); font-size: 0.76rem;
          font-weight: 500; font-family: 'Poppins', sans-serif; cursor: pointer; transition: all 0.12s;
        }
        .av-custom-cancel:hover { background: var(--subtle); color: var(--text); }
        .av-custom-submit {
          display: flex; align-items: center; gap: 5px;
          padding: 7px 16px; border: none; border-radius: 7px;
          background: var(--accent); color: #fff; font-size: 0.76rem;
          font-weight: 600; font-family: 'Poppins', sans-serif; cursor: pointer; transition: all 0.12s;
        }
        .av-custom-submit:hover:not(:disabled) { background: var(--accent-hover); }
        .av-custom-submit:disabled { opacity: 0.4; cursor: not-allowed; }

        /* ── Multi-date panel ── */
        .av-multi-top { padding: 18px 24px 14px; }
        .av-multi-head {
          display: flex; align-items: center; gap: 12px;
        }
        .av-multi-badge {
          width: 40px; height: 40px; border-radius: 10px;
          background: var(--accent);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .av-multi-count {
          font-size: 1.1rem; font-weight: 800; color: #fff; line-height: 1;
        }
        .av-multi-info { flex: 1; min-width: 0; }
        .av-multi-title { font-size: 0.88rem; font-weight: 600; color: var(--text); display: block; }
        .av-multi-range { font-size: 0.72rem; color: var(--muted); display: block; margin-top: 1px; }
        .av-multi-clear {
          width: 30px; height: 30px; border-radius: 7px;
          border: 1px solid var(--border); background: var(--surface);
          cursor: pointer; display: flex; align-items: center;
          justify-content: center; color: var(--muted);
          transition: all 0.12s; flex-shrink: 0;
        }
        .av-multi-clear:hover { color: #ef4444; background: #fef2f2; border-color: #fecaca; }
        .av-multi-clear svg { width: 13px; height: 13px; stroke: currentColor; stroke-width: 2; fill: none; }

        .av-multi-dates {
          display: flex; flex-wrap: wrap; gap: 4px; margin-top: 12px;
        }
        .av-multi-pill {
          display: inline-flex; align-items: center; gap: 3px;
          padding: 2px 8px; border-radius: 5px;
          background: var(--subtle); border: 1px solid var(--border);
          font-size: 0.66rem; font-weight: 500; color: var(--text);
        }
        .av-multi-pill.has-slots { border-color: rgba(45, 181, 192, 0.2); background: var(--accent-soft); }
        .av-multi-pill-dot {
          width: 4px; height: 4px; border-radius: 50%; background: var(--accent);
        }

        /* ── Empty Panel ── */
        .av-empty-panel {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; text-align: center;
          padding: 60px 28px;
          background: var(--surface); border: 1px solid var(--border);
          border-radius: 14px;
        }
        .av-empty-icon {
          width: 36px; height: 36px; stroke: var(--border); stroke-width: 1.5; fill: none;
          margin-bottom: 16px;
        }
        .av-empty-panel h3 { font-size: 0.92rem; font-weight: 600; color: var(--text); margin-bottom: 4px; }
        .av-empty-panel p { font-size: 0.78rem; color: var(--muted); max-width: 240px; line-height: 1.5; }

        /* ── Modal ── */
        .av-overlay {
          position: fixed; inset: 0; z-index: 1000;
          background: rgba(0,0,0,0.25); backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center;
          animation: av-fade 0.12s ease;
        }
        @keyframes av-fade { from { opacity: 0; } to { opacity: 1; } }
        .av-modal {
          background: #fff; border-radius: 14px; padding: 28px;
          max-width: 360px; width: 100%; text-align: center;
          box-shadow: 0 16px 48px rgba(0,0,0,0.1); animation: av-modal-in 0.2s ease;
        }
        @keyframes av-modal-in { from { transform: scale(0.97) translateY(6px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }
        .av-modal-icon-wrap {
          width: 44px; height: 44px; border-radius: 50%;
          background: #fef2f2; display: flex; align-items: center;
          justify-content: center; margin: 0 auto 14px;
        }
        .av-modal-icon-wrap svg { width: 20px; height: 20px; stroke: #ef4444; stroke-width: 1.8; fill: none; }
        .av-modal h3 { font-size: 0.94rem; font-weight: 600; color: var(--text); margin-bottom: 6px; }
        .av-modal-detail { font-size: 0.78rem; color: var(--muted); line-height: 1.5; margin-bottom: 20px; }
        .av-modal-actions { display: flex; gap: 8px; justify-content: center; }
        .av-modal-cancel {
          padding: 8px 20px; border: 1px solid var(--border); border-radius: 8px;
          background: #fff; color: var(--text); font-size: 0.78rem; font-weight: 500;
          font-family: 'Poppins', sans-serif; cursor: pointer; transition: all 0.12s;
        }
        .av-modal-cancel:hover { background: var(--subtle); }
        .av-modal-cancel:disabled { opacity: 0.5; cursor: not-allowed; }
        .av-modal-remove {
          padding: 8px 20px; border: none; border-radius: 8px;
          background: #ef4444; color: #fff; font-size: 0.78rem; font-weight: 600;
          font-family: 'Poppins', sans-serif; cursor: pointer; transition: all 0.12s;
        }
        .av-modal-remove:hover { background: #dc2626; }
        .av-modal-remove:disabled { opacity: 0.6; cursor: not-allowed; }

        /* ── Toast ── */
        .av-toast {
          position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
          padding: 10px 20px; border-radius: 8px; font-size: 0.78rem;
          font-weight: 500; z-index: 2000; animation: av-toast-in 0.25s ease;
        }
        .av-toast.ok { background: var(--accent-hover); color: #fff; }
        .av-toast.err { background: #b91c1c; color: #fff; }
        @keyframes av-toast-in { from { transform: translate(-50%, 12px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }

        /* ── Spinners ── */
        .av-mini-spin {
          display: inline-block; width: 13px; height: 13px;
          border: 2px solid rgba(255,255,255,0.3); border-top-color: currentColor;
          border-radius: 50%; animation: av-spin 0.6s linear infinite; flex-shrink: 0;
        }
        .av-preset .av-mini-spin { border-color: rgba(0,0,0,0.08); border-top-color: var(--accent); }
        @keyframes av-spin { to { transform: rotate(360deg); } }

        /* ── Responsive ── */
        @media (max-width: 768px) {
          .av-body { flex-direction: column; }
          .av-cal-col { width: 100%; min-width: unset; }
          .av-header { flex-direction: column; gap: 10px; align-items: flex-start; }
          .av-panel-top { padding: 16px 18px 14px; }
          .av-multi-top { padding: 14px 18px 12px; }
          .av-panel-body { padding: 16px 18px 20px; }
          .av-panel-big-num { font-size: 1.8rem; }
        }
        @media (max-width: 480px) {
          .av-stats-row { flex-direction: column; gap: 4px; }
        }
      `}</style>
    </>
  );
}
