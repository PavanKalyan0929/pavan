import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Award, Briefcase, Camera, CheckCircle2, ExternalLink, FileCheck2, GraduationCap } from 'lucide-react';
import {
  CAREER_OPPORTUNITIES,
  CURATED_PLACEMENT_DRIVES,
  DEMO_EXAM_UPDATES,
  DEMO_NPTEL_UPDATES,
  DEMO_SCHOLARSHIPS,
} from '../data/demoColleges.ts';
import { buildCollegeMediaSummaryMap, VERIFIED_SEEDED_MEDIA } from '../data/verifiedCollegeMedia.ts';
import { db } from '../lib/firebase.ts';
import { submitScholarshipApplication } from '../lib/firestoreService.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { InstitutionalPhotoFrame } from './InstitutionalPhotoFrame.tsx';
import type { CollegeMediaRecord, ScholarshipRecord } from '../types.ts';

interface ScholarshipsResourcesViewProps {
  initialSection?: 'scholarships' | 'exams_careers';
  onOpenAuth: () => void;
  onGoToDashboard: () => void;
}

const SCHOLARSHIP_TYPE_FILTERS = ['All', 'State Government', 'Central Government', 'Private / Institutional'] as const;
const CAREER_TRACKS = ['All', 'APPSC', 'UPSC', 'SSC', 'GATE', 'NPTEL', 'Internship', 'Skill Development'] as const;

