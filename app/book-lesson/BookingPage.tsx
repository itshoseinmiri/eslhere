'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import './book-lesson.css';

// ─── Types ──────────────────────────────────────────────────────────────────

interface BlockedSlot { start: string; duration: number; }
interface AvailabilitySlot { date: string; start: string; end: string; }
interface SelectedSession { day: Date; slot: Date; }

interface BookingForm {
  name: string; email: string; phone: string;
  topic: string; notes: string; duration: number;
}

type Step = 'package' | 'select' | 'form' | 'checkout' | 'success' | 'fail';

const TOPICS = [
  'Speaking Practice', 'Grammar Review', 'Vocabulary Building',
  'Pronunciation', 'IELTS Preparation', 'Business English',
  'Writing Workshop', 'Listening Comprehension', 'Conversation & Discussion', 'Other',
];
const DURATIONS = [30, 60];
const SLOT_INTERVAL = 30;

const PACKAGES = [
  { size: 1, price: 800000, perSession: 800000, title: 'Single Session', desc: 'Try a lesson and see if it\u2019s the right fit for you', badge: '' },
  { size: 5, price: 3700000, perSession: 740000, title: '5 Sessions', desc: 'Build consistent progress with regular weekly practice', badge: 'Most Popular' },
  { size: 10, price: 7000000, perSession: 700000, title: '10 Sessions', desc: 'Commit to fluency with dedicated, ongoing training', badge: 'Best Value' },
];

// ─── Card helpers ──────────────────────────────────────────────────────────

