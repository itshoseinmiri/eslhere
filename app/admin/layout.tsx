'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { AdminContext } from './admin-context';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [state, setState] = useState<'loading' | 'authenticated' | 'denied'>('loading');
  const [token, setToken] = useState('');
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [timer, setTimer] = useState('--:--');

  const TOKEN_KEY = 'admin_access_token';

  const logout = useCallback(async () => {
    const t = localStorage.getItem(TOKEN_KEY);
    if (t) {
      try { await fetch('/api/admin/logout', { method: 'POST', headers: { Authorization: 'Bearer ' + t } }); } catch {}
    }
    localStorage.removeItem(TOKEN_KEY);
    window.location.href = '/';
  }, []);

  useEffect(() => {
    const t = localStorage.getItem(TOKEN_KEY);
    if (!t) { setState('denied'); return; }

    fetch('/api/admin/verify', { headers: { Authorization: 'Bearer ' + t } })
      .then(res => {
        if (!res.ok) { localStorage.removeItem(TOKEN_KEY); setState('denied'); return null; }
        return res.json();
      })
      .then(data => {
        if (!data) return;
        setToken(t);
        setExpiresAt(new Date(data.expired_at).getTime());
        setState('authenticated');
      })
      .catch(() => { localStorage.removeItem(TOKEN_KEY); setState('denied'); });
  }, []);

  useEffect(() => {
    if (!expiresAt) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      if (remaining <= 0) { logout(); return; }
      setTimer(`${Math.floor(remaining / 60)}:${(remaining % 60).toString().padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, logout]);

  const isStudentsPage = pathname === '/admin/students';
  const isStudentDetail = pathname.startsWith('/admin/student/');
  const isSessionsPage = pathname === '/admin/sessions' || pathname.startsWith('/admin/sessions/');
  const isDiscussionsPage = pathname === '/admin/discussions' || pathname.startsWith('/admin/discussions/');
  const isManageDiscPage = pathname === '/admin/manage-discussions' || pathname.startsWith('/admin/manage-discussions/');
  const isAvailabilityPage = pathname === '/admin/availability';

  return (
    <AdminContext.Provider value={{ token, logout }}>
      {state === 'denied' && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', textAlign: 'center', padding: 20 }}>
          <div style={{ maxWidth: 400 }}>
            <h1 style={{ fontSize: '5rem', fontWeight: 600, color: '#d8e3ec', lineHeight: 1, marginBottom: 12 }}>404</h1>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 500, marginBottom: 8 }}>Page Not Found</h2>
            <p style={{ fontSize: '0.88rem', color: '#5f7a8f', marginBottom: 24 }}>The page you&apos;re looking for doesn&apos;t exist or has been moved.</p>
            <a href="/" style={{ display: 'inline-block', padding: '10px 24px', background: '#2db5c0', color: '#fff', textDecoration: 'none', borderRadius: 7, fontSize: '0.85rem', fontWeight: 500 }}>Go Home</a>
          </div>
        </div>
      )}

      {state === 'authenticated' && (
        <div className="dashboard">
          <aside className="sidebar">
            <div className="sidebar-brand">
              <Link href="/" className="brand-icon" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src="/images/logo.png" alt="ESL Here" />
              </Link>
            </div>

            <div className="sidebar-section-label">Main</div>
            <ul className="sidebar-nav">
              <li><Link className={!isStudentsPage && !isStudentDetail && !isSessionsPage && !isDiscussionsPage && !isManageDiscPage && !isAvailabilityPage ? 'active' : ''} href="/admin">
                <span className="nav-icon">
                  <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87" strokeLinecap="round" strokeLinejoin="round"/><path d="M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </span>
                <span className="nav-label">Admins</span>
              </Link></li>
              <li><Link className={isDiscussionsPage ? 'active' : ''} href="/admin/discussions">
                <span className="nav-icon">
                  <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </span>
                <span className="nav-label">Discussion Enrollments</span>
              </Link></li>
            </ul>

            <div className="sidebar-section-label">Manage</div>
            <ul className="sidebar-nav">
              <li><Link className={isManageDiscPage ? 'active' : ''} href="/admin/manage-discussions">
                <span className="nav-icon">
                  <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round"/><line x1="9" y1="10" x2="15" y2="10" strokeLinecap="round"/><line x1="9" y1="14" x2="13" y2="14" strokeLinecap="round"/></svg>
                </span>
                <span className="nav-label">Manage Discussions</span>
              </Link></li>
            </ul>

            <div className="sidebar-footer">
              <div className="sidebar-user">
                <div className="sidebar-user-avatar">AD</div>
                <div className="sidebar-user-info">
                  <div className="sidebar-user-name">Admin</div>
                  <div className="sidebar-user-meta">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    {timer}
                  </div>
                </div>
              </div>
              <button className="logout-btn" onClick={logout}>
                <svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" strokeLinecap="round" strokeLinejoin="round"/><polyline points="16 17 21 12 16 7" strokeLinecap="round" strokeLinejoin="round"/><line x1="21" y1="12" x2="9" y2="12" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Sign Out
              </button>
            </div>
          </aside>

          <div className="main" style={{ padding: (isStudentDetail || (isSessionsPage && pathname !== '/admin/sessions') || isAvailabilityPage) ? '28px 36px' : '32px 40px' }}>
            {children}
          </div>
        </div>
      )}

      {state !== 'authenticated' && state !== 'denied' && (
        <div style={{ display: 'none' }}>{children}</div>
      )}
    </AdminContext.Provider>
  );
}
