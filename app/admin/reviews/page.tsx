'use client';

import { useEffect, useState } from 'react';
import { useAdmin } from '../admin-context';

interface Review {
  id: string;
  name: string;
  level: string;
  rating: number;
  text: string;
  status: 'pending' | 'approved';
  createdAt: string;
}

type Filter = 'all' | 'pending' | 'approved';

export default function AdminReviewsPage() {
  const { token, logout } = useAdmin();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState('/leave-review');

  useEffect(() => {
    if (!token) return;
    (async () => {
      if (typeof window !== 'undefined') setShareUrl(window.location.origin + '/leave-review');
      try {
        const res = await fetch('/api/reviews', { headers: { Authorization: 'Bearer ' + token } });
        if (res.status === 401) { logout(); return; }
        if (!res.ok) throw new Error();
        setReviews(await res.json());
      } catch { /* leave list as-is */ }
      setLoading(false);
    })();
  }, [token, logout]);

  async function setStatus(id: string, status: 'approved' | 'pending') {
    setBusyId(id);
    try {
      const res = await fetch(`/api/reviews/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ status }),
      });
      if (res.status === 401) { logout(); return; }
      if (res.ok) setReviews(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    } catch { /* no-op */ }
    setBusyId(null);
  }

  async function remove(id: string) {
    if (!confirm('Delete this review permanently?')) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/reviews/${id}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + token },
      });
      if (res.status === 401) { logout(); return; }
      if (res.ok) setReviews(prev => prev.filter(r => r.id !== id));
    } catch { /* no-op */ }
    setBusyId(null);
  }

  function copyLink() {
    navigator.clipboard?.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }).catch(() => {});
  }

  const shown = reviews.filter(r => filter === 'all' || r.status === filter);
  const pendingCount = reviews.filter(r => r.status === 'pending').length;
  const approvedCount = reviews.filter(r => r.status === 'approved').length;

  return (
    <>
      <style jsx global>{`
        @keyframes rv-fade-up { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        @keyframes rv-spin { to { transform: rotate(360deg); } }

        .rv-head { animation: rv-fade-up 0.35s ease both; margin-bottom: 22px; }
        .rv-head h1 { font-size: 1.5rem; font-weight: 700; color: #1a2e44; margin-bottom: 4px; }
        .rv-head p { font-size: 0.86rem; color: #6b8095; }

        .rv-share {
          display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
          background: #f2fafb; border: 1px solid #d7ecef; border-radius: 12px;
          padding: 14px 16px; margin-bottom: 24px; animation: rv-fade-up 0.4s ease both;
        }
        .rv-share-label { font-size: 0.8rem; font-weight: 600; color: #33475b; }
        .rv-share-url {
          flex: 1; min-width: 200px; font-size: 0.82rem; color: #2db5c0; font-weight: 500;
          background: #fff; border: 1px solid #d7ecef; border-radius: 8px; padding: 8px 12px;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .rv-copy-btn {
          display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border: none;
          border-radius: 8px; background: #2db5c0; color: #fff; font-size: 0.82rem; font-weight: 600;
          cursor: pointer; font-family: inherit; transition: background 0.15s;
        }
        .rv-copy-btn:hover { background: #269aa4; }

        .rv-tabs { display: flex; gap: 6px; margin-bottom: 20px; }
        .rv-tab {
          padding: 7px 15px; border-radius: 8px; border: 1px solid #e2ebf1; background: #fff;
          font-family: inherit; font-size: 0.8rem; font-weight: 600; color: #6b8095; cursor: pointer;
          transition: all 0.15s;
        }
        .rv-tab.active { background: #2db5c0; border-color: #2db5c0; color: #fff; }
        .rv-tab-count {
          display: inline-block; margin-left: 6px; padding: 1px 7px; border-radius: 20px;
          background: rgba(0,0,0,0.08); font-size: 0.72rem;
        }
        .rv-tab.active .rv-tab-count { background: rgba(255,255,255,0.25); }

        .rv-list { display: flex; flex-direction: column; gap: 14px; }
        .rv-card {
          background: #fff; border: 1px solid #e8eef3; border-radius: 14px; padding: 18px 20px;
          animation: rv-fade-up 0.3s ease both;
        }
        .rv-card-top { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
        .rv-name { font-size: 0.98rem; font-weight: 700; color: #1a2e44; }
        .rv-level { font-size: 0.72rem; font-weight: 600; color: #2db5c0; background: #eef7f8; padding: 3px 9px; border-radius: 20px; }
        .rv-stars-row { display: inline-flex; gap: 2px; }
        .rv-stars-row svg { width: 15px; height: 15px; }
        .rv-stars-row .on { fill: #f5b301; }
        .rv-stars-row .off { fill: #e2ebf1; }
        .rv-badge { font-size: 0.7rem; font-weight: 700; padding: 3px 10px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.03em; }
        .rv-badge.pending { color: #b7791f; background: #fef6e7; }
        .rv-badge.approved { color: #1a936f; background: #e7f6ef; }
        .rv-date { margin-left: auto; font-size: 0.74rem; color: #9fb2c0; }
        .rv-text { font-size: 0.9rem; color: #45596b; line-height: 1.6; margin-bottom: 14px; }
        .rv-actions { display: flex; gap: 8px; }
        .rv-btn {
          display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; border-radius: 8px;
          font-family: inherit; font-size: 0.8rem; font-weight: 600; cursor: pointer; border: 1px solid transparent;
          transition: all 0.15s;
        }
        .rv-btn:disabled { opacity: 0.5; cursor: default; }
        .rv-btn.approve { background: #2db5c0; color: #fff; }
        .rv-btn.approve:hover:not(:disabled) { background: #269aa4; }
        .rv-btn.unapprove { background: #fff; border-color: #e2ebf1; color: #6b8095; }
        .rv-btn.unapprove:hover:not(:disabled) { background: #f7fafc; }
        .rv-btn.delete { background: #fff; border-color: #f3d4d4; color: #ef4444; margin-left: auto; }
        .rv-btn.delete:hover:not(:disabled) { background: #fef4f4; }
        .rv-btn svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }

        .rv-loading, .rv-empty {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          min-height: 260px; gap: 14px; color: #9fb2c0;
        }
        .rv-loading-spinner { width: 32px; height: 32px; border: 3px solid #e8eef3; border-top-color: #2db5c0; border-radius: 50%; animation: rv-spin 0.7s linear infinite; }
        .rv-empty-icon { width: 52px; height: 52px; border-radius: 50%; background: #f2f7fa; display: flex; align-items: center; justify-content: center; }
        .rv-empty-icon svg { width: 26px; height: 26px; stroke: #b9c9d5; stroke-width: 1.8; fill: none; stroke-linecap: round; stroke-linejoin: round; }
        .rv-empty-text { font-size: 0.88rem; }
      `}</style>

      <div className="rv-head">
        <h1>Student Reviews</h1>
        <p>Reviews students submit appear here. Approve them to show on the homepage.</p>
      </div>

      <div className="rv-share">
        <span className="rv-share-label">Share with students:</span>
        <span className="rv-share-url" title={shareUrl}>{shareUrl}</span>
        <button className="rv-copy-btn" onClick={copyLink}>
          {copied ? (
            <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>Copied</>
          ) : (
            <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>Copy link</>
          )}
        </button>
      </div>

      <div className="rv-tabs">
        <button className={`rv-tab ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All<span className="rv-tab-count">{reviews.length}</span></button>
        <button className={`rv-tab ${filter === 'pending' ? 'active' : ''}`} onClick={() => setFilter('pending')}>Pending<span className="rv-tab-count">{pendingCount}</span></button>
        <button className={`rv-tab ${filter === 'approved' ? 'active' : ''}`} onClick={() => setFilter('approved')}>Approved<span className="rv-tab-count">{approvedCount}</span></button>
      </div>

      {loading ? (
        <div className="rv-loading"><div className="rv-loading-spinner" /><div>Loading reviews...</div></div>
      ) : shown.length === 0 ? (
        <div className="rv-empty">
          <div className="rv-empty-icon"><svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg></div>
          <div className="rv-empty-text">{filter === 'all' ? 'No reviews yet. Share the link above to collect some.' : `No ${filter} reviews.`}</div>
        </div>
      ) : (
        <div className="rv-list">
          {shown.map(r => (
            <div key={r.id} className="rv-card">
              <div className="rv-card-top">
                <span className="rv-name">{r.name}</span>
                <span className="rv-level">{r.level}</span>
                <span className="rv-stars-row">
                  {[1, 2, 3, 4, 5].map(n => (
                    <svg key={n} viewBox="0 0 24 24"><polygon className={n <= r.rating ? 'on' : 'off'} points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                  ))}
                </span>
                <span className={`rv-badge ${r.status}`}>{r.status}</span>
                <span className="rv-date">{new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              </div>
              <p className="rv-text">{r.text}</p>
              <div className="rv-actions">
                {r.status === 'pending' ? (
                  <button className="rv-btn approve" disabled={busyId === r.id} onClick={() => setStatus(r.id, 'approved')}>
                    <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>Approve
                  </button>
                ) : (
                  <button className="rv-btn unapprove" disabled={busyId === r.id} onClick={() => setStatus(r.id, 'pending')}>
                    <svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /></svg>Unapprove
                  </button>
                )}
                <button className="rv-btn delete" disabled={busyId === r.id} onClick={() => remove(r.id)}>
                  <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
