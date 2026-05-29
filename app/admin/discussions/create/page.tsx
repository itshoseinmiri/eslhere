'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAdmin } from '../../admin-context';

const LEVEL_OPTIONS = ['A1–A2', 'A2–B1', 'B1–B2', 'B2–C1', 'C1–C2'];

const DURATION_OPTIONS = [
  { value: '45 min', label: '45 min' },
  { value: '60 min', label: '60 min' },
  { value: '90 min', label: '90 min' },
];

export default function CreateDiscussionPage() {
  const { token, logout } = useAdmin();
  const router = useRouter();

  const [topic, setTopic] = useState('');
  const [description, setDescription] = useState('');
  const [level, setLevel] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('18:00');
  const [duration, setDuration] = useState('60 min');
  const [spots, setSpots] = useState(10);
  const [isCompleted, setIsCompleted] = useState(false);
  const [participants, setParticipants] = useState(0);
  const [points, setPoints] = useState(['', '', '']);

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [shakeFields, setShakeFields] = useState<string[]>([]);

  useEffect(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    setDate(d.toISOString().split('T')[0]);
  }, []);

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!topic.trim()) errs.topic = 'Discussion topic is required';
    if (!description.trim()) errs.description = 'Description is required';
    if (!level) errs.level = 'Please select a level';
    if (!date) errs.date = 'Please pick a date';
    if (!isCompleted) {
      if (!time) errs.time = 'Please set a time';
      if (spots < 1 || spots > 50) errs.spots = 'Spots must be between 1 and 50';
    } else {
      if (participants < 1) errs.participants = 'Participants must be at least 1';
    }
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
      const d = new Date(`${date}T${time}:00`);
      const dateLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      const filteredPoints = points.map(p => p.trim()).filter(Boolean);

      const payload: Record<string, unknown> = {
        topic: topic.trim(),
        description: description.trim(),
        level,
        date: dateLabel,
        duration,
        ...(isCompleted
          ? { status: 'completed', participants }
          : { time, spots, points: filteredPoints.length > 0 ? filteredPoints : undefined }),
      };

      const res = await fetch('/api/discussions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(payload),
      });

      if (res.status === 401) { logout(); return; }
      if (!res.ok) throw new Error();

      setSubmitted(true);
      setTimeout(() => router.push('/admin/discussions'), 1600);
    } catch {
      setErrors({ submit: 'Something went wrong. Please try again.' });
    }
    setSubmitting(false);
  }

  function addPoint() { setPoints(prev => [...prev, '']); }
  function removePoint(idx: number) { setPoints(prev => prev.filter((_, i) => i !== idx)); }
  function updatePoint(idx: number, val: string) { setPoints(prev => prev.map((p, i) => i === idx ? val : p)); }

  const previewDate = date && time
    ? new Date(`${date}T${time}`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : '';

  return (
    <>
      <style jsx global>{`
        /* ── Create Discussion ── */
        @keyframes cd-page-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes cd-fade-up { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        @keyframes cd-shake { 0%,100% { transform: translateX(0); } 20%,60% { transform: translateX(-4px); } 40%,80% { transform: translateX(4px); } }
        @keyframes cd-spin { to { transform: rotate(360deg); } }
        @keyframes cd-success-in { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: none; } }

        .cd-page { animation: cd-page-in 0.3s ease both; }

        .cd-breadcrumb {
          display: flex; align-items: center; gap: 6px; margin-bottom: 22px;
          font-size: 0.78rem; color: #94a7b5; animation: cd-fade-up 0.35s ease both;
        }
        .cd-breadcrumb a { color: #2db5c0; text-decoration: none; font-weight: 500; }
        .cd-breadcrumb a:hover { text-decoration: underline; }
        .cd-breadcrumb svg { width: 12px; height: 12px; stroke: #b0bfcc; stroke-width: 2; fill: none; }

        .cd-header {
          display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 28px;
          animation: cd-fade-up 0.4s ease 0.05s both;
        }
        .cd-title { font-family: 'DM Sans', sans-serif; font-size: 1.3rem; font-weight: 600; color: #1a2e44; letter-spacing: -0.02em; margin-bottom: 4px; }
        .cd-subtitle { font-size: 0.8125rem; color: #8ba3b5; }

        .cd-cancel-btn {
          display: flex; align-items: center; gap: 6px; padding: 8px 18px;
          font-family: 'DM Sans', sans-serif; font-size: 0.8125rem; font-weight: 500;
          color: #5f7a8f; background: #fff; border: 1px solid #d8e3ec; border-radius: 7px;
          cursor: pointer; transition: all 0.15s; text-decoration: none;
        }
        .cd-cancel-btn:hover { border-color: #94a7b5; color: #1a2e44; }

        .cd-grid {
          display: grid; grid-template-columns: 1fr 320px; gap: 24px; align-items: flex-start;
          animation: cd-fade-up 0.45s ease 0.1s both;
        }

        .cd-card {
          background: #fff; border: 1px solid #f0f3f6; border-radius: 12px;
          padding: 24px; margin-bottom: 20px;
          box-shadow: 0 1px 4px rgba(0,0,0,0.03);
        }
        .cd-card-title {
          font-family: 'DM Sans', sans-serif; font-size: 0.88rem; font-weight: 600;
          color: #1a2e44; margin-bottom: 18px; letter-spacing: -0.01em;
        }

        .cd-field { margin-bottom: 16px; }
        .cd-field:last-child { margin-bottom: 0; }
        .cd-label {
          display: block; font-size: 0.75rem; font-weight: 600; color: #5f7a8f;
          margin-bottom: 6px; letter-spacing: 0.01em;
        }
        .cd-label-opt { font-weight: 400; color: #b0bfcc; margin-left: 4px; }
        .cd-input, .cd-textarea, .cd-select {
          width: 100%; padding: 9px 13px; font-family: 'DM Sans', sans-serif;
          font-size: 0.84rem; color: #1a2e44; background: #fff;
          border: 1px solid #d8e3ec; border-radius: 7px; outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .cd-input::placeholder, .cd-textarea::placeholder { color: #b0bfcc; }
        .cd-input:focus, .cd-textarea:focus, .cd-select:focus { border-color: #2db5c0; box-shadow: 0 0 0 3px rgba(45,181,192,0.08); }
        .cd-input.has-error, .cd-textarea.has-error, .cd-select.has-error { border-color: #ef4444; }
        .cd-textarea { min-height: 80px; resize: vertical; line-height: 1.6; }
        .cd-select { cursor: pointer; appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a7b5' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 12px center; padding-right: 32px; }

        .cd-error { font-size: 0.72rem; color: #ef4444; margin-top: 5px; display: flex; align-items: center; gap: 4px; }
        .cd-error svg { width: 12px; height: 12px; stroke: #ef4444; stroke-width: 2; fill: none; }

        .cd-shake { animation: cd-shake 0.4s ease; }

        .cd-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }

        .cd-dur-pills { display: flex; gap: 8px; flex-wrap: wrap; }
        .cd-dur-pill {
          padding: 7px 18px; border-radius: 20px; border: 1px solid #d8e3ec;
          font-family: 'DM Sans', sans-serif; font-size: 0.78rem; font-weight: 500;
          color: #5f7a8f; background: #fff; cursor: pointer; transition: all 0.15s;
        }
        .cd-dur-pill:hover { border-color: #2db5c0; color: #2a6270; }
        .cd-dur-pill.active { background: #2db5c0; border-color: #2db5c0; color: #fff; }

        .cd-level-pills { display: flex; gap: 8px; flex-wrap: wrap; }
        .cd-level-pill {
          padding: 7px 16px; border-radius: 20px; border: 1px solid #d8e3ec;
          font-family: 'DM Sans', sans-serif; font-size: 0.78rem; font-weight: 500;
          color: #5f7a8f; background: #fff; cursor: pointer; transition: all 0.15s;
        }
        .cd-level-pill:hover { border-color: #7c3aed; color: #6d28d9; }
        .cd-level-pill.active { background: #7c3aed; border-color: #7c3aed; color: #fff; }

        /* Completed checkbox */
        .cd-completed-toggle {
          display: flex; align-items: center; gap: 10px;
          padding: 14px 18px; border-radius: 10px;
          background: #fafcfd; border: 1px solid #f0f3f6;
          margin-bottom: 20px; cursor: pointer; transition: all 0.15s;
          user-select: none;
        }
        .cd-completed-toggle:hover { border-color: #d8e3ec; }
        .cd-completed-toggle.active { background: #f5f3ff; border-color: #e9e5ff; }
        .cd-checkbox {
          width: 18px; height: 18px; border-radius: 5px;
          border: 2px solid #c5d2dc; background: #fff;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.15s; flex-shrink: 0;
        }
        .cd-checkbox.checked { background: #7c3aed; border-color: #7c3aed; }
        .cd-checkbox svg { width: 12px; height: 12px; stroke: #fff; stroke-width: 3; fill: none; stroke-linecap: round; stroke-linejoin: round; }
        .cd-toggle-text { flex: 1; }
        .cd-toggle-label { font-family: 'DM Sans', sans-serif; font-size: 0.84rem; font-weight: 600; color: #1a2e44; }
        .cd-toggle-hint { font-size: 0.72rem; color: #94a7b5; margin-top: 1px; }

        /* Points */
        .cd-point-row { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
        .cd-point-row:last-child { margin-bottom: 0; }
        .cd-point-input { flex: 1; }
        .cd-point-remove {
          width: 28px; height: 28px; border-radius: 6px; border: none;
          background: #fef2f2; color: #ef4444; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.15s; flex-shrink: 0;
        }
        .cd-point-remove:hover { background: #fee2e2; }
        .cd-point-remove svg { width: 14px; height: 14px; stroke: currentColor; stroke-width: 2; fill: none; }
        .cd-add-point {
          display: flex; align-items: center; gap: 6px; margin-top: 10px;
          font-family: 'DM Sans', sans-serif; font-size: 0.78rem; font-weight: 500;
          color: #2db5c0; background: none; border: none; cursor: pointer;
          padding: 4px 0; transition: color 0.15s;
        }
        .cd-add-point:hover { color: #2a6270; }
        .cd-add-point svg { width: 14px; height: 14px; stroke: currentColor; stroke-width: 2; fill: none; }

        /* Preview sidebar */
        .cd-preview {
          position: sticky; top: 28px;
          background: #fff; border: 1px solid #f0f3f6; border-radius: 12px;
          box-shadow: 0 1px 4px rgba(0,0,0,0.03); overflow: hidden;
        }
        .cd-preview-head {
          padding: 18px 20px; border-bottom: 1px solid #f0f3f6;
          font-family: 'DM Sans', sans-serif; font-size: 0.84rem; font-weight: 600;
          color: #1a2e44;
        }
        .cd-preview-body { padding: 18px 20px; }
        .cd-preview-row { display: flex; margin-bottom: 14px; }
        .cd-preview-row:last-child { margin-bottom: 0; }
        .cd-preview-icon {
          width: 32px; height: 32px; border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; margin-right: 12px;
        }
        .cd-preview-icon svg { width: 15px; height: 15px; stroke: currentColor; stroke-width: 2; fill: none; stroke-linecap: round; stroke-linejoin: round; }
        .cd-preview-label { font-size: 0.68rem; color: #94a7b5; margin-bottom: 2px; }
        .cd-preview-val { font-family: 'DM Sans', sans-serif; font-size: 0.82rem; font-weight: 600; color: #1a2e44; }
        .cd-preview-val.empty { color: #c5d2dc; font-weight: 400; font-style: italic; }

        .cd-preview-points { margin-top: 14px; padding-top: 14px; border-top: 1px solid #f0f3f6; }
        .cd-preview-points-title { font-size: 0.72rem; font-weight: 600; color: #94a7b5; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em; }
        .cd-preview-point { font-size: 0.78rem; color: #5f7a8f; padding: 3px 0; padding-left: 14px; position: relative; }
        .cd-preview-point::before { content: ''; position: absolute; left: 0; top: 11px; width: 5px; height: 5px; border-radius: 50%; background: #2db5c0; }

        .cd-preview-footer { padding: 16px 20px; border-top: 1px solid #f0f3f6; }
        .cd-submit {
          width: 100%; padding: 10px; font-family: 'DM Sans', sans-serif;
          font-size: 0.84rem; font-weight: 600; color: #fff;
          background: #2db5c0; border: none; border-radius: 8px;
          cursor: pointer; transition: all 0.2s; display: flex;
          align-items: center; justify-content: center; gap: 8px;
        }
        .cd-submit:hover { background: #2a6270; }
        .cd-submit:disabled { opacity: 0.5; cursor: not-allowed; }
        .cd-submit .cd-spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: cd-spin 0.6s linear infinite; }

        /* Success overlay */
        .cd-success-overlay {
          position: fixed; inset: 0; z-index: 200;
          background: rgba(255,255,255,0.92); backdrop-filter: blur(6px);
          display: flex; align-items: center; justify-content: center;
          animation: cd-success-in 0.3s ease both;
        }
        .cd-success-box { text-align: center; }
        .cd-success-icon {
          width: 56px; height: 56px; border-radius: 50%;
          background: #ecfdf5; display: flex; align-items: center; justify-content: center;
          margin: 0 auto 16px;
        }
        .cd-success-icon svg { width: 28px; height: 28px; stroke: #059669; stroke-width: 2.5; fill: none; stroke-linecap: round; stroke-linejoin: round; }
        .cd-success-title { font-family: 'DM Sans', sans-serif; font-size: 1.15rem; font-weight: 600; color: #1a2e44; margin-bottom: 6px; }
        .cd-success-hint { font-size: 0.84rem; color: #8ba3b5; }

        @media (max-width: 900px) {
          .cd-grid { grid-template-columns: 1fr; }
          .cd-preview { position: static; }
          .cd-row { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="cd-page">
        {/* Breadcrumb */}
        <div className="cd-breadcrumb">
          <Link href="/admin/discussions">Discussion Enrollments</Link>
          <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
          <span>Create Discussion</span>
        </div>

        {/* Header */}
        <div className="cd-header">
          <div>
            <div className="cd-title">Create Discussion</div>
            <div className="cd-subtitle">Set up a new discussion session for students to join</div>
          </div>
          <Link href="/admin/discussions" className="cd-cancel-btn">Cancel</Link>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="cd-grid">
            {/* Left column — Form */}
            <div>
              {/* Topic & Description */}
              <div className="cd-card">
                <div className="cd-card-title">Discussion Details</div>
                <div className={`cd-field ${shakeFields.includes('topic') ? 'cd-shake' : ''}`}>
                  <label className="cd-label">Topic</label>
                  <input
                    className={`cd-input${errors.topic ? ' has-error' : ''}`}
                    placeholder="e.g. The Future of Remote Work"
                    value={topic}
                    onChange={e => { setTopic(e.target.value); if (errors.topic) setErrors(prev => { const { topic: _, ...rest } = prev; return rest; }); }}
                  />
                  {errors.topic && <div className="cd-error"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>{errors.topic}</div>}
                </div>
                <div className={`cd-field ${shakeFields.includes('description') ? 'cd-shake' : ''}`}>
                  <label className="cd-label">Description</label>
                  <textarea
                    className={`cd-textarea${errors.description ? ' has-error' : ''}`}
                    placeholder="What will participants explore in this discussion?"
                    value={description}
                    onChange={e => { setDescription(e.target.value); if (errors.description) setErrors(prev => { const { description: _, ...rest } = prev; return rest; }); }}
                  />
                  {errors.description && <div className="cd-error"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>{errors.description}</div>}
                </div>
                <div className={`cd-field ${shakeFields.includes('level') ? 'cd-shake' : ''}`}>
                  <label className="cd-label">Level</label>
                  <div className="cd-level-pills">
                    {LEVEL_OPTIONS.map(l => (
                      <button key={l} type="button" className={`cd-level-pill${level === l ? ' active' : ''}`} onClick={() => { setLevel(l); if (errors.level) setErrors(prev => { const { level: _, ...rest } = prev; return rest; }); }}>
                        {l}
                      </button>
                    ))}
                  </div>
                  {errors.level && <div className="cd-error"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>{errors.level}</div>}
                </div>
              </div>

              {/* Completed toggle */}
              <div className={`cd-completed-toggle${isCompleted ? ' active' : ''}`} onClick={() => setIsCompleted(v => !v)}>
                <div className={`cd-checkbox${isCompleted ? ' checked' : ''}`}>
                  {isCompleted && <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>}
                </div>
                <div className="cd-toggle-text">
                  <div className="cd-toggle-label">Already completed</div>
                  <div className="cd-toggle-hint">Check this to add a past discussion that has already taken place</div>
                </div>
              </div>

              {/* Schedule */}
              <div className="cd-card">
                <div className="cd-card-title">Schedule</div>
                <div className={isCompleted ? 'cd-field' : 'cd-row'}>
                  <div className={`cd-field ${shakeFields.includes('date') ? 'cd-shake' : ''}`}>
                    <label className="cd-label">Date</label>
                    <input type="date" className={`cd-input${errors.date ? ' has-error' : ''}`} value={date} onChange={e => { setDate(e.target.value); if (errors.date) setErrors(prev => { const { date: _, ...rest } = prev; return rest; }); }} />
                    {errors.date && <div className="cd-error"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>{errors.date}</div>}
                  </div>
                  {!isCompleted && (
                    <div className={`cd-field ${shakeFields.includes('time') ? 'cd-shake' : ''}`}>
                      <label className="cd-label">Time</label>
                      <input type="time" className={`cd-input${errors.time ? ' has-error' : ''}`} value={time} onChange={e => { setTime(e.target.value); if (errors.time) setErrors(prev => { const { time: _, ...rest } = prev; return rest; }); }} />
                      {errors.time && errors.time !== ' ' && <div className="cd-error"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>{errors.time}</div>}
                    </div>
                  )}
                </div>
                <div className="cd-field">
                  <label className="cd-label">Duration</label>
                  <div className="cd-dur-pills">
                    {DURATION_OPTIONS.map(d => (
                      <button key={d.value} type="button" className={`cd-dur-pill${duration === d.value ? ' active' : ''}`} onClick={() => setDuration(d.value)}>
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
                {isCompleted ? (
                  <div className={`cd-field ${shakeFields.includes('participants') ? 'cd-shake' : ''}`}>
                    <label className="cd-label">Participants</label>
                    <input type="number" className={`cd-input${errors.participants ? ' has-error' : ''}`} value={participants} min={1} max={100} onChange={e => setParticipants(Number(e.target.value))} style={{ maxWidth: 120 }} />
                    {errors.participants && <div className="cd-error"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>{errors.participants}</div>}
                  </div>
                ) : (
                  <div className={`cd-field ${shakeFields.includes('spots') ? 'cd-shake' : ''}`}>
                    <label className="cd-label">Available Spots</label>
                    <input type="number" className={`cd-input${errors.spots ? ' has-error' : ''}`} value={spots} min={1} max={50} onChange={e => setSpots(Number(e.target.value))} style={{ maxWidth: 120 }} />
                    {errors.spots && <div className="cd-error"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>{errors.spots}</div>}
                  </div>
                )}
              </div>

              {/* Discussion Points (upcoming only) */}
              {!isCompleted && <div className="cd-card">
                <div className="cd-card-title">Discussion Points <span className="cd-label-opt">(optional)</span></div>
                {points.map((p, i) => (
                  <div key={i} className="cd-point-row">
                    <input
                      className="cd-input cd-point-input"
                      placeholder={`Point ${i + 1}`}
                      value={p}
                      onChange={e => updatePoint(i, e.target.value)}
                    />
                    {points.length > 1 && (
                      <button type="button" className="cd-point-remove" onClick={() => removePoint(i)}>
                        <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    )}
                  </div>
                ))}
                {points.length < 6 && (
                  <button type="button" className="cd-add-point" onClick={addPoint}>
                    <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Add point
                  </button>
                )}
              </div>}

              {errors.submit && (
                <div className="cd-error" style={{ marginBottom: 16 }}>
                  <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  {errors.submit}
                </div>
              )}
            </div>

            {/* Right column — Preview */}
            <div className="cd-preview">
              <div className="cd-preview-head">Preview</div>
              <div className="cd-preview-body">
                <div className="cd-preview-row">
                  <div className="cd-preview-icon" style={{ background: '#fef0e9', color: '#c2410c' }}>
                    <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  </div>
                  <div>
                    <div className="cd-preview-label">Topic</div>
                    <div className={`cd-preview-val${!topic ? ' empty' : ''}`}>{topic || 'Not set'}</div>
                  </div>
                </div>
                <div className="cd-preview-row">
                  <div className="cd-preview-icon" style={{ background: '#f5f3ff', color: '#7c3aed' }}>
                    <svg viewBox="0 0 24 24"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                  </div>
                  <div>
                    <div className="cd-preview-label">Level</div>
                    <div className={`cd-preview-val${!level ? ' empty' : ''}`}>{level || 'Not set'}</div>
                  </div>
                </div>
                <div className="cd-preview-row">
                  <div className="cd-preview-icon" style={{ background: '#ecfdf5', color: '#059669' }}>
                    <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  </div>
                  <div>
                    <div className="cd-preview-label">Date & Time</div>
                    <div className={`cd-preview-val${!previewDate ? ' empty' : ''}`}>
                      {previewDate ? `${previewDate} at ${new Date(`${date}T${time}`).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}` : 'Not set'}
                    </div>
                  </div>
                </div>
                <div className="cd-preview-row">
                  <div className="cd-preview-icon" style={{ background: '#ddf1f3', color: '#2a6270' }}>
                    <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  </div>
                  <div>
                    <div className="cd-preview-label">{isCompleted ? 'Duration & Participants' : 'Duration & Spots'}</div>
                    <div className="cd-preview-val">{duration} · {isCompleted ? `${participants} participants` : `${spots} spots`}</div>
                  </div>
                </div>
                {isCompleted && (
                  <div className="cd-preview-row">
                    <div className="cd-preview-icon" style={{ background: '#f5f3ff', color: '#7c3aed' }}>
                      <svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    </div>
                    <div>
                      <div className="cd-preview-label">Status</div>
                      <div className="cd-preview-val" style={{ color: '#7c3aed' }}>Completed</div>
                    </div>
                  </div>
                )}

                {points.some(p => p.trim()) && (
                  <div className="cd-preview-points">
                    <div className="cd-preview-points-title">Discussion Points</div>
                    {points.filter(p => p.trim()).map((p, i) => (
                      <div key={i} className="cd-preview-point">{p}</div>
                    ))}
                  </div>
                )}
              </div>
              <div className="cd-preview-footer">
                <button type="submit" className="cd-submit" disabled={submitting}>
                  {submitting ? <><div className="cd-spinner" /> Creating...</> : 'Create Discussion'}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>

      {submitted && (
        <div className="cd-success-overlay">
          <div className="cd-success-box">
            <div className="cd-success-icon">
              <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div className="cd-success-title">Discussion Created</div>
            <div className="cd-success-hint">Redirecting to discussions...</div>
          </div>
        </div>
      )}
    </>
  );
}
