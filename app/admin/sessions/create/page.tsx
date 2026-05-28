'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAdmin } from '../../admin-context';

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  englishLevel: string;
  type: string;
}

const DURATIONS = [
  { value: 30, label: '30 min', desc: 'Quick check-in' },
  { value: 45, label: '45 min', desc: 'Short session' },
  { value: 60, label: '60 min', desc: 'Standard class' },
  { value: 75, label: '75 min', desc: 'Extended session' },
  { value: 90, label: '90 min', desc: 'Deep dive' },
];

const SESSION_TOPICS = [
  'Speaking Practice',
  'Grammar Review',
  'Vocabulary Building',
  'Listening Comprehension',
  'Writing Workshop',
  'Pronunciation',
  'IELTS Preparation',
  'Business English',
  'Debate & Discussion',
  'Reading Comprehension',
  'Group Session',
  'Mock Test',
];

const avatarPalette = [
  { bg: '#ddf1f3', text: '#4338ca' },
  { bg: '#ecfdf5', text: '#047857' },
  { bg: '#fdf4ff', text: '#a21caf' },
  { bg: '#eff6ff', text: '#1d4ed8' },
  { bg: '#fefce8', text: '#a16207' },
  { bg: '#fef2f2', text: '#b91c1c' },
  { bg: '#f0fdfa', text: '#0f766e' },
];

function getAvatarColors(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const palette = avatarPalette[Math.abs(hash) % avatarPalette.length];
  return { background: palette.bg, color: palette.text };
}

function getInitials(first: string, last: string) {
  return (first.charAt(0) + last.charAt(0)).toUpperCase();
}

