import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import {
  AlertTriangle,
  Award,
  Bell,
  BellRing,
  BookOpen,
  Briefcase,
  Building2,
  Camera,
  Check,
  CheckCircle2,
  CreditCard,
  Download,
  ExternalLink,
  GraduationCap,
  Home,
  IndianRupee,
  LogOut,
  Mail,
  Receipt,
  Scale,
  TrendingUp,
  Upload,
  User,
  X,
} from 'lucide-react';
import {
  CAREER_OPPORTUNITIES,
  DEMO_COLLEGES,
  DEMO_EXAM_UPDATES,
} from '../data/demoColleges.ts';
import { buildCollegeMediaSummaryMap } from '../data/verifiedCollegeMedia.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { db, handleFirestoreError, OperationType } from '../lib/firebase.ts';
import {
  createDemoFeeSampleForStudent,
  createGrievanceWithEvidence,
  escalateGrievanceByStudent,
  reportFeeDiscrepancy,
  updateStudentSelfProfile,
} from '../lib/firestoreService.ts';
import {
  generateFeeReceiptPdf,
  generateGrievanceSummaryPdf,
} from '../lib/pdfGenerator.ts';
import {
  dispatchBrowserPushNotification,
  getBrowserNotificationPermission,
  loadSeenStatusSnapshots,
  loadStoredPushAlerts,
  loadStudentPushPreferences,
  requestBrowserNotificationPermission,
  saveSeenStatusSnapshots,
  saveStoredPushAlerts,
  saveStudentPushPreferences,
  type BrowserNotificationPermissionState,
  type StudentPushAlert,
  type StudentPushPreferences,
} from '../lib/pushNotifications.ts';
import { DigitalIdCard } from './DigitalIdCard.tsx';
import {
  FeeReceiptPreview,
  type FeeReceiptPreviewTarget,
} from './FeeReceiptPreview.tsx';
import { PaymentHistorySection } from './PaymentHistorySection.tsx';
import { AcademicProgressBar } from './academics/AcademicProgressBar.tsx';
import { InstitutionalPhotoFrame } from './InstitutionalPhotoFrame.tsx';
import { StudentAcademicSuite } from './StudentAcademicSuite.tsx';
import { StudentCampusServicesSuite } from './StudentCampusServicesSuite.tsx';
import { StudentCareerSuite } from './StudentCareerSuite.tsx';
import type {
  AcademicSubjectRecord,
  CollegeIntegrationRecord,
  CollegeMediaRecord,
  CollegeRecord,
  CollegeServiceRecord,
  CourseRecord,
  DepartmentRecord,
  FeePayment,
  FeeRecord,
  GrievanceEvidenceRecord,
  GrievanceRecord,
  NotificationRecord,
  PlacementApplicationRecord,
  PlacementOpportunityRecord,
  ScholarshipApplicationRecord,
  StudentResumeRecord,
  TimetableSlotRecord,
} from '../types.ts';
import type { AppView } from './Navbar.tsx';

type StudentTab =
  | 'overview'
  | 'digital_id'
  | 'academics'
  | 'campus_services'
  | 'placements'
  | 'fees'
  | 'payment_history'
  | 'grievances'
  | 'scholarships'
  | 'careers'
  | 'notifications';

interface StudentDashboardViewProps {
  onNavigate: (view: AppView) => void;
  onOpenAuth: () => void;
}

const GRIEVANCE_CATEGORIES = [
  'Academic',
  'Fee & Scholarship',
  'Hostel & Campus',
  'Examination',
  'Harassment & Safety',
  'Infrastructure',
  'Document Verification',
];

