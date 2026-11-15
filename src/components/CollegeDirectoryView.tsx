import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import {
  ArrowLeft,
  Building2,
  Camera,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Globe,
  Mail,
  MapPin,
  Phone,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { AP_DISTRICTS, DEMO_COLLEGES } from '../data/demoColleges.ts';
import { buildCollegeMediaSummaryMap } from '../data/verifiedCollegeMedia.ts';
import { db } from '../lib/firebase.ts';
import { InstitutionalPhotoFrame } from './InstitutionalPhotoFrame.tsx';
import type {
  CollegeIntegrationRecord,
  CollegeMediaRecord,
  CollegeRecord,
} from '../types.ts';

interface CollegeDirectoryViewProps {
  initialSearch?: string;
  onSelectForRegistration?: (college: CollegeRecord) => void;
}

const MANAGEMENT_OPTIONS = [
  'All',
  'Government',
  'Private Aided',
  'Private Un-aided',
  'Autonomous',
] as const;

const COURSE_FILTERS = [
  'All',
  'B.Tech',
  'B.Sc',
  'B.Com',
  'B.A',
  'M.Tech',
  'MCA',
  'MBA',
  'B.Pharm',
  'Diploma',
] as const;

const VERIFICATION_FILTERS = ['All', 'Verified', 'Pending Verification', 'DEMO'] as const;
const PHOTO_COVERAGE_FILTERS = ['All', 'Has Verified Photos', 'Needs Official Photos'] as const;

export function CollegeDirectoryView({
  initialSearch = '',
  onSelectForRegistration,
}: CollegeDirectoryViewProps) {
  const [liveColleges, setLiveColleges] = useState<CollegeRecord[]>([]);
  const [liveApprovedMedia, setLiveApprovedMedia] = useState<CollegeMediaRecord[]>([]);
  const [apiColleges, setApiColleges] = useState<CollegeRecord[]>([]);
  const [integrationsMap, setIntegrationsMap] = useState<Record<string, CollegeIntegrationRecord>>({});
  const [search, setSearch] = useState(initialSearch);
  const [district, setDistrict] = useState('All');
  const [management, setManagement] = useState('All');
  const [courseFilter, setCourseFilter] = useState('All');
  const [verificationFilter, setVerificationFilter] = useState('All');
  const [photoFilter, setPhotoFilter] = useState<(typeof PHOTO_COVERAGE_FILTERS)[number]>('All');
  const [page, setPage] = useState(1);
  const [selectedCollege, setSelectedCollege] = useState<CollegeRecord | null>(null);
  const [loadingLive, setLoadingLive] = useState(true);
  const pageSize = 24;

  useEffect(() => {
    setSearch(initialSearch);
    setPage(1);
    setSelectedCollege(null);
  }, [initialSearch]);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'colleges'),
      (snap) => {
        setLiveColleges(snap.docs.map((d) => d.data() as CollegeRecord));
        setLoadingLive(false);
      },
      () => {
        setLoadingLive(false);
      }
    );

    const unsubMedia = onSnapshot(
      query(collection(db, 'college_media'), where('approvalStatus', '==', 'Approved')),
      (snap) => {
        setLiveApprovedMedia(snap.docs.map((d) => d.data() as CollegeMediaRecord));
      },
      () => undefined
    );

    fetch('/api/colleges?limit=100')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { items?: CollegeRecord[] } | null) => {
        if (data?.items) setApiColleges(data.items);
      })
      .catch(() => undefined);

    fetch('/api/integrations')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { items?: CollegeIntegrationRecord[] } | null) => {
        if (data?.items) {
          const map: Record<string, CollegeIntegrationRecord> = {};
          data.items.forEach((item) => {
            map[item.collegeId] = item;
          });
          setIntegrationsMap(map);
        }
      })
      .catch(() => undefined);

    return () => {
      unsub();
      unsubMedia();
    };
  }, []);

  const mediaSummaryMap = useMemo(
    () => buildCollegeMediaSummaryMap(liveApprovedMedia),
    [liveApprovedMedia]
  );

  const mergedColleges = useMemo(() => {
    const byId = new Map<string, CollegeRecord>();
    DEMO_COLLEGES.forEach((c) => byId.set(c.id, c));
    apiColleges.forEach((c) => {
      const existing = byId.get(c.id);
      byId.set(c.id, { ...(existing || {}), ...c });
    });
    liveColleges.forEach((c) => {
      const existing = byId.get(c.id);
      byId.set(c.id, {
        ...(existing || {}),
        ...c,
        courses: c.courses || existing?.courses || ['UG & PG Programmes'],
        departments: c.departments || existing?.departments || [],
      });
    });
    return Array.from(byId.values()).map((col) => ({
      ...col,
      integrationStatus: integrationsMap[col.id]?.status || col.integrationStatus || 'Requires Integration',
    }));
  }, [apiColleges, liveColleges, integrationsMap]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const courseLower = courseFilter.toLowerCase();
    return mergedColleges.filter((col) => {
      if (district !== 'All' && col.district !== district) return false;
      if (management !== 'All' && col.management !== management) return false;
      if (verificationFilter !== 'All' && col.verificationStatus !== verificationFilter) return false;
      const colMediaCount = mediaSummaryMap[col.id]?.totalApprovedCount || 0;
      if (photoFilter === 'Has Verified Photos' && colMediaCount === 0) return false;
      if (photoFilter === 'Needs Official Photos' && colMediaCount > 0) return false;
      if (courseFilter !== 'All') {
        const hasCourse = (col.courses || []).some((c) => c.toLowerCase().includes(courseLower));
        if (!hasCourse) return false;
      }
      if (q) {
        const hay = `${col.name} ${col.code} ${col.location || ''} ${col.district} ${col.affiliatedUniversity} ${col.category || ''} ${(col.courses || []).join(' ')} ${(col.departments || []).join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [mergedColleges, search, district, management, courseFilter, verificationFilter, photoFilter, mediaSummaryMap]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  // Dedicated Institutional Detail Page View
  if (selectedCollege) {
    const integ = integrationsMap[selectedCollege.id];
    const collegeMedia = mediaSummaryMap[selectedCollege.id];
    const officialLogo = collegeMedia?.logo;
    const approvedPhotos = (collegeMedia?.approvedPhotos || []).filter(
      (m) => m.mediaCategory !== 'Official Logo'
    );
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6 ash-animate-in">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => setSelectedCollege(null)}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#1E40AF] dark:text-blue-400 hover:underline cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to College Directory
          </button>

          {onSelectForRegistration && (
            <button
              type="button"
              onClick={() => onSelectForRegistration(selectedCollege)}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#1E40AF] dark:bg-blue-600 rounded-lg hover:bg-[#1E3A8A] cursor-pointer ash-btn-press"
            >
              Register as Student at {selectedCollege.code}
            </button>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
            {officialLogo ? (
              <img
                src={officialLogo.imageUrl}
                alt={`${selectedCollege.name} official logo`}
                loading="lazy"
                className="w-16 h-16 rounded-xl object-contain bg-white border border-slate-200 dark:border-slate-700 p-1.5 shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0">
                <Building2 className="w-7 h-7 text-[#1E40AF] dark:text-blue-400" />
              </div>
            )}

            <div className="space-y-2 flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
                <span className="font-bold text-[#1E40AF] dark:text-blue-400">
                  CODE: {selectedCollege.code}
                </span>
                <span
                  className={
                    selectedCollege.verificationStatus === 'Verified'
                      ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                      : 'text-amber-700 dark:text-amber-400 font-semibold'
                  }
                >
                  Status: {selectedCollege.verificationStatus}
                </span>
                <span className="text-slate-500 dark:text-slate-400">
                  ERP: {integ?.status || selectedCollege.integrationStatus || 'Requires Integration'}
                </span>
              </div>

              <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#0F172A] dark:text-slate-100">
                {selectedCollege.name}
              </h1>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-400 pt-1">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  {selectedCollege.location || selectedCollege.district}, {selectedCollege.district} District, Andhra Pradesh
                </span>
                {selectedCollege.lastVerifiedDate && (
                  <span>Last Verified: {selectedCollege.lastVerifiedDate}</span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-sm">
            <div className="space-y-3">
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Management & Category</div>
                <div className="font-medium text-slate-900 dark:text-slate-100 mt-0.5">
                  {selectedCollege.management} · {selectedCollege.category || 'Higher Education Institution'}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Affiliated University</div>
                <div className="font-medium text-slate-900 dark:text-slate-100 mt-0.5">
                  {selectedCollege.affiliatedUniversity}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Accreditation</div>
                <div className="font-medium text-slate-900 dark:text-slate-100 mt-0.5">
                  {selectedCollege.accreditation}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Campus Address</div>
                <div className="font-medium text-slate-900 dark:text-slate-100 mt-0.5">
                  {selectedCollege.address}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Official Website</div>
                <div className="mt-0.5">
                  {selectedCollege.website && selectedCollege.website.startsWith('http') ? (
                    <a
                      href={selectedCollege.website}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 font-semibold text-[#1E40AF] dark:text-blue-400 hover:underline break-all"
                    >
                      <Globe className="w-4 h-4 shrink-0" />
                      {selectedCollege.website}
                      <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                    </a>
                  ) : (
                    <span className="text-slate-500 dark:text-slate-400">Pending institutional verification</span>
                  )}
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Official Contact Email</div>
                <div className="font-medium text-slate-900 dark:text-slate-100 mt-0.5 inline-flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>{selectedCollege.contactEmail || 'Pending institutional verification'}</span>
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Contact Phone</div>
                <div className="font-medium text-slate-900 dark:text-slate-100 mt-0.5 inline-flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>{selectedCollege.contactPhone || 'Pending institutional verification'}</span>
                </div>
              </div>

              {selectedCollege.sourceUrl && (
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Verification Source URL</div>
                  <a
                    href={selectedCollege.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#5B21B6] dark:text-violet-400 hover:underline break-all mt-0.5"
                  >
                    {selectedCollege.sourceUrl}
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-slate-200 dark:border-slate-800 pt-5">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2.5">
                Courses & Programmes ({selectedCollege.coursesCount || (selectedCollege.courses || []).length})
              </div>
              <ul className="space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
                {(selectedCollege.courses || []).map((course) => (
                  <li key={course} className="flex items-start gap-2">
                    <span className="text-[#1E40AF] dark:text-blue-400">·</span>
                    <span>{course}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2.5">
                Academic Departments
              </div>
              {selectedCollege.departments && selectedCollege.departments.length > 0 ? (
                <ul className="space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
                  {selectedCollege.departments.map((dept) => (
                    <li key={dept} className="flex items-start gap-2">
                      <span className="text-[#5B21B6] dark:text-violet-400">·</span>
                      <span>{dept}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Department breakdown pending college administrator synchronization.
                </p>
              )}
            </div>
          </div>

          {/* Verified Institution-Specific Campus & Student Activity Photographs */}
          <div className="border-t border-slate-200 dark:border-slate-800 pt-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-[#1E40AF] dark:text-blue-400" />
                <h2 className="font-display text-base font-bold text-[#0F172A] dark:text-slate-100">
                  Official Campus, Facilities &amp; Student Activity Photographs ({approvedPhotos.length})
                </h2>
              </div>
              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                Strictly isolated to {selectedCollege.code}
              </span>
            </div>

            {approvedPhotos.length === 0 ? (
              <div className="space-y-3">
                <InstitutionalPhotoFrame
                  src={null}
                  alt={`Official college photograph coming soon for ${selectedCollege.name}`}
                  aspectClass="aspect-[16/7]"
                  collegeName={selectedCollege.name}
                  categoryLabel="Awaiting Official Institutional Submission"
                  isVerified={false}
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  No verified campus or laboratory photographs have been approved for{' '}
                  <strong>{selectedCollege.name}</strong> yet. Authorized College Administrators can submit
                  official campus photographs with source &amp; consent verification via the College Admin
                  Console.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {approvedPhotos.map((photo) => (
                  <InstitutionalPhotoFrame
                    key={photo.id}
                    src={photo.imageUrl}
                    alt={`${photo.title} — ${photo.collegeName}`}
                    aspectClass="aspect-[16/10]"
                    categoryLabel={photo.mediaCategory}
                    collegeName={photo.collegeCode}
                    caption={photo.caption || photo.title}
                    sourceUrl={photo.sourceUrl}
                    licenseOrPermission={photo.licenseOrPermission}
                    isVerified={true}
                    showAttributionBar={true}
                  />
                ))}
              </div>
            )}
          </div>

          {selectedCollege.isDemo ? (
            <div className="p-3.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300">
              DEMO ENTRY: Institution code, affiliation, and contact metadata are illustrative placeholders
              until verified institutional records are imported.
            </div>
          ) : (
            <div className="p-3.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Verified institutional directory entry. Integration Mode:{' '}
                <strong>{integ?.status || selectedCollege.integrationStatus || 'Requires Integration'}</strong>
                {integ?.readOnlySync ? ' (Read-Only Authorised Sync)' : ''}.
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div className="space-y-2">
          <div className="text-xs font-semibold text-[#1E40AF] dark:text-blue-400">
            Andhra Pradesh Institution Registry · {mergedColleges.length} Total Entries
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-[#0F172A] dark:text-slate-100">
            Explore AP Colleges
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 max-w-3xl">
            Search verified engineering and degree institutions across all 26 Andhra Pradesh districts.
            Verified colleges include official websites and affiliation data; records marked{' '}
            <span className="font-mono font-semibold text-amber-700 dark:text-amber-400">DEMO</span> are
            catalog placeholders awaiting bulk CSV import.
          </p>
        </div>

        <div className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums whitespace-nowrap shrink-0">
          Showing {filtered.length} matching institutions
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5">
          <div className="lg:col-span-4 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search college name, code (NRNG, NARN), or course..."
              className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E40AF]"
            />
          </div>

          <div className="lg:col-span-2">
            <select
              aria-label="Filter by District"
              value={district}
              onChange={(e) => {
                setDistrict(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2.5 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
            >
              <option value="All">All Districts</option>
              {AP_DISTRICTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <select
              aria-label="Filter by Management"
              value={management}
              onChange={(e) => {
                setManagement(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2.5 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
            >
              {MANAGEMENT_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m === 'All' ? 'All Management' : m}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <select
              aria-label="Filter by Course"
              value={courseFilter}
              onChange={(e) => {
                setCourseFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2.5 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
            >
              {COURSE_FILTERS.map((c) => (
                <option key={c} value={c}>
                  {c === 'All' ? 'All Courses' : c}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <select
              aria-label="Filter by Verification Status"
              value={verificationFilter}
              onChange={(e) => {
                setVerificationFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2.5 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
            >
              {VERIFICATION_FILTERS.map((v) => (
                <option key={v} value={v}>
                  {v === 'All' ? 'All Statuses' : v}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-slate-500 dark:text-slate-400 font-medium mr-1">
              Photograph Coverage:
            </span>
            {PHOTO_COVERAGE_FILTERS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  setPhotoFilter(opt);
                  setPage(1);
                }}
                className={`px-3 py-1 rounded-md border font-semibold cursor-pointer transition-colors ${
                  photoFilter === opt
                    ? 'bg-[#1E40AF] text-white border-[#1E40AF]'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
          <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
            {Object.keys(mediaSummaryMap).length} institutions have verified photos ·{' '}
            {Math.max(0, mergedColleges.length - Object.keys(mediaSummaryMap).length)} awaiting upload
          </span>
        </div>
      </div>

      {/* Results Grid */}
      {loadingLive && mergedColleges.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="h-52 border border-slate-200 dark:border-slate-800 rounded-xl p-5 ash-skeleton" />
          ))}
        </div>
      ) : pageItems.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center space-y-3">
          <Building2 className="w-8 h-8 text-slate-400 mx-auto" />
          <h3 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
            No institutions match your current filters
          </h3>
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setDistrict('All');
              setManagement('All');
              setCourseFilter('All');
              setVerificationFilter('All');
              setPhotoFilter('All');
              setPage(1);
            }}
            className="px-4 py-2 text-sm font-semibold text-white bg-[#1E40AF] dark:bg-blue-600 rounded-lg hover:bg-[#1E3A8A] cursor-pointer ash-btn-press"
          >
            Reset Directory Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {pageItems.map((college, idx) => {
            const mediaSummary = mediaSummaryMap[college.id];
            const campusPhoto = mediaSummary?.primaryCampusPhoto;
            return (
              <motion.article
                key={college.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: Math.min(idx * 0.02, 0.2) }}
                onClick={() => setSelectedCollege(college)}
                className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 hover:border-[#1E40AF] dark:hover:border-blue-500 flex flex-col justify-between gap-4 cursor-pointer ash-card-interactive"
              >
                <div className="space-y-3">
                  <InstitutionalPhotoFrame
                    src={campusPhoto?.imageUrl}
                    alt={
                      campusPhoto
                        ? `${campusPhoto.title} — ${college.name}`
                        : `Official college photograph coming soon for ${college.name}`
                    }
                    aspectClass="aspect-[16/9]"
                    categoryLabel={
                      campusPhoto
                        ? `${mediaSummary.totalApprovedCount} Photo${mediaSummary.totalApprovedCount > 1 ? 's' : ''}`
                        : undefined
                    }
                    collegeName={college.code}
                    isVerified={Boolean(campusPhoto)}
                    compact={true}
                  />

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2 text-xs font-mono">
                      <span className="font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                        {mediaSummary?.logo && (
                          <img
                            src={mediaSummary.logo.imageUrl}
                            alt={`${college.code} logo`}
                            loading="lazy"
                            className="w-4 h-4 rounded object-contain bg-white border border-slate-200"
                          />
                        )}
                        {college.code}
                      </span>
                      <span
                        className={
                          college.verificationStatus === 'Verified'
                            ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                            : 'text-amber-700 dark:text-amber-400 font-semibold'
                        }
                      >
                        {college.verificationStatus}
                      </span>
                    </div>

                    <h2 className="font-display text-base font-bold text-[#0F172A] dark:text-slate-100 leading-snug group-hover:text-[#1E40AF] dark:group-hover:text-blue-400 transition-colors">
                      {college.name}
                    </h2>

                    <div className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>
                        {college.location || college.district}, {college.district} · {college.management}
                      </span>
                    </div>

                    <div className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed pt-1">
                      {college.affiliatedUniversity}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 text-xs">
                  <span className="text-slate-600 dark:text-slate-400 truncate">
                    {(college.courses || []).slice(0, 2).join(' · ')}
                  </span>
                  <span className="font-semibold text-[#1E40AF] dark:text-blue-400 whitespace-nowrap shrink-0">
                    View Profile →
                  </span>
                </div>
              </motion.article>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 pt-6">
          <div className="text-xs text-slate-600 dark:text-slate-400 font-mono tabular-nums">
            Page {safePage} of {totalPages}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
