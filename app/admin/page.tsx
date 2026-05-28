'use client';

import { useEffect, useState } from 'react';
import { useAdmin } from './admin-context';

interface Registration {
  type: string; firstName: string; lastName: string; email: string; phone: string;
  age: number; englishLevel: string; job: string; purpose?: string;
  whyPrivate?: string; whyGroup?: string; topics?: string; registeredAt?: string;
}

const REGS_PER_PAGE = 10;


export default function RegistrationsPage() {
  const { token, logout } = useAdmin();
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [purposeModal, setPurposeModal] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [openMenu, setOpenMenu] = useState<number | null>(null);

  useEffect(() => {
    if (!token) return;
    loadRegistrations();
  }, [token]);

  useEffect(() => {
    if (openMenu === null) return;
    const close = () => setOpenMenu(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [openMenu]);

  async function loadRegistrations() {
    try {
      const res = await fetch('/api/registrations', { headers: { Authorization: 'Bearer ' + token } });
      if (res.status === 401) { logout(); return; }
      if (!res.ok) throw new Error();
      setRegistrations(await res.json());
    } catch { showToast('Failed to load registrations.'); }
  }

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000); }

  const filteredRegs = registrations.filter(u => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (u.firstName + ' ' + u.lastName).toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term) ||
      u.phone.includes(term) ||
      u.englishLevel.toLowerCase().includes(term) ||
      u.job.toLowerCase().includes(term);
  });

  const totalPages = Math.max(1, Math.ceil(filteredRegs.length / REGS_PER_PAGE));
  const pagedRegs = filteredRegs.slice((currentPage - 1) * REGS_PER_PAGE, currentPage * REGS_PER_PAGE);
  const showFrom = filteredRegs.length === 0 ? 0 : (currentPage - 1) * REGS_PER_PAGE + 1;
  const showTo = Math.min(currentPage * REGS_PER_PAGE, filteredRegs.length);

  return (
    <>
      <style jsx global>{`
        /* ── Page header ── */
        .rl-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 24px;
        }
        .rl-title {
          font-family: 'Poppins', sans-serif;
          font-size: 1.3rem;
          font-weight: 600;
          color: #1a2e44;
          letter-spacing: -0.02em;
          margin-bottom: 4px;
        }
        .rl-subtitle {
          font-size: 0.8125rem;
          color: #8ba3b5;
          font-weight: 400;
        }

        /* ── Toolbar ── */
        .rl-toolbar {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 20px;
        }
        .rl-search-wrap {
          flex: 1;
          position: relative;
        }
        .rl-search-wrap > svg {
          position: absolute;
          left: 13px;
          top: 50%;
          transform: translateY(-50%);
          width: 16px;
          height: 16px;
          stroke: #8ba3b5;
          stroke-width: 2;
          fill: none;
          pointer-events: none;
        }
        .rl-search {
          width: 100%;
          padding: 9px 14px 9px 38px;
          font-family: 'Poppins', sans-serif;
          font-size: 0.8125rem;
          color: #1a2e44;
          background: #fff;
          border: 1px solid #d8e3ec;
          border-radius: 7px;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .rl-search::placeholder { color: #8ba3b5; }
        .rl-search:focus {
          border-color: #2db5c0;
          box-shadow: 0 0 0 3px rgba(45,181,192,0.08);
        }

        /* ── Table ── */
        .rl-table-wrap {
          overflow: visible;
          border-radius: 8px;
          border: 1px solid #d8e3ec;
          background: #fff;
        }
        .rl-table {
          width: 100%;
          border-collapse: collapse;
        }
        .rl-table th {
          padding: 12px 16px;
          text-align: left;
          font-family: 'Poppins', sans-serif;
          font-weight: 500;
          color: #8ba3b5;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          font-size: 0.6875rem;
          border-bottom: 1px solid #d8e3ec;
          white-space: nowrap;
          background: #f5f8fa;
        }
        .rl-table td {
          padding: 12px 16px;
          font-size: 0.8125rem;
          color: #5f7a8f;
          border-bottom: 1px solid #edf2f7;
          vertical-align: middle;
        }
        .rl-table tbody tr:last-child td { border-bottom: none; }
        .rl-table tbody tr { transition: background 0.15s; }
        .rl-table tbody tr:hover td { background: #f5f8fa; }

        .rl-name-text {
          font-weight: 500;
          color: #1a2e44;
          white-space: nowrap;
        }

        /* ── Badges ── */
        .rl-type-badge {
          display: inline-block;
          padding: 2px 9px;
          border-radius: 4px;
          font-size: 0.6875rem;
          font-weight: 500;
          white-space: nowrap;
          text-transform: capitalize;
        }
        .rl-type-badge.private { background: #f5f3ff; color: #7c3aed; }
        .rl-type-badge.group { background: #eff6ff; color: #2563eb; }
        .rl-level-badge {
          display: inline-block;
          padding: 2px 9px;
          border-radius: 4px;
          font-size: 0.6875rem;
          font-weight: 500;
          background: #edf2f7;
          color: #4a6577;
          white-space: nowrap;
        }

        /* ── Three-dot menu ── */
        .rl-menu-wrap {
          position: relative;
        }
        .rl-menu-btn {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 5px;
          border: none;
          background: transparent;
          cursor: pointer;
          color: #b8c9d6;
          font-size: 1.25rem;
          letter-spacing: 1px;
          transition: all 0.15s;
        }
        .rl-menu-btn:hover {
          background: #edf2f7;
          color: #2db5c0;
        }
        .rl-menu-dropdown {
          position: absolute;
          right: 0;
          top: 100%;
          margin-top: 4px;
          min-width: 160px;
          background: #fff;
          border: 1px solid #d8e3ec;
          border-radius: 8px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.08);
          z-index: 50;
          padding: 4px;
          animation: rl-menu-in 0.15s ease;
        }
        @keyframes rl-menu-in {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .rl-menu-item {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 7px 12px;
          border: none;
          background: none;
          font-family: 'Poppins', sans-serif;
          font-size: 0.8125rem;
          font-weight: 400;
          color: #5f7a8f;
          cursor: pointer;
          border-radius: 5px;
          transition: all 0.12s;
          text-align: left;
        }
        .rl-menu-item:hover {
          background: #edf2f7;
          color: #2a6270;
        }
        .rl-menu-item svg {
          width: 14px;
          height: 14px;
          stroke: currentColor;
          stroke-width: 1.8;
          fill: none;
          flex-shrink: 0;
        }

        /* ── Date ── */
        .rl-date-cell {
          white-space: nowrap;
          color: #8ba3b5 !important;
          font-size: 0.75rem !important;
        }

        /* ── Pagination ── */
        .rl-pagination {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 16px;
          margin-top: 4px;
        }
        .rl-pagination-info {
          font-size: 0.8125rem;
          color: #8ba3b5;
        }
        .rl-pagination-btns {
          display: flex;
          gap: 4px;
        }
        .rl-page-btn {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          border: 1px solid #d8e3ec;
          background: #fff;
          font-family: 'Poppins', sans-serif;
          font-size: 0.75rem;
          font-weight: 500;
          color: #5f7a8f;
          cursor: pointer;
          transition: all 0.15s;
        }
        .rl-page-btn:hover {
          border-color: #2db5c0;
          color: #2a6270;
          background: #ddf1f3;
        }
        .rl-page-btn.active {
          background: #2db5c0;
          border-color: #2db5c0;
          color: #fff;
        }

        /* ── Empty state ── */
        @keyframes rl-empty-in {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .rl-empty {
          text-align: center;
          padding: 72px 20px 64px;
          background: #fff;
          border: 1px solid #d8e3ec;
          border-radius: 8px;
          animation: rl-empty-in 0.45s ease-out both;
        }
        .rl-empty svg {
          width: 48px;
          height: 48px;
          stroke: #b8c9d6;
          stroke-width: 1;
          fill: none;
          display: block;
          margin: 0 auto 20px;
        }
        .rl-empty-title {
          font-size: 0.8125rem;
          font-weight: 500;
          color: #8ba3b5;
          letter-spacing: 0.01em;
        }
        .rl-empty-hint {
          font-size: 0.75rem;
          color: #b8c9d6;
          margin-top: 6px;
        }

        /* ── Modal ── */
        .rl-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(26,46,68,0.2);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 200;
          opacity: 0;
          visibility: hidden;
          transition: opacity 0.2s, visibility 0.2s;
        }
        .rl-modal-overlay.show {
          opacity: 1;
          visibility: visible;
        }
        .rl-modal-box {
          background: #fff;
          border-radius: 10px;
          width: 90%;
          max-width: 460px;
          padding: 28px;
          box-shadow: 0 20px 60px rgba(26,46,68,0.12);
          transform: scale(0.96);
          transition: transform 0.2s;
        }
        .rl-modal-overlay.show .rl-modal-box { transform: scale(1); }
        .rl-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 18px;
        }
        .rl-modal-header h3 {
          font-family: 'Poppins', sans-serif;
          font-size: 1rem;
          font-weight: 600;
          color: #1a2e44;
        }
        .rl-modal-close {
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px;
          color: #b8c9d6;
          transition: color 0.15s;
        }
        .rl-modal-close:hover { color: #1a2e44; }
        .rl-modal-close svg {
          width: 18px;
          height: 18px;
          stroke: currentColor;
          stroke-width: 2;
          fill: none;
        }
        .rl-modal-body {
          font-family: 'Poppins', sans-serif;
          font-size: 0.875rem;
          color: #5f7a8f;
          line-height: 1.7;
          word-break: break-word;
        }

        /* ── Toast ── */
        .rl-toast {
          position: fixed;
          bottom: 30px;
          left: 50%;
          transform: translateX(-50%) translateY(100px);
          background: #1a2e44;
          color: white;
          padding: 11px 22px;
          border-radius: 8px;
          font-family: 'Poppins', sans-serif;
          font-size: 0.8125rem;
          z-index: 300;
          transition: transform 0.3s;
        }
        .rl-toast.show { transform: translateX(-50%) translateY(0); }

        /* ── Responsive ── */
        @media (max-width: 768px) {
          .rl-header { flex-direction: column; gap: 14px; }
          .rl-toolbar { flex-direction: column; }
          .rl-table th, .rl-table td { padding: 10px 12px; }
          .rl-pagination { flex-direction: column; gap: 12px; align-items: flex-start; }
        }
      `}</style>

      {/* Header */}
      <div className="rl-header">
        <div>
          <h2 className="rl-title">Registrations</h2>
          <p className="rl-subtitle">Manage all received registrations and their details.</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="rl-toolbar">
        <div className="rl-search-wrap">
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            type="text"
            className="rl-search"
            placeholder="Search by name, email, or phone..."
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
          />
        </div>
      </div>

      {/* Table */}
      {filteredRegs.length === 0 ? (
        <div className="rl-empty">
          {searchTerm ? (
            <>
              <svg viewBox="0 0 48 48"><circle cx="20" cy="20" r="14"/><line x1="30" y1="30" x2="42" y2="42"/><line x1="14" y1="20" x2="26" y2="20"/></svg>
              <div className="rl-empty-title">No registrations match your search</div>
              <div className="rl-empty-hint">Try a different keyword or clear the filter</div>
            </>
          ) : (
            <>
              <svg viewBox="0 0 48 48"><rect x="10" y="4" width="28" height="40" rx="3"/><line x1="17" y1="14" x2="31" y2="14"/><line x1="17" y1="21" x2="31" y2="21"/><line x1="17" y1="28" x2="25" y2="28"/></svg>
              <div className="rl-empty-title">No registrations yet</div>
              <div className="rl-empty-hint">New submissions will appear here</div>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="rl-table-wrap">
            <table className="rl-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Level</th>
                  <th>Role</th>
                  <th>Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pagedRegs.map((u, i) => {
                  const dateStr = u.registeredAt ? new Date(u.registeredAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '\u2014';
                  const purposeText = u.purpose || u.whyPrivate || u.whyGroup || u.topics || '';
                  const rowIdx = (currentPage - 1) * REGS_PER_PAGE + i;
                  return (
                    <tr key={rowIdx}>
                      <td><span className={`rl-type-badge ${u.type === 'private' ? 'private' : 'group'}`}>{u.type || 'private'}</span></td>
                      <td>
                        <span className="rl-name-text">{u.firstName} {u.lastName}</span>
                      </td>
                      <td>{u.email}</td>
                      <td>{u.phone}</td>
                      <td><span className="rl-level-badge">{u.englishLevel}</span></td>
                      <td>{u.job}</td>
                      <td className="rl-date-cell">{dateStr}</td>
                      <td>
                        <div className="rl-menu-wrap">
                          <button className="rl-menu-btn" onClick={e => { e.stopPropagation(); setOpenMenu(openMenu === rowIdx ? null : rowIdx); }}>&#x22EF;</button>
                          {openMenu === rowIdx && (
                            <div className="rl-menu-dropdown" onClick={e => e.stopPropagation()}>
                              {purposeText && (
                                <button className="rl-menu-item" onClick={() => { setPurposeModal(purposeText); setOpenMenu(null); }}>
                                  <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                  View Purpose
                                </button>
                              )}
                              <button className="rl-menu-item" onClick={() => { window.location.href = 'mailto:' + u.email; setOpenMenu(null); }}>
                                <svg viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                                Send Email
                              </button>
                              <button className="rl-menu-item" onClick={() => { navigator.clipboard.writeText(u.phone); showToast('Phone copied'); setOpenMenu(null); }}>
                                <svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.11 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                                Copy Phone
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="rl-pagination">
            <span className="rl-pagination-info">
              Showing {showFrom} to {showTo} of {filteredRegs.length} registrations
            </span>
            <div className="rl-pagination-btns">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button key={p} className={`rl-page-btn ${p === currentPage ? 'active' : ''}`} onClick={() => setCurrentPage(p)}>{p}</button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Purpose Modal */}
      <div className={`rl-modal-overlay ${purposeModal !== null ? 'show' : ''}`} onClick={() => setPurposeModal(null)}>
        <div className="rl-modal-box" onClick={e => e.stopPropagation()}>
          <div className="rl-modal-header">
            <h3>Purpose / Topics</h3>
            <button className="rl-modal-close" onClick={() => setPurposeModal(null)}>
              <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div className="rl-modal-body">{purposeModal}</div>
        </div>
      </div>

      <div className={`rl-toast ${toast ? 'show' : ''}`} style={{ visibility: toast ? 'visible' : 'hidden' }}>{toast}</div>
    </>
  );
}
