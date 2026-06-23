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

  const [allDiscussions, setAllDiscussions] = useState<{ id: number; topic: string; date?: string; time?: string; dates?: { date: string; time?: string }[]; level: string; description: string; spots?: number; participants?: number; duration: string; points?: string[]; status: string; thumbnail?: string; reviews?: { name: string; level?: string; text: string }[] }[]>([]);

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

  const activeDisc = allDiscussions.find(d => d.id === selectedDisc);
  const isCompletedDetail = activeDisc?.status === 'completed';

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
        <section className="hero">
          <div className="hero-inner">
            <div className="hero-copy">
              <span className="hero-eyebrow"><span className="hero-eyebrow-dot"></span>English as a Second Language</span>
              <h1 className="hero-title">
                Language.<br />
                Learning.<br />
                <span className="hero-accent">Communication.</span>
              </h1>
              <p className="hero-sub">A real-life speaking progression framework — built to take you from first words to confident, fluent conversation.</p>
              <div className="hero-actions">
                <button className="hero-btn-primary" onClick={() => { document.getElementById('classes')?.scrollIntoView({ behavior: 'smooth' }); }}>
                  Explore classes
                  <svg viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
                <button className="hero-btn-ghost" onClick={() => showView('discussions')}>Join a discussion</button>
              </div>
              <ul className="hero-feats">
                <li>1-on-1 coaching</li>
                <li>Live group practice</li>
                <li>Real conversation topics</li>
              </ul>
            </div>
            <div className="hero-art" aria-hidden="true">
              <img src="/images/hero.jpg" alt="" />
            </div>
          </div>
        </section>
        <div className="selection-wrap w-full">
          <div className="selection-header" id="classes">
            <span className="section-label">Choose your path</span>
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
                <div className="box-icon"><svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3.6" strokeLinecap="round"/><path d="M5 20v-1a7 7 0 0 1 14 0v1" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
                <div className="box-intro">
                  <h3>Personal Speaking Coaching</h3>
                  <p className="box-subtitle">One-on-one guidance tailored to your goals and your pace.</p>
                  <ul className="box-features">
                    <li>Tailored to your goals</li>
                    <li>Flexible scheduling</li>
                    <li>Faster, focused progress</li>
                  </ul>
                </div>
              </div>
              <div className="box-bottom-row">
                <button className="box-cta" onClick={() => router.push('/book-lesson')}>
                  Book a session
                  <svg viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
                <div className="box-illustration-bottom">
                  <img src="/images/private-bottom.png" alt="" />
                </div>
              </div>
            </div>
            <div className="selection-box">
              <div className="box-top-row">
                <div className="box-icon"><svg viewBox="0 0 24 24" fill="none"><circle cx="9" cy="8" r="3.2" strokeLinecap="round"/><path d="M3.5 19.5v-1a5.5 5.5 0 0 1 11 0v1" strokeLinecap="round" strokeLinejoin="round"/><circle cx="17.2" cy="8.6" r="2.5" strokeLinecap="round"/><path d="M16 13.4a4.8 4.8 0 0 1 4.5 4.8v1.3" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
                <div className="box-intro">
                  <h3>Live Group Discussions</h3>
                  <p className="box-subtitle">Practice real conversations with other learners in a supportive group.</p>
                  <ul className="box-features">
                    <li>Real-world topics</li>
                    <li>Speak with peers</li>
                    <li>Build fluency &amp; confidence</li>
                  </ul>
                </div>
              </div>
              <div className="box-bottom-row">
                <button className="box-cta" onClick={() => showView('discussions')}>
                  View Discussions
                  <svg viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
                <div className="box-illustration-bottom">
                  <img src="/images/group-bottom.png" alt="" />
                </div>
              </div>
            </div>
          </div>

          {upcomingDiscussions.length > 0 && (
            <div className="home-disc">
              <div className="home-disc-head">
                <div>
                  <span className="section-label">Group Sessions</span>
                  <h2>Upcoming Discussions</h2>
                </div>
                <button className="home-disc-all" onClick={() => showView('discussions')}>
                  View all
                  <svg viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              </div>
              <div className="disc-grid">
                {upcomingDiscussions.slice(0, 4).map((d, i) => {
                  const discDates = d.dates && d.dates.length > 0 ? d.dates : (d.date ? [{ date: d.date, time: d.time }] : []);
                  return (
                  <div key={d.id} className="disc-card disc-upcoming" style={{ animationDelay: `${0.1 + i * 0.1}s`, cursor: 'pointer' }} onClick={() => openDetail(d.id)}>
                    <div className="disc-card-head">
                      <span className="disc-date-badge">
                        <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        {discDates[0]?.date}{discDates[0]?.time ? ` \u00b7 ${discDates[0].time}` : ''}
                      </span>
                      {discDates.length > 1 && <span className="disc-date-badge disc-date-badge-extra">+{discDates.length - 1}</span>}
                    </div>
                    {d.thumbnail && <img src={d.thumbnail} alt="" className="disc-card-thumb" />}
                    <div className="disc-card-inner">
                      <span className="disc-level">{d.level}</span>
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
                          Join Session
                          <svg viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </span>
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="disc-cta-row home-cta-row">
            <div className="disc-cta-card">
              <span className="disc-cta-eyebrow">Start Speaking</span>
              <h3>Ready to speak with confidence?</h3>
              <button className="disc-cta-btn" onClick={() => showView('private')}>
                Book a free trial class
                <svg viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <div className="home-cta-art" aria-hidden="true">
                <svg viewBox="0 0 170 150" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="92" cy="70" r="60" fill="rgba(26,46,68,0.05)" />
                  <path d="M44 150 C44 116 66 98 92 98 C118 98 140 116 140 150 Z" fill="#d6dfe7" />
                  <path d="M58 150 L58 132 M126 150 L126 132" stroke="#c2cedA" strokeWidth="3" strokeLinecap="round" />
                  <circle cx="92" cy="66" r="31" fill="#e6edf2" />
                  <path d="M61 64 a31 31 0 0 1 62 0" fill="#cdd8e1" />
                  <path d="M58 66 a34 34 0 0 1 68 0" stroke="#04D5F3" strokeWidth="6" fill="none" strokeLinecap="round" />
                  <rect x="50" y="62" width="13" height="22" rx="6" fill="#04D5F3" />
                  <rect x="121" y="62" width="13" height="22" rx="6" fill="#04D5F3" />
                  <path d="M56 82 C52 104 70 110 86 106" stroke="#04D5F3" strokeWidth="5" fill="none" strokeLinecap="round" />
                  <circle cx="88" cy="105" r="5" fill="#1A2E44" />
                </svg>
              </div>
            </div>
            <div className="disc-quick">
              <h4>Explore</h4>
              <button className="disc-quick-link" onClick={() => showView('private')}>
                <span>Private Classes</span>
                <svg viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <button className="disc-quick-link" onClick={() => showView('group')}>
                <span>Group Classes</span>
                <svg viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <button className="disc-quick-link" onClick={() => showView('discussions')}>
                <span>Discussions</span>
                <svg viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
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
          <div className="disc-hero">
            <button className="back-btn disc-hero-back" onClick={() => showView('select')}>
              <svg viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Back
            </button>
            <div className="disc-hero-content">
              <span className="disc-hero-eyebrow">Group Sessions</span>
              <h1 className="disc-hero-title">Discussion Topics</h1>
              <p className="disc-hero-sub">Explore great conversations and join upcoming sessions</p>
            </div>
            <div className="disc-hero-art" aria-hidden="true">
              <svg viewBox="0 0 200 150" fill="none">
                <path d="M30 28h120a16 16 0 0 1 16 16v44a16 16 0 0 1-16 16H78l-26 22v-22H30a16 16 0 0 1-16-16V44a16 16 0 0 1 16-16z" fill="#1E9DE3"/>
                <circle cx="62" cy="66" r="7" fill="#fff"/>
                <circle cx="90" cy="66" r="7" fill="#fff"/>
                <circle cx="118" cy="66" r="7" fill="#fff"/>
                <path d="M150 96h34a14 14 0 0 1 14 14v30a14 14 0 0 1-14 14h-12l-16 14v-14a14 14 0 0 1-14-14v-30a14 14 0 0 1 14-14z" fill="#0b8fa3" opacity="0.9"/>
                <circle cx="160" cy="124" r="4.5" fill="#fff"/>
                <circle cx="176" cy="124" r="4.5" fill="#fff"/>
              </svg>
            </div>
          </div>

          <div className="disc-section">
            <div className="disc-section-head">
              <span className="disc-section-icon disc-section-icon-up"><span className="disc-pulse"></span></span>
              <h2>Upcoming</h2>
              <span className="disc-section-count">{upcomingDiscussions.length} sessions</span>
            </div>
            {upcomingDiscussions.length === 0 ? (
              <div className="disc-empty">No upcoming discussions scheduled yet</div>
            ) : (
              <div className="disc-grid disc-grid-up">
                {upcomingDiscussions.map((d, i) => {
                  const discDates = d.dates && d.dates.length > 0 ? d.dates : (d.date ? [{ date: d.date, time: d.time }] : []);
                  return (
                  <div key={d.id} className="disc-card disc-upcoming" style={{ animationDelay: `${0.1 + i * 0.1}s`, cursor: 'pointer' }} onClick={() => openDetail(d.id)}>
                    <div className="disc-card-head">
                      <span className="disc-date-badge">
                        <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        {discDates[0]?.date}{discDates[0]?.time ? ` \u00b7 ${discDates[0].time}` : ''}
                      </span>
                      {discDates.length > 1 && <span className="disc-date-badge disc-date-badge-extra">+{discDates.length - 1}</span>}
                    </div>
                    {d.thumbnail && <img src={d.thumbnail} alt="" className="disc-card-thumb" />}
                    <div className="disc-card-inner">
                      <span className="disc-level">{d.level}</span>
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
                          Join Session
                          <svg viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </span>
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="disc-section">
            <div className="disc-section-head">
              <span className="disc-section-icon disc-section-icon-done">
                <svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </span>
              <h2>Completed</h2>
              <span className="disc-section-count disc-section-count-done">{completedDiscussions.length} sessions</span>
            </div>
            {completedDiscussions.length === 0 ? (
              <div className="disc-empty">No completed discussions yet</div>
            ) : (
              <div className="disc-completed-list">
                {completedDiscussions.map((d, i) => {
                  const discDates = d.dates && d.dates.length > 0 ? d.dates : (d.date ? [{ date: d.date, time: d.time }] : []);
                  return (
                  <div key={d.id} className="disc-card disc-completed disc-card-wide" style={{ animationDelay: `${0.15 + i * 0.08}s`, cursor: 'pointer' }} onClick={() => openDetail(d.id)}>
                    <div className="disc-card-inner">
                      <div className="disc-card-head">
                        <span className="disc-date-badge disc-date-badge-done">
                          <svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          {discDates[0]?.date || 'Completed'}
                        </span>
                        <span className="disc-level">{d.level}</span>
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
                          {d.reviews && d.reviews.length > 0 && (
                            <span className="disc-meta-item disc-reviews-count">
                              <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round"/></svg>
                              {d.reviews.length} {d.reviews.length === 1 ? 'review' : 'reviews'}
                            </span>
                          )}
                        </div>
                        <span className="disc-view-btn">
                          View Detail
                          <svg viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </span>
                      </div>
                    </div>
                    {d.thumbnail && <img src={d.thumbnail} alt="" className="disc-wide-thumb" />}
                  </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="disc-cta-row">
            <div className="disc-cta-card">
              <span className="disc-cta-eyebrow">Start Speaking</span>
              <h3>Ready to speak with confidence?</h3>
              <button className="disc-cta-btn" onClick={() => showView('private')}>
                Book a free trial class
                <svg viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <div className="disc-cta-art" aria-hidden="true">
                <svg viewBox="0 0 64 64" fill="none">
                  <rect x="24" y="8" width="16" height="30" rx="8" fill="#c2cedb"/>
                  <path d="M16 30a16 16 0 0 0 32 0" stroke="#c2cedb" strokeWidth="3.5" strokeLinecap="round"/>
                  <line x1="32" y1="46" x2="32" y2="56" stroke="#c2cedb" strokeWidth="3.5" strokeLinecap="round"/>
                  <line x1="22" y1="56" x2="42" y2="56" stroke="#c2cedb" strokeWidth="3.5" strokeLinecap="round"/>
                </svg>
              </div>
            </div>
            <div className="disc-quick">
              <h4>Quick Links</h4>
              <button className="disc-quick-link" onClick={() => showView('private')}>
                <span>Private Classes</span>
                <svg viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <button className="disc-quick-link" onClick={() => showView('group')}>
                <span>Group Classes</span>
                <svg viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <button className="disc-quick-link" onClick={() => showView('select')}>
                <span>Back to Home</span>
                <svg viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Discussion Detail View */}
      <div className={`view ${view === 'detail' ? 'active' : ''}`}>
        {activeDisc && (() => {
          const detailDates = activeDisc.dates && activeDisc.dates.length > 0
            ? activeDisc.dates
            : (activeDisc.date ? [{ date: activeDisc.date, time: activeDisc.time }] : []);
          const reviews = activeDisc.reviews || [];
          return (
          <div className="dt-wrap">
            <button className="back-btn" onClick={() => { setView('discussions'); setEnrollSuccess(false); window.history.pushState(null, '', '/discussions'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
              <svg viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Discussions
            </button>
            <div className={`dt-layout${isCompletedDetail ? ' dt-layout-completed' : ''}`}>
              <div className={`dt-info${isCompletedDetail ? ' dt-info-completed' : ''}`}>
                {activeDisc.thumbnail && <div className="dt-thumb-wrap"><img src={activeDisc.thumbnail} alt="" className="dt-thumb" /></div>}
                <div className="dt-info-content">
                  {isCompletedDetail ? (
                    <>
                      <div className="dt-info-label dt-info-label-done">
                        <span className="dt-done-check">
                          <svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </span>
                        <span>Completed Session</span>
                      </div>
                      <h1 className="dt-title">{activeDisc.topic}</h1>
                      <div className="dt-short-divider"></div>
                      <div className="dt-meta-row">
                        {detailDates.map((dd, i) => (
                          <span key={i} className="dt-meta-tag">
                            <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                            {dd.date}{dd.time ? ` \u00b7 ${dd.time}` : ''}
                          </span>
                        ))}
                        <span className="dt-meta-tag">
                          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                          {activeDisc.duration}
                        </span>
                        <span className="dt-meta-tag dt-joined-tag">
                          <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                          {activeDisc.participants ?? 0} joined
                        </span>
                      </div>
                      <span className="dt-level-badge">{activeDisc.level}</span>
                      <p className="dt-desc">{activeDisc.description}</p>
                    </>
                  ) : (
                    <>
                      <div className="dt-info-label">
                        <span className="disc-pulse"></span>
                        <span>Upcoming Session</span>
                      </div>
                      <h1 className="dt-title">{activeDisc.topic}</h1>
                      <p className="dt-subtitle">{activeDisc.description}</p>
                      <div className="dt-meta-row">
                        {detailDates.map((dd, i) => (
                          <span key={i} className="dt-meta-tag">
                            <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                            {dd.date}
                          </span>
                        ))}
                        <span className="dt-meta-tag">
                          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                          {detailDates[0]?.time ? `${detailDates[0].time} (${activeDisc.duration})` : activeDisc.duration}
                        </span>
                        <span className="dt-meta-tag dt-spots-tag">
                          <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                          {activeDisc.spots ?? 0} spots left
                        </span>
                      </div>
                      <span className="dt-level-badge">{activeDisc.level}</span>
                      <div className="dt-points">
                        <h3>What you&apos;ll discuss</h3>
                        <ul>
                          {(activeDisc.points || []).map((p, i) => (
                            <li key={i} style={{ animationDelay: `${0.3 + i * 0.1}s` }}>{p}</li>
                          ))}
                        </ul>
                      </div>
                    </>
                  )}
                </div>
              </div>
              {isCompletedDetail ? (
                <div className="dt-reviews-panel">
                  <div className="dt-reviews-head">
                    <span className="dt-reviews-eyebrow">Teacher&apos;s Feedback</span>
                    <h2>How the students did</h2>
                  </div>
                  {reviews.length > 0 ? (
                    <>
                      <span className="dt-rev-count">{reviews.length} student {reviews.length === 1 ? 'review' : 'reviews'}</span>
                      <div className="dt-rev-list">
                        {reviews.map((r, i) => (
                          <article key={i} className="dt-rev-card" style={{ animationDelay: `${0.12 + i * 0.07}s` }}>
                            <span className="dt-rev-avatar">{(r.name || '?').trim().charAt(0).toUpperCase()}</span>
                            <div className="dt-rev-body">
                              <div className="dt-rev-head-row">
                                <div className="dt-rev-id">
                                  <span className="dt-rev-name">{r.name}</span>
                                  {r.level && <span className="dt-rev-level">{r.level}</span>}
                                </div>
                              </div>
                              <p className="dt-rev-text">{r.text}</p>
                            </div>
                          </article>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="dt-rev-empty">
                      <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      <p>The teacher hasn&apos;t shared feedback for this session yet.</p>
                    </div>
                  )}
                </div>
              ) : (
              <div className="dt-form-panel">
                {enrollSuccess ? (
                  <div className="success-message">
                    <div className="success-icon" style={{ background: '#fdeaf4' }}>
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
              )}
            </div>
          </div>
          );
        })()}
      </div>

      {/* Footer */}
      {(view === 'select' || view === 'discussions') && (
        <footer className="site-footer">
          <div className="footer-top">
            <div className="footer-lead">
              <span className="footer-eyebrow">ESL Here</span>
              <h3>Speak English with real confidence.</h3>
              <button className="footer-cta-link" onClick={() => showView('private')}>
                <span>Book a free trial class</span>
                <svg viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>
            <div className="footer-nav-cols">
              <nav className="footer-nav">
                <span className="footer-nav-label">Classes</span>
                <button onClick={() => showView('private')}>Private Classes</button>
                <button onClick={() => showView('group')}>Group Classes</button>
              </nav>
              <nav className="footer-nav">
                <span className="footer-nav-label">Community</span>
                <button onClick={() => showView('discussions')}>Discussions</button>
                <button onClick={() => showView('select')}>Home</button>
              </nav>
              <nav className="footer-nav">
                <span className="footer-nav-label">Connect</span>
                <a href="https://www.instagram.com/mahdieh_fhm/" target="_blank" rel="noopener noreferrer">Instagram</a>
                <a href="https://www.linkedin.com/in/mahdieh-fahimpour/" target="_blank" rel="noopener noreferrer">LinkedIn</a>
              </nav>
            </div>
          </div>
          <div className="footer-bottom">
            <img className="footer-logo" src="/images/logo.webp" alt="ESL Here" />
            <div className="footer-socials">
              <a href="https://www.instagram.com/mahdieh_fhm/" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                <svg viewBox="0 0 24 24"><path d="M7.8 2h8.4C19.4 2 22 4.6 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8C4.6 22 2 19.4 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2zm-.2 2A3.6 3.6 0 0 0 4 7.6v8.8C4 18.39 5.61 20 7.6 20h8.8a3.6 3.6 0 0 0 3.6-3.6V7.6C20 5.61 18.39 4 16.4 4H7.6zm9.65 1.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5zM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/></svg>
              </a>
              <a href="https://www.linkedin.com/in/mahdieh-fahimpour/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
                <svg viewBox="0 0 24 24"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2zM4 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4z"/></svg>
              </a>
            </div>
            <span className="footer-copy">&copy; 2024 ESL Here</span>
          </div>
        </footer>
      )}

      <div className={`error-toast ${error ? 'show' : ''}`} style={{ visibility: error ? 'visible' : 'hidden' }}>Something went wrong. Please try again.</div>
    </>
  );
}
