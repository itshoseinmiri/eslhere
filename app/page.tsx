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
  const [view, setView] = useState<'select' | 'form'>('select');
  const [tab, setTab] = useState<'private' | 'group'>('private');
  const [successForm, setSuccessForm] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const logoRef = useRef<HTMLImageElement>(null);
  const logoClicksRef = useRef(0);
  const logoTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const path = window.location.pathname;
    const cls = searchParams.get('class');
    if (path === '/register' || cls) {
      setView('form');
      setTab(cls === 'group' ? 'group' : 'private');
    }
  }, [searchParams]);

  function showView(target: 'select' | 'private' | 'group') {
    if (target === 'select') {
      setView('select');
      setSuccessForm(null);
      window.history.pushState(null, '', '/');
    } else if (target === 'private') {
      setView('form');
      setTab('private');
      window.history.pushState(null, '', '/register?class=private');
    } else {
      setView('form');
      setTab('group');
      window.history.pushState(null, '', '/register?class=group');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleLogoClick() {
    logoClicksRef.current++;
    if (logoTimerRef.current) clearTimeout(logoTimerRef.current);
    logoTimerRef.current = setTimeout(() => { logoClicksRef.current = 0; }, 600);
    if (logoClicksRef.current >= 3) {
      logoClicksRef.current = 0;
      sessionStorage.setItem('admin_access_granted', 'true');
      router.push('/login');
    }
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

  return (
    <>

      <header className="top-header">
        <div className="top-header-inner">
          <img ref={logoRef} src="/images/logo.webp" alt="Logo" onClick={handleLogoClick} style={{ height: 40, width: 'auto', objectFit: 'contain' }} />
          <span className="header-tagline">English as a Second Language</span>
        </div>
      </header>

      {/* Selection View */}
      <div className={`view ${view === 'select' ? 'active' : ''}`}>
        <div className="hero-banner">
          <img src="/images/banner.webp" alt="Language. Learning. Impact." />
        </div>
        <div className="selection-wrap">
          <div className="selection-header">
            <span className="section-label">Choose your class</span>
            <h1>Find the right class for you</h1>
          </div>
          <div className="selection-boxes">
            <div className="selection-box">
              <div className="box-body">
                <h3>Private Speaking Classes</h3>
                <p className="box-subtitle">One-on-one English lessons personalized just for you.</p>
                <ul className="box-features">
                  <li>Personalized lesson plan</li>
                  <li>Flexible scheduling</li>
                  <li>Faster progress</li>
                </ul>
                <button className="box-cta" onClick={() => showView('private')}>
                  Book Private Class
                  <svg viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              </div>
              <div className="box-img">
                <img src="/images/private-class.webp" alt="Private Speaking Classes" />
              </div>
            </div>
            <div className="selection-box">
              <div className="box-body">
                <h3>Group Speaking Classes</h3>
                <p className="box-subtitle">Practice with other learners in a supportive group.</p>
                <ul className="box-features">
                  <li>Interactive group discussions</li>
                  <li>Learn from peers</li>
                  <li>Affordable &amp; fun</li>
                </ul>
                <button className="box-cta" onClick={() => showView('group')}>
                  Book Group Class
                  <svg viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              </div>
              <div className="box-img">
                <img src="/images/group-class.webp" alt="Group Speaking Classes" />
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

      {/* Footer CTA + Footer (only on select view) */}
      {view === 'select' && (
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