export function StudentDashboardView({ onNavigate, onOpenAuth }: StudentDashboardViewProps) {
  const { user, authReady, studentProfile, isActiveCollegeAdmin, isStateAdmin, signOut, getToken } =
    useAuth();

  const [tab, setTab] = useState<StudentTab>('overview');
  const [feeRecords, setFeeRecords] = useState<FeeRecord[]>([]);
  const [feePayments, setFeePayments] = useState<FeePayment[]>([]);
  const [grievances, setGrievances] = useState<GrievanceRecord[]>([]);
  const [evidences, setEvidences] = useState<GrievanceEvidenceRecord[]>([]);
  const [scholarshipApps, setScholarshipApps] = useState<ScholarshipApplicationRecord[]>([]);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [collegeDepartments, setCollegeDepartments] = useState<DepartmentRecord[]>([]);
  const [collegeCourses, setCollegeCourses] = useState<CourseRecord[]>([]);
  const [collegeDetail, setCollegeDetail] = useState<CollegeRecord | null>(null);
  const [collegeIntegration, setCollegeIntegration] = useState<CollegeIntegrationRecord | null>(null);
  const [approvedCollegeMedia, setApprovedCollegeMedia] = useState<CollegeMediaRecord[]>([]);
  const [academicRecords, setAcademicRecords] = useState<AcademicSubjectRecord[]>([]);
  const [timetableSlots, setTimetableSlots] = useState<TimetableSlotRecord[]>([]);
  const [placementOpportunities, setPlacementOpportunities] = useState<PlacementOpportunityRecord[]>([]);
  const [placementApplications, setPlacementApplications] = useState<PlacementApplicationRecord[]>([]);
  const [studentResume, setStudentResume] = useState<StudentResumeRecord | null>(null);
  const [collegeServices, setCollegeServices] = useState<CollegeServiceRecord[]>([]);
  const [careerTrackFilter, setCareerTrackFilter] = useState('All');
  const [loadingData, setLoadingData] = useState(true);

  // Profile edit & OTP verification state
  const [editingProfile, setEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editMobile, setEditMobile] = useState('');
  const [editRollId, setEditRollId] = useState('');
  const [editCourse, setEditCourse] = useState('');
  const [editBranch, setEditBranch] = useState('');
  const [editYear, setEditYear] = useState('');
  const [editAdmissionYear, setEditAdmissionYear] = useState('');
  const [editCollegeEmail, setEditCollegeEmail] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);

  const [otpInput, setOtpInput] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpHint, setOtpHint] = useState<string | null>(null);
  const [otpStatusMsg, setOtpStatusMsg] = useState<string | null>(null);
  const [otpBusy, setOtpBusy] = useState(false);

  // Fee receipt & grievance preview state
  const [previewTarget, setPreviewTarget] = useState<FeeReceiptPreviewTarget | null>(null);
  const [discrepancyTarget, setDiscrepancyTarget] = useState<FeeRecord | null>(null);
  const [discrepancyNote, setDiscrepancyNote] = useState('');
  const [feeActionMsg, setFeeActionMsg] = useState<string | null>(null);

  // Grievance submission state
  const [gCategory, setGCategory] = useState('Academic');
  const [gSubject, setGSubject] = useState('');
  const [gDescription, setGDescription] = useState('');
  const [gMobile, setGMobile] = useState('');
  const [gEscalation, setGEscalation] = useState<GrievanceRecord['escalationLevel']>('College Nodal Officer');
  const [gFile, setGFile] = useState<File | null>(null);
  const [aiTriage, setAiTriage] = useState<{
    suggestedCategory: string;
    urgency: GrievanceRecord['aiUrgency'];
    suggestedEscalation: GrievanceRecord['escalationLevel'];
    triageSummary: string;
    evidenceAssistNote: string;
    verificationDisclaimer: string;
  } | null>(null);
  const [analyzingAi, setAnalyzingAi] = useState(false);
  const [submittingGrievance, setSubmittingGrievance] = useState(false);
  const [grievanceFeedback, setGrievanceFeedback] = useState<string | null>(null);
  const [grievanceError, setGrievanceError] = useState<string | null>(null);

  // Push notification state & refs
  const [pushPrefs, setPushPrefs] = useState<StudentPushPreferences>({
    browserEnabled: true,
    scholarshipAlerts: true,
    grievanceAlerts: true,
  });
  const [pushPermission, setPushPermission] = useState<BrowserNotificationPermissionState>(() =>
    getBrowserNotificationPermission()
  );
  const [pushAlerts, setPushAlerts] = useState<StudentPushAlert[]>([]);
  const [activeToasts, setActiveToasts] = useState<StudentPushAlert[]>([]);
  const [notificationFilter, setNotificationFilter] = useState<
    'All' | 'Scholarship' | 'Grievance Update' | 'Announcement'
  >('All');

  const pushPrefsRef = useRef(pushPrefs);
  pushPrefsRef.current = pushPrefs;
  const seenSnapshotsRef = useRef<{
    grievances: Record<string, string>;
    scholarships: Record<string, string>;
  }>({ grievances: {}, scholarships: {} });
  const toastTimersRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!user?.uid) return;
    setPushPrefs(loadStudentPushPreferences(user.uid));
    setPushAlerts(loadStoredPushAlerts(user.uid));
    seenSnapshotsRef.current = loadSeenStatusSnapshots(user.uid);
    setPushPermission(getBrowserNotificationPermission());
  }, [user?.uid]);

  useEffect(() => {
    return () => {
      Object.values(toastTimersRef.current).forEach((timerId) => window.clearTimeout(timerId));
      toastTimersRef.current = {};
    };
  }, []);

  const dismissToast = useCallback((alertId: string) => {
    setActiveToasts((prev) => prev.filter((t) => t.id !== alertId));
    if (toastTimersRef.current[alertId]) {
      window.clearTimeout(toastTimersRef.current[alertId]);
      delete toastTimersRef.current[alertId];
    }
  }, []);

  const emitPushAlert = useCallback(
    (
      uid: string,
      payload: Omit<StudentPushAlert, 'createdAtMs' | 'timestampLabel' | 'read'>
    ) => {
      const prefs = pushPrefsRef.current;
      if (payload.category === 'Scholarship' && !prefs.scholarshipAlerts) return;
      if (payload.category === 'Grievance Update' && !prefs.grievanceAlerts) return;

      const createdAtMs = Date.now();
      const fullAlert: StudentPushAlert = {
        ...payload,
        createdAtMs,
        timestampLabel: new Date(createdAtMs).toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        read: false,
      };

      setPushAlerts((prev) => {
        if (prev.some((a) => a.id === fullAlert.id)) return prev;
        const next = [fullAlert, ...prev].slice(0, 40);
        saveStoredPushAlerts(uid, next);
        return next;
      });

      setActiveToasts((prev) => {
        if (prev.some((t) => t.id === fullAlert.id)) return prev;
        return [fullAlert, ...prev].slice(0, 3);
      });

      toastTimersRef.current[fullAlert.id] = window.setTimeout(() => {
        dismissToast(fullAlert.id);
      }, 9000);

      if (prefs.browserEnabled) {
        dispatchBrowserPushNotification(fullAlert, () => {
          setTab(fullAlert.targetTab);
        });
      }
    },
    [dismissToast]
  );

  useEffect(() => {
    if (studentProfile) {
      setEditName(studentProfile.fullName);
      setEditMobile(studentProfile.mobile);
      setEditRollId(studentProfile.studentRollId);
      setEditCourse(studentProfile.course);
      setEditBranch(studentProfile.department || studentProfile.branch);
      setEditYear(studentProfile.academicYear);
      setEditAdmissionYear(studentProfile.admissionYear || String(new Date().getFullYear()));
      setEditCollegeEmail(studentProfile.collegeEmail || studentProfile.email);
      setGMobile(studentProfile.mobile);
    }
  }, [studentProfile]);

  useEffect(() => {
    if (!authReady || !user || !studentProfile?.collegeId) return;
    const localMatch = DEMO_COLLEGES.find((c) => c.id === studentProfile.collegeId) || null;
    if (localMatch) setCollegeDetail(localMatch);

    fetch(`/api/colleges/${encodeURIComponent(studentProfile.collegeId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { college?: CollegeRecord; integration?: CollegeIntegrationRecord | null } | null) => {
        if (data?.college) setCollegeDetail(data.college);
        if (data?.integration !== undefined) setCollegeIntegration(data.integration);
      })
      .catch(() => undefined);

    const unsubDepts = onSnapshot(
      query(collection(db, 'departments'), where('collegeId', '==', studentProfile.collegeId)),
      (snap) => setCollegeDepartments(snap.docs.map((d) => d.data() as DepartmentRecord)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'departments')
    );
    const unsubCourses = onSnapshot(
      query(collection(db, 'courses'), where('collegeId', '==', studentProfile.collegeId)),
      (snap) => setCollegeCourses(snap.docs.map((d) => d.data() as CourseRecord)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'courses')
    );
    const unsubTimetable = onSnapshot(
      query(collection(db, 'timetables'), where('collegeId', '==', studentProfile.collegeId)),
      (snap) => setTimetableSlots(snap.docs.map((d) => d.data() as TimetableSlotRecord)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'timetables')
    );
    const unsubCollegeMedia = onSnapshot(
      query(
        collection(db, 'college_media'),
        where('approvalStatus', '==', 'Approved'),
        where('collegeId', '==', studentProfile.collegeId)
      ),
      (snap) => setApprovedCollegeMedia(snap.docs.map((d) => d.data() as CollegeMediaRecord)),
      () => undefined
    );
    return () => {
      unsubDepts();
      unsubCourses();
      unsubTimetable();
      unsubCollegeMedia();
    };
  }, [authReady, user, studentProfile?.collegeId]);

  useEffect(() => {
    if (!authReady || !user) return;

    const uid = user.uid;
    const unsubFees = onSnapshot(
      query(collection(db, 'fee_records'), where('studentUid', '==', uid)),
      (snap) => {
        setFeeRecords(snap.docs.map((d) => d.data() as FeeRecord));
        setLoadingData(false);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'fee_records')
    );

    const unsubPayments = onSnapshot(
      query(collection(db, 'fee_payments'), where('studentUid', '==', uid)),
      (snap) => setFeePayments(snap.docs.map((d) => d.data() as FeePayment)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'fee_payments')
    );

    const unsubGrievances = onSnapshot(
      query(collection(db, 'grievances'), where('studentUid', '==', uid)),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as GrievanceRecord);
        setGrievances(list);

        const prevMap = seenSnapshotsRef.current.grievances;
        const nextMap: Record<string, string> = {};
        for (const g of list) {
          const sig = `${g.status}|${g.escalationLevel}|${g.resolutionNotes || ''}`;
          nextMap[g.id] = sig;
          const previousSig = prevMap[g.id];
          if (previousSig && previousSig !== sig) {
            emitPushAlert(uid, {
              id: `grv_${g.id}_${sig}`,
              category: 'Grievance Update',
              title: `Grievance Update · ${g.trackingNumber}`,
              message: `"${g.subject}" is now ${g.status} (${g.escalationLevel}).${
                g.resolutionNotes ? ` Note: ${g.resolutionNotes}` : ''
              }`,
              targetTab: 'grievances',
            });
          }
        }
        seenSnapshotsRef.current.grievances = nextMap;
        saveSeenStatusSnapshots(uid, seenSnapshotsRef.current);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'grievances')
    );

    const unsubEvidence = onSnapshot(
      query(collection(db, 'grievance_evidence'), where('studentUid', '==', uid)),
      (snap) => setEvidences(snap.docs.map((d) => d.data() as GrievanceEvidenceRecord)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'grievance_evidence')
    );

    const unsubSchApps = onSnapshot(
      query(collection(db, 'scholarship_applications'), where('studentUid', '==', uid)),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as ScholarshipApplicationRecord);
        setScholarshipApps(list);

        const prevMap = seenSnapshotsRef.current.scholarships;
        const nextMap: Record<string, string> = {};
        for (const app of list) {
          const sig = `${app.status}|${app.grievanceNote || ''}`;
          nextMap[app.id] = sig;
          const previousSig = prevMap[app.id];
          if (previousSig && previousSig !== sig) {
            emitPushAlert(uid, {
              id: `sch_${app.id}_${sig}`,
              category: 'Scholarship',
              title: `Scholarship Status: ${app.status}`,
              message: `${app.scholarshipTitle} (Ref: ${app.applicationRef}) updated to "${app.status}".${
                app.grievanceNote ? ` Note: ${app.grievanceNote}` : ''
              }`,
              targetTab: 'scholarships',
            });
          }
        }
        seenSnapshotsRef.current.scholarships = nextMap;
        saveSeenStatusSnapshots(uid, seenSnapshotsRef.current);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'scholarship_applications')
    );

    const unsubStateNotices = onSnapshot(
      query(collection(db, 'notifications'), where('scope', '==', 'state')),
      (snap) => {
        const stateList = snap.docs.map((d) => d.data() as NotificationRecord);
        setNotifications((prev) => {
          const personal = prev.filter((n) => n.scope !== 'state');
          return [...stateList, ...personal];
        });
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'notifications/state')
    );

    const unsubStudentNotices = onSnapshot(
      query(collection(db, 'notifications'), where('targetUid', '==', uid)),
      (snap) => {
        const personalList = snap.docs.map((d) => d.data() as NotificationRecord);
        setNotifications((prev) => {
          const stateOnly = prev.filter((n) => n.scope === 'state');
          return [...stateOnly, ...personalList];
        });
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'notifications/student')
    );

    const unsubAcademics = onSnapshot(
      query(collection(db, 'academic_records'), where('studentUid', '==', uid)),
      (snap) => setAcademicRecords(snap.docs.map((d) => d.data() as AcademicSubjectRecord)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'academic_records')
    );

    const unsubPlacements = onSnapshot(
      query(collection(db, 'placement_opportunities')),
      (snap) => setPlacementOpportunities(snap.docs.map((d) => d.data() as PlacementOpportunityRecord)),
      () => undefined
    );

    const unsubPlacementApps = onSnapshot(
      query(collection(db, 'placement_applications'), where('studentUid', '==', uid)),
      (snap) => setPlacementApplications(snap.docs.map((d) => d.data() as PlacementApplicationRecord)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'placement_applications')
    );

    const unsubResume = onSnapshot(
      doc(db, 'student_resumes', uid),
      (snap) => {
        setStudentResume(snap.exists() ? (snap.data() as StudentResumeRecord) : null);
      },
      () => undefined
    );

    const unsubServices = onSnapshot(
      query(collection(db, 'college_services'), where('studentUid', '==', uid)),
      (snap) => setCollegeServices(snap.docs.map((d) => d.data() as CollegeServiceRecord)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'college_services')
    );

    return () => {
      unsubFees();
      unsubPayments();
      unsubGrievances();
      unsubEvidence();
      unsubSchApps();
      unsubStateNotices();
      unsubStudentNotices();
      unsubAcademics();
      unsubPlacements();
      unsubPlacementApps();
      unsubResume();
      unsubServices();
    };
  }, [authReady, user, emitPushAlert]);

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
          Sign in to access your Student Dashboard
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Your academic profile, fee records, scholarship applications, and grievances are securely
          isolated to your verified account.
        </p>
        <button
          type="button"
          onClick={onOpenAuth}
          className="px-5 py-2.5 text-sm font-semibold text-white bg-[#1E40AF] dark:bg-blue-600 rounded-lg hover:bg-[#1E3A8A] dark:hover:bg-blue-500 cursor-pointer"
        >
          Sign In with Google
        </button>
      </div>
    );
  }

  if (!studentProfile) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
          Complete Student Registration
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          You are signed in as <span className="font-semibold text-slate-900 dark:text-slate-100">{user.email}</span>. Link your
          college, roll number, and course details to unlock your Student Portal.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={onOpenAuth}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-[#1E40AF] dark:bg-blue-600 rounded-lg hover:bg-[#1E3A8A] dark:hover:bg-blue-500 cursor-pointer"
          >
            Complete Student Profile
          </button>
          {isStateAdmin && (
            <button
              type="button"
              onClick={() => onNavigate('state_admin')}
              className="px-5 py-2.5 text-sm font-semibold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
            >
              Open State Admin Console
            </button>
          )}
          {isActiveCollegeAdmin && (
            <button
              type="button"
              onClick={() => onNavigate('college_admin')}
              className="px-5 py-2.5 text-sm font-semibold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
            >
              Open College Admin Console
            </button>
          )}
        </div>
      </div>
    );
  }

  const totalFeeSum = feeRecords.reduce((acc, r) => acc + r.totalFee, 0);
  const totalPaidSum = feeRecords.reduce((acc, r) => acc + r.paidAmount, 0);
  const totalPendingSum = feeRecords.reduce((acc, r) => acc + r.pendingAmount, 0);
  const hasDemoFeeOnly = feeRecords.length > 0 && feeRecords.every((r) => r.isDemo);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!studentProfile) return;
    setProfileSaving(true);
    try {
      await updateStudentSelfProfile(studentProfile.uid, {
        fullName: editName,
        mobile: editMobile,
        studentRollId: editRollId,
        course: editCourse,
        branch: editBranch,
        department: editBranch,
        academicYear: editYear,
        admissionYear: editAdmissionYear,
        collegeEmail: editCollegeEmail,
      });
      setEditingProfile(false);
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleSendCollegeOtp() {
    if (!studentProfile) return;
    const emailTarget = (editCollegeEmail || studentProfile.collegeEmail || studentProfile.email).trim();
    setOtpBusy(true);
    setOtpStatusMsg(null);
    setOtpHint(null);
    try {
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailTarget, collegeId: studentProfile.collegeId }),
      });
      const data = (await res.json()) as { error?: string; message?: string; previewCode?: string };
      if (!res.ok) throw new Error(data.error || 'Could not send OTP.');
      setOtpSent(true);
      if (data.previewCode) setOtpHint(`Sandbox Preview OTP: ${data.previewCode}`);
      setOtpStatusMsg(data.message || 'OTP generated.');
    } catch (err) {
      setOtpStatusMsg(err instanceof Error ? err.message : 'OTP send failed.');
    } finally {
      setOtpBusy(false);
    }
  }

  async function handleVerifyCollegeOtp() {
    if (!studentProfile || !otpInput.trim()) return;
    const emailTarget = (editCollegeEmail || studentProfile.collegeEmail || studentProfile.email).trim();
    setOtpBusy(true);
    setOtpStatusMsg(null);
    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailTarget, otp: otpInput.trim() }),
      });
      const data = (await res.json()) as { error?: string; verifiedAt?: string };
      if (!res.ok) throw new Error(data.error || 'OTP verification failed.');
      await updateStudentSelfProfile(studentProfile.uid, {
        fullName: studentProfile.fullName,
        mobile: studentProfile.mobile,
        studentRollId: studentProfile.studentRollId,
        course: studentProfile.course,
        branch: studentProfile.branch,
        department: studentProfile.department || studentProfile.branch,
        academicYear: studentProfile.academicYear,
        collegeEmail: emailTarget,
        collegeEmailVerified: true,
        otpVerifiedAt: data.verifiedAt || new Date().toISOString(),
      });
      setOtpSent(false);
      setOtpInput('');
      setOtpHint(null);
      setOtpStatusMsg('College email verified via OTP and saved to your student record.');
    } catch (err) {
      setOtpStatusMsg(err instanceof Error ? err.message : 'OTP verification failed.');
    } finally {
      setOtpBusy(false);
    }
  }

  async function handleRunAiTriage() {
    if (!gSubject.trim() || gDescription.trim().length < 10) {
      setGrievanceError('Please enter a subject and at least 10 characters of description before running AI triage.');
      return;
    }
    setAnalyzingAi(true);
    setGrievanceError(null);
    try {
      const token = await getToken();
      const formData = new FormData();
      formData.append('subject', gSubject.trim());
      formData.append('description', gDescription.trim());
      formData.append('category', gCategory);
      if (gFile) {
        formData.append('evidenceFile', gFile);
      }

      const res = await fetch('/api/grievances/analyze', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI triage failed.');
      setAiTriage(data);
      if (data.suggestedCategory && GRIEVANCE_CATEGORIES.includes(data.suggestedCategory)) {
        setGCategory(data.suggestedCategory);
      }
      if (data.suggestedEscalation) {
        setGEscalation(data.suggestedEscalation);
      }
    } catch (err) {
      setGrievanceError(err instanceof Error ? err.message : 'AI analysis error.');
    } finally {
      setAnalyzingAi(false);
    }
  }

  async function handleSubmitGrievance(e: React.FormEvent) {
    e.preventDefault();
    if (!studentProfile) return;
    if (!gSubject.trim() || gDescription.trim().length < 10) {
      setGrievanceError('Please enter a subject and description (min 10 characters).');
      return;
    }

    setSubmittingGrievance(true);
    setGrievanceError(null);
    setGrievanceFeedback(null);

    try {
      const token = await getToken();
      let uploadedEvidence: {
        evidenceId: string;
        fileName: string;
        mimeType: string;
        sizeBytes: number;
        sha256: string;
        storagePath: string;
        aiAssistNote: string;
      } | null = null;

      if (gFile) {
        const fd = new FormData();
        fd.append('file', gFile);
        fd.append('collegeId', studentProfile.collegeId);
        const upRes = await fetch('/api/grievances/upload-evidence', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        const upData = await upRes.json();
        if (!upRes.ok) throw new Error(upData.error || 'Evidence upload failed.');
        uploadedEvidence = {
          ...upData,
          aiAssistNote:
            aiTriage?.evidenceAssistNote ||
            'Evidence uploaded for human authority verification.',
        };
      }

      const result = await createGrievanceWithEvidence({
        student: studentProfile,
        category: gCategory,
        subject: gSubject.trim(),
        description: gDescription.trim(),
        contactMobile: gMobile.trim() || studentProfile.mobile,
        aiSuggestedCategory: aiTriage?.suggestedCategory || gCategory,
        aiUrgency: aiTriage?.urgency || 'Medium',
        aiTriageSummary:
          aiTriage?.triageSummary || 'Submitted directly for College Nodal Officer review.',
        aiVerificationDisclaimer:
          aiTriage?.verificationDisclaimer ||
          'AI assists classification only. Evidence authenticity must be verified by a human officer.',
        escalationLevel: gEscalation,
        evidence: uploadedEvidence,
      });

      setGSubject('');
      setGDescription('');
      setGFile(null);
      setAiTriage(null);
      setGrievanceFeedback(
        `Grievance submitted successfully. Tracking Number: ${result.trackingNumber}`
      );
    } catch (err) {
      setGrievanceError(err instanceof Error ? err.message : 'Failed to submit grievance.');
    } finally {
      setSubmittingGrievance(false);
    }
  }

  async function handleViewProtectedEvidence(storagePath: string) {
    try {
      const token = await getToken();
      const res = await fetch(storagePath, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Could not open evidence file.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noreferrer';
      a.click();
    } catch (err) {
      setGrievanceError(err instanceof Error ? err.message : 'Unable to preview evidence.');
    }
  }

  async function handleSubmitDiscrepancy(e: React.FormEvent) {
    e.preventDefault();
    if (!discrepancyTarget || !discrepancyNote.trim()) return;
    await reportFeeDiscrepancy(discrepancyTarget.id, discrepancyNote.trim());
    setDiscrepancyTarget(null);
    setDiscrepancyNote('');
    setFeeActionMsg('Fee discrepancy logged for College Administrator review.');
  }

  async function handleEnableBrowserPush() {
    const result = await requestBrowserNotificationPermission();
    setPushPermission(result);
    if (user?.uid) {
      const next = { ...pushPrefs, browserEnabled: result === 'granted' };
      setPushPrefs(next);
      saveStudentPushPreferences(user.uid, next);
    }
  }

  function handleUpdatePushPrefs(patch: Partial<StudentPushPreferences>) {
    const next = { ...pushPrefs, ...patch };
    setPushPrefs(next);
    if (user?.uid) {
      saveStudentPushPreferences(user.uid, next);
    }
  }

  function handleMarkAlertRead(alertId: string) {
    setPushAlerts((prev) => {
      const next = prev.map((a) => (a.id === alertId ? { ...a, read: true } : a));
      if (user?.uid) saveStoredPushAlerts(user.uid, next);
      return next;
    });
  }

  function handleMarkAllAlertsRead() {
    setPushAlerts((prev) => {
      const next = prev.map((a) => ({ ...a, read: true }));
      if (user?.uid) saveStoredPushAlerts(user.uid, next);
      return next;
    });
  }

  function handleClearReadAlerts() {
    setPushAlerts((prev) => {
      const next = prev.filter((a) => !a.read);
      if (user?.uid) saveStoredPushAlerts(user.uid, next);
      return next;
    });
  }

  const unreadAlertCount = useMemo(
    () => pushAlerts.filter((a) => !a.read).length,
    [pushAlerts]
  );

  const filteredNotifications = useMemo(() => {
    if (notificationFilter === 'All') return notifications;
    return notifications.filter((n) => n.category === notificationFilter);
  }, [notifications, notificationFilter]);

  const inferredCgpa = useMemo(() => {
    const gradePts: Record<AcademicSubjectRecord['grade'], number> = {
      O: 10,
      'A+': 9,
      A: 8,
      'B+': 7,
      B: 6,
      C: 5,
      F: 0,
      Pending: 0,
    };
    let pts = 0;
    let credits = 0;
    for (const r of academicRecords) {
      if (r.grade !== 'Pending') {
        pts += (gradePts[r.grade] || 0) * r.credits;
        credits += r.credits;
      }
    }
    return credits > 0 ? Math.round((pts / credits) * 100) / 100 : 7.8;
  }, [academicRecords]);

  const overallAttendancePct = useMemo(() => {
    const total = academicRecords.reduce((acc, r) => acc + r.classesTotal, 0);
    const attended = academicRecords.reduce((acc, r) => acc + r.classesAttended, 0);
    return total > 0 ? Math.round((attended / total) * 1000) / 10 : null;
  }, [academicRecords]);

  const collegeMediaSummary = useMemo(() => {
    if (!studentProfile?.collegeId) return null;
    return buildCollegeMediaSummaryMap(approvedCollegeMedia)[studentProfile.collegeId] || null;
  }, [approvedCollegeMedia, studentProfile?.collegeId]);

  const contextualHelpDeskPhoto = useMemo(() => {
    if (!collegeMediaSummary) return null;
    return (
      collegeMediaSummary.approvedPhotos.find(
        (m) => m.mediaCategory === 'Help Desk & Administration'
      ) ||
      collegeMediaSummary.approvedPhotos.find(
        (m) => m.mediaCategory === 'Student-Faculty Communication'
      ) ||
      collegeMediaSummary.approvedPhotos.find(
        (m) => m.mediaCategory === 'Student Activity & Events'
      ) ||
      collegeMediaSummary.primaryCampusPhoto
    );
  }, [collegeMediaSummary]);

  const sidebarItems: { id: StudentTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview & Profile', icon: <User className="w-4 h-4" /> },
    { id: 'digital_id', label: 'Digital Student ID', icon: <CreditCard className="w-4 h-4" /> },
    { id: 'academics', label: 'Academic Records', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'campus_services', label: 'Hostel, Bus & Library', icon: <Home className="w-4 h-4" /> },
    { id: 'placements', label: 'Placements & Resume', icon: <GraduationCap className="w-4 h-4" /> },
    { id: 'fees', label: 'Fee Management', icon: <IndianRupee className="w-4 h-4" /> },
    { id: 'payment_history', label: 'Payment History', icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'grievances', label: 'AI Grievances', icon: <Scale className="w-4 h-4" /> },
    { id: 'scholarships', label: 'Scholarships', icon: <Award className="w-4 h-4" /> },
    { id: 'careers', label: 'Competitive Exams', icon: <Briefcase className="w-4 h-4" /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" /> },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Live In-App Push Toast Stack for Scholarship & Grievance Updates */}
      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 z-50 w-[calc(100%-2rem)] max-w-sm space-y-2 pointer-events-none"
      >
        <AnimatePresence>
          {activeToasts.map((toast) => (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, x: 24, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 24, scale: 0.96 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="pointer-events-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-lg dark:shadow-black/50 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#1E40AF] dark:text-blue-400">
                  <BellRing className="w-4 h-4 shrink-0" />
                  <span>{toast.category}</span>
                </div>
                <button
                  type="button"
                  aria-label="Dismiss alert"
                  onClick={() => dismissToast(toast.id)}
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                {toast.title}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {toast.message}
              </p>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    handleMarkAlertRead(toast.id);
                    dismissToast(toast.id);
                    setTab(toast.targetTab);
                  }}
                  className="px-3 py-1 text-xs font-semibold text-white bg-[#1E40AF] dark:bg-blue-600 rounded-lg hover:bg-[#1E3A8A] dark:hover:bg-blue-500 cursor-pointer whitespace-nowrap shrink-0 ash-btn-press"
                >
                  Open {toast.targetTab === 'scholarships' ? 'Scholarships' : 'Grievances'}
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Workspace Sidebar (240px equivalent on desktop) */}
        <aside className="lg:col-span-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-5">
          <div className="space-y-1 px-2">
            <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
              {studentProfile.studentRollId} · {studentProfile.verificationStatus}
            </div>
            <div className="font-display text-base font-bold text-slate-900 dark:text-slate-100 truncate">
              {studentProfile.fullName}
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400 truncate">
              {studentProfile.collegeName}
            </div>
          </div>

          <nav className="space-y-1">
            {sidebarItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
                  tab === item.id
                    ? 'bg-[#1E40AF] dark:bg-blue-600 text-white'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span className="inline-flex items-center gap-2.5 truncate">
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                </span>
                {item.id === 'notifications' && unreadAlertCount > 0 && (
                  <span
                    className={`font-mono text-xs font-bold tabular-nums shrink-0 ${
                      tab === 'notifications'
                        ? 'text-blue-100'
                        : 'text-[#1E40AF] dark:text-blue-400'
                    }`}
                  >
                    {unreadAlertCount}
                  </span>
                )}
              </button>
            ))}
          </nav>

          {(isActiveCollegeAdmin || isStateAdmin) && (
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
              <div className="px-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                Admin Workspaces
              </div>
              {isActiveCollegeAdmin && (
                <button
                  type="button"
                  onClick={() => onNavigate('college_admin')}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                >
                  College Admin Console →
                </button>
              )}
              {isStateAdmin && (
                <button
                  type="button"
                  onClick={() => onNavigate('state_admin')}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/60 cursor-pointer"
                >
                  State Admin Console →
                </button>
              )}
            </div>
          )}

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={signOut}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </aside>

        {/* Main Content Viewport */}
        <main className="lg:col-span-9 space-y-6">
          {/* Context Breadcrumb Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Student Portal / {sidebarItems.find((i) => i.id === tab)?.label}
              </div>
              <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                {sidebarItems.find((i) => i.id === tab)?.label}
              </h1>
            </div>
            <button
              type="button"
              onClick={() => setTab('grievances')}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#1E40AF] dark:bg-blue-600 rounded-lg hover:bg-[#1E3A8A] dark:hover:bg-blue-500 self-start sm:self-auto cursor-pointer whitespace-nowrap shrink-0 ash-btn-press"
            >
              File New Grievance
            </button>
          </div>

          {loadingData && (
            <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-500 dark:text-slate-400">
              Synchronizing student records...
            </div>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-6"
            >
          {/* TAB 1: OVERVIEW & PROFILE */}
          {tab === 'overview' && (
            <div className="space-y-6">
              {/* Key Metrics Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 ash-card-interactive">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    College Verification
                  </div>
                  <div className="font-display text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                    {studentProfile.verificationStatus}
                  </div>
                  <button
                    type="button"
                    onClick={() => setTab('digital_id')}
                    className="text-xs font-semibold text-[#1E40AF] dark:text-blue-400 hover:underline mt-1 cursor-pointer"
                  >
                    Open Digital ID Card →
                  </button>
                </div>
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-2 ash-card-interactive">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Academic Records &amp; Attendance
                  </div>
                  <div className="font-mono text-xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                    {overallAttendancePct !== null ? `${overallAttendancePct}%` : 'Not Synced'}
                  </div>
                  {overallAttendancePct !== null && (
                    <AcademicProgressBar
                      value={overallAttendancePct}
                      max={100}
                      thresholdPct={75}
                      tone={overallAttendancePct >= 75 ? 'emerald' : 'amber'}
                      label="Overall attendance compliance"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => setTab('academics')}
                    className="text-xs font-semibold text-[#5B21B6] dark:text-violet-400 hover:underline cursor-pointer"
                  >
                    {academicRecords.length > 0
                      ? `SGPA ${inferredCgpa.toFixed(2)} · Open Academic Records →`
                      : 'Open Academic Records →'}
                  </button>
                </div>
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 ash-card-interactive">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Active Grievances
                  </div>
                  <div className="font-mono text-xl font-bold text-slate-900 dark:text-slate-100 tabular-nums mt-1">
                    {grievances.filter((g) => g.status !== 'Closed' && g.status !== 'Resolved').length}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    {grievances.length} total submissions
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 ash-card-interactive">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Fee Pending {hasDemoFeeOnly ? '(Demo Sample)' : ''}
                  </div>
                  <div className="font-mono text-xl font-bold text-slate-900 dark:text-slate-100 tabular-nums mt-1">
                    {feeRecords.length === 0
                      ? 'Not Synced'
                      : `₹${totalPendingSum.toLocaleString('en-IN')}`}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    {feeRecords.length === 0
                      ? 'Awaiting college fee record'
                      : `${feeRecords.length} fee ledger entry`}
                  </div>
                </div>
              </div>

              {/* Personal & College Information */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
                    Personal & Academic Profile
                  </h2>
                  <button
                    type="button"
                    onClick={() => setEditingProfile((v) => !v)}
                    className="text-xs font-semibold text-[#1E40AF] dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    {editingProfile ? 'Cancel Edit' : 'Edit Profile'}
                  </button>
                </div>

                {editingProfile ? (
                  <form onSubmit={handleSaveProfile} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Full Name
                      </label>
                      <input
                        type="text"
                        required
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Mobile Number
                      </label>
                      <input
                        type="text"
                        required
                        value={editMobile}
                        onChange={(e) => setEditMobile(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Student Roll ID
                      </label>
                      <input
                        type="text"
                        required
                        value={editRollId}
                        onChange={(e) => setEditRollId(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg font-mono bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Academic Year
                      </label>
                      <select
                        value={editYear}
                        onChange={(e) => setEditYear(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                      >
                        <option>1st Year</option>
                        <option>2nd Year</option>
                        <option>3rd Year</option>
                        <option>4th Year</option>
                        <option>PG 1st Year</option>
                        <option>PG 2nd Year</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Course
                      </label>
                      <input
                        type="text"
                        required
                        value={editCourse}
                        onChange={(e) => setEditCourse(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Department / Branch
                      </label>
                      <input
                        type="text"
                        required
                        value={editBranch}
                        onChange={(e) => setEditBranch(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Admission Year
                      </label>
                      <input
                        type="text"
                        value={editAdmissionYear}
                        onChange={(e) => setEditAdmissionYear(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg font-mono bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        College Email
                      </label>
                      <input
                        type="email"
                        value={editCollegeEmail}
                        onChange={(e) => setEditCollegeEmail(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                      />
                    </div>
                    <div className="sm:col-span-2 flex justify-end">
                      <button
                        type="submit"
                        disabled={profileSaving}
                        className="px-4 py-2 text-sm font-semibold text-white bg-[#1E40AF] dark:bg-blue-600 rounded-lg hover:bg-[#1E3A8A] dark:hover:bg-blue-500 cursor-pointer"
                      >
                        {profileSaving ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 text-sm">
                      <div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">Account & College Email</div>
                        <div className="font-medium text-slate-900 dark:text-slate-100 mt-0.5 break-all">
                          {studentProfile.collegeEmail || studentProfile.email}
                        </div>
                        <div className="text-xs mt-1">
                          {studentProfile.collegeEmailVerified ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              College Email OTP Verified
                            </span>
                          ) : (
                            <span className="text-amber-700 dark:text-amber-400 font-medium">
                              OTP Verification Pending
                            </span>
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">Mobile</div>
                        <div className="font-mono text-slate-900 dark:text-slate-100 mt-0.5">
                          {studentProfile.mobile}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Roll / Hall Ticket ID
                        </div>
                        <div className="font-mono font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                          {studentProfile.studentRollId}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Course & Department
                        </div>
                        <div className="font-medium text-slate-900 dark:text-slate-100 mt-0.5">
                          {studentProfile.course} · {studentProfile.department || studentProfile.branch}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Academic & Admission Year
                        </div>
                        <div className="font-medium text-slate-900 dark:text-slate-100 mt-0.5">
                          {studentProfile.academicYear} (Admitted {studentProfile.admissionYear || '—'})
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">District</div>
                        <div className="font-medium text-slate-900 dark:text-slate-100 mt-0.5">
                          {studentProfile.district}
                        </div>
                      </div>
                      <div className="sm:col-span-2 lg:col-span-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-[#1E40AF] dark:text-blue-400" />
                          <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {studentProfile.collegeName}
                          </span>
                          <span>· Code: {studentProfile.collegeCode}</span>
                        </div>
                        <span>
                          ERP Integration:{' '}
                          <strong className="text-slate-900 dark:text-slate-100">
                            {collegeIntegration?.status || collegeDetail?.integrationStatus || 'Requires Integration'}
                          </strong>
                        </span>
                      </div>
                    </div>

                    {!studentProfile.collegeEmailVerified && (
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5 text-[#1E40AF] dark:text-blue-400" />
                            Verify College Email via OTP ({studentProfile.collegeEmail || studentProfile.email})
                          </div>
                          <button
                            type="button"
                            disabled={otpBusy}
                            onClick={handleSendCollegeOtp}
                            className="px-3 py-1.5 text-xs font-semibold bg-[#1E40AF] text-white rounded-lg hover:bg-[#1E3A8A] disabled:opacity-50 cursor-pointer"
                          >
                            {otpBusy ? 'Sending...' : otpSent ? 'Resend OTP' : 'Send OTP'}
                          </button>
                        </div>
                        {otpStatusMsg && (
                          <div className="text-xs text-slate-700 dark:text-slate-300">{otpStatusMsg}</div>
                        )}
                        {otpHint && (
                          <div className="text-xs font-mono text-[#5B21B6] dark:text-violet-300">{otpHint}</div>
                        )}
                        {otpSent && (
                          <div className="flex gap-2 pt-1">
                            <input
                              type="text"
                              maxLength={6}
                              value={otpInput}
                              onChange={(e) => setOtpInput(e.target.value)}
                              placeholder="Enter 6-digit OTP"
                              className="flex-1 px-3 py-1.5 text-xs font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                            />
                            <button
                              type="button"
                              disabled={otpBusy || otpInput.trim().length !== 6}
                              onClick={handleVerifyCollegeOtp}
                              className="px-3.5 py-1.5 text-xs font-semibold bg-emerald-700 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 cursor-pointer"
                            >
                              Verify OTP
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Verified College-Isolated Campus Gallery */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {collegeMediaSummary?.logo ? (
                      <img
                        src={collegeMediaSummary.logo.imageUrl}
                        alt={`${studentProfile.collegeName} Official Logo`}
                        loading="lazy"
                        className="w-10 h-10 rounded-lg object-contain border border-slate-200 dark:border-slate-700 bg-white p-1"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0">
                        <Camera className="w-5 h-5 text-[#1E40AF] dark:text-blue-400" />
                      </div>
                    )}
                    <div>
                      <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
                        Verified Institutional Photographs · {studentProfile.collegeCode}
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Strictly isolated to {studentProfile.collegeName} ({studentProfile.district}).
                      </p>
                    </div>
                  </div>
                  <span className="font-mono text-xs font-semibold text-[#1E40AF] dark:text-blue-400">
                    {collegeMediaSummary ? `${collegeMediaSummary.totalApprovedCount} Verified Photo(s)` : 'Awaiting Upload'}
                  </span>
                </div>

                {collegeMediaSummary && collegeMediaSummary.approvedPhotos.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {collegeMediaSummary.approvedPhotos.slice(0, 4).map((media) => (
                      <InstitutionalPhotoFrame
                        key={media.id}
                        src={media.imageUrl}
                        alt={`${studentProfile.collegeName} - ${media.title}`}
                        aspectClass="aspect-[16/10]"
                        categoryLabel={media.mediaCategory}
                        collegeName={media.collegeName}
                        caption={media.caption || media.title}
                        sourceUrl={media.sourceUrl}
                        licenseOrPermission={media.licenseOrPermission}
                        isVerified
                        showAttributionBar
                        compact
                      />
                    ))}
                  </div>
                ) : (
                  <InstitutionalPhotoFrame
                    src={null}
                    alt={`${studentProfile.collegeName} placeholder`}
                    aspectClass="aspect-[21/9]"
                    categoryLabel="Campus & Facilities"
                    collegeName={studentProfile.collegeName}
                    isVerified={false}
                    compact
                  />
                )}
              </div>
            </div>
          )}

          {/* TAB 1B: DIGITAL STUDENT ID CARD */}
          {tab === 'digital_id' && (
            <DigitalIdCard student={studentProfile} college={collegeDetail} />
          )}

          {/* TAB 1C: ACADEMIC SUITE (ATTENDANCE, MARKS, TIMETABLE, RESULTS, DEPTS) */}
          {tab === 'academics' && (
            <StudentAcademicSuite
              student={studentProfile}
              college={collegeDetail}
              integration={collegeIntegration}
              departments={collegeDepartments}
              courses={collegeCourses}
              academicRecords={academicRecords}
              timetableSlots={timetableSlots}
            />
          )}

          {/* TAB 1D: CAMPUS SERVICES (HOSTEL, TRANSPORT, LIBRARY) */}
          {tab === 'campus_services' && (
            <StudentCampusServicesSuite student={studentProfile} services={collegeServices} />
          )}

          {/* TAB 1E: PLACEMENTS, JOBS, INTERNSHIPS & RESUME BUILDER */}
          {tab === 'placements' && (
            <StudentCareerSuite
              student={studentProfile}
              opportunities={placementOpportunities}
              applications={placementApplications}
              resume={studentResume}
              inferredCgpa={inferredCgpa}
            />
          )}

          {/* TAB 2: COLLEGE-WISE FEE MANAGEMENT */}
          {tab === 'fees' && (
            <div className="space-y-6">
              {feeActionMsg && (
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/70 text-xs text-emerald-800 dark:text-emerald-300">
                  {feeActionMsg}
                </div>
              )}

              {feeRecords.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center space-y-4">
                  <IndianRupee className="w-8 h-8 text-slate-400 dark:text-slate-500 mx-auto" />
                  <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
                    No official college fee record synced yet
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-300 max-w-lg mx-auto leading-relaxed">
                    Andhra Student Hub never invents or fabricates official student fee balances.
                    Your institution&apos;s College Administrator will publish verified semester fee
                    ledgers here. You can optionally load a clearly-labelled DEMO fee sample to
                    preview receipts and discrepancy reporting.
                  </p>
                  <button
                    type="button"
                    onClick={() => createDemoFeeSampleForStudent(studentProfile)}
                    className="px-4 py-2.5 text-xs font-semibold text-white bg-slate-900 dark:bg-slate-700 rounded-lg hover:bg-slate-800 dark:hover:bg-slate-600 cursor-pointer"
                  >
                    Load Clearly-Labelled DEMO Fee Sample
                  </button>
                </div>
              ) : (
                <>
                  {hasDemoFeeOnly && (
                    <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/70 text-xs text-amber-900 dark:text-amber-200">
                      DEMO FEE SAMPLE NOTICE: The balances below are marked DEMO for workflow
                      testing and do not represent official institutional financial obligations.
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 ash-card-interactive">
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Total Billed Fee
                      </div>
                      <div className="font-mono text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums mt-1">
                        ₹{totalFeeSum.toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 ash-card-interactive">
                      <div className="text-xs text-slate-500 dark:text-slate-400">Paid Amount</div>
                      <div className="font-mono text-2xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums mt-1">
                        ₹{totalPaidSum.toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 ash-card-interactive">
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Pending Balance
                      </div>
                      <div className="font-mono text-2xl font-bold text-amber-700 dark:text-amber-400 tabular-nums mt-1">
                        ₹{totalPendingSum.toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>

                  {/* Fee Records Table */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 font-display font-bold text-sm text-slate-900 dark:text-slate-100">
                      Semester Fee Ledgers
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="px-4 py-3 font-semibold">Term & Type</th>
                            <th className="px-4 py-3 font-semibold text-right">Total</th>
                            <th className="px-4 py-3 font-semibold text-right">Paid</th>
                            <th className="px-4 py-3 font-semibold text-right">Pending</th>
                            <th className="px-4 py-3 font-semibold">Status</th>
                            <th className="px-4 py-3 font-semibold text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {feeRecords.map((rec) => (
                            <tr key={rec.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                              <td className="px-4 py-3">
                                <div className="font-medium text-slate-900 dark:text-slate-100">
                                  {rec.semester} {rec.feeCategory ? `· ${rec.feeCategory}` : ''}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                  {rec.academicYear} · {rec.isDemo ? 'DEMO SAMPLE' : 'INSTITUTIONAL'}
                                  {rec.dueDate ? ` · Due ${rec.dueDate}` : ''}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-900 dark:text-slate-100">
                                ₹{rec.totalFee.toLocaleString('en-IN')}
                              </td>
                              <td className="px-4 py-3 text-right font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                                ₹{rec.paidAmount.toLocaleString('en-IN')}
                              </td>
                              <td className="px-4 py-3 text-right font-mono tabular-nums text-amber-700 dark:text-amber-400">
                                ₹{rec.pendingAmount.toLocaleString('en-IN')}
                              </td>
                              <td className="px-4 py-3 text-xs font-semibold text-slate-800 dark:text-slate-200">
                                {rec.status}
                                {rec.discrepancyReported && (
                                  <div className="text-red-700 dark:text-red-400 font-normal mt-0.5">
                                    Discrepancy flagged
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right">
                                {rec.status !== 'Disputed' ? (
                                  <button
                                    type="button"
                                    onClick={() => setDiscrepancyTarget(rec)}
                                    className="text-xs font-semibold text-red-700 dark:text-red-400 hover:underline cursor-pointer"
                                  >
                                    Report Discrepancy
                                  </button>
                                ) : (
                                  <span className="text-xs text-slate-500 dark:text-slate-400">
                                    Under Review
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Payment History & Receipts */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                      <span className="font-display font-bold text-sm text-slate-900 dark:text-slate-100">
                        Payment History & Receipts
                      </span>
                      <button
                        type="button"
                        onClick={() => setTab('payment_history')}
                        className="text-xs font-semibold text-[#1E40AF] dark:text-blue-400 hover:underline cursor-pointer whitespace-nowrap shrink-0"
                      >
                        View Payment Trends →
                      </button>
                    </div>
                    {feePayments.length === 0 ? (
                      <div className="p-6 text-xs text-slate-500 dark:text-slate-400">
                        No payments recorded yet.
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {feePayments.map((pay) => (
                          <div
                            key={pay.id}
                            className="px-6 py-3.5 flex items-center justify-between gap-4 text-sm"
                          >
                            <div>
                              <div className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                                {pay.receiptNumber} {pay.isDemo ? '· DEMO' : ''}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                {pay.paymentMode} · {pay.paidAtLabel}
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                                ₹{pay.amount.toLocaleString('en-IN')}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewTarget({
                                    kind: 'fee_receipt',
                                    payment: pay,
                                    feeRecord: feeRecords.find((r) => r.id === pay.feeRecordId),
                                    student: studentProfile,
                                  })
                                }
                                className="inline-flex items-center gap-1 text-xs font-semibold text-[#1E40AF] dark:text-blue-400 hover:underline cursor-pointer"
                              >
                                <Receipt className="w-3.5 h-3.5" />
                                Preview
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  generateFeeReceiptPdf({
                                    payment: pay,
                                    feeRecord: feeRecords.find((r) => r.id === pay.feeRecordId),
                                    student: studentProfile,
                                  })
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                              >
                                <Download className="w-3.5 h-3.5" />
                                PDF
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 2B: DEDICATED PAYMENT HISTORY & TRENDS */}
          {tab === 'payment_history' && (
            <PaymentHistorySection
              student={studentProfile}
              feeRecords={feeRecords}
              feePayments={feePayments}
              onPreviewReceipt={(target) => setPreviewTarget(target)}
              onDownloadPdf={(payment, feeRecord) =>
                generateFeeReceiptPdf({
                  payment,
                  feeRecord,
                  student: studentProfile,
                })
              }
              onLoadDemoSample={() => createDemoFeeSampleForStudent(studentProfile)}
            />
          )}

          {/* TAB 3: AI GRIEVANCE MANAGEMENT */}
          {tab === 'grievances' && (
            <div className="space-y-8">
              {/* Institutional Grievance Support & Administration Desk Visual */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
                <div className="md:col-span-7 space-y-2">
                  <div className="text-xs font-semibold text-[#1E40AF] dark:text-blue-400">
                    Student–College Nodal Officer Communication · {studentProfile.collegeCode}
                  </div>
                  <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
                    {studentProfile.collegeName} Grievance &amp; Administration Cell
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    All submitted tickets route first to your college nodal officer and can be
                    escalated to Principal / Dean, University Grievance Cell, or State Oversight.
                    Never include readable confidential personal ID numbers or phone numbers in public attachments.
                  </p>
                </div>
                <div className="md:col-span-5">
                  <InstitutionalPhotoFrame
                    src={contextualHelpDeskPhoto?.imageUrl}
                    alt={`${studentProfile.collegeName} administration and student support`}
                    aspectClass="aspect-[16/10]"
                    categoryLabel={contextualHelpDeskPhoto?.mediaCategory || 'Help Desk & Administration'}
                    collegeName={studentProfile.collegeName}
                    caption={contextualHelpDeskPhoto?.title}
                    sourceUrl={contextualHelpDeskPhoto?.sourceUrl}
                    licenseOrPermission={contextualHelpDeskPhoto?.licenseOrPermission}
                    isVerified={Boolean(contextualHelpDeskPhoto)}
                    showAttributionBar
                    compact
                  />
                </div>
              </div>

              {/* Submit New Grievance */}
              <form
                onSubmit={handleSubmitGrievance}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5"
              >
                <div>
                  <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
                    Submit Complaint with AI-Assisted Triage
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    AI assists category routing and urgency classification. Evidence authenticity is
                    always verified by human college or state authorities.
                  </p>
                </div>

                {grievanceError && (
                  <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/70 text-xs text-red-700 dark:text-red-300">
                    {grievanceError}
                  </div>
                )}
                {grievanceFeedback && (
                  <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/70 text-xs text-emerald-800 dark:text-emerald-300 font-semibold">
                    {grievanceFeedback}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Category
                    </label>
                    <select
                      value={gCategory}
                      onChange={(e) => setGCategory(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                    >
                      {GRIEVANCE_CATEGORIES.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Initial Escalation Target
                    </label>
                    <select
                      value={gEscalation}
                      onChange={(e) =>
                        setGEscalation(e.target.value as GrievanceRecord['escalationLevel'])
                      }
                      className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                    >
                      <option>College Nodal Officer</option>
                      <option>Principal / Dean</option>
                      <option>University Grievance Cell</option>
                      <option>State Oversight</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Contact Mobile
                    </label>
                    <input
                      type="tel"
                      required
                      value={gMobile}
                      onChange={(e) => setGMobile(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Subject
                  </label>
                  <input
                    type="text"
                    required
                    value={gSubject}
                    onChange={(e) => setGSubject(e.target.value)}
                    placeholder="Concise summary of your issue..."
                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Detailed Description
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={gDescription}
                    onChange={(e) => setGDescription(e.target.value)}
                    placeholder="Describe dates, department/office involved, and exact issue..."
                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />
                </div>

                {/* File Evidence Upload */}
                <div className="p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 space-y-2">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                    <Upload className="w-4 h-4 text-[#1E40AF] dark:text-blue-400" />
                    <span>Supporting Evidence (JPEG, PNG, WEBP, or PDF up to 5 MB)</span>
                  </label>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,.pdf"
                    onChange={(e) => setGFile(e.target.files?.[0] || null)}
                    className="block w-full text-xs text-slate-600 dark:text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-white dark:file:bg-slate-700 file:text-slate-800 dark:file:text-slate-100 hover:file:bg-slate-100 dark:hover:file:bg-slate-600 cursor-pointer"
                  />
                  {gFile && (
                    <div className="text-xs text-slate-600 dark:text-slate-300 font-mono">
                      Selected: {gFile.name} ({Math.round(gFile.size / 1024)} KB)
                    </div>
                  )}
                </div>

                {/* AI Triage Preview */}
                {aiTriage && (
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                    <div className="font-semibold text-[#1E40AF] dark:text-blue-400">
                      AI Preliminary Triage · Urgency: {aiTriage.urgency} · Suggested:{' '}
                      {aiTriage.suggestedCategory}
                    </div>
                    <p className="text-slate-700 dark:text-slate-200 leading-relaxed">
                      {aiTriage.triageSummary}
                    </p>
                    <p className="text-slate-600 dark:text-slate-300">
                      {aiTriage.evidenceAssistNote}
                    </p>
                    <p className="text-amber-800 dark:text-amber-300 font-medium">
                      {aiTriage.verificationDisclaimer}
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    disabled={analyzingAi}
                    onClick={handleRunAiTriage}
                    className="px-4 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 cursor-pointer"
                  >
                    {analyzingAi ? 'Analyzing with AI...' : 'Run AI Preliminary Classification'}
                  </button>

                  <button
                    type="submit"
                    disabled={submittingGrievance}
                    className="px-5 py-2.5 text-sm font-semibold text-white bg-[#1E40AF] dark:bg-blue-600 rounded-lg hover:bg-[#1E3A8A] dark:hover:bg-blue-500 disabled:opacity-50 cursor-pointer"
                  >
                    {submittingGrievance ? 'Submitting...' : 'Submit Grievance'}
                  </button>
                </div>
              </form>

              {/* Existing Grievances & Resolution History */}
              <div className="space-y-4">
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
                  My Grievance Tracker ({grievances.length})
                </h2>

                {grievances.length === 0 ? (
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                    No complaints submitted yet.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {grievances.map((g) => {
                      const relatedEv = evidences.filter((ev) => ev.grievanceId === g.id);
                      return (
                        <article
                          key={g.id}
                          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3 ash-card-interactive"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                            <span className="font-mono font-bold text-[#1E40AF] dark:text-blue-400">
                              {g.trackingNumber}
                            </span>
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                              {g.status} · {g.escalationLevel} · Urgency: {g.aiUrgency}
                            </span>
                          </div>

                          <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                            {g.subject}
                          </h3>
                          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                            {g.description}
                          </p>

                          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 text-xs text-slate-700 dark:text-slate-300 space-y-1">
                            <div>
                              <span className="font-semibold">AI Triage Summary:</span>{' '}
                              {g.aiTriageSummary}
                            </div>
                            <div className="text-amber-800 dark:text-amber-300">
                              {g.aiVerificationDisclaimer}
                            </div>
                          </div>

                          {relatedEv.length > 0 && (
                            <div className="space-y-1.5">
                              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                Attached Evidence
                              </div>
                              {relatedEv.map((ev) => (
                                <div
                                  key={ev.id}
                                  className="flex items-center justify-between gap-3 text-xs p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80"
                                >
                                  <div>
                                    <span className="font-mono font-medium text-slate-900 dark:text-slate-100">
                                      {ev.fileName}
                                    </span>{' '}
                                    ·{' '}
                                    <span className="text-amber-700 dark:text-amber-400 font-semibold">
                                      {ev.humanVerificationStatus}
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleViewProtectedEvidence(ev.storagePath)}
                                    className="font-semibold text-[#1E40AF] dark:text-blue-400 hover:underline cursor-pointer"
                                  >
                                    View File
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          {g.resolutionNotes && (
                            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/70 text-xs text-emerald-900 dark:text-emerald-200">
                              <span className="font-semibold">Authority Resolution Notes:</span>{' '}
                              {g.resolutionNotes}
                            </div>
                          )}

                          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewTarget({
                                    kind: 'grievance_summary',
                                    grievance: g,
                                    student: studentProfile,
                                    evidences: relatedEv,
                                  })
                                }
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#1E40AF] dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/60 cursor-pointer"
                              >
                                <Receipt className="w-3.5 h-3.5" />
                                Preview Summary
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  generateGrievanceSummaryPdf({
                                    grievance: g,
                                    student: studentProfile,
                                    evidences: relatedEv,
                                  })
                                }
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                              >
                                <Download className="w-3.5 h-3.5" />
                                Download PDF
                              </button>
                            </div>

                            {g.status !== 'Closed' &&
                              g.status !== 'Resolved' &&
                              g.escalationLevel !== 'State Oversight' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextLevel =
                                      g.escalationLevel === 'College Nodal Officer'
                                        ? 'Principal / Dean'
                                        : g.escalationLevel === 'Principal / Dean'
                                          ? 'University Grievance Cell'
                                          : 'State Oversight';
                                    escalateGrievanceByStudent(g.id, nextLevel);
                                  }}
                                  className="text-xs font-semibold text-amber-800 dark:text-amber-400 hover:underline cursor-pointer"
                                >
                                  Escalate to Next Authority →
                                </button>
                              )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: SCHOLARSHIP APPLICATIONS */}
          {tab === 'scholarships' && (
            <div className="space-y-5">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
                <div className="md:col-span-7 space-y-2.5">
                  <div className="text-xs font-semibold text-[#1E40AF] dark:text-blue-400">
                    Scholarship &amp; Biometric Verification Support · {studentProfile.collegeCode}
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Track your submitted scholarship references and related institutional queries at{' '}
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {studentProfile.collegeName}
                    </span>
                    .
                  </p>
                  <button
                    type="button"
                    onClick={() => onNavigate('scholarships')}
                    className="px-3.5 py-2 text-xs font-semibold text-white bg-[#1E40AF] dark:bg-blue-600 hover:bg-[#1E3A8A] dark:hover:bg-blue-500 rounded-lg cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Browse Scholarships
                  </button>
                </div>
                <div className="md:col-span-5">
                  <InstitutionalPhotoFrame
                    src={contextualHelpDeskPhoto?.imageUrl}
                    alt={`${studentProfile.collegeName} scholarship help desk`}
                    aspectClass="aspect-[16/10]"
                    categoryLabel={contextualHelpDeskPhoto?.mediaCategory || 'Help Desk & Administration'}
                    collegeName={studentProfile.collegeName}
                    caption={contextualHelpDeskPhoto?.title}
                    sourceUrl={contextualHelpDeskPhoto?.sourceUrl}
                    licenseOrPermission={contextualHelpDeskPhoto?.licenseOrPermission}
                    isVerified={Boolean(contextualHelpDeskPhoto)}
                    showAttributionBar
                    compact
                  />
                </div>
              </div>

              {scholarshipApps.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center space-y-3">
                  <Award className="w-8 h-8 text-slate-400 dark:text-slate-500 mx-auto" />
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    No scholarship applications logged yet. Visit the Scholarships directory to log
                    an application reference.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {scholarshipApps.map((app) => (
                    <div
                      key={app.id}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
                          Ref: {app.applicationRef} · {app.collegeName}
                        </div>
                        <div className="font-display font-bold text-slate-900 dark:text-slate-100">
                          {app.scholarshipTitle}
                        </div>
                        {app.grievanceNote && (
                          <div className="text-xs text-amber-800 dark:text-amber-300">
                            Note: {app.grievanceNote}
                          </div>
                        )}
                      </div>
                      <span className="text-xs font-semibold text-[#1E40AF] dark:text-blue-400 whitespace-nowrap shrink-0">
                        {app.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4B: CAREERS & COMPETITIVE EXAMS */}
          {tab === 'careers' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
                      Competitive Exams, Internships & Career Tracks
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      APPSC, UPSC, SSC, GATE, NPTEL, internships, and skill-building portals.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {['All', 'APPSC', 'UPSC', 'SSC', 'GATE', 'NPTEL', 'Internship', 'Skill Development'].map((tr) => (
                      <button
                        key={tr}
                        type="button"
                        onClick={() => setCareerTrackFilter(tr)}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-md border cursor-pointer ${
                          careerTrackFilter === tr
                            ? 'bg-[#5B21B6] text-white border-[#5B21B6]'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {tr}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {CAREER_OPPORTUNITIES.filter((c) => careerTrackFilter === 'All' || c.track === careerTrackFilter).map((item) => (
                    <div key={item.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="font-semibold text-[#5B21B6] dark:text-violet-400">{item.track}</span>
                        <span className="text-slate-500 dark:text-slate-400">{item.modeOrLocation}</span>
                      </div>
                      <div className="font-display font-bold text-sm text-slate-900 dark:text-slate-100">{item.title}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{item.organization} · {item.eligibility}</div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{item.summary}</p>
                      <a
                        href={item.officialPortalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#1E40AF] dark:text-blue-400 hover:underline"
                      >
                        Official Portal <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-3">
                <h3 className="font-display font-bold text-base text-slate-900 dark:text-slate-100">
                  APSCHE Entrance Examinations
                </h3>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {DEMO_EXAM_UPDATES.map((ex) => (
                    <div key={ex.id} className="py-3 first:pt-0 last:pb-0 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">{ex.examName}</span>
                        <span className="font-mono text-slate-500 dark:text-slate-400">{ex.windowLabel}</span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300">{ex.summary}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: NOTIFICATIONS & REAL-TIME PUSH ALERTS */}
          {tab === 'notifications' && (
            <div className="space-y-6">
              {/* Push Notification Controls */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
                      Real-Time Push Notifications
                    </h2>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                      Receive instant alerts when scholarship application status changes or when a
                      grievance receives an authority update.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {pushPermission === 'default' && (
                      <button
                        type="button"
                        onClick={handleEnableBrowserPush}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#1E40AF] dark:bg-blue-600 rounded-lg hover:bg-[#1E3A8A] dark:hover:bg-blue-500 cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <BellRing className="w-3.5 h-3.5" />
                        Enable Desktop Push Alerts
                      </button>
                    )}
                    {pushPermission === 'granted' && (
                      <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap shrink-0">
                        Browser Push Enabled
                      </span>
                    )}
                    {pushPermission === 'denied' && (
                      <span className="text-xs font-semibold text-amber-800 dark:text-amber-300 whitespace-nowrap shrink-0">
                        Browser Push Blocked (In-App Alerts Active)
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        user &&
                        emitPushAlert(user.uid, {
                          id: `test_${Date.now()}`,
                          category: 'Grievance Update',
                          title: 'Push Alert Check',
                          message:
                            'Real-time push notifications are active for scholarship and grievance updates.',
                          targetTab: 'notifications',
                        })
                      }
                      className="px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      Send Test Alert
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-6 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300">
                  <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={pushPrefs.scholarshipAlerts}
                      onChange={(e) =>
                        handleUpdatePushPrefs({ scholarshipAlerts: e.target.checked })
                      }
                      className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 dark:bg-slate-950 text-[#1E40AF] cursor-pointer"
                    />
                    Scholarship Status Changes
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={pushPrefs.grievanceAlerts}
                      onChange={(e) =>
                        handleUpdatePushPrefs({ grievanceAlerts: e.target.checked })
                      }
                      className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 dark:bg-slate-950 text-[#1E40AF] cursor-pointer"
                    />
                    Grievance Authority Updates
                  </label>
                  {pushPermission === 'granted' && (
                    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={pushPrefs.browserEnabled}
                        onChange={(e) =>
                          handleUpdatePushPrefs({ browserEnabled: e.target.checked })
                        }
                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 dark:bg-slate-950 text-[#1E40AF] cursor-pointer"
                      />
                      Desktop Browser Popups
                    </label>
                  )}
                </div>
              </div>

              {/* Live Push Alert Stream (Unread + Recent Triggers) */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-display font-bold text-sm text-slate-900 dark:text-slate-100 tabular-nums">
                      Status Change Push Alerts ({unreadAlertCount} unread)
                    </h3>
                  </div>
                  <div className="flex items-center gap-3">
                    {unreadAlertCount > 0 && (
                      <button
                        type="button"
                        onClick={handleMarkAllAlertsRead}
                        className="text-xs font-semibold text-[#1E40AF] dark:text-blue-400 hover:underline cursor-pointer whitespace-nowrap shrink-0"
                      >
                        Mark All Read
                      </button>
                    )}
                    {pushAlerts.some((a) => a.read) && (
                      <button
                        type="button"
                        onClick={handleClearReadAlerts}
                        className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer whitespace-nowrap shrink-0"
                      >
                        Clear Read
                      </button>
                    )}
                  </div>
                </div>
                {pushAlerts.length === 0 ? (
                  <div className="p-6 text-xs text-slate-500 dark:text-slate-400">
                    No status-change push alerts triggered yet. When a scholarship application or
                    grievance changes status, an instant alert will appear here.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {pushAlerts.map((alert) => (
                      <div
                        key={alert.id}
                        className={`px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          alert.read
                            ? 'bg-white dark:bg-slate-900'
                            : 'bg-blue-50/40 dark:bg-blue-950/40'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                            <span className="font-semibold text-[#1E40AF] dark:text-blue-400">
                              {alert.category}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono">{alert.timestampLabel}</span>
                            {!alert.read && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="font-semibold text-amber-700 dark:text-amber-400">
                                  Unread
                                </span>
                              </>
                            )}
                          </div>
                          <div className="font-display font-bold text-sm text-slate-900 dark:text-slate-100">
                            {alert.title}
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                            {alert.message}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {!alert.read && (
                            <button
                              type="button"
                              onClick={() => handleMarkAlertRead(alert.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer whitespace-nowrap shrink-0"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Mark Read
                            </button>
                          )}
                          {alert.targetTab !== 'notifications' && (
                            <button
                              type="button"
                              onClick={() => {
                                handleMarkAlertRead(alert.id);
                                setTab(alert.targetTab);
                              }}
                              className="px-3 py-1.5 text-xs font-semibold text-white bg-[#1E40AF] dark:bg-blue-600 rounded-lg hover:bg-[#1E3A8A] dark:hover:bg-blue-500 cursor-pointer whitespace-nowrap shrink-0"
                            >
                              View
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Persisted Institutional & State Notifications */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-display font-bold text-sm text-slate-900 dark:text-slate-100">
                    Official Notice & Alert Archive ({filteredNotifications.length})
                  </h3>
                  <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                    {(['All', 'Scholarship', 'Grievance Update', 'Announcement'] as const).map(
                      (cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setNotificationFilter(cat)}
                          className={`px-2.5 py-1 text-xs font-semibold rounded-md cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
                            notificationFilter === cat
                              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          {cat}
                        </button>
                      )
                    )}
                  </div>
                </div>

                {filteredNotifications.length === 0 ? (
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center space-y-2">
                    <Bell className="w-8 h-8 text-slate-400 dark:text-slate-500 mx-auto" />
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      No notifications found under the selected category.
                    </p>
                  </div>
                ) : (
                  filteredNotifications.map((ntf) => (
                    <div
                      key={ntf.id}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span>
                          {ntf.category} ·{' '}
                          {ntf.scope === 'state'
                            ? 'Statewide Notice'
                            : ntf.scope === 'student'
                              ? 'Direct Student Alert'
                              : 'College Announcement'}
                        </span>
                      </div>
                      <h4 className="font-display font-bold text-slate-900 dark:text-slate-100">
                        {ntf.title}
                      </h4>
                      <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                        {ntf.message}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Print & Live PDF Preview Modal */}
      <FeeReceiptPreview
        target={previewTarget}
        onClose={() => setPreviewTarget(null)}
      />

      {/* Discrepancy Modal */}
      <AnimatePresence>
        {discrepancyTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="fixed inset-0 z-50 bg-slate-900/50 dark:bg-black/75 backdrop-blur-[2px] flex items-center justify-center p-4"
            onClick={() => setDiscrepancyTarget(null)}
          >
            <motion.form
              initial={{ opacity: 0, scale: 0.97, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              onSubmit={handleSubmitDiscrepancy}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl"
            >
              <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-semibold text-xs">
                <AlertTriangle className="w-4 h-4" />
                <span>Report Fee Discrepancy</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Describe the missing payment, receipt mismatch, or scholarship reimbursement adjustment
                for {discrepancyTarget.semester}.
              </p>
              <textarea
                rows={3}
                required
                value={discrepancyNote}
                onChange={(e) => setDiscrepancyNote(e.target.value)}
                placeholder="Enter transaction reference and expected balance..."
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDiscrepancyTarget(null)}
                  className="px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer ash-btn-press"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-red-700 hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-500 rounded-lg cursor-pointer ash-btn-press"
                >
                  Submit Discrepancy
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
