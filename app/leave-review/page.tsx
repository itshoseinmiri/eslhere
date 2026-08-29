'use client';

import { useState } from 'react';
import Link from 'next/link';

const LEVEL_OPTIONS = ['A1–A2', 'A2–B1', 'B1–B2', 'B2–C1', 'C1–C2'];
const MAX_TEXT = 600;

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
        @keyframes lr-pop { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: none; } }
        @keyframes lr-star-in { 0% { transform: scale(0); } 60% { transform: scale(1.25); } 100% { transform: scale(1); } }

        .lr-wrap {
          min-height: 100vh; background: linear-gradient(160deg, #f4f9fb 0%, #eef5f7 100%);
          display: flex; align-items: center; justify-content: center;
          padding: 40px 20px; font-family: 'DM Sans', system-ui, sans-serif;
          animation: lr-page-in 0.4s ease both;
        }
        .lr-card {
          width: 100%; max-width: 520px; background: #fff; border-radius: 20px;
          box-shadow: 0 18px 50px -18px rgba(26,46,68,0.22); padding: 40px 38px;
          animation: lr-fade-up 0.5s ease both;
        }
        .lr-brand { display: flex; align-items: center; gap: 10px; margin-bottom: 26px; }
        .lr-brand img { height: 34px; width: auto; }

        .lr-eyebrow {
          font-size: 0.74rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase;
          color: #2db5c0; margin-bottom: 8px;
        }
        .lr-title { font-size: 1.6rem; font-weight: 700; color: #1a2e44; line-height: 1.15; margin-bottom: 8px; }
        .lr-title em { color: #2db5c0; font-style: normal; }
        .lr-sub { font-size: 0.9rem; color: #6b8095; line-height: 1.5; margin-bottom: 28px; }

        .lr-field { margin-bottom: 20px; }
        .lr-label { display: block; font-size: 0.82rem; font-weight: 600; color: #33475b; margin-bottom: 8px; }
        .lr-input, .lr-select, .lr-textarea {
          width: 100%; padding: 12px 14px; font-family: inherit; font-size: 0.92rem; color: #1a2e44;
          background: #f7fafc; border: 1.5px solid #e2ebf1; border-radius: 10px; outline: none;
          transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
        }
        .lr-input:focus, .lr-select:focus, .lr-textarea:focus {
          border-color: #2db5c0; background: #fff; box-shadow: 0 0 0 3px rgba(45,181,192,0.12);
        }
        .lr-textarea { resize: vertical; min-height: 120px; line-height: 1.55; }
        .lr-select { appearance: none; cursor: pointer;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b8095' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
          background-repeat: no-repeat; background-position: right 14px center; padding-right: 40px;
        }
        .lr-field.err .lr-input, .lr-field.err .lr-select, .lr-field.err .lr-textarea { border-color: #ef4444; background: #fef4f4; }
        .lr-shake { animation: lr-shake 0.5s ease; }
        .lr-err-msg { display: flex; align-items: center; gap: 5px; font-size: 0.76rem; color: #ef4444; margin-top: 6px; }
        .lr-err-msg svg { width: 13px; height: 13px; stroke: #ef4444; stroke-width: 2; fill: none; }

        .lr-stars { display: flex; align-items: center; gap: 6px; }
        .lr-star {
          background: none; border: none; padding: 2px; cursor: pointer; line-height: 0;
          transition: transform 0.12s;
        }
        .lr-star:hover { transform: scale(1.15); }
        .lr-star svg { width: 34px; height: 34px; }
        .lr-star .fill { fill: #f5b301; stroke: #f5b301; }
        .lr-star .empty { fill: #e2ebf1; stroke: #e2ebf1; }
        .lr-rating-label { margin-left: 10px; font-size: 0.82rem; font-weight: 600; color: #f5a201; min-width: 64px; }

        .lr-count { text-align: right; font-size: 0.72rem; color: #9fb2c0; margin-top: 6px; }

        .lr-submit {
          width: 100%; padding: 14px; margin-top: 8px; font-family: inherit; font-size: 0.95rem; font-weight: 600;
          color: #fff; background: #2db5c0; border: none; border-radius: 11px; cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          transition: background 0.15s, transform 0.1s;
        }
        .lr-submit:hover:not(:disabled) { background: #269aa4; }
        .lr-submit:active:not(:disabled) { transform: translateY(1px); }
        .lr-submit:disabled { opacity: 0.7; cursor: default; }
        .lr-spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.4); border-top-color: #fff; border-radius: 50%; animation: lr-spin 0.6s linear infinite; }

        .lr-submit-err { text-align: center; font-size: 0.8rem; color: #ef4444; margin-top: 14px; }

        /* -- success -- */
        .lr-success { text-align: center; padding: 20px 0 8px; animation: lr-pop 0.4s ease both; }
        .lr-check {
          width: 68px; height: 68px; border-radius: 50%; background: #e7f8f5; margin: 0 auto 22px;
          display: flex; align-items: center; justify-content: center;
        }
        .lr-check svg { width: 34px; height: 34px; stroke: #2db5c0; stroke-width: 2.5; fill: none; stroke-linecap: round; stroke-linejoin: round; }
        .lr-success h2 { font-size: 1.4rem; font-weight: 700; color: #1a2e44; margin-bottom: 10px; }
        .lr-success p { font-size: 0.9rem; color: #6b8095; line-height: 1.55; margin-bottom: 24px; }
        .lr-home-link {
          display: inline-flex; align-items: center; gap: 6px; padding: 11px 24px;
          font-size: 0.86rem; font-weight: 600; color: #2db5c0; background: #eef7f8;
          border-radius: 10px; text-decoration: none; transition: background 0.15s;
        }
        .lr-home-link:hover { background: #e2f1f2; }

        @media (max-width: 480px) {
          .lr-card { padding: 30px 22px; }
          .lr-star svg { width: 30px; height: 30px; }
        }
      `}</style>

      <div className="lr-wrap">
        <div className="lr-card">
          {submitted ? (
            <div className="lr-success">
              <div className="lr-check">
                <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
              </div>
              <h2>Thank you!</h2>
              <p>Your review has been submitted and will appear once it&apos;s approved. We really appreciate you sharing your experience.</p>
              <Link href="/" className="lr-home-link">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
                Back to home
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              <div className="lr-brand">
                <img src="/images/logo.png" alt="ESL Here" />
              </div>

              <div className="lr-eyebrow">Share your experience</div>
              <h1 className="lr-title">Leave a <em>review</em></h1>
              <p className="lr-sub">Tell other learners how your English journey has been. Your feedback helps us and future students.</p>

              <div className={`lr-field ${errors.name ? 'err' : ''} ${shakeFields.includes('name') ? 'lr-shake' : ''}`}>
                <label className="lr-label" htmlFor="lr-name">Your name</label>
                <input
                  id="lr-name" className="lr-input" type="text" placeholder="e.g. Sara"
                  value={name} onChange={e => { setName(e.target.value); clearError('name'); }}
                  maxLength={60}
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
                          strokeWidth="1.5" strokeLinejoin="round"
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
                  value={text} onChange={e => { setText(e.target.value.slice(0, MAX_TEXT)); clearError('text'); }}
                />
                <div className="lr-count">{text.length}/{MAX_TEXT}</div>
                {errors.text && <div className="lr-err-msg"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>{errors.text}</div>}
              </div>

              <button type="submit" className="lr-submit" disabled={submitting}>
                {submitting ? <><span className="lr-spinner" />Submitting...</> : 'Submit review'}
              </button>
              {errors.submit && <div className="lr-submit-err">{errors.submit}</div>}
            </form>
          )}
        </div>
      </div>
    </>
  );
}
