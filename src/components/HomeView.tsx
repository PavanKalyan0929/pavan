import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import {
  ArrowRight,
  Award,
  BookOpen,
  Briefcase,
  Building2,
  Camera,
  ChevronLeft,
  ChevronRight,
  Compass,
  CreditCard,
  ExternalLink,
  GraduationCap,
  MapPin,
  MessageSquare,
  Scale,
  Search,
  ShieldCheck,
} from 'lucide-react';
import type { AppView } from './Navbar.tsx';
import {
  CAREER_OPPORTUNITIES,
  DEMO_EXAM_UPDATES,
  DEMO_SCHOLARSHIPS,
  VERIFIED_AP_COLLEGES,
} from '../data/demoColleges.ts';
import {
  buildCollegeMediaSummaryMap,
  VERIFIED_SEEDED_MEDIA,
} from '../data/verifiedCollegeMedia.ts';
import { db } from '../lib/firebase.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { InstitutionalPhotoFrame } from './InstitutionalPhotoFrame.tsx';
import type { CollegeMediaRecord, PlatformStats } from '../types.ts';

interface HomeViewProps {
  onNavigate: (view: AppView) => void;
  onSearchColleges: (query: string) => void;
  onOpenAuth: () => void;
}

const FEATURED_CODES = ['NRNG', 'NARN', 'JNTK', 'VRSE'];

