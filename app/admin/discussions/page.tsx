'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useAdmin } from '../admin-context';

interface DiscussionEnrollment {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  age?: number;
  englishLevel: string;
  discussionId?: number;
  discussionTopic?: string;
  priorExperience?: string;
  goals?: string;
  registeredAt?: string;
}

const PER_PAGE = 10;

export default function DiscussionsPage() {
  const { token, logout } = useAdmin();
  const [enrollments, setEnrollments] = useState<DiscussionEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [openMenu, setOpenMenu] = useState<{ idx: number; top: number; left: number } | null>(null);
  const [detailModal, setDetailModal] = useState<DiscussionEnrollment | null>(null);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch('/api/registrations', { headers: { Authorization: 'Bearer ' + token } });
        if (res.status === 401) { logout(); return; }
        if (!res.ok) throw new Error();
        const all: (DiscussionEnrollment & { type?: string })[] = await res.json();
        setEnrollments(all.filter(r => r.type === 'discussion'));
      } catch { showToast('Failed to load discussion enrollments.'); }
      setLoading(false);
    })();
  }, [token, logout]);

  useEffect(() => {
    if (!openMenu) return;
    const close = () => setOpenMenu(null);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [openMenu]);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000); }

  function getInitials(first: string, last: string) {
    return (first[0] || '').toUpperCase() + (last[0] || '').toUpperCase();
  }

  const avatarColors = [
    { bg: '#ddf1f3', text: '#2a6270' },
    { bg: '#f5f3ff', text: '#6d28d9' },
    { bg: '#fef0e9', text: '#c2410c' },
    { bg: '#ecfdf5', text: '#059669' },
    { bg: '#eff6ff', text: '#2563eb' },
    { bg: '#fef3c7', text: '#b45309' },
    { bg: '#fce7f3', text: '#be185d' },
  ];

  function getAvatarColor(name: string) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return avatarColors[Math.abs(hash) % avatarColors.length];
  }

  const filtered = enrollments.filter(e => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (e.firstName + ' ' + e.lastName).toLowerCase().includes(term) ||
      e.email.toLowerCase().includes(term) ||
      (e.discussionTopic || '').toLowerCase().includes(term) ||
      e.englishLevel.toLowerCase().includes(term);
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paged = filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);
  const showFrom = filtered.length === 0 ? 0 : (currentPage - 1) * PER_PAGE + 1;
  const showTo = Math.min(currentPage * PER_PAGE, filtered.length);

  // Group by topic for stats
  const topicCounts = enrollments.reduce<Record<string, number>>((acc, e) => {
    const topic = e.discussionTopic || 'Unknown';
    acc[topic] = (acc[topic] || 0) + 1;
    return acc;
  }, {});

  return (
    <>
      <style jsx global>{`
        /* ── Discussion Enrollments ── */
        .de-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; }
        .de-title { font-family: 'DM Sans', sans-serif; font-size: 1.3rem; font-weight: 600; color: #1a2e44; letter-spacing: -0.02em; margin-bottom: 4px; }
        .de-subtitle { font-size: 0.8125rem; color: #8ba3b5; font-weight: 400; }
        .de-create-btn {
          display: flex; align-items: center; gap: 6px; padding: 9px 20px;
          font-family: 'DM Sans', sans-serif; font-size: 0.8125rem; font-weight: 600;
          color: #fff; background: #2db5c0; border: none; border-radius: 8px;
          cursor: pointer; transition: all 0.15s; text-decoration: none; white-space: nowrap;
        }
        .de-create-btn:hover { background: #2a6270; }
        .de-create-btn svg { width: 15px; height: 15px; stroke: currentColor; stroke-width: 2.5; fill: none; stroke-linecap: round; stroke-linejoin: round; }

        .de-stats { display: flex; gap: 12px; margin-bottom: 22px; flex-wrap: wrap; }
        .de-stat {
          display: flex; align-items: center; gap: 10px;
          padding: 14px 20px; border-radius: 10px;
          background: #fff; border: 1px solid #f0f3f6;
          box-shadow: 0 1px 4px rgba(0,0,0,0.03);
          min-width: 160px; flex: 1;
        }
        .de-stat-icon {
          width: 38px; height: 38px; border-radius: 9px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .de-stat-icon svg { width: 18px; height: 18px; stroke-width: 2; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; }
        .de-stat-val { font-family: 'DM Sans', sans-serif; font-size: 1.15rem; font-weight: 700; color: #1a2e44; line-height: 1; }
        .de-stat-label { font-size: 0.68rem; color: #94a7b5; margin-top: 3px; }

        .de-toolbar { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; }
        .de-search-wrap { flex: 1; position: relative; max-width: 360px; }
        .de-search-wrap > svg { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); width: 16px; height: 16px; stroke: #8ba3b5; stroke-width: 2; fill: none; pointer-events: none; }
        .de-search {
          width: 100%; padding: 9px 14px 9px 38px; font-family: 'DM Sans', sans-serif; font-size: 0.8125rem;
          color: #1a2e44; background: #fff; border: 1px solid #d8e3ec; border-radius: 7px; outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .de-search::placeholder { color: #8ba3b5; }
        .de-search:focus { border-color: #2db5c0; box-shadow: 0 0 0 3px rgba(45,181,192,0.08); }

        .de-table-wrap { overflow: visible; border-radius: 10px; border: 1px solid #f0f3f6; background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.03); }
        .de-table { width: 100%; border-collapse: collapse; }
        .de-table th {
          padding: 11px 16px; font-family: 'DM Sans', sans-serif; font-size: 0.68rem; font-weight: 600;
          color: #94a7b5; text-transform: uppercase; letter-spacing: 0.07em;
          text-align: left; background: #fafcfd; border-bottom: 1px solid #f0f3f6; white-space: nowrap;
        }
        .de-table td {
          padding: 14px 16px; font-size: 0.8125rem; color: #5f7a8f;
          border-bottom: 1px solid #f5f8fa; vertical-align: middle;
        }
        .de-table tr:last-child td { border-bottom: none; }
        .de-table tr:hover td { background: #fafcfd; transition: background 0.15s; }

        .de-name-cell { display: flex; align-items: center; gap: 12px; }
        .de-avatar {
          width: 36px; height: 36px; min-width: 36px; border-radius: 9px;
          display: flex; align-items: center; justify-content: center;
          font-family: 'DM Sans', sans-serif; font-size: 0.65rem; font-weight: 700; letter-spacing: 0.03em;
        }
        .de-name { font-weight: 600; color: #1a2e44; font-family: 'DM Sans', sans-serif; font-size: 0.84rem; }
        .de-email { font-size: 0.72rem; color: #94a7b5; margin-top: 2px; }

        .de-topic {
          font-size: 0.8rem; font-weight: 500; color: #2db5c0;
          text-decoration: none; cursor: pointer; transition: color 0.15s;
          max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block;
        }
        .de-topic:hover { color: #2a6270; text-decoration: underline; }
        .de-level {
          display: inline-flex; padding: 3px 10px; border-radius: 5px;
          font-size: 0.7rem; font-weight: 500;
          background: #f5f8fa; color: #5f7a8f;
        }
        .de-exp { font-size: 0.78rem; }
        .de-exp.yes { color: #1a2e44; font-weight: 500; }
        .de-exp.no { color: #b0bfcc; }

        .de-date { font-size: 0.78rem; color: #5f7a8f; white-space: nowrap; font-weight: 400; }
        .de-date-ago { font-size: 0.66rem; color: #c5d2dc; margin-top: 2px; }

        .de-actions { position: relative; }
        .de-menu-btn {
          display: flex; align-items: center; justify-content: center;
          width: 28px; height: 28px; border-radius: 6px; background: none;
          border: none; cursor: pointer; color: #c5d2dc; transition: all 0.15s; padding: 0;
        }
        .de-menu-btn:hover, .de-menu-btn.open { background: #f0f4f8; color: #5f7a8f; }
        .de-dropdown {
          min-width: 160px; background: #fff; border: 1px solid #e8eef3;
          border-radius: 8px; box-shadow: 0 6px 20px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04);
          padding: 5px; animation: de-pop 0.15s ease-out both;
        }
        @keyframes de-pop { from { opacity: 0; transform: translateY(-4px) scale(0.97); } to { opacity: 1; transform: none; } }
        .de-drop-item {
          display: flex; align-items: center; gap: 8px; width: 100%;
          padding: 7px 10px; font-size: 0.78rem; color: #5f7a8f;
          background: none; border: none; cursor: pointer; border-radius: 5px;
          font-family: 'DM Sans', sans-serif; transition: background 0.1s;
        }
        .de-drop-item:hover { background: #f0f4f8; color: #2a6270; }
        .de-drop-item svg { width: 15px; height: 15px; stroke: currentColor; stroke-width: 2; fill: none; stroke-linecap: round; stroke-linejoin: round; }

        .de-pagination { display: flex; justify-content: space-between; align-items: center; padding: 16px 0 4px; }
        .de-pagination-info { font-size: 0.78rem; color: #94a7b5; }
        .de-pagination-btns { display: flex; gap: 5px; }
        .de-page-btn {
          width: 30px; height: 30px; border-radius: 6px; border: 1px solid #e8eef3;
          background: #fff; font-size: 0.73rem; font-weight: 600; color: #5f7a8f;
          cursor: pointer; transition: all 0.15s; font-family: 'DM Sans', sans-serif;
        }
        .de-page-btn:hover { border-color: #2db5c0; color: #2a6270; background: #ddf1f3; }
        .de-page-btn.active { background: #2db5c0; border-color: #2db5c0; color: #fff; }

        @keyframes de-empty-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .de-empty {
          text-align: center; padding: 60px 20px 52px;
          animation: de-empty-in 0.4s ease-out both;
        }
        .de-empty svg {
          width: 40px; height: 40px; stroke: #c5d2dc; stroke-width: 1.2; fill: none;
          display: block; margin: 0 auto 16px; stroke-linecap: round; stroke-linejoin: round;
        }
        .de-empty-title { font-size: 0.8125rem; font-weight: 500; color: #94a7b5; }
        .de-empty-hint { font-size: 0.75rem; color: #b8c9d6; margin-top: 4px; }

        /* ── Detail Modal ── */
        .de-modal-overlay {
          position: fixed; inset: 0; z-index: 200;
          background: rgba(26,46,68,0.18); backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center;
          animation: de-modal-in 0.2s ease both;
        }
        @keyframes de-modal-in { from { opacity: 0; } to { opacity: 1; } }
        .de-modal {
          width: 90%; max-width: 480px; padding: 0;
          background: #fff; border-radius: 12px;
          box-shadow: 0 20px 60px rgba(26,46,68,0.12);
          animation: de-modal-box 0.25s ease both;
          overflow: hidden;
        }
        @keyframes de-modal-box { from { opacity: 0; transform: translateY(12px) scale(0.97); } to { opacity: 1; transform: none; } }
        .de-modal-head {
          display: flex; align-items: center; justify-content: space-between;
          padding: 20px 24px 16px; border-bottom: 1px solid #f0f3f6;
        }
        .de-modal-title { font-family: 'DM Sans', sans-serif; font-size: 1rem; font-weight: 600; color: #1a2e44; }
        .de-modal-close {
          width: 30px; height: 30px; border-radius: 7px; border: none; background: #f5f8fa;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          color: #8ba3b5; transition: all 0.15s;
        }
        .de-modal-close:hover { background: #edf2f7; color: #5f7a8f; }
        .de-modal-close svg { width: 16px; height: 16px; stroke: currentColor; stroke-width: 2; fill: none; stroke-linecap: round; stroke-linejoin: round; }
        .de-modal-body { padding: 20px 24px 24px; }
        .de-modal-row { display: flex; margin-bottom: 16px; }
        .de-modal-label { flex: 0 0 120px; font-size: 0.73rem; font-weight: 600; color: #94a7b5; text-transform: uppercase; letter-spacing: 0.05em; padding-top: 2px; }
        .de-modal-val { flex: 1; font-size: 0.84rem; color: #1a2e44; line-height: 1.6; }
        .de-modal-row:last-child { margin-bottom: 0; }
        .de-modal-topic-tag {
          display: inline-flex; padding: 4px 12px; border-radius: 6px;
          font-size: 0.78rem; font-weight: 600; background: #fef0e9; color: #c2410c;
        }

        .de-toast {
          position: fixed; bottom: 30px; left: 50%;
          transform: translateX(-50%); background: #1a2e44; color: #fff;
          padding: 11px 22px; border-radius: 8px; font-size: 0.8125rem;
          font-family: 'DM Sans', sans-serif; z-index: 300;
          animation: de-toast-in 0.3s ease both;
        }
        @keyframes de-toast-in { from { opacity: 0; transform: translateX(-50%) translateY(20px); } to { opacity: 1; transform: translateX(-50%); } }

        @keyframes de-row { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }

        @media (max-width: 900px) {
          .de-table th:nth-child(4), .de-table td:nth-child(4),
          .de-table th:nth-child(5), .de-table td:nth-child(5) { display: none; }
        }
        @media (max-width: 768px) {
          .de-header { flex-direction: column; gap: 12px; }
          .de-stats { flex-direction: column; }
          .de-toolbar { flex-direction: column; }
          .de-search-wrap { max-width: 100%; }
          .de-table th, .de-table td { padding: 10px 12px; }
          .de-pagination { flex-direction: column; gap: 10px; align-items: flex-start; }
          .de-modal-row { flex-direction: column; gap: 4px; }
          .de-modal-label { flex: none; }
        }
      `}</style>

      <div className="de-header">
        <div>
          <div className="de-title">Discussion Enrollments</div>
          <div className="de-subtitle">Students enrolled in upcoming discussion sessions</div>
        </div>
        <Link href="/admin/discussions/create" className="de-create-btn">
          <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Discussion
        </Link>
      </div>

      {/* Stats */}
      <div className="de-stats">
        <div className="de-stat">
          <div className="de-stat-icon" style={{ background: '#ddf1f3', color: '#2a6270' }}>
            <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <div>
            <div className="de-stat-val">{enrollments.length}</div>
            <div className="de-stat-label">Total Enrolled</div>
          </div>
        </div>
        <div className="de-stat">
          <div className="de-stat-icon" style={{ background: '#fef0e9', color: '#c2410c' }}>
            <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </div>
          <div>
            <div className="de-stat-val">{Object.keys(topicCounts).length}</div>
            <div className="de-stat-label">Active Topics</div>
          </div>
        </div>
        <div className="de-stat">
          <div className="de-stat-icon" style={{ background: '#ecfdf5', color: '#059669' }}>
            <svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <div>
            <div className="de-stat-val">{enrollments.filter(e => e.priorExperience === 'yes').length}</div>
            <div className="de-stat-label">Returning</div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="de-toolbar">
        <div className="de-search-wrap">
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input className="de-search" placeholder="Search by name, topic..." value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }} />
        </div>
      </div>

      {/* Table */}
      {!loading && filtered.length === 0 ? (
        <div className="de-empty">
          {searchTerm ? (
            <>
              <svg viewBox="0 0 48 48"><circle cx="20" cy="20" r="14"/><line x1="30" y1="30" x2="42" y2="42"/><line x1="14" y1="20" x2="26" y2="20"/></svg>
              <div className="de-empty-title">No enrollments match your search</div>
              <div className="de-empty-hint">Try a different name or topic</div>
            </>
          ) : (
            <>
              <svg viewBox="0 0 48 48"><path d="M38 32a3 3 0 0 1-3 3H15l-7 7V11a3 3 0 0 1 3-3h24a3 3 0 0 1 3 3z"/><line x1="16" y1="18" x2="32" y2="18"/><line x1="16" y1="24" x2="28" y2="24"/></svg>
              <div className="de-empty-title">No discussion enrollments yet</div>
              <div className="de-empty-hint">Enrollments will appear when students sign up for discussions</div>
            </>
          )}
        </div>
      ) : !loading && (
        <>
          <div className="de-table-wrap">
            <table className="de-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Discussion Topic</th>
                  <th>Level</th>
                  <th>Experience</th>
                  <th>Enrolled</th>
                  <th style={{ width: 40 }} />
                </tr>
              </thead>
              <tbody>
                {paged.map((e, i) => {
                  const fullName = e.firstName + ' ' + e.lastName;
                  const ac = getAvatarColor(fullName);
                  const d = e.registeredAt ? new Date(e.registeredAt) : null;
                  const dateStr = d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
                  const timeAgo = d ? getTimeAgo(d) : '';

                  return (
                    <tr key={i} style={{ animation: `de-row 0.25s ease ${i * 0.03}s both`, cursor: 'pointer' }} onClick={() => setDetailModal(e)}>
                      <td>
                        <div className="de-name-cell">
                          <div className="de-avatar" style={{ background: ac.bg, color: ac.text }}>{getInitials(e.firstName, e.lastName)}</div>
                          <div>
                            <div className="de-name">{fullName}</div>
                            <div className="de-email">{e.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>{e.discussionId ? <a className="de-topic" href={`/discussions/${e.discussionId}`} target="_blank" onClick={ev => ev.stopPropagation()}>{e.discussionTopic || '—'}</a> : <span style={{ color: '#b0bfcc', fontSize: '0.8rem' }}>—</span>}</td>
                      <td><span className="de-level">{e.englishLevel}</span></td>
                      <td><span className={`de-exp ${e.priorExperience === 'yes' ? 'yes' : 'no'}`}>{e.priorExperience === 'yes' ? 'Yes' : 'First time'}</span></td>
                      <td>
                        <div className="de-date">{dateStr}</div>
                        {timeAgo && <div className="de-date-ago">{timeAgo}</div>}
                      </td>
                      <td className="de-actions" onClick={ev => ev.stopPropagation()}>
                        <button
                          className={`de-menu-btn${openMenu?.idx === i ? ' open' : ''}`}
                          onClick={ev => {
                            ev.stopPropagation();
                            if (openMenu?.idx === i) { setOpenMenu(null); return; }
                            const rect = (ev.currentTarget as HTMLButtonElement).getBoundingClientRect();
                            setOpenMenu({ idx: i, top: rect.bottom + 6, left: rect.right - 160 });
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="3" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="8" cy="13" r="1.5"/></svg>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="de-pagination">
              <span className="de-pagination-info">Showing {showFrom} to {showTo} of {filtered.length}</span>
              <div className="de-pagination-btns">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <button key={p} className={`de-page-btn ${p === currentPage ? 'active' : ''}`} onClick={() => setCurrentPage(p)}>{p}</button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Row menu portal */}
      {openMenu && typeof document !== 'undefined' && createPortal(
        <div
          className="de-dropdown"
          style={{ position: 'fixed', top: openMenu.top, left: openMenu.left, zIndex: 9999 }}
          onMouseDown={ev => ev.stopPropagation()}
        >
          {(() => {
            const e = paged[openMenu.idx];
            if (!e) return null;
            return (
              <>
                <button className="de-drop-item" onClick={() => { setOpenMenu(null); setDetailModal(e); }}>
                  <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  View Details
                </button>
                <button className="de-drop-item" onClick={() => { navigator.clipboard.writeText(e.email); setOpenMenu(null); showToast('Email copied'); }}>
                  <svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  Copy Email
                </button>
                <button className="de-drop-item" onClick={() => { navigator.clipboard.writeText(e.phone); setOpenMenu(null); showToast('Phone copied'); }}>
                  <svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  Copy Phone
                </button>
              </>
            );
          })()}
        </div>,
        document.body
      )}

      {/* Detail Modal */}
      {detailModal && (
        <div className="de-modal-overlay" onMouseDown={() => setDetailModal(null)}>
          <div className="de-modal" onMouseDown={e => e.stopPropagation()}>
            <div className="de-modal-head">
              <div className="de-modal-title">Enrollment Details</div>
              <button className="de-modal-close" onClick={() => setDetailModal(null)}>
                <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="de-modal-body">
              <div className="de-modal-row">
                <div className="de-modal-label">Name</div>
                <div className="de-modal-val">{detailModal.firstName} {detailModal.lastName}</div>
              </div>
              <div className="de-modal-row">
                <div className="de-modal-label">Email</div>
                <div className="de-modal-val">{detailModal.email}</div>
              </div>
              <div className="de-modal-row">
                <div className="de-modal-label">Phone</div>
                <div className="de-modal-val">{detailModal.phone}</div>
              </div>
              {detailModal.age && (
                <div className="de-modal-row">
                  <div className="de-modal-label">Age</div>
                  <div className="de-modal-val">{detailModal.age}</div>
                </div>
              )}
              <div className="de-modal-row">
                <div className="de-modal-label">Level</div>
                <div className="de-modal-val">{detailModal.englishLevel}</div>
              </div>
              <div className="de-modal-row">
                <div className="de-modal-label">Topic</div>
                <div className="de-modal-val"><span className="de-modal-topic-tag">{detailModal.discussionTopic || '—'}</span></div>
              </div>
              <div className="de-modal-row">
                <div className="de-modal-label">Experience</div>
                <div className="de-modal-val">{detailModal.priorExperience === 'yes' ? 'Has joined discussions before' : 'First time joining'}</div>
              </div>
              {detailModal.goals && (
                <div className="de-modal-row">
                  <div className="de-modal-label">Goals</div>
                  <div className="de-modal-val">{detailModal.goals}</div>
                </div>
              )}
              {detailModal.registeredAt && (
                <div className="de-modal-row">
                  <div className="de-modal-label">Enrolled</div>
                  <div className="de-modal-val">{new Date(detailModal.registeredAt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {toast && <div className="de-toast">{toast}</div>}
    </>
  );
}

function getTimeAgo(d: Date): string {
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return '';
}
