'use client';

import { useState } from 'react';
import Link from 'next/link';

const LEVEL_OPTIONS = ['A1–A2', 'A2–B1', 'B1–B2', 'B2–C1', 'C1–C2'];

export default function LeaveReviewPage() {
  const [name, setName] = useState('');
  const [level, setLevel] = useState('');
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [text, setText] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [shakeFields, setShakeFields] = useState<string[]>([]);

  function clearError(field: string) {
    if (errors[field]) setErrors(prev => { const { [field]: _, ...rest } = prev; return rest; });
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Please enter your name';
    if (!level) errs.level = 'Please select your level';
    if (rating < 1) errs.rating = 'Please pick a rating';
    if (!text.trim()) errs.text = 'Please write a few words';

    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      setShakeFields(Object.keys(errs));
      setTimeout(() => setShakeFields([]), 600);
      return false;
    }
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), level, rating, text: text.trim() }),
      });
      if (!res.ok) throw new Error();
      setSubmitted(true);
    } catch {
      setErrors({ submit: 'Something went wrong. Please try again.' });
    }
    setSubmitting(false);
  }

  const activeStar = hoverRating || rating;
  const RATING_LABELS = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'];

  return (
    <>
      <style jsx global>{`
        @keyframes lr-page-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes lr-fade-up { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
        @keyframes lr-shake { 0%,100% { transform: translateX(0); } 20%,60% { transform: translateX(-4px); } 40%,80% { transform: translateX(4px); } }
        @keyframes lr-spin { to { transform: rotate(360deg); } }
        @keyframes lr-pop { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: none; } }

        body { padding: 0 !important; }

        .lr-page {
          width: 100%;
          min-height: 100vh;
          background: linear-gradient(160deg, #f4f9fb 0%, #e6f1f4 55%, #eef5f7 100%);
          font-family: 'DM Sans', system-ui, sans-serif;
          display: flex;
          flex-direction: column;
          animation: lr-page-in 0.4s ease both;
          box-sizing: border-box;
        }

        /* top bar full width */
        .lr-topbar {
          width: 100%;
          max-width: 1280px;
          margin: 0 auto;
          padding: 20px 32px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          box-sizing: border-box;
        }
        .lr-topbar-brand img { height: 34px; width: auto; display: block; }
        .lr-topbar-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 0.86rem;
          font-weight: 600;
          color: #1a2e44;
          background: #fff;
          border: 1px solid #e2ebf1;
          padding: 9px 16px;
          border-radius: 999px;
          text-decoration: none;
          transition: border-color 0.15s, background 0.15s, transform 0.1s;
          white-space: nowrap;
        }
        .lr-topbar-link:hover { border-color: #c9deea; background: #f7fafc; }
        .lr-topbar-link:active { transform: translateY(1px); }

        /* shell full page width */
        .lr-shell {
          width: 100%;
          max-width: 1280px;
          margin: 0 auto;
          padding: 12px 32px 48px;
          display: grid;
          grid-template-columns: 1fr 1.05fr;
          gap: 48px;
          align-items: start;
          flex: 1;
          box-sizing: border-box;
        }

        /* left intro */
        .lr-intro {
          padding: 28px 12px 0 0;
          animation: lr-fade-up 0.5s ease both;
        }
        .lr-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #2db5c0;
          background: #e6f6f7;
          padding: 6px 12px;
          border-radius: 999px;
          margin-bottom: 18px;
        }
        .lr-eyebrow-dot {
          width: 6px; height: 6px; border-radius: 50%; background: #2db5c0; display: inline-block;
        }
        .lr-title {
          font-size: clamp(1.9rem, 3.2vw, 2.7rem);
          font-weight: 800;
          color: #1a2e44;
          line-height: 1.08;
          letter-spacing: -0.03em;
          margin: 0 0 14px;
        }
        .lr-title em { color: #2db5c0; font-style: normal; }
        .lr-sub {
          font-size: clamp(0.92rem, 1.1vw, 1.02rem);
          color: #5f7a8f;
          line-height: 1.6;
          margin: 0 0 28px;
          max-width: 520px;
        }

        .lr-benefits {
          list-style: none;
          padding: 0;
          margin: 0 0 28px;
          display: grid;
          gap: 12px;
        }
        .lr-benefit {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          font-size: 0.9rem;
          color: #33475b;
          line-height: 1.45;
        }
        .lr-benefit-icon {
          flex-shrink: 0;
          width: 28px; height: 28px;
          border-radius: 50%;
          background: #fff;
          border: 1px solid #e2ebf1;
          display: flex; align-items: center; justify-content: center;
          color: #2db5c0;
        }
        .lr-benefit-icon svg { width: 14px; height: 14px; stroke: currentColor; stroke-width: 2.1; fill: none; }

        .lr-quote {
          background: #fff;
          border: 1px solid #e6eef3;
          border-radius: 16px;
          padding: 18px 18px 16px;
          box-shadow: 0 10px 30px -18px rgba(26,46,68,0.18);
          max-width: 520px;
        }
        .lr-quote-stars { display: flex; gap: 3px; margin-bottom: 10px; color: #f5b301; }
        .lr-quote-stars svg { width: 16px; height: 16px; fill: currentColor; stroke: currentColor; }
        .lr-quote-text { font-size: 0.88rem; color: #33475b; line-height: 1.6; margin: 0 0 12px; font-style: italic; }
        .lr-quote-author { display: flex; align-items: center; gap: 10px; }
        .lr-quote-avatar {
          width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #2db5c0, #1a8f98);
          color: #fff; font-weight: 700; font-size: 0.82rem; display: flex; align-items: center; justify-content: center;
        }
        .lr-quote-name { font-size: 0.84rem; font-weight: 700; color: #1a2e44; line-height: 1.1; }
        .lr-quote-role { font-size: 0.76rem; color: #7e95a9; }

        .lr-stats {
          display: flex;
          gap: 20px;
          margin-top: 22px;
          padding-top: 22px;
          border-top: 1px solid #e6eef3;
          max-width: 520px;
        }
        .lr-stat-num { font-size: 1.35rem; font-weight: 800; color: #1a2e44; line-height: 1; }
        .lr-stat-label { font-size: 0.72rem; font-weight: 600; color: #7e95a9; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 4px; }

        /* right card */
        .lr-card {
          width: 100%;
          background: #fff;
          border-radius: 20px;
          box-shadow: 0 18px 60px -22px rgba(26,46,68,0.22), 0 4px 18px -8px rgba(26,46,68,0.08);
          border: 1px solid #eef3f7;
          padding: 32px 34px 28px;
          animation: lr-fade-up 0.5s 0.08s ease both;
          box-sizing: border-box;
        }
        .lr-card-head { margin-bottom: 22px; }
        .lr-card-title { font-size: 1.15rem; font-weight: 750; color: #1a2e44; margin: 0 0 6px; letter-spacing: -0.02em; }
        .lr-card-sub { font-size: 0.86rem; color: #7e95a9; line-height: 1.5; margin: 0; }

        .lr-field { margin-bottom: 18px; }
        .lr-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 2px;
        }
        .lr-label { display: block; font-size: 0.82rem; font-weight: 650; color: #33475b; margin-bottom: 8px; }
        .lr-input, .lr-select, .lr-textarea {
          width: 100%; padding: 12px 14px; font-family: inherit; font-size: 0.92rem; color: #1a2e44;
          background: #f7fafc; border: 1.5px solid #e2ebf1; border-radius: 11px; outline: none;
          transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
          box-sizing: border-box;
        }
        .lr-input:focus, .lr-select:focus, .lr-textarea:focus {
          border-color: #2db5c0; background: #fff; box-shadow: 0 0 0 3px rgba(45,181,192,0.14);
        }
        .lr-textarea { resize: vertical; min-height: 138px; line-height: 1.55; }
        .lr-select { appearance: none; cursor: pointer;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b8095' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
          background-repeat: no-repeat; background-position: right 14px center; padding-right: 40px;
        }
        .lr-field.err .lr-input, .lr-field.err .lr-select, .lr-field.err .lr-textarea { border-color: #ef4444; background: #fef4f4; }
        .lr-shake { animation: lr-shake 0.5s ease; }
        .lr-err-msg { display: flex; align-items: center; gap: 5px; font-size: 0.76rem; color: #ef4444; margin-top: 7px; line-height: 1.3; }
        .lr-err-msg svg { width: 13px; height: 13px; stroke: #ef4444; stroke-width: 2; fill: none; flex-shrink: 0; }

        .lr-stars { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .lr-star {
          background: none; border: none; padding: 2px; cursor: pointer; line-height: 0;
          transition: transform 0.12s;
        }
        .lr-star:hover { transform: scale(1.12); }
        .lr-star:focus-visible { outline: 2px solid #2db5c0; outline-offset: 2px; border-radius: 6px; }
        .lr-star svg { width: 36px; height: 36px; }
        .lr-star .fill { fill: #f5b301; stroke: #f5b301; }
        .lr-star .empty { fill: #e8eef3; stroke: #e8eef3; }
        .lr-rating-label { margin-left: 10px; font-size: 0.84rem; font-weight: 700; color: #c68a00; min-width: 64px; }

        .lr-submit {
          width: 100%; padding: 14px 18px; margin-top: 10px; font-family: inherit; font-size: 0.96rem; font-weight: 700;
          color: #fff; background: #2db5c0; border: none; border-radius: 12px; cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          transition: background 0.15s, transform 0.1s, box-shadow 0.15s;
          box-shadow: 0 8px 20px -12px rgba(45,181,192,0.9);
        }
        .lr-submit:hover:not(:disabled) { background: #269aa4; box-shadow: 0 10px 24px -12px rgba(45,181,192,0.9); }
        .lr-submit:active:not(:disabled) { transform: translateY(1px); }
        .lr-submit:disabled { opacity: 0.7; cursor: default; }
        .lr-spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.4); border-top-color: #fff; border-radius: 50%; animation: lr-spin 0.6s linear infinite; }
        .lr-submit-err { text-align: center; font-size: 0.82rem; color: #ef4444; margin-top: 12px; background: #fef2f2; border: 1px solid #fde2e2; padding: 10px 12px; border-radius: 10px; }
        .lr-footnote { text-align: center; font-size: 0.74rem; color: #9fb2c0; margin-top: 14px; line-height: 1.5; }

        /* success */
        .lr-success-wrap {
          width: 100%;
          max-width: 740px;
          margin: 40px auto;
          background: #fff;
          border-radius: 20px;
          box-shadow: 0 18px 60px -22px rgba(26,46,68,0.22);
          border: 1px solid #eef3f7;
          padding: 48px 36px 40px;
          text-align: center;
          animation: lr-pop 0.45s ease both;
          box-sizing: border-box;
        }
        .lr-check {
          width: 72px; height: 72px; border-radius: 50%; background: #e7f8f5; margin: 0 auto 22px;
          display: flex; align-items: center; justify-content: center;
        }
        .lr-check svg { width: 36px; height: 36px; stroke: #2db5c0; stroke-width: 2.5; fill: none; stroke-linecap: round; stroke-linejoin: round; }
        .lr-success-wrap h2 { font-size: clamp(1.4rem, 2.2vw, 1.7rem); font-weight: 800; color: #1a2e44; margin: 0 0 10px; letter-spacing: -0.02em; }
        .lr-success-wrap p { font-size: 0.95rem; color: #6b8095; line-height: 1.6; margin: 0 auto 26px; max-width: 520px; }
        .lr-home-link {
          display: inline-flex; align-items: center; gap: 8px; padding: 12px 24px;
          font-size: 0.9rem; font-weight: 700; color: #fff; background: #2db5c0;
          border-radius: 999px; text-decoration: none; transition: background 0.15s, transform 0.1s;
        }
        .lr-home-link:hover { background: #269aa4; }
        .lr-home-link:active { transform: translateY(1px); }

        /* responsive */
        @media (max-width: 1024px) {
          .lr-shell { gap: 36px; padding: 8px 24px 40px; }
          .lr-card { padding: 28px 26px 24px; }
        }

        @media (max-width: 860px) {
          .lr-shell {
            grid-template-columns: 1fr;
            gap: 24px;
            padding: 4px 20px 32px;
          }
          .lr-intro { padding: 8px 0 0; }
          .lr-sub, .lr-quote, .lr-stats, .lr-benefits { max-width: none; }
          .lr-stats { justify-content: flex-start; }
          .lr-card { border-radius: 18px; }
        }

        @media (max-width: 640px) {
          .lr-topbar { padding: 14px 16px; }
          .lr-topbar-brand img { height: 28px; }
          .lr-topbar-link { font-size: 0.8rem; padding: 8px 13px; }
          .lr-shell { padding: 0 16px 28px; gap: 18px; }
          .lr-intro { padding: 4px 2px 0; }
          .lr-title { font-size: 1.65rem; }
          .lr-sub { font-size: 0.9rem; margin-bottom: 20px; }
          .lr-benefits { gap: 10px; margin-bottom: 18px; }
          .lr-benefit { font-size: 0.86rem; }
          .lr-quote { padding: 16px 14px; border-radius: 14px; }
          .lr-stats { gap: 16px; margin-top: 16px; padding-top: 16px; }
          .lr-card { padding: 22px 16px 18px; border-radius: 16px; }
          .lr-card-title { font-size: 1.05rem; }
          .lr-row { grid-template-columns: 1fr; gap: 0; }
          .lr-row .lr-field { margin-bottom: 18px; }
          .lr-star svg { width: 32px; height: 32px; }
          .lr-textarea { min-height: 126px; }
          .lr-success-wrap { margin: 16px auto; padding: 32px 20px 28px; border-radius: 16px; }
        }

        @media (max-width: 380px) {
          .lr-star svg { width: 28px; height: 28px; }
          .lr-stats { gap: 12px; }
          .lr-stat-num { font-size: 1.2rem; }
        }
      `}</style>

      <div className="lr-page">
        <header className="lr-topbar">
          <Link href="/" className="lr-topbar-brand" aria-label="ESL Here - Home">
            <img src="/images/logo.png" alt="ESL Here" />
          </Link>
          <Link href="/" className="lr-topbar-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
            Back to home
          </Link>
        </header>

        <div className="lr-shell">
          {submitted ? (
            <div style={{ gridColumn: '1 / -1' }}>
              <div className="lr-success-wrap">
                <div className="lr-check">
                  <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
                </div>
                <h2>Thank you!</h2>
                <p>Your review has been submitted and will appear once it&apos;s approved. We really appreciate you sharing your experience.</p>
                <Link href="/" className="lr-home-link">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
                  Back to home
                </Link>
              </div>
            </div>
          ) : (
            <>
              {/* Left intro - visible on all sizes, stacks on mobile */}
              <div className="lr-intro">
                <div className="lr-eyebrow"><span className="lr-eyebrow-dot" /> Share your experience</div>
                <h1 className="lr-title">Leave a <em>review</em> that helps others learn</h1>
                <p className="lr-sub">Tell future learners how your English journey has been. Your honest feedback helps us improve and inspires new students to get started.</p>

                <ul className="lr-benefits">
                  <li className="lr-benefit">
                    <span className="lr-benefit-icon"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg></span>
                    <span>Your review is moderated and published within 24 hours.</span>
                  </li>
                  <li className="lr-benefit">
                    <span className="lr-benefit-icon"><svg viewBox="0 0 24 24"><path d="M12 2l3 6.5L22 9l-5 4.9 1.2 6.8L12 17l-6.2 3.7L7 13.9 2 9l7-0.5L12 2z" /></svg></span>
                    <span>Help others choose the right level — A1 to C2.</span>
                  </li>
                  <li className="lr-benefit">
                    <span className="lr-benefit-icon"><svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg></span>
                    <span>Takes less than a minute — just a few words are enough.</span>
                  </li>
                </ul>

                <div className="lr-quote">
                  <div className="lr-quote-stars" aria-hidden="true">
                    {[1,2,3,4,5].map(i => (
                      <svg key={i} viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                    ))}
                  </div>
                  <p className="lr-quote-text">“My speaking confidence doubled in just a few weeks. The discussions are practical, fun, and I finally feel comfortable using English at work.”</p>
                  <div className="lr-quote-author">
                    <div className="lr-quote-avatar">S</div>
                    <div>
                      <div className="lr-quote-name">Sara — B1–B2</div>
                      <div className="lr-quote-role">Verified student</div>
                    </div>
                  </div>
                </div>

                <div className="lr-stats">
                  <div className="lr-stat">
                    <div className="lr-stat-num">4.9/5</div>
                    <div className="lr-stat-label">Average rating</div>
                  </div>
                  <div className="lr-stat">
                    <div className="lr-stat-num">500+</div>
                    <div className="lr-stat-label">Happy learners</div>
                  </div>
                  <div className="lr-stat">
                    <div className="lr-stat-num">100%</div>
                    <div className="lr-stat-label">Verified reviews</div>
                  </div>
                </div>
              </div>

              {/* Right form card */}
              <div className="lr-card">
                <div className="lr-card-head">
                  <h2 className="lr-card-title">Your feedback</h2>
                  <p className="lr-card-sub">All fields are required. Your name and level will be shown publicly.</p>
                </div>

                <form onSubmit={handleSubmit} noValidate>
                  <div className="lr-row">
                    <div className={`lr-field ${errors.name ? 'err' : ''} ${shakeFields.includes('name') ? 'lr-shake' : ''}`}>
                      <label className="lr-label" htmlFor="lr-name">Your name</label>
                      <input
                        id="lr-name" className="lr-input" type="text" placeholder="e.g. Sara"
                        value={name} onChange={e => { setName(e.target.value); clearError('name'); }}
                        maxLength={60} autoComplete="name"
                      />
                      {errors.name && <div className="lr-err-msg"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>{errors.name}</div>}
                    </div>

                    <div className={`lr-field ${errors.level ? 'err' : ''} ${shakeFields.includes('level') ? 'lr-shake' : ''}`}>
                      <label className="lr-label" htmlFor="lr-level">Your English level</label>
                      <select
                        id="lr-level" className="lr-select"
                        value={level} onChange={e => { setLevel(e.target.value); clearError('level'); }}
                      >
                        <option value="" disabled>Select your level</option>
                        {LEVEL_OPTIONS.map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                      {errors.level && <div className="lr-err-msg"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>{errors.level}</div>}
                    </div>
                  </div>

                  <div className={`lr-field ${errors.rating ? 'err' : ''} ${shakeFields.includes('rating') ? 'lr-shake' : ''}`}>
                    <label className="lr-label">Your rating</label>
                    <div className="lr-stars" onMouseLeave={() => setHoverRating(0)}>
                      {[1, 2, 3, 4, 5].map(n => (
                        <button
                          key={n} type="button" className="lr-star" aria-label={`${n} star${n > 1 ? 's' : ''}`}
                          onMouseEnter={() => setHoverRating(n)}
                          onClick={() => { setRating(n); clearError('rating'); }}
                        >
                          <svg viewBox="0 0 24 24">
                            <polygon
                              className={n <= activeStar ? 'fill' : 'empty'}
                              strokeWidth="1.4" strokeLinejoin="round"
                              points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
                            />
                          </svg>
                        </button>
                      ))}
                      {activeStar > 0 && <span className="lr-rating-label">{RATING_LABELS[activeStar]}</span>}
                    </div>
                    {errors.rating && <div className="lr-err-msg"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>{errors.rating}</div>}
                  </div>

                  <div className={`lr-field ${errors.text ? 'err' : ''} ${shakeFields.includes('text') ? 'lr-shake' : ''}`}>
                    <label className="lr-label" htmlFor="lr-text">Your review</label>
                    <textarea
                      id="lr-text" className="lr-textarea" placeholder="What did you enjoy? How has your English improved?"
                      value={text} onChange={e => { setText(e.target.value); clearError('text'); }}
                      rows={5}
                    />
                    {errors.text && <div className="lr-err-msg"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>{errors.text}</div>}
                  </div>

                  <button type="submit" className="lr-submit" disabled={submitting}>
                    {submitting ? <><span className="lr-spinner" />Submitting...</> : 'Submit review'}
                  </button>
                  {errors.submit && <div className="lr-submit-err">{errors.submit}</div>}
                  <div className="lr-footnote">By submitting, you agree to our review guidelines. We only publish constructive, respectful feedback.</div>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