export function ScholarshipsResourcesView({
  initialSection = 'scholarships',
  onOpenAuth,
  onGoToDashboard,
}: ScholarshipsResourcesViewProps) {
  const { user, studentProfile } = useAuth();
  const [section, setSection] = useState<'scholarships' | 'exams_careers'>(initialSection);
  const [liveScholarships, setLiveScholarships] = useState<ScholarshipRecord[]>([]);
  const [approvedMedia, setApprovedMedia] = useState<CollegeMediaRecord[]>([]);
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [careerTrack, setCareerTrack] = useState<string>('All');
  const [applyingFor, setApplyingFor] = useState<ScholarshipRecord | null>(null);
  const [appRef, setAppRef] = useState('');
  const [grievanceNote, setGrievanceNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    setSection(initialSection);
  }, [initialSection]);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'scholarships'),
      (snap) => setLiveScholarships(snap.docs.map((d) => d.data() as ScholarshipRecord)),
      () => undefined
    );
    const unsubMedia = onSnapshot(
      query(collection(db, 'college_media'), where('approvalStatus', '==', 'Approved')),
      (snap) => setApprovedMedia(snap.docs.map((d) => d.data() as CollegeMediaRecord)),
      () => undefined
    );
    return () => {
      unsub();
      unsubMedia();
    };
  }, []);

  const mediaSummaryMap = useMemo(
    () => buildCollegeMediaSummaryMap(approvedMedia),
    [approvedMedia]
  );

  const studentOwnCollegeMedia = useMemo(() => {
    if (!studentProfile?.collegeId) return null;
    const summary = mediaSummaryMap[studentProfile.collegeId];
    if (!summary) return null;
    return (
      summary.approvedPhotos.find((m) => m.mediaCategory === 'Help Desk & Administration') ||
      summary.approvedPhotos.find((m) => m.mediaCategory === 'Student-Faculty Communication') ||
      summary.primaryCampusPhoto
    );
  }, [mediaSummaryMap, studentProfile?.collegeId]);

  const helpDeskShowcaseMedia = useMemo(() => {
    const all = new Map<string, CollegeMediaRecord>();
    for (const item of VERIFIED_SEEDED_MEDIA) all.set(item.id, item);
    for (const item of approvedMedia) {
      if (item.approvalStatus === 'Approved') all.set(item.id, item);
    }
    const items = Array.from(all.values());
    const preferred = items.filter(
      (m) =>
        m.mediaCategory === 'Help Desk & Administration' ||
        m.mediaCategory === 'Student-Faculty Communication' ||
        m.mediaCategory === 'Student Activity & Events'
    );
    return preferred.slice(0, 3);
  }, [approvedMedia]);

  const allScholarships = useMemo(() => {
    const map = new Map<string, ScholarshipRecord>();
    DEMO_SCHOLARSHIPS.forEach((s) => map.set(s.id, s));
    liveScholarships.forEach((s) => map.set(s.id, s));
    return Array.from(map.values()).filter((s) => s.active);
  }, [liveScholarships]);

  const visibleScholarships = allScholarships.filter((s) => {
    if (typeFilter === 'All') return true;
    const typeLabel = s.scholarshipType || (s.category === 'Central Govt' ? 'Central Government' : 'State Government');
    return typeLabel === typeFilter;
  });

  const visibleCareers = CAREER_OPPORTUNITIES.filter(
    (c) => careerTrack === 'All' || c.track === careerTrack
  );

  async function handleTrackApplication(e: React.FormEvent) {
    e.preventDefault();
    if (!applyingFor || !studentProfile) return;
    setSubmitting(true);
    setStatusMessage(null);
    try {
      await submitScholarshipApplication({
        student: studentProfile,
        scholarship: applyingFor,
        applicationRef: appRef.trim() || `REF-${String(Date.now()).slice(-6)}`,
        grievanceNote: grievanceNote.trim(),
      });
      setApplyingFor(null);
      setAppRef('');
      setGrievanceNote('');
      setStatusMessage('Scholarship tracking entry saved to your Student Dashboard.');
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : 'Failed to save scholarship application.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-6 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="text-xs font-semibold text-[#1E40AF] dark:text-blue-400">
            Financial Aid, Entrance Exams, NPTEL & Career Tracks
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-[#0F172A] dark:text-slate-100">
            {section === 'scholarships'
              ? 'Scholarships & Financial Aid Directory'
              : 'Competitive Exams, NPTEL & Career Opportunities'}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 max-w-2xl">
            {section === 'scholarships'
              ? 'Review State, Central, and Private scholarship eligibility, required documents, deadlines, and log your application reference for college nodal verification.'
              : 'Explore APPSC, UPSC, SSC, GATE, AP entrance exams, SWAYAM–NPTEL credit transfers, internships, and skill tracks.'}
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg self-start lg:self-auto">
          <button
            type="button"
            onClick={() => setSection('scholarships')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-md cursor-pointer transition-colors ${
              section === 'scholarships'
                ? 'bg-white dark:bg-slate-900 text-[#0F172A] dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Scholarships
          </button>
          <button
            type="button"
            onClick={() => setSection('exams_careers')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-md cursor-pointer transition-colors ${
              section === 'exams_careers'
                ? 'bg-white dark:bg-slate-900 text-[#0F172A] dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Exams & Careers
          </button>
        </div>
      </div>

      <AnimatePresence>
        {statusMessage && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 flex items-center justify-between gap-4 text-sm text-emerald-800 dark:text-emerald-300"
          >
            <span>{statusMessage}</span>
            <button
              type="button"
              onClick={onGoToDashboard}
              className="font-semibold underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              View in Dashboard
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {section === 'scholarships' ? (
        <section className="space-y-6">
          {/* Verified Help Desk & Student Communication Strip */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1E40AF] dark:text-blue-400">
                  <Camera className="w-3.5 h-3.5" />
                  <span>Institutional Scholarship &amp; Fee Help Desks Across Andhra Pradesh</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                  Authentic administrative blocks and student communication photographs strictly attributed to their respective verified AP colleges.
                </p>
              </div>
              {studentProfile && (
                <span className="font-mono text-[11px] font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md self-start">
                  Your College: {studentProfile.collegeCode}
                </span>
              )}
            </div>

            {studentProfile ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
                <div className="lg:col-span-5">
                  <InstitutionalPhotoFrame
                    src={studentOwnCollegeMedia?.imageUrl}
                    alt={`${studentProfile.collegeName} scholarship and administration facility`}
                    aspectClass="aspect-[16/10]"
                    categoryLabel={studentOwnCollegeMedia?.mediaCategory || 'Help Desk & Administration'}
                    collegeName={studentProfile.collegeName}
                    caption={
                      studentOwnCollegeMedia?.caption ||
                      `Scholarship & biometric verification support desk for ${studentProfile.collegeName}.`
                    }
                    sourceUrl={studentOwnCollegeMedia?.sourceUrl}
                    licenseOrPermission={studentOwnCollegeMedia?.licenseOrPermission}
                    isVerified={Boolean(studentOwnCollegeMedia)}
                    showAttributionBar
                    compact
                  />
                </div>
                <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {helpDeskShowcaseMedia.slice(0, 2).map((item) => (
                    <InstitutionalPhotoFrame
                      key={item.id}
                      src={item.imageUrl}
                      alt={`${item.collegeName} - ${item.title}`}
                      aspectClass="aspect-[16/10]"
                      categoryLabel={item.mediaCategory}
                      collegeName={`${item.collegeCode} · ${item.district}`}
                      caption={item.title}
                      sourceUrl={item.sourceUrl}
                      licenseOrPermission={item.licenseOrPermission}
                      isVerified
                      showAttributionBar
                      compact
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {helpDeskShowcaseMedia.map((item) => (
                  <InstitutionalPhotoFrame
                    key={item.id}
                    src={item.imageUrl}
                    alt={`${item.collegeName} - ${item.title}`}
                    aspectClass="aspect-[16/10]"
                    categoryLabel={item.mediaCategory}
                    collegeName={`${item.collegeName} (${item.district})`}
                    caption={item.title}
                    sourceUrl={item.sourceUrl}
                    licenseOrPermission={item.licenseOrPermission}
                    isVerified
                    showAttributionBar
                    compact
                  />
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {SCHOLARSHIP_TYPE_FILTERS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTypeFilter(t)}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer transition-colors ${
                  typeFilter === t
                    ? 'bg-[#1E40AF] text-white border-[#1E40AF]'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {visibleScholarships.map((sch) => (
              <article
                key={sch.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-[#1E40AF]/50 rounded-xl p-6 flex flex-col justify-between gap-5 ash-card-interactive"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span>
                      {sch.scholarshipType || sch.category} · {sch.deadlineLabel}
                    </span>
                    <span className="font-mono font-semibold text-amber-700 dark:text-amber-400">
                      {sch.isDemo ? 'REFERENCE' : 'VERIFIED'}
                    </span>
                  </div>

                  <h2 className="font-display text-lg font-bold text-[#0F172A] dark:text-slate-100">
                    {sch.title}
                  </h2>
                  <div className="text-xs font-medium text-slate-600 dark:text-slate-400">{sch.provider}</div>

                  <div className="font-mono text-sm font-semibold text-[#1E40AF] dark:text-blue-400">
                    {sch.amountLabel}
                  </div>

                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {sch.eligibilitySummary}
                  </p>

                  {sch.requiredDocuments && sch.requiredDocuments.length > 0 && (
                    <div className="pt-2 space-y-1.5">
                      <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Required Documents Checklist:
                      </div>
                      <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
                        {sch.requiredDocuments.map((docName) => (
                          <li key={docName} className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>{docName}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <a
                    href={sch.officialPortalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-[#1E40AF] dark:hover:text-blue-400"
                  >
                    Official Portal
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  <button
                    type="button"
                    onClick={() => {
                      if (!user || !studentProfile) {
                        onOpenAuth();
                      } else {
                        setApplyingFor(sch);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1E40AF] dark:bg-blue-600 rounded-lg hover:bg-[#1E3A8A] cursor-pointer ash-btn-press"
                  >
                    <FileCheck2 className="w-3.5 h-3.5" />
                    Track / Log Application
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : (
        <section className="space-y-10">
          {/* Career & Competitive Track Opportunities */}
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-[#1E40AF] dark:text-blue-400" />
                <h2 className="font-display text-xl font-bold text-[#0F172A] dark:text-slate-100">
                  APPSC, UPSC, SSC, GATE, Internships & Skill Tracks
                </h2>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {CAREER_TRACKS.map((tr) => (
                  <button
                    key={tr}
                    type="button"
                    onClick={() => setCareerTrack(tr)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer ${
                      careerTrack === tr
                        ? 'bg-[#5B21B6] text-white border-[#5B21B6]'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {tr}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {visibleCareers.map((item) => (
                <article
                  key={item.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between gap-4 ash-card-interactive"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="font-semibold text-[#5B21B6] dark:text-violet-400">{item.track}</span>
                      <span className="text-slate-500 dark:text-slate-400">{item.modeOrLocation}</span>
                    </div>
                    <h3 className="font-display text-base font-bold text-[#0F172A] dark:text-slate-100">
                      {item.title}
                    </h3>
                    <div className="text-xs font-medium text-slate-600 dark:text-slate-400">
                      {item.organization}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Eligibility: {item.eligibility}
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed pt-1">
                      {item.summary}
                    </p>
                  </div>
                  <a
                    href={item.officialPortalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1E40AF] dark:text-blue-400 hover:underline pt-2 border-t border-slate-100 dark:border-slate-800"
                  >
                    Official Portal <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </article>
              ))}
            </div>
          </div>

          {/* Campus Placements, Full-Time Jobs & Internships Showcase */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-bold text-[#0F172A] dark:text-slate-100">
                  Campus Placements, Jobs &amp; Mandatory Internships
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Sign in to apply directly via your college Training &amp; Placement portal, check CGPA cutoffs, and export an ATS Resume PDF.
                </p>
              </div>
              <button
                type="button"
                onClick={() => (user && studentProfile ? onGoToDashboard() : onOpenAuth())}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#1E40AF] dark:bg-blue-600 rounded-lg hover:bg-[#1E3A8A] cursor-pointer whitespace-nowrap shrink-0 ash-btn-press"
              >
                {user && studentProfile ? 'Open Placements & Resume Builder' : 'Sign In to Apply & Build Resume'}
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {CURATED_PLACEMENT_DRIVES.map((drv) => (
                <div
                  key={drv.id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/40 space-y-1.5"
                >
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="font-semibold text-[#5B21B6] dark:text-violet-400">
                      {drv.opportunityType}{drv.isDemo ? ' · DEMO' : ''}
                    </span>
                    <span className="text-slate-500 dark:text-slate-400">
                      Min CGPA {drv.minCgpa.toFixed(1)} · Due {drv.deadlineDate}
                    </span>
                  </div>
                  <div className="font-display font-bold text-sm text-[#0F172A] dark:text-slate-100">
                    {drv.title}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-300">
                    {drv.companyName} · <span className="font-mono font-semibold">{drv.ctcOrStipend}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AP Entrance Exams & SWAYAM-NPTEL */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-[#1E40AF] dark:text-blue-400" />
                <h2 className="font-display text-xl font-bold text-[#0F172A] dark:text-slate-100">
                  APSCHE & National Entrance Exams
                </h2>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {DEMO_EXAM_UPDATES.map((ex) => (
                  <div key={ex.id} className="py-3.5 first:pt-0 last:pb-0 space-y-1">
                    <div className="flex items-baseline justify-between gap-4">
                      <div className="text-sm font-semibold text-[#0F172A] dark:text-slate-100">
                        {ex.examName}
                      </div>
                      <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                        {ex.windowLabel}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {ex.conductingBody} · {ex.stream}
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{ex.summary}</p>
                    {ex.officialPortalUrl && (
                      <a
                        href={ex.officialPortalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#1E40AF] dark:text-blue-400 hover:underline"
                      >
                        Official Portal <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                <h2 className="font-display text-xl font-bold text-[#0F172A] dark:text-slate-100">
                  SWAYAM–NPTEL Academic Updates
                </h2>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {DEMO_NPTEL_UPDATES.map((np) => (
                  <div key={np.id} className="py-3.5 first:pt-0 last:pb-0 space-y-1">
                    <div className="flex items-baseline justify-between gap-4">
                      <div className="text-sm font-semibold text-[#0F172A] dark:text-slate-100">
                        {np.title}
                      </div>
                      <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                        {np.scheduleLabel}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{np.creditsLabel}</div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{np.summary}</p>
                    {np.officialPortalUrl && (
                      <a
                        href={np.officialPortalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#1E40AF] dark:text-blue-400 hover:underline"
                      >
                        Visit SWAYAM-NPTEL <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Application Tracking Modal */}
      <AnimatePresence>
        {applyingFor && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/50 dark:bg-black/75 backdrop-blur-[2px] flex items-center justify-center p-4"
            onClick={() => setApplyingFor(null)}
          >
            <motion.form
              initial={{ opacity: 0, scale: 0.97, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              onSubmit={handleTrackApplication}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl"
            >
              <h3 className="font-display text-lg font-bold text-[#0F172A] dark:text-slate-100">
                Log Scholarship Application
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">{applyingFor.title}</p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Portal Application / Reference Number
                </label>
                <input
                  type="text"
                  required
                  value={appRef}
                  onChange={(e) => setAppRef(e.target.value)}
                  placeholder="e.g., JNB-2026-44109"
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Scholarship Issue / Grievance Note (Optional)
                </label>
                <textarea
                  rows={3}
                  value={grievanceNote}
                  onChange={(e) => setGrievanceNote(e.target.value)}
                  placeholder="Add any biometric, eKYC, or college verification delay note..."
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setApplyingFor(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-semibold text-white bg-[#1E40AF] dark:bg-blue-600 rounded-lg hover:bg-[#1E3A8A] disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Saving...' : 'Save Application'}
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