export default function CreateSessionPage() {
  const { token, logout } = useAdmin();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [students, setStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);

  // Form fields
  const [studentId, setStudentId] = useState(searchParams.get('studentId') || '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState(60);
  const [selectedTopic, setSelectedTopic] = useState('');

  // UI state
  const [studentDropdownOpen, setStudentDropdownOpen] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [shakeFields, setShakeFields] = useState<string[]>([]);

  const studentDropdownRef = useRef<HTMLDivElement>(null);
  const studentSearchRef = useRef<HTMLInputElement>(null);

  // Load students
  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch('/api/students', { headers: { Authorization: 'Bearer ' + token } });
        if (res.status === 401) { logout(); return; }
        if (!res.ok) throw new Error();
        setStudents(await res.json());
      } catch { /* silent */ }
      setLoadingStudents(false);
    })();
  }, [token, logout]);

  // Close student dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (studentDropdownRef.current && !studentDropdownRef.current.contains(e.target as Node)) {
        setStudentDropdownOpen(false);
      }
    }
    if (studentDropdownOpen) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [studentDropdownOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (studentDropdownOpen && studentSearchRef.current) {
      studentSearchRef.current.focus();
    }
  }, [studentDropdownOpen]);

  // Set default date to tomorrow
  useEffect(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setDate(tomorrow.toISOString().split('T')[0]);
    setTime('10:00');
  }, []);

  // When topic is selected, set title prefix
  function handleTopicSelect(topic: string) {
    if (selectedTopic === topic) {
      setSelectedTopic('');
      setTitle('');
    } else {
      setSelectedTopic(topic);
      setTitle(topic + ': ');
    }
  }

  const selectedStudent = students.find(s => s.id === studentId);
  const filteredStudents = students.filter(s => {
    if (!studentSearch) return true;
    const term = studentSearch.toLowerCase();
    const full = `${s.firstName} ${s.lastName}`.toLowerCase();
    return full.includes(term) || s.email.toLowerCase().includes(term);
  });

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!studentId) errs.student = 'Please select a student';
    if (!title.trim()) errs.title = 'Session title is required';
    if (!date) errs.date = 'Please pick a date';
    if (!time) errs.time = 'Please set a time';
    if (date && time && new Date(`${date}T${time}:00`).getTime() <= Date.now()) {
      errs.date = 'Session time cannot be in the past';
      errs.time = ' ';
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
      const dt = new Date(`${date}T${time}:00`);
      const off = -dt.getTimezoneOffset();
      const sign = off >= 0 ? '+' : '-';
      const ph = String(Math.floor(Math.abs(off) / 60)).padStart(2, '0');
      const pm = String(Math.abs(off) % 60).padStart(2, '0');
      const p = (n: number) => String(n).padStart(2, '0');
      const dateTime = `${dt.getFullYear()}-${p(dt.getMonth()+1)}-${p(dt.getDate())}T${p(dt.getHours())}:${p(dt.getMinutes())}:00${sign}${ph}:${pm}`;
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify({
          studentId,
          title: title.trim(),
          description: description.trim() || undefined,
          date: dateTime,
          duration,
          status: 'scheduled',
        }),
      });

      if (res.status === 401) { logout(); return; }
      if (res.status === 409) {
        const body = await res.json();
        setErrors({ submit: body.message || 'This time slot overlaps with another session.' });
        setShakeFields(['date', 'time']);
        setTimeout(() => setShakeFields([]), 600);
        setSubmitting(false);
        return;
      }
      if (!res.ok) throw new Error();

      setSubmitted(true);
      setTimeout(() => router.push('/admin/sessions'), 1800);
    } catch {
      setErrors({ submit: 'Something went wrong. Please try again.' });
    }
    setSubmitting(false);
  }

  return (
    <>
      <style jsx global>{`
        /* ── Page Entrance ── */
        @keyframes cs-page-in {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes cs-fade-up {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes cs-shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-4px); }
          40% { transform: translateX(4px); }
          60% { transform: translateX(-3px); }
          80% { transform: translateX(3px); }
        }
        @keyframes cs-success-in {
          from { opacity: 0; transform: scale(0.92); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes cs-check-draw {
          from { stroke-dashoffset: 36; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes cs-ring-grow {
          from { transform: scale(0); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes cs-confetti {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(-40px) rotate(180deg); opacity: 0; }
        }
        @keyframes cs-pulse-soft {
          0%, 100% { box-shadow: 0 0 0 0 rgba(45,181,192,0.18); }
          50% { box-shadow: 0 0 0 8px rgba(45,181,192,0); }
        }
        @keyframes cs-spin {
          to { transform: rotate(360deg); }
        }

        .cs-shake { animation: cs-shake 0.4s ease-out; }

        /* ── Breadcrumb ── */
        .cs-breadcrumb {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 24px;
          animation: cs-page-in 0.35s ease-out both;
        }
        .cs-breadcrumb a {
          font-size: 0.78rem;
          color: #94a7b5;
          text-decoration: none;
          font-weight: 500;
          transition: color 0.15s;
        }
        .cs-breadcrumb a:hover { color: #2db5c0; }
        .cs-breadcrumb-sep {
          font-size: 0.72rem;
          color: #c5d2dc;
        }
        .cs-breadcrumb-current {
          font-size: 0.78rem;
          color: #1a2e44;
          font-weight: 600;
        }

        /* ── Page Header ── */
        .cs-page-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 32px;
          animation: cs-page-in 0.4s ease-out 0.04s both;
        }
        .cs-page-title {
          font-family: 'Poppins', sans-serif;
          font-size: 1.5rem;
          font-weight: 700;
          color: #1a2e44;
          letter-spacing: -0.03em;
          line-height: 1;
        }
        .cs-page-subtitle {
          font-size: 0.82rem;
          color: #94a7b5;
          font-weight: 400;
          margin-top: 8px;
          letter-spacing: -0.005em;
        }
        .cs-cancel-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 9px 20px;
          font-family: 'Poppins', sans-serif;
          font-size: 0.8rem;
          font-weight: 500;
          color: #5f7a8f;
          background: #fff;
          border: 1px solid #e2e9ef;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.15s;
          text-decoration: none;
        }
        .cs-cancel-btn:hover { border-color: #c5d2dc; color: #3d5468; }
        .cs-cancel-btn svg {
          width: 14px; height: 14px; stroke: currentColor;
          stroke-width: 2; fill: none;
        }

        /* ── Form Layout ── */
        .cs-form-grid {
          display: grid;
          grid-template-columns: 1fr 340px;
          gap: 28px;
          align-items: start;
        }

        /* ── Card ── */
        .cs-card {
          background: #fff;
          border-radius: 16px;
          border: 1px solid #f0f3f6;
          box-shadow: 0 1px 4px rgba(0,0,0,0.03);
          overflow: visible;
        }
        .cs-card-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 22px 28px 0;
        }
        .cs-card-icon {
          width: 38px; height: 38px; border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .cs-card-icon svg {
          width: 18px; height: 18px; stroke-width: 1.8;
          fill: none; stroke-linecap: round; stroke-linejoin: round;
        }
        .cs-card-header-text h3 {
          font-family: 'Poppins', sans-serif;
          font-size: 0.92rem;
          font-weight: 600;
          color: #1a2e44;
          letter-spacing: -0.01em;
        }
        .cs-card-header-text p {
          font-size: 0.73rem;
          color: #94a7b5;
          margin-top: 2px;
        }
        .cs-card-body {
          padding: 22px 28px 28px;
        }

        /* ── Form Groups ── */
        .cs-field {
          margin-bottom: 22px;
        }
        .cs-field:last-child { margin-bottom: 0; }
        .cs-label {
          display: block;
          font-size: 0.76rem;
          font-weight: 600;
          color: #3d5468;
          margin-bottom: 8px;
          letter-spacing: 0.005em;
        }
        .cs-label-optional {
          font-weight: 400;
          color: #b8c9d6;
          margin-left: 4px;
          font-size: 0.7rem;
        }
        .cs-input {
          width: 100%;
          padding: 11px 14px;
          font-family: 'Poppins', sans-serif;
          font-size: 0.84rem;
          color: #1a2e44;
          background: #fafbfc;
          border: 1.5px solid #e8eef3;
          border-radius: 10px;
          outline: none;
          transition: all 0.2s;
        }
        .cs-input::placeholder { color: #b8c9d6; }
        .cs-input:focus {
          border-color: #2db5c0;
          background: #fff;
          box-shadow: 0 0 0 3px rgba(45,181,192,0.08);
        }
        .cs-input.has-error {
          border-color: #ef4444;
          background: #fffbfb;
        }
        .cs-input.has-error:focus {
          box-shadow: 0 0 0 3px rgba(239,68,68,0.08);
        }
        .cs-textarea {
          resize: vertical;
          min-height: 80px;
          line-height: 1.55;
        }
        .cs-error-msg {
          font-size: 0.7rem;
          color: #ef4444;
          margin-top: 6px;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .cs-error-msg svg {
          width: 12px; height: 12px; stroke: #ef4444;
          stroke-width: 2; fill: none;
        }

        /* ── Date/Time Row ── */
        .cs-datetime-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }

        /* ── Student Selector ── */
        .cs-student-selector {
          position: relative;
        }
        .cs-student-trigger {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 14px;
          font-family: 'Poppins', sans-serif;
          font-size: 0.84rem;
          color: #1a2e44;
          background: #fafbfc;
          border: 1.5px solid #e8eef3;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s;
          text-align: left;
        }
        .cs-student-trigger:hover { border-color: #c5d2dc; }
        .cs-student-trigger.open {
          border-color: #2db5c0;
          background: #fff;
          box-shadow: 0 0 0 3px rgba(45,181,192,0.08);
          border-radius: 10px 10px 0 0;
        }
        .cs-student-trigger.has-error {
          border-color: #ef4444;
          background: #fffbfb;
        }
        .cs-student-trigger .placeholder {
          color: #b8c9d6;
          flex: 1;
        }
        .cs-student-trigger .selected-info {
          flex: 1; display: flex; flex-direction: column; gap: 1px;
        }
        .cs-student-trigger .selected-name {
          font-weight: 600; font-size: 0.84rem; color: #1a2e44;
        }
        .cs-student-trigger .selected-meta {
          font-size: 0.7rem; color: #94a7b5;
        }
        .cs-student-trigger .trigger-chevron {
          width: 16px; height: 16px; stroke: #b8c9d6;
          stroke-width: 2; fill: none; transition: transform 0.2s;
          flex-shrink: 0;
        }
        .cs-student-trigger.open .trigger-chevron {
          transform: rotate(180deg);
        }
        .cs-student-mini-avatar {
          width: 34px; height: 34px; min-width: 34px;
          border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          font-size: 0.62rem; font-weight: 700; letter-spacing: 0.03em;
        }

        /* ── Student Dropdown ── */
        .cs-student-dropdown {
          position: absolute;
          top: 100%;
          left: 0; right: 0;
          z-index: 60;
          background: #fff;
          border: 1.5px solid #2db5c0;
          border-top: none;
          border-radius: 0 0 10px 10px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.08);
          max-height: 280px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          animation: cs-fade-up 0.15s ease-out both;
        }
        .cs-student-search-wrap {
          padding: 10px 12px 8px;
          border-bottom: 1px solid #f0f4f8;
          position: relative;
        }
        .cs-student-search-wrap svg {
          position: absolute;
          left: 22px; top: 50%; transform: translateY(-50%);
          width: 13px; height: 13px;
          stroke: #b8c9d6; stroke-width: 2; fill: none;
          pointer-events: none;
        }
        .cs-student-search {
          width: 100%;
          padding: 8px 10px 8px 30px;
          font-family: 'Poppins', sans-serif;
          font-size: 0.78rem;
          color: #1a2e44;
          background: #f7f9fb;
          border: 1px solid #e8eef3;
          border-radius: 7px;
          outline: none;
          transition: all 0.15s;
        }
        .cs-student-search::placeholder { color: #c5d2dc; }
        .cs-student-search:focus {
          border-color: #d0dde6;
          background: #fff;
        }
        .cs-student-list {
          overflow-y: auto;
          flex: 1;
          padding: 4px;
        }
        .cs-student-option {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          border: none;
          background: none;
          width: 100%;
          cursor: pointer;
          border-radius: 8px;
          transition: background 0.12s;
          text-align: left;
        }
        .cs-student-option:hover { background: #f5f8fa; }
        .cs-student-option.active { background: #ddf1f3; }
        .cs-student-option-avatar {
          width: 36px; height: 36px; min-width: 36px;
          border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          font-size: 0.62rem; font-weight: 700; letter-spacing: 0.03em;
        }
        .cs-student-option-info { flex: 1; min-width: 0; }
        .cs-student-option-name {
          font-size: 0.82rem; font-weight: 600; color: #1a2e44;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .cs-student-option-detail {
          font-size: 0.68rem; color: #94a7b5; margin-top: 1px;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .cs-student-option-badge {
          padding: 3px 10px; border-radius: 20px;
          font-size: 0.62rem; font-weight: 600;
          text-transform: capitalize; flex-shrink: 0;
        }
        .cs-student-option-badge.private { background: #f3f0ff; color: #7c3aed; }
        .cs-student-option-badge.group { background: #ecfdf5; color: #059669; }
        .cs-student-empty {
          text-align: center; padding: 20px;
          font-size: 0.78rem; color: #b8c9d6;
        }

        /* ── Topic Chips ── */
        .cs-topics {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .cs-topic-chip {
          padding: 7px 14px;
          font-family: 'Poppins', sans-serif;
          font-size: 0.74rem;
          font-weight: 500;
          color: #5f7a8f;
          background: #f5f8fa;
          border: 1.5px solid #e8eef3;
          border-radius: 20px;
          cursor: pointer;
          transition: all 0.18s;
          white-space: nowrap;
        }
        .cs-topic-chip:hover {
          border-color: #c5d2dc;
          color: #3d5468;
          background: #eef2f6;
        }
        .cs-topic-chip.active {
          border-color: #2db5c0;
          color: #1a7a82;
          background: #ddf1f3;
          font-weight: 600;
        }

        /* ── Duration Pills ── */
        .cs-durations {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }
        .cs-duration-pill {
          flex: 1;
          min-width: 80px;
          padding: 14px 10px;
          background: #fafbfc;
          border: 1.5px solid #e8eef3;
          border-radius: 12px;
          cursor: pointer;
          text-align: center;
          transition: all 0.2s;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }
        .cs-duration-pill:hover {
          border-color: #c5d2dc;
          background: #f5f8fa;
        }
        .cs-duration-pill.active {
          border-color: #2db5c0;
          background: linear-gradient(135deg, #f0fafb, #ddf1f3);
          box-shadow: 0 2px 8px rgba(45,181,192,0.1);
        }
        .cs-duration-pill.active .cs-dur-val { color: #1a7a82; }
        .cs-duration-pill.active .cs-dur-desc { color: #5ba5ad; }
        .cs-dur-val {
          font-family: 'Poppins', sans-serif;
          font-size: 0.95rem;
          font-weight: 700;
          color: #3d5468;
          letter-spacing: -0.02em;
          line-height: 1;
        }
        .cs-dur-desc {
          font-size: 0.62rem;
          color: #94a7b5;
          font-weight: 500;
        }

        /* ── Summary Sidebar ── */
        .cs-summary-card {
          position: sticky;
          top: 28px;
          animation: cs-fade-up 0.45s ease-out 0.15s both;
        }
        .cs-summary-preview {
          padding: 24px 24px 20px;
          border-bottom: 1px solid #f0f4f8;
        }
        .cs-summary-label {
          font-size: 0.65rem;
          font-weight: 600;
          color: #b8c9d6;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 16px;
        }
        .cs-summary-title {
          font-family: 'Poppins', sans-serif;
          font-size: 1.08rem;
          font-weight: 700;
          color: #1a2e44;
          letter-spacing: -0.02em;
          margin-bottom: 14px;
          line-height: 1.3;
          word-break: break-word;
        }
        .cs-summary-title.empty {
          color: #c5d2dc;
          font-weight: 500;
          font-style: italic;
        }
        .cs-summary-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 0;
        }
        .cs-summary-row-icon {
          width: 30px; height: 30px; border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .cs-summary-row-icon svg {
          width: 14px; height: 14px; stroke-width: 1.8;
          fill: none; stroke-linecap: round; stroke-linejoin: round;
        }
        .cs-summary-row-text {
          flex: 1; min-width: 0;
        }
        .cs-summary-row-label {
          font-size: 0.65rem; color: #94a7b5; font-weight: 500;
        }
        .cs-summary-row-value {
          font-size: 0.8rem; color: #1a2e44; font-weight: 600;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          letter-spacing: -0.005em;
        }
        .cs-summary-row-value.empty { color: #c5d2dc; font-weight: 400; }

        /* ── Status Badge ── */
        .cs-status-badge {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 5px 12px; border-radius: 20px;
          font-size: 0.68rem; font-weight: 600;
          background: #eff6ff; color: #3b82f6;
        }
        .cs-status-badge .dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: #3b82f6;
          animation: cs-pulse-soft 2s ease-in-out infinite;
        }

        /* ── Submit Area ── */
        .cs-submit-area {
          padding: 20px 24px 24px;
        }
        .cs-submit-btn {
          width: 100%;
          padding: 13px 20px;
          font-family: 'Poppins', sans-serif;
          font-size: 0.86rem;
          font-weight: 600;
          color: #fff;
          background: linear-gradient(135deg, #1a2e44 0%, #243d56 100%);
          border: none;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          letter-spacing: -0.005em;
          position: relative;
          overflow: hidden;
        }
        .cs-submit-btn::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(45,181,192,0.15) 0%, rgba(45,181,192,0) 100%);
          opacity: 0;
          transition: opacity 0.2s;
        }
        .cs-submit-btn:hover::before { opacity: 1; }
        .cs-submit-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 14px rgba(26,46,68,0.2);
        }
        .cs-submit-btn:active { transform: translateY(0); }
        .cs-submit-btn:disabled {
          opacity: 0.6; cursor: not-allowed;
          transform: none !important;
          box-shadow: none !important;
        }
        .cs-submit-btn svg {
          width: 16px; height: 16px; stroke: currentColor;
          stroke-width: 2; fill: none;
        }
        .cs-submit-spinner {
          width: 16px; height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: cs-spin 0.6s linear infinite;
        }
        .cs-submit-error {
          text-align: center;
          font-size: 0.74rem;
          color: #ef4444;
          margin-top: 12px;
          font-weight: 500;
        }

        /* ── Success Overlay ── */
        .cs-success-overlay {
          position: fixed;
          inset: 0;
          z-index: 200;
          background: rgba(249,251,252,0.92);
          display: flex;
          align-items: center;
          justify-content: center;
          animation: cs-fade-up 0.3s ease-out both;
          backdrop-filter: blur(4px);
        }
        .cs-success-box {
          text-align: center;
          animation: cs-success-in 0.45s ease-out 0.1s both;
        }
        .cs-success-ring {
          width: 72px; height: 72px;
          border-radius: 50%;
          background: linear-gradient(135deg, #ecfdf5, #d1fae5);
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 20px;
          animation: cs-ring-grow 0.4s ease-out 0.15s both;
          box-shadow: 0 4px 16px rgba(16,163,129,0.15);
        }
        .cs-success-ring svg {
          width: 32px; height: 32px;
          stroke: #10b981; stroke-width: 2.5;
          fill: none; stroke-linecap: round; stroke-linejoin: round;
        }
        .cs-success-ring svg polyline {
          stroke-dasharray: 36;
          animation: cs-check-draw 0.5s ease-out 0.45s both;
        }
        .cs-success-title {
          font-family: 'Poppins', sans-serif;
          font-size: 1.2rem;
          font-weight: 700;
          color: #1a2e44;
          margin-bottom: 6px;
          letter-spacing: -0.02em;
        }
        .cs-success-desc {
          font-size: 0.82rem;
          color: #94a7b5;
        }
        .cs-success-confetti {
          position: absolute;
          width: 8px; height: 8px;
          border-radius: 50%;
          animation: cs-confetti 0.8s ease-out both;
        }

        /* ── Loading ── */
        .cs-loading {
          display: flex; align-items: center; justify-content: center;
          height: 40vh; font-size: 0.85rem; color: #94a7b5;
        }
        .cs-loading-ring {
          width: 16px; height: 16px;
          border: 2px solid #e2e9ef;
          border-top-color: #2db5c0;
          border-radius: 50%;
          animation: cs-spin 0.6s linear infinite;
          margin-right: 10px;
        }

        /* ── Responsive ── */
        @media (max-width: 960px) {
          .cs-form-grid {
            grid-template-columns: 1fr;
          }
          .cs-summary-card { position: static; }
        }
        @media (max-width: 600px) {
          .cs-datetime-row { grid-template-columns: 1fr; }
          .cs-durations { flex-wrap: wrap; }
          .cs-duration-pill { min-width: 70px; }
          .cs-page-header { flex-direction: column; gap: 14px; align-items: flex-start; }
        }
      `}</style>

      {loadingStudents ? (
        <div className="cs-loading">
          <div className="cs-loading-ring" />
          Loading...
        </div>
      ) : (
        <>
          {/* Success Overlay */}
          {submitted && (
            <div className="cs-success-overlay">
              {/* Decorative confetti dots */}
              {[
                { color: '#2db5c0', left: '42%', top: '32%', delay: '0.3s' },
                { color: '#f0cf8a', left: '56%', top: '28%', delay: '0.4s' },
                { color: '#10b981', left: '38%', top: '38%', delay: '0.5s' },
                { color: '#7c3aed', left: '60%', top: '36%', delay: '0.35s' },
                { color: '#3b82f6', left: '48%', top: '26%', delay: '0.45s' },
                { color: '#f0a07a', left: '52%', top: '40%', delay: '0.55s' },
              ].map((c, i) => (
                <div key={i} className="cs-success-confetti" style={{ background: c.color, left: c.left, top: c.top, animationDelay: c.delay }} />
              ))}
              <div className="cs-success-box">
                <div className="cs-success-ring">
                  <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
                </div>
                <div className="cs-success-title">Session Created</div>
                <div className="cs-success-desc">Redirecting to sessions...</div>
              </div>
            </div>
          )}

          {/* Breadcrumb */}
          <nav className="cs-breadcrumb">
            <Link href="/admin/sessions">Sessions</Link>
            <span className="cs-breadcrumb-sep">/</span>
            <span className="cs-breadcrumb-current">Create New Session</span>
          </nav>

          {/* Page Header */}
          <div className="cs-page-header">
            <div>
              <h1 className="cs-page-title">Schedule a Session</h1>
              <p className="cs-page-subtitle">Fill in the details to create a new class session for a student.</p>
            </div>
            <Link href="/admin/sessions" className="cs-cancel-btn">
              <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              Cancel
            </Link>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="cs-form-grid">
              {/* ── Main Form Column ── */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                {/* Student Selection Card */}
                <div className="cs-card" style={{ animation: 'cs-fade-up 0.4s ease-out 0.08s both', position: 'relative', zIndex: studentDropdownOpen ? 10 : 'auto' }}>
                  <div className="cs-card-header">
                    <div className="cs-card-icon" style={{ background: '#f3f0ff' }}>
                      <svg viewBox="0 0 24 24" stroke="#7c3aed"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    </div>
                    <div className="cs-card-header-text">
                      <h3>Student</h3>
                      <p>Choose the student for this session</p>
                    </div>
                  </div>
                  <div className="cs-card-body">
                    <div className={`cs-field ${shakeFields.includes('student') ? 'cs-shake' : ''}`}>
                      <div className="cs-student-selector" ref={studentDropdownRef}>
                        <button
                          type="button"
                          className={`cs-student-trigger${studentDropdownOpen ? ' open' : ''}${errors.student ? ' has-error' : ''}`}
                          onClick={() => setStudentDropdownOpen(!studentDropdownOpen)}
                        >
                          {selectedStudent ? (
                            <>
                              <div className="cs-student-mini-avatar" style={getAvatarColors(`${selectedStudent.firstName} ${selectedStudent.lastName}`)}>
                                {getInitials(selectedStudent.firstName, selectedStudent.lastName)}
                              </div>
                              <div className="selected-info">
                                <span className="selected-name">{selectedStudent.firstName} {selectedStudent.lastName}</span>
                                <span className="selected-meta">{selectedStudent.email} &middot; {selectedStudent.englishLevel}</span>
                              </div>
                            </>
                          ) : (
                            <span className="placeholder">Select a student...</span>
                          )}
                          <svg className="trigger-chevron" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                        </button>
                        {studentDropdownOpen && (
                          <div className="cs-student-dropdown">
                            <div className="cs-student-search-wrap">
                              <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                              <input
                                ref={studentSearchRef}
                                type="text"
                                className="cs-student-search"
                                placeholder="Search students..."
                                value={studentSearch}
                                onChange={e => setStudentSearch(e.target.value)}
                              />
                            </div>
                            <div className="cs-student-list">
                              {filteredStudents.length === 0 ? (
                                <div className="cs-student-empty">No students found</div>
                              ) : (
                                filteredStudents.map(s => {
                                  const av = getAvatarColors(`${s.firstName} ${s.lastName}`);
                                  return (
                                    <button
                                      key={s.id}
                                      type="button"
                                      className={`cs-student-option${s.id === studentId ? ' active' : ''}`}
                                      onClick={() => { setStudentId(s.id); setStudentDropdownOpen(false); setStudentSearch(''); setErrors(prev => { const { student, ...rest } = prev; return rest; }); }}
                                    >
                                      <div className="cs-student-option-avatar" style={av}>
                                        {getInitials(s.firstName, s.lastName)}
                                      </div>
                                      <div className="cs-student-option-info">
                                        <div className="cs-student-option-name">{s.firstName} {s.lastName}</div>
                                        <div className="cs-student-option-detail">{s.email} &middot; {s.englishLevel}</div>
                                      </div>
                                      <span className={`cs-student-option-badge ${s.type}`}>{s.type}</span>
                                    </button>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      {errors.student && (
                        <div className="cs-error-msg">
                          <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                          {errors.student}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Session Details Card */}
                <div className="cs-card" style={{ animation: 'cs-fade-up 0.4s ease-out 0.14s both' }}>
                  <div className="cs-card-header">
                    <div className="cs-card-icon" style={{ background: '#eff6ff' }}>
                      <svg viewBox="0 0 24 24" stroke="#3b82f6"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                    </div>
                    <div className="cs-card-header-text">
                      <h3>Session Details</h3>
                      <p>What will this session cover?</p>
                    </div>
                  </div>
                  <div className="cs-card-body">
                    {/* Quick topic picker */}
                    <div className="cs-field">
                      <label className="cs-label">Quick Topic <span className="cs-label-optional">pick one to auto-fill title</span></label>
                      <div className="cs-topics">
                        {SESSION_TOPICS.map(topic => (
                          <button
                            key={topic}
                            type="button"
                            className={`cs-topic-chip${selectedTopic === topic ? ' active' : ''}`}
                            onClick={() => handleTopicSelect(topic)}
                          >
                            {topic}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className={`cs-field ${shakeFields.includes('title') ? 'cs-shake' : ''}`}>
                      <label className="cs-label" htmlFor="cs-title">Session Title</label>
                      <input
                        id="cs-title"
                        type="text"
                        className={`cs-input${errors.title ? ' has-error' : ''}`}
                        placeholder="e.g. Speaking Practice: Daily Routines"
                        value={title}
                        onChange={e => { setTitle(e.target.value); if (errors.title) setErrors(prev => { const { title: _, ...rest } = prev; return rest; }); }}
                      />
                      {errors.title && (
                        <div className="cs-error-msg">
                          <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                          {errors.title}
                        </div>
                      )}
                    </div>

                    <div className="cs-field">
                      <label className="cs-label" htmlFor="cs-desc">Description <span className="cs-label-optional">optional</span></label>
                      <textarea
                        id="cs-desc"
                        className="cs-input cs-textarea"
                        placeholder="Brief description of what this session will cover..."
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Schedule Card */}
                <div className="cs-card" style={{ animation: 'cs-fade-up 0.4s ease-out 0.2s both' }}>
                  <div className="cs-card-header">
                    <div className="cs-card-icon" style={{ background: '#ecfdf5' }}>
                      <svg viewBox="0 0 24 24" stroke="#10b981"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    </div>
                    <div className="cs-card-header-text">
                      <h3>Schedule</h3>
                      <p>When and how long?</p>
                    </div>
                  </div>
                  <div className="cs-card-body">
                    <div className="cs-datetime-row" style={{ marginBottom: 22 }}>
                      <div className={`cs-field ${shakeFields.includes('date') ? 'cs-shake' : ''}`} style={{ marginBottom: 0 }}>
                        <label className="cs-label" htmlFor="cs-date">Date</label>
                        <input
                          id="cs-date"
                          type="date"
                          className={`cs-input${errors.date ? ' has-error' : ''}`}
                          value={date}
                          onChange={e => { setDate(e.target.value); if (errors.date) setErrors(prev => { const { date: _, ...rest } = prev; return rest; }); }}
                        />
                        {errors.date && (
                          <div className="cs-error-msg">
                            <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                            {errors.date}
                          </div>
                        )}
                      </div>
                      <div className={`cs-field ${shakeFields.includes('time') ? 'cs-shake' : ''}`} style={{ marginBottom: 0 }}>
                        <label className="cs-label" htmlFor="cs-time">Time</label>
                        <input
                          id="cs-time"
                          type="time"
                          className={`cs-input${errors.time ? ' has-error' : ''}`}
                          value={time}
                          onChange={e => { setTime(e.target.value); if (errors.time) setErrors(prev => { const { time: _, ...rest } = prev; return rest; }); }}
                        />
                        {errors.time && (
                          <div className="cs-error-msg">
                            <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                            {errors.time}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="cs-field">
                      <label className="cs-label">Duration</label>
                      <div className="cs-durations">
                        {DURATIONS.map(d => (
                          <button
                            key={d.value}
                            type="button"
                            className={`cs-duration-pill${duration === d.value ? ' active' : ''}`}
                            onClick={() => setDuration(d.value)}
                          >
                            <span className="cs-dur-val">{d.label}</span>
                            <span className="cs-dur-desc">{d.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Summary Sidebar ── */}
              <div className="cs-summary-card cs-card">
                <div className="cs-summary-preview">
                  <div className="cs-summary-label">Session Preview</div>
                  <div className={`cs-summary-title ${!title.trim() ? 'empty' : ''}`}>
                    {title.trim() || 'Untitled Session'}
                  </div>

                  {/* Student row */}
                  <div className="cs-summary-row">
                    <div className="cs-summary-row-icon" style={{ background: '#f3f0ff' }}>
                      <svg viewBox="0 0 24 24" stroke="#7c3aed"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    </div>
                    <div className="cs-summary-row-text">
                      <div className="cs-summary-row-label">Student</div>
                      <div className={`cs-summary-row-value ${!selectedStudent ? 'empty' : ''}`}>
                        {selectedStudent ? `${selectedStudent.firstName} ${selectedStudent.lastName}` : 'Not selected'}
                      </div>
                    </div>
                  </div>

                  {/* Date row */}
                  <div className="cs-summary-row">
                    <div className="cs-summary-row-icon" style={{ background: '#ecfdf5' }}>
                      <svg viewBox="0 0 24 24" stroke="#10b981"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    </div>
                    <div className="cs-summary-row-text">
                      <div className="cs-summary-row-label">Date & Time</div>
                      <div className={`cs-summary-row-value ${!date ? 'empty' : ''}`}>
                        {date && time ? (
                          <>
                            {new Date(`${date}T${time}`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                            {' at '}
                            {new Date(`${date}T${time}`).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                            {new Date(`${date}T${time}`).getTime() < Date.now() && (
                              <span style={{ display: 'block', marginTop: 4, fontSize: '0.7rem', color: '#ef4444', fontWeight: 600 }}>
                                ⚠ This time is in the past
                              </span>
                            )}
                          </>
                        ) : 'Not set'}
                      </div>
                    </div>
                  </div>

                  {/* Duration row */}
                  <div className="cs-summary-row">
                    <div className="cs-summary-row-icon" style={{ background: '#eff6ff' }}>
                      <svg viewBox="0 0 24 24" stroke="#3b82f6"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    </div>
                    <div className="cs-summary-row-text">
                      <div className="cs-summary-row-label">Duration</div>
                      <div className="cs-summary-row-value">{duration} minutes</div>
                    </div>
                  </div>

                  {/* Status */}
                  <div className="cs-summary-row" style={{ paddingTop: 14 }}>
                    <div className="cs-status-badge">
                      <span className="dot" />
                      Scheduled
                    </div>
                  </div>
                </div>

                <div className="cs-submit-area">
                  <button type="submit" className="cs-submit-btn" disabled={submitting}>
                    {submitting ? (
                      <>
                        <div className="cs-submit-spinner" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        Create Session
                      </>
                    )}
                  </button>
                  {errors.submit && <div className="cs-submit-error">{errors.submit}</div>}
                </div>
              </div>
            </div>
          </form>
        </>
      )}
    </>
  );
}
