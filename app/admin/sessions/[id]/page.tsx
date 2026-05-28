'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
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

interface SessionDetail {
  session: ClassRecord;
  student: Student | null;
  relatedSessions: ClassRecord[];
}

const avatarPalette = [
  { bg: '#ddf1f3', text: '#4338ca' },
  { bg: '#ecfdf5', text: '#047857' },
  { bg: '#fdf4ff', text: '#a21caf' },
  { bg: '#eff6ff', text: '#1d4ed8' },
  { bg: '#fefce8', text: '#a16207' },
  { bg: '#fef2f2', text: '#b91c1c' },
  { bg: '#f0fdfa', text: '#0f766e' },
];

function getAvatarStyle(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return avatarPalette[Math.abs(hash) % avatarPalette.length];
}

export default function SessionDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { token, logout } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [data, setData] = useState<SessionDetail | null>(null);
  const [toast, setToast] = useState('');
  const [canceling, setCanceling] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  useEffect(() => {
    if (!token) return;
    if (!id) { setErrorMsg('Invalid session URL'); setLoading(false); return; }

    (async () => {
      try {
        const res = await fetch('/api/sessions/' + encodeURIComponent(id), { headers: { Authorization: 'Bearer ' + token } });
        if (res.status === 404) { setErrorMsg('Session not found'); setLoading(false); return; }
        if (res.status === 401) { logout(); return; }
        if (!res.ok) { setErrorMsg('Failed to load session'); setLoading(false); return; }
        setData(await res.json());
        setLoading(false);
      } catch { setErrorMsg('Something went wrong'); setLoading(false); }
    })();
  }, [id, token, logout]);

  useEffect(() => {
    if (!confirmCancel) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setConfirmCancel(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [confirmCancel]);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 2500); }

  async function handleCancel() {
    if (!data) return;
    setCanceling(true);
    try {
      const res = await fetch(`/api/sessions/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ status: 'canceled' }),
      });
      if (res.status === 401) { logout(); return; }
      if (res.ok) {
        setData(prev => prev ? { ...prev, session: { ...prev.session, status: 'canceled' } } : prev);
        setConfirmCancel(false);
        showToast('Session canceled');
      }
    } catch { /* silent */ }
    setCanceling(false);
  }
  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text);
    showToast(label + ' copied!');
  }

  function getInitials(first: string, last: string) {
    return (first.charAt(0) + last.charAt(0)).toUpperCase();
  }

  function getSlug(fn: string, ln: string) {
    return (fn.trim() + '_' + ln.trim()).toLowerCase().replace(/\s+/g, '_');
  }

  function getStatusLabel(status: string) {
    return status === 'scheduled' ? 'upcoming' : status;
  }

  function getStatusText(status: string) {
    return status === 'scheduled' ? 'Upcoming' : status === 'completed' ? 'Completed' : 'Canceled';
  }

  return (
    <>
      <style jsx global>{`
        /* ── Session Detail tokens ── */
        .sd-page {
          --sd-font: 'Poppins', sans-serif;
          --sd-bg: #f9fbfc;
          --sd-surface: #ffffff;
          --sd-text: #1a2e44;
          --sd-text-2: #5f7a8f;
          --sd-text-3: #8ba3b5;
          --sd-border: #d8e3ec;
          --sd-accent: #2db5c0;
          --sd-accent-light: #ddf1f3;
          --sd-accent-dark: #2a6270;
          --sd-green: #10b981;
          --sd-green-bg: #ecfdf5;
          --sd-green-dark: #047857;
          --sd-amber: #f59e0b;
          --sd-amber-bg: #fffbeb;
          --sd-amber-dark: #b45309;
          --sd-red: #ef4444;
          --sd-red-bg: #fef2f2;
          --sd-gray: #9ca3af;
          --sd-gray-bg: #f3f4f6;
          --sd-shadow-sm: 0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02);
          --sd-shadow-md: 0 4px 16px rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.03);
          font-family: var(--sd-font);
        }

        /* ── Staggered entrance ── */
        @keyframes sd-rise {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .sd-anim-1 { animation: sd-rise 0.45s ease-out 0.04s both; }
        .sd-anim-2 { animation: sd-rise 0.45s ease-out 0.1s both; }
        .sd-anim-3 { animation: sd-rise 0.45s ease-out 0.18s both; }
        .sd-anim-4 { animation: sd-rise 0.45s ease-out 0.26s both; }
        .sd-anim-5 { animation: sd-rise 0.45s ease-out 0.34s both; }

        /* ── Top bar (back + page actions) ── */
        .sd-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 22px;
        }
        .sd-back {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-family: var(--sd-font);
          font-size: 0.8rem;
          font-weight: 500;
          color: var(--sd-text-3);
          text-decoration: none;
          transition: color 0.15s;
        }
        .sd-back:hover { color: var(--sd-accent); }
        .sd-back svg {
          width: 14px; height: 14px;
          stroke: currentColor; stroke-width: 2; fill: none;
        }

        /* ── Hero card ── */
        .sd-hero {
          background: var(--sd-surface);
          border-radius: 14px;
          padding: 0;
          box-shadow: var(--sd-shadow-sm);
          margin-bottom: 20px;
          overflow: hidden;
          position: relative;
        }
        .sd-hero-accent {
          height: 4px;
          width: 100%;
        }
        .sd-hero-accent.upcoming {
          background: linear-gradient(90deg, #f59e0b, #fbbf24, #f59e0b);
          background-size: 200% 100%;
        }
        .sd-hero-accent.completed {
          background: linear-gradient(90deg, #10b981, #34d399, #10b981);
          background-size: 200% 100%;
        }
        .sd-hero-accent.canceled {
          background: linear-gradient(90deg, #9ca3af, #d1d5db, #9ca3af);
          background-size: 200% 100%;
        }
        .sd-hero-body {
          padding: 28px 32px 24px;
        }
        .sd-hero-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 24px;
        }
        .sd-hero-info { flex: 1; min-width: 0; }
        .sd-hero-title {
          font-family: var(--sd-font);
          font-size: 1.35rem;
          font-weight: 700;
          color: var(--sd-text);
          letter-spacing: -0.025em;
          line-height: 1.25;
          margin-bottom: 8px;
        }
        .sd-hero-desc {
          font-size: 0.82rem;
          color: var(--sd-text-2);
          line-height: 1.5;
          margin-bottom: 12px;
        }
        .sd-hero-meta {
          display: flex;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
        }
        .sd-meta-chip {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 0.75rem;
          color: var(--sd-text-2);
        }
        .sd-meta-chip svg {
          width: 13px; height: 13px;
          stroke: var(--sd-text-3); stroke-width: 1.8; fill: none;
        }
        .sd-hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          border-radius: 8px;
          font-size: 0.75rem;
          font-weight: 600;
          flex-shrink: 0;
          letter-spacing: 0.01em;
        }
        .sd-hero-badge.upcoming { background: var(--sd-amber-bg); color: var(--sd-amber-dark); }
        .sd-hero-badge.completed { background: var(--sd-green-bg); color: var(--sd-green-dark); }
        .sd-hero-badge.canceled { background: var(--sd-red-bg); color: var(--sd-red); }
        .sd-hero-badge::before {
          content: '';
          width: 7px; height: 7px;
          border-radius: 50%;
        }
        .sd-hero-badge.upcoming::before { background: var(--sd-amber); }
        .sd-hero-badge.completed::before { background: var(--sd-green); }
        .sd-hero-badge.canceled::before { background: var(--sd-red); }

        /* ── Date/time prominence block ── */
        .sd-datetime-strip {
          display: flex;
          align-items: stretch;
          gap: 1px;
          background: var(--sd-border);
          border-top: 1px solid var(--sd-border);
          border-radius: 0 0 14px 14px;
          overflow: hidden;
        }
        .sd-dt-cell {
          flex: 1;
          background: #fafcfd;
          padding: 16px 24px;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .sd-dt-icon {
          width: 36px; height: 36px; min-width: 36px;
          border-radius: 9px;
          display: flex; align-items: center; justify-content: center;
        }
        .sd-dt-icon svg {
          width: 16px; height: 16px;
          stroke-width: 1.8; fill: none;
        }
        .sd-dt-icon.teal { background: var(--sd-accent-light); }
        .sd-dt-icon.teal svg { stroke: var(--sd-accent); }
        .sd-dt-icon.blue { background: #dbeafe; }
        .sd-dt-icon.blue svg { stroke: #3b82f6; }
        .sd-dt-icon.purple { background: #f3e8ff; }
        .sd-dt-icon.purple svg { stroke: #7c3aed; }
        .sd-dt-text {
          display: flex; flex-direction: column;
        }
        .sd-dt-label {
          font-size: 0.65rem;
          font-weight: 500;
          color: var(--sd-text-3);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          margin-bottom: 2px;
        }
        .sd-dt-value {
          font-size: 0.88rem;
          font-weight: 600;
          color: var(--sd-text);
          letter-spacing: -0.01em;
        }

        /* ── Two-column layout ── */
        .sd-columns {
          display: grid;
          grid-template-columns: 1fr 320px;
          gap: 20px;
          align-items: start;
        }

        /* ── Detail properties card ── */
        .sd-props-card {
          background: var(--sd-surface);
          border-radius: 12px;
          box-shadow: var(--sd-shadow-sm);
          overflow: hidden;
        }
        .sd-props-header {
          padding: 18px 24px 0;
          font-size: 0.78rem;
          font-weight: 600;
          color: var(--sd-text);
          letter-spacing: -0.01em;
        }
        .sd-props-list {
          padding: 16px 24px 20px;
          display: flex;
          flex-direction: column;
          gap: 0;
        }
        .sd-prop-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 0;
          border-bottom: 1px solid #f0f4f7;
        }
        .sd-prop-row:last-child { border-bottom: none; }
        .sd-prop-label {
          font-size: 0.75rem;
          color: var(--sd-text-3);
          font-weight: 400;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .sd-prop-label svg {
          width: 14px; height: 14px;
          stroke: var(--sd-text-3); stroke-width: 1.6; fill: none;
          flex-shrink: 0;
        }
        .sd-prop-value {
          font-size: 0.8rem;
          font-weight: 500;
          color: var(--sd-text);
          text-align: right;
        }
        .sd-type-badge {
          display: inline-block;
          padding: 2px 10px;
          border-radius: 4px;
          font-size: 0.7rem;
          font-weight: 500;
          text-transform: capitalize;
        }
        .sd-type-badge.private { background: #f5f3ff; color: #7c3aed; }
        .sd-type-badge.group { background: #eff6ff; color: #2563eb; }
        .sd-status-badge-sm {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 2px 10px;
          border-radius: 4px;
          font-size: 0.7rem;
          font-weight: 500;
          text-transform: capitalize;
        }
        .sd-status-badge-sm.upcoming { background: var(--sd-amber-bg); color: var(--sd-amber-dark); }
        .sd-status-badge-sm.completed { background: var(--sd-green-bg); color: var(--sd-green-dark); }
        .sd-status-badge-sm.canceled { background: var(--sd-red-bg); color: var(--sd-red); }

        /* ── Student card (right column) ── */
        .sd-student-card {
          background: var(--sd-surface);
          border-radius: 10px;
          box-shadow: var(--sd-shadow-sm);
          padding: 16px 18px;
        }
        .sd-student-header {
          font-size: 0.62rem;
          font-weight: 600;
          color: var(--sd-text-3);
          text-transform: uppercase;
          letter-spacing: 0.07em;
          margin-bottom: 12px;
        }
        .sd-student-profile {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 12px;
        }
        .sd-student-avatar {
          width: 34px; height: 34px; min-width: 34px;
          border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          font-family: var(--sd-font);
          font-size: 0.68rem; font-weight: 700;
          color: #fff; letter-spacing: 0.03em;
          background: linear-gradient(135deg, #2db5c0 0%, #2dd4bf 100%);
          flex-shrink: 0;
        }
        .sd-student-name-block { min-width: 0; }
        .sd-student-name {
          font-size: 0.82rem;
          font-weight: 600;
          color: var(--sd-text);
          letter-spacing: -0.01em;
          margin-bottom: 1px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .sd-student-name a {
          color: inherit;
          text-decoration: none;
          transition: color 0.15s;
        }
        .sd-student-name a:hover { color: var(--sd-accent); }
        .sd-student-level {
          font-size: 0.65rem;
          color: var(--sd-text-3);
        }
        .sd-student-details {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-bottom: 12px;
        }
        .sd-student-row {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.72rem;
          color: var(--sd-text-2);
        }
        .sd-student-row svg {
          width: 12px; height: 12px;
          stroke: var(--sd-text-3); stroke-width: 1.6; fill: none;
          flex-shrink: 0;
        }
        .sd-student-actions {
          display: flex;
          gap: 6px;
        }
        .sd-student-action {
          flex: 1;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          padding: 6px 8px;
          border-radius: 6px;
          font-family: var(--sd-font);
          font-size: 0.68rem;
          font-weight: 500;
          border: 1px solid var(--sd-border);
          background: var(--sd-surface);
          color: var(--sd-text-2);
          cursor: pointer;
          transition: all 0.15s;
          text-decoration: none;
          white-space: nowrap;
        }
        .sd-student-action:hover {
          border-color: var(--sd-accent);
          color: var(--sd-accent);
          background: #f0fdfa;
        }
        .sd-student-action svg {
          width: 11px; height: 11px;
          stroke: currentColor; stroke-width: 1.8; fill: none;
        }
        .sd-student-action.primary {
          background: var(--sd-accent);
          border-color: var(--sd-accent);
          color: #fff;
        }
        .sd-student-action.primary:hover {
          background: var(--sd-accent-dark);
          border-color: var(--sd-accent-dark);
          color: #fff;
        }

        /* ── Related sessions ── */
        .sd-related {
          background: var(--sd-surface);
          border-radius: 12px;
          box-shadow: var(--sd-shadow-sm);
          padding: 20px 24px;
        }
        .sd-related-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 14px;
        }
        .sd-related-title {
          font-size: 0.78rem;
          font-weight: 600;
          color: var(--sd-text);
          letter-spacing: -0.01em;
        }
        .sd-related-count {
          font-size: 0.68rem;
          color: var(--sd-text-3);
          background: #edf2f7;
          padding: 2px 9px;
          border-radius: 10px;
          font-weight: 500;
        }
        .sd-related-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .sd-related-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 14px;
          border-radius: 8px;
          background: #fafcfd;
          transition: all 0.15s;
          text-decoration: none;
          cursor: pointer;
        }
        .sd-related-item:hover {
          background: var(--sd-accent-light);
          transform: translateX(2px);
        }
        .sd-rel-indicator {
          width: 3px; height: 28px;
          border-radius: 3px;
          flex-shrink: 0;
        }
        .sd-rel-indicator.upcoming { background: var(--sd-amber); }
        .sd-rel-indicator.completed { background: var(--sd-green); }
        .sd-rel-indicator.canceled { background: #d1d5db; }
        .sd-rel-info { flex: 1; min-width: 0; }
        .sd-rel-title {
          font-size: 0.76rem;
          font-weight: 500;
          color: var(--sd-text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-bottom: 1px;
        }
        .sd-rel-date {
          font-size: 0.66rem;
          color: var(--sd-text-3);
        }
        .sd-rel-badge {
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 0.62rem;
          font-weight: 500;
          flex-shrink: 0;
          text-transform: capitalize;
        }
        .sd-rel-badge.upcoming { background: var(--sd-amber-bg); color: var(--sd-amber-dark); }
        .sd-rel-badge.completed { background: var(--sd-green-bg); color: var(--sd-green-dark); }
        .sd-rel-badge.canceled { background: var(--sd-gray-bg); color: var(--sd-gray); }
        .sd-rel-arrow {
          width: 14px; height: 14px;
          stroke: var(--sd-text-3);
          stroke-width: 1.6;
          fill: none;
          flex-shrink: 0;
          opacity: 0;
          transform: translateX(-4px);
          transition: all 0.2s;
        }
        .sd-related-item:hover .sd-rel-arrow {
          opacity: 1;
          transform: translateX(0);
        }
        .sd-related-empty {
          text-align: center;
          padding: 24px 16px;
          font-size: 0.75rem;
          color: var(--sd-text-3);
        }

        /* ── Loading / Error ── */
        @keyframes sd-spin { to { transform: rotate(360deg); } }
        .sd-loading {
          display: flex; align-items: center; justify-content: center;
          height: 50vh;
          font-size: 0.85rem; color: var(--sd-text-3);
          font-family: var(--sd-font);
        }
        .sd-loading-ring {
          width: 18px; height: 18px;
          border: 2px solid var(--sd-border);
          border-top-color: var(--sd-accent);
          border-radius: 50%;
          animation: sd-spin 0.6s linear infinite;
          margin-right: 10px;
        }
        .sd-error {
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          height: 50vh; text-align: center;
          font-family: var(--sd-font);
        }
        .sd-error h2 {
          font-size: 1.2rem; font-weight: 600;
          margin-bottom: 8px; color: var(--sd-text);
        }
        .sd-error p {
          font-size: 0.85rem; color: var(--sd-text-3);
          margin-bottom: 24px;
        }
        .sd-error a {
          font-size: 0.8rem; font-weight: 500;
          color: var(--sd-accent); text-decoration: none;
          border-bottom: 1px solid rgba(45,181,192,0.3);
          padding-bottom: 1px; transition: border-color 0.15s;
        }
        .sd-error a:hover { border-color: var(--sd-accent); }

        /* ── Cancel button ── */
        .sd-cancel-btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 7px 14px; border-radius: 8px;
          font-family: var(--sd-font);
          font-size: 0.76rem; font-weight: 500;
          color: #dc2626; background: #fef2f2;
          border: 1px solid #fecaca; cursor: pointer;
          transition: all 0.15s;
        }
        .sd-cancel-btn:hover { background: #fee2e2; border-color: #fca5a5; }
        .sd-cancel-btn svg { width: 13px; height: 13px; stroke: currentColor; stroke-width: 2; fill: none; stroke-linecap: round; flex-shrink: 0; }

        /* ── Cancel modal (shared) ── */
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
          background: #fff; border-radius: 16px;
          padding: 28px 28px 24px; width: 340px;
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
        .cancel-modal-icon svg { width: 20px; height: 20px; stroke: #dc2626; stroke-width: 2; fill: none; stroke-linecap: round; }
        .cancel-modal-title { font-family: 'Poppins', sans-serif; font-size: 1rem; font-weight: 700; color: #1a2e44; letter-spacing: -0.02em; }
        .cancel-modal-body { font-size: 0.8rem; color: #5f7a8f; line-height: 1.55; max-width: 260px; }
        .cancel-modal-body strong { color: #1a2e44; font-weight: 600; }
        .cancel-modal-actions { display: flex; gap: 8px; width: 100%; margin-top: 4px; }
        .cancel-modal-keep {
          flex: 1; padding: 10px;
          font-family: 'Poppins', sans-serif; font-size: 0.82rem; font-weight: 500; color: #5f7a8f;
          background: #f5f7fa; border: none; border-radius: 9px; cursor: pointer; transition: background 0.13s;
        }
        .cancel-modal-keep:hover { background: #e9edf1; color: #1a2e44; }
        .cancel-modal-confirm {
          flex: 1; padding: 10px;
          font-family: 'Poppins', sans-serif; font-size: 0.82rem; font-weight: 600; color: #fff;
          background: #dc2626; border: none; border-radius: 9px; cursor: pointer; transition: background 0.13s;
        }
        .cancel-modal-confirm:hover:not(:disabled) { background: #b91c1c; }
        .cancel-modal-confirm:disabled { opacity: 0.55; cursor: not-allowed; }

        /* ── Toast ── */
        .sd-toast {
          position: fixed;
          bottom: 30px;
          left: 50%;
          transform: translateX(-50%) translateY(100px);
          background: var(--sd-text);
          color: white;
          padding: 10px 20px;
          border-radius: 8px;
          font-family: var(--sd-font);
          font-size: 0.78rem;
          font-weight: 500;
          z-index: 300;
          transition: transform 0.3s;
          white-space: nowrap;
        }
        .sd-toast.show { transform: translateX(-50%) translateY(0); }

        /* ── Responsive ── */
        @media (max-width: 860px) {
          .sd-columns {
            grid-template-columns: 1fr;
          }
          .sd-datetime-strip {
            flex-direction: column;
          }
        }
        @media (max-width: 600px) {
          .sd-hero-body { padding: 22px 20px 18px; }
          .sd-hero-top { flex-direction: column; gap: 12px; }
          .sd-hero-title { font-size: 1.15rem; }
          .sd-dt-cell { padding: 12px 16px; }
          .sd-props-list { padding: 12px 16px 16px; }
          .sd-props-header { padding: 14px 16px 0; }
          .sd-student-card { padding: 14px 16px; }
          .sd-related { padding: 16px; }
        }
      `}</style>

      <div className="sd-page">
        {loading && <div className="sd-loading"><div className="sd-loading-ring"></div> Loading session&hellip;</div>}

        {errorMsg && (
          <div className="sd-error">
            <h2>{errorMsg}</h2>
            <p>The session details could not be loaded.</p>
            <Link href="/admin/sessions">Back to Sessions</Link>
          </div>
        )}

        {data && (() => {
          const s = data.session;
          const st = data.student;
          const related = data.relatedSessions;
          const d = new Date(s.date);
          const statusLabel = getStatusLabel(s.status);
          const dateStr = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
          const startTime = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
          const endDate = new Date(d.getTime() + s.duration * 60000);
          const endTime = endDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
          const studentName = st ? `${st.firstName} ${st.lastName}` : 'Unknown';
          const avatar = st ? getAvatarStyle(st.firstName + st.lastName) : avatarPalette[0];

          return (
            <div>
              {/* Back link + page actions */}
              <div className="sd-topbar sd-anim-1">
                <Link href="/admin/sessions" className="sd-back">
                  <svg viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Back to sessions
                </Link>
                {s.status === 'scheduled' && (
                  <button className="sd-cancel-btn" onClick={() => setConfirmCancel(true)}>
                    <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                    Cancel Session
                  </button>
                )}
              </div>

              {/* Hero card */}
              <div className="sd-hero sd-anim-1">
                <div className={`sd-hero-accent ${statusLabel}`} />
                <div className="sd-hero-body">
                  <div className="sd-hero-top">
                    <div className="sd-hero-info">
                      <div className="sd-hero-title">{s.title}</div>
                      {s.description && <div className="sd-hero-desc">{s.description}</div>}
                      <div className="sd-hero-meta">
                        <span className="sd-meta-chip">
                          <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                          {studentName}
                        </span>
                        <span className="sd-meta-chip">
                          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                          {s.duration} min
                        </span>
                        <span className="sd-meta-chip">
                          <svg viewBox="0 0 24 24">{st?.type === 'group' ? <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></> : <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>}</svg>
                          {st?.type === 'group' ? 'Group' : 'Private'} class
                        </span>
                      </div>
                    </div>
                    <span className={`sd-hero-badge ${statusLabel}`}>
                      {getStatusText(s.status)}
                    </span>
                  </div>
                </div>
                <div className="sd-datetime-strip">
                  <div className="sd-dt-cell">
                    <div className="sd-dt-icon teal">
                      <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    </div>
                    <div className="sd-dt-text">
                      <span className="sd-dt-label">Date</span>
                      <span className="sd-dt-value">{dateStr}</span>
                    </div>
                  </div>
                  <div className="sd-dt-cell">
                    <div className="sd-dt-icon blue">
                      <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    </div>
                    <div className="sd-dt-text">
                      <span className="sd-dt-label">Time</span>
                      <span className="sd-dt-value">{startTime} &ndash; {endTime}</span>
                    </div>
                  </div>
                  <div className="sd-dt-cell">
                    <div className="sd-dt-icon purple">
                      <svg viewBox="0 0 24 24"><path d="M5 3v4M3 5h4M6 17v4M4 19h4M13 3l2 2-2 2M19 13l2 2-2 2M21 3l-9 9"/></svg>
                    </div>
                    <div className="sd-dt-text">
                      <span className="sd-dt-label">Duration</span>
                      <span className="sd-dt-value">{s.duration} minutes</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Two-column layout */}
              <div className="sd-columns">
                {/* Left: Details + Related */}
                <div>
                  {/* Session properties */}
                  <div className="sd-props-card sd-anim-2" style={{ marginBottom: 20 }}>
                    <div className="sd-props-header">Session Details</div>
                    <div className="sd-props-list">
                      <div className="sd-prop-row">
                        <span className="sd-prop-label">
                          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                          Session ID
                        </span>
                        <span className="sd-prop-value" style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--sd-text-3)' }}>{s.id}</span>
                      </div>
                      <div className="sd-prop-row">
                        <span className="sd-prop-label">
                          <svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                          Status
                        </span>
                        <span className={`sd-status-badge-sm ${statusLabel}`}>{getStatusText(s.status)}</span>
                      </div>
                      <div className="sd-prop-row">
                        <span className="sd-prop-label">
                          <svg viewBox="0 0 24 24">{st?.type === 'group' ? <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></> : <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>}</svg>
                          Class Type
                        </span>
                        <span className={`sd-type-badge ${st?.type || 'private'}`}>{st?.type || 'private'}</span>
                      </div>
                      <div className="sd-prop-row">
                        <span className="sd-prop-label">
                          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                          Duration
                        </span>
                        <span className="sd-prop-value">{s.duration} min</span>
                      </div>
                      {st && (
                        <div className="sd-prop-row">
                          <span className="sd-prop-label">
                            <svg viewBox="0 0 24 24"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                            Student Level
                          </span>
                          <span className="sd-prop-value">{st.englishLevel}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Related sessions from same student */}
                  <div className="sd-related sd-anim-4">
                    <div className="sd-related-header">
                      <span className="sd-related-title">Other Sessions with {st ? st.firstName : 'Student'}</span>
                      <span className="sd-related-count">{related.length}</span>
                    </div>
                    {related.length === 0 ? (
                      <div className="sd-related-empty">No other sessions found for this student</div>
                    ) : (
                      <div className="sd-related-list">
                        {related.map(r => {
                          const rd = new Date(r.date);
                          const rDateStr = rd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                          const rTime = rd.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                          const rStatus = getStatusLabel(r.status);
                          return (
                            <Link href={`/admin/sessions/${r.id}`} key={r.id} className="sd-related-item">
                              <div className={`sd-rel-indicator ${rStatus}`} />
                              <div className="sd-rel-info">
                                <div className="sd-rel-title">{r.title}</div>
                                <div className="sd-rel-date">{rDateStr} &middot; {rTime} &middot; {r.duration} min</div>
                              </div>
                              <span className={`sd-rel-badge ${rStatus}`}>{getStatusText(r.status)}</span>
                              <svg className="sd-rel-arrow" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Student card */}
                <div>
                  <div className="sd-student-card sd-anim-3">
                    <div className="sd-student-header">Student</div>
                    {st ? (
                      <>
                        <div className="sd-student-profile">
                          <div className="sd-student-avatar" style={st ? {} : { background: avatar.bg, color: avatar.text }}>
                            {getInitials(st.firstName, st.lastName)}
                          </div>
                          <div className="sd-student-name-block">
                            <div className="sd-student-name">
                              <Link href={`/admin/student/${getSlug(st.firstName, st.lastName)}`}>
                                {st.firstName} {st.lastName}
                              </Link>
                            </div>
                            <div className="sd-student-level">{st.englishLevel} &middot; {st.type === 'group' ? 'Group' : 'Private'}</div>
                          </div>
                        </div>
                        <div className="sd-student-details">
                          <div className="sd-student-row">
                            <svg viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                            {st.email}
                          </div>
                          <div className="sd-student-row">
                            <svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                            {st.phone}
                          </div>
                        </div>
                        <div className="sd-student-actions">
                          <a href={`mailto:${st.email}`} className="sd-student-action">
                            <svg viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                            Email
                          </a>
                          <button className="sd-student-action" onClick={() => copyToClipboard(st.phone, 'Phone')}>
                            <svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                            Copy Phone
                          </button>
                          <Link href={`/admin/student/${getSlug(st.firstName, st.lastName)}`} className="sd-student-action primary">
                            <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                            Profile
                          </Link>
                        </div>
                      </>
                    ) : (
                      <div className="sd-related-empty">Student information not available</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {confirmCancel && data && typeof document !== 'undefined' && createPortal(
        <div className="cancel-modal-backdrop" onMouseDown={() => setConfirmCancel(false)}>
          <div className="cancel-modal" onMouseDown={e => e.stopPropagation()}>
            <div className="cancel-modal-icon">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            </div>
            <div className="cancel-modal-title">Cancel Session</div>
            <div className="cancel-modal-body">
              <strong>{data.session.title}</strong> will be marked as canceled. This can&apos;t be undone.
            </div>
            <div className="cancel-modal-actions">
              <button className="cancel-modal-keep" onClick={() => setConfirmCancel(false)}>Keep Session</button>
              <button className="cancel-modal-confirm" disabled={canceling} onClick={handleCancel}>
                {canceling ? 'Canceling…' : 'Cancel Session'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <div className={`sd-toast ${toast ? 'show' : ''}`} style={{ visibility: toast ? 'visible' : 'hidden' }}>{toast}</div>
    </>
  );
}
