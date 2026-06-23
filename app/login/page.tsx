'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';

// Hydration-safe "mounted" flag. The form uses `<style jsx global>` (styled-jsx),
// which this app never server-renders — there's no StyleRegistry in the root
// layout, so SSR omits the styles while the client injects them, causing a
// hydration mismatch that makes the dev server reload in an infinite loop.
// Every other styled-jsx page avoids SSR the same way (the admin layout only
// renders children after mount). Render nothing until mounted on the client.
const subscribeNoop = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export default function LoginPage() {
  const router = useRouter();
  const mounted = useSyncExternalStore(subscribeNoop, getClientSnapshot, getServerSnapshot);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showError, setShowError] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    // Check if already logged in
    const token = localStorage.getItem('admin_access_token');
    if (token) {
      fetch('/api/admin/verify', { headers: { Authorization: 'Bearer ' + token } })
        .then(res => {
          if (res.ok) router.push('/admin');
          else localStorage.removeItem('admin_access_token');
        })
        .catch(() => localStorage.removeItem('admin_access_token'));
    }
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setShowError(false);
    setLoading(true);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (res.status === 401) {
        setShowError(true);
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error('Server error');

      const data = await res.json();
      localStorage.setItem('admin_access_token', data.access_token);
      router.push('/admin');
    } catch {
      setLoading(false);
      setToast('Something went wrong. Please try again.');
      setTimeout(() => setToast(''), 3000);
    }
  }

  if (!mounted) return null;

  return (
    <>
      <style jsx global>{`
        body { font-family: 'Poppins', sans-serif; background: #f9fbfc; color: #1a2e44; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .login-box { width: 100%; max-width: 360px; text-align: center; }
        .login-logo { width: 64px; height: 64px; object-fit: contain; margin-bottom: 20px; }
        .login-box h2 { font-size: 1.35rem; font-weight: 600; color: #1a2e44; margin-bottom: 6px; }
        .login-box p { font-size: 0.82rem; color: #8ba3b5; font-weight: 400; margin-bottom: 32px; }
        .field { margin-bottom: 16px; text-align: left; }
        .field label { display: block; font-size: 0.7rem; font-weight: 500; color: #8ba3b5; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
        .field input { width: 100%; padding: 11px 14px; font-family: 'Poppins', sans-serif; font-size: 0.88rem; color: #1a2e44; background: #fff; border: 1px solid #d8e3ec; border-radius: 7px; outline: none; transition: border-color 0.2s ease; }
        .field input:focus { border-color: #2db5c0; box-shadow: 0 0 0 3px rgba(45,181,192,0.08); }
        .field input::placeholder { color: #b8c9d6; }
        .login-btn { width: 100%; padding: 12px; margin-top: 8px; font-family: 'Poppins', sans-serif; font-size: 0.88rem; font-weight: 600; color: #fff; background: #2db5c0; border: none; border-radius: 7px; cursor: pointer; transition: background 0.2s ease; position: relative; }
        .login-btn:hover { background: #2a6270; }
        .login-btn.loading { pointer-events: none; color: transparent; }
        .login-btn.loading::after { content: ''; position: absolute; top: 50%; left: 50%; width: 18px; height: 18px; margin: -9px 0 0 -9px; border: 2px solid transparent; border-top-color: #fff; border-radius: 50%; animation: spin 0.5s linear infinite; }
        .login-error { color: #ef4444; font-size: 0.78rem; margin-top: 12px; }
        .toast { position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%) translateY(100px); background: #ef4444; color: white; padding: 11px 22px; border-radius: 8px; font-size: 0.82rem; z-index: 100; transition: transform 0.3s ease; }
        .toast.show { transform: translateX(-50%) translateY(0); }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div className="login-box">
        <img src="/images/logo.webp" alt="ESL Here" className="login-logo" />
        <h2>Admin Access</h2>
        <p>Enter your password to view admin panel</p>
        <form onSubmit={handleSubmit} noValidate autoComplete="off">
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              placeholder="Enter password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" className={`login-btn ${loading ? 'loading' : ''}`}>Sign In</button>
          {showError && <p className="login-error">Incorrect password. Please try again.</p>}
        </form>
      </div>

      <div className={`toast ${toast ? 'show' : ''}`}>{toast}</div>
    </>
  );
}
