'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  JALALI_MONTHS,
  JALALI_WEEKDAYS,
  faDigits,
  formatJalaliLabel,
  jalaaliMonthLength,
  parseISODate,
  toGregorian,
  toISODate,
  toJalaali,
} from '@/lib/jalali';

type Props = {
  /** Gregorian 'YYYY-MM-DD' — the value contract is unchanged, only the UI is Jalali. */
  value: string;
  onChange: (value: string) => void;
  hasError?: boolean;
  placeholder?: string;
  ariaLabel?: string;
};

type View = { jy: number; jm: number };

const calendarIcon = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <line x1="3" y1="10" x2="21" y2="10" />
    <line x1="8" y1="3" x2="8" y2="7" />
    <line x1="16" y1="3" x2="16" y2="7" />
  </svg>
);

export default function JalaliDatePicker({
  value,
  onChange,
  hasError,
  placeholder = 'Select date',
  ariaLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View | null>(null);
  const [pickingMonth, setPickingMonth] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const label = formatJalaliLabel(value);

  // close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function openPanel() {
    // start on the selected month, or on the current one when nothing is set
    const g = parseISODate(value);
    const now = new Date();
    const base = g
      ? toJalaali(g.gy, g.gm, g.gd)
      : toJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate());
    setView({ jy: base.jy, jm: base.jm });
    setPickingMonth(false);
    setOpen(true);
  }

  function shiftMonth(delta: number) {
    setView(v => {
      if (!v) return v;
      const raw = v.jm - 1 + delta;
      return { jy: v.jy + Math.floor(raw / 12), jm: ((raw % 12) + 12) % 12 + 1 };
    });
  }

  function select(jy: number, jm: number, jd: number) {
    onChange(toISODate(toGregorian(jy, jm, jd)));
    setOpen(false);
  }

  // leading blanks + day numbers for the visible month; Persian weeks start on Saturday
  const cells = useMemo(() => {
    if (!view) return [];
    const first = toGregorian(view.jy, view.jm, 1);
    const offset = (new Date(first.gy, first.gm - 1, first.gd).getDay() + 1) % 7;
    const length = jalaaliMonthLength(view.jy, view.jm);
    return [
      ...Array.from({ length: offset }, () => null),
      ...Array.from({ length }, (_, i) => i + 1),
    ] as (number | null)[];
  }, [view]);

  const selected = parseISODate(value);
  const selectedJ = selected ? toJalaali(selected.gy, selected.gm, selected.gd) : null;
  // only read the clock while the panel is open, so nothing time-dependent is server-rendered
  const todayJ = open ? (() => {
    const n = new Date();
    return toJalaali(n.getFullYear(), n.getMonth() + 1, n.getDate());
  })() : null;

  return (
    <div className={`jdp${open ? ' is-open' : ''}`} ref={rootRef}>
      <button
        type="button"
        className={`jdp-trigger${hasError ? ' has-error' : ''}${label ? '' : ' is-empty'}`}
        onClick={() => (open ? setOpen(false) : openPanel())}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        <span className="jdp-value">{label || placeholder}</span>
        {calendarIcon}
      </button>

      {open && view && (
        <div className="jdp-panel" dir="rtl" role="dialog" aria-label="انتخاب تاریخ">
          <div className="jdp-head">
            <button type="button" className="jdp-nav" onClick={() => (pickingMonth ? setView(v => v && { ...v, jy: v.jy - 1 }) : shiftMonth(-1))} aria-label="قبلی">
              <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6" /></svg>
            </button>
            <button type="button" className="jdp-title" onClick={() => setPickingMonth(p => !p)}>
              {pickingMonth ? faDigits(view.jy) : `${JALALI_MONTHS[view.jm - 1]} ${faDigits(view.jy)}`}
              <svg viewBox="0 0 24 24" className={pickingMonth ? 'flip' : ''}><polyline points="6 9 12 15 18 9" /></svg>
            </button>
            <button type="button" className="jdp-nav" onClick={() => (pickingMonth ? setView(v => v && { ...v, jy: v.jy + 1 }) : shiftMonth(1))} aria-label="بعدی">
              <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
          </div>

          {pickingMonth ? (
            <div className="jdp-months">
              {JALALI_MONTHS.map((m, i) => (
                <button
                  key={m}
                  type="button"
                  className={`jdp-month${view.jm === i + 1 ? ' is-active' : ''}`}
                  onClick={() => { setView({ jy: view.jy, jm: i + 1 }); setPickingMonth(false); }}
                >
                  {m}
                </button>
              ))}
            </div>
          ) : (
            <>
              <div className="jdp-week">
                {JALALI_WEEKDAYS.map((d, i) => <span key={i}>{d}</span>)}
              </div>
              <div className="jdp-days">
                {cells.map((d, i) => d === null ? <span key={`b${i}`} /> : (
                  <button
                    key={d}
                    type="button"
                    className={
                      'jdp-day' +
                      (selectedJ && selectedJ.jy === view.jy && selectedJ.jm === view.jm && selectedJ.jd === d ? ' is-selected' : '') +
                      (todayJ && todayJ.jy === view.jy && todayJ.jm === view.jm && todayJ.jd === d ? ' is-today' : '')
                    }
                    onClick={() => select(view.jy, view.jm, d)}
                  >
                    {faDigits(d)}
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="jdp-foot">
            <button
              type="button"
              className="jdp-foot-btn"
              onClick={() => {
                const n = new Date();
                const t = toJalaali(n.getFullYear(), n.getMonth() + 1, n.getDate());
                select(t.jy, t.jm, t.jd);
              }}
            >
              Today
            </button>
            <button type="button" className="jdp-foot-btn is-muted" onClick={() => { onChange(''); setOpen(false); }}>
              Clear
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .jdp { position: relative; flex: 1; min-width: 0; }

        .jdp-trigger {
          display: flex; align-items: center; justify-content: space-between; gap: 8px;
          width: 100%; padding: 9px 13px; font-family: 'DM Sans', sans-serif;
          font-size: 0.84rem; color: #1a2e44; background: #fff; text-align: left;
          border: 1px solid #d8e3ec; border-radius: 7px; cursor: pointer; outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .jdp-trigger:hover { border-color: #b6cbd9; }
        .jdp-trigger.is-empty .jdp-value { color: #b0bfcc; }
        .jdp-trigger.has-error { border-color: #ef4444; }
        .jdp-trigger:focus-visible,
        .jdp.is-open .jdp-trigger { border-color: #2db5c0; box-shadow: 0 0 0 3px rgba(45,181,192,0.08); }
        .jdp-value { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .jdp-trigger :global(svg) { width: 14px; height: 14px; stroke: #94a7b5; stroke-width: 1.8; fill: none; flex-shrink: 0; }

        .jdp-panel {
          position: absolute; top: calc(100% + 6px); left: 0; z-index: 60;
          width: 252px; box-sizing: border-box; padding: 12px;
          background: #fff; border: 1px solid #e6edf3; border-radius: 10px;
          box-shadow: 0 10px 30px rgba(26,46,68,0.12);
          font-family: 'DM Sans', sans-serif;
          animation: jdp-in 0.14s ease-out;
        }
        @keyframes jdp-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }

        .jdp-head { display: flex; align-items: center; justify-content: space-between; gap: 4px; margin-bottom: 8px; }
        .jdp-nav {
          width: 26px; height: 26px; flex-shrink: 0; border: none; border-radius: 6px;
          background: none; cursor: pointer; display: flex; align-items: center; justify-content: center;
          transition: background 0.15s;
        }
        .jdp-nav:hover { background: #f2f6f9; }
        .jdp-nav :global(svg) { width: 13px; height: 13px; stroke: #5f7a8f; stroke-width: 2; fill: none; }
        .jdp-title {
          display: flex; align-items: center; gap: 5px; flex: 1; justify-content: center;
          padding: 4px 8px; border: none; border-radius: 6px; background: none; cursor: pointer;
          font-family: inherit; font-size: 0.8rem; font-weight: 600; color: #1a2e44;
          transition: background 0.15s;
        }
        .jdp-title:hover { background: #f2f6f9; }
        .jdp-title :global(svg) { width: 11px; height: 11px; stroke: #94a7b5; stroke-width: 2.2; fill: none; transition: transform 0.15s; }
        .jdp-title :global(svg.flip) { transform: rotate(180deg); }

        .jdp-week, .jdp-days { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
        .jdp-week { margin-bottom: 4px; }
        .jdp-week span {
          text-align: center; font-size: 0.66rem; font-weight: 600; color: #b0bfcc;
          padding: 4px 0;
        }
        .jdp-day {
          height: 28px; border: none; border-radius: 6px; background: none; cursor: pointer;
          font-family: inherit; font-size: 0.76rem; color: #2a4657;
          display: flex; align-items: center; justify-content: center;
          transition: background 0.12s, color 0.12s;
        }
        .jdp-day:hover { background: #eef7f9; color: #1a2e44; }
        .jdp-day.is-today { color: #2db5c0; font-weight: 700; }
        .jdp-day.is-selected { background: #2db5c0; color: #fff; font-weight: 600; }

        .jdp-months { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; }
        .jdp-month {
          padding: 8px 2px; border: none; border-radius: 6px; background: none; cursor: pointer;
          font-family: inherit; font-size: 0.72rem; color: #2a4657; transition: background 0.12s, color 0.12s;
        }
        .jdp-month:hover { background: #eef7f9; }
        .jdp-month.is-active { background: #2db5c0; color: #fff; font-weight: 600; }

        .jdp-foot {
          display: flex; gap: 6px; margin-top: 10px; padding-top: 9px;
          border-top: 1px solid #f0f3f6; direction: ltr;
        }
        .jdp-foot-btn {
          flex: 1; padding: 6px 0; border: none; border-radius: 6px; background: #f2f6f9;
          font-family: inherit; font-size: 0.72rem; font-weight: 600; color: #2a6270;
          cursor: pointer; transition: background 0.15s, color 0.15s;
        }
        .jdp-foot-btn:hover { background: #e2eef2; }
        .jdp-foot-btn.is-muted { color: #94a7b5; }
        .jdp-foot-btn.is-muted:hover { background: #f2f6f9; color: #5f7a8f; }

        @media (prefers-reduced-motion: reduce) {
          .jdp-panel { animation: none; }
        }
      `}</style>
    </div>
  );
}
