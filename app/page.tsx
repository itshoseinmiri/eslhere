'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import './home.css';

export default function Home() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [view, setView] = useState<'select' | 'form' | 'discussions' | 'detail'>('select');
  const [tab, setTab] = useState<'private' | 'group'>('private');
  const [successForm, setSuccessForm] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [selectedDisc, setSelectedDisc] = useState<number | null>(null);
  const [enrollSuccess, setEnrollSuccess] = useState(false);
  const logoRef = useRef<HTMLImageElement>(null);
  const logoClicksRef = useRef(0);
  const logoTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const path = window.location.pathname;
    const cls = searchParams.get('class');
    if (path === '/register' || cls) {
      setView('form');
      setTab(cls === 'group' ? 'group' : 'private');
    } else if (path === '/discussions') {
      setView('discussions');
    } else if (path.startsWith('/discussions/')) {
      const id = Number(path.split('/')[2]);
      if (id) { setSelectedDisc(id); setView('detail'); }
    }
  }, [searchParams]);

  const [allDiscussions, setAllDiscussions] = useState<{ id: number; topic: string; date: string; time?: string; level: string; description: string; spots?: number; participants?: number; duration: string; points?: string[]; status: string }[]>([]);

  useEffect(() => {
    fetch('/api/discussions')
      .then(res => res.ok ? res.json() : [])
      .then(setAllDiscussions)
      .catch(() => {});
  }, []);

  const upcomingDiscussions = allDiscussions.filter(d => d.status === 'upcoming');
  const completedDiscussions = allDiscussions.filter(d => d.status === 'completed');

  function showView(target: 'select' | 'private' | 'group' | 'discussions') {
    if (target === 'select') {
      setView('select');
      setSuccessForm(null);
      window.history.pushState(null, '', '/');
    } else if (target === 'private') {
      setView('form');
      setTab('private');
      window.history.pushState(null, '', '/register?class=private');
    } else if (target === 'discussions') {
      setView('discussions');
      window.history.pushState(null, '', '/discussions');
    } else {
      setView('form');
      setTab('group');
      window.history.pushState(null, '', '/register?class=group');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openDetail(id: number) {
    setSelectedDisc(id);
    setEnrollSuccess(false);
    setView('detail');
    window.history.pushState(null, '', `/discussions/${id}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleLogoClick() {
    logoClicksRef.current++;
    if (logoTimerRef.current) clearTimeout(logoTimerRef.current);
    if (logoClicksRef.current >= 3) {
      logoClicksRef.current = 0;
      sessionStorage.setItem('admin_access_granted', 'true');
      router.push('/login');
      return;
    }
    logoTimerRef.current = setTimeout(() => {
      if (logoClicksRef.current < 3) {
        logoClicksRef.current = 0;
        showView('select');
      }
    }, 400);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>, type: 'private' | 'group') {
    e.preventDefault();
    const form = e.currentTarget;
    const inputs = form.querySelectorAll('input, select, textarea');
    let valid = true;
    inputs.forEach((input) => {
      const el = input as HTMLInputElement;
      if (!el.value.trim()) {
        valid = false;
        el.style.borderColor = '#d94f4f';
        setTimeout(() => { el.style.borderColor = ''; }, 1500);
      }
    });
    if (!valid) return;

    const btn = form.querySelector('.submit-btn') as HTMLButtonElement;
    btn.classList.add('loading');

    const data: Record<string, unknown> = { type, registeredAt: new Date().toISOString() };
    inputs.forEach((el) => {
      const input = el as HTMLInputElement;
      if (!input.name) return;
      const val = input.value.trim();
      data[input.name] = input.type === 'number' ? parseInt(val) || val : val;
    });

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed');
      setSuccessForm(type);
    } catch {
      setError(true);
      setTimeout(() => setError(false), 3000);
    } finally {
      btn.classList.remove('loading');
    }
  }

  async function handleEnroll(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const inputs = form.querySelectorAll('input, select, textarea');
    let valid = true;
    inputs.forEach((input) => {
      const el = input as HTMLInputElement;
      if (!el.value.trim()) {
        valid = false;
        el.style.borderColor = '#d94f4f';
        setTimeout(() => { el.style.borderColor = ''; }, 1500);
      }
    });
    if (!valid) return;

    const btn = form.querySelector('.submit-btn') as HTMLButtonElement;
    btn.classList.add('loading');

    const activeDisc = upcomingDiscussions.find(d => d.id === selectedDisc);
    const data: Record<string, unknown> = {
      type: 'discussion',
      discussionId: selectedDisc,
      discussionTopic: activeDisc?.topic,
      registeredAt: new Date().toISOString(),
    };
    inputs.forEach((el) => {
      const input = el as HTMLInputElement;
      if (!input.name) return;
      data[input.name] = input.value.trim();
    });

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed');
      setEnrollSuccess(true);
    } catch {
      setError(true);
      setTimeout(() => setError(false), 3000);
    } finally {
      btn.classList.remove('loading');
    }
  }

  const activeDisc = upcomingDiscussions.find(d => d.id === selectedDisc);

  return (
    <>

      <header className="top-header">
        <div className="top-header-inner">
          <img ref={logoRef} src="/images/logo.webp" alt="Logo" onClick={handleLogoClick} style={{ height: 40, width: 'auto', objectFit: 'contain' }} />
          <span className="header-tagline">English as a Second Language</span>
          <nav className="header-nav">
            <button className={`header-nav-link ${view === 'discussions' || view === 'detail' ? 'active' : ''}`} onClick={() => showView('discussions')}>
              <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <span>Discussions</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Selection View */}
      <div className={`!px-4 view ${view === 'select' ? 'active' : ''}`}>
        <div className="hero-banner">
          <img src="/images/banner.webp" alt="Language. Learning. Impact." />
        </div>
        <div className="selection-wrap w-full">
          <div className="selection-header">
            <span className="section-label">Choose your class</span>
            <h1>Find the right class for you</h1>
            <div className="header-divider">
              <span className="divider-line"></span>
              <span className="divider-dot"></span>
              <span className="divider-line"></span>
            </div>
          </div>
          <div className="selection-boxes">
            <div className="selection-box">
              <div className="box-top-row">
                <div className="box-intro">
                  <h3>Private Speaking Classes</h3>
                  <p className="box-subtitle">One-on-one English lessons personalized just for you.</p>
                  <ul className="box-features">
                    <li>Personalized lesson plan</li>
                    <li>Flexible scheduling</li>
                    <li>Faster progress</li>
                  </ul>
                </div>
              </div>
              <div className="box-bottom-row">
                <button className="box-cta" onClick={() => showView('private')}>
                  Book Private Class
                  <svg viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
                <div className="box-illustration-bottom">
                  <img src="/images/private-bottom.png" alt="" />
                </div>
              </div>
            </div>
            <div className="selection-box">
              <div className="box-top-row">
                <div className="box-intro">
                  <h3>Group Speaking Classes</h3>
                  <p className="box-subtitle">Practice with other learners in a supportive group.</p>
                  <ul className="box-features">
                    <li>Interactive group discussions</li>
                    <li>Learn from peers</li>
                    <li>Affordable &amp; fun</li>
                  </ul>
                </div>
              </div>
              <div className="box-bottom-row">
                <button className="box-cta" onClick={() => showView('group')}>
                  Book Group Class
                  <svg viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
                <div className="box-illustration-bottom">
                  <img src="/images/group-bottom.png" alt="" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Form View */}
      <div className={`view ${view === 'form' ? 'active' : ''}`}>
        <div className="container">
          <button className="back-btn" onClick={() => showView('select')}>
            <svg viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Back
          </button>
          <div className="form-header">
            <h1>Class Registration</h1>
            <p>You can fill the form details in <span className="farsi-green">Farsi</span></p>
          </div>
          <div className="form-tabs">
            <button className={`form-tab ${tab === 'private' ? 'active' : ''}`} onClick={() => { setTab('private'); setSuccessForm(null); window.history.pushState(null, '', '/register?class=private'); }}>Private Class</button>
            <button className={`form-tab ${tab === 'group' ? 'active' : ''}`} onClick={() => { setTab('group'); setSuccessForm(null); window.history.pushState(null, '', '/register?class=group'); }}>Group Class</button>
          </div>
          <div className="card">
            {/* Private Form */}
            {tab === 'private' && (
              successForm === 'private' ? (
                <div className="success-message">
                  <div className="success-icon"><svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
                  <h2>Thank You</h2>
                  <p>We will get back to you as soon as possible.</p>
                  <button className="another-btn" onClick={() => { setSuccessForm(null); showView('select'); }}>Back to Home</button>
                </div>
              ) : (
                <form onSubmit={(e) => handleSubmit(e, 'private')} noValidate>
                  <div className="form-row">
                    <div className="field"><label>First Name</label><input type="text" name="firstName" placeholder="Jane" required /></div>
                    <div className="field"><label>Last Name</label><input type="text" name="lastName" placeholder="Doe" required /></div>
                  </div>
                  <div className="form-row">
                    <div className="field"><label>Age</label><input type="number" name="age" placeholder="25" min={5} max={120} required /></div>
                    <div className="field"><label>Job</label><input type="text" name="job" placeholder="Designer" required /></div>
                  </div>
                  <div className="field"><label>Email</label><input type="email" name="email" placeholder="jane@example.com" required /></div>
                  <div className="field"><label>Phone Number</label><input type="tel" name="phone" placeholder="+98 912 345 6789" required /></div>
                  <div className="field">
                    <label>English Level</label>
                    <select name="englishLevel" required defaultValue="">
                      <option value="" disabled>Select your level</option>
                      <option value="A1">A1 - Beginner</option>
                      <option value="A2">A2 - Elementary</option>
                      <option value="B1">B1 - Intermediate</option>
                      <option value="B2">B2 - Upper Intermediate</option>
                      <option value="C1">C1 - Advanced</option>
                      <option value="C2">C2 - Proficient</option>
                    </select>
                  </div>
                  <div className="field"><label>Why Do You Choose Private Class?</label><textarea name="whyPrivate" placeholder="Tell us why you prefer private classes..." required /></div>
                  <div className="field"><label>Purpose of Learning English</label><textarea name="purpose" placeholder="Tell us why you&apos;d like to learn English..." required /></div>
                  <button type="submit" className="submit-btn">Register</button>
                </form>
              )
            )}
            {/* Group Form */}
            {tab === 'group' && (
              successForm === 'group' ? (
                <div className="success-message">
                  <div className="success-icon"><svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
                  <h2>Thank You</h2>
                  <p>We will get back to you as soon as possible.</p>
                  <button className="another-btn" onClick={() => { setSuccessForm(null); showView('select'); }}>Back to Home</button>
                </div>
              ) : (
                <form onSubmit={(e) => handleSubmit(e, 'group')} noValidate>
                  <div className="form-row">
                    <div className="field"><label>First Name</label><input type="text" name="firstName" placeholder="Jane" required /></div>
                    <div className="field"><label>Last Name</label><input type="text" name="lastName" placeholder="Doe" required /></div>
                  </div>
                  <div className="form-row">
                    <div className="field"><label>Age</label><input type="number" name="age" placeholder="25" min={5} max={120} required /></div>
                    <div className="field"><label>Job</label><input type="text" name="job" placeholder="Designer" required /></div>
                  </div>
                  <div className="field"><label>Email</label><input type="email" name="email" placeholder="jane@example.com" required /></div>
                  <div className="field"><label>Phone Number</label><input type="tel" name="phone" placeholder="+98 912 345 6789" required /></div>
                  <div className="field">
                    <label>English Level</label>
                    <select name="englishLevel" required defaultValue="">
                      <option value="" disabled>Select your level</option>
                      <option value="A1">A1 - Beginner</option>
                      <option value="A2">A2 - Elementary</option>
                      <option value="B1">B1 - Intermediate</option>
                      <option value="B2">B2 - Upper Intermediate</option>
                      <option value="C1">C1 - Advanced</option>
                      <option value="C2">C2 - Proficient</option>
                    </select>
                  </div>
                  <div className="field"><label>Why Do You Choose Group Class?</label><textarea name="whyGroup" placeholder="Tell us why you prefer group classes..." required /></div>
                  <div className="field"><label>Topics You&apos;d Like to Discuss</label><textarea name="topics" placeholder="What topics interest you? (e.g. travel, technology, culture...)" required /></div>
                  <button type="submit" className="submit-btn">Register</button>
                </form>
              )
            )}
          </div>
        </div>
      </div>

      {/* Discussions View */}
      <div className={`view ${view === 'discussions' ? 'active' : ''}`}>
        <div className="disc-wrap">
          <button className="back-btn" onClick={() => showView('select')}>
            <svg viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Back
          </button>
          <div className="disc-header">
            <span className="section-label">Group Sessions</span>
            <h1>Discussion Topics</h1>
            <p className="disc-subtitle">Explore past conversations and join upcoming sessions</p>
            <div className="header-divider">
              <span className="divider-line"></span>
              <span className="divider-dot"></span>
              <span className="divider-line"></span>
            </div>
          </div>

          <div className="disc-section">
            <div className="disc-section-head">
              <span className="disc-pulse"></span>
              <h2>Upcoming</h2>
              <span className="disc-section-count">{upcomingDiscussions.length} sessions</span>
            </div>
            {upcomingDiscussions.length === 0 ? (
              <div className="disc-empty">No upcoming discussions scheduled yet</div>
            ) : (
              <div className="disc-grid">
                {upcomingDiscussions.map((d, i) => (
                  <div key={d.id} className="disc-card disc-upcoming" style={{ animationDelay: `${0.1 + i * 0.1}s`, cursor: 'pointer' }} onClick={() => openDetail(d.id)}>
                    <div className="disc-card-inner">
                      <span className="disc-watermark">{String(i + 1).padStart(2, '0')}</span>
                      <div className="disc-card-top">
                        <span className="disc-level">{d.level}</span>
                        <span className="disc-date">
                          <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                          {d.date}{d.time ? ` · ${d.time}` : ''}
                        </span>
                      </div>
                      <h3 className="disc-topic">{d.topic}</h3>
                      <p className="disc-desc">{d.description}</p>
                      <div className="disc-card-bottom">
                        <div className="disc-meta">
                          <span className="disc-meta-item">
                            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            {d.duration}
                          </span>
                          <span className="disc-meta-item disc-spots">
                            <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                            {d.spots ?? 0} spots left
                          </span>
                        </div>
                        <span className="disc-join-btn">
                          Join
                          <svg viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="disc-divider">
            <span className="disc-divider-line"></span>
            <span className="disc-divider-dot"></span>
            <span className="disc-divider-line"></span>
          </div>

          <div className="disc-section">
            <div className="disc-section-head">
              <span className="disc-check">
                <svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </span>
              <h2>Completed</h2>
              <span className="disc-section-count">{completedDiscussions.length} sessions</span>
            </div>
            {completedDiscussions.length === 0 ? (
              <div className="disc-empty">No completed discussions yet</div>
            ) : (
              <div className="disc-grid">
                {completedDiscussions.map((d, i) => (
                  <div key={d.id} className="disc-card disc-completed" style={{ animationDelay: `${0.15 + i * 0.08}s` }}>
                    <div className="disc-card-inner">
                      <span className="disc-watermark">{String(i + 1).padStart(2, '0')}</span>
                      <div className="disc-card-top">
                        <span className="disc-level">{d.level}</span>
                        <span className="disc-date">
                          <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                          {d.date}
                        </span>
                      </div>
                      <h3 className="disc-topic">{d.topic}</h3>
                      <p className="disc-desc">{d.description}</p>
                      <div className="disc-card-bottom">
                        <div className="disc-meta">
                          <span className="disc-meta-item">
                            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            {d.duration}
                          </span>
                          <span className="disc-meta-item">
                            <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                            {d.participants ?? 0} joined
                          </span>
                        </div>
                        <span className="disc-done-badge">
                          <svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          Done
                        </span>
                      </div>
                    </div>
                  </div>
              ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Discussion Detail View */}
      <div className={`view ${view === 'detail' ? 'active' : ''}`}>
        {activeDisc && (
          <div className="dt-wrap">
            <button className="back-btn" onClick={() => { setView('discussions'); setEnrollSuccess(false); window.history.pushState(null, '', '/discussions'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
              <svg viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Discussions
            </button>
            <div className="dt-layout">
              <div className="dt-info">
                <div className="dt-info-label">
                  <span className="disc-pulse"></span>
                  <span>Upcoming Session</span>
                </div>
                <h1 className="dt-title">{activeDisc.topic}</h1>
                <div className="dt-short-divider"></div>
                <div className="dt-meta-row">
                  <span className="dt-meta-tag">
                    <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    {activeDisc.date}{activeDisc.time ? ` · ${activeDisc.time}` : ''}
                  </span>
                  <span className="dt-meta-tag">
                    <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    {activeDisc.duration}
                  </span>
                  <span className="dt-meta-tag dt-spots-tag">
                    <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    {activeDisc.spots ?? 0} spots left
                  </span>
                </div>
                <span className="dt-level-badge">{activeDisc.level}</span>
                <p className="dt-desc">{activeDisc.description}</p>
                <div className="dt-points">
                  <h3>What you&apos;ll discuss</h3>
                  <ul>
                    {(activeDisc.points || []).map((p, i) => (
                      <li key={i} style={{ animationDelay: `${0.3 + i * 0.1}s` }}>{p}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="dt-form-panel">
                {enrollSuccess ? (
                  <div className="success-message">
                    <div className="success-icon" style={{ background: '#fef0e9' }}>
                      <svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                    <h2>You&apos;re Enrolled</h2>
                    <p>We&apos;ll send you the session details soon.</p>
                    <button className="another-btn" onClick={() => { setEnrollSuccess(false); showView('discussions'); }}>Back to Discussions</button>
                  </div>
                ) : (
                  <>
                    <div className="dt-form-head">
                      <h2>Enroll in Discussion</h2>
                      <p>You can fill the form in <span className="farsi-green">Farsi</span></p>
                    </div>
                    <form onSubmit={handleEnroll} noValidate>
                      <div className="form-row">
                        <div className="field"><label>First Name</label><input type="text" name="firstName" placeholder="Jane" required /></div>
                        <div className="field"><label>Last Name</label><input type="text" name="lastName" placeholder="Doe" required /></div>
                      </div>
                      <div className="form-row">
                        <div className="field"><label>Age</label><input type="number" name="age" placeholder="25" min={5} max={120} required /></div>
                        <div className="field">
                          <label>English Level</label>
                          <select name="englishLevel" required defaultValue="">
                            <option value="" disabled>Select your level</option>
                            <option value="A1">A1 - Beginner</option>
                            <option value="A2">A2 - Elementary</option>
                            <option value="B1">B1 - Intermediate</option>
                            <option value="B2">B2 - Upper Intermediate</option>
                            <option value="C1">C1 - Advanced</option>
                            <option value="C2">C2 - Proficient</option>
                          </select>
                        </div>
                      </div>
                      <div className="field"><label>Email</label><input type="email" name="email" placeholder="jane@example.com" required /></div>
                      <div className="field"><label>Phone Number</label><input type="tel" name="phone" placeholder="+98 912 345 6789" required /></div>
                      <div className="field">
                        <label>Have you joined a group discussion before?</label>
                        <select name="priorExperience" required defaultValue="">
                          <option value="" disabled>Select an option</option>
                          <option value="yes">Yes</option>
                          <option value="no">No, this is my first time</option>
                        </select>
                      </div>
                      <div className="field"><label>What do you hope to gain from this discussion?</label><textarea name="goals" placeholder="e.g. practice speaking, build confidence, learn new vocabulary..." required /></div>
                      <button type="submit" className="submit-btn dt-submit-btn">Enroll Now</button>
                    </form>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer CTA + Footer */}
      {(view === 'select' || view === 'discussions') && (
        <>
          <div className="footer-cta">
            <div className="footer-cta-card">
              <div className="footer-cta-icon">
                <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <div className="footer-cta-text">
                <h3>Ready to start your speaking journey?</h3>
                <p>Book a free trial class and experience the difference.</p>
              </div>
              <button className="footer-cta-btn" onClick={() => showView('private')}>
                Book Your Class
                <svg viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>
          </div>
          <footer className="site-footer">
            <div className="footer-inner">
              <div className="footer-brand">
                <img src="/images/logo.webp" alt="ESL Here" />
                <p>Helping learners speak English confidently through real conversations.</p>
                <div className="footer-socials">
                  <a href="https://www.instagram.com/mahdieh_fhm/" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                    <svg viewBox="0 0 24 24"><path d="M7.8 2h8.4C19.4 2 22 4.6 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8C4.6 22 2 19.4 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2zm-.2 2A3.6 3.6 0 0 0 4 7.6v8.8C4 18.39 5.61 20 7.6 20h8.8a3.6 3.6 0 0 0 3.6-3.6V7.6C20 5.61 18.39 4 16.4 4H7.6zm9.65 1.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5zM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/></svg>
                  </a>
                  <a href="https://www.linkedin.com/in/mahdieh-fahimpour/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
                    <svg viewBox="0 0 24 24"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2zM4 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4z"/></svg>
                  </a>
                </div>
              </div>
              <div className="footer-col">
                <h4>Classes</h4>
                <ul>
                  <li><a onClick={() => showView('private')}>Private Classes</a></li>
                  <li><a onClick={() => showView('group')}>Group Classes</a></li>
                  <li><a onClick={() => showView('discussions')}>Discussions</a></li>
                </ul>
              </div>
            </div>
            <div className="footer-bottom">&copy; 2024 ESL Here. All rights reserved.</div>
          </footer>
        </>
      )}

      <div className={`error-toast ${error ? 'show' : ''}`} style={{ visibility: error ? 'visible' : 'hidden' }}>Something went wrong. Please try again.</div>
    </>
  );
}
