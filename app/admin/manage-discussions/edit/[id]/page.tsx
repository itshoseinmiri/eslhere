'use client';

import { useState, useEffect, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAdmin } from '../../../admin-context';

const LEVEL_OPTIONS = ['A1\u2013A2', 'A2\u2013B1', 'B1\u2013B2', 'B2\u2013C1', 'C1\u2013C2'];

const DURATION_OPTIONS = [
  { value: '45 min', label: '45 min' },
  { value: '60 min', label: '60 min' },
  { value: '90 min', label: '90 min' },
];

function resizeImage(file: File, maxW: number, maxH: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        if (w > maxW || h > maxH) {
          const r = Math.min(maxW / w, maxH / h);
          w = Math.round(w * r);
          h = Math.round(h * r);
        }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = reject;
      img.src = e.target!.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function EditDiscussionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { token, logout } = useAdmin();
  const router = useRouter();
  const thumbInputRef = useRef<HTMLInputElement>(null);

  const [loadingData, setLoadingData] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [topic, setTopic] = useState('');
  const [description, setDescription] = useState('');
  const [level, setLevel] = useState('');
  const [dates, setDates] = useState<{ date: string; time: string }[]>([{ date: '', time: '18:00' }]);
  const [duration, setDuration] = useState('60 min');
  const [spots, setSpots] = useState(10);
  const [isCompleted, setIsCompleted] = useState(false);
  const [participants, setParticipants] = useState(0);
  const [points, setPoints] = useState(['', '', '']);
  const [reviews, setReviews] = useState<{ name: string; level: string; text: string }[]>([]);
  const [thumbnail, setThumbnail] = useState('');
  const [thumbDragOver, setThumbDragOver] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [shakeFields, setShakeFields] = useState<string[]>([]);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(`/api/discussions/${id}`, {
          headers: { Authorization: 'Bearer ' + token },
        });
        if (res.status === 401) { logout(); return; }
        if (res.status === 404) { setNotFound(true); setLoadingData(false); return; }
        if (!res.ok) throw new Error();

        const d = await res.json();
        setTopic(d.topic || '');
        setDescription(d.description || '');
        setLevel(d.level || '');
        setDuration(d.duration || '60 min');
        setThumbnail(d.thumbnail || '');
        setIsCompleted(d.status === 'completed');
        setSpots(d.spots || 10);
        setParticipants(d.participants || 0);
        setPoints(d.points && d.points.length > 0 ? d.points : ['', '', '']);
        setReviews(d.reviews && d.reviews.length > 0
          ? d.reviews.map((r: { name?: string; level?: string; text?: string }) => ({
              name: r.name || '', level: r.level || '', text: r.text || '',
            }))
          : []);

        if (d.dates && d.dates.length > 0) {
          setDates(d.dates.map((entry: { date: string; time?: string }) => ({
            date: parseDateToInput(entry.date),
            time: entry.time || '18:00',
          })));
        } else if (d.date) {
          setDates([{ date: parseDateToInput(d.date), time: d.time || '18:00' }]);
        }
      } catch {
        setNotFound(true);
      }
      setLoadingData(false);
    })();
  }, [token, id]);

  function parseDateToInput(dateStr: string): string {
    try {
      const currentYear = new Date().getFullYear();
      const attempt = new Date(`${dateStr} ${currentYear}`);
      if (!isNaN(attempt.getTime())) {
        return attempt.toISOString().split('T')[0];
      }
      const direct = new Date(dateStr);
      if (!isNaN(direct.getTime())) {
        return direct.toISOString().split('T')[0];
      }
    } catch { /* fallthrough */ }
    return dateStr;
  }

  /* -- Date helpers -- */
  function addDateEntry() {
    setDates(prev => [...prev, { date: '', time: '18:00' }]);
  }
  function removeDateEntry(idx: number) {
    setDates(prev => prev.filter((_, i) => i !== idx));
  }
  function updateDateEntry(idx: number, field: 'date' | 'time', val: string) {
    setDates(prev => prev.map((d, i) => i === idx ? { ...d, [field]: val } : d));
    if (errors.dates) setErrors(prev => { const { dates: _, ...rest } = prev; return rest; });
  }

  /* -- Thumbnail helpers -- */
  async function handleThumbnailFile(file: File) {
    if (!file.type.startsWith('image/')) return;
    if (file.size > 5 * 1024 * 1024) {
      setErrors(prev => ({ ...prev, thumbnail: 'Image must be under 5MB' }));
      return;
    }
    try {
      const resized = await resizeImage(file, 800, 600);
      setThumbnail(resized);
      if (errors.thumbnail) setErrors(prev => { const { thumbnail: _, ...rest } = prev; return rest; });
    } catch {
      setErrors(prev => ({ ...prev, thumbnail: 'Failed to process image' }));
    }
  }

  /* -- Point helpers -- */
  function addPoint() { setPoints(prev => [...prev, '']); }
  function removePoint(idx: number) { setPoints(prev => prev.filter((_, i) => i !== idx)); }
  function updatePoint(idx: number, val: string) { setPoints(prev => prev.map((p, i) => i === idx ? val : p)); }

  /* -- Review helpers -- */
  function addReview() { setReviews(prev => [...prev, { name: '', level: '', text: '' }]); }
  function removeReview(idx: number) { setReviews(prev => prev.filter((_, i) => i !== idx)); }
  function updateReview(idx: number, field: 'name' | 'level' | 'text', val: string) {
    setReviews(prev => prev.map((r, i) => i === idx ? { ...r, [field]: val } : r));
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!topic.trim()) errs.topic = 'Discussion topic is required';
    if (!description.trim()) errs.description = 'Description is required';
    if (!level) errs.level = 'Please select a level';

    if (dates.length === 0 || dates.every(d => !d.date)) {
      errs.dates = 'At least one date is required';
    } else {
      for (const d of dates) {
        if (!d.date) { errs.dates = 'All date fields must be filled'; break; }
        if (!isCompleted && !d.time) { errs.dates = 'All time fields must be set'; break; }
      }
    }

    if (!isCompleted) {
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
      const dateEntries = dates.filter(d => d.date).map(d => {
        const dt = new Date(`${d.date}T${d.time || '00:00'}:00`);
        return {
          date: dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          ...(!isCompleted && d.time ? { time: d.time } : {}),
        };
      });

      const filteredPoints = points.map(p => p.trim()).filter(Boolean);

      const cleanedReviews = reviews
        .map(r => ({ name: r.name.trim(), level: r.level.trim(), text: r.text.trim() }))
        .filter(r => r.name && r.text)
        .map(r => ({
          name: r.name,
          text: r.text,
          ...(r.level ? { level: r.level } : {}),
        }));

      const payload: Record<string, unknown> = {
        topic: topic.trim(),
        description: description.trim(),
        level,
        dates: dateEntries,
        duration,
        thumbnail: thumbnail || undefined,
        ...(isCompleted
          ? { status: 'completed', participants, reviews: cleanedReviews }
          : { status: 'upcoming', spots, points: filteredPoints.length > 0 ? filteredPoints : undefined, reviews: [] }),
      };

      const res = await fetch(`/api/discussions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(payload),
      });

      if (res.status === 401) { logout(); return; }
      if (!res.ok) throw new Error();

      setSubmitted(true);
      setTimeout(() => router.push('/admin/manage-discussions'), 1600);
    } catch {
      setErrors({ submit: 'Something went wrong. Please try again.' });
    }
    setSubmitting(false);
  }

  /* -- Preview computation -- */
  const previewDates = dates.filter(d => d.date).map(d => {
    try {
      const dt = new Date(`${d.date}T${d.time || '00:00'}`);
      return {
        label: dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        time: d.time ? dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '',
      };
    } catch {
      return null;
    }
  }).filter(Boolean) as { label: string; time: string }[];

  const errorIcon = <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;

  if (loadingData) {
    return (
      <>
        <style jsx global>{`
          @keyframes ed-pulse { 0%,100% { opacity: 0.4; } 50% { opacity: 1; } }
          .ed-loading {
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            min-height: 400px; gap: 16px;
          }
          .ed-loading-spinner {
            width: 36px; height: 36px; border: 3px solid #e8eef3;
            border-top-color: #2db5c0; border-radius: 50%;
            animation: cd-spin 0.7s linear infinite;
          }
          @keyframes cd-spin { to { transform: rotate(360deg); } }
          .ed-loading-text {
            font-family: 'DM Sans', sans-serif; font-size: 0.88rem;
            color: #94a7b5; animation: ed-pulse 1.5s ease infinite;
          }
        `}</style>
        <div className="ed-loading">
          <div className="ed-loading-spinner" />
          <div className="ed-loading-text">Loading discussion...</div>
        </div>
      </>
    );
  }

  if (notFound) {
    return (
      <>
        <style jsx global>{`
          .ed-notfound {
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            min-height: 400px; gap: 16px; text-align: center;
          }
          .ed-notfound-icon {
            width: 56px; height: 56px; border-radius: 50%; background: #fef2f2;
            display: flex; align-items: center; justify-content: center;
          }
          .ed-notfound-icon svg {
            width: 26px; height: 26px; stroke: #ef4444; stroke-width: 2; fill: none;
            stroke-linecap: round; stroke-linejoin: round;
          }
          .ed-notfound-title {
            font-family: 'DM Sans', sans-serif; font-size: 1.1rem; font-weight: 600; color: #1a2e44;
          }
          .ed-notfound-hint { font-size: 0.84rem; color: #94a7b5; }
          .ed-back-btn {
            display: inline-flex; align-items: center; gap: 6px; padding: 9px 22px;
            font-family: 'DM Sans', sans-serif; font-size: 0.84rem; font-weight: 600;
            color: #fff; background: #2db5c0; border: none; border-radius: 8px;
            cursor: pointer; text-decoration: none; transition: all 0.15s; margin-top: 8px;
          }
          .ed-back-btn:hover { background: #2a6270; }
        `}</style>
        <div className="ed-notfound">
          <div className="ed-notfound-icon">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          </div>
          <div className="ed-notfound-title">Discussion not found</div>
          <div className="ed-notfound-hint">This discussion may have been deleted or the link is incorrect.</div>
          <Link href="/admin/manage-discussions" className="ed-back-btn">Back to Discussions</Link>
        </div>
      </>
    );
  }

  return (
    <>
      <style jsx global>{`
        /* -- Edit Discussion (reuses cd- prefix from create) -- */
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

        /* -- Multi-date entries -- */
        .cd-date-entries { display: flex; flex-direction: column; gap: 10px; }
        .cd-date-entry {
          display: flex; gap: 10px; align-items: center;
          padding: 10px 14px; background: #fafcfd; border: 1px solid #f0f3f6;
          border-radius: 9px; transition: border-color 0.15s;
        }
        .cd-date-entry:hover { border-color: #e0e7ec; }
        .cd-date-entry-num {
          width: 22px; height: 22px; border-radius: 6px;
          background: #e8eef3; color: #5f7a8f;
          font-family: 'DM Sans', sans-serif; font-size: 0.68rem; font-weight: 700;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .cd-date-entry-fields { display: flex; gap: 10px; flex: 1; min-width: 0; }
        .cd-date-entry-fields .cd-input { background: #fff; }
        .cd-date-remove {
          width: 28px; height: 28px; border-radius: 6px; border: none;
          background: #fef2f2; color: #ef4444; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.15s; flex-shrink: 0;
        }
        .cd-date-remove:hover { background: #fee2e2; }
        .cd-date-remove svg { width: 14px; height: 14px; stroke: currentColor; stroke-width: 2; fill: none; }
        .cd-date-add {
          display: flex; align-items: center; gap: 6px; margin-top: 6px;
          font-family: 'DM Sans', sans-serif; font-size: 0.78rem; font-weight: 500;
          color: #2db5c0; background: none; border: none; cursor: pointer;
          padding: 4px 0; transition: color 0.15s;
        }
        .cd-date-add:hover { color: #2a6270; }
        .cd-date-add svg { width: 14px; height: 14px; stroke: currentColor; stroke-width: 2; fill: none; }

        /* -- Thumbnail upload -- */
        .cd-thumb-zone {
          border: 2px dashed #d8e3ec; border-radius: 10px;
          cursor: pointer; transition: all 0.2s; position: relative; overflow: hidden;
        }
        .cd-thumb-zone:hover { border-color: #2db5c0; background: #f8fdfd; }
        .cd-thumb-zone.dragover { border-color: #2db5c0; background: #edf9fa; }
        .cd-thumb-zone.has-image { border-style: solid; border-color: #e8eef3; border-width: 1px; }
        .cd-thumb-zone.has-image:hover { border-color: #2db5c0; }
        .cd-thumb-zone input[type="file"] { display: none; }
        .cd-thumb-placeholder {
          padding: 28px 20px; text-align: center;
        }
        .cd-thumb-placeholder svg {
          width: 36px; height: 36px; stroke: #b0bfcc; stroke-width: 1.5; fill: none;
          stroke-linecap: round; stroke-linejoin: round; margin: 0 auto 10px; display: block;
        }
        .cd-thumb-text {
          font-family: 'DM Sans', sans-serif; font-size: 0.84rem; font-weight: 600;
          color: #5f7a8f; margin-bottom: 4px;
        }
        .cd-thumb-hint { font-size: 0.72rem; color: #b0bfcc; }
        .cd-thumb-formats { font-size: 0.66rem; color: #c5d2dc; margin-top: 8px; }
        .cd-thumb-preview-wrap { position: relative; }
        .cd-thumb-img {
          width: 100%; height: 180px; object-fit: cover; display: block; border-radius: 8px;
        }
        .cd-thumb-remove {
          position: absolute; top: 8px; right: 8px;
          width: 28px; height: 28px; border-radius: 7px;
          background: rgba(26,46,68,0.7); backdrop-filter: blur(4px);
          border: none; cursor: pointer; color: #fff;
          display: flex; align-items: center; justify-content: center;
          transition: background 0.15s;
        }
        .cd-thumb-remove:hover { background: rgba(239,68,68,0.85); }
        .cd-thumb-remove svg { width: 14px; height: 14px; stroke: currentColor; stroke-width: 2; fill: none; }
        .cd-thumb-change {
          position: absolute; bottom: 8px; left: 8px;
          padding: 5px 12px; border-radius: 6px;
          background: rgba(26,46,68,0.7); backdrop-filter: blur(4px);
          border: none; cursor: pointer; color: #fff;
          font-family: 'DM Sans', sans-serif; font-size: 0.7rem; font-weight: 500;
          display: flex; align-items: center; gap: 5px; transition: background 0.15s;
        }
        .cd-thumb-change:hover { background: rgba(26,46,68,0.85); }
        .cd-thumb-change svg { width: 12px; height: 12px; stroke: currentColor; stroke-width: 2; fill: none; }

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

        /* Student reviews */
        .cd-rev-empty { font-size: 0.8rem; color: #94a7b5; padding: 14px 16px; background: #fafcfd; border: 1px dashed #e0e7ec; border-radius: 9px; line-height: 1.5; }
        .cd-rev-list { display: flex; flex-direction: column; gap: 14px; }
        .cd-rev-item { padding: 16px; background: #fafcfd; border: 1px solid #f0f3f6; border-radius: 11px; }
        .cd-rev-item-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
        .cd-rev-num { width: 22px; height: 22px; border-radius: 6px; background: #ecfdf5; color: #059669; font-family: 'DM Sans', sans-serif; font-size: 0.68rem; font-weight: 700; display: flex; align-items: center; justify-content: center; }

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
        .cd-preview-thumb {
          width: 100%; height: 160px; object-fit: cover; display: block;
          border-bottom: 1px solid #f0f3f6;
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

        .cd-preview-dates-list { display: flex; flex-direction: column; gap: 3px; }
        .cd-preview-date-item {
          font-family: 'DM Sans', sans-serif; font-size: 0.78rem; font-weight: 500; color: #1a2e44;
        }

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
          .cd-date-entry-fields { flex-direction: column; }
        }
      `}</style>

      <div className="cd-page">
        {/* Breadcrumb */}
        <div className="cd-breadcrumb">
          <Link href="/admin/manage-discussions">Manage Discussions</Link>
          <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
          <span>Edit Discussion</span>
        </div>

        {/* Header */}
        <div className="cd-header">
          <div>
            <div className="cd-title">Edit Discussion</div>
            <div className="cd-subtitle">Update the details of this discussion session</div>
          </div>
          <Link href="/admin/manage-discussions" className="cd-cancel-btn">Cancel</Link>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="cd-grid">
            {/* Left column -- Form */}
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
                  {errors.topic && <div className="cd-error">{errorIcon}{errors.topic}</div>}
                </div>
                <div className={`cd-field ${shakeFields.includes('description') ? 'cd-shake' : ''}`}>
                  <label className="cd-label">Description</label>
                  <textarea
                    className={`cd-textarea${errors.description ? ' has-error' : ''}`}
                    placeholder="What will participants explore in this discussion?"
                    value={description}
                    onChange={e => { setDescription(e.target.value); if (errors.description) setErrors(prev => { const { description: _, ...rest } = prev; return rest; }); }}
                  />
                  {errors.description && <div className="cd-error">{errorIcon}{errors.description}</div>}
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
                  {errors.level && <div className="cd-error">{errorIcon}{errors.level}</div>}
                </div>
              </div>

              {/* Thumbnail */}
              <div className="cd-card">
                <div className="cd-card-title">Thumbnail <span className="cd-label-opt">(optional)</span></div>
                <div
                  className={`cd-thumb-zone${thumbnail ? ' has-image' : ''}${thumbDragOver ? ' dragover' : ''}`}
                  onClick={() => thumbInputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setThumbDragOver(true); }}
                  onDragLeave={() => setThumbDragOver(false)}
                  onDrop={e => { e.preventDefault(); setThumbDragOver(false); if (e.dataTransfer.files[0]) handleThumbnailFile(e.dataTransfer.files[0]); }}
                >
                  <input
                    ref={thumbInputRef}
                    type="file"
                    accept="image/*"
                    onChange={e => { if (e.target.files?.[0]) handleThumbnailFile(e.target.files[0]); e.target.value = ''; }}
                  />
                  {thumbnail ? (
                    <div className="cd-thumb-preview-wrap">
                      <img src={thumbnail} alt="Thumbnail preview" className="cd-thumb-img" />
                      <button type="button" className="cd-thumb-remove" onClick={e => { e.stopPropagation(); setThumbnail(''); }}>
                        <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                      <button type="button" className="cd-thumb-change" onClick={e => { e.stopPropagation(); thumbInputRef.current?.click(); }}>
                        <svg viewBox="0 0 24 24"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                        Change
                      </button>
                    </div>
                  ) : (
                    <div className="cd-thumb-placeholder">
                      <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                      <div className="cd-thumb-text">Upload thumbnail</div>
                      <div className="cd-thumb-hint">Drag & drop or click to browse</div>
                      <div className="cd-thumb-formats">JPG, PNG, WebP up to 5MB</div>
                    </div>
                  )}
                </div>
                {errors.thumbnail && <div className="cd-error" style={{ marginTop: 8 }}>{errorIcon}{errors.thumbnail}</div>}
              </div>

              {/* Completed toggle */}
              <div className={`cd-completed-toggle${isCompleted ? ' active' : ''}`} onClick={() => setIsCompleted(v => !v)}>
                <div className={`cd-checkbox${isCompleted ? ' checked' : ''}`}>
                  {isCompleted && <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>}
                </div>
                <div className="cd-toggle-text">
                  <div className="cd-toggle-label">Already completed</div>
                  <div className="cd-toggle-hint">Check this to mark this discussion as completed</div>
                </div>
              </div>

              {/* Schedule */}
              <div className="cd-card">
                <div className="cd-card-title">Schedule</div>

                <div className={`cd-field ${shakeFields.includes('dates') ? 'cd-shake' : ''}`}>
                  <label className="cd-label">Dates {!isCompleted && '& Times'}</label>
                  <div className="cd-date-entries">
                    {dates.map((d, i) => (
                      <div key={i} className="cd-date-entry">
                        <div className="cd-date-entry-num">{i + 1}</div>
                        <div className="cd-date-entry-fields">
                          <input
                            type="date"
                            className={`cd-input${errors.dates ? ' has-error' : ''}`}
                            value={d.date}
                            onChange={e => updateDateEntry(i, 'date', e.target.value)}
                          />
                          {!isCompleted && (
                            <input
                              type="time"
                              className={`cd-input${errors.dates ? ' has-error' : ''}`}
                              value={d.time}
                              onChange={e => updateDateEntry(i, 'time', e.target.value)}
                            />
                          )}
                        </div>
                        {dates.length > 1 && (
                          <button type="button" className="cd-date-remove" onClick={() => removeDateEntry(i)}>
                            <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  {dates.length < 10 && (
                    <button type="button" className="cd-date-add" onClick={addDateEntry}>
                      <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      Add another date
                    </button>
                  )}
                  {errors.dates && <div className="cd-error">{errorIcon}{errors.dates}</div>}
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
                    {errors.participants && <div className="cd-error">{errorIcon}{errors.participants}</div>}
                  </div>
                ) : (
                  <div className={`cd-field ${shakeFields.includes('spots') ? 'cd-shake' : ''}`}>
                    <label className="cd-label">Available Spots</label>
                    <input type="number" className={`cd-input${errors.spots ? ' has-error' : ''}`} value={spots} min={1} max={50} onChange={e => setSpots(Number(e.target.value))} style={{ maxWidth: 120 }} />
                    {errors.spots && <div className="cd-error">{errorIcon}{errors.spots}</div>}
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

              {/* Student Reviews (completed only) */}
              {isCompleted && <div className="cd-card">
                <div className="cd-card-title">Student Reviews <span className="cd-label-opt">(shown on the public page)</span></div>
                {reviews.length === 0 ? (
                  <div className="cd-rev-empty">No reviews yet. Add feedback for the students who joined this session.</div>
                ) : (
                  <div className="cd-rev-list">
                    {reviews.map((r, i) => (
                      <div key={i} className="cd-rev-item">
                        <div className="cd-rev-item-head">
                          <span className="cd-rev-num">{i + 1}</span>
                          <button type="button" className="cd-point-remove" onClick={() => removeReview(i)}>
                            <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                        </div>
                        <div className="cd-row" style={{ marginBottom: 10 }}>
                          <input className="cd-input" placeholder="Student name" value={r.name} onChange={e => updateReview(i, 'name', e.target.value)} />
                          <input className="cd-input" placeholder="Level (optional, e.g. B1)" value={r.level} onChange={e => updateReview(i, 'level', e.target.value)} />
                        </div>
                        <textarea className="cd-textarea" placeholder="Teacher's feedback for this student..." value={r.text} onChange={e => updateReview(i, 'text', e.target.value)} />
                      </div>
                    ))}
                  </div>
                )}
                <button type="button" className="cd-add-point" onClick={addReview} style={{ marginTop: reviews.length > 0 ? 14 : 10 }}>
                  <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Add review
                </button>
              </div>}

              {errors.submit && (
                <div className="cd-error" style={{ marginBottom: 16 }}>
                  {errorIcon}
                  {errors.submit}
                </div>
              )}
            </div>

            {/* Right column -- Preview */}
            <div className="cd-preview">
              <div className="cd-preview-head">Preview</div>
              {thumbnail && <img src={thumbnail} alt="Preview thumbnail" className="cd-preview-thumb" />}
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
                  <div style={{ flex: 1 }}>
                    <div className="cd-preview-label">{previewDates.length > 1 ? 'Dates' : 'Date'} {!isCompleted && '& Time'}</div>
                    {previewDates.length > 0 ? (
                      <div className="cd-preview-dates-list">
                        {previewDates.map((pd, i) => (
                          <div key={i} className="cd-preview-date-item">
                            {pd.label}{pd.time ? ` at ${pd.time}` : ''}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="cd-preview-val empty">Not set</div>
                    )}
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
                {isCompleted && (
                  <div className="cd-preview-row">
                    <div className="cd-preview-icon" style={{ background: '#ecfdf5', color: '#059669' }}>
                      <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    </div>
                    <div>
                      <div className="cd-preview-label">Student Reviews</div>
                      <div className={`cd-preview-val${reviews.filter(r => r.name.trim() && r.text.trim()).length === 0 ? ' empty' : ''}`}>
                        {(() => { const n = reviews.filter(r => r.name.trim() && r.text.trim()).length; return n === 0 ? 'None added' : `${n} review${n === 1 ? '' : 's'}`; })()}
                      </div>
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
                  {submitting ? <><div className="cd-spinner" /> Saving...</> : 'Save Changes'}
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
            <div className="cd-success-title">Discussion Updated</div>
            <div className="cd-success-hint">Redirecting to discussions...</div>
          </div>
        </div>
      )}
    </>
  );
}