function fmtPrice(n: number) {
  return n.toLocaleString('en-US');
}
function generateRef() {
  return 'ESL-' + Date.now().toString(36).toUpperCase().slice(-6) + Math.random().toString(36).slice(2, 5).toUpperCase();
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDayOfMonth(y: number, m: number) { return new Date(y, m, 1).getDay(); }
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function fmt12(h: number, m: number) {
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}
function fmtDate(d: Date) {
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}
function fmtShort(d: Date) {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
function formatDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getAvailForDay(date: Date, avail: AvailabilitySlot[]) {
  const k = formatDateKey(date);
  return avail.filter(a => a.date === k);
}
function dayHasAvail(date: Date, avail: AvailabilitySlot[]) {
  return getAvailForDay(date, avail).length > 0;
}
function getSlotsForDay(date: Date, dayAvail: AvailabilitySlot[]): Date[] {
  const slots: Date[] = [];
  for (const a of dayAvail) {
    const [sH, sM] = a.start.split(':').map(Number);
    const [eH, eM] = a.end.split(':').map(Number);
    for (let m = sH * 60 + sM; m < eH * 60 + eM; m += SLOT_INTERVAL) {
      const s = new Date(date);
      s.setHours(Math.floor(m / 60), m % 60, 0, 0);
      slots.push(s);
    }
  }
  return slots;
}
function slotExceedsAvail(s: Date, dur: number, dayAvail: AvailabilitySlot[]) {
  const end = s.getTime() + dur * 60_000;
  return !dayAvail.some(a => {
    const ws = new Date(s); ws.setHours(...a.start.split(':').map(Number) as [number, number], 0, 0);
    const we = new Date(s); we.setHours(...a.end.split(':').map(Number) as [number, number], 0, 0);
    return s.getTime() >= ws.getTime() && end <= we.getTime();
  });
}
function isSlotBlocked(s: Date, dur: number, blocked: BlockedSlot[]) {
  const ns = s.getTime(), ne = ns + dur * 60_000;
  return blocked.some(b => {
    const bs = new Date(b.start).getTime();
    return ns < bs + b.duration * 60_000 && ne > bs;
  });
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function BookingPage() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [step, setStep] = useState<Step>('package');
  const [packageSize, setPackageSize] = useState(5);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [selectedSessions, setSelectedSessions] = useState<SelectedSession[]>([]);
  const [blocked, setBlocked] = useState<BlockedSlot[]>([]);
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [loadingBlocked, setLoadingBlocked] = useState(true);
  const [form, setForm] = useState<BookingForm>({
    name: '', email: '', phone: '', topic: '', notes: '', duration: 60,
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [bookingRef, setBookingRef] = useState('');

  const currentPkg = PACKAGES.find(p => p.size === packageSize) || PACKAGES[0];

  const fetchBlocked = useCallback(async () => {
    setLoadingBlocked(true);
    try {
      const res = await fetch('/api/booking');
      if (res.ok) {
        const data = await res.json();
        setBlocked(data.blocked || []);
        setAvailability(data.availability || []);
      }
    } finally { setLoadingBlocked(false); }
  }, []);

  useEffect(() => { fetchBlocked(); }, [fetchBlocked]);

  // Calendar
  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const DAY_LABELS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }
  function goToToday() { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()); }

  const isCurrentMonthView = viewYear === today.getFullYear() && viewMonth === today.getMonth();
  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(viewYear, viewMonth, d));

  const dayAvail = selectedDay ? getAvailForDay(selectedDay, availability) : [];
  const daySlots = selectedDay ? getSlotsForDay(selectedDay, dayAvail) : [];

  // Selected session keys for quick lookup
  const selectedSlotKeys = useMemo(() => {
    return new Set(selectedSessions.map(s => s.slot.getTime()));
  }, [selectedSessions]);

  const selectedDateKeys = useMemo(() => {
    return new Set(selectedSessions.map(s => formatDateKey(s.day)));
  }, [selectedSessions]);

  const sessionsOnSelectedDay = useMemo(() => {
    if (!selectedDay) return 0;
    const key = formatDateKey(selectedDay);
    return selectedSessions.filter(s => formatDateKey(s.day) === key).length;
  }, [selectedDay, selectedSessions]);

  const isFull = selectedSessions.length >= packageSize;

  function toggleSlot(slot: Date) {
    const key = slot.getTime();
    if (selectedSlotKeys.has(key)) {
      setSelectedSessions(prev => prev.filter(s => s.slot.getTime() !== key));
    } else if (!isFull && selectedDay) {
      setSelectedSessions(prev => [...prev, { day: new Date(selectedDay), slot }]);
    }
  }

  function removeSession(idx: number) {
    setSelectedSessions(prev => prev.filter((_, i) => i !== idx));
  }

  function selectPackage(size: number) {
    setPackageSize(size);
    setSelectedSessions([]);
    setSelectedDay(null);
    setStep('select');
  }

  async function handlePayNow() {
    if (selectedSessions.length === 0) return;
    setSubmitting(true);
    setSubmitError('');

    try {
      const res = await fetch('/api/booking/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name, email: form.email, phone: form.phone || undefined,
          topic: form.topic, notes: form.notes || undefined,
          sessions: selectedSessions.map(s => ({
            date: s.slot.toISOString(),
            duration: form.duration,
          })),
          amount: currentPkg.price,
          packageSize,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.paymentUrl) {
          window.location.href = data.paymentUrl;
          return;
        }
      }
      const data = await res.json().catch(() => ({}));
      setSubmitError(data.error || 'Could not initiate payment. Please try again.');
    } catch {
      setSubmitError('Network error. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function resetFlow() {
    setStep('package');
    setSelectedDay(null);
    setSelectedSessions([]);
    setForm({ name: '', email: '', phone: '', topic: '', notes: '', duration: 60 });
    setSubmitError('');
    setBookingRef('');
    fetchBlocked();
  }

  return (
    <div className="bk-page">
      <div className="bk-shell">

        {/* ═══ PACKAGE SELECTION ═══ */}
        {step === 'package' && (
          <div className="bk-pkg-view">
            {/* Decorative background shapes */}
            <div className="bk-pkg-bg-orb bk-pkg-bg-orb--1" />
            <div className="bk-pkg-bg-orb bk-pkg-bg-orb--2" />

            {/* Header — same as homepage */}
            <header className="bk-header">
              <div className="bk-header-inner">
                <Link href="/">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/images/logo.webp" alt="ESL Here" />
                </Link>
                <span className="bk-header-tagline">English as a Second Language</span>
                <Link href="/" className="bk-header-home-btn">Home</Link>
              </div>
            </header>

            <div className="bk-pkg-content">
              {/* Teacher hero */}
              <div className="bk-pkg-hero">
                <div className="bk-pkg-hero-photo">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="https://media.licdn.com/dms/image/v2/D4E03AQEcqLWKYx6Xqg/profile-displayphoto-crop_800_800/B4EZsTpXe0GoAI-/0/1765561171295?e=1781136000&v=beta&t=ywWNGDr4RcJF_XppKSQuQmASzybBgkBjgrN8SyfeOkY" alt="Mahdieh Fahimpour" />
                  <div className="bk-pkg-hero-status">
                    <span className="bk-pkg-hero-dot" />
                    Available
                  </div>
                </div>
                <div className="bk-pkg-hero-text">
                  <span className="bk-pkg-hero-label">Your Tutor</span>
                  <h2 className="bk-pkg-hero-name">Mahdieh Fahimpour</h2>
                  <p className="bk-pkg-hero-role">English Language Tutor</p>
                  <div className="bk-pkg-hero-tags">
                    <span className="bk-pkg-hero-tag">
                      <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                      30 or 60 min
                    </span>
                    <span className="bk-pkg-hero-tag">
                      <svg viewBox="0 0 24 24"><path d="M15 10l-4 4l6 6l4-16l-18 7l4 2l2 6l3-4" /></svg>
                      Online
                    </span>
                    <span className="bk-pkg-hero-tag">
                      <svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                      Personalized
                    </span>
                  </div>
                </div>
              </div>

              {/* Section heading */}
              <div className="bk-pkg-section-head">
                <h1 className="bk-pkg-title">Choose Your Package</h1>
                <p className="bk-pkg-sub">Select the plan that fits your learning goals</p>
              </div>

              {/* Package cards */}
              <div className="bk-pkg-grid">
                {PACKAGES.map((pkg, i) => (
                  <button
                    key={pkg.size}
                    className={`bk-pkg-card${pkg.badge === 'Most Popular' ? ' popular' : ''}${pkg.badge === 'Best Value' ? ' value' : ''}`}
                    onClick={() => selectPackage(pkg.size)}
                    style={{ animationDelay: `${i * 100 + 200}ms` }}
                  >
                    {pkg.badge && <span className="bk-pkg-badge">{pkg.badge}</span>}
                    <div className="bk-pkg-card-top">
                      <span className="bk-pkg-num">{pkg.size}</span>
                      <span className="bk-pkg-sessions">{pkg.size === 1 ? 'session' : 'sessions'}</span>
                    </div>
                    <div className="bk-pkg-pricing">
                      <span className="bk-pkg-price">{fmtPrice(pkg.price)} T</span>
                      {pkg.size > 1 && <span className="bk-pkg-per">{fmtPrice(pkg.perSession)} T/session</span>}
                    </div>
                    <span className="bk-pkg-title-label">{pkg.title}</span>
                    <span className="bk-pkg-desc">{pkg.desc}</span>
                    <span className="bk-pkg-cta">
                      Get Started
                      <svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══ DATE & TIME SELECTION ═══ */}
        {step === 'select' && (
          <div className="bk-select-view">
            {/* Left info column */}
            <div className="bk-side">
              <Link href="/" className="bk-logo">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/logo.webp" alt="ESL Here" />
              </Link>

              <div className="bk-side-title">English Tutoring</div>

              <div className="bk-side-pkg" onClick={() => { setStep('package'); setSelectedSessions([]); }}>
                <span className="bk-side-pkg-num">{packageSize}</span>
                <div className="bk-side-pkg-info">
                  <span className="bk-side-pkg-label">{packageSize === 1 ? 'Session' : 'Sessions'} Package</span>
                  <span className="bk-side-pkg-change">Change</span>
                </div>
              </div>

              <div className="bk-side-host">
                <img className="bk-host-avatar" src="https://media.licdn.com/dms/image/v2/D4E03AQEcqLWKYx6Xqg/profile-displayphoto-crop_800_800/B4EZsTpXe0GoAI-/0/1765561171295?e=1781136000&v=beta&t=ywWNGDr4RcJF_XppKSQuQmASzybBgkBjgrN8SyfeOkY" alt="Mahdieh Fahimpour" />
                <span className="bk-host-name">Mahdieh Fahimpour</span>
              </div>

              <div className="bk-side-meta">
                <div className="bk-meta-row">
                  <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                  <span>{form.duration} min per session</span>
                </div>
                <div className="bk-meta-row">
                  <svg viewBox="0 0 24 24"><path d="M15 10l-4 4l6 6l4-16l-18 7l4 2l2 6l3-4" /></svg>
                  <span>Online via video call</span>
                </div>
              </div>

              <div className="bk-side-desc">
                Personalized lesson plan, speaking practice, and progress review.
              </div>
            </div>

            {/* Main area */}
            <div className="bk-main">
              {loadingBlocked ? (
                <div className="bk-loading">
                  <div className="bk-loading-spin" />
                  <span>Loading availability...</span>
                </div>
              ) : (
                <>
                  <div className="bk-main-header">
                    <h2 className="bk-main-title">
                      {packageSize === 1 ? 'Pick your date & time' : `Pick ${packageSize} dates & times`}
                    </h2>
                    <span className="bk-main-progress">
                      {selectedSessions.length} / {packageSize}
                    </span>
                  </div>

                  <div className="bk-content-row">
                    {/* Left: Calendar + Time slots */}
                    <div className="bk-cal-side">
                      <div className="bk-cal-card">
                        <div className="bk-cal-nav">
                          <span className="bk-cal-month">{MONTH_NAMES[viewMonth]} {viewYear}</span>
                          <div className="bk-cal-btns">
                            {!isCurrentMonthView && (
                              <button className="bk-cal-today" onClick={goToToday}>Today</button>
                            )}
                            <button className="bk-cal-arrow" onClick={prevMonth} disabled={isCurrentMonthView} aria-label="Previous month">
                              <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6" /></svg>
                            </button>
                            <button className="bk-cal-arrow" onClick={nextMonth} aria-label="Next month">
                              <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6" /></svg>
                            </button>
                          </div>
                        </div>

                        <div className="bk-cal-weekdays">
                          {DAY_LABELS.map(d => <div key={d} className="bk-cal-wd">{d}</div>)}
                        </div>

                        <div className="bk-cal-grid">
                          {cells.map((cell, idx) => {
                            if (!cell) return <div key={`e-${idx}`} className="bk-cal-day" />;
                            const isPast = cell < today;
                            const hasAv = !isPast && dayHasAvail(cell, availability);
                            const isToday = sameDay(cell, today);
                            const isSel = selectedDay && sameDay(cell, selectedDay);
                            const hasSession = selectedDateKeys.has(formatDateKey(cell));
                            return (
                              <div
                                key={cell.toISOString()}
                                className={[
                                  'bk-cal-day',
                                  isPast || !hasAv ? 'disabled' : 'avail',
                                  isToday && !isSel ? 'today' : '',
                                  isSel ? 'active' : '',
                                  hasSession ? 'has-session' : '',
                                ].filter(Boolean).join(' ')}
                                onClick={() => hasAv && setSelectedDay(cell)}
                                role={hasAv ? 'button' : undefined}
                                tabIndex={hasAv ? 0 : undefined}
                                onKeyDown={e => hasAv && e.key === 'Enter' && setSelectedDay(cell)}
                              >
                                <span>{cell.getDate()}</span>
                                {hasSession && <span className="bk-day-check">
                                  <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
                                </span>}
                              </div>
                            );
                          })}
                        </div>

                        <div className="bk-dur-row">
                          <span className="bk-dur-label">Duration</span>
                          <div className="bk-dur-chips">
                            {DURATIONS.map(d => (
                              <button
                                key={d}
                                className={`bk-dur-chip${form.duration === d ? ' on' : ''}`}
                                onClick={() => setForm(f => ({ ...f, duration: d }))}
                              >{d} min</button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Time slots */}
                      {selectedDay && (
                        <div className="bk-times-section">
                          <div className="bk-times-header">
                            <span className="bk-times-date">{fmtShort(selectedDay)}</span>
                            {sessionsOnSelectedDay > 0 && (
                              <span className="bk-times-selected-count">{sessionsOnSelectedDay} selected</span>
                            )}
                          </div>
                          <div className="bk-times-grid">
                            {daySlots.map(slot => {
                              const isPast = slot < new Date();
                              const isBlkd = isSlotBlocked(slot, form.duration, blocked);
                              const exceeds = slotExceedsAvail(slot, form.duration, dayAvail);
                              const isChosen = selectedSlotKeys.has(slot.getTime());
                              const disabled = !isChosen && (isPast || isBlkd || exceeds || isFull);
                              const end = new Date(slot.getTime() + form.duration * 60_000);
                              return (
                                <button
                                  key={slot.toISOString()}
                                  className={`bk-time-pill${isChosen ? ' chosen' : ''}${disabled ? ' off' : ''}`}
                                  disabled={disabled && !isChosen}
                                  onClick={() => toggleSlot(slot)}
                                  title={
                                    isChosen ? 'Click to remove' :
                                    isPast ? 'Past' :
                                    isBlkd ? 'Already booked' :
                                    exceeds ? 'Exceeds available hours' :
                                    isFull ? `Package full (${packageSize} sessions)` :
                                    `${fmt12(slot.getHours(), slot.getMinutes())} \u2013 ${fmt12(end.getHours(), end.getMinutes())}`
                                  }
                                >
                                  {isChosen && <svg className="bk-pill-check" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>}
                                  {fmt12(slot.getHours(), slot.getMinutes())}
                                </button>
                              );
                            })}
                            {daySlots.length === 0 && (
                              <span className="bk-times-none">No time slots available for this date</span>
                            )}
                          </div>
                        </div>
                      )}

                      {!selectedDay && (
                        <div className="bk-times-empty">
                          <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                          <span>Select a date to see times</span>
                        </div>
                      )}
                    </div>

                    {/* Right: Reserve list */}
                    <div className="bk-reserve">
                      <div className="bk-reserve-header">
                        <h3 className="bk-reserve-title">
                          Your Sessions
                          <span className="bk-reserve-count">{selectedSessions.length}/{packageSize}</span>
                        </h3>
                      </div>

                      <div className="bk-reserve-slots">
                        {selectedSessions.map((s, i) => {
                          const end = new Date(s.slot.getTime() + form.duration * 60_000);
                          return (
                            <div key={s.slot.getTime()} className="bk-reserve-card" style={{ animationDelay: `${i * 50}ms` }}>
                              <div className="bk-rc-date">
                                <span className="bk-rc-weekday">{s.day.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                                <span className="bk-rc-day">{s.day.getDate()}</span>
                                <span className="bk-rc-month">{s.day.toLocaleDateString('en-US', { month: 'short' })}</span>
                              </div>
                              <div className="bk-rc-time">
                                {fmt12(s.slot.getHours(), s.slot.getMinutes())} {'\u2013'} {fmt12(end.getHours(), end.getMinutes())}
                              </div>
                              <button className="bk-rc-remove" onClick={() => removeSession(i)} title="Remove">
                                <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                              </button>
                            </div>
                          );
                        })}
                        {Array.from({ length: packageSize - selectedSessions.length }).map((_, i) => (
                          <div key={`empty-${i}`} className="bk-reserve-empty">
                            <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                          </div>
                        ))}
                      </div>

                      {selectedSessions.length > 0 && (
                        <button className="bk-reserve-continue" onClick={() => setStep('form')}>
                          Continue
                          <svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                        </button>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ═══ FORM ═══ */}
        {step === 'form' && (
          <div className="bk-form-view">
            <div className="bk-side">
              <Link href="/" className="bk-logo">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/logo.webp" alt="ESL Here" />
              </Link>
              <div className="bk-side-title">English Tutoring</div>
              <div className="bk-side-host">
                <img className="bk-host-avatar" src="https://media.licdn.com/dms/image/v2/D4E03AQEcqLWKYx6Xqg/profile-displayphoto-crop_800_800/B4EZsTpXe0GoAI-/0/1765561171295?e=1781136000&v=beta&t=ywWNGDr4RcJF_XppKSQuQmASzybBgkBjgrN8SyfeOkY" alt="Mahdieh Fahimpour" />
                <span className="bk-host-name">Mahdieh Fahimpour</span>
              </div>

              {/* Session summary */}
              <div className="bk-side-sessions">
                <div className="bk-ss-label">{selectedSessions.length} {selectedSessions.length === 1 ? 'session' : 'sessions'} selected</div>
                {selectedSessions.map((s, i) => {
                  const end = new Date(s.slot.getTime() + form.duration * 60_000);
                  return (
                    <div key={i} className="bk-ss-item">
                      <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                      <span>{fmtShort(s.day)}, {fmt12(s.slot.getHours(), s.slot.getMinutes())} {'\u2013'} {fmt12(end.getHours(), end.getMinutes())}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bk-form-panel">
              <button className="bk-back" onClick={() => setStep('select')}>
                <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6" /></svg>
                Back
              </button>

              <h2 className="bk-form-title">Enter your details</h2>

              <form onSubmit={(e) => { e.preventDefault(); setStep('checkout'); }} noValidate>
                <div className="bk-form-grid">
                  <div className="bk-fg">
                    <label className="bk-fg-label">Full name</label>
                    <input className="bk-fg-input" type="text" placeholder="Your name" required
                      value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className="bk-fg">
                    <label className="bk-fg-label">Email address</label>
                    <input className="bk-fg-input" type="email" placeholder="you@example.com" required
                      value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                  </div>
                  <div className="bk-fg">
                    <label className="bk-fg-label">Phone <span>(optional)</span></label>
                    <input className="bk-fg-input" type="tel" placeholder="+1 555 000 0000"
                      value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                  </div>
                  <div className="bk-fg">
                    <label className="bk-fg-label">Topic</label>
                    <select className="bk-fg-select" required
                      value={form.topic} onChange={e => setForm(f => ({ ...f, topic: e.target.value }))}>
                      <option value="">Select a topic\u2026</option>
                      {TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="bk-fg full">
                    <label className="bk-fg-label">Notes <span>(optional)</span></label>
                    <textarea className="bk-fg-textarea" placeholder="Anything specific you\u2019d like to focus on\u2026"
                      value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                  </div>
                </div>

                <div className="bk-form-actions">
                  <button type="submit" className="bk-submit"
                    disabled={!form.name || !form.email || !form.topic}>
                    <svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                    Continue to Payment
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ═══ CHECKOUT ═══ */}
        {step === 'checkout' && (
          <div className="bk-co">
            <div className="bk-co-inner">
              <button className="bk-co-back" onClick={() => setStep('form')}>
                <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6" /></svg>
              </button>

              <Link href="/" className="bk-co-logo">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/logo.webp" alt="ESL Here" />
              </Link>

              <h2 className="bk-co-title">Review & Pay</h2>
              <p className="bk-co-sub">{currentPkg.title} with Mahdieh Fahimpour</p>

              {/* Session list */}
              <div className="bk-co-sessions">
                {selectedSessions.map((s, i) => {
                  const end = new Date(s.slot.getTime() + form.duration * 60_000);
                  return (
                    <div key={i} className="bk-co-session" style={{ animationDelay: `${i * 40}ms` }}>
                      <div className="bk-co-session-date">
                        <span className="bk-co-session-day">{s.day.getDate()}</span>
                        <span className="bk-co-session-month">{s.day.toLocaleDateString('en-US', { month: 'short' })}</span>
                      </div>
                      <div className="bk-co-session-info">
                        <span className="bk-co-session-weekday">{s.day.toLocaleDateString('en-US', { weekday: 'long' })}</span>
                        <span className="bk-co-session-time">{fmt12(s.slot.getHours(), s.slot.getMinutes())} {'\u2013'} {fmt12(end.getHours(), end.getMinutes())}</span>
                      </div>
                      <span className="bk-co-session-dur">{form.duration} min</span>
                    </div>
                  );
                })}
              </div>

              {/* Total */}
              <div className="bk-co-total">
                <span className="bk-co-total-label">Total</span>
                <span className="bk-co-total-amount">{fmtPrice(currentPkg.price)} <span>Toman</span></span>
              </div>

              {submitError && (
                <div className="bk-co-error">
                  <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                  {submitError}
                </div>
              )}

              <button className="bk-co-pay" onClick={handlePayNow} disabled={submitting}>
                {submitting ? (
                  <><div className="bk-spinner" /> Redirecting...</>
                ) : (
                  'Pay Now'
                )}
              </button>

              <p className="bk-co-note">You will be redirected to Shaparak for secure payment</p>
            </div>
          </div>
        )}

        {/* ═══ SUCCESS ═══ */}
        {step === 'success' && (
          <div className="bk-success-view">
            <div className="bk-side">
              <Link href="/" className="bk-logo">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/logo.webp" alt="ESL Here" />
              </Link>
              <div className="bk-side-title">English Tutoring</div>
              <div className="bk-side-host">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="bk-host-avatar" src="https://media.licdn.com/dms/image/v2/D4E03AQEcqLWKYx6Xqg/profile-displayphoto-crop_800_800/B4EZsTpXe0GoAI-/0/1765561171295?e=1781136000&v=beta&t=ywWNGDr4RcJF_XppKSQuQmASzybBgkBjgrN8SyfeOkY" alt="Mahdieh Fahimpour" />
                <span className="bk-host-name">Mahdieh Fahimpour</span>
              </div>
            </div>

            <div className="bk-success-panel">
              <div className="bk-success-icon">
                <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
              </div>
              <h2>Payment Successful!</h2>
              <p>Your booking has been confirmed and a receipt has been sent to <strong>{form.email}</strong>.</p>

              {/* Receipt card */}
              <div className="bk-receipt">
                <div className="bk-receipt-top">
                  <span className="bk-receipt-label">Booking Reference</span>
                  <span className="bk-receipt-ref">{bookingRef}</span>
                </div>

                <div className="bk-receipt-sessions">
                  {selectedSessions.map((s, i) => {
                    const end = new Date(s.slot.getTime() + form.duration * 60_000);
                    return (
                      <div key={i} className="bk-receipt-session">
                        <span className="bk-rs-num">{i + 1}</span>
                        <div className="bk-rs-info">
                          <span className="bk-rs-date">{fmtDate(s.day)}</span>
                          <span className="bk-rs-time">{fmt12(s.slot.getHours(), s.slot.getMinutes())} {'\u2013'} {fmt12(end.getHours(), end.getMinutes())} ({form.duration} min)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="bk-receipt-details">
                  <div className="bk-rd-row"><span>Name</span><span>{form.name}</span></div>
                  <div className="bk-rd-row"><span>Email</span><span>{form.email}</span></div>
                  <div className="bk-rd-row"><span>Topic</span><span>{form.topic}</span></div>
                </div>

                <div className="bk-receipt-payment">
                  <div className="bk-rp-row">
                    <span>Payment Method</span>
                    <span>Shaparak</span>
                  </div>
                  <div className="bk-rp-row bk-rp-total">
                    <span>Total Paid</span>
                    <span>{fmtPrice(currentPkg.price)} T</span>
                  </div>
                </div>
              </div>

              <div className="bk-success-actions">
                <button className="bk-book-more" onClick={resetFlow}>
                  <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                  Book more sessions
                </button>
                <Link href="/" className="bk-home-link">
                  Return to Home
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* ═══ FAIL ═══ */}
        {step === 'fail' && (
          <div className="bk-fail-view">
            <div className="bk-side">
              <Link href="/" className="bk-logo">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/logo.webp" alt="ESL Here" />
              </Link>
              <div className="bk-side-title">English Tutoring</div>
              <div className="bk-side-host">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="bk-host-avatar" src="https://media.licdn.com/dms/image/v2/D4E03AQEcqLWKYx6Xqg/profile-displayphoto-crop_800_800/B4EZsTpXe0GoAI-/0/1765561171295?e=1781136000&v=beta&t=ywWNGDr4RcJF_XppKSQuQmASzybBgkBjgrN8SyfeOkY" alt="Mahdieh Fahimpour" />
                <span className="bk-host-name">Mahdieh Fahimpour</span>
              </div>
            </div>

            <div className="bk-fail-panel">
              <div className="bk-fail-icon">
                <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
              </div>
              <h2>Payment Unsuccessful</h2>
              <p>We couldn{'\u2019'}t process your payment. Please check your card details and try again, or use a different payment method.</p>

              {submitError && (
                <div className="bk-fail-detail">
                  <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                  {submitError}
                </div>
              )}

              <div className="bk-fail-actions">
                <button className="bk-fail-retry" onClick={() => { setSubmitError(''); setStep('checkout'); }}>
                  <svg viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>
                  Try Again
                </button>
                <Link href="/" className="bk-fail-home">
                  Return Home
                </Link>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
