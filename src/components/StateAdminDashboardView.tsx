import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { collection, onSnapshot } from 'firebase/firestore';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  Award,
  BarChart3,
  Bell,
  Building2,
  Camera,
  CheckCircle2,
  Database,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Scale,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';
import { AP_DISTRICTS, DEMO_COLLEGES } from '../data/demoColleges.ts';
import {
  buildCollegeMediaSummaryMap,
  VERIFIED_SEEDED_MEDIA,
} from '../data/verifiedCollegeMedia.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useTheme } from '../context/ThemeContext.tsx';
import { buildCollegeImportTemplateCsv } from '../lib/csvParser.ts';
import { db, handleFirestoreError, OperationType } from '../lib/firebase.ts';
import {
  approveOrRevokeCollegeAdmin,
  batchImportCollegesByStateAdmin,
  createStateAnnouncement,
  deleteCollegeMediaRecord,
  reviewCollegeMediaByStateAdmin,
  updateGrievanceByAdmin,
  upsertScholarshipByStateAdmin,
  upsertVerifiedCollegeByStateAdmin,
} from '../lib/firestoreService.ts';
import { InstitutionalPhotoFrame } from './InstitutionalPhotoFrame.tsx';
import type {
  AuditLogRecord,
  CollegeAdminProfile,
  CollegeCategory,
  CollegeIntegrationRecord,
  CollegeMediaRecord,
  CollegeRecord,
  GrievanceRecord,
  IntegrationSyncLog,
  NotificationRecord,
  StudentProfile,
} from '../types.ts';
import type { AppView } from './Navbar.tsx';

type StateTab =
  | 'stats'
  | 'colleges'
  | 'media'
  | 'admins'
  | 'grievances'
  | 'broadcasts'
  | 'integrations'
  | 'audit';

interface StateAdminDashboardViewProps {
  onNavigate: (view: AppView) => void;
}