export function HomeView({ onNavigate, onSearchColleges, onOpenAuth }: HomeViewProps) {
  const { user } = useAuth();
  const [heroSearch, setHeroSearch] = useState('');
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [liveApprovedMedia, setLiveApprovedMedia] = useState<CollegeMediaRecord[]>([]);
  const [heroSlideIdx, setHeroSlideIdx] = useState(0);
  const [quickPrompt, setQuickPrompt] = useState('');
  const [quickReply, setQuickReply] = useState<string | null>(null);
  const [quickLoading, setQuickLoading] = useState(false);
  const [quickError, setQuickError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/stats')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: PlatformStats | null) => {
        if (data) setStats(data);
      })
      .catch(() => undefined);

    const unsubMedia = onSnapshot(
      query(collection(db, 'college_media'), where('approvalStatus', '==', 'Approved')),
      (snap) => setLiveApprovedMedia(snap.docs.map((d) => d.data() as CollegeMediaRecord)),
      () => undefined
    );

    return () => unsubMedia();
  }, []);

  const mediaSummaryMap = useMemo(
    () => buildCollegeMediaSummaryMap(liveApprovedMedia),
    [liveApprovedMedia]
  );

  const heroCampusSlides = useMemo(() => {
    const byId = new Map<string, CollegeMediaRecord>();
    for (const item of [...VERIFIED_SEEDED_MEDIA, ...liveApprovedMedia]) {
      if (item.approvalStatus === 'Approved' && item.mediaCategory !== 'Official Logo') {
        byId.set(item.id, item);
      }
    }
    const perCollegeFirst = new Map<string, CollegeMediaRecord>();
    for (const item of byId.values()) {
      const existing = perCollegeFirst.get(item.collegeId);
      if (!existing || item.mediaCategory === 'Main Campus & Entrance') {
        perCollegeFirst.set(item.collegeId, item);
      }
    }
    return Array.from(perCollegeFirst.values());
  }, [liveApprovedMedia]);

  const activeHeroPhoto =
    heroCampusSlides.length > 0
      ? heroCampusSlides[heroSlideIdx % heroCampusSlides.length]
      : null;

  const academicHallPhoto = useMemo(() => {
    const all = [...liveApprovedMedia, ...VERIFIED_SEEDED_MEDIA];
    return (
      all.find((m) => m.id === 'med_klef_hall_02') ||
      all.find(
        (m) =>
          m.approvalStatus === 'Approved' &&
          (m.mediaCategory === 'Academic Building' ||
            m.mediaCategory === 'Classroom & Lecture Hall' ||
            m.mediaCategory === 'Library & Reading Room')
      ) ||
      null
    );
  }, [liveApprovedMedia]);

  const studentInteractionPhoto = useMemo(() => {
    const all = [...liveApprovedMedia, ...VERIFIED_SEEDED_MEDIA];
    return (
      all.find((m) => m.id === 'med_klef_students_03') ||
      all.find(
        (m) =>
          m.approvalStatus === 'Approved' &&
          (m.mediaCategory === 'Student-Faculty Communication' ||
            m.mediaCategory === 'Student Activity & Events' ||
            m.mediaCategory === 'Help Desk & Administration')
      ) ||
      null
    );
  }, [liveApprovedMedia]);

  const collegesWithVerifiedPhotosCount = Object.keys(mediaSummaryMap).length;
  const verifiedMediaTotalCount = Object.values(mediaSummaryMap).reduce(
    (sum, s) => sum + s.totalApprovedCount,
    0
  );

  const featuredInstitutions = VERIFIED_AP_COLLEGES.filter((c) => FEATURED_CODES.includes(c.code));

  function handleHeroSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSearchColleges(heroSearch.trim());
  }

  async function handleQuickAsk(e: React.FormEvent) {
    e.preventDefault();
    if (!quickPrompt.trim()) return;
    setQuickLoading(true);
    setQuickError(null);
    try {
      const res = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: quickPrompt.trim() }),
      });
      const data = (await res.json()) as { reply?: string; error?: string };
      if (!res.ok) throw new Error(data.error || 'Could not reach assistant.');
      setQuickReply(data.reply || '');
    } catch (err) {
      setQuickError(err instanceof Error ? err.message : 'Assistant unavailable.');
    } finally {
      setQuickLoading(false);
    }
  }

  return (
    <div className="space-y-16 pb-16">
      {/* 1. Executive Hero Section */}
      <section className="relative bg-white dark:bg-slate-900 ash-hero-grid border-b border-slate-200 dark:border-slate-800 transition-colors duration-200 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
            <motion.div
              initial="hidden"
              animate="visible"
              variants={{
                hidden: {},
                visible: { transition: { staggerChildren: 0.055 } },
              }}
              className="lg:col-span-6 flex flex-col justify-center space-y-5"
            >
              <motion.div
                variants={{
                  hidden: { opacity: 0, y: 8 },
                  visible: { opacity: 1, y: 0, transition: { duration: 0.25 } },
                }}
                className="inline-flex items-center gap-2 text-xs font-semibold text-[#5B21B6] dark:text-violet-300 tracking-wide"
              >
                <ShieldCheck className="w-4 h-4 text-[#1E40AF] dark:text-blue-400" />
                <span>Andhra Pradesh Higher Education Digital Portal</span>
              </motion.div>

              <motion.h1
                variants={{
                  hidden: { opacity: 0, y: 12 },
                  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
                }}
                className="font-display text-3xl sm:text-4xl lg:text-[42px] font-extrabold tracking-tight text-[#0F172A] dark:text-slate-50 leading-[1.12]"
              >
                Verified colleges, fee records, scholarships & student redressal in one place.
              </motion.h1>

              <motion.p
                variants={{
                  hidden: { opacity: 0, y: 10 },
                  visible: { opacity: 1, y: 0, transition: { duration: 0.28 } },
                }}
                className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl"
              >
                Built for Andhra Pradesh engineering, degree, and postgraduate institutions—connecting
                students directly with college nodal desks, transparent fee ledgers, AP & national
                scholarships, and competitive exam tracks.
              </motion.p>

              {/* Direct College Directory Search Field */}
              <motion.form
                variants={{
                  hidden: { opacity: 0, y: 8 },
                  visible: { opacity: 1, y: 0, transition: { duration: 0.26 } },
                }}
                onSubmit={handleHeroSearchSubmit}
                className="flex flex-col sm:flex-row gap-2.5 pt-1"
              >
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={heroSearch}
                    onChange={(e) => setHeroSearch(e.target.value)}
                    placeholder="Search college name, code (NRNG, NARN, JNTK), or district..."
                    className="w-full pl-10 pr-3.5 py-3 text-sm bg-white dark:bg-slate-950 text-[#0F172A] dark:text-slate-100 placeholder:text-slate-400 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E40AF]"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-[#0F172A] dark:bg-slate-800 rounded-lg hover:bg-slate-800 dark:hover:bg-slate-700 transition-colors cursor-pointer whitespace-nowrap shrink-0 ash-btn-press"
                >
                  Search Colleges
                </button>
              </motion.form>

              <motion.div
                variants={{
                  hidden: { opacity: 0, y: 8 },
                  visible: { opacity: 1, y: 0, transition: { duration: 0.26 } },
                }}
                className="flex flex-wrap items-center gap-3 pt-1"
              >
                <button
                  type="button"
                  onClick={() => onSearchColleges('')}
                  className="group inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#1E40AF] dark:bg-blue-600 rounded-lg hover:bg-[#1E3A8A] dark:hover:bg-blue-500 transition-colors cursor-pointer whitespace-nowrap shrink-0 ash-btn-press"
                >
                  Explore Colleges
                  <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                </button>
                <button
                  type="button"
                  onClick={() => (user ? onNavigate('student_dashboard') : onOpenAuth())}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-[#0F172A] dark:text-slate-100 border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer whitespace-nowrap shrink-0 ash-btn-press"
                >
                  {user ? 'Open Student Dashboard' : 'Student Login & Register'}
                </button>
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.36 }}
              className="lg:col-span-6 flex flex-col gap-3"
            >
              <InstitutionalPhotoFrame
                src={activeHeroPhoto?.imageUrl}
                alt={
                  activeHeroPhoto
                    ? `${activeHeroPhoto.title} — ${activeHeroPhoto.collegeName}`
                    : 'Andhra Pradesh verified college campus showcase'
                }
                aspectClass="aspect-[16/10]"
                categoryLabel={activeHeroPhoto?.mediaCategory || 'AP Campus Showcase'}
                collegeName={
                  activeHeroPhoto
                    ? `${activeHeroPhoto.collegeName} (${activeHeroPhoto.district})`
                    : 'Andhra Pradesh Higher Education Network'
                }
                caption={activeHeroPhoto?.caption}
                sourceUrl={activeHeroPhoto?.sourceUrl}
                licenseOrPermission={activeHeroPhoto?.licenseOrPermission}
                isVerified={Boolean(activeHeroPhoto)}
                showAttributionBar={true}
              />

              {heroCampusSlides.length > 1 && activeHeroPhoto && (
                <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs">
                  <button
                    type="button"
                    onClick={() => onSearchColleges(activeHeroPhoto.collegeCode)}
                    className="inline-flex items-center gap-1.5 font-semibold text-[#1E40AF] dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    Inspect {activeHeroPhoto.collegeCode} Profile →
                  </button>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 tabular-nums mr-1">
                      Campus {(heroSlideIdx % heroCampusSlides.length) + 1} / {heroCampusSlides.length}
                    </span>
                    <button
                      type="button"
                      aria-label="Previous verified AP campus photograph"
                      onClick={() =>
                        setHeroSlideIdx(
                          (idx) => (idx - 1 + heroCampusSlides.length) % heroCampusSlides.length
                        )
                      }
                      className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Next verified AP campus photograph"
                      onClick={() =>
                        setHeroSlideIdx((idx) => (idx + 1) % heroCampusSlides.length)
                      }
                      className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>

          {/* Live Platform Database Statistics (Never Hardcoded Fake Numbers) */}
          <div className="mt-10 pt-8 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <div className="font-mono text-2xl font-bold text-[#0F172A] dark:text-slate-100 tabular-nums">
                {stats ? stats.totalColleges : '—'}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                Total College Records in Database ({stats ? `${stats.verifiedColleges} Verified` : 'Loading'})
              </div>
            </div>
            <div>
              <div className="font-mono text-2xl font-bold text-[#1E40AF] dark:text-blue-400 tabular-nums">
                {stats ? stats.districtsCovered : '—'}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                Andhra Pradesh Districts Indexed
              </div>
            </div>
            <div>
              <div className="font-mono text-2xl font-bold text-[#5B21B6] dark:text-violet-400 tabular-nums">
                {collegesWithVerifiedPhotosCount} ({verifiedMediaTotalCount} photos)
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                Colleges with Verified Campus Photographs ({stats ? `${Math.max(0, stats.totalColleges - collegesWithVerifiedPhotosCount)} awaiting upload` : 'Verified Sources Only'})
              </div>
            </div>
            <div>
              <div className="font-mono text-2xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                {stats ? stats.connectedIntegrations : '—'}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                Live Authorised College ERP Connections
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Verified Andhra Pradesh Institutions Spotlight */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-[#5B21B6] dark:text-violet-400 uppercase tracking-wider">
              Verified Institutional Profiles
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#0F172A] dark:text-slate-100 mt-1">
              Featured Verified Colleges
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onSearchColleges('')}
            className="text-sm font-semibold text-[#1E40AF] dark:text-blue-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
          >
            View All {stats ? stats.totalColleges : ''} Colleges →
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {featuredInstitutions.map((col) => {
            const summary = mediaSummaryMap[col.id];
            const campusPhoto = summary?.primaryCampusPhoto;
            return (
              <button
                key={col.id}
                type="button"
                onClick={() => onSearchColleges(col.code)}
                className="text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-[#1E40AF] dark:hover:border-blue-500 rounded-xl p-4 space-y-3 cursor-pointer ash-card-interactive flex flex-col justify-between"
              >
                <div className="space-y-3 w-full">
                  <InstitutionalPhotoFrame
                    src={campusPhoto?.imageUrl}
                    alt={
                      campusPhoto
                        ? `${campusPhoto.title} — ${col.name}`
                        : `Official college photograph coming soon for ${col.name}`
                    }
                    aspectClass="aspect-[16/9]"
                    collegeName={col.code}
                    categoryLabel={campusPhoto ? campusPhoto.mediaCategory : undefined}
                    isVerified={Boolean(campusPhoto)}
                    compact={true}
                  />
                  <div className="flex items-center justify-between gap-2 text-xs font-mono">
                    <span className="font-semibold text-[#1E40AF] dark:text-blue-400">{col.code}</span>
                    <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                      {col.verificationStatus}
                    </span>
                  </div>
                  <h3 className="font-display text-sm font-bold text-[#0F172A] dark:text-slate-100 leading-snug">
                    {col.name}
                  </h3>
                  <div className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    <span>{col.district} · {col.management}</span>
                  </div>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate w-full pt-1 border-t border-slate-100 dark:border-slate-800">
                  {col.affiliatedUniversity}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 3. Core Student Services */}
      <section id="student-services" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#0F172A] dark:text-slate-100">
              Student Services & Institutional Governance
            </h2>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mt-1">
              Role-isolated workflows for students, college administrators, and state oversight.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('scholarships')}
            className="text-sm font-semibold text-[#1E40AF] dark:text-blue-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
          >
            Explore Scholarships →
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="group lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-[#1E40AF]/50 rounded-xl overflow-hidden flex flex-col ash-card-interactive">
            <div className="p-4 pb-0">
              <InstitutionalPhotoFrame
                src={academicHallPhoto?.imageUrl}
                alt={
                  academicHallPhoto
                    ? `${academicHallPhoto.title} — ${academicHallPhoto.collegeName}`
                    : 'Verified Andhra Pradesh academic classroom and facility'
                }
                aspectClass="aspect-[16/8]"
                categoryLabel={academicHallPhoto?.mediaCategory || 'Academic Facilities'}
                collegeName={academicHallPhoto?.collegeName || 'AP Academic Registry'}
                caption={academicHallPhoto?.caption}
                sourceUrl={academicHallPhoto?.sourceUrl}
                licenseOrPermission={academicHallPhoto?.licenseOrPermission}
                isVerified={Boolean(academicHallPhoto)}
                showAttributionBar={Boolean(academicHallPhoto)}
              />
            </div>
            <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="text-xs font-medium text-[#5B21B6] dark:text-violet-400">
                  01. Institution Discovery & ERP Integration
                </div>
                <h3 className="font-display text-xl font-bold text-[#0F172A] dark:text-slate-100">
                  Verified AP Engineering & Degree College Directory
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Filter all 400+ AP colleges by district, official college code, management type, and
                  degree stream. Inspect college-specific campus photographs, official websites, and
                  academic departments.
                </p>
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => onSearchColleges('')}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-[#1E40AF] dark:text-blue-400 ash-link-underline cursor-pointer"
                >
                  <Building2 className="w-4 h-4" />
                  Browse Full Directory
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 flex flex-col gap-6">
            <div className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-[#1E40AF]/50 rounded-xl overflow-hidden flex-1 flex flex-col ash-card-interactive">
              <div className="p-4 pb-0">
                <InstitutionalPhotoFrame
                  src={studentInteractionPhoto?.imageUrl}
                  alt={
                    studentInteractionPhoto
                      ? `${studentInteractionPhoto.title} — ${studentInteractionPhoto.collegeName}`
                      : 'Authentic student and institutional interaction in Andhra Pradesh'
                  }
                  aspectClass="aspect-[16/7]"
                  categoryLabel={studentInteractionPhoto?.mediaCategory || 'Student Interaction'}
                  collegeName={studentInteractionPhoto?.collegeName || 'AP Student Services'}
                  caption={studentInteractionPhoto?.caption}
                  sourceUrl={studentInteractionPhoto?.sourceUrl}
                  licenseOrPermission={studentInteractionPhoto?.licenseOrPermission}
                  isVerified={Boolean(studentInteractionPhoto)}
                  showAttributionBar={Boolean(studentInteractionPhoto)}
                  compact={true}
                />
              </div>
              <div className="p-6 space-y-2">
                <div className="text-xs font-medium text-[#5B21B6] dark:text-violet-400">
                  02. Fee Receipts, Scholarships & Help Desks
                </div>
                <h3 className="font-display text-lg font-bold text-[#0F172A] dark:text-slate-100">
                  Semester Fee History, PDF Receipts & Aid Tracking
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Download print-ready PDF fee receipts, track payment trends, and monitor State, Central,
                  and Private scholarship applications.
                </p>
                <button
                  type="button"
                  onClick={() => onNavigate('scholarships')}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1E40AF] dark:text-blue-400 ash-link-underline pt-1 cursor-pointer"
                >
                  <BookOpen className="w-4 h-4" />
                  Open Scholarships Portal
                </button>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-[#1E40AF]/50 rounded-xl p-6 space-y-2 ash-card-interactive">
              <div className="text-xs font-medium text-[#5B21B6] dark:text-violet-400">
                03. Grievance Redressal & Evidence Locker
              </div>
              <h3 className="font-display text-lg font-bold text-[#0F172A] dark:text-slate-100">
                Verified Proof Upload & Authority Escalation
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Submit supporting PDF or image documents, track reference numbers, and escalate
                unresolved campus or fee issues from College Nodal Officer to State Oversight.
              </p>
              <button
                type="button"
                onClick={() => (user ? onNavigate('student_dashboard') : onOpenAuth())}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1E40AF] dark:text-blue-400 ash-link-underline pt-1 cursor-pointer"
              >
                <Scale className="w-4 h-4" />
                {user ? 'Open Student Portal' : 'Sign In to Access Services'}
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-[#1E40AF]/50 rounded-xl p-6 space-y-2.5 ash-card-interactive">
            <div className="text-xs font-medium text-[#5B21B6] dark:text-violet-400">
              04. Academics, Attendance &amp; Timetable
            </div>
            <h3 className="font-display text-lg font-bold text-[#0F172A] dark:text-slate-100">
              Attendance Compliance, Marks &amp; SGPA Statements
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Track subject-wise attendance against 75% norms, view internal/external marks, weekly Mon–Sat schedules, and export PDF grade sheets.
            </p>
            <button
              type="button"
              onClick={() => (user ? onNavigate('student_dashboard') : onOpenAuth())}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1E40AF] dark:text-blue-400 ash-link-underline pt-1 cursor-pointer"
            >
              <GraduationCap className="w-4 h-4" />
              {user ? 'View Academics →' : 'Sign In for Academics →'}
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-[#1E40AF]/50 rounded-xl p-6 space-y-2.5 ash-card-interactive">
            <div className="text-xs font-medium text-[#5B21B6] dark:text-violet-400">
              05. Campus Life &amp; QR Digital ID
            </div>
            <h3 className="font-display text-lg font-bold text-[#0F172A] dark:text-slate-100">
              Hostel, Bus Pass, Library &amp; 3D Digital ID Card
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Manage campus hostel allotments, institutional bus route passes, central library loans, and carry an interactive QR-verified Digital ID.
            </p>
            <button
              type="button"
              onClick={() => (user ? onNavigate('student_dashboard') : onOpenAuth())}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1E40AF] dark:text-blue-400 ash-link-underline pt-1 cursor-pointer"
            >
              <CreditCard className="w-4 h-4" />
              {user ? 'Open ID & Services →' : 'Sign In for Campus ID →'}
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-[#1E40AF]/50 rounded-xl p-6 space-y-2.5 ash-card-interactive">
            <div className="text-xs font-medium text-[#5B21B6] dark:text-violet-400">
              06. Campus Placements &amp; ATS Resume
            </div>
            <h3 className="font-display text-lg font-bold text-[#0F172A] dark:text-slate-100">
              Placement Drives, Internships &amp; Resume PDF Builder
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Apply to CGPA-matched campus placements, full-time roles, and AICTE internships while building a print-ready ATS resume.
            </p>
            <button
              type="button"
              onClick={() => (user ? onNavigate('student_dashboard') : onNavigate('exams'))}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1E40AF] dark:text-blue-400 ash-link-underline pt-1 cursor-pointer"
            >
              <Briefcase className="w-4 h-4" />
              {user ? 'Open Placements Suite →' : 'Explore Careers & Drives →'}
            </button>
          </div>
        </div>
      </section>

      {/* 4. Scholarships, Competitive Exams & Career Opportunities */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-bold text-[#0F172A] dark:text-slate-100">
              Scholarships Highlights
            </h3>
            <Award className="w-5 h-5 text-[#1E40AF] dark:text-blue-400" />
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {DEMO_SCHOLARSHIPS.slice(0, 3).map((sch) => (
              <div key={sch.id} className="py-3 first:pt-0 last:pb-0 space-y-1">
                <div className="text-sm font-semibold text-[#0F172A] dark:text-slate-100">{sch.title}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {sch.scholarshipType} · {sch.deadlineLabel}
                </div>
                <a
                  href={sch.officialPortalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#1E40AF] dark:text-blue-400 hover:underline"
                >
                  Official Portal <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => onNavigate('scholarships')}
            className="text-xs font-semibold text-[#1E40AF] dark:text-blue-400 hover:underline cursor-pointer"
          >
            All Scholarship Schemes →
          </button>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-bold text-[#0F172A] dark:text-slate-100">
              Competitive Exams
            </h3>
            <Compass className="w-5 h-5 text-[#5B21B6] dark:text-violet-400" />
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {DEMO_EXAM_UPDATES.slice(0, 4).map((ex) => (
              <div key={ex.id} className="py-3 first:pt-0 last:pb-0 space-y-1">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="text-sm font-semibold text-[#0F172A] dark:text-slate-100">{ex.examName}</div>
                  <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">{ex.windowLabel}</span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {ex.conductingBody} · {ex.stream}
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => onNavigate('exams')}
            className="text-xs font-semibold text-[#1E40AF] dark:text-blue-400 hover:underline cursor-pointer"
          >
            Explore APPSC, UPSC, SSC, GATE & CETs →
          </button>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-bold text-[#0F172A] dark:text-slate-100">
              Career & Internships
            </h3>
            <Briefcase className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {CAREER_OPPORTUNITIES.slice(0, 3).map((op) => (
              <div key={op.id} className="py-3 first:pt-0 last:pb-0 space-y-1">
                <div className="text-sm font-semibold text-[#0F172A] dark:text-slate-100">{op.title}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {op.track} · {op.organization}
                </div>
                <a
                  href={op.officialPortalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#1E40AF] dark:text-blue-400 hover:underline"
                >
                  Official Portal <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => onNavigate('exams')}
            className="text-xs font-semibold text-[#1E40AF] dark:text-blue-400 hover:underline cursor-pointer"
          >
            View All Career & Skill Tracks →
          </button>
        </div>
      </section>

      {/* 5. AI Guidance Desk Preview */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12">
          <div className="lg:col-span-5 bg-[#0F172A] dark:bg-slate-950 text-white p-8 flex flex-col justify-between space-y-6 border-b lg:border-b-0 lg:border-r border-slate-800">
            <div className="space-y-3">
              <div className="text-xs font-medium text-violet-300">
                Andhra Student Hub · AI Guidance Desk
              </div>
              <h2 className="font-display text-2xl font-bold tracking-tight">
                Ask about AP colleges, EAPCET counselling, APPSC/GATE tracks, or fee grievances.
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                Receive structured guidance grounded in Andhra Pradesh academic procedures. Verify final
                dates and fee schedules on official college and government portals.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('ai')}
              className="inline-flex items-center gap-2 text-sm font-semibold text-white hover:text-blue-300 transition-colors self-start cursor-pointer"
            >
              <MessageSquare className="w-4 h-4" />
              Open Full AI Assistant →
            </button>
          </div>

          <div className="lg:col-span-7 p-6 sm:p-8 space-y-4">
            <form onSubmit={handleQuickAsk} className="space-y-3">
              <label htmlFor="quick-ai-input" className="block text-sm font-semibold text-slate-800 dark:text-slate-200">
                Quick Academic Question
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  id="quick-ai-input"
                  type="text"
                  value={quickPrompt}
                  onChange={(e) => setQuickPrompt(e.target.value)}
                  placeholder="e.g., What is the difference between NRNG Gudur and NARN Nellore?"
                  className="flex-1 px-3.5 py-2.5 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E40AF]"
                />
                <button
                  type="submit"
                  disabled={quickLoading || !quickPrompt.trim()}
                  className="px-5 py-2.5 text-sm font-semibold text-white bg-[#1E40AF] dark:bg-blue-600 rounded-lg hover:bg-[#1E3A8A] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer ash-btn-press"
                >
                  {quickLoading ? 'Thinking...' : 'Ask Assistant'}
                </button>
              </div>
            </form>

            <div className="flex flex-wrap gap-2 text-xs">
              {[
                'Documents needed for Jnanabhumi scholarship',
                'How do NPTEL credits transfer in JNTUA / JNTUK colleges?',
                'Checklist before submitting a fee discrepancy grievance',
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setQuickPrompt(suggestion)}
                  className="px-3 py-1.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  {suggestion}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {quickError && (
                <motion.div
                  key="quick-error"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300"
                >
                  {quickError}
                </motion.div>
              )}

              {quickReply && (
                <motion.div
                  key="quick-reply"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed"
                >
                  {quickReply}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </section>
    </div>
  );
}
