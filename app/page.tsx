'use client';

import { Suspense, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { CSSProperties, TouchEvent as ReactTouchEvent, TransitionEvent as ReactTransitionEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import './home.css';

type JourneyStep = {
  n: string;
  title: string;
  desc: string;
  cta: string;
  action: 'private' | 'group' | 'discussions' | 'classes' | 'reviews';
};
const JOURNEY_STEPS: JourneyStep[] = [
  { n: '01', title: 'Introductory Session', desc: 'We get to know you — your goals, your needs, and what you want from English.', cta: 'Book your intro', action: 'private' },
  { n: '02', title: 'Level Assessment', desc: 'A relaxed check of where you stand today, spotting your strengths and gaps.', cta: 'Assess my level', action: 'private' },
  { n: '03', title: 'Choose the Right Class', desc: 'We match you to the class, plan, and style that fit you best.', cta: 'Browse classes', action: 'classes' },
  { n: '04', title: 'Start Learning', desc: 'Begin your personalized path with the right class and a clear plan.', cta: 'Enroll now', action: 'private' },
  { n: '05', title: 'Feedback & Progress', desc: 'Regular reviews and honest feedback keep your journey on track.', cta: 'See student results', action: 'reviews' },
];

// shape returned by /api/discussions — optional keys are omitted by the
// serializer when the discussion has nothing stored for them
type ApiDiscussion = {
  id: number;
  topic: string;
  date?: string;
  time?: string;
  dates?: { date: string; time?: string }[];
  level: string;
  description: string;
  spots?: number;
  participants?: number;
  duration: string;
  points?: string[];
  learn?: string[];
  requirements?: string[];
  curriculum?: { title: string; summary?: string; items?: string[] }[];
  status: string;
  thumbnail?: string;
  reviews?: { name: string; level?: string; text: string }[];
};

// reviews shown side by side in the testimonials row
const REVIEWS_PER_VIEW = 3;
// discussion-detail review slider — cards visible at once on a wide screen
const DETAIL_REVIEWS_PER_VIEW = 3;

// The slider needs the visible-card count in JS (to clamp the last page), and CSS
// needs it too — so both read the same two breakpoints. See .dt-revs-track.
const DETAIL_REV_WIDE = '(min-width: 901px)';
const DETAIL_REV_MID = '(min-width: 641px)';

function subscribeDetailPerView(onChange: () => void) {
  const queries = [window.matchMedia(DETAIL_REV_WIDE), window.matchMedia(DETAIL_REV_MID)];
  queries.forEach(q => q.addEventListener('change', onChange));
  return () => queries.forEach(q => q.removeEventListener('change', onChange));
}

function getDetailPerView() {
  if (window.matchMedia(DETAIL_REV_WIDE).matches) return DETAIL_REVIEWS_PER_VIEW;
  return window.matchMedia(DETAIL_REV_MID).matches ? 2 : 1;
}

// discussion detail: the instructor block shown above the reviews
const TEACHER_ROLES = [
  'Learning & Development (L&D) Specialist',
  'Certified English Instructor',
  'Learning Architect',
  'Speaking Specialist',
  'Linguistics & AI Enthusiast',
];
const TEACHER_SKILLS = ['Learning Management', 'Teaching Learning', 'Adult Education', 'Critical Thinking'];

type Testimonial = { name: string; course: string; text: string };
type Review = Testimonial & { rating?: number };
const TESTIMONIALS: Testimonial[] = [
  { name: 'Sara', course: 'IELTS Prep', text: 'I went from freezing up mid-sentence to leading a meeting in English. The one-on-one feedback caught habits I never knew I had.' },
  { name: 'Nima', course: 'Group Discussions', text: 'The weekly discussions made speaking feel normal instead of scary. I stopped translating in my head and just started talking.' },
  { name: 'Roya', course: 'Private Classes', text: 'Six months in and my speaking jumped two levels. Real topics, honest corrections, and zero wasted time.' },
  { name: 'Amir', course: 'IELTS Prep', text: 'Hit Overall 7.5 on my first attempt. The mock sessions were tougher than the real exam — exactly what I needed.' },
  { name: 'Leila', course: 'Group Discussions', text: 'I finally look forward to speaking English. The group is supportive and the topics actually matter to me.' },
  { name: 'Kian', course: 'Private Classes', text: 'My tutor built every lesson around my job. Each class paid off the next morning at work.' },
];

function ReviewStars({ rating }: { rating: number }) {
  return (
    <span className="reviews-stars" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map(s => (
        <svg key={s} viewBox="0 0 24 24" className={s <= rating ? 'on' : 'off'}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
      ))}
    </span>
  );
}

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
  const [reviewIndex, setReviewIndex] = useState(0);
  const [reviewAnimate, setReviewAnimate] = useState(true);
  const [reviewList, setReviewList] = useState<Review[]>(TESTIMONIALS);
  // the review whose full text is open in the modal
  const [openReview, setOpenReview] = useState<Review | null>(null);
  // discussion detail: which curriculum accordion tab is expanded (-1 == all closed)
  const [openModule, setOpenModule] = useState(0);
  // discussion detail: review slider position and how many cards fit the viewport
  const [detailRev, setDetailRev] = useState(0);
  // server renders the widest layout; the client corrects it on hydration
  const detailPerView = useSyncExternalStore(subscribeDetailPerView, getDetailPerView, () => DETAIL_REVIEWS_PER_VIEW);
  const logoRef = useRef<HTMLImageElement>(null);
  const logoClicksRef = useRef(0);
  const logoTimerRef = useRef<NodeJS.Timeout | null>(null);
  const reviewTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isTransitioningRef = useRef(false);
  const reviewIndexRef = useRef(0);
  const reviewListRef = useRef(reviewList);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const detailTouchRef = useRef<{ x: number; y: number } | null>(null);
  const homeRef = useRef<HTMLDivElement>(null);
  const reviewsRef = useRef<HTMLDivElement>(null);
  const openReviewRef = useRef(false);

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

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const tl = gsap.timeline({ defaults: { ease: 'power4.out' } });
        tl.from('.hero-line-inner:not(.hero-accent)', { yPercent: 112, duration: 0.85, stagger: 0.14 })
          .fromTo('.hero-accent',
            { clipPath: 'inset(-20% 100% -30% 0)' },
            { clipPath: 'inset(-20% -10% -30% 0)', duration: 1, ease: 'power2.inOut' }, '-=0.3')
          .from('.hero-sub', { y: 26, opacity: 0, duration: 0.6, ease: 'power3.out' }, '-=0.55')
          .from('.hero-actions > *', { y: 20, opacity: 0, duration: 0.5, stagger: 0.09, ease: 'power3.out', clearProps: 'transform,opacity' }, '-=0.4')
          .from('.hero-feats li', { y: 14, opacity: 0, duration: 0.45, stagger: 0.07, ease: 'power3.out' }, '-=0.35')
          .from('.hero-art', { y: 40, opacity: 0, scale: 0.96, duration: 0.9, ease: 'power3.out' }, 0.25);

        gsap.to('.hero-art img', { y: -10, duration: 2.6, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: 1.6 });

        gsap.to('.hero-art', {
          yPercent: -8, ease: 'none',
          scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.6 },
        });
        gsap.to('.hero-copy', {
          yPercent: 7, opacity: 0.45, ease: 'none',
          scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom 30%', scrub: 0.6 },
        });

        const btl = gsap.timeline({
          scrollTrigger: { trigger: '.class-banner', start: 'top 80%', once: true },
          defaults: { ease: 'power3.out' },
        });
        btl.from('.class-banner', { y: 64, opacity: 0, scale: 0.985, duration: 0.85 })
          .from('.class-banner-label', { y: 18, opacity: 0, duration: 0.45 }, '-=0.45')
          .from('.class-banner-copy h2', { y: 24, opacity: 0, duration: 0.55 }, '-=0.32')
          .from('.class-banner-copy p', { y: 20, opacity: 0, duration: 0.5 }, '-=0.4')
          .from('.class-banner-feats li', { y: 16, opacity: 0, scale: 0.94, duration: 0.4, stagger: 0.08, ease: 'back.out(1.6)' }, '-=0.35')
          .from('.class-banner-cta', { y: 16, opacity: 0, duration: 0.45 }, '-=0.25')
          .from('.class-banner-art img', { x: 48, opacity: 0, duration: 0.9, ease: 'power2.out' }, 0.25);

        gsap.to('.class-banner-art img', {
          yPercent: 10, ease: 'none',
          scrollTrigger: { trigger: '.class-banner', start: 'top bottom', end: 'bottom top', scrub: 0.6 },
        });

        const jtl = gsap.timeline({
          scrollTrigger: { trigger: '.journey', start: 'top 82%', once: true },
          defaults: { ease: 'power3.out' },
        });
        jtl.from('.journey-head > *', { y: 20, opacity: 0, duration: 0.5, stagger: 0.1 })
          .from('.journey-line', { scaleX: 0, transformOrigin: 'left center', duration: 0.7, ease: 'power2.inOut' }, '-=0.2')
          .from('.journey-step', { y: 30, opacity: 0, duration: 0.55, stagger: 0.12 }, '-=0.5');

        const ctl = gsap.timeline({
          scrollTrigger: { trigger: '.home-cta-row', start: 'top 84%', once: true },
          defaults: { ease: 'power3.out' },
        });
        ctl.from('.home-cta-row > *', { y: 48, opacity: 0, duration: 0.7, stagger: 0.14 })
          .from('.home-cta-art', { scale: 0.6, opacity: 0, rotation: -8, duration: 0.7, ease: 'back.out(1.7)' }, '-=0.35');

        const rtl = gsap.timeline({
          scrollTrigger: { trigger: '.reviews', start: 'top 80%', once: true },
          defaults: { ease: 'power3.out' },
        });
        rtl.from('.reviews-head .reviews-eyebrow', { y: 16, opacity: 0, duration: 0.45 })
          .from('.reviews-head h2', { y: 22, opacity: 0, duration: 0.55 }, '-=0.3')
          // target the viewport, not the track — GSAP would leave an inline transform on the sliding strip
          .from('.reviews-viewport', { y: 40, opacity: 0, duration: 0.7 }, '-=0.25');
      });
      return () => mm.revert();
    }, homeRef);
    return () => ctx.revert();
  }, []);

  const [allDiscussions, setAllDiscussions] = useState<ApiDiscussion[]>([]);

  useEffect(() => {
    fetch('/api/discussions')
      .then(res => res.ok ? res.json() : [])
      .then(setAllDiscussions)
      .catch(() => {});
  }, []);

  // Approved student reviews replace the hardcoded testimonials when present.
  useEffect(() => {
    fetch('/api/reviews')
      .then(res => res.ok ? res.json() : [])
      .then((data: { name: string; level: string; rating: number; text: string }[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setReviewList(data.map(r => ({ name: r.name, course: r.level, text: r.text, rating: r.rating })));
          // swapping the list mid-cycle: snap the strip back to the start rather than sliding to it
          setReviewAnimate(false);
          setReviewIndex(0);
          reviewIndexRef.current = 0;
        }
      })
      .catch(() => {});
  }, []);

  // slides the strip by exactly one card; the appended clones make the wrap seamless
  const advanceReview = (dir: 1 | -1, manual = false) => {
    if (isTransitioningRef.current || openReviewRef.current) return;
    const n = reviewListRef.current.length;
    // nothing to slide when every review already fits in the row
    if (n <= REVIEWS_PER_VIEW) return;
    const cur = reviewIndexRef.current;
    // stepping off either end: snap onto the matching clone first (no transition), then slide from there
    const from = dir === 1 ? (cur >= n ? 0 : cur) : (cur <= 0 ? n : cur);
    isTransitioningRef.current = true;
    if (from === cur) {
      setReviewAnimate(true);
      setReviewIndex(from + dir);
    } else {
      setReviewAnimate(false);
      setReviewIndex(from);
      reviewIndexRef.current = from;
      // two frames: one to paint the snap, one to slide away from it
      requestAnimationFrame(() => requestAnimationFrame(() => {
        setReviewAnimate(true);
        setReviewIndex(from + dir);
      }));
    }
    setTimeout(() => { isTransitioningRef.current = false; }, 700);
    if (manual) restartReviewTimer();
  };

  // the strip landed on a clone — rewind to the real card while the transition is off
  const settleReview = (e: ReactTransitionEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget || e.propertyName !== 'transform') return;
    if (reviewIndexRef.current >= reviewListRef.current.length) {
      setReviewAnimate(false);
      setReviewIndex(0);
      reviewIndexRef.current = 0;
    }
  };

  const onReviewTouchStart = (e: ReactTouchEvent<HTMLDivElement>) => {
    const t = e.touches[0];
    touchStartRef.current = t ? { x: t.clientX, y: t.clientY } : null;
  };

  const onReviewTouchEnd = (e: ReactTouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current;
    const t = e.changedTouches[0];
    touchStartRef.current = null;
    if (!start || !t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    // horizontal flicks only — vertical drags stay page scrolls
    if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy)) return;
    advanceReview(dx < 0 ? 1 : -1, true);
  };

  const restartReviewTimer = () => {
    if (reviewTimerRef.current) clearInterval(reviewTimerRef.current);
    reviewTimerRef.current = setInterval(() => advanceReview(1), 4000);
  };

  // autoplay every 4s — runs once, reads current values via refs so API list updates don't restart it
  useEffect(() => {
    restartReviewTimer();
    return () => { if (reviewTimerRef.current) clearInterval(reviewTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // keep index ref in sync with state
  useEffect(() => { reviewIndexRef.current = reviewIndex; }, [reviewIndex]);

  // keep list ref in sync with state (API updates don't restart autoplay interval)
  useEffect(() => { reviewListRef.current = reviewList; }, [reviewList]);

  // mark the cards whose text overflows three lines so only those get a "Show full" button.
  // toggled on the DOM directly: the card's className is static, so React never overwrites it,
  // and the featured card changes width mid-slide (observed, so the flag follows).
  useEffect(() => {
    const root = reviewsRef.current;
    if (!root) return;
    const sync = () => {
      root.querySelectorAll<HTMLElement>('.reviews-card').forEach(card => {
        const text = card.querySelector<HTMLElement>('.reviews-text');
        if (text) card.classList.toggle('is-clamped', text.scrollHeight - text.clientHeight > 1);
      });
    };
    sync();
    // the clamped box keeps a fixed height, so a late webfont swap wouldn't trip the observer
    document.fonts?.ready.then(sync).catch(() => {});
    const ro = new ResizeObserver(sync);
    root.querySelectorAll('.reviews-text').forEach(el => ro.observe(el));
    return () => ro.disconnect();
  }, [reviewList]);

  // modal: close on Escape and hold the page still behind it
  useEffect(() => {
    openReviewRef.current = openReview !== null;
    if (!openReview) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenReview(null); };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [openReview]);

  const upcomingDiscussions = allDiscussions.filter(d => d.status === 'upcoming');
  const completedDiscussions = allDiscussions.filter(d => d.status === 'completed');

  useEffect(() => {
    if (upcomingDiscussions.length === 0) return;
    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const dtl = gsap.timeline({
          scrollTrigger: { trigger: '.home-disc', start: 'top 82%', once: true },
          defaults: { ease: 'power3.out' },
        });
        dtl.from('.home-disc-head .section-label', { y: 16, opacity: 0, duration: 0.45 })
          .from('.home-disc-head h2', { y: 22, opacity: 0, duration: 0.55 }, '-=0.3')
          .from('.home-disc-all', { x: 16, opacity: 0, duration: 0.45 }, '-=0.35')
          .from('.home-disc .disc-card', { y: 44, opacity: 0, duration: 0.65, stagger: 0.1 }, '-=0.25');
      });
      return () => mm.revert();
    }, homeRef);
    ScrollTrigger.refresh();
    return () => ctx.revert();
  }, [upcomingDiscussions.length]);

  useEffect(() => {
    if (view === 'select') ScrollTrigger.refresh();
  }, [view]);

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

  function goToStep(action: JourneyStep['action']) {
    if (action === 'classes') { document.getElementById('classes')?.scrollIntoView({ behavior: 'smooth' }); return; }
    if (action === 'reviews') { document.querySelector('.reviews')?.scrollIntoView({ behavior: 'smooth' }); return; }
    showView(action);
  }

  function openDetail(id: number) {
    setSelectedDisc(id);
    setEnrollSuccess(false);
    setOpenModule(0);
    setDetailRev(0);
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
  const detailReviews = activeDisc?.reviews ?? [];
  // the strip stops once the last card is flush right, so the final page is never half empty
  const detailRevMax = Math.max(0, detailReviews.length - detailPerView);
  // clamped on read, not stored: a narrower viewport or a shorter review list
  // shrinks detailRevMax, which would otherwise strand the strip past its last page
  const detailRevAt = Math.min(detailRev, detailRevMax);

  function slideDetailRev(dir: 1 | -1) {
    setDetailRev(Math.min(detailRevMax, Math.max(0, detailRevAt + dir)));
  }

  const onDetailRevTouchStart = (e: ReactTouchEvent<HTMLDivElement>) => {
    const t = e.touches[0];
    detailTouchRef.current = t ? { x: t.clientX, y: t.clientY } : null;
  };

  const onDetailRevTouchEnd = (e: ReactTouchEvent<HTMLDivElement>) => {
    const start = detailTouchRef.current;
    const t = e.changedTouches[0];
    detailTouchRef.current = null;
    if (!start || !t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    // horizontal flicks only — vertical drags stay page scrolls
    if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy)) return;
    slideDetailRev(dx < 0 ? 1 : -1);
  };

  return (
    <>

      <header className="top-header">
        <div className="top-header-inner">
          <img ref={logoRef} src="/images/logo.png" alt="Logo" onClick={handleLogoClick} style={{ height: 40, width: 'auto', objectFit: 'contain' }} />
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
      <div className={`!px-4 view ${view === 'select' ? 'active' : ''}`} ref={homeRef}>
        <section className="hero">
          <div className="hero-inner">
            <div className="hero-copy">
              <h1 className="hero-title">
                <span className="hero-line"><span className="hero-line-inner">Language.</span></span>
                <span className="hero-line"><span className="hero-line-inner">Learning.</span></span>
                <span className="hero-line"><span className="hero-line-inner hero-accent">Communication.</span></span>
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
          <section className="journey" id="journey" aria-labelledby="journey-title">
            <div className="journey-head">
              <span className="section-label journey-label">How it works</span>
              <h2 id="journey-title">Your learning <em>journey</em></h2>
              <p>Five simple steps — from first hello to confident, fluent conversation.</p>
            </div>
            <div className="journey-track">
              <span className="journey-line" aria-hidden="true"></span>
              {JOURNEY_STEPS.map((s) => (
                <button key={s.n} className="journey-step" onClick={() => goToStep(s.action)} aria-label={`Step ${s.n}: ${s.title}`}>
                  <span className="journey-node"><span className="journey-num">{s.n}</span></span>
                  <span className="journey-body">
                    <span className="journey-title">{s.title}</span>
                    <span className="journey-desc">{s.desc}</span>
                    <span className="journey-cta">
                      {s.cta}
                      <svg viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>
          <div className="class-banner-wrap" id="classes">
            <section className="class-banner">
              <div className="class-banner-copy">
                <span className="class-banner-label">Find the right class for you</span>
                <h2><em>Live</em> Group Discussions</h2>
                <p>Practice real conversations with other learners in a supportive group.</p>
                <ul className="class-banner-feats">
                  <li>Real-world topics</li>
                  <li>Speak with peers</li>
                  <li>Build fluency &amp; confidence</li>
                </ul>
                <button className="class-banner-cta" onClick={() => showView('discussions')}>
                  View Discussions
                  <svg viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              </div>
              <div className="class-banner-art" aria-hidden="true">
                <img src="/images/live-group-discussions.webp" alt="" />
              </div>
            </section>
          </div>

          {upcomingDiscussions.length > 0 && (
            <div className="home-disc">
              <div className="home-disc-head">
                <div>
                  <span className="section-label">Join a live session</span>
                  <h2><em>Upcoming</em> Discussions</h2>
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

          <div className="reviews" ref={reviewsRef}>
            <div className="reviews-head">
              <span className="reviews-eyebrow">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 5l7 7-7 7M4 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Success is only possible through learning
              </span>
              <h2>What our <em>students</em> say</h2>
            </div>

            {(() => {
              const n = reviewList.length;
              if (n === 0) return null;
              // three reviews per row — the strip slides one review at a time
              const perView = Math.min(REVIEWS_PER_VIEW, n);
              const sliding = n > perView;
              // leading cards are cloned onto the tail so the strip can wrap without a visible jump
              const strip = sliding ? [...reviewList, ...reviewList.slice(0, perView)] : reviewList;
              // the middle slot is the featured one (no featured card when only two fit)
              const centerOffset = perView === 2 ? -1 : Math.floor(perView / 2);
              return (
                <>
                  <div
                    className="reviews-viewport"
                    onTouchStart={onReviewTouchStart}
                    onTouchEnd={onReviewTouchEnd}
                  >
                    <div
                      className={`reviews-track${reviewAnimate ? ' is-sliding' : ''}`}
                      data-per-view={perView}
                      style={{ '--rev-i': String(reviewIndex) } as CSSProperties}
                      onTransitionEnd={settleReview}
                    >
                      {strip.map((t, i) => {
                        const rating = typeof t.rating === 'number' ? t.rating : 5;
                        const isCenter = centerOffset >= 0 && i === reviewIndex + centerOffset;
                        return (
                          <div
                            key={i}
                            className={`reviews-card-wrap ${isCenter ? 'is-center' : 'is-side'}`}
                          >
                            <div className="reviews-card">
                              <div className="reviews-quote">
                                <ReviewStars rating={rating} />
                                <p className="reviews-text">{t.text}</p>
                                <button
                                  type="button"
                                  className="reviews-more"
                                  onClick={() => setOpenReview({ ...t, rating })}
                                >
                                  Show full
                                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                </button>
                                <div className="reviews-meta">
                                  <div className="reviews-author">
                                    <div className="reviews-portrait" aria-hidden="true">
                                      <span className="reviews-portrait-initial">{t.name.charAt(0)}</span>
                                    </div>
                                    <div className="reviews-author-text">
                                      <span className="reviews-name">{t.name}</span>
                                      <span className="reviews-role">{t.course}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {n > perView && (
                    <div className="reviews-nav-wrap">
                      <div className="reviews-nav">
                        <button className="reviews-nav-btn" aria-label="Previous review" onClick={() => advanceReview(-1, true)}>
                          <svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </button>
                        <button className="reviews-nav-btn" aria-label="Next review" onClick={() => advanceReview(1, true)}>
                          <svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </button>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>

          <div className="disc-cta-row home-cta-row">
            <div className="disc-cta-card">
              <span className="disc-cta-eyebrow">Start speaking</span>
              <h3>Ready to speak with <em>confidence</em>?</h3>
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
                  <path d="M58 66 a34 34 0 0 1 68 0" stroke="#3B6FD4" strokeWidth="6" fill="none" strokeLinecap="round" />
                  <rect x="50" y="62" width="13" height="22" rx="6" fill="#3B6FD4" />
                  <rect x="121" y="62" width="13" height="22" rx="6" fill="#3B6FD4" />
                  <path d="M56 82 C52 104 70 110 86 106" stroke="#3B6FD4" strokeWidth="5" fill="none" strokeLinecap="round" />
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

          <div className="disc-section disc-section-upcoming">
            <div className="disc-section-head">
              <span className="disc-section-icon disc-section-icon-up"><span className="disc-pulse"></span></span>
              <div className="disc-section-heading">
                <h2>Upcoming</h2>
                <p className="disc-section-sub">Open for registration \u2014 grab your spot</p>
              </div>
              <span className="disc-section-count">{upcomingDiscussions.length} {upcomingDiscussions.length === 1 ? 'session' : 'sessions'}</span>
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
                      <span className="disc-status disc-status-open"><span className="disc-status-dot"></span>Open</span>
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

          <div className="disc-section disc-section-completed">
            <div className="disc-section-head">
              <span className="disc-section-icon disc-section-icon-done">
                <svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </span>
              <div className="disc-section-heading">
                <h2>Completed</h2>
                <p className="disc-section-sub">Past sessions — see topics and member reviews</p>
              </div>
              <span className="disc-section-count disc-section-count-done">{completedDiscussions.length} {completedDiscussions.length === 1 ? 'session' : 'sessions'}</span>
            </div>
            {completedDiscussions.length === 0 ? (
              <div className="disc-empty">No completed discussions yet</div>
            ) : (
              <div className="disc-grid">
                {completedDiscussions.map((d, i) => {
                  const discDates = d.dates && d.dates.length > 0 ? d.dates : (d.date ? [{ date: d.date, time: d.time }] : []);
                  return (
                  <div key={d.id} className="disc-card disc-completed" style={{ animationDelay: `${0.15 + i * 0.08}s`, cursor: 'pointer' }} onClick={() => openDetail(d.id)}>
                    <div className="disc-card-head">
                      <span className="disc-date-badge disc-date-badge-done">
                        <svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        {discDates[0]?.date || 'Completed'}
                      </span>
                      {discDates.length > 1 && <span className="disc-date-badge disc-date-badge-extra">+{discDates.length - 1}</span>}
                      <span className="disc-status disc-status-ended">Ended</span>
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
          const learn = activeDisc.learn || [];
          const requirements = activeDisc.requirements || [];
          const curriculum = activeDisc.curriculum || [];
          const lessonCount = curriculum.reduce((n, m) => n + (m.items?.length || 0), 0);
          return (
          <div className="dt-wrap">
            <button className="back-btn" onClick={() => { setView('discussions'); setEnrollSuccess(false); window.history.pushState(null, '', '/discussions'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
              <svg viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Discussions
            </button>
            <div className={`dt-layout${isCompletedDetail ? ' dt-layout-completed' : ''}`}>
              <div className="dt-main">
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
                    </>
                  ) : (
                    <>
                      <div className="dt-info-label">
                        <span className="disc-pulse"></span>
                        <span>Upcoming Session</span>
                      </div>
                      <h1 className="dt-title">{activeDisc.topic}</h1>
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
              {(learn.length > 0 || curriculum.length > 0 || requirements.length > 0 || activeDisc.description) && (
              <div className="dt-sections">
                {learn.length > 0 && (
                  <section className="dt-section">
                    <div className="dt-section-head">
                      <span className="dt-section-eyebrow">Outcomes</span>
                      <h2>What you&apos;ll learn?</h2>
                    </div>
                    <ul className="dt-learn-list">
                      {learn.map((l, i) => (
                        <li key={i}>
                          <svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          <span>{l}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {curriculum.length > 0 && (
                  <section className="dt-section">
                    <div className="dt-section-head">
                      <span className="dt-section-eyebrow">Curriculum</span>
                      <h2>Course curriculum</h2>
                      <p className="dt-section-note">
                        {curriculum.length} {curriculum.length === 1 ? 'module' : 'modules'}
                        {lessonCount > 0 && ` \u00b7 ${lessonCount} ${lessonCount === 1 ? 'lesson' : 'lessons'}`}
                        {` \u00b7 ${activeDisc.duration}`}
                      </p>
                    </div>
                    <div className="dt-acc">
                      {curriculum.map((m, i) => {
                        const items = m.items || [];
                        const isOpen = openModule === i;
                        const panelId = `dt-acc-${activeDisc.id}-${i}`;
                        return (
                          <div key={i} className={`dt-acc-tab${isOpen ? ' is-open' : ''}`}>
                            <button
                              type="button"
                              className="dt-acc-head"
                              aria-expanded={isOpen}
                              aria-controls={panelId}
                              onClick={() => setOpenModule(isOpen ? -1 : i)}
                            >
                              <span className="dt-acc-num">{String(i + 1).padStart(2, '0')}</span>
                              <span className="dt-acc-titles">
                                <span className="dt-acc-title">{m.title}</span>
                                {m.summary && <span className="dt-acc-sum">{m.summary}</span>}
                              </span>
                              {items.length > 0 && (
                                <span className="dt-acc-count">{items.length} {items.length === 1 ? 'lesson' : 'lessons'}</span>
                              )}
                              <span className="dt-acc-chev" aria-hidden="true">
                                <svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9" strokeLinecap="round" strokeLinejoin="round"/></svg>
                              </span>
                            </button>
                            <div className="dt-acc-panel" id={panelId} role="region">
                              <div className="dt-acc-panel-inner">
                                {items.length > 0 ? (
                                  <ul className="dt-acc-items">
                                    {items.map((it, k) => (
                                      <li key={k}>
                                        <svg viewBox="0 0 24 24"><polygon points="6 4 20 12 6 20 6 4"/></svg>
                                        <span>{it}</span>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="dt-acc-blank">Details for this module are coming soon.</p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}

                {requirements.length > 0 && (
                  <section className="dt-section">
                    <div className="dt-section-head">
                      <span className="dt-section-eyebrow">Before you join</span>
                      <h2>Requirements</h2>
                    </div>
                    <ul className="dt-req-list">
                      {requirements.map((r, i) => (
                        <li key={i}><span>{r}</span></li>
                      ))}
                    </ul>
                  </section>
                )}

                {activeDisc.description && (
                  <section className="dt-section">
                    <div className="dt-section-head">
                      <span className="dt-section-eyebrow">Description</span>
                      <h2>About this discussion</h2>
                    </div>
                    <div className="dt-about">
                      {activeDisc.description.split(/\n+/).filter(Boolean).map((para, i) => (
                        <p key={i}>{para}</p>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}
              </div>

              {!isCompletedDetail && (
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

            <section className="dt-teacher">
              <div className="dt-section-head">
                <span className="dt-section-eyebrow">Your instructor</span>
                <h2>Meet your teacher</h2>
              </div>
              <div className="dt-teacher-body">
                <aside className="dt-teacher-side">
                  <div className="dt-teacher-avatar" aria-hidden="true">MF</div>
                  <h3 className="dt-teacher-name">Mahdieh Fahimpour</h3>
                  <ul className="dt-teacher-roles">
                    {TEACHER_ROLES.map((role) => (
                      <li key={role}>{role}</li>
                    ))}
                  </ul>
                </aside>
                <div className="dt-teacher-main">
                  <p className="dt-teacher-bio">
                    As an experienced and dedicated online English teacher and tutor, I am committed to helping
                    students of all levels and ages achieve their language goals. With over 6 years of experience,
                    I have a proven track record of delivering engaging and effective lessons tailored to each
                    student&rsquo;s unique learning objectives. My fluency in three languages and ongoing pursuit of a
                    fourth has given me a deep appreciation for the challenges of language learning. I take pride in
                    my professionalism and dedication to delivering high-quality language instruction, and I am
                    confident that my excellent communication skills and ability to leverage online tools and
                    resources can create a positive and supportive learning environment that empowers my students
                    succeed.
                  </p>
                  <div className="dt-teacher-skills">
                    <h4>Top skills</h4>
                    <div className="dt-teacher-chips">
                      {TEACHER_SKILLS.map((skill) => (
                        <span key={skill} className="dt-teacher-chip">{skill}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {(isCompletedDetail || detailReviews.length > 0) && (
              <section className="dt-revs">
                <div className="dt-revs-head">
                  <div className="dt-section-head">
                    <span className="dt-section-eyebrow">{isCompletedDetail ? "Teacher\u2019s feedback" : 'Student reviews'}</span>
                    <h2>{isCompletedDetail ? 'How the students did' : 'What members said'}</h2>
                  </div>
                  {detailReviews.length > detailPerView && (
                    <div className="dt-revs-nav">
                      <button type="button" aria-label="Previous review" disabled={detailRevAt === 0} onClick={() => slideDetailRev(-1)}>
                        <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </button>
                      <button type="button" aria-label="Next review" disabled={detailRevAt >= detailRevMax} onClick={() => slideDetailRev(1)}>
                        <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </button>
                    </div>
                  )}
                </div>
                {detailReviews.length > 0 ? (
                  <>
                    <div className="dt-revs-viewport" onTouchStart={onDetailRevTouchStart} onTouchEnd={onDetailRevTouchEnd}>
                      <div
                        className="dt-revs-track"
                        data-per-view={detailPerView}
                        style={{ '--drev-i': String(detailRevAt) } as CSSProperties}
                      >
                        {detailReviews.map((r, i) => (
                          <article key={i} className="dt-revs-card">
                            <span className="dt-revs-mark" aria-hidden="true">&ldquo;</span>
                            <p className="dt-revs-text">{r.text}</p>
                            <div className="dt-revs-foot">
                              <span className="dt-revs-avatar">{(r.name || '?').trim().charAt(0).toUpperCase()}</span>
                              <span className="dt-revs-id">
                                <span className="dt-revs-name">{r.name}</span>
                                {r.level && <span className="dt-revs-level">{r.level}</span>}
                              </span>
                            </div>
                          </article>
                        ))}
                      </div>
                    </div>
                    {detailRevMax > 0 && (
                      <div className="dt-revs-dots">
                        {Array.from({ length: detailRevMax + 1 }, (_, i) => (
                          <button
                            key={i}
                            type="button"
                            className={i === detailRevAt ? 'is-on' : ''}
                            aria-label={`Go to review ${i + 1}`}
                            onClick={() => setDetailRev(i)}
                          />
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="dt-rev-empty">
                    <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    <p>The teacher hasn&apos;t shared feedback for this session yet.</p>
                  </div>
                )}
              </section>
            )}
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
              <h3>Your English journey starts <em>here</em>.</h3>
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

      {openReview && (
        <div
          className="review-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={`Review by ${openReview.name}`}
          onClick={() => setOpenReview(null)}
        >
          <div className="review-modal" onClick={e => e.stopPropagation()}>
            <button type="button" className="review-modal-close" aria-label="Close review" onClick={() => setOpenReview(null)}>
              <svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/></svg>
            </button>
            <ReviewStars rating={typeof openReview.rating === 'number' ? openReview.rating : 5} />
            <p className="review-modal-text">{openReview.text}</p>
            <div className="reviews-meta">
              <div className="reviews-author">
                <div className="reviews-portrait" aria-hidden="true">
                  <span className="reviews-portrait-initial">{openReview.name.charAt(0)}</span>
                </div>
                <div className="reviews-author-text">
                  <span className="reviews-name">{openReview.name}</span>
                  <span className="reviews-role">{openReview.course}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={`error-toast ${error ? 'show' : ''}`} style={{ visibility: error ? 'visible' : 'hidden' }}>Something went wrong. Please try again.</div>
    </>
  );
}
