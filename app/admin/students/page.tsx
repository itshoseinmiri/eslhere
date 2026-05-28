'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAdmin } from '../admin-context';

interface Student {
  id: string; firstName: string; lastName: string; email: string; phone: string;
  englishLevel: string; type: string; addedAt?: string;
}

const STUDENTS_PER_PAGE = 10;

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

export default function StudentsPage() {
  const { token, logout } = useAdmin();
  const [students, setStudents] = useState<Student[]>([]);
  const [addModal, setAddModal] = useState(false);
  const [toast, setToast] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (!token) return;
    loadStudents();
  }, [token]);

  async function loadStudents() {
    try {
      const res = await fetch('/api/students', { headers: { Authorization: 'Bearer ' + token } });
      if (res.status === 401) { logout(); return; }
      if (!res.ok) throw new Error();
      setStudents(await res.json());
    } catch { showToast('Failed to load students.'); }
  }

  async function handleAddStudent(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const student = Object.fromEntries(fd.entries());
    try {
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(student),
      });
      if (res.status === 401) { logout(); return; }
      if (!res.ok) throw new Error();
      setAddModal(false);
      form.reset();
      loadStudents();
    } catch { showToast('Failed to add student.'); }
  }

  async function removeStudent(id: string) {
    try {
      const res = await fetch('/api/students/' + id, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } });
      if (res.status === 401) { logout(); return; }
      if (!res.ok) throw new Error();
      loadStudents();
    } catch { showToast('Failed to remove student.'); }
  }

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000); }
  function getSlug(fn: string, ln: string) { return (fn.trim() + '_' + ln.trim()).toLowerCase().replace(/\s+/g, '_'); }
  function getInitials(fn: string, ln: string) { return (fn.charAt(0) + ln.charAt(0)).toUpperCase(); }

  const filteredStudents = students.filter(s => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (s.firstName + ' ' + s.lastName).toLowerCase().includes(term) ||
      s.email.toLowerCase().includes(term) ||
      s.phone.includes(term) ||
      s.englishLevel.toLowerCase().includes(term);
  });

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / STUDENTS_PER_PAGE));
  const pagedStudents = filteredStudents.slice((currentPage - 1) * STUDENTS_PER_PAGE, currentPage * STUDENTS_PER_PAGE);
  const showFrom = filteredStudents.length === 0 ? 0 : (currentPage - 1) * STUDENTS_PER_PAGE + 1;
  const showTo = Math.min(currentPage * STUDENTS_PER_PAGE, filteredStudents.length);

  return (
    <>
      <style jsx global>{`
        /* ── Page header ── */
        .sl-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 24px;
        }
        .sl-title {
          font-family: 'Poppins', sans-serif;
          font-size: 1.3rem;
          font-weight: 600;
          color: #1a2e44;
          letter-spacing: -0.02em;
          margin-bottom: 4px;
        }
        .sl-subtitle {
          font-size: 0.8125rem;
          color: #8ba3b5;
          font-weight: 400;
        }
        .sl-add-btn {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 9px 20px;
          font-family: 'Poppins', sans-serif;
          font-size: 0.8125rem;
          font-weight: 600;
          color: #fff;
          background: #2db5c0;
          border: none;
          border-radius: 7px;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }
        .sl-add-btn:hover {
          background: #2a6270;
          box-shadow: 0 2px 12px rgba(45,181,192,0.3);
        }
        .sl-add-btn svg {
          width: 15px;
          height: 15px;
          stroke: currentColor;
          stroke-width: 2.2;
          fill: none;
        }

        /* ── Toolbar ── */
        .sl-toolbar {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 20px;
        }
        .sl-search-wrap {
          flex: 1;
          position: relative;
        }
        .sl-search-wrap > svg {
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
        .sl-search {
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
        .sl-search::placeholder { color: #8ba3b5; }
        .sl-search:focus {
          border-color: #2db5c0;
          box-shadow: 0 0 0 3px rgba(45,181,192,0.08);
        }

        /* ── Table ── */
        .sl-table-wrap {
          overflow-x: auto;
          border-radius: 8px;
          border: 1px solid #d8e3ec;
          background: #fff;
        }
        .sl-table {
          width: 100%;
          border-collapse: collapse;
        }
        .sl-table th {
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
        .sl-table td {
          padding: 12px 16px;
          font-size: 0.8125rem;
          color: #5f7a8f;
          border-bottom: 1px solid #edf2f7;
          vertical-align: middle;
        }
        .sl-table tbody tr:last-child td { border-bottom: none; }
        .sl-table tbody tr { transition: background 0.15s; }
        .sl-table tbody tr:hover td { background: #f5f8fa; }

        /* ── Name cell ── */
        .sl-name-cell {
          display: flex;
          align-items: center;
          gap: 11px;
        }
        .sl-avatar {
          width: 34px;
          height: 34px;
          min-width: 34px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Poppins', sans-serif;
          font-size: 0.68rem;
          font-weight: 600;
          letter-spacing: 0.02em;
          flex-shrink: 0;
        }
        .sl-name-link {
          font-weight: 500;
          color: #1a2e44;
          text-decoration: none;
          white-space: nowrap;
          transition: color 0.15s;
        }
        .sl-name-link:hover { color: #2db5c0; }

        /* ── Badges ── */
        .sl-level-badge {
          display: inline-block;
          padding: 2px 9px;
          border-radius: 4px;
          font-size: 0.6875rem;
          font-weight: 500;
          background: #edf2f7;
          color: #4a6577;
          white-space: nowrap;
        }
        .sl-type-badge {
          display: inline-block;
          padding: 2px 9px;
          border-radius: 4px;
          font-size: 0.6875rem;
          font-weight: 500;
          white-space: nowrap;
          text-transform: capitalize;
        }
        .sl-type-badge.private { background: #f5f3ff; color: #7c3aed; }
        .sl-type-badge.group { background: #eff6ff; color: #2563eb; }
        .sl-status-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 2px 10px;
          border-radius: 20px;
          font-size: 0.6875rem;
          font-weight: 500;
        }
        .sl-status-badge.active-s {
          background: #ecfdf5;
          color: #059669;
        }
        .sl-status-badge.active-s::before {
          content: '';
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #10b981;
        }

        /* ── Date & actions ── */
        .sl-date-cell {
          white-space: nowrap;
          color: #8ba3b5 !important;
          font-size: 0.75rem !important;
        }
        .sl-actions-cell {
          display: flex;
          align-items: center;
          gap: 2px;
        }
        .sl-action-btn {
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
          transition: all 0.15s;
          text-decoration: none;
        }
        .sl-action-btn svg {
          width: 15px;
          height: 15px;
          stroke: currentColor;
          stroke-width: 1.8;
          fill: none;
        }
        .sl-action-btn:hover {
          background: #edf2f7;
          color: #2db5c0;
        }
        .sl-action-btn.sl-action-remove:hover {
          background: #fef2f2;
          color: #ef4444;
        }

        /* ── Pagination ── */
        .sl-pagination {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 16px;
          margin-top: 4px;
        }
        .sl-pagination-info {
          font-size: 0.8125rem;
          color: #8ba3b5;
        }
        .sl-pagination-btns {
          display: flex;
          gap: 4px;
        }
        .sl-page-btn {
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
        .sl-page-btn:hover {
          border-color: #2db5c0;
          color: #2a6270;
          background: #ddf1f3;
        }
        .sl-page-btn.active {
          background: #2db5c0;
          border-color: #2db5c0;
          color: #fff;
        }

        /* ── Empty state ── */
        @keyframes sl-empty-in {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .sl-empty {
          text-align: center;
          padding: 72px 20px 64px;
          background: #fff;
          border: 1px solid #d8e3ec;
          border-radius: 8px;
          animation: sl-empty-in 0.45s ease-out both;
        }
        .sl-empty svg {
          width: 48px;
          height: 48px;
          stroke: #b8c9d6;
          stroke-width: 1;
          fill: none;
          display: block;
          margin: 0 auto 20px;
        }
        .sl-empty-title {
          font-size: 0.8125rem;
          font-weight: 500;
          color: #8ba3b5;
          letter-spacing: 0.01em;
        }
        .sl-empty-hint {
          font-size: 0.75rem;
          color: #b8c9d6;
          margin-top: 6px;
        }

        /* ── Modal ── */
        .sl-modal-overlay {
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
        .sl-modal-overlay.show {
          opacity: 1;
          visibility: visible;
        }
        .sl-modal-box {
          background: #fff;
          border-radius: 10px;
          width: 90%;
          max-width: 480px;
          padding: 28px;
          box-shadow: 0 20px 60px rgba(26,46,68,0.12);
          transform: scale(0.96);
          transition: transform 0.2s;
        }
        .sl-modal-overlay.show .sl-modal-box { transform: scale(1); }
        .sl-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
        }
        .sl-modal-header h3 {
          font-family: 'Poppins', sans-serif;
          font-size: 1rem;
          font-weight: 600;
          color: #1a2e44;
        }
        .sl-modal-close {
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px;
          color: #b8c9d6;
          transition: color 0.15s;
        }
        .sl-modal-close:hover { color: #1a2e44; }
        .sl-modal-close svg {
          width: 18px;
          height: 18px;
          stroke: currentColor;
          stroke-width: 2;
          fill: none;
        }
        .sl-form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .sl-form-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .sl-form-field label {
          font-family: 'Poppins', sans-serif;
          font-size: 0.6875rem;
          font-weight: 500;
          color: #8ba3b5;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .sl-form-field input,
        .sl-form-field select {
          padding: 9px 14px;
          font-family: 'Poppins', sans-serif;
          font-size: 0.8125rem;
          color: #1a2e44;
          background: #fff;
          border: 1px solid #d8e3ec;
          border-radius: 7px;
          outline: none;
          transition: border-color 0.2s;
        }
        .sl-form-field input:focus,
        .sl-form-field select:focus { border-color: #2db5c0; }
        .sl-form-field input::placeholder { color: #b8c9d6; }
        .sl-form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 24px;
        }
        .sl-form-actions button {
          padding: 9px 22px;
          font-family: 'Poppins', sans-serif;
          font-size: 0.8125rem;
          font-weight: 500;
          border-radius: 7px;
          border: none;
          cursor: pointer;
          transition: all 0.15s;
        }
        .sl-btn-cancel { background: #edf2f7; color: #5f7a8f; }
        .sl-btn-cancel:hover { background: #d8e3ec; }
        .sl-btn-save { background: #2db5c0; color: #fff; font-weight: 600; }
        .sl-btn-save:hover { background: #2a6270; }

        /* ── Toast ── */
        .sl-toast {
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
        .sl-toast.show { transform: translateX(-50%) translateY(0); }

        /* ── Responsive ── */
        @media (max-width: 768px) {
          .sl-header { flex-direction: column; gap: 14px; }
          .sl-toolbar { flex-direction: column; }
          .sl-table th, .sl-table td { padding: 10px 12px; }
          .sl-pagination { flex-direction: column; gap: 12px; align-items: flex-start; }
          .sl-form-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      {/* Header */}
      <div className="sl-header">
        <div>
          <h2 className="sl-title">Active Students</h2>
          <p className="sl-subtitle">Manage all active students and their details.</p>
        </div>
        <button className="sl-add-btn" onClick={() => setAddModal(true)}>
          <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19" strokeLinecap="round"/><line x1="5" y1="12" x2="19" y2="12" strokeLinecap="round"/></svg>
          Add Student
        </button>
      </div>

      {/* Toolbar */}
      <div className="sl-toolbar">
        <div className="sl-search-wrap">
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            type="text"
            className="sl-search"
            placeholder="Search by name, email, or phone..."
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
          />
        </div>
      </div>

      {/* Table */}
      {filteredStudents.length === 0 ? (
        <div className="sl-empty">
          {searchTerm ? (
            <>
              <svg viewBox="0 0 48 48"><circle cx="20" cy="20" r="14"/><line x1="30" y1="30" x2="42" y2="42"/><line x1="14" y1="20" x2="26" y2="20"/></svg>
              <div className="sl-empty-title">No students match your search</div>
              <div className="sl-empty-hint">Try a different name or email</div>
            </>
          ) : (
            <>
              <svg viewBox="0 0 48 48"><circle cx="24" cy="16" r="9"/><path d="M8 44c0-8.837 7.163-16 16-16s16 7.163 16 16"/></svg>
              <div className="sl-empty-title">No active students yet</div>
              <div className="sl-empty-hint">Students will appear once enrolled</div>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="sl-table-wrap">
            <table className="sl-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Level</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pagedStudents.map(s => {
                  const avatar = getAvatarStyle(s.firstName + s.lastName);
                  const dateStr = s.addedAt ? new Date(s.addedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '\u2014';
                  return (
                    <tr key={s.id}>
                      <td>
                        <div className="sl-name-cell">
                          <div className="sl-avatar" style={{ background: avatar.bg, color: avatar.text }}>
                            {getInitials(s.firstName, s.lastName)}
                          </div>
                          <Link href={`/admin/student/${getSlug(s.firstName, s.lastName)}`} className="sl-name-link">
                            {s.firstName} {s.lastName}
                          </Link>
                        </div>
                      </td>
                      <td>{s.email}</td>
                      <td>{s.phone}</td>
                      <td><span className="sl-level-badge">{s.englishLevel}</span></td>
                      <td><span className={`sl-type-badge ${s.type}`}>{s.type}</span></td>
                      <td><span className="sl-status-badge active-s">Active</span></td>
                      <td className="sl-date-cell">{dateStr}</td>
                      <td>
                        <div className="sl-actions-cell">
                          <Link href={`/admin/student/${getSlug(s.firstName, s.lastName)}`} className="sl-action-btn" title="View details">
                            <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                          </Link>
                          <button className="sl-action-btn sl-action-remove" onClick={() => removeStudent(s.id)} title="Remove student">
                            <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="sl-pagination">
            <span className="sl-pagination-info">
              Showing {showFrom} to {showTo} of {filteredStudents.length} students
            </span>
            <div className="sl-pagination-btns">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button key={p} className={`sl-page-btn ${p === currentPage ? 'active' : ''}`} onClick={() => setCurrentPage(p)}>{p}</button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Add Student Modal */}
      <div className={`sl-modal-overlay ${addModal ? 'show' : ''}`} onClick={() => setAddModal(false)}>
        <div className="sl-modal-box" onClick={e => e.stopPropagation()}>
          <div className="sl-modal-header">
            <h3>Add Student</h3>
            <button className="sl-modal-close" onClick={() => setAddModal(false)}>
              <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <form onSubmit={handleAddStudent}>
            <div className="sl-form-grid">
              <div className="sl-form-field"><label>First Name</label><input type="text" name="firstName" placeholder="Jane" required /></div>
              <div className="sl-form-field"><label>Last Name</label><input type="text" name="lastName" placeholder="Doe" required /></div>
              <div className="sl-form-field"><label>Email</label><input type="email" name="email" placeholder="jane@example.com" required /></div>
              <div className="sl-form-field"><label>Phone</label><input type="text" name="phone" placeholder="+1 234 567 890" required /></div>
              <div className="sl-form-field"><label>English Level</label>
                <select name="englishLevel" required defaultValue="">
                  <option value="" disabled>Select level</option>
                  <option value="Beginner">Beginner</option>
                  <option value="Elementary">Elementary</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Upper-Intermediate">Upper-Intermediate</option>
                  <option value="Advanced">Advanced</option>
                </select>
              </div>
              <div className="sl-form-field"><label>Class Type</label>
                <select name="type" required defaultValue="">
                  <option value="" disabled>Select type</option>
                  <option value="private">Private</option>
                  <option value="group">Group</option>
                </select>
              </div>
            </div>
            <div className="sl-form-actions">
              <button type="button" className="sl-btn-cancel" onClick={() => setAddModal(false)}>Cancel</button>
              <button type="submit" className="sl-btn-save">Add Student</button>
            </div>
          </form>
        </div>
      </div>

      <div className={`sl-toast ${toast ? 'show' : ''}`} style={{ visibility: toast ? 'visible' : 'hidden' }}>{toast}</div>
    </>
  );
}
