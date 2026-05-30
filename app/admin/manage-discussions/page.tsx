'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAdmin } from '../admin-context';

interface Discussion {
  id: number;
  topic: string;
  date?: string;
  time?: string;
  dates?: { date: string; time?: string }[];
  level: string;
  description: string;
  spots?: number;
  participants?: number;
  duration: string;
  points?: string[];
  status: string;
  thumbnail?: string;
}

export default function ManageDiscussionsPage() {
  const { token, logout } = useAdmin();
  const router = useRouter();
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [loading, setLoading] = useState(true);
  const [openMenu, setOpenMenu] = useState<{ idx: number; top: number; left: number } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Discussion | null>(null);
  const [toast, setToast] = useState('');
  const [tab, setTab] = useState<'all' | 'upcoming' | 'completed'>('all');

  useEffect(() => {
    if (!token) return;
    loadDiscussions();
  }, [token]);

  useEffect(() => {
    if (!openMenu) return;
    const close = () => setOpenMenu(null);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [openMenu]);

  async function loadDiscussions() {
    try {
      const res = await fetch('/api/discussions', { headers: { Authorization: 'Bearer ' + token } });
      if (res.status === 401) { logout(); return; }
      if (res.ok) setDiscussions(await res.json());
    } catch { showToast('Failed to load discussions'); }
    setLoading(false);
  }

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000); }

  async function handleDelete(d: Discussion) {
    try {
      const res = await fetch(`/api/discussions/${d.id}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + token },
      });
      if (res.status === 401) { logout(); return; }
      if (res.ok) {
        setDiscussions(prev => prev.filter(x => x.id !== d.id));
        showToast(`"${d.topic}" deleted`);
      }
    } catch { showToast('Failed to delete'); }
    setDeleteConfirm(null);
  }

  const filtered = tab === 'all' ? discussions : discussions.filter(d => d.status === tab);

  return (
    <>
      <style jsx global>{`
        .md-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; }
        .md-title { font-family: 'DM Sans', sans-serif; font-size: 1.3rem; font-weight: 600; color: #1a2e44; letter-spacing: -0.02em; margin-bottom: 4px; }
        .md-subtitle { font-size: 0.8125rem; color: #8ba3b5; font-weight: 400; }
        .md-create-btn {
          display: flex; align-items: center; gap: 6px; padding: 9px 20px;
          font-family: 'DM Sans', sans-serif; font-size: 0.8125rem; font-weight: 600;
          color: #fff; background: #2db5c0; border: none; border-radius: 8px;
          cursor: pointer; transition: all 0.15s; text-decoration: none; white-space: nowrap;
        }
        .md-create-btn:hover { background: #2a6270; }
        .md-create-btn svg { width: 15px; height: 15px; stroke: currentColor; stroke-width: 2.5; fill: none; stroke-linecap: round; stroke-linejoin: round; }

        .md-tabs { display: flex; gap: 4px; margin-bottom: 20px; background: #f5f8fa; border-radius: 8px; padding: 3px; width: fit-content; }
        .md-tab {
          padding: 7px 16px; border-radius: 6px; border: none; background: none;
          font-family: 'DM Sans', sans-serif; font-size: 0.78rem; font-weight: 500;
          color: #5f7a8f; cursor: pointer; transition: all 0.15s;
        }
        .md-tab:hover { color: #1a2e44; }
        .md-tab.active { background: #fff; color: #1a2e44; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }

        .md-table-wrap { border-radius: 10px; border: 1px solid #f0f3f6; background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.03); overflow: hidden; }
        .md-table { width: 100%; border-collapse: collapse; }
        .md-table th {
          padding: 11px 16px; font-family: 'DM Sans', sans-serif; font-size: 0.68rem; font-weight: 600;
          color: #94a7b5; text-transform: uppercase; letter-spacing: 0.07em;
          text-align: left; background: #fafcfd; border-bottom: 1px solid #f0f3f6; white-space: nowrap;
        }
        .md-table td { padding: 14px 16px; font-size: 0.8125rem; color: #5f7a8f; border-bottom: 1px solid #f5f8fa; vertical-align: middle; }
        .md-table tr:last-child td { border-bottom: none; }
        .md-table tr:hover td { background: #fafcfd; transition: background 0.15s; }

        .md-topic-cell { display: flex; align-items: center; gap: 12px; }
        .md-thumb {
          width: 44px; height: 44px; border-radius: 8px; object-fit: cover; flex-shrink: 0;
          border: 1px solid #f0f3f6;
        }
        .md-thumb-placeholder {
          width: 44px; height: 44px; border-radius: 8px; flex-shrink: 0;
          background: #f5f8fa; border: 1px solid #f0f3f6;
          display: flex; align-items: center; justify-content: center;
        }
        .md-thumb-placeholder svg {
          width: 18px; height: 18px; stroke: #b0bfcc; stroke-width: 1.5; fill: none;
          stroke-linecap: round; stroke-linejoin: round;
        }
        .md-topic { font-weight: 600; color: #1a2e44; font-family: 'DM Sans', sans-serif; font-size: 0.84rem; }
        .md-topic-desc { font-size: 0.72rem; color: #94a7b5; margin-top: 2px; max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .md-level { display: inline-flex; padding: 3px 10px; border-radius: 5px; font-size: 0.7rem; font-weight: 500; background: #f5f8fa; color: #5f7a8f; }
        .md-date-more {
          display: inline-block; margin-left: 6px; padding: 1px 7px; border-radius: 4px;
          font-size: 0.66rem; font-weight: 600; background: #edf9fa; color: #2a6270;
        }
        .md-status {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 3px 10px; border-radius: 5px; font-size: 0.7rem; font-weight: 600;
        }
        .md-status.upcoming { background: #fef0e9; color: #c2410c; }
        .md-status.completed { background: #ecfdf5; color: #059669; }
        .md-date { font-size: 0.78rem; color: #5f7a8f; white-space: nowrap; }

        .md-menu-btn {
          display: flex; align-items: center; justify-content: center;
          width: 28px; height: 28px; border-radius: 6px; background: none;
          border: none; cursor: pointer; color: #c5d2dc; transition: all 0.15s; padding: 0;
        }
        .md-menu-btn:hover, .md-menu-btn.open { background: #f0f4f8; color: #5f7a8f; }

        .md-dropdown {
          min-width: 150px; background: #fff; border: 1px solid #e8eef3;
          border-radius: 8px; box-shadow: 0 6px 20px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04);
          padding: 5px; animation: md-pop 0.15s ease-out both;
        }
        @keyframes md-pop { from { opacity: 0; transform: translateY(-4px) scale(0.97); } to { opacity: 1; transform: none; } }
        .md-drop-item {
          display: flex; align-items: center; gap: 8px; width: 100%;
          padding: 7px 10px; font-size: 0.78rem; color: #5f7a8f;
          background: none; border: none; cursor: pointer; border-radius: 5px;
          font-family: 'DM Sans', sans-serif; transition: background 0.1s;
        }
        .md-drop-item:hover { background: #f0f4f8; color: #2a6270; }
        .md-drop-item.danger { color: #ef4444; }
        .md-drop-item.danger:hover { background: #fef2f2; color: #dc2626; }
        .md-drop-item svg { width: 14px; height: 14px; stroke: currentColor; stroke-width: 2; fill: none; stroke-linecap: round; stroke-linejoin: round; }
        .md-drop-divider { height: 1px; background: #f0f3f6; margin: 4px 0; }

        @keyframes md-empty-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .md-empty {
          text-align: center; padding: 60px 20px 52px;
          animation: md-empty-in 0.4s ease-out both;
        }
        .md-empty svg {
          width: 40px; height: 40px; stroke: #c5d2dc; stroke-width: 1.2; fill: none;
          display: block; margin: 0 auto 16px; stroke-linecap: round; stroke-linejoin: round;
        }
        .md-empty-title { font-size: 0.8125rem; font-weight: 500; color: #94a7b5; }
        .md-empty-hint { font-size: 0.75rem; color: #b8c9d6; margin-top: 4px; }

        /* Modal */
        .md-overlay {
          position: fixed; inset: 0; z-index: 200;
          background: rgba(26,46,68,0.18); backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center;
          animation: md-overlay-in 0.2s ease both;
        }
        @keyframes md-overlay-in { from { opacity: 0; } to { opacity: 1; } }
        .md-modal {
          width: 90%; max-width: 440px; background: #fff; border-radius: 12px;
          box-shadow: 0 20px 60px rgba(26,46,68,0.12); overflow: hidden;
          animation: md-modal-in 0.25s ease both;
        }
        @keyframes md-modal-in { from { opacity: 0; transform: translateY(12px) scale(0.97); } to { opacity: 1; transform: none; } }
        .md-modal-head {
          display: flex; align-items: center; justify-content: space-between;
          padding: 20px 24px 16px; border-bottom: 1px solid #f0f3f6;
        }
        .md-modal-title { font-family: 'DM Sans', sans-serif; font-size: 1rem; font-weight: 600; color: #1a2e44; }
        .md-modal-close {
          width: 30px; height: 30px; border-radius: 7px; border: none; background: #f5f8fa;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          color: #8ba3b5; transition: all 0.15s;
        }
        .md-modal-close:hover { background: #edf2f7; color: #5f7a8f; }
        .md-modal-close svg { width: 16px; height: 16px; stroke: currentColor; stroke-width: 2; fill: none; stroke-linecap: round; stroke-linejoin: round; }
        .md-modal-body { padding: 20px 24px 24px; }
        .md-field { margin-bottom: 14px; }
        .md-field:last-child { margin-bottom: 0; }
        .md-field-label { display: block; font-size: 0.72rem; font-weight: 600; color: #5f7a8f; margin-bottom: 5px; }
        .md-field-input, .md-field-select, .md-field-textarea {
          width: 100%; padding: 8px 12px; font-family: 'DM Sans', sans-serif; font-size: 0.82rem;
          color: #1a2e44; background: #fff; border: 1px solid #d8e3ec; border-radius: 7px; outline: none;
          transition: border-color 0.2s;
        }
        .md-field-input:focus, .md-field-select:focus, .md-field-textarea:focus { border-color: #2db5c0; }
        .md-field-textarea { min-height: 70px; resize: vertical; line-height: 1.6; }
        .md-field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .md-modal-footer {
          display: flex; justify-content: flex-end; gap: 8px;
          padding: 16px 24px; border-top: 1px solid #f0f3f6;
        }
        .md-btn-cancel {
          padding: 8px 18px; border-radius: 7px; border: 1px solid #d8e3ec;
          background: #fff; font-family: 'DM Sans', sans-serif; font-size: 0.8rem;
          font-weight: 500; color: #5f7a8f; cursor: pointer; transition: all 0.15s;
        }
        .md-btn-cancel:hover { border-color: #94a7b5; color: #1a2e44; }
        .md-btn-save {
          padding: 8px 20px; border-radius: 7px; border: none;
          background: #2db5c0; font-family: 'DM Sans', sans-serif; font-size: 0.8rem;
          font-weight: 600; color: #fff; cursor: pointer; transition: all 0.15s;
        }
        .md-btn-save:hover { background: #2a6270; }
        .md-btn-save:disabled { opacity: 0.5; cursor: not-allowed; }
        .md-btn-delete {
          padding: 8px 20px; border-radius: 7px; border: none;
          background: #ef4444; font-family: 'DM Sans', sans-serif; font-size: 0.8rem;
          font-weight: 600; color: #fff; cursor: pointer; transition: all 0.15s;
        }
        .md-btn-delete:hover { background: #dc2626; }

        .md-confirm-text { font-size: 0.84rem; color: #5f7a8f; line-height: 1.6; margin-bottom: 4px; }
        .md-confirm-topic { font-weight: 600; color: #1a2e44; }

        .md-toast {
          position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%);
          background: #1a2e44; color: #fff; padding: 11px 22px; border-radius: 8px;
          font-size: 0.8125rem; font-family: 'DM Sans', sans-serif; z-index: 300;
          animation: md-toast-in 0.3s ease both;
        }
        @keyframes md-toast-in { from { opacity: 0; transform: translateX(-50%) translateY(20px); } to { opacity: 1; transform: translateX(-50%); } }

        @media (max-width: 768px) {
          .md-header { flex-direction: column; gap: 12px; }
          .md-table th, .md-table td { padding: 10px 12px; }
          .md-field-row { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="md-header">
        <div>
          <div className="md-title">Manage Discussions</div>
          <div className="md-subtitle">Create, edit, and delete discussion sessions</div>
        </div>
        <Link href="/admin/discussions/create" className="md-create-btn">
          <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Discussion
        </Link>
      </div>

      <div className="md-tabs">
        {(['all', 'upcoming', 'completed'] as const).map(t => (
          <button key={t} className={`md-tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {t === 'all' ? 'All' : t === 'upcoming' ? 'Upcoming' : 'Completed'}
          </button>
        ))}
      </div>

      {!loading && filtered.length === 0 ? (
        <div className="md-empty">
          <svg viewBox="0 0 48 48"><path d="M38 32a3 3 0 0 1-3 3H15l-7 7V11a3 3 0 0 1 3-3h24a3 3 0 0 1 3 3z"/><line x1="16" y1="18" x2="32" y2="18"/><line x1="16" y1="24" x2="28" y2="24"/></svg>
          <div className="md-empty-title">No {tab !== 'all' ? tab + ' ' : ''}discussions</div>
          <div className="md-empty-hint">Create a discussion to get started</div>
        </div>
      ) : !loading && (
        <div className="md-table-wrap">
          <table className="md-table">
            <thead>
              <tr>
                <th>Topic</th>
                <th>Level</th>
                <th>Date</th>
                <th>Duration</th>
                <th>Status</th>
                <th style={{ width: 40 }} />
              </tr>
            </thead>
            <tbody>
              {filtered.map((d, i) => {
                const displayDates = d.dates && d.dates.length > 0 ? d.dates : (d.date ? [{ date: d.date, time: d.time }] : []);
                return (
                <tr key={d.id}>
                  <td>
                    <div className="md-topic-cell">
                      {d.thumbnail ? (
                        <img src={d.thumbnail} alt="" className="md-thumb" />
                      ) : (
                        <div className="md-thumb-placeholder">
                          <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                        </div>
                      )}
                      <div>
                        <div className="md-topic">{d.topic}</div>
                        <div className="md-topic-desc">{d.description}</div>
                      </div>
                    </div>
                  </td>
                  <td><span className="md-level">{d.level}</span></td>
                  <td>
                    {displayDates.length > 0 ? (
                      <span className="md-date">
                        {displayDates[0].date}{displayDates[0].time ? ` · ${displayDates[0].time}` : ''}
                        {displayDates.length > 1 && <span className="md-date-more">+{displayDates.length - 1}</span>}
                      </span>
                    ) : (
                      <span className="md-date">—</span>
                    )}
                  </td>
                  <td><span className="md-date">{d.duration}</span></td>
                  <td><span className={`md-status ${d.status}`}>{d.status === 'upcoming' ? 'Upcoming' : 'Completed'}</span></td>
                  <td>
                    <button
                      className={`md-menu-btn${openMenu?.idx === i ? ' open' : ''}`}
                      onClick={e => {
                        e.stopPropagation();
                        if (openMenu?.idx === i) { setOpenMenu(null); return; }
                        const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                        setOpenMenu({ idx: i, top: rect.bottom + 6, left: rect.right - 150 });
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
      )}

      {/* Row menu portal */}
      {openMenu && typeof document !== 'undefined' && createPortal(
        <div
          className="md-dropdown"
          style={{ position: 'fixed', top: openMenu.top, left: openMenu.left, zIndex: 9999 }}
          onMouseDown={e => e.stopPropagation()}
        >
          {(() => {
            const d = filtered[openMenu.idx];
            if (!d) return null;
            return (
              <>
                <button className="md-drop-item" onClick={() => { setOpenMenu(null); router.push(`/admin/manage-discussions/edit/${d.id}`); }}>
                  <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  Edit
                </button>
                <button className="md-drop-item" onClick={() => { setOpenMenu(null); window.open(`/discussions/${d.id}`, '_blank'); }}>
                  <svg viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  View on Site
                </button>
                <div className="md-drop-divider" />
                <button className="md-drop-item danger" onClick={() => { setOpenMenu(null); setDeleteConfirm(d); }}>
                  <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  Delete
                </button>
              </>
            );
          })()}
        </div>,
        document.body
      )}

      {/* Delete confirm modal */}
      {deleteConfirm && typeof document !== 'undefined' && createPortal(
        <div className="md-overlay" onMouseDown={() => setDeleteConfirm(null)}>
          <div className="md-modal" onMouseDown={e => e.stopPropagation()}>
            <div className="md-modal-head">
              <div className="md-modal-title">Delete Discussion</div>
              <button className="md-modal-close" onClick={() => setDeleteConfirm(null)}>
                <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="md-modal-body">
              <p className="md-confirm-text">
                Are you sure you want to delete <span className="md-confirm-topic">&quot;{deleteConfirm.topic}&quot;</span>? This action cannot be undone.
              </p>
            </div>
            <div className="md-modal-footer">
              <button className="md-btn-cancel" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="md-btn-delete" onClick={() => handleDelete(deleteConfirm)}>Delete</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {toast && <div className="md-toast">{toast}</div>}
    </>
  );
}