export function StateAdminDashboardView({ onNavigate }: StateAdminDashboardViewProps) {
  const { user, authReady, isStateAdmin, getToken } = useAuth();
  const { isDark } = useTheme();
  const [tab, setTab] = useState<StateTab>('stats');

  const chartGridStroke = isDark ? '#334155' : '#E2E8F0';
  const chartTickFill = isDark ? '#94A3B8' : '#475569';
  const chartTooltipStyle = isDark
    ? {
        backgroundColor: '#0F172A',
        borderColor: '#334155',
        color: '#F8FAFC',
        borderRadius: '0.5rem',
        fontSize: '12px',
      }
    : {
        backgroundColor: '#FFFFFF',
        borderColor: '#E2E8F0',
        color: '#0F172A',
        borderRadius: '0.5rem',
        fontSize: '12px',
      };

  const [colleges, setColleges] = useState<CollegeRecord[]>([]);
  const [collegeAdmins, setCollegeAdmins] = useState<CollegeAdminProfile[]>([]);
  const [grievances, setGrievances] = useState<GrievanceRecord[]>([]);
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);
  const [integrations, setIntegrations] = useState<CollegeIntegrationRecord[]>([]);
  const [integrationLogs, setIntegrationLogs] = useState<IntegrationSyncLog[]>([]);
  const [integCounts, setIntegCounts] = useState({ totalConfigured: 0, connectedCount: 0 });
  const [backupFeedback, setBackupFeedback] = useState<string | null>(null);

  // Add/Verify College Form
  const [newColCode, setNewColCode] = useState('');
  const [newColName, setNewColName] = useState('');
  const [newColLocation, setNewColLocation] = useState('');
  const [newColDistrict, setNewColDistrict] = useState(AP_DISTRICTS[22]); // Visakhapatnam
  const [newColMgmt, setNewColMgmt] = useState<CollegeRecord['management']>('Government');
  const [newColCat, setNewColCat] = useState<CollegeCategory>('Engineering & Technology');
  const [newColUniv, setNewColUniv] = useState('');
  const [newColAccr, setNewColAccr] = useState('');
  const [newColAddr, setNewColAddr] = useState('');
  const [newColWebsite, setNewColWebsite] = useState('');
  const [newColEmail, setNewColEmail] = useState('');
  const [newColPhone, setNewColPhone] = useState('');
  const [newColSourceUrl, setNewColSourceUrl] = useState('');
  const [newColLastVerified, setNewColLastVerified] = useState(new Date().toISOString().slice(0, 10));
  const [newColStatus, setNewColStatus] = useState<CollegeRecord['verificationStatus']>('Verified');
  const [colSaveFeedback, setColSaveFeedback] = useState<string | null>(null);

  // Bulk CSV Import state
  const [bulkCsvText, setBulkCsvText] = useState('');
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkFeedback, setBulkFeedback] = useState<string | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);

  // State Broadcast Form
  const [stateTitle, setStateTitle] = useState('');
  const [stateCat, setStateCat] = useState<NotificationRecord['category']>('Announcement');
  const [stateMsg, setStateMsg] = useState('');
  const [broadcastFeedback, setBroadcastFeedback] = useState<string | null>(null);

  // New Scholarship Form
  const [schTitle, setSchTitle] = useState('');
  const [schProvider, setSchProvider] = useState('');
  const [schCategory, setSchCategory] = useState('State Post-Matric');
  const [schAmount, setSchAmount] = useState('');
  const [schElig, setSchElig] = useState('');
  const [schDeadline, setSchDeadline] = useState('');
  const [schUrl, setSchUrl] = useState('https://jnanabhumi.ap.gov.in/');
  const [schFeedback, setSchFeedback] = useState<string | null>(null);

  // Media governance & coverage across 400+ colleges
  const [collegeMediaList, setCollegeMediaList] = useState<CollegeMediaRecord[]>([]);
  const [mediaStatusFilter, setMediaStatusFilter] = useState<
    'All' | CollegeMediaRecord['approvalStatus']
  >('Pending Approval');
  const [mediaSearch, setMediaSearch] = useState('');
  const [mediaRemarkDrafts, setMediaRemarkDrafts] = useState<Record<string, string>>({});
  const [mediaReviewFeedback, setMediaReviewFeedback] = useState<string | null>(null);
  const [coverageSearch, setCoverageSearch] = useState('');
  const [coverageDistrict, setCoverageDistrict] = useState('All');
  const [coverageFilter, setCoverageFilter] = useState<
    'all' | 'needs_photos' | 'has_photos' | 'has_activity'
  >('all');
  const [coveragePage, setCoveragePage] = useState(1);

  useEffect(() => {
    if (!authReady || !user || !isStateAdmin) return;

    const unsubCol = onSnapshot(
      collection(db, 'colleges'),
      (snap) => setColleges(snap.docs.map((d) => d.data() as CollegeRecord)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'colleges/stateAdmin')
    );

    const unsubAdmins = onSnapshot(
      collection(db, 'college_admins'),
      (snap) => setCollegeAdmins(snap.docs.map((d) => d.data() as CollegeAdminProfile)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'college_admins/stateAdmin')
    );

    const unsubGrievances = onSnapshot(
      collection(db, 'grievances'),
      (snap) => setGrievances(snap.docs.map((d) => d.data() as GrievanceRecord)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'grievances/stateAdmin')
    );

    const unsubStudents = onSnapshot(
      collection(db, 'students'),
      (snap) => setStudents(snap.docs.map((d) => d.data() as StudentProfile)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'students/stateAdmin')
    );

    const unsubAudit = onSnapshot(
      collection(db, 'audit_logs'),
      (snap) => setAuditLogs(snap.docs.map((d) => d.data() as AuditLogRecord)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'audit_logs/stateAdmin')
    );

    const unsubMedia = onSnapshot(
      collection(db, 'college_media'),
      (snap) => setCollegeMediaList(snap.docs.map((d) => d.data() as CollegeMediaRecord)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'college_media/stateAdmin')
    );

    fetch('/api/integrations')
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (
          data: {
            totalConfigured?: number;
            connectedCount?: number;
            items?: CollegeIntegrationRecord[];
            recentLogs?: IntegrationSyncLog[];
          } | null
        ) => {
          if (data?.items) setIntegrations(data.items);
          if (data?.recentLogs) setIntegrationLogs(data.recentLogs);
          if (typeof data?.totalConfigured === 'number') {
            setIntegCounts({
              totalConfigured: data.totalConfigured,
              connectedCount: data.connectedCount || 0,
            });
          }
        }
      )
      .catch(() => undefined);

    return () => {
      unsubCol();
      unsubAdmins();
      unsubGrievances();
      unsubStudents();
      unsubAudit();
      unsubMedia();
    };
  }, [authReady, user, isStateAdmin]);

  const mergedDirectoryColleges = useMemo(() => {
    const map = new Map<string, CollegeRecord>();
    DEMO_COLLEGES.forEach((c) => map.set(c.id, c));
    colleges.forEach((c) => map.set(c.id, c));
    return Array.from(map.values());
  }, [colleges]);

  const approvedLiveMedia = useMemo(
    () => collegeMediaList.filter((m) => m.approvalStatus === 'Approved'),
    [collegeMediaList]
  );

  const mediaSummaryMap = useMemo(
    () => buildCollegeMediaSummaryMap(approvedLiveMedia),
    [approvedLiveMedia]
  );

  const coverageStats = useMemo(() => {
    let withPhotos = 0;
    let withStudentActivity = 0;
    for (const col of mergedDirectoryColleges) {
      const summary = mediaSummaryMap[col.id];
      if (summary && summary.totalApprovedCount > 0) {
        withPhotos += 1;
        if (summary.studentActivityPhotos.length > 0) {
          withStudentActivity += 1;
        }
      }
    }
    const needingPhotos = Math.max(0, mergedDirectoryColleges.length - withPhotos);
    const pendingSubmissions = collegeMediaList.filter(
      (m) => m.approvalStatus === 'Pending Approval'
    ).length;
    return {
      totalColleges: mergedDirectoryColleges.length,
      withPhotos,
      withStudentActivity,
      needingPhotos,
      pendingSubmissions,
      totalSeededVerifiedPhotos: VERIFIED_SEEDED_MEDIA.length,
    };
  }, [mergedDirectoryColleges, mediaSummaryMap, collegeMediaList]);

  const filteredMediaQueue = useMemo(() => {
    const q = mediaSearch.trim().toLowerCase();
    return collegeMediaList.filter((m) => {
      if (mediaStatusFilter !== 'All' && m.approvalStatus !== mediaStatusFilter) return false;
      if (!q) return true;
      return (
        m.collegeName.toLowerCase().includes(q) ||
        m.collegeCode.toLowerCase().includes(q) ||
        m.title.toLowerCase().includes(q) ||
        m.district.toLowerCase().includes(q) ||
        m.mediaCategory.toLowerCase().includes(q)
      );
    });
  }, [collegeMediaList, mediaStatusFilter, mediaSearch]);

  const filteredCoverageColleges = useMemo(() => {
    const q = coverageSearch.trim().toLowerCase();
    return mergedDirectoryColleges.filter((c) => {
      if (coverageDistrict !== 'All' && c.district !== coverageDistrict) return false;
      const summary = mediaSummaryMap[c.id];
      const hasPhotos = Boolean(summary && summary.totalApprovedCount > 0);
      const hasActivity = Boolean(summary && summary.studentActivityPhotos.length > 0);
      if (coverageFilter === 'needs_photos' && hasPhotos) return false;
      if (coverageFilter === 'has_photos' && !hasPhotos) return false;
      if (coverageFilter === 'has_activity' && !hasActivity) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.district.toLowerCase().includes(q) ||
        (c.location || '').toLowerCase().includes(q)
      );
    });
  }, [mergedDirectoryColleges, mediaSummaryMap, coverageSearch, coverageDistrict, coverageFilter]);

  const coveragePerPage = 20;
  const coverageTotalPages = Math.max(1, Math.ceil(filteredCoverageColleges.length / coveragePerPage));
  const safeCoveragePage = Math.min(coveragePage, coverageTotalPages);
  const paginatedCoverageColleges = useMemo(() => {
    const start = (safeCoveragePage - 1) * coveragePerPage;
    return filteredCoverageColleges.slice(start, start + coveragePerPage);
  }, [filteredCoverageColleges, safeCoveragePage]);

  const districtChartData = useMemo(() => {
    const counts = new Map<string, { colleges: number; students: number; grievances: number }>();
    AP_DISTRICTS.forEach((d) => counts.set(d, { colleges: 0, students: 0, grievances: 0 }));

    DEMO_COLLEGES.forEach((c) => {
      const entry = counts.get(c.district);
      if (entry) entry.colleges += 1;
    });
    students.forEach((s) => {
      const entry = counts.get(s.district);
      if (entry) entry.students += 1;
    });
    grievances.forEach((g) => {
      const entry = counts.get(g.district);
      if (entry) entry.grievances += 1;
    });

    return Array.from(counts.entries())
      .map(([district, val]) => ({
        district: district.slice(0, 12),
        colleges: val.colleges,
        students: val.students,
        grievances: val.grievances,
      }))
      .slice(0, 14);
  }, [students, grievances]);

  if (!user || !isStateAdmin) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
          State Administrator Authorization Required
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          This oversight console is restricted to authorized Andhra Pradesh State Administrators.
        </p>
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className="px-4 py-2 text-sm font-semibold text-white bg-[#1E40AF] dark:bg-blue-600 rounded-lg hover:bg-[#1E3A8A] dark:hover:bg-blue-500 cursor-pointer"
        >
          Return Home
        </button>
      </div>
    );
  }

  async function handleSaveVerifiedCollege(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.email) return;
    const safeId = `col_${newColCode.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    const record: CollegeRecord = {
      id: safeId,
      code: newColCode.trim().toUpperCase(),
      name: newColName.trim(),
      location: newColLocation.trim() || newColDistrict,
      district: newColDistrict,
      address: newColAddr.trim(),
      management: newColMgmt,
      category: newColCat,
      affiliatedUniversity: newColUniv.trim(),
      accreditation: newColAccr.trim(),
      website: newColWebsite.trim(),
      contactEmail: newColEmail.trim() || 'Pending institutional verification',
      contactPhone: newColPhone.trim() || 'Pending institutional verification',
      verificationStatus: newColStatus,
      integrationStatus: 'Requires Integration',
      sourceUrl: newColSourceUrl.trim(),
      lastVerifiedDate: newColLastVerified.trim() || new Date().toISOString().slice(0, 10),
      isDemo: newColStatus === 'DEMO',
      coursesCount: 4,
      adminEmails: [],
    };

    await upsertVerifiedCollegeByStateAdmin({
      college: record,
      adminUid: user.uid,
      adminEmail: user.email,
    });

    try {
      const token = await getToken();
      await fetch('/api/colleges', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(record),
      });
    } catch {
      // Firestore save already succeeded
    }

    setColSaveFeedback(`College ${record.code} saved to live Firestore and directory API.`);
    setNewColCode('');
    setNewColName('');
    setNewColLocation('');
    setNewColAddr('');
    setNewColUniv('');
    setNewColAccr('');
    setNewColWebsite('');
    setNewColEmail('');
    setNewColPhone('');
    setNewColSourceUrl('');
  }

  function handleDownloadTemplateCsv() {
    const csv = buildCollegeImportTemplateCsv();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ash_ap_college_import_template.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleBulkCsvFile(file: File | null) {
    if (!file) return;
    const text = await file.text();
    setBulkCsvText(text);
  }

  async function handleBulkImportColleges(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.email || !bulkCsvText.trim()) return;
    setBulkImporting(true);
    setBulkFeedback(null);
    setBulkError(null);
    try {
      const token = await getToken();
      const res = await fetch('/api/colleges/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ csvText: bulkCsvText }),
      });
      const data = (await res.json()) as {
        imported?: number;
        skippedDuplicates?: number;
        invalidRows?: number;
        items?: CollegeRecord[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || 'Bulk college import failed.');
      }

      if (data.items && data.items.length > 0) {
        await batchImportCollegesByStateAdmin({
          colleges: data.items,
          adminUid: user.uid,
          adminEmail: user.email,
        });
      }

      setBulkFeedback(
        `Imported ${data.imported || 0} institution(s) · Skipped ${data.skippedDuplicates || 0} duplicate(s) · ${data.invalidRows || 0} invalid row(s).`
      );
      setBulkCsvText('');
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : 'Bulk CSV import failed.');
    } finally {
      setBulkImporting(false);
    }
  }

  async function handleDownloadBackup() {
    setBackupFeedback(null);
    const token = await getToken();
    const res = await fetch('/api/admin/backup', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) return;
    const data = await res.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ash-state-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setBackupFeedback('Platform backup JSON downloaded.');
  }

  async function handlePublishBroadcast(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.email) return;
    await createStateAnnouncement({
      title: stateTitle,
      message: stateMsg,
      category: stateCat,
      adminUid: user.uid,
      adminEmail: user.email,
    });
    setStateTitle('');
    setStateMsg('');
    setBroadcastFeedback('Statewide announcement published to all Student Dashboards.');
  }

  async function handleSaveScholarship(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.email) return;
    const id = `sch_${Date.now()}`;
    await upsertScholarshipByStateAdmin({
      scholarship: {
        id,
        title: schTitle.trim(),
        provider: schProvider.trim(),
        category: schCategory,
        amountLabel: schAmount.trim(),
        eligibilitySummary: schElig.trim(),
        deadlineLabel: schDeadline.trim(),
        officialPortalUrl: schUrl.trim(),
        isDemo: false,
        active: true,
      },
      adminUid: user.uid,
      adminEmail: user.email,
    });
    setSchTitle('');
    setSchProvider('');
    setSchAmount('');
    setSchElig('');
    setSchDeadline('');
    setSchFeedback('Scholarship scheme published.');
  }

  const tabs: { id: StateTab; label: string; icon: React.ReactNode }[] = [
    { id: 'stats', label: 'District Statistics', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'colleges', label: 'Verified Colleges', icon: <Building2 className="w-4 h-4" /> },
    { id: 'media', label: 'Photo Coverage & Review', icon: <Camera className="w-4 h-4" /> },
    { id: 'admins', label: 'College Admins', icon: <ShieldCheck className="w-4 h-4" /> },
    { id: 'grievances', label: 'Grievance Monitor', icon: <Scale className="w-4 h-4" /> },
    { id: 'broadcasts', label: 'Notices & Scholarships', icon: <Bell className="w-4 h-4" /> },
    { id: 'integrations', label: 'ERP Monitor & Backups', icon: <Database className="w-4 h-4" /> },
    { id: 'audit', label: 'Audit Logs', icon: <Activity className="w-4 h-4" /> },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-5 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <div className="text-xs font-mono text-amber-700 dark:text-amber-400 font-semibold">
            Andhra Pradesh State Oversight · {user.email}
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">
            State Admin Console
          </h1>
        </div>
        <div className="flex flex-wrap gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md cursor-pointer whitespace-nowrap shrink-0 transition-colors ash-btn-press ${
                tab === t.id
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        >
      {/* TAB 1: DISTRICT STATISTICS */}
      {tab === 'stats' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 ash-card-interactive">
              <div className="text-xs text-slate-500 dark:text-slate-400">Directory Entries (Demo + Live)</div>
              <div className="font-mono text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums mt-1">
                {DEMO_COLLEGES.length + colleges.length}
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 ash-card-interactive">
              <div className="text-xs text-slate-500 dark:text-slate-400">Registered Students</div>
              <div className="font-mono text-2xl font-bold text-[#1E40AF] dark:text-blue-400 tabular-nums mt-1">
                {students.length}
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 ash-card-interactive">
              <div className="text-xs text-slate-500 dark:text-slate-400">Active College Admins</div>
              <div className="font-mono text-2xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums mt-1">
                {collegeAdmins.filter((a) => a.active).length}
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 ash-card-interactive">
              <div className="text-xs text-slate-500 dark:text-slate-400">Statewide Grievances</div>
              <div className="font-mono text-2xl font-bold text-amber-700 dark:text-amber-400 tabular-nums mt-1">
                {grievances.length}
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <div>
              <h2 className="font-display font-bold text-slate-900 dark:text-slate-100">
                District-wise Directory & Activity Distribution (Top 14 Districts Shown)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Counts combine demo institution registry with live Firestore student and grievance
                records.
              </p>
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={districtChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
                  <XAxis dataKey="district" tick={{ fontSize: 11, fill: chartTickFill }} />
                  <YAxis tick={{ fontSize: 11, fill: chartTickFill }} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Bar
                    dataKey="colleges"
                    name="Colleges"
                    fill={isDark ? '#60A5FA' : '#1E40AF'}
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="students"
                    name="Students"
                    fill={isDark ? '#4ADE80' : '#15803D'}
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="grievances"
                    name="Grievances"
                    fill={isDark ? '#FBBF24' : '#D97706'}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: VERIFIED COLLEGES */}
      {tab === 'colleges' && (
        <div className="space-y-6">
          {colSaveFeedback && (
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-800 dark:text-emerald-300">
              {colSaveFeedback}
            </div>
          )}

          <form
            onSubmit={handleSaveVerifiedCollege}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4"
          >
            <h2 className="font-display font-bold text-slate-900 dark:text-slate-100">
              Import / Verify Official Andhra Pradesh College Record
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <input
                type="text"
                required
                value={newColCode}
                onChange={(e) => setNewColCode(e.target.value)}
                placeholder="Official Code (e.g., AP-INST-001)"
                className="px-3 py-2 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 border border-slate-300 dark:border-slate-700 rounded-lg font-mono"
              />
              <input
                type="text"
                required
                value={newColName}
                onChange={(e) => setNewColName(e.target.value)}
                placeholder="Official Institution Name"
                className="lg:col-span-2 px-3 py-2 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <input
                type="text"
                value={newColLocation}
                onChange={(e) => setNewColLocation(e.target.value)}
                placeholder="City / Town (e.g., Gudur, Nellore)"
                className="px-3 py-2 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <select
                value={newColDistrict}
                onChange={(e) => setNewColDistrict(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              >
                {AP_DISTRICTS.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
              <select
                value={newColMgmt}
                onChange={(e) => setNewColMgmt(e.target.value as CollegeRecord['management'])}
                className="px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              >
                <option value="Government">Government</option>
                <option value="Private Aided">Private Aided</option>
                <option value="Private Un-aided">Private Un-aided</option>
                <option value="Autonomous">Autonomous</option>
              </select>
              <select
                value={newColCat}
                onChange={(e) => setNewColCat(e.target.value as CollegeCategory)}
                className="px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              >
                <option value="Engineering & Technology">Engineering & Technology</option>
                <option value="Degree & PG">Degree & PG</option>
                <option value="University Campus">University Campus</option>
                <option value="Polytechnic & Technical">Polytechnic & Technical</option>
              </select>
              <select
                value={newColStatus}
                onChange={(e) =>
                  setNewColStatus(e.target.value as CollegeRecord['verificationStatus'])
                }
                className="px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              >
                <option value="Verified">Verified</option>
                <option value="Pending Verification">Pending Verification</option>
                <option value="DEMO">DEMO</option>
              </select>
              <input
                type="text"
                required
                value={newColUniv}
                onChange={(e) => setNewColUniv(e.target.value)}
                placeholder="Affiliated University"
                className="px-3 py-2 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <input
                type="text"
                required
                value={newColAccr}
                onChange={(e) => setNewColAccr(e.target.value)}
                placeholder="Accreditation (e.g., NAAC / NBA)"
                className="px-3 py-2 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <input
                type="text"
                required
                value={newColAddr}
                onChange={(e) => setNewColAddr(e.target.value)}
                placeholder="Campus Street Address"
                className="lg:col-span-2 px-3 py-2 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <input
                type="url"
                value={newColWebsite}
                onChange={(e) => setNewColWebsite(e.target.value)}
                placeholder="Official Website (https://...)"
                className="px-3 py-2 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <input
                type="text"
                value={newColEmail}
                onChange={(e) => setNewColEmail(e.target.value)}
                placeholder="Official Contact Email"
                className="px-3 py-2 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <input
                type="text"
                value={newColPhone}
                onChange={(e) => setNewColPhone(e.target.value)}
                placeholder="Official Contact Phone"
                className="px-3 py-2 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <input
                type="url"
                value={newColSourceUrl}
                onChange={(e) => setNewColSourceUrl(e.target.value)}
                placeholder="Verification Source URL"
                className="px-3 py-2 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <input
                type="date"
                value={newColLastVerified}
                onChange={(e) => setNewColLastVerified(e.target.value)}
                className="px-3 py-2 text-sm font-mono bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-[#1E40AF] dark:bg-blue-600 rounded-lg hover:bg-[#1E3A8A] dark:hover:bg-blue-500 cursor-pointer"
            >
              Save College to Firestore & Directory API
            </button>
          </form>

          {/* Bulk CSV College Import with Deduplication */}
          <form
            onSubmit={handleBulkImportColleges}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-[#1E40AF] dark:text-blue-400" />
                  Bulk CSV / Excel College Import (Auto-Deduplicated)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Import AP degree &amp; engineering colleges exported from Excel as CSV. Duplicate college codes or name+district entries are automatically skipped.
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownloadTemplateCsv}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Download CSV Template
              </button>
            </div>

            {bulkFeedback && (
              <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-800 dark:text-emerald-300">
                {bulkFeedback}
              </div>
            )}
            {bulkError && (
              <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
                {bulkError}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 text-xs">
              <label className="inline-flex items-center gap-2 px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-200">
                <Upload className="w-3.5 h-3.5" />
                <span>Upload .csv file</span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => handleBulkCsvFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>
              <span className="text-slate-500 dark:text-slate-400">
                Or paste CSV rows directly below (first line must be headers).
              </span>
            </div>

            <textarea
              rows={5}
              value={bulkCsvText}
              onChange={(e) => setBulkCsvText(e.target.value)}
              placeholder="code,name,location,district,address,management,category,affiliated_university,accreditation,official_website,contact_email,contact_phone,verification_status,source_url"
              className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
            <button
              type="submit"
              disabled={bulkImporting || !bulkCsvText.trim()}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-slate-700 rounded-lg hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
            >
              {bulkImporting ? 'Importing & Deduplicating...' : 'Import Colleges to Directory & Firestore'}
            </button>
          </form>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 font-display font-bold text-slate-900 dark:text-slate-100">
              Live Firestore Managed Colleges ({colleges.length})
            </div>
            {colleges.length === 0 ? (
              <div className="p-6 text-sm text-slate-500 dark:text-slate-400">
                No custom colleges imported into Firestore yet. Directory displays the 426 built-in entries (26 verified + 400 DEMO) until additional verified records are imported above.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {colleges.map((c) => (
                  <div key={c.id} className="px-6 py-3.5 flex justify-between items-center text-sm">
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {c.code} · {c.name}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {c.district} · {c.affiliatedUniversity} · Admins:{' '}
                        {c.adminEmails.join(', ') || 'None'}
                      </div>
                    </div>
                    <span className="font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                      {c.verificationStatus}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2B: STATEWIDE 400+ COLLEGE PHOTO COVERAGE & MODERATION */}
      {tab === 'media' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">Total Colleges</div>
              <div className="font-mono text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums mt-1">
                {coverageStats.totalColleges}
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">With Official Photos</div>
              <div className="font-mono text-2xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums mt-1">
                {coverageStats.withPhotos}
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">With Student Activity</div>
              <div className="font-mono text-2xl font-bold text-[#5B21B6] dark:text-violet-400 tabular-nums mt-1">
                {coverageStats.withStudentActivity}
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">Needs Official Photos</div>
              <div className="font-mono text-2xl font-bold text-amber-700 dark:text-amber-400 tabular-nums mt-1">
                {coverageStats.needingPhotos}
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">Pending Review Queue</div>
              <div className="font-mono text-2xl font-bold text-[#1E40AF] dark:text-blue-400 tabular-nums mt-1">
                {coverageStats.pendingSubmissions}
              </div>
            </div>
          </div>

          {mediaReviewFeedback && (
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-800 dark:text-emerald-300">
              {mediaReviewFeedback}
            </div>
          )}

          {/* Review & Verification Queue */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h2 className="font-display font-bold text-slate-900 dark:text-slate-100">
                  College Admin Photograph Verification Queue ({filteredMediaQueue.length})
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Verify exact college match, official source, licence permission, and ensure zero unauthorized student PII before approving.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {(['Pending Approval', 'Approved', 'Rejected', 'All'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setMediaStatusFilter(st)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer ${
                      mediaStatusFilter === st
                        ? 'bg-[#1E40AF] text-white border-[#1E40AF]'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={mediaSearch}
                onChange={(e) => setMediaSearch(e.target.value)}
                placeholder="Filter queue by college code, college name, category, or district..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
              />
            </div>

            {filteredMediaQueue.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                No uploaded photographs match this filter. Public Commons seed photographs ({coverageStats.totalSeededVerifiedPhotos}) are active and monitored in the coverage table below.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {filteredMediaQueue.map((m) => (
                  <div
                    key={m.id}
                    className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-slate-50/50 dark:bg-slate-950/60 flex flex-col justify-between"
                  >
                    <InstitutionalPhotoFrame
                      src={m.imageUrl}
                      alt={`${m.collegeName} - ${m.title}`}
                      aspectClass="aspect-[16/10]"
                      categoryLabel={m.mediaCategory}
                      collegeName={`${m.collegeCode} · ${m.district}`}
                      isVerified={m.approvalStatus === 'Approved'}
                      compact
                    />
                    <div className="p-4 space-y-2.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-bold text-[#1E40AF] dark:text-blue-400">
                          {m.collegeCode} · {m.collegeName}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded font-semibold shrink-0 ${
                            m.approvalStatus === 'Approved'
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                              : m.approvalStatus === 'Rejected'
                                ? 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300'
                                : 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                          }`}
                        >
                          {m.approvalStatus}
                        </span>
                      </div>
                      <div className="font-display font-bold text-sm text-slate-900 dark:text-slate-100">
                        {m.title}
                      </div>
                      <p className="text-slate-600 dark:text-slate-300">{m.caption}</p>
                      <div className="space-y-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                        <div>Uploaded by: {m.uploadedByEmail} · {m.width}×{m.height}px ({Math.round(m.sizeBytes / 1024)} KB)</div>
                        <div>Licence: {m.licenseOrPermission} · Consent Attested: {m.consentAttested ? 'Yes' : 'No'}</div>
                        <div className="truncate">
                          Source:{' '}
                          {m.sourceUrl.startsWith('http') ? (
                            <a
                              href={m.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[#1E40AF] dark:text-blue-400 hover:underline"
                            >
                              {m.sourceUrl} <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="font-mono">{m.sourceUrl}</span>
                          )}
                        </div>
                      </div>

                      <input
                        type="text"
                        value={mediaRemarkDrafts[m.id] ?? m.reviewRemark ?? ''}
                        onChange={(e) =>
                          setMediaRemarkDrafts((prev) => ({ ...prev, [m.id]: e.target.value }))
                        }
                        placeholder="Verification remark or rejection reason..."
                        className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                      />

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={async () => {
                            if (!user?.email) return;
                            await reviewCollegeMediaByStateAdmin({
                              media: m,
                              decision: 'Approved',
                              reviewRemark: mediaRemarkDrafts[m.id] || '',
                              reviewerUid: user.uid,
                              reviewerEmail: user.email,
                            });
                            setMediaReviewFeedback(
                              `Approved "${m.title}" for ${m.collegeCode} (${m.collegeName}).`
                            );
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-emerald-700 text-white rounded-lg hover:bg-emerald-600 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Approve &amp; Publish
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!user?.email) return;
                            await reviewCollegeMediaByStateAdmin({
                              media: m,
                              decision: 'Rejected',
                              reviewRemark:
                                mediaRemarkDrafts[m.id] ||
                                'Photograph rejected: mismatched college, unclear source, or PII present.',
                              reviewerUid: user.uid,
                              reviewerEmail: user.email,
                            });
                            setMediaReviewFeedback(
                              `Rejected "${m.title}" submitted for ${m.collegeCode}.`
                            );
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-lg hover:bg-amber-100 cursor-pointer"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Reject
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!user?.email) return;
                            await deleteCollegeMediaRecord({
                              media: m,
                              actorUid: user.uid,
                              actorEmail: user.email,
                              actorRole: 'state_admin',
                            });
                            setMediaReviewFeedback(`Removed media entry "${m.title}".`);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg cursor-pointer ml-auto"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 400+ College Coverage Audit Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="font-display font-bold text-slate-900 dark:text-slate-100">
                    Statewide Photograph Coverage Audit ({filteredCoverageColleges.length} of {coverageStats.totalColleges} Institutions)
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Identify every college across Andhra Pradesh that still requires official college-supplied photographs.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="md:col-span-2 relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={coverageSearch}
                    onChange={(e) => {
                      setCoverageSearch(e.target.value);
                      setCoveragePage(1);
                    }}
                    placeholder="Search college code, institution name, city..."
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  />
                </div>
                <select
                  value={coverageDistrict}
                  onChange={(e) => {
                    setCoverageDistrict(e.target.value);
                    setCoveragePage(1);
                  }}
                  className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                >
                  <option value="All">All Districts (26)</option>
                  {AP_DISTRICTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                <select
                  value={coverageFilter}
                  onChange={(e) => {
                    setCoverageFilter(
                      e.target.value as 'all' | 'needs_photos' | 'has_photos' | 'has_activity'
                    );
                    setCoveragePage(1);
                  }}
                  className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                >
                  <option value="all">All Coverage States</option>
                  <option value="needs_photos">Needs Official Photographs</option>
                  <option value="has_photos">Has Verified Photos</option>
                  <option value="has_activity">Has Student Activity Photos</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Code</th>
                    <th className="px-4 py-3 font-semibold">Institution &amp; District</th>
                    <th className="px-4 py-3 font-semibold">Registry</th>
                    <th className="px-4 py-3 font-semibold">Verified Photos</th>
                    <th className="px-4 py-3 font-semibold">Student Activity</th>
                    <th className="px-4 py-3 font-semibold">Coverage Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {paginatedCoverageColleges.map((col) => {
                    const summary = mediaSummaryMap[col.id];
                    const photoCount = summary?.totalApprovedCount || 0;
                    const actCount = summary?.studentActivityPhotos.length || 0;
                    return (
                      <tr key={col.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-3 font-mono font-bold text-[#1E40AF] dark:text-blue-400">
                          {col.code}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900 dark:text-slate-100">{col.name}</div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {col.location || col.district} · {col.district}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-300">
                          {col.verificationStatus}
                        </td>
                        <td className="px-4 py-3 font-mono font-semibold text-slate-900 dark:text-slate-100">
                          {photoCount}
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-700 dark:text-slate-300">
                          {actCount}
                        </td>
                        <td className="px-4 py-3">
                          {photoCount > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-semibold">
                              <CheckCircle2 className="w-3 h-3" /> Verified Photos Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-semibold">
                              Needs Official Photographs
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {coverageTotalPages > 1 && (
              <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                <span>
                  Page {safeCoveragePage} of {coverageTotalPages}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={safeCoveragePage <= 1}
                    onClick={() => setCoveragePage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-md disabled:opacity-40 cursor-pointer"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={safeCoveragePage >= coverageTotalPages}
                    onClick={() => setCoveragePage((p) => Math.min(coverageTotalPages, p + 1))}
                    className="px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-md disabled:opacity-40 cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: COLLEGE ADMINISTRATORS */}
      {tab === 'admins' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 font-display font-bold text-slate-900 dark:text-slate-100">
            College Administrator Requests & Assignments ({collegeAdmins.length})
          </div>
          {collegeAdmins.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
              No College Administrator requests submitted yet. Representatives can request access via
              the Sign-In modal.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {collegeAdmins.map((ca) => {
                const baseCol = DEMO_COLLEGES.find((d) => d.id === ca.collegeId);
                return (
                  <div
                    key={ca.uid}
                    className="px-6 py-4 flex flex-wrap items-center justify-between gap-4 text-sm"
                  >
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {ca.fullName} ({ca.designation})
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {ca.email} · {ca.collegeCode} — {ca.collegeName}
                      </div>
                      <div className="text-xs font-mono text-slate-700 dark:text-slate-300 mt-1">
                        Status: <span className="font-semibold uppercase">{ca.status}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          user?.email &&
                          approveOrRevokeCollegeAdmin({
                            collegeAdmin: ca,
                            decision: 'active',
                            stateAdminUid: user.uid,
                            stateAdminEmail: user.email,
                            baseCollege: baseCol,
                          })
                        }
                        className="px-3 py-1.5 text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/60 cursor-pointer"
                      >
                        Approve & Activate
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          user?.email &&
                          approveOrRevokeCollegeAdmin({
                            collegeAdmin: ca,
                            decision: 'revoked',
                            stateAdminUid: user.uid,
                            stateAdminEmail: user.email,
                            baseCollege: baseCol,
                          })
                        }
                        className="px-3 py-1.5 text-xs font-semibold bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/60 cursor-pointer"
                      >
                        Revoke
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: STATEWIDE GRIEVANCE MONITOR */}
      {tab === 'grievances' && (
        <div className="space-y-4">
          {grievances.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center text-sm text-slate-500 dark:text-slate-400">
              No grievances recorded across the platform yet.
            </div>
          ) : (
            grievances.map((g) => (
              <div
                key={g.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-2.5 ash-card-interactive"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-mono font-bold text-[#1E40AF] dark:text-blue-400">
                    {g.trackingNumber} · {g.collegeName} ({g.district})
                  </span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {g.status} · {g.escalationLevel} · AI Urgency: {g.aiUrgency}
                  </span>
                </div>
                <div className="font-display font-bold text-slate-900 dark:text-slate-100">{g.subject}</div>
                <p className="text-xs text-slate-600 dark:text-slate-300">{g.description}</p>
                <div className="flex flex-wrap gap-2 pt-2">
                  {(
                    ['Under College Review', 'Escalated to University/State', 'Resolved', 'Closed'] as GrievanceRecord['status'][]
                  ).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() =>
                        user?.email &&
                        updateGrievanceByAdmin({
                          grievanceId: g.id,
                          collegeId: g.collegeId,
                          status: st,
                          escalationLevel: 'State Oversight',
                          resolutionNotes: `State Admin updated status to ${st}.`,
                          adminUid: user.uid,
                          adminEmail: user.email,
                          actorRole: 'state_admin',
                          studentUid: g.studentUid,
                          trackingNumber: g.trackingNumber,
                          subject: g.subject,
                          collegeAdminEmails: g.collegeAdminEmails,
                        })
                      }
                      className="px-3 py-1 text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 rounded cursor-pointer"
                    >
                      Set {st}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 5: PLATFORM ANNOUNCEMENTS & SCHOLARSHIPS */}
      {tab === 'broadcasts' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <form
            onSubmit={handlePublishBroadcast}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4"
          >
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-[#1E40AF] dark:text-blue-400" />
              <h2 className="font-display font-bold text-slate-900 dark:text-slate-100">
                Publish Platform Announcement
              </h2>
            </div>
            {broadcastFeedback && (
              <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-800 dark:text-emerald-300">
                {broadcastFeedback}
              </div>
            )}
            <select
              value={stateCat}
              onChange={(e) => setStateCat(e.target.value as NotificationRecord['category'])}
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
            >
              <option>Announcement</option>
              <option>Scholarship</option>
              <option>Exam Update</option>
              <option>NPTEL</option>
            </select>
            <input
              type="text"
              required
              value={stateTitle}
              onChange={(e) => setStateTitle(e.target.value)}
              placeholder="Announcement Title"
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
            <textarea
              rows={3}
              required
              value={stateMsg}
              onChange={(e) => setStateMsg(e.target.value)}
              placeholder="Broadcast message to all AP students..."
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-[#1E40AF] dark:bg-blue-600 rounded-lg hover:bg-[#1E3A8A] dark:hover:bg-blue-500 cursor-pointer"
            >
              Publish Statewide Notice
            </button>
          </form>

          <form
            onSubmit={handleSaveScholarship}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-3.5"
          >
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-[#D97706] dark:text-amber-400" />
              <h2 className="font-display font-bold text-slate-900 dark:text-slate-100">
                Add Verified Scholarship Scheme
              </h2>
            </div>
            {schFeedback && (
              <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-800 dark:text-emerald-300">
                {schFeedback}
              </div>
            )}
            <input
              type="text"
              required
              value={schTitle}
              onChange={(e) => setSchTitle(e.target.value)}
              placeholder="Scholarship Title"
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                required
                value={schProvider}
                onChange={(e) => setSchProvider(e.target.value)}
                placeholder="Department / Provider"
                className="px-3 py-2 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <input
                type="text"
                required
                value={schAmount}
                onChange={(e) => setSchAmount(e.target.value)}
                placeholder="Support Amount Label"
                className="px-3 py-2 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                required
                value={schCategory}
                onChange={(e) => setSchCategory(e.target.value)}
                placeholder="Category"
                className="px-3 py-2 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <input
                type="text"
                required
                value={schDeadline}
                onChange={(e) => setSchDeadline(e.target.value)}
                placeholder="Deadline Label"
                className="px-3 py-2 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <input
              type="url"
              required
              value={schUrl}
              onChange={(e) => setSchUrl(e.target.value)}
              placeholder="Official Portal URL"
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
            <textarea
              rows={2}
              required
              value={schElig}
              onChange={(e) => setSchElig(e.target.value)}
              placeholder="Eligibility Summary"
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-slate-700 rounded-lg hover:bg-slate-800 dark:hover:bg-slate-600 cursor-pointer"
            >
              Publish Scholarship Scheme
            </button>
          </form>
        </div>
      )}

      {/* TAB 6: ERP MONITOR & PLATFORM BACKUPS */}
      {tab === 'integrations' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-display font-bold text-slate-900 dark:text-slate-100">
                Statewide College ERP Integration Status
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {integCounts.connectedCount} Connected / Read-Only Sync · {integCounts.totalConfigured} Configured Adapters (Only institutions with written authorization are connected).
              </p>
              {backupFeedback && (
                <div className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">{backupFeedback}</div>
              )}
            </div>
            <button
              type="button"
              onClick={handleDownloadBackup}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#1E40AF] dark:bg-blue-600 rounded-lg hover:bg-[#1E3A8A] cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Download Platform Backup (JSON)
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 font-display font-bold text-sm text-slate-900 dark:text-slate-100">
              Institution Integration Matrix (Top 60 Entries Shown)
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3 font-semibold">College</th>
                    <th className="px-4 py-3 font-semibold">Adapter</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Auth Ref</th>
                    <th className="px-4 py-3 font-semibold">Last Sync</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {integrations.map((item) => (
                    <tr key={item.collegeId} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-[#1E40AF] dark:text-blue-400">
                          {item.collegeCode}
                        </span>{' '}
                        · <span className="text-slate-900 dark:text-slate-100">{item.collegeName}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-700 dark:text-slate-300">
                        {item.adapterType} {item.readOnlySync ? '(RO)' : ''}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">
                        {item.status}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-500 dark:text-slate-400">
                        {item.authorizationRef || 'Pending'}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-500 dark:text-slate-400">
                        {item.lastSyncAt ? item.lastSyncAt.slice(0, 19).replace('T', ' ') : item.lastSyncStatus}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {integrationLogs.length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 font-display font-bold text-sm text-slate-900 dark:text-slate-100">
                Recent Synchronization Logs ({integrationLogs.length})
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {integrationLogs.map((log) => (
                  <div key={log.id} className="px-6 py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div>
                      <span className="font-mono font-bold text-[#1E40AF] dark:text-blue-400">{log.collegeCode}</span> ·{' '}
                      <span className="text-slate-700 dark:text-slate-300">{log.summary}</span>
                    </div>
                    <span className="font-mono text-slate-500 dark:text-slate-400">
                      {log.actorEmail} · {log.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 7: AUDIT LOGS */}
      {tab === 'audit' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 font-display font-bold text-slate-900 dark:text-slate-100">
            Immutable Platform Audit Logs ({auditLogs.length})
          </div>
          {auditLogs.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
              Audit events appear here automatically as users register, verify profiles, and update
              grievances.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="px-6 py-3 flex flex-wrap items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{log.action}</span> ·{' '}
                    <span className="text-slate-700 dark:text-slate-300">{log.summary}</span>
                  </div>
                  <span className="font-mono text-slate-500 dark:text-slate-400">
                    {log.actorEmail} ({log.actorRole})
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
