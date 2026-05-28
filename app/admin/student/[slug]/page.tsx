'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAdmin } from '../../admin-context';

interface Student {
  id: string; firstName: string; lastName: string; email: string; phone: string;
  englishLevel: string; type: string; addedAt?: string;
}

interface ClassRecord {
  id: string; studentId: string; title: string; description?: string;
  date: string; duration: number; status: string;
}

interface Payment {
  id: string; studentId: string; amount: number; description: string;
  dueDate: string; paidDate?: string | null; status: string;
}

interface ProfileData {
  student: Student;
  classes: { upcoming: ClassRecord[]; past: ClassRecord[]; all: ClassRecord[] };
  payments: Payment[];
  debts: unknown[];
}

const SESSIONS_PER_PAGE = 6;

export default function StudentProfilePage() {
  const params = useParams();
  const slug = params.slug as string;
  const { token, logout } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [activeTab, setActiveTab] = useState<'sessions' | 'payments'>('sessions');
  const [sessionPage, setSessionPage] = useState(1);
  const [sessionFilter, setSessionFilter] = useState<'all' | 'upcoming' | 'completed'>('all');

  useEffect(() => {
    if (!token) return;
    if (!slug) { setErrorMsg('Invalid student URL'); setLoading(false); return; }

    (async () => {
      try {
        const pRes = await fetch('/api/student/' + encodeURIComponent(slug) + '/profile', { headers: { Authorization: 'Bearer ' + token } });
        if (pRes.status === 404) { setErrorMsg('Student not found'); setLoading(false); return; }
        if (pRes.status === 401) { logout(); return; }
        if (!pRes.ok) { setErrorMsg('Failed to load profile'); setLoading(false); return; }
        setProfile(await pRes.json());
        setLoading(false);
      } catch { setErrorMsg('Something went wrong'); setLoading(false); }
    })();
  }, [slug, token, logout]);

  function fmtAmt(n: number) { return n.toLocaleString('en-US'); }

  function getInitials(first: string, last: string) {
    return (first.charAt(0) + last.charAt(0)).toUpperCase();
  }

  return (
    <>
      <style jsx global>{`
        /* ── Design tokens ── */
        .sp-page {
          --sp-font: 'Poppins', sans-serif;
          --sp-bg: #f9fbfc;
          --sp-surface: #ffffff;
          --sp-text: #1a2e44;
          --sp-text-2: #5f7a8f;
          --sp-text-3: #8ba3b5;
          --sp-border: #d8e3ec;
          --sp-accent: #2db5c0;
          --sp-accent-light: #ddf1f3;
          --sp-accent-dark: #2a6270;
          --sp-green: #10b981;
          --sp-green-bg: #ecfdf5;
          --sp-green-dark: #047857;
          --sp-amber: #f59e0b;
          --sp-amber-bg: #fffbeb;
          --sp-amber-dark: #b45309;
          --sp-red: #ef4444;
          --sp-red-bg: #fef2f2;
          --sp-shadow-sm: 0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02);
          --sp-shadow-md: 0 4px 16px rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.03);
          --sp-shadow-lg: 0 12px 40px rgba(0,0,0,0.07), 0 2px 8px rgba(0,0,0,0.03);
          font-family: var(--sp-font);
        }

        /* ── Staggered page load ── */
        @keyframes sp-rise {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .sp-anim-1 { animation: sp-rise 0.5s ease-out 0.05s both; }
        .sp-anim-2 { animation: sp-rise 0.5s ease-out 0.12s both; }
        .sp-anim-3 { animation: sp-rise 0.5s ease-out 0.2s both; }
        .sp-anim-4 { animation: sp-rise 0.5s ease-out 0.28s both; }

        /* ── Back link ── */
        .sp-back {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-family: var(--sp-font);
          font-size: 0.8rem;
          font-weight: 500;
          color: var(--sp-text-3);
          text-decoration: none;
          margin-bottom: 22px;
          transition: color 0.15s;
        }
        .sp-back:hover { color: var(--sp-accent); }
        .sp-back svg {
          width: 14px; height: 14px;
          stroke: currentColor; stroke-width: 2; fill: none;
        }

        /* ── Profile hero ── */
        .sp-hero {
          background: var(--sp-surface);
          border-radius: 14px;
          padding: 32px 36px 28px;
          box-shadow: var(--sp-shadow-sm);
          margin-bottom: 20px;
          position: relative;
          overflow: hidden;
        }
        .sp-hero::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 4px;
          background: linear-gradient(90deg, var(--sp-accent), #5dd8e2, var(--sp-accent));
          background-size: 200% 100%;
        }
        .sp-hero-top {
          display: flex;
          gap: 24px;
          align-items: center;
          margin-bottom: 24px;
        }
        .sp-avatar {
          width: 68px; height: 68px; min-width: 68px;
          border-radius: 16px;
          background: linear-gradient(135deg, #2db5c0 0%, #2dd4bf 100%);
          display: flex; align-items: center; justify-content: center;
          font-family: var(--sp-font);
          font-size: 1.25rem; font-weight: 600;
          color: #fff; letter-spacing: 0.03em;
          flex-shrink: 0;
        }
        .sp-hero-info { flex: 1; min-width: 0; }
        .sp-hero-name {
          font-family: var(--sp-font);
          font-size: 1.35rem; font-weight: 700;
          color: var(--sp-text);
          letter-spacing: -0.025em;
          margin-bottom: 4px;
          line-height: 1.2;
        }
        .sp-hero-meta {
          display: flex; align-items: center;
          gap: 16px; flex-wrap: wrap;
        }
        .sp-hero-chip {
          display: inline-flex; align-items: center;
          gap: 5px; font-size: 0.78rem;
          color: var(--sp-text-2);
        }
        .sp-hero-chip svg {
          width: 13px; height: 13px;
          stroke: var(--sp-text-3); stroke-width: 1.8; fill: none;
        }
        .sp-active-dot {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 0.72rem; font-weight: 600;
          color: var(--sp-green-dark);
          background: var(--sp-green-bg);
          padding: 3px 10px; border-radius: 20px;
          letter-spacing: 0.01em;
        }
        .sp-active-dot::before {
          content: ''; width: 6px; height: 6px;
          border-radius: 50%; background: var(--sp-green);
        }
        .sp-hero-actions {
          display: flex; gap: 8px;
          margin-left: auto;
          flex-shrink: 0;
        }
        .sp-hero-action {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 7px 14px; border-radius: 8px;
          font-family: var(--sp-font);
          font-size: 0.78rem; font-weight: 500;
          border: 1px solid var(--sp-border);
          background: var(--sp-surface);
          color: var(--sp-text-2);
          cursor: pointer; transition: all 0.15s;
          text-decoration: none;
        }
        .sp-hero-action:hover {
          border-color: var(--sp-accent);
          color: var(--sp-accent);
          background: #f0fdfa;
        }
        .sp-hero-action svg {
          width: 13px; height: 13px;
          stroke: currentColor; stroke-width: 1.8; fill: none;
        }
        .sp-hero-action-primary {
          background: var(--sp-accent);
          color: #fff;
          border-color: var(--sp-accent);
        }
        .sp-hero-action-primary:hover {
          background: var(--sp-accent-dark);
          border-color: var(--sp-accent-dark);
          color: #fff;
        }

        /* ── Stat cards ── */
        .sp-stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          margin-bottom: 24px;
        }
        .sp-stat {
          background: var(--sp-surface);
          border-radius: 12px;
          padding: 20px 22px;
          box-shadow: var(--sp-shadow-sm);
          position: relative;
          overflow: hidden;
        }
        .sp-stat-label {
          font-size: 0.7rem;
          font-weight: 500;
          color: var(--sp-text-3);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          margin-bottom: 8px;
        }
        .sp-stat-value {
          font-family: var(--sp-font);
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--sp-text);
          letter-spacing: -0.03em;
          line-height: 1;
        }
        .sp-stat-sub {
          font-size: 0.72rem;
          color: var(--sp-text-3);
          margin-top: 6px;
          font-weight: 400;
        }
        .sp-stat-icon {
          position: absolute;
          top: 18px; right: 18px;
          width: 32px; height: 32px;
          border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
        }
        .sp-stat-icon svg {
          width: 16px; height: 16px;
          stroke-width: 1.8; fill: none;
        }
        .sp-stat-icon.teal { background: #ddf1f3; }
        .sp-stat-icon.teal svg { stroke: #2db5c0; }
        .sp-stat-icon.blue { background: #dbeafe; }
        .sp-stat-icon.blue svg { stroke: #2563eb; }
        .sp-stat-icon.green { background: #dcfce7; }
        .sp-stat-icon.green svg { stroke: #16a34a; }
        .sp-stat-icon.amber { background: #fef3c7; }
        .sp-stat-icon.amber svg { stroke: #d97706; }

        /* ── Detail grid (below stats) ── */
        .sp-details-row {
          display: flex;
          gap: 20px;
          flex-wrap: wrap;
          margin-bottom: 28px;
          padding: 0 2px;
        }
        .sp-detail-item {
          display: flex; align-items: center; gap: 8px;
        }
        .sp-detail-icon {
          width: 30px; height: 30px; min-width: 30px;
          border-radius: 7px;
          background: #edf2f7;
          display: flex; align-items: center; justify-content: center;
        }
        .sp-detail-icon svg {
          width: 14px; height: 14px;
          stroke: var(--sp-text-3); stroke-width: 1.8; fill: none;
        }
        .sp-detail-text {
          display: flex; flex-direction: column;
        }
        .sp-detail-label {
          font-size: 0.66rem;
          font-weight: 400;
          color: var(--sp-text-3);
          line-height: 1.2;
        }
        .sp-detail-val {
          font-size: 0.82rem;
          font-weight: 500;
          color: var(--sp-text);
          text-transform: capitalize;
        }

        /* ── Tab bar ── */
        .sp-tabbar {
          display: flex;
          gap: 6px;
          margin-bottom: 22px;
          background: #edf2f7;
          padding: 4px;
          border-radius: 10px;
          width: fit-content;
        }
        .sp-tab-pill {
          padding: 8px 20px;
          font-family: var(--sp-font);
          font-size: 0.8rem;
          font-weight: 500;
          color: var(--sp-text-2);
          background: transparent;
          border: none; border-radius: 7px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .sp-tab-pill:hover {
          color: var(--sp-text);
        }
        .sp-tab-pill.active {
          background: var(--sp-surface);
          color: var(--sp-text);
          box-shadow: 0 1px 4px rgba(0,0,0,0.06);
          font-weight: 600;
        }

        /* ── Session filter chips ── */
        .sp-filters {
          display: flex; gap: 6px;
          margin-bottom: 18px;
        }
        .sp-chip {
          padding: 5px 14px;
          border-radius: 6px;
          font-family: var(--sp-font);
          font-size: 0.75rem;
          font-weight: 500;
          color: var(--sp-text-3);
          background: transparent;
          border: 1px solid transparent;
          cursor: pointer;
          transition: all 0.15s;
        }
        .sp-chip:hover {
          color: var(--sp-text-2);
          background: #edf2f7;
        }
        .sp-chip.active {
          color: var(--sp-accent-dark);
          background: var(--sp-accent-light);
          border-color: rgba(45,181,192,0.15);
        }

        /* ── Session list ── */
        .sp-session-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 24px;
        }
        .sp-session-row {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 14px 18px;
          background: var(--sp-surface);
          border-radius: 10px;
          box-shadow: var(--sp-shadow-sm);
          transition: box-shadow 0.2s, transform 0.15s;
          cursor: default;
        }
        .sp-session-row:hover {
          box-shadow: var(--sp-shadow-md);
          transform: translateY(-1px);
        }
        .sp-srow-indicator {
          width: 3px; height: 36px;
          border-radius: 3px;
          flex-shrink: 0;
        }
        .sp-srow-indicator.upcoming { background: var(--sp-amber); }
        .sp-srow-indicator.completed { background: var(--sp-green); }
        .sp-srow-indicator.canceled { background: #d1d5db; }
        .sp-srow-info {
          flex: 1; min-width: 0;
        }
        .sp-srow-title {
          font-family: var(--sp-font);
          font-size: 0.84rem;
          font-weight: 600;
          color: var(--sp-text);
          white-space: nowrap; overflow: hidden;
          text-overflow: ellipsis;
          margin-bottom: 2px;
          letter-spacing: -0.01em;
        }
        .sp-srow-sub {
          font-size: 0.72rem;
          color: var(--sp-text-3);
        }
        .sp-srow-date {
          text-align: right;
          flex-shrink: 0;
          min-width: 100px;
        }
        .sp-srow-date-day {
          font-size: 0.78rem;
          font-weight: 500;
          color: var(--sp-text);
          letter-spacing: -0.01em;
        }
        .sp-srow-date-time {
          font-size: 0.68rem;
          color: var(--sp-text-3);
          margin-top: 1px;
        }
        .sp-srow-badge {
          display: inline-flex; align-items: center;
          padding: 4px 10px; border-radius: 5px;
          font-size: 0.68rem; font-weight: 500;
          flex-shrink: 0;
          letter-spacing: 0.01em;
        }
        .sp-srow-badge.upcoming { background: var(--sp-amber-bg); color: var(--sp-amber-dark); }
        .sp-srow-badge.completed { background: var(--sp-green-bg); color: var(--sp-green-dark); }
        .sp-srow-badge.canceled { background: #f3f4f6; color: #9ca3af; }
        .sp-srow-action {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 6px 14px; border-radius: 7px;
          border: none;
          background: var(--sp-accent);
          color: #fff;
          font-family: var(--sp-font);
          font-size: 0.72rem; font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
          flex-shrink: 0;
          letter-spacing: 0.01em;
        }
        .sp-srow-action:hover {
          background: var(--sp-accent-dark);
          box-shadow: 0 2px 8px rgba(45,181,192,0.25);
        }
        .sp-srow-action svg {
          width: 11px; height: 11px;
          stroke: currentColor; stroke-width: 2.5; fill: none;
        }

        /* ── Payments table ── */
        .sp-pay-wrap {
          background: var(--sp-surface);
          border-radius: 12px;
          box-shadow: var(--sp-shadow-sm);
          overflow: hidden;
        }
        .sp-pay-table {
          width: 100%;
          border-collapse: collapse;
        }
        .sp-pay-table th {
          padding: 14px 20px;
          text-align: left;
          font-family: var(--sp-font);
          font-weight: 500;
          color: var(--sp-text-3);
          font-size: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          border-bottom: 1px solid var(--sp-border);
        }
        .sp-pay-table td {
          padding: 14px 20px;
          font-size: 0.82rem;
          color: var(--sp-text-2);
          border-bottom: 1px solid #f5f6f8;
        }
        .sp-pay-table tbody tr:last-child td { border-bottom: none; }
        .sp-pay-table tbody tr {
          transition: background 0.12s;
        }
        .sp-pay-table tbody tr:hover td {
          background: #fafbfc;
        }
        .sp-pay-amount {
          font-weight: 600;
          color: var(--sp-text);
          font-variant-numeric: tabular-nums;
        }
        .sp-pay-status {
          display: inline-flex; align-items: center;
          padding: 3px 9px; border-radius: 5px;
          font-size: 0.68rem; font-weight: 500;
          text-transform: capitalize;
        }
        .sp-pay-status.paid { background: var(--sp-green-bg); color: var(--sp-green-dark); }
        .sp-pay-status.pending { background: var(--sp-amber-bg); color: var(--sp-amber-dark); }
        .sp-pay-status.overdue { background: var(--sp-red-bg); color: var(--sp-red); }

        /* ── Pagination ── */
        .sp-pagi {
          display: flex; align-items: center;
          justify-content: space-between;
          padding-top: 12px;
        }
        .sp-pagi-info {
          font-size: 0.78rem;
          color: var(--sp-text-3);
        }
        .sp-pagi-btns {
          display: flex; gap: 4px;
        }
        .sp-pagi-btn {
          width: 30px; height: 30px;
          display: flex; align-items: center; justify-content: center;
          border-radius: 6px;
          border: none;
          background: transparent;
          font-family: var(--sp-font);
          font-size: 0.75rem; font-weight: 500;
          color: var(--sp-text-3);
          cursor: pointer;
          transition: all 0.15s;
        }
        .sp-pagi-btn:hover {
          background: #edf2f7;
          color: var(--sp-text);
        }
        .sp-pagi-btn.active {
          background: var(--sp-accent);
          color: #fff;
        }

        /* ── Empty & loading ── */
        @keyframes sp-fade { from { opacity: 0; } to { opacity: 1; } }
        .sp-empty {
          text-align: center;
          padding: 64px 20px 56px;
          animation: sp-fade 0.4s ease-out both;
        }
        .sp-empty svg {
          width: 44px; height: 44px;
          stroke: #d1d5db; stroke-width: 1; fill: none;
          display: block; margin: 0 auto 18px;
        }
        .sp-empty-title {
          font-size: 0.84rem; font-weight: 500;
          color: var(--sp-text-3);
        }
        .sp-empty-hint {
          font-size: 0.74rem;
          color: #c5c9d2;
          margin-top: 5px;
        }
        .sp-loading {
          display: flex; align-items: center; justify-content: center;
          height: 50vh;
          font-size: 0.85rem; color: var(--sp-text-3);
          font-family: var(--sp-font);
        }
        @keyframes sp-spin { to { transform: rotate(360deg); } }
        .sp-loading-ring {
          width: 18px; height: 18px;
          border: 2px solid var(--sp-border);
          border-top-color: var(--sp-accent);
          border-radius: 50%;
          animation: sp-spin 0.6s linear infinite;
          margin-right: 10px;
        }
        .sp-error {
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          height: 50vh; text-align: center;
          font-family: var(--sp-font);
        }
        .sp-error h2 {
          font-size: 1.2rem; font-weight: 600;
          margin-bottom: 8px; color: var(--sp-text);
        }
        .sp-error p {
          font-size: 0.85rem; color: var(--sp-text-3);
          margin-bottom: 24px;
        }
        .sp-error a {
          font-size: 0.8rem; font-weight: 500;
          color: var(--sp-accent);
          text-decoration: none;
          border-bottom: 1px solid rgba(45,181,192,0.3);
          padding-bottom: 1px;
          transition: border-color 0.15s;
        }
        .sp-error a:hover { border-color: var(--sp-accent); }

        /* ── Responsive ── */
        @media (max-width: 1024px) {
          .sp-stats { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 768px) {
          .sp-stats { grid-template-columns: 1fr 1fr; }
          .sp-hero-top { flex-direction: column; align-items: flex-start; gap: 16px; }
          .sp-hero-actions { margin-left: 0; }
          .sp-details-row { flex-direction: column; gap: 12px; }
          .sp-session-row { flex-wrap: wrap; }
          .sp-srow-date { text-align: left; min-width: auto; }
          .sp-tabbar { width: 100%; }
          .sp-tab-pill { flex: 1; text-align: center; }
        }
        @media (max-width: 500px) {
          .sp-stats { grid-template-columns: 1fr; }
          .sp-hero { padding: 24px 20px 20px; }
        }
      `}</style>

      <div className="sp-page">
        {loading && <div className="sp-loading"><div className="sp-loading-ring"></div> Loading profile&hellip;</div>}

        {errorMsg && (
          <div className="sp-error">
            <h2>{errorMsg}</h2>
            <p>The student profile could not be loaded.</p>
            <Link href="/admin/students">Back to Active Students</Link>
          </div>
        )}

        {profile && (() => {
          const s = profile.student;
          const all = (profile.classes.all || []).slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          const pay = profile.payments || [];
          const addedDate = s.addedAt ? new Date(s.addedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
          const totalSessions = all.length;
          const completedN = all.filter(c => c.status === 'completed').length;
          const upcomingN = all.filter(c => c.status === 'scheduled').length;
          const totalPaid = pay.filter(p => p.status === 'paid').reduce((a, p) => a + p.amount, 0);
          const outstanding = pay.filter(p => p.status !== 'paid').reduce((a, p) => a + p.amount, 0);

          const filteredSessions = sessionFilter === 'all' ? all : all.filter(c => sessionFilter === 'upcoming' ? c.status === 'scheduled' : c.status === sessionFilter);
          const totalPages = Math.max(1, Math.ceil(filteredSessions.length / SESSIONS_PER_PAGE));
          const pagedSessions = filteredSessions.slice((sessionPage - 1) * SESSIONS_PER_PAGE, sessionPage * SESSIONS_PER_PAGE);
          const showFrom = filteredSessions.length === 0 ? 0 : (sessionPage - 1) * SESSIONS_PER_PAGE + 1;
          const showTo = Math.min(sessionPage * SESSIONS_PER_PAGE, filteredSessions.length);

          return (
            <div>
              {/* Back link */}
              <Link href="/admin/students" className="sp-back sp-anim-1">
                <svg viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Back to students
              </Link>

              {/* Profile hero */}
              <div className="sp-hero sp-anim-1">
                <div className="sp-hero-top">
                  <div className="sp-avatar">
                    {getInitials(s.firstName, s.lastName)}
                  </div>
                  <div className="sp-hero-info">
                    <div className="sp-hero-name">{s.firstName} {s.lastName}</div>
                    <div className="sp-hero-meta">
                      <span className="sp-active-dot">Active</span>
                      <span className="sp-hero-chip">
                        <svg viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                        {s.email}
                      </span>
                      <span className="sp-hero-chip">
                        <svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                        {s.phone}
                      </span>
                    </div>
                  </div>
                  <div className="sp-hero-actions">
                    <Link href={`/admin/sessions/create?studentId=${s.id}`} className="sp-hero-action sp-hero-action-primary">
                      <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      Create Session
                    </Link>
                    <a href={`mailto:${s.email}`} className="sp-hero-action">
                      <svg viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                      Email
                    </a>
                    <button className="sp-hero-action" onClick={() => navigator.clipboard.writeText(s.phone)}>
                      <svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                      Copy Phone
                    </button>
                  </div>
                </div>
              </div>

              {/* Stat cards */}
              <div className="sp-stats sp-anim-2">
                <div className="sp-stat">
                  <div className="sp-stat-icon teal">
                    <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  </div>
                  <div className="sp-stat-label">Total Sessions</div>
                  <div className="sp-stat-value">{totalSessions}</div>
                  <div className="sp-stat-sub">{completedN} completed</div>
                </div>
                <div className="sp-stat">
                  <div className="sp-stat-icon blue">
                    <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  </div>
                  <div className="sp-stat-label">Upcoming</div>
                  <div className="sp-stat-value">{upcomingN}</div>
                  <div className="sp-stat-sub">sessions scheduled</div>
                </div>
                <div className="sp-stat">
                  <div className="sp-stat-icon green">
                    <svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                  </div>
                  <div className="sp-stat-label">Total Paid</div>
                  <div className="sp-stat-value">{totalPaid > 0 ? fmtAmt(totalPaid) : '0'}</div>
                  <div className="sp-stat-sub">all time</div>
                </div>
                <div className="sp-stat">
                  <div className="sp-stat-icon amber">
                    <svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  </div>
                  <div className="sp-stat-label">Outstanding</div>
                  <div className="sp-stat-value" style={{ color: outstanding > 0 ? 'var(--sp-amber)' : undefined }}>
                    {outstanding > 0 ? fmtAmt(outstanding) : '0'}
                  </div>
                  <div className="sp-stat-sub">{outstanding > 0 ? 'balance due' : 'all clear'}</div>
                </div>
              </div>

              {/* Detail chips */}
              <div className="sp-details-row sp-anim-3">
                <div className="sp-detail-item">
                  <div className="sp-detail-icon">
                    <svg viewBox="0 0 24 24"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                  </div>
                  <div className="sp-detail-text">
                    <span className="sp-detail-label">Level</span>
                    <span className="sp-detail-val">{s.englishLevel}</span>
                  </div>
                </div>
                <div className="sp-detail-item">
                  <div className="sp-detail-icon">
                    <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                  </div>
                  <div className="sp-detail-text">
                    <span className="sp-detail-label">Type</span>
                    <span className="sp-detail-val">{s.type}</span>
                  </div>
                </div>
                <div className="sp-detail-item">
                  <div className="sp-detail-icon">
                    <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  </div>
                  <div className="sp-detail-text">
                    <span className="sp-detail-label">Enrolled</span>
                    <span className="sp-detail-val" style={{ textTransform: 'none' }}>{addedDate || '—'}</span>
                  </div>
                </div>
              </div>

              {/* Tab bar */}
              <div className="sp-tabbar sp-anim-4">
                <button className={`sp-tab-pill ${activeTab === 'sessions' ? 'active' : ''}`} onClick={() => { setActiveTab('sessions'); setSessionPage(1); }}>Sessions</button>
                <button className={`sp-tab-pill ${activeTab === 'payments' ? 'active' : ''}`} onClick={() => setActiveTab('payments')}>Payments</button>
              </div>

              {/* Sessions tab */}
              {activeTab === 'sessions' && (
                <div className="sp-anim-4">
                  <div className="sp-filters">
                    <button className={`sp-chip ${sessionFilter === 'all' ? 'active' : ''}`} onClick={() => { setSessionFilter('all'); setSessionPage(1); }}>All</button>
                    <button className={`sp-chip ${sessionFilter === 'upcoming' ? 'active' : ''}`} onClick={() => { setSessionFilter('upcoming'); setSessionPage(1); }}>Upcoming</button>
                    <button className={`sp-chip ${sessionFilter === 'completed' ? 'active' : ''}`} onClick={() => { setSessionFilter('completed'); setSessionPage(1); }}>Completed</button>
                  </div>

                  {filteredSessions.length === 0 ? (
                    <div className="sp-empty">
                      <svg viewBox="0 0 40 40"><rect x="5" y="6" width="30" height="28" rx="3"/><line x1="5" y1="14" x2="35" y2="14"/><line x1="13" y1="3" x2="13" y2="9"/><line x1="27" y1="3" x2="27" y2="9"/></svg>
                      <div className="sp-empty-title">No {sessionFilter === 'all' ? '' : sessionFilter + ' '}sessions found</div>
                      <div className="sp-empty-hint">{sessionFilter !== 'all' ? 'Try selecting a different filter' : 'Scheduled sessions will show up here'}</div>
                    </div>
                  ) : (
                    <>
                      <div className="sp-session-list">
                        {pagedSessions.map((c) => {
                          const d = new Date(c.date);
                          const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                          const startTime = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                          const endDate = new Date(d.getTime() + c.duration * 60000);
                          const endTime = endDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                          const statusLabel = c.status === 'scheduled' ? 'upcoming' : c.status;
                          return (
                            <div className="sp-session-row" key={c.id}>
                              <div className={`sp-srow-indicator ${statusLabel}`} />
                              <div className="sp-srow-info">
                                <div className="sp-srow-title">{c.title}</div>
                                <div className="sp-srow-sub">{s.type === 'group' ? 'Group' : 'Private'} &middot; {c.duration} min</div>
                              </div>
                              <div className="sp-srow-date">
                                <div className="sp-srow-date-day">{dateStr}</div>
                                <div className="sp-srow-date-time">{startTime} – {endTime}</div>
                              </div>
                              <span className={`sp-srow-badge ${statusLabel}`}>
                                {c.status === 'completed' ? 'Completed' : c.status === 'scheduled' ? 'Upcoming' : 'Canceled'}
                              </span>
                              {c.status === 'scheduled' && (
                                <button className="sp-srow-action">
                                  Go to Class
                                  <svg viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <div className="sp-pagi">
                        <span className="sp-pagi-info">
                          {showFrom}–{showTo} of {filteredSessions.length}
                        </span>
                        <div className="sp-pagi-btns">
                          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                            <button key={p} className={`sp-pagi-btn ${p === sessionPage ? 'active' : ''}`} onClick={() => setSessionPage(p)}>{p}</button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Payments tab */}
              {activeTab === 'payments' && (
                <div className="sp-anim-4">
                  {pay.length === 0 ? (
                    <div className="sp-empty">
                      <svg viewBox="0 0 40 40"><rect x="4" y="10" width="32" height="20" rx="3"/><line x1="4" y1="17" x2="36" y2="17"/><line x1="9" y1="24" x2="18" y2="24"/></svg>
                      <div className="sp-empty-title">No payment records yet</div>
                      <div className="sp-empty-hint">Invoices and payments will appear here</div>
                    </div>
                  ) : (
                    <div className="sp-pay-wrap">
                      <table className="sp-pay-table">
                        <thead>
                          <tr>
                            <th>Description</th>
                            <th>Amount</th>
                            <th>Due Date</th>
                            <th>Paid Date</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pay.map(p => (
                            <tr key={p.id}>
                              <td>{p.description}</td>
                              <td><span className="sp-pay-amount">{fmtAmt(p.amount)}</span></td>
                              <td>{new Date(p.dueDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                              <td>{p.paidDate ? new Date(p.paidDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</td>
                              <td><span className={`sp-pay-status ${p.status}`}>{p.status}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </>
  );
}
