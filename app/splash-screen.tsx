'use client';

import { useEffect, useState } from 'react';

// Full-screen splash shown on every full page load / refresh for ~3s, then
// fades out. Starts visible (SSR renders it, so no content flash on refresh);
// client-side route transitions don't remount it, only a real reload does.
// Reuses the .app-loading visuals from globals.css (same as app/loading.tsx).
export default function SplashScreen() {
  const [hidden, setHidden] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const fade = setTimeout(() => setLeaving(true), 2700);
    const done = setTimeout(() => setHidden(true), 3000);
    return () => {
      clearTimeout(fade);
      clearTimeout(done);
    };
  }, []);

  if (hidden) return null;

  return (
    <div
      className={`app-loading splash-screen ${leaving ? 'splash-leaving' : ''}`}
      role="status"
      aria-label="Loading ESL Here"
    >
      <div className="app-loading-bars" aria-hidden="true">
        <span className="app-loading-bar" />
        <span className="app-loading-bar" />
        <span className="app-loading-bar" />
      </div>
    </div>
  );
}
