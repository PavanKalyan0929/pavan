import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import {
  Award,
  Bell,
  BookOpen,
  Briefcase,
  Building2,
  CalendarClock,
  Camera,
  CheckCircle2,
  Database,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Home,
  IndianRupee,
  Layers,
  Plus,
  RefreshCw,
  Scale,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  Users,
  XCircle,
} from 'lucide-react';
import { DEMO_COLLEGES } from '../data/demoColleges.ts';
import { ALL_MEDIA_CATEGORIES, VERIFIED_SEEDED_MEDIA } from '../data/verifiedCollegeMedia.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { db, handleFirestoreError, OperationType } from '../lib/firebase.ts';
import { compressInstitutionalImage, type CompressedImageResult } from '../lib/imageCompression.ts';
import {
  batchUpdateGrievancesByAdmin,
  createFeeRecordByAdmin,
  deleteAcademicRecordByAdmin,
  deleteCollegeMediaRecord,
  deleteCollegeServiceByAdmin,
  deleteCourseByAdmin,
  deleteDepartmentByAdmin,
  deleteFeeStructureByAdmin,
  deletePlacementOpportunityByAdmin,
  deleteTimetableSlotByAdmin,
  recordFeePaymentByAdmin,
  seedSampleTimetableByAdmin,
  sendCollegeAnnouncement,
  submitCollegeMediaByAdmin,
  updateCollegeProfileByAdmin,
  updateGrievanceByAdmin,
  updatePlacementApplicationByAdmin,
  updateScholarshipApplicationByAdmin,
  upsertAcademicRecordByAdmin,
  upsertCollegeIntegrationByAdmin,
  upsertCollegeServiceByAdmin,
  upsertCourseByAdmin,
  upsertDepartmentByAdmin,
  upsertFeeStructureByAdmin,
  upsertPlacementOpportunityByAdmin,
  upsertTimetableSlotByAdmin,
  verifyEvidenceByAdmin,
  verifyStudentByCollegeAdmin,
  writeAuditLog,
} from '../lib/firestoreService.ts';
import { exportStudentsToCsv, exportStudentsToExcel } from '../lib/studentExport.ts';
import { InstitutionalPhotoFrame } from './InstitutionalPhotoFrame.tsx';
import type {
  AcademicSubjectRecord,
  CollegeIntegrationRecord,
  CollegeMediaCategory,
  CollegeMediaRecord,
  CollegeRecord,
  CollegeServiceRecord,
  CourseRecord,
  DepartmentRecord,
  FeeRecord,
  FeeStructureRecord,
  GrievanceEvidenceRecord,
  GrievanceRecord,
  IntegrationSyncLog,
  NotificationRecord,
  PlacementApplicationRecord,
  PlacementOpportunityRecord,
  ScholarshipApplicationRecord,
  StudentProfile,
  TimetableSlotRecord,
} from '../types.ts';
import type { AppView } from './Navbar.tsx';

type CollegeAdminTab =
  | 'students'
  | 'scholarships'
  | 'grievances'
  | 'fees'
  | 'academics'
  | 'placements'
  | 'campus_services'
  | 'media'
  | 'integrations'
  | 'profile_notices';

interface CollegeAdminDashboardViewProps {
  onNavigate: (view: AppView) => void;
}

export function CollegeAdminDashboardView({ onNavigate }: CollegeAdminDashboardViewProps) {
  const { user, authReady, collegeAdminProfile, isActiveCollegeAdmin, isStateAdmin, getToken } =
    useAuth();

  const [tab, setTab] = useState<CollegeAdminTab>('students');
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [scholarshipApps, setScholarshipApps] = useState<ScholarshipApplicationRecord[]>([]);
  const [grievances, setGrievances] = useState<GrievanceRecord[]>([]);
  const [evidences, setEvidences] = useState<GrievanceEvidenceRecord[]>([]);
  const [feeRecords, setFeeRecords] = useState<FeeRecord[]>([]);
  const [feeStructures, setFeeStructures] = useState<FeeStructureRecord[]>([]);
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [courses, setCourses] = useState<CourseRecord[]>([]);
  const [collegeDoc, setCollegeDoc] = useState<CollegeRecord | null>(null);
  const [integration, setIntegration] = useState<CollegeIntegrationRecord | null>(null);
  const [syncLogs, setSyncLogs] = useState<IntegrationSyncLog[]>([]);
  const [academicRecords, setAcademicRecords] = useState<AcademicSubjectRecord[]>([]);
  const [timetableSlots, setTimetableSlots] = useState<TimetableSlotRecord[]>([]);
  const [placementOpportunities, setPlacementOpportunities] = useState<PlacementOpportunityRecord[]>([]);
  const [placementApplications, setPlacementApplications] = useState<PlacementApplicationRecord[]>([]);
  const [collegeServices, setCollegeServices] = useState<CollegeServiceRecord[]>([]);
  const [scholarshipFeedback, setScholarshipFeedback] = useState<string | null>(null);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);

  // Academics suite admin sub-tab + Attendance/Marks & Timetable state
  const [academicsSubTab, setAcademicsSubTab] = useState<
    'depts_courses' | 'attendance_marks' | 'timetable'
  >('depts_courses');
  const [acadStudentUid, setAcadStudentUid] = useState('');
  const [acadYear, setAcadYear] = useState('2026-27');
  const [acadSemester, setAcadSemester] = useState('Semester IV');
  const [acadSubjCode, setAcadSubjCode] = useState('');
  const [acadSubjName, setAcadSubjName] = useState('');
  const [acadFaculty, setAcadFaculty] = useState('');
  const [acadCredits, setAcadCredits] = useState('4');
  const [acadClassesTotal, setAcadClassesTotal] = useState('45');
  const [acadClassesAttended, setAcadClassesAttended] = useState('40');
  const [acadInternal, setAcadInternal] = useState('27');
  const [acadExternal, setAcadExternal] = useState('58');
  const [acadGrade, setAcadGrade] = useState<AcademicSubjectRecord['grade']>('A+');
  const [acadResult, setAcadResult] = useState<AcademicSubjectRecord['resultStatus']>('Pass');
  const [acadIsDemo, setAcadIsDemo] = useState(false);
  const [acadFeedback, setAcadFeedback] = useState<string | null>(null);

  const [ttDept, setTtDept] = useState('CSE');
  const [ttYear, setTtYear] = useState('2026-27');
  const [ttSem, setTtSem] = useState('Semester IV');
  const [ttDay, setTtDay] = useState<TimetableSlotRecord['dayOfWeek']>('Monday');
  const [ttStart, setTtStart] = useState('09:15');
  const [ttEnd, setTtEnd] = useState('10:15');
  const [ttSubjCode, setTtSubjCode] = useState('');
  const [ttSubjName, setTtSubjName] = useState('');
  const [ttFaculty, setTtFaculty] = useState('');
  const [ttRoom, setTtRoom] = useState('');
  const [ttType, setTtType] = useState<TimetableSlotRecord['slotType']>('Lecture');
  const [ttIsDemo, setTtIsDemo] = useState(false);
  const [ttFeedback, setTtFeedback] = useState<string | null>(null);

  // Placements admin state
  const [drvTitle, setDrvTitle] = useState('');
  const [drvCompany, setDrvCompany] = useState('');
  const [drvType, setDrvType] = useState<PlacementOpportunityRecord['opportunityType']>('Campus Placement');
  const [drvCategory, setDrvCategory] = useState('Software Engineering');
  const [drvCtc, setDrvCtc] = useState('');
  const [drvLocation, setDrvLocation] = useState('');
  const [drvEligibility, setDrvEligibility] = useState('B.Tech / Degree Final Year (No active backlogs)');
  const [drvMinCgpa, setDrvMinCgpa] = useState('6.5');
  const [drvDeadline, setDrvDeadline] = useState('2026-12-20');
  const [drvUrl, setDrvUrl] = useState('');
  const [drvDesc, setDrvDesc] = useState('');
  const [drvIsDemo, setDrvIsDemo] = useState(false);
  const [drvFeedback, setDrvFeedback] = useState<string | null>(null);
  const [plcRemarkDrafts, setPlcRemarkDrafts] = useState<Record<string, string>>({});

  // Campus Services admin state
  const [srvStudentUid, setSrvStudentUid] = useState('');
  const [srvType, setSrvType] = useState<CollegeServiceRecord['serviceType']>('Hostel');
  const [srvTitle, setSrvTitle] = useState('');
  const [srvRefCode, setSrvRefCode] = useState('');
  const [srvPrimary, setSrvPrimary] = useState('');
  const [srvSecondary, setSrvSecondary] = useState('');
  const [srvStatus, setSrvStatus] = useState<CollegeServiceRecord['status']>('Active');
  const [srvIsDemo, setSrvIsDemo] = useState(false);
  const [srvFilter, setSrvFilter] = useState<'All' | CollegeServiceRecord['status']>('All');
  const [srvRemarkDrafts, setSrvRemarkDrafts] = useState<Record<string, string>>({});
  const [srvFeedback, setSrvFeedback] = useState<string | null>(null);

  // Fee creation state
  const [selectedStudentUid, setSelectedStudentUid] = useState('');
  const [feeSem, setFeeSem] = useState('Semester I');
  const [feeYear, setFeeYear] = useState('2026-27');
  const [feeCategory, setFeeCategory] = useState<NonNullable<FeeRecord['feeCategory']>>('Tuition Fee');
  const [feeDueDate, setFeeDueDate] = useState('2026-08-31');
  const [totalFeeInput, setTotalFeeInput] = useState('45000');
  const [paidFeeInput, setPaidFeeInput] = useState('0');
  const [isDemoFee, setIsDemoFee] = useState(true);
  const [feeMessage, setFeeMessage] = useState<string | null>(null);

  // Announcement state
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeCategory, setNoticeCategory] = useState<NotificationRecord['category']>('Announcement');
  const [noticeMessage, setNoticeMessage] = useState('');
  const [noticeFeedback, setNoticeFeedback] = useState<string | null>(null);

  // College profile edit state
  const [colAddress, setColAddress] = useState('');
  const [colUniv, setColUniv] = useState('');
  const [colAccr, setColAccr] = useState('');
  const [colWebsite, setColWebsite] = useState('');
  const [colEmail, setColEmail] = useState('');
  const [colPhone, setColPhone] = useState('');
  const [colSavedMsg, setColSavedMsg] = useState<string | null>(null);
  const [colSaveError, setColSaveError] = useState<string | null>(null);

  // Department & Course management state
  const [deptCode, setDeptCode] = useState('');
  const [deptName, setDeptName] = useState('');
  const [deptHod, setDeptHod] = useState('');
  const [deptEmail, setDeptEmail] = useState('');
  const [deptFeedback, setDeptFeedback] = useState<string | null>(null);

  const [crsName, setCrsName] = useState('');
  const [crsLevel, setCrsLevel] = useState<CourseRecord['degreeLevel']>('UG');
  const [crsBranch, setCrsBranch] = useState('');
  const [crsDept, setCrsDept] = useState('');
  const [crsYears, setCrsYears] = useState('4');
  const [crsIntake, setCrsIntake] = useState('60');
  const [crsFeedback, setCrsFeedback] = useState<string | null>(null);

  // Fee Structure & ERP Integration state
  const [fsYear, setFsYear] = useState('2026-27');
  const [fsCourse, setFsCourse] = useState('B.Tech CSE');
  const [fsCategory, setFsCategory] = useState<FeeStructureRecord['category']>('Tuition Fee');
  const [fsAmount, setFsAmount] = useState('45000');
  const [fsDueDate, setFsDueDate] = useState('2026-08-31');
  const [fsIsDemo, setFsIsDemo] = useState(true);
  const [fsFeedback, setFsFeedback] = useState<string | null>(null);

  const [integAdapter, setIntegAdapter] = useState<CollegeIntegrationRecord['adapterType']>('CSV_XLSX_IMPORT');
  const [integReadOnly, setIntegReadOnly] = useState(true);
  const [integEndpoint, setIntegEndpoint] = useState('');
  const [integOfficer, setIntegOfficer] = useState('');
  const [integAuthRef, setIntegAuthRef] = useState('');
  const [integAttested, setIntegAttested] = useState(false);
  const [integCsvText, setIntegCsvText] = useState('');
  const [integBusy, setIntegBusy] = useState(false);
  const [integFeedback, setIntegFeedback] = useState<string | null>(null);
  const [integError, setIntegError] = useState<string | null>(null);

  // Grievance resolution inline notes map
  const [resolutionDrafts, setResolutionDrafts] = useState<Record<string, string>>({});

  // Student review filter & export state
  const [studentStatusFilter, setStudentStatusFilter] = useState<
    'All' | StudentProfile['verificationStatus']
  >('All');
  const [studentSearch, setStudentSearch] = useState('');
  const [studentExportFeedback, setStudentExportFeedback] = useState<string | null>(null);
  const [studentExportError, setStudentExportError] = useState<string | null>(null);

  // Batch grievance update & filtering state
  const [grievanceStatusFilter, setGrievanceStatusFilter] = useState<
    'All' | GrievanceRecord['status']
  >('All');
  const [grievanceSearch, setGrievanceSearch] = useState('');
  const [selectedGrievanceIds, setSelectedGrievanceIds] = useState<string[]>([]);
  const [batchStatus, setBatchStatus] = useState<GrievanceRecord['status']>('Resolved');
  const [batchEscalation, setBatchEscalation] = useState<
    GrievanceRecord['escalationLevel'] | 'keep'
  >('keep');
  const [batchNote, setBatchNote] = useState('');
  const [batchUpdating, setBatchUpdating] = useState(false);
  const [batchFeedback, setBatchFeedback] = useState<string | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);

  // Official College Photographs & Logos upload/management state
  const [collegeMediaOwn, setCollegeMediaOwn] = useState<CollegeMediaRecord[]>([]);
  const [approvedMediaForCollege, setApprovedMediaForCollege] = useState<CollegeMediaRecord[]>([]);
  const [mediaCategory, setMediaCategory] = useState<CollegeMediaCategory>('Main Campus & Entrance');
  const [mediaTitle, setMediaTitle] = useState('');
  const [mediaCaption, setMediaCaption] = useState('');
  const [mediaSourceUrl, setMediaSourceUrl] = useState('');
  const [mediaLicense, setMediaLicense] = useState('Official College Institutional Photograph');
  const [mediaConsentAttested, setMediaConsentAttested] = useState(false);
  const [mediaCompressed, setMediaCompressed] = useState<CompressedImageResult | null>(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string | null>(null);
  const [mediaCompressing, setMediaCompressing] = useState(false);
  const [mediaUploading, setMediaUploading] = useState(false);
  const [mediaFeedback, setMediaFeedback] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const targetCollegeId = collegeAdminProfile?.collegeId || '';

  useEffect(() => {
    return () => {
      if (mediaPreviewUrl) URL.revokeObjectURL(mediaPreviewUrl);
    };
  }, [mediaPreviewUrl]);

  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    return students.filter((stu) => {
      if (studentStatusFilter !== 'All' && stu.verificationStatus !== studentStatusFilter) {
        return false;
      }
      if (!q) return true;
      return (
        stu.fullName.toLowerCase().includes(q) ||
        stu.email.toLowerCase().includes(q) ||
        stu.mobile.toLowerCase().includes(q) ||
        stu.studentRollId.toLowerCase().includes(q) ||
        stu.course.toLowerCase().includes(q) ||
        stu.branch.toLowerCase().includes(q)
      );
    });
  }, [students, studentStatusFilter, studentSearch]);

  const studentStatusCounts = useMemo(() => {
    const counts: Record<'All' | StudentProfile['verificationStatus'], number> = {
      All: students.length,
      Pending: 0,
      Verified: 0,
      Rejected: 0,
    };
    for (const stu of students) {
      counts[stu.verificationStatus] = (counts[stu.verificationStatus] || 0) + 1;
    }
    return counts;
  }, [students]);

  const filteredGrievances = useMemo(() => {
    const q = grievanceSearch.trim().toLowerCase();
    return grievances.filter((g) => {
      if (grievanceStatusFilter !== 'All' && g.status !== grievanceStatusFilter) {
        return false;
      }
      if (!q) return true;
      return (
        g.trackingNumber.toLowerCase().includes(q) ||
        g.studentName.toLowerCase().includes(q) ||
        g.subject.toLowerCase().includes(q) ||
        g.category.toLowerCase().includes(q)
      );
    });
  }, [grievances, grievanceStatusFilter, grievanceSearch]);

  const grievanceStatusCounts = useMemo(() => {
    const counts: Record<'All' | GrievanceRecord['status'], number> = {
      All: grievances.length,
      Submitted: 0,
      'Under College Review': 0,
      'Escalated to University/State': 0,
      Resolved: 0,
      Closed: 0,
    };
    for (const g of grievances) {
      counts[g.status] = (counts[g.status] || 0) + 1;
    }
    return counts;
  }, [grievances]);

  const selectedGrievances = useMemo(() => {
    const selectedSet = new Set(selectedGrievanceIds);
    return grievances.filter((g) => selectedSet.has(g.id));
  }, [grievances, selectedGrievanceIds]);

  const selectedGrievanceSet = useMemo(
    () => new Set(selectedGrievances.map((g) => g.id)),
    [selectedGrievances]
  );

  const allFilteredSelected =
    filteredGrievances.length > 0 &&
    filteredGrievances.every((g) => selectedGrievanceSet.has(g.id));

  useEffect(() => {
    if (!authReady || !user || !user.email || !targetCollegeId) return;
    if (!isActiveCollegeAdmin && !isStateAdmin) return;

    const buildQuery = (colName: string) => {
      if (isStateAdmin && !isActiveCollegeAdmin) {
        return query(collection(db, colName), where('collegeId', '==', targetCollegeId));
      }
      return query(
        collection(db, colName),
        where('collegeId', '==', targetCollegeId),
        where('collegeAdminEmails', 'array-contains', user.email)
      );
    };

    const unsubStudents = onSnapshot(
      buildQuery('students'),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as StudentProfile);
        setStudents(list);
        if (list.length > 0 && !selectedStudentUid) {
          setSelectedStudentUid(list[0].uid);
        }
        if (list.length > 0 && !acadStudentUid) {
          setAcadStudentUid(list[0].uid);
        }
        if (list.length > 0 && !srvStudentUid) {
          setSrvStudentUid(list[0].uid);
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'students/collegeAdmin')
    );

    const unsubGrievances = onSnapshot(
      buildQuery('grievances'),
      (snap) => setGrievances(snap.docs.map((d) => d.data() as GrievanceRecord)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'grievances/collegeAdmin')
    );

    const unsubEvidence = onSnapshot(
      buildQuery('grievance_evidence'),
      (snap) => setEvidences(snap.docs.map((d) => d.data() as GrievanceEvidenceRecord)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'grievance_evidence/collegeAdmin')
    );

    const unsubFees = onSnapshot(
      buildQuery('fee_records'),
      (snap) => setFeeRecords(snap.docs.map((d) => d.data() as FeeRecord)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'fee_records/collegeAdmin')
    );

    const unsubScholarships = onSnapshot(
      buildQuery('scholarship_applications'),
      (snap) => setScholarshipApps(snap.docs.map((d) => d.data() as ScholarshipApplicationRecord)),
      (err) =>
        handleFirestoreError(err, OperationType.LIST, 'scholarship_applications/collegeAdmin')
    );

    const unsubDepts = onSnapshot(
      query(collection(db, 'departments'), where('collegeId', '==', targetCollegeId)),
      (snap) => setDepartments(snap.docs.map((d) => d.data() as DepartmentRecord)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'departments/collegeAdmin')
    );

    const unsubCourses = onSnapshot(
      query(collection(db, 'courses'), where('collegeId', '==', targetCollegeId)),
      (snap) => setCourses(snap.docs.map((d) => d.data() as CourseRecord)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'courses/collegeAdmin')
    );

    const unsubFeeStructures = onSnapshot(
      query(collection(db, 'fee_structures'), where('collegeId', '==', targetCollegeId)),
      (snap) => setFeeStructures(snap.docs.map((d) => d.data() as FeeStructureRecord)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'fee_structures/collegeAdmin')
    );

    const unsubAcadRecords = onSnapshot(
      buildQuery('academic_records'),
      (snap) => setAcademicRecords(snap.docs.map((d) => d.data() as AcademicSubjectRecord)),
      () => undefined
    );

    const unsubTimetable = onSnapshot(
      query(collection(db, 'timetables'), where('collegeId', '==', targetCollegeId)),
      (snap) => setTimetableSlots(snap.docs.map((d) => d.data() as TimetableSlotRecord)),
      () => undefined
    );

    const unsubPlacementDrives = onSnapshot(
      buildQuery('placement_opportunities'),
      (snap) => setPlacementOpportunities(snap.docs.map((d) => d.data() as PlacementOpportunityRecord)),
      () => undefined
    );

    const unsubPlacementApps = onSnapshot(
      buildQuery('placement_applications'),
      (snap) => setPlacementApplications(snap.docs.map((d) => d.data() as PlacementApplicationRecord)),
      () => undefined
    );

    const unsubCollegeServices = onSnapshot(
      buildQuery('college_services'),
      (snap) => setCollegeServices(snap.docs.map((d) => d.data() as CollegeServiceRecord)),
      () => undefined
    );

    const unsubCollege = onSnapshot(
      doc(db, 'colleges', targetCollegeId),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as CollegeRecord;
          setCollegeDoc(data);
          setColAddress(data.address);
          setColUniv(data.affiliatedUniversity);
          setColAccr(data.accreditation);
          setColWebsite(data.website || '');
          setColEmail(data.contactEmail || '');
          setColPhone(data.contactPhone || '');
        }
      },
      () => undefined
    );

    const unsubCollegeMediaOwn = onSnapshot(
      buildQuery('college_media'),
      (snap) => setCollegeMediaOwn(snap.docs.map((d) => d.data() as CollegeMediaRecord)),
      () => undefined
    );

    const unsubCollegeMediaApproved = onSnapshot(
      query(
        collection(db, 'college_media'),
        where('collegeId', '==', targetCollegeId),
        where('approvalStatus', '==', 'Approved')
      ),
      (snap) => setApprovedMediaForCollege(snap.docs.map((d) => d.data() as CollegeMediaRecord)),
      () => undefined
    );

    fetch(`/api/colleges/${encodeURIComponent(targetCollegeId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { integration?: CollegeIntegrationRecord | null } | null) => {
        if (data?.integration) {
          setIntegration(data.integration);
          setIntegAdapter(data.integration.adapterType);
          setIntegReadOnly(data.integration.readOnlySync);
          setIntegEndpoint(data.integration.endpointUrl || '');
          setIntegOfficer(data.integration.authorizedByOfficer || '');
          setIntegAuthRef(data.integration.authorizationRef || '');
          setIntegAttested(Boolean(data.integration.authorizationRef));
        }
      })
      .catch(() => undefined);

    fetch('/api/integrations')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { recentLogs?: IntegrationSyncLog[] } | null) => {
        if (data?.recentLogs) {
          setSyncLogs(data.recentLogs.filter((l) => l.collegeId === targetCollegeId));
        }
      })
      .catch(() => undefined);

    return () => {
      unsubStudents();
      unsubGrievances();
      unsubEvidence();
      unsubFees();
      unsubScholarships();
      unsubDepts();
      unsubCourses();
      unsubFeeStructures();
      unsubAcadRecords();
      unsubTimetable();
      unsubPlacementDrives();
      unsubPlacementApps();
      unsubCollegeServices();
      unsubCollege();
      unsubCollegeMediaOwn();
      unsubCollegeMediaApproved();
    };
  }, [authReady, user, targetCollegeId, isActiveCollegeAdmin, isStateAdmin, selectedStudentUid, acadStudentUid, srvStudentUid]);

  if (!user || (!isActiveCollegeAdmin && !isStateAdmin)) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
          College Administrator Access Required
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {collegeAdminProfile?.status === 'pending'
            ? `Your request for ${collegeAdminProfile.collegeName} is pending State Administrator approval.`
            : 'Only verified and active College Administrators can access institutional management tools.'}
        </p>
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className="px-4 py-2 text-sm font-semibold text-white bg-[#1E40AF] dark:bg-blue-600 hover:bg-[#1E3A8A] dark:hover:bg-blue-500 rounded-lg cursor-pointer"
        >
          Return Home
        </button>
      </div>
    );
  }

  if (!targetCollegeId) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
          No Institution Bound to This Account
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Use the State Admin Console to approve or bind a College Administrator to an institution.
        </p>
        {isStateAdmin && (
          <button
            type="button"
            onClick={() => onNavigate('state_admin')}
            className="px-4 py-2 text-sm font-semibold text-white bg-[#1E40AF] dark:bg-blue-600 hover:bg-[#1E3A8A] dark:hover:bg-blue-500 rounded-lg cursor-pointer"
          >
            Go to State Admin Console
          </button>
        )}
      </div>
    );
  }

  async function handleCreateFee(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.email) return;
    const targetStudent = students.find((s) => s.uid === selectedStudentUid);
    if (!targetStudent) return;

    await createFeeRecordByAdmin({
      student: targetStudent,
      academicYear: feeYear,
      semester: feeSem,
      feeCategory,
      dueDate: feeDueDate,
      totalFee: Number(totalFeeInput) || 0,
      paidAmount: Number(paidFeeInput) || 0,
      adminUid: user.uid,
      adminEmail: user.email,
      isDemo: isDemoFee,
    });
    setFeeMessage(`Fee record created for ${targetStudent.fullName} (${targetStudent.studentRollId}).`);
  }

  async function handleSendAnnouncement(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.email) return;
    await sendCollegeAnnouncement({
      title: noticeTitle,
      message: noticeMessage,
      category: noticeCategory,
      collegeId: targetCollegeId,
      adminUid: user.uid,
      adminEmail: user.email,
      targetStudents: students,
    });
    setNoticeTitle('');
    setNoticeMessage('');
    setNoticeFeedback(`Announcement delivered to ${students.length} registered college student(s).`);
  }

  async function handleSaveCollegeProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.email) return;
    setColSavedMsg(null);
    setColSaveError(null);
    if (!collegeDoc) {
      setColSaveError('Firestore college record has not been initialized yet by a State Administrator.');
      return;
    }
    await updateCollegeProfileByAdmin({
      college: {
        ...collegeDoc,
        address: colAddress.trim(),
        affiliatedUniversity: colUniv.trim(),
        accreditation: colAccr.trim(),
        website: colWebsite.trim(),
        contactEmail: colEmail.trim(),
        contactPhone: colPhone.trim(),
      },
      adminUid: user.uid,
      adminEmail: user.email,
    });
    setColSavedMsg('College profile and contact details updated.');
  }

  async function handleAddDepartment(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.email || !deptCode.trim() || !deptName.trim()) return;
    await upsertDepartmentByAdmin({
      department: {
        collegeId: targetCollegeId,
        collegeCode: collegeAdminProfile?.collegeCode || collegeDoc?.code || targetCollegeId,
        code: deptCode.trim().toUpperCase(),
        name: deptName.trim(),
        hodName: deptHod.trim(),
        contactEmail: deptEmail.trim(),
        isDemo: Boolean(collegeDoc?.isDemo),
      },
      adminUid: user.uid,
      adminEmail: user.email,
      actorRole: isActiveCollegeAdmin ? 'college_admin' : 'state_admin',
    });
    setDeptCode('');
    setDeptName('');
    setDeptHod('');
    setDeptEmail('');
    setDeptFeedback('Academic department saved to Firestore.');
  }

  async function handleAddCourse(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.email || !crsName.trim() || !crsBranch.trim()) return;
    await upsertCourseByAdmin({
      course: {
        collegeId: targetCollegeId,
        collegeCode: collegeAdminProfile?.collegeCode || collegeDoc?.code || targetCollegeId,
        name: crsName.trim(),
        degreeLevel: crsLevel,
        branch: crsBranch.trim(),
        department: crsDept.trim() || crsBranch.trim(),
        durationYears: Math.max(1, Math.min(6, Number(crsYears) || 4)),
        intake: Math.max(0, Number(crsIntake) || 60),
        isDemo: Boolean(collegeDoc?.isDemo),
      },
      adminUid: user.uid,
      adminEmail: user.email,
      actorRole: isActiveCollegeAdmin ? 'college_admin' : 'state_admin',
    });
    setCrsName('');
    setCrsBranch('');
    setCrsDept('');
    setCrsFeedback('Academic course programme saved to Firestore.');
  }

  async function handleAddFeeStructure(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.email || !fsCourse.trim()) return;
    await upsertFeeStructureByAdmin({
      structure: {
        collegeId: targetCollegeId,
        collegeCode: collegeAdminProfile?.collegeCode || collegeDoc?.code || targetCollegeId,
        academicYear: fsYear.trim(),
        course: fsCourse.trim(),
        category: fsCategory,
        amount: Math.max(0, Number(fsAmount) || 0),
        dueDate: fsDueDate.trim(),
        isDemo: fsIsDemo,
      },
      adminUid: user.uid,
      adminEmail: user.email,
    });
    setFsFeedback('Fee schedule template saved.');
  }

  async function handleConfigureIntegration(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.email) return;
    setIntegBusy(true);
    setIntegFeedback(null);
    setIntegError(null);
    try {
      const token = await getToken();
      const res = await fetch(`/api/integrations/${encodeURIComponent(targetCollegeId)}/configure`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          adapterType: integAdapter,
          readOnlySync: integReadOnly,
          endpointUrl: integEndpoint.trim(),
          authorizedByOfficer: integOfficer.trim() || user.email,
          authorizationRef: integAuthRef.trim(),
          authorizationAttested: integAttested,
        }),
      });
      const data = (await res.json()) as { integration?: CollegeIntegrationRecord; error?: string };
      if (!res.ok || !data.integration) {
        throw new Error(data.error || 'Could not configure college ERP integration.');
      }

      setIntegration(data.integration);
      await upsertCollegeIntegrationByAdmin({
        integration: data.integration,
        adminUid: user.uid,
        adminEmail: user.email,
        actorRole: isActiveCollegeAdmin ? 'college_admin' : 'state_admin',
      });
      setIntegFeedback(
        `Integration saved: ${data.integration.adapterType} (${data.integration.status}).`
      );
    } catch (err) {
      setIntegError(err instanceof Error ? err.message : 'Failed to configure integration.');
    } finally {
      setIntegBusy(false);
    }
  }

  async function handleRunSync(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.email) return;
    setIntegBusy(true);
    setIntegFeedback(null);
    setIntegError(null);
    try {
      const token = await getToken();
      const res = await fetch(`/api/integrations/${encodeURIComponent(targetCollegeId)}/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          csvText: integCsvText.trim(),
        }),
      });
      const data = (await res.json()) as {
        integration?: CollegeIntegrationRecord;
        log?: IntegrationSyncLog;
        error?: string;
      };
      if (!res.ok || !data.integration) {
        throw new Error(data.error || 'Synchronization failed.');
      }

      setIntegration(data.integration);
      if (data.log) {
        setSyncLogs((prev) => [data.log!, ...prev].slice(0, 20));
      }
      await upsertCollegeIntegrationByAdmin({
        integration: data.integration,
        adminUid: user.uid,
        adminEmail: user.email,
        actorRole: isActiveCollegeAdmin ? 'college_admin' : 'state_admin',
      });
      setIntegFeedback(data.log?.summary || 'Read-only synchronization completed.');
    } catch (err) {
      setIntegError(err instanceof Error ? err.message : 'Failed to execute synchronization.');
    } finally {
      setIntegBusy(false);
    }
  }

  async function handleCsvRosterUpload(file: File | null) {
    if (!file) return;
    const text = await file.text();
    setIntegCsvText(text);
  }

  async function handleOpenEvidence(storagePath: string) {
    setEvidenceError(null);
    const token = await getToken();
    const res = await fetch(storagePath, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) {
      const errData = (await res.json().catch(() => ({}))) as { error?: string };
      setEvidenceError(errData.error || 'Access denied or evidence file unavailable.');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function toggleGrievanceSelection(grievanceId: string) {
    setBatchFeedback(null);
    setBatchError(null);
    setSelectedGrievanceIds((prev) =>
      prev.includes(grievanceId)
        ? prev.filter((id) => id !== grievanceId)
        : [...prev, grievanceId]
    );
  }

  function toggleSelectAllFiltered() {
    setBatchFeedback(null);
    setBatchError(null);
    const filteredIds = filteredGrievances.map((g) => g.id);
    if (allFilteredSelected) {
      const filteredSet = new Set(filteredIds);
      setSelectedGrievanceIds((prev) => prev.filter((id) => !filteredSet.has(id)));
    } else {
      setSelectedGrievanceIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
    }
  }

  function clearGrievanceSelection() {
    setSelectedGrievanceIds([]);
  }

  async function handleBatchUpdateGrievances(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.email || selectedGrievances.length === 0) return;

    setBatchUpdating(true);
    setBatchFeedback(null);
    setBatchError(null);
    try {
      const { updatedCount } = await batchUpdateGrievancesByAdmin({
        grievances: selectedGrievances,
        status: batchStatus,
        escalationLevel: batchEscalation,
        resolutionNotes: batchNote,
        adminUid: user.uid,
        adminEmail: user.email,
        actorRole: isActiveCollegeAdmin ? 'college_admin' : 'state_admin',
      });
      setSelectedGrievanceIds([]);
      setBatchNote('');
      setBatchEscalation('keep');
      setBatchFeedback(
        `Updated ${updatedCount} selected grievance ticket(s) to "${batchStatus}".`
      );
    } catch (err) {
      setBatchError(
        err instanceof Error ? err.message : 'Unable to complete batch grievance update.'
      );
    } finally {
      setBatchUpdating(false);
    }
  }

  function handleExportStudents(format: 'csv' | 'xlsx') {
    setStudentExportFeedback(null);
    setStudentExportError(null);
    if (students.length === 0) {
      setStudentExportError('No student registrations available to export.');
      return;
    }

    const meta = {
      collegeCode: collegeAdminProfile?.collegeCode || collegeDoc?.code || targetCollegeId,
      collegeName: collegeAdminProfile?.collegeName || collegeDoc?.name || 'College',
    };

    try {
      const result =
        format === 'csv'
          ? exportStudentsToCsv(students, meta)
          : exportStudentsToExcel(students, meta);

      setStudentExportFeedback(
        `Exported ${result.rowCount} student registration(s) to ${result.fileName}.`
      );

      if (user?.email) {
        void writeAuditLog({
          actorUid: user.uid,
          actorEmail: user.email,
          actorRole: isActiveCollegeAdmin ? 'college_admin' : 'state_admin',
          action:
            format === 'csv'
              ? 'STUDENT_REGISTRATIONS_EXPORTED_CSV'
              : 'STUDENT_REGISTRATIONS_EXPORTED_XLSX',
          targetCollection: 'students',
          targetId: targetCollegeId,
          collegeId: targetCollegeId,
          summary: `Exported ${result.rowCount} student registration(s) as ${format.toUpperCase()} (${result.fileName}).`,
        }).catch(() => undefined);
      }
    } catch (err) {
      setStudentExportError(
        err instanceof Error ? err.message : 'Unable to export student registrations.'
      );
    }
  }

  async function handleSaveAcademicRecord(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.email) return;
    const stu = students.find((s) => s.uid === acadStudentUid);
    if (!stu || !acadSubjCode.trim() || !acadSubjName.trim()) return;
    const internal = Math.max(0, Number(acadInternal) || 0);
    const external = Math.max(0, Number(acadExternal) || 0);
    await upsertAcademicRecordByAdmin({
      record: {
        studentUid: stu.uid,
        studentRollId: stu.studentRollId,
        studentName: stu.fullName,
        collegeId: stu.collegeId,
        collegeCode: stu.collegeCode,
        academicYear: acadYear.trim() || '2026-27',
        semester: acadSemester.trim() || 'Semester IV',
        subjectCode: acadSubjCode.trim().toUpperCase(),
        subjectName: acadSubjName.trim(),
        facultyName: acadFaculty.trim() || 'Faculty',
        credits: Math.max(1, Math.min(10, Number(acadCredits) || 3)),
        classesTotal: Math.max(0, Number(acadClassesTotal) || 0),
        classesAttended: Math.max(0, Number(acadClassesAttended) || 0),
        internalMarks: internal,
        externalMarks: external,
        totalMarks: internal + external,
        grade: acadGrade,
        resultStatus: acadResult,
        isDemo: acadIsDemo,
        collegeAdminEmails: stu.collegeAdminEmails || [user.email],
      },
      adminUid: user.uid,
      adminEmail: user.email,
      actorRole: isActiveCollegeAdmin ? 'college_admin' : 'state_admin',
    });
    setAcadSubjCode('');
    setAcadSubjName('');
    setAcadFeedback(
      `Published ${acadSubjCode.trim().toUpperCase()} attendance & marks for ${stu.fullName} and notified the student.`
    );
  }

  async function handleSaveTimetableSlot(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.email || !ttSubjCode.trim() || !ttSubjName.trim()) return;
    await upsertTimetableSlotByAdmin({
      slot: {
        collegeId: targetCollegeId,
        collegeCode: collegeAdminProfile?.collegeCode || collegeDoc?.code || targetCollegeId,
        department: ttDept.trim() || 'CSE',
        academicYear: ttYear.trim() || '2026-27',
        semester: ttSem.trim() || 'Semester IV',
        dayOfWeek: ttDay,
        startTime: ttStart.trim(),
        endTime: ttEnd.trim(),
        subjectCode: ttSubjCode.trim().toUpperCase(),
        subjectName: ttSubjName.trim(),
        facultyName: ttFaculty.trim() || 'Faculty',
        roomNumber: ttRoom.trim() || 'LH-101',
        slotType: ttType,
        isDemo: ttIsDemo,
      },
      adminUid: user.uid,
      adminEmail: user.email,
      actorRole: isActiveCollegeAdmin ? 'college_admin' : 'state_admin',
    });
    setTtSubjCode('');
    setTtSubjName('');
    setTtFeedback(`Saved ${ttDay} (${ttStart}–${ttEnd}) timetable slot.`);
  }

  async function handleSeedTimetable() {
    if (!user?.email) return;
    await seedSampleTimetableByAdmin({
      collegeId: targetCollegeId,
      collegeCode: collegeAdminProfile?.collegeCode || collegeDoc?.code || targetCollegeId,
      department: ttDept.trim() || 'CSE',
      academicYear: ttYear.trim() || '2026-27',
      semester: ttSem.trim() || 'Semester IV',
      adminUid: user.uid,
      adminEmail: user.email,
      actorRole: isActiveCollegeAdmin ? 'college_admin' : 'state_admin',
    });
    setTtFeedback('Seeded weekly Mon–Sat sample timetable slots for your college.');
  }

  async function handleCreatePlacementDrive(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.email || !drvTitle.trim() || !drvCompany.trim()) return;
    await upsertPlacementOpportunityByAdmin({
      opportunity: {
        collegeId: targetCollegeId,
        collegeCode: collegeAdminProfile?.collegeCode || collegeDoc?.code || targetCollegeId,
        title: drvTitle.trim(),
        companyName: drvCompany.trim(),
        opportunityType: drvType,
        roleCategory: drvCategory.trim() || 'Engineering / Degree',
        ctcOrStipend: drvCtc.trim() || 'As per company norms',
        location: drvLocation.trim() || 'On-Campus / Hybrid',
        eligibilityCriteria: drvEligibility.trim(),
        minCgpa: Math.max(0, Math.min(10, Number(drvMinCgpa) || 6.0)),
        deadlineDate: drvDeadline.trim(),
        applyUrl: drvUrl.trim(),
        status: 'Open',
        description: drvDesc.trim() || `${drvCompany.trim()} campus drive for eligible students.`,
        isDemo: drvIsDemo,
        collegeAdminEmails: [user.email],
      },
      adminUid: user.uid,
      adminEmail: user.email,
      actorRole: isActiveCollegeAdmin ? 'college_admin' : 'state_admin',
    });
    setDrvTitle('');
    setDrvCompany('');
    setDrvDesc('');
    setDrvFeedback('Placement / internship drive published to eligible college students.');
  }

  async function handleCreateCollegeService(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.email) return;
    const stu = students.find((s) => s.uid === srvStudentUid);
    if (!stu || !srvTitle.trim() || !srvPrimary.trim()) return;
    await upsertCollegeServiceByAdmin({
      service: {
        studentUid: stu.uid,
        studentRollId: stu.studentRollId,
        studentName: stu.fullName,
        collegeId: stu.collegeId,
        collegeCode: stu.collegeCode,
        serviceType: srvType,
        requestTitle: srvTitle.trim(),
        referenceCode: srvRefCode.trim() || `PASS-${String(Date.now()).slice(-6)}`,
        detailsPrimary: srvPrimary.trim(),
        detailsSecondary: srvSecondary.trim() || `Academic Year ${stu.academicYear}`,
        status: srvStatus,
        authorityRemark: `Issued directly by ${stu.collegeCode} administration.`,
        isDemo: srvIsDemo,
        collegeAdminEmails: stu.collegeAdminEmails || [user.email],
      },
      adminUid: user.uid,
      adminEmail: user.email,
      actorRole: isActiveCollegeAdmin ? 'college_admin' : 'state_admin',
    });
    setSrvTitle('');
    setSrvPrimary('');
    setSrvSecondary('');
    setSrvRefCode('');
    setSrvFeedback(`Assigned ${srvType} pass/allotment to ${stu.fullName} and notified the student.`);
  }

  const mergedLiveCollegeMedia = useMemo(() => {
    const map = new Map<string, CollegeMediaRecord>();
    for (const item of approvedMediaForCollege) map.set(item.id, item);
    for (const item of collegeMediaOwn) map.set(item.id, item);
    return Array.from(map.values());
  }, [approvedMediaForCollege, collegeMediaOwn]);

  const seededMediaForThisCollege = useMemo(
    () => VERIFIED_SEEDED_MEDIA.filter((m) => m.collegeId === targetCollegeId),
    [targetCollegeId]
  );

  async function handleSelectMediaFile(file: File | null) {
    setMediaError(null);
    setMediaFeedback(null);
    if (!file) {
      setMediaCompressed(null);
      if (mediaPreviewUrl) {
        URL.revokeObjectURL(mediaPreviewUrl);
        setMediaPreviewUrl(null);
      }
      return;
    }

    setMediaCompressing(true);
    try {
      const compressed = await compressInstitutionalImage(file, {
        maxDimension: mediaCategory === 'Official Logo' ? 512 : 1600,
        quality: 0.82,
        preserveAlpha: mediaCategory === 'Official Logo',
      });
      if (mediaPreviewUrl) URL.revokeObjectURL(mediaPreviewUrl);
      const nextPreview = URL.createObjectURL(compressed.file);
      setMediaPreviewUrl(nextPreview);
      setMediaCompressed(compressed);
    } catch (err) {
      setMediaCompressed(null);
      setMediaError(err instanceof Error ? err.message : 'Unable to process image file.');
    } finally {
      setMediaCompressing(false);
    }
  }

  async function handleUploadCollegeMedia(e: React.FormEvent) {
    e.preventDefault();
    setMediaError(null);
    setMediaFeedback(null);
    if (!user?.email || !mediaCompressed) {
      setMediaError('Please select a JPEG, PNG, or WEBP photograph belonging specifically to your college.');
      return;
    }
    if (!mediaConsentAttested) {
      setMediaError('You must confirm permission and confirm no readable student IDs, phone numbers, or unauthorized PII appear in the photo.');
      return;
    }

    setMediaUploading(true);
    try {
      const token = await getToken();
      const fd = new FormData();
      fd.append('file', mediaCompressed.file);
      fd.append('collegeId', targetCollegeId);

      const res = await fetch('/api/college-media/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const uploadData = (await res.json()) as {
        mediaId?: string;
        storagePath?: string;
        imageUrl?: string;
        mimeType?: string;
        sizeBytes?: number;
        sha256?: string;
        error?: string;
      };
      if (!res.ok || !uploadData.mediaId || !uploadData.imageUrl || !uploadData.sha256) {
        throw new Error(uploadData.error || 'Institutional image upload failed.');
      }

      const fallbackDemoCol = DEMO_COLLEGES.find((c) => c.id === targetCollegeId);
      const colInfo = {
        id: targetCollegeId,
        code: collegeAdminProfile?.collegeCode || collegeDoc?.code || fallbackDemoCol?.code || targetCollegeId,
        name: collegeAdminProfile?.collegeName || collegeDoc?.name || fallbackDemoCol?.name || 'College',
        district: collegeDoc?.district || fallbackDemoCol?.district || 'Andhra Pradesh',
      };

      await submitCollegeMediaByAdmin({
        mediaId: uploadData.mediaId,
        college: colInfo,
        mediaCategory,
        title: mediaTitle.trim(),
        caption: mediaCaption.trim(),
        imageUrl: uploadData.imageUrl,
        storagePath: uploadData.storagePath || uploadData.imageUrl,
        mimeType: uploadData.mimeType || mediaCompressed.mimeType,
        width: mediaCompressed.width,
        height: mediaCompressed.height,
        sizeBytes: uploadData.sizeBytes || mediaCompressed.compressedSize,
        sha256: uploadData.sha256,
        sourceUrl: mediaSourceUrl.trim(),
        licenseOrPermission: mediaLicense.trim(),
        consentAttested: mediaConsentAttested,
        uploaderUid: user.uid,
        uploaderEmail: user.email,
        actorRole: isActiveCollegeAdmin ? 'college_admin' : 'state_admin',
      });

      setMediaTitle('');
      setMediaCaption('');
      setMediaSourceUrl('');
      setMediaConsentAttested(false);
      setMediaCompressed(null);
      if (mediaPreviewUrl) {
        URL.revokeObjectURL(mediaPreviewUrl);
        setMediaPreviewUrl(null);
      }
      setMediaFeedback(
        isActiveCollegeAdmin
          ? 'Photograph uploaded & compressed cleanly. Submitted to the State Admin queue for verification before public release.'
          : 'Photograph uploaded & published to the live verified institutional gallery.'
      );
    } catch (err) {
      setMediaError(err instanceof Error ? err.message : 'Unable to submit college photograph.');
    } finally {
      setMediaUploading(false);
    }
  }

  const tabs: { id: CollegeAdminTab; label: string; icon: React.ReactNode }[] = [
    { id: 'students', label: 'Verify Students', icon: <Users className="w-4 h-4" /> },
    { id: 'academics', label: 'Academics & Timetable', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'placements', label: 'Placements & Jobs', icon: <Briefcase className="w-4 h-4" /> },
    { id: 'campus_services', label: 'Hostel, Bus & Library', icon: <Home className="w-4 h-4" /> },
    { id: 'media', label: 'College Photos', icon: <Camera className="w-4 h-4" /> },
    { id: 'scholarships', label: 'Scholarships', icon: <Award className="w-4 h-4" /> },
    { id: 'grievances', label: 'Grievances', icon: <Scale className="w-4 h-4" /> },
    { id: 'fees', label: 'Fee Records', icon: <IndianRupee className="w-4 h-4" /> },
    { id: 'integrations', label: 'Fee Schedules & ERP', icon: <Database className="w-4 h-4" /> },
    { id: 'profile_notices', label: 'Profile & Notices', icon: <Bell className="w-4 h-4" /> },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-5 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="text-xs font-mono text-[#1E40AF] dark:text-blue-400">
            {collegeAdminProfile?.collegeCode} · College-Isolated Administration
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">
            {collegeAdminProfile?.collegeName}
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
      {/* TAB 1: VERIFY STUDENTS */}
      {tab === 'students' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-display font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                  Registered Students ({students.length})
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Review institutional registrations and export the full roster for offline audit.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={students.length === 0}
                  onClick={() => handleExportStudents('csv')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0 ash-btn-press"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export CSV ({students.length})
                </button>
                <button
                  type="button"
                  disabled={students.length === 0}
                  onClick={() => handleExportStudents('xlsx')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#1E40AF] dark:bg-blue-600 hover:bg-[#1E3A8A] dark:hover:bg-blue-500 rounded-lg disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0 ash-btn-press"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Export Excel (.xlsx)
                </button>
              </div>
            </div>

            {students.length > 0 && (
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
                <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                  {(['All', 'Pending', 'Verified', 'Rejected'] as const).map((statusOpt) => (
                    <button
                      key={statusOpt}
                      type="button"
                      onClick={() => setStudentStatusFilter(statusOpt)}
                      className={`px-2.5 py-1.5 text-xs font-semibold rounded-md cursor-pointer whitespace-nowrap shrink-0 tabular-nums transition-colors ${
                        studentStatusFilter === statusOpt
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {statusOpt} ({studentStatusCounts[statusOpt]})
                    </button>
                  ))}
                </div>

                <div className="relative w-full md:w-72">
                  <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    placeholder="Filter by name, roll ID, email, course..."
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />
                </div>
              </div>
            )}

            {studentExportFeedback && (
              <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/70 text-xs text-emerald-800 dark:text-emerald-300">
                {studentExportFeedback}
              </div>
            )}
            {studentExportError && (
              <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/70 text-xs text-red-700 dark:text-red-300">
                {studentExportError}
              </div>
            )}
          </div>
          {students.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
              No student registrations found for this institution yet.
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="p-8 text-center space-y-3">
              <div className="text-sm text-slate-600 dark:text-slate-300">
                No students match the selected verification filter or search query.
              </div>
              <button
                type="button"
                onClick={() => {
                  setStudentStatusFilter('All');
                  setStudentSearch('');
                }}
                className="px-3.5 py-1.5 text-xs font-semibold text-[#1E40AF] dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/60 cursor-pointer"
              >
                Reset Student Filters
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Student & Email</th>
                    <th className="px-4 py-3 font-semibold">Roll ID</th>
                    <th className="px-4 py-3 font-semibold">Programme</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredStudents.map((stu) => (
                    <tr key={stu.uid} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {stu.fullName}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {stu.email} · {stu.mobile}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-800 dark:text-slate-200">
                        {stu.studentRollId}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-700 dark:text-slate-300">
                        {stu.course} · {stu.branch} ({stu.academicYear})
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {stu.verificationStatus}
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <button
                          type="button"
                          onClick={() =>
                            user?.email &&
                            verifyStudentByCollegeAdmin({
                              studentUid: stu.uid,
                              status: 'Verified',
                              adminUid: user.uid,
                              adminEmail: user.email,
                              collegeId: stu.collegeId,
                            })
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900/60 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Verify
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            user?.email &&
                            verifyStudentByCollegeAdmin({
                              studentUid: stu.uid,
                              status: 'Rejected',
                              adminUid: user.uid,
                              adminEmail: user.email,
                              collegeId: stu.collegeId,
                            })
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/60 rounded hover:bg-red-100 dark:hover:bg-red-900/60 cursor-pointer"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Reject
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 1B: SCHOLARSHIP APPLICATIONS */}
      {tab === 'scholarships' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 space-y-2">
            <h2 className="font-display font-bold text-slate-900 dark:text-slate-100 tabular-nums">
              Scholarship Applications ({scholarshipApps.length})
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Updating status automatically dispatches a notification to the student&apos;s portal.
            </p>
            {scholarshipFeedback && (
              <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/70 text-xs text-emerald-800 dark:text-emerald-300">
                {scholarshipFeedback}
              </div>
            )}
          </div>
          {scholarshipApps.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
              No scholarship applications tracked for this institution yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {scholarshipApps.map((app) => (
                <div
                  key={app.id}
                  className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
                      {app.applicationRef} · {app.studentName} · Current: {app.status}
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
                  <div className="flex flex-wrap gap-1.5">
                    {(
                      [
                        'Institution Verified',
                        'Disbursement Pending',
                        'Disbursed',
                        'Query Raised',
                      ] as ScholarshipApplicationRecord['status'][]
                    ).map((nextStatus) => (
                      <button
                        key={nextStatus}
                        type="button"
                        onClick={async () => {
                          if (!user?.email) return;
                          await updateScholarshipApplicationByAdmin({
                            application: app,
                            status: nextStatus,
                            adminUid: user.uid,
                            adminEmail: user.email,
                            actorRole: isActiveCollegeAdmin ? 'college_admin' : 'state_admin',
                          });
                          setScholarshipFeedback(
                            `Updated ${app.applicationRef} to "${nextStatus}" and alerted ${app.studentName}.`
                          );
                        }}
                        className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
                          app.status === nextStatus
                            ? 'bg-[#1E40AF] dark:bg-blue-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {nextStatus}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: COLLEGE GRIEVANCES & EVIDENCE VERIFICATION */}
      {tab === 'grievances' && (
        <div className="space-y-4">
          {/* Grievance Filter & Search Toolbar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                {(
                  [
                    'All',
                    'Submitted',
                    'Under College Review',
                    'Escalated to University/State',
                    'Resolved',
                    'Closed',
                  ] as const
                ).map((statusOption) => (
                  <button
                    key={statusOption}
                    type="button"
                    onClick={() => setGrievanceStatusFilter(statusOption)}
                    className={`px-2.5 py-1.5 text-xs font-semibold rounded-md cursor-pointer whitespace-nowrap shrink-0 tabular-nums transition-colors ${
                      grievanceStatusFilter === statusOption
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {statusOption} ({grievanceStatusCounts[statusOption]})
                  </button>
                ))}
              </div>

              <div className="relative w-full lg:w-72">
                <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={grievanceSearch}
                  onChange={(e) => setGrievanceSearch(e.target.value)}
                  placeholder="Search tracking #, student, subject..."
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
              </div>
            </div>

            {/* Batch Update Controls */}
            <form
              onSubmit={handleBatchUpdateGrievances}
              className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      disabled={filteredGrievances.length === 0}
                      onChange={toggleSelectAllFiltered}
                      className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 dark:bg-slate-950 text-[#1E40AF] cursor-pointer"
                    />
                    Select All Visible ({filteredGrievances.length})
                  </label>
                  <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    <span className="font-mono font-semibold text-[#1E40AF] dark:text-blue-400">
                      {selectedGrievances.length}
                    </span>{' '}
                    selected for batch update
                  </span>
                  {selectedGrievances.length > 0 && (
                    <button
                      type="button"
                      onClick={clearGrievanceSelection}
                      className="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white underline cursor-pointer whitespace-nowrap shrink-0"
                    >
                      Clear selection
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <Layers className="w-3.5 h-3.5 text-[#1E40AF] dark:text-blue-400" />
                  <span>Bulk Status Action</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 items-center">
                <div className="lg:col-span-3">
                  <label className="sr-only" htmlFor="batch-grievance-status">
                    Target Status
                  </label>
                  <select
                    id="batch-grievance-status"
                    value={batchStatus}
                    onChange={(e) =>
                      setBatchStatus(e.target.value as GrievanceRecord['status'])
                    }
                    className="w-full px-3 py-2 text-xs font-medium border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  >
                    <option value="Under College Review">Set: Under College Review</option>
                    <option value="Escalated to University/State">
                      Set: Escalated to University/State
                    </option>
                    <option value="Resolved">Set: Resolved</option>
                    <option value="Closed">Set: Closed</option>
                    <option value="Submitted">Set: Submitted</option>
                  </select>
                </div>

                <div className="lg:col-span-3">
                  <label className="sr-only" htmlFor="batch-grievance-escalation">
                    Escalation Level
                  </label>
                  <select
                    id="batch-grievance-escalation"
                    value={batchEscalation}
                    onChange={(e) =>
                      setBatchEscalation(
                        e.target.value as GrievanceRecord['escalationLevel'] | 'keep'
                      )
                    }
                    className="w-full px-3 py-2 text-xs font-medium border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  >
                    <option value="keep">Escalation: Keep Existing (Auto on Escalate)</option>
                    <option value="College Nodal Officer">College Nodal Officer</option>
                    <option value="Principal / Dean">Principal / Dean</option>
                    <option value="University Grievance Cell">University Grievance Cell</option>
                    <option value="State Oversight">State Oversight</option>
                  </select>
                </div>

                <div className="lg:col-span-4">
                  <label className="sr-only" htmlFor="batch-grievance-note">
                    Shared Resolution Note
                  </label>
                  <input
                    id="batch-grievance-note"
                    type="text"
                    maxLength={1500}
                    value={batchNote}
                    onChange={(e) => setBatchNote(e.target.value)}
                    placeholder="Optional shared note (blank keeps existing or adds status note)"
                    className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />
                </div>

                <div className="lg:col-span-2">
                  <button
                    type="submit"
                    disabled={selectedGrievances.length === 0 || batchUpdating}
                    className="w-full px-3.5 py-2 text-xs font-semibold text-white bg-[#1E40AF] dark:bg-blue-600 rounded-lg hover:bg-[#1E3A8A] dark:hover:bg-blue-500 disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0 ash-btn-press"
                  >
                    {batchUpdating
                      ? 'Updating...'
                      : `Apply (${selectedGrievances.length})`}
                  </button>
                </div>
              </div>

              {batchFeedback && (
                <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/70 text-xs text-emerald-800 dark:text-emerald-300">
                  {batchFeedback}
                </div>
              )}
              {batchError && (
                <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/70 text-xs text-red-700 dark:text-red-300">
                  {batchError}
                </div>
              )}
              {evidenceError && (
                <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/70 text-xs text-red-700 dark:text-red-300">
                  {evidenceError}
                </div>
              )}
            </form>
          </div>

          {grievances.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center text-sm text-slate-500 dark:text-slate-400">
              No grievances submitted for this institution.
            </div>
          ) : filteredGrievances.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center space-y-3">
              <div className="text-sm text-slate-600 dark:text-slate-300">
                No grievances match the current status filter or search query.
              </div>
              <button
                type="button"
                onClick={() => {
                  setGrievanceStatusFilter('All');
                  setGrievanceSearch('');
                }}
                className="px-3.5 py-1.5 text-xs font-semibold text-[#1E40AF] dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/60 cursor-pointer"
              >
                Reset Grievance Filters
              </button>
            </div>
          ) : (
            filteredGrievances.map((g) => {
              const relEv = evidences.filter((e) => e.grievanceId === g.id);
              const draftNote = resolutionDrafts[g.id] ?? g.resolutionNotes;
              const isSelected = selectedGrievanceSet.has(g.id);
              return (
                <article
                  key={g.id}
                  className={`bg-white dark:bg-slate-900 border rounded-xl p-6 space-y-4 transition-colors ash-card-interactive ${
                    isSelected
                      ? 'border-[#1E40AF] dark:border-blue-500 ring-1 ring-[#1E40AF]/20 dark:ring-blue-500/30'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                    <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleGrievanceSelection(g.id)}
                        aria-label={`Select grievance ${g.trackingNumber}`}
                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 dark:bg-slate-950 text-[#1E40AF] cursor-pointer"
                      />
                      <span className="font-mono font-bold text-[#1E40AF] dark:text-blue-400">
                        {g.trackingNumber} · {g.studentName} ({g.contactMobile})
                      </span>
                    </label>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {g.status} · {g.escalationLevel} · AI Urgency: {g.aiUrgency}
                    </span>
                  </div>
                  <h3 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
                    {g.subject}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300">{g.description}</p>
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 text-xs text-slate-700 dark:text-slate-300">
                    <span className="font-semibold">AI Triage:</span> {g.aiTriageSummary} (
                    {g.aiVerificationDisclaimer})
                  </div>

                  {relEv.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Evidence Verification (Human Authority Decision Required)
                      </div>
                      {relEv.map((ev) => (
                        <div
                          key={ev.id}
                          className="p-3 rounded-lg border border-slate-200 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-800/40 flex flex-wrap items-center justify-between gap-3 text-xs"
                        >
                          <div>
                            <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                              {ev.fileName}
                            </span>{' '}
                            ·{' '}
                            <span className="text-amber-700 dark:text-amber-400 font-semibold">
                              {ev.humanVerificationStatus}
                            </span>
                            <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                              {ev.aiAssistNote}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenEvidence(ev.storagePath)}
                              className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded font-semibold cursor-pointer"
                            >
                              Inspect File
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                verifyEvidenceByAdmin({
                                  evidenceId: ev.id,
                                  status: 'Verified by Authority',
                                  adminUid: user.uid,
                                })
                              }
                              className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 rounded font-semibold cursor-pointer"
                            >
                              Mark Verified
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                verifyEvidenceByAdmin({
                                  evidenceId: ev.id,
                                  status: 'Needs Clarification',
                                  adminUid: user.uid,
                                })
                              }
                              className="px-2.5 py-1 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-300 rounded font-semibold cursor-pointer"
                            >
                              Needs Clarification
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
                    <textarea
                      rows={2}
                      value={draftNote}
                      onChange={(e) =>
                        setResolutionDrafts((prev) => ({ ...prev, [g.id]: e.target.value }))
                      }
                      placeholder="Enter official resolution or action note..."
                      className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    />
                    <div className="flex flex-wrap gap-2">
                      {(
                        [
                          'Under College Review',
                          'Escalated to University/State',
                          'Resolved',
                          'Closed',
                        ] as GrievanceRecord['status'][]
                      ).map((nextStatus) => (
                        <button
                          key={nextStatus}
                          type="button"
                          onClick={() =>
                            user?.email &&
                            updateGrievanceByAdmin({
                              grievanceId: g.id,
                              collegeId: g.collegeId,
                              status: nextStatus,
                              escalationLevel:
                                nextStatus === 'Escalated to University/State'
                                  ? 'University Grievance Cell'
                                  : g.escalationLevel,
                              resolutionNotes: draftNote || `Status updated to ${nextStatus}.`,
                              adminUid: user.uid,
                              adminEmail: user.email,
                              actorRole: isActiveCollegeAdmin ? 'college_admin' : 'state_admin',
                              studentUid: g.studentUid,
                              trackingNumber: g.trackingNumber,
                              subject: g.subject,
                              collegeAdminEmails: g.collegeAdminEmails,
                            })
                          }
                          className="px-3 py-1.5 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg cursor-pointer"
                        >
                          Set {nextStatus}
                        </button>
                      ))}
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      )}

      {/* TAB 3: FEE RECORDS */}
      {tab === 'fees' && (
        <div className="space-y-6">
          {feeMessage && (
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/70 text-xs text-emerald-800 dark:text-emerald-300">
              {feeMessage}
            </div>
          )}

          <form
            onSubmit={handleCreateFee}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4"
          >
            <h2 className="font-display font-bold text-slate-900 dark:text-slate-100">
              Publish Student Fee Record
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
              <select
                value={selectedStudentUid}
                onChange={(e) => setSelectedStudentUid(e.target.value)}
                className="lg:col-span-2 px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              >
                {students.map((s) => (
                  <option key={s.uid} value={s.uid}>
                    {s.studentRollId} — {s.fullName}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={feeSem}
                onChange={(e) => setFeeSem(e.target.value)}
                placeholder="Semester"
                className="px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
              <select
                value={feeCategory}
                onChange={(e) => setFeeCategory(e.target.value as NonNullable<FeeRecord['feeCategory']>)}
                className="px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              >
                <option value="Tuition Fee">Tuition Fee</option>
                <option value="Hostel & Mess">Hostel & Mess</option>
                <option value="Exam Fee">Exam Fee</option>
                <option value="Lab & Library">Lab & Library</option>
                <option value="Composite Term Fee">Composite Term Fee</option>
              </select>
              <input
                type="number"
                value={totalFeeInput}
                onChange={(e) => setTotalFeeInput(e.target.value)}
                placeholder="Total INR"
                className="px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg font-mono bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
              <input
                type="number"
                value={paidFeeInput}
                onChange={(e) => setPaidFeeInput(e.target.value)}
                placeholder="Paid INR"
                className="px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg font-mono bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                value={feeYear}
                onChange={(e) => setFeeYear(e.target.value)}
                placeholder="Academic Year (e.g., 2026-27)"
                className="px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
              <input
                type="date"
                value={feeDueDate}
                onChange={(e) => setFeeDueDate(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg font-mono bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isDemoFee}
                  onChange={(e) => setIsDemoFee(e.target.checked)}
                  className="rounded border-slate-300 dark:border-slate-600 dark:bg-slate-950 text-[#1E40AF]"
                />
                Mark as DEMO sample record
              </label>
              <button
                type="submit"
                disabled={students.length === 0}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#1E40AF] dark:bg-blue-600 rounded-lg hover:bg-[#1E3A8A] dark:hover:bg-blue-500 disabled:opacity-50 cursor-pointer"
              >
                Create Fee Record
              </button>
            </div>
          </form>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 font-display font-bold text-slate-900 dark:text-slate-100">
              College Fee Ledgers ({feeRecords.length})
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {feeRecords.map((rec) => (
                <div
                  key={rec.id}
                  className="px-6 py-4 flex flex-wrap items-center justify-between gap-4 text-sm"
                >
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-slate-100">
                      {rec.studentName} ({rec.studentRollId}) · {rec.semester}
                      {rec.feeCategory ? ` · ${rec.feeCategory}` : ''}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Total: ₹{rec.totalFee.toLocaleString('en-IN')} · Paid: ₹
                      {rec.paidAmount.toLocaleString('en-IN')} · Pending: ₹
                      {rec.pendingAmount.toLocaleString('en-IN')} · {rec.status}
                      {rec.dueDate ? ` · Due ${rec.dueDate}` : ''}
                    </div>
                    {rec.discrepancyReported && (
                      <div className="text-xs text-red-700 dark:text-red-400 mt-1">
                        Discrepancy: {rec.discrepancyNote}
                      </div>
                    )}
                  </div>
                  {rec.pendingAmount > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        user?.email &&
                        recordFeePaymentByAdmin({
                          feeRecord: rec,
                          amount: rec.pendingAmount,
                          paymentMode: rec.isDemo ? 'DEMO' : 'UPI',
                          receiptNumber: `ASH-${String(Date.now()).slice(-6)}`,
                          adminUid: user.uid,
                          adminEmail: user.email,
                        })
                      }
                      className="px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/60 cursor-pointer"
                    >
                      Mark Full Payment Received
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: ACADEMICS (DEPARTMENTS, COURSES, ATTENDANCE & MARKS, TIMETABLE) */}
      {tab === 'academics' && (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg w-fit">
            {(
              [
                { id: 'depts_courses', label: `Departments & Courses (${departments.length}/${courses.length})` },
                { id: 'attendance_marks', label: `Attendance, Marks & Results (${academicRecords.length})` },
                { id: 'timetable', label: `Weekly Timetable (${timetableSlots.length})` },
              ] as const
            ).map((sub) => (
              <button
                key={sub.id}
                type="button"
                onClick={() => setAcademicsSubTab(sub.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md cursor-pointer transition-colors ${
                  academicsSubTab === sub.id
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {sub.label}
              </button>
            ))}
          </div>

          {academicsSubTab === 'depts_courses' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
            <h2 className="font-display font-bold text-slate-900 dark:text-slate-100">
              Academic Departments ({departments.length})
            </h2>
            {deptFeedback && (
              <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/70 text-xs text-emerald-800 dark:text-emerald-300">
                {deptFeedback}
              </div>
            )}
            <form onSubmit={handleAddDepartment} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                required
                value={deptCode}
                onChange={(e) => setDeptCode(e.target.value)}
                placeholder="Dept Code (e.g., CSE)"
                className="px-3 py-2 text-xs font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
              <input
                type="text"
                required
                value={deptName}
                onChange={(e) => setDeptName(e.target.value)}
                placeholder="Department Name"
                className="px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
              <input
                type="text"
                value={deptHod}
                onChange={(e) => setDeptHod(e.target.value)}
                placeholder="HoD Name (Optional)"
                className="px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
              <input
                type="email"
                value={deptEmail}
                onChange={(e) => setDeptEmail(e.target.value)}
                placeholder="Department Email (Optional)"
                className="px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
              <button
                type="submit"
                className="sm:col-span-2 inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1E40AF] dark:bg-blue-600 rounded-lg hover:bg-[#1E3A8A] cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Save Department
              </button>
            </form>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {departments.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 py-2">
                  No custom departments published yet. Students see directory defaults until departments are added here.
                </p>
              ) : (
                departments.map((d) => (
                  <div key={d.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                    <div>
                      <span className="font-mono font-bold text-[#1E40AF] dark:text-blue-400">{d.code}</span> ·{' '}
                      <span className="font-semibold text-slate-900 dark:text-slate-100">{d.name}</span>
                      {d.hodName && <span className="text-slate-500 dark:text-slate-400"> · HoD: {d.hodName}</span>}
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteDepartmentByAdmin(d.id)}
                      className="text-red-600 dark:text-red-400 hover:underline cursor-pointer"
                      aria-label={`Delete department ${d.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
            <h2 className="font-display font-bold text-slate-900 dark:text-slate-100">
              Courses & Programmes ({courses.length})
            </h2>
            {crsFeedback && (
              <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/70 text-xs text-emerald-800 dark:text-emerald-300">
                {crsFeedback}
              </div>
            )}
            <form onSubmit={handleAddCourse} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                required
                value={crsName}
                onChange={(e) => setCrsName(e.target.value)}
                placeholder="Programme Name (e.g., B.Tech)"
                className="px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
              <select
                value={crsLevel}
                onChange={(e) => setCrsLevel(e.target.value as CourseRecord['degreeLevel'])}
                className="px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              >
                <option value="UG">UG</option>
                <option value="PG">PG</option>
                <option value="Diploma">Diploma</option>
                <option value="Integrated">Integrated</option>
              </select>
              <input
                type="text"
                required
                value={crsBranch}
                onChange={(e) => setCrsBranch(e.target.value)}
                placeholder="Branch / Specialization (e.g., CSE)"
                className="px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
              <input
                type="text"
                value={crsDept}
                onChange={(e) => setCrsDept(e.target.value)}
                placeholder="Department Name"
                className="px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
              <input
                type="number"
                min={1}
                max={6}
                value={crsYears}
                onChange={(e) => setCrsYears(e.target.value)}
                placeholder="Duration (Years)"
                className="px-3 py-2 text-xs font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
              <input
                type="number"
                min={0}
                value={crsIntake}
                onChange={(e) => setCrsIntake(e.target.value)}
                placeholder="Sanctioned Intake"
                className="px-3 py-2 text-xs font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
              <button
                type="submit"
                className="sm:col-span-2 inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1E40AF] dark:bg-blue-600 rounded-lg hover:bg-[#1E3A8A] cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Save Course
              </button>
            </form>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {courses.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 py-2">
                  No custom courses published yet.
                </p>
              ) : (
                courses.map((c) => (
                  <div key={c.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                    <div>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {c.degreeLevel} · {c.name} ({c.branch})
                      </span>
                      <div className="text-slate-500 dark:text-slate-400">
                        {c.durationYears} yrs · Intake {c.intake}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteCourseByAdmin(c.id)}
                      className="text-red-600 dark:text-red-400 hover:underline cursor-pointer"
                      aria-label={`Delete course ${c.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
          )}

          {academicsSubTab === 'attendance_marks' && (
            <div className="space-y-6">
              <form
                onSubmit={handleSaveAcademicRecord}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4"
              >
                <h2 className="font-display font-bold text-slate-900 dark:text-slate-100">
                  Publish Student Subject Attendance, Marks &amp; Grade
                </h2>
                {acadFeedback && (
                  <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/70 text-xs text-emerald-800 dark:text-emerald-300">
                    {acadFeedback}
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <select
                    value={acadStudentUid}
                    onChange={(e) => setAcadStudentUid(e.target.value)}
                    className="lg:col-span-2 px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  >
                    {students.map((s) => (
                      <option key={s.uid} value={s.uid}>
                        {s.studentRollId} — {s.fullName}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    required
                    value={acadYear}
                    onChange={(e) => setAcadYear(e.target.value)}
                    placeholder="Academic Year (2026-27)"
                    className="px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                  <input
                    type="text"
                    required
                    value={acadSemester}
                    onChange={(e) => setAcadSemester(e.target.value)}
                    placeholder="Semester IV"
                    className="px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                  <input
                    type="text"
                    required
                    value={acadSubjCode}
                    onChange={(e) => setAcadSubjCode(e.target.value)}
                    placeholder="Subject Code (e.g., CS401)"
                    className="px-3 py-2 text-xs font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                  <input
                    type="text"
                    required
                    value={acadSubjName}
                    onChange={(e) => setAcadSubjName(e.target.value)}
                    placeholder="Subject Title"
                    className="lg:col-span-2 px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                  <input
                    type="text"
                    value={acadFaculty}
                    onChange={(e) => setAcadFaculty(e.target.value)}
                    placeholder="Faculty Name"
                    className="px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={acadCredits}
                    onChange={(e) => setAcadCredits(e.target.value)}
                    placeholder="Credits"
                    className="px-3 py-2 text-xs font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                  <input
                    type="number"
                    min={0}
                    value={acadClassesAttended}
                    onChange={(e) => setAcadClassesAttended(e.target.value)}
                    placeholder="Classes Attended"
                    className="px-3 py-2 text-xs font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                  <input
                    type="number"
                    min={0}
                    value={acadClassesTotal}
                    onChange={(e) => setAcadClassesTotal(e.target.value)}
                    placeholder="Total Classes Held"
                    className="px-3 py-2 text-xs font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={acadInternal}
                    onChange={(e) => setAcadInternal(e.target.value)}
                    placeholder="Internal Marks"
                    className="px-3 py-2 text-xs font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={acadExternal}
                    onChange={(e) => setAcadExternal(e.target.value)}
                    placeholder="External Marks"
                    className="px-3 py-2 text-xs font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                  <select
                    value={acadGrade}
                    onChange={(e) => setAcadGrade(e.target.value as AcademicSubjectRecord['grade'])}
                    className="px-3 py-2 text-xs font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  >
                    <option value="O">Grade O (10)</option>
                    <option value="A+">Grade A+ (9)</option>
                    <option value="A">Grade A (8)</option>
                    <option value="B+">Grade B+ (7)</option>
                    <option value="B">Grade B (6)</option>
                    <option value="C">Grade C (5)</option>
                    <option value="F">Grade F</option>
                    <option value="Pending">Grade Pending</option>
                  </select>
                  <select
                    value={acadResult}
                    onChange={(e) => setAcadResult(e.target.value as AcademicSubjectRecord['resultStatus'])}
                    className="px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  >
                    <option value="Pass">Result: Pass</option>
                    <option value="Fail">Result: Fail</option>
                    <option value="Pending">Result: Pending</option>
                  </select>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={acadIsDemo}
                      onChange={(e) => setAcadIsDemo(e.target.checked)}
                      className="rounded border-slate-300 dark:border-slate-600 text-[#1E40AF]"
                    />
                    Mark as DEMO academic sample
                  </label>
                  <button
                    type="submit"
                    disabled={students.length === 0}
                    className="px-4 py-2 text-xs font-semibold text-white bg-[#1E40AF] dark:bg-blue-600 rounded-lg hover:bg-[#1E3A8A] disabled:opacity-50 cursor-pointer"
                  >
                    Publish Subject Record
                  </button>
                </div>
              </form>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 font-display font-bold text-sm text-slate-900 dark:text-slate-100">
                  Recorded Subject Attendance &amp; Marks ({academicRecords.length})
                </div>
                {academicRecords.length === 0 ? (
                  <div className="p-6 text-xs text-slate-500 dark:text-slate-400">
                    No student academic subject records published yet.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {academicRecords.map((rec) => (
                      <div key={rec.id} className="px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-slate-100">
                            <span className="font-mono text-[#1E40AF] dark:text-blue-400 mr-1.5">{rec.subjectCode}</span>
                            {rec.subjectName} — {rec.studentName} ({rec.studentRollId})
                          </div>
                          <div className="text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                            {rec.semester} · Att {rec.classesAttended}/{rec.classesTotal} · Marks {rec.internalMarks}+{rec.externalMarks}={rec.totalMarks} · {rec.grade} ({rec.resultStatus})
                            {rec.isDemo ? ' · DEMO' : ''}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteAcademicRecordByAdmin(rec.id)}
                          className="text-red-600 dark:text-red-400 hover:underline cursor-pointer"
                          aria-label="Delete academic record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {academicsSubTab === 'timetable' && (
            <div className="space-y-6">
              <form
                onSubmit={handleSaveTimetableSlot}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="font-display font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <CalendarClock className="w-4 h-4 text-[#1E40AF] dark:text-blue-400" />
                    Publish College Weekly Timetable Slot
                  </h2>
                  <button
                    type="button"
                    onClick={handleSeedTimetable}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg cursor-pointer"
                  >
                    Seed Mon–Sat Sample Slots
                  </button>
                </div>
                {ttFeedback && (
                  <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/70 text-xs text-emerald-800 dark:text-emerald-300">
                    {ttFeedback}
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <input
                    type="text"
                    required
                    value={ttDept}
                    onChange={(e) => setTtDept(e.target.value)}
                    placeholder="Department (e.g., CSE)"
                    className="px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                  <input
                    type="text"
                    required
                    value={ttSem}
                    onChange={(e) => setTtSem(e.target.value)}
                    placeholder="Semester IV"
                    className="px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                  <select
                    value={ttDay}
                    onChange={(e) => setTtDay(e.target.value as TimetableSlotRecord['dayOfWeek'])}
                    className="px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  >
                    <option value="Monday">Monday</option>
                    <option value="Tuesday">Tuesday</option>
                    <option value="Wednesday">Wednesday</option>
                    <option value="Thursday">Thursday</option>
                    <option value="Friday">Friday</option>
                    <option value="Saturday">Saturday</option>
                  </select>
                  <select
                    value={ttType}
                    onChange={(e) => setTtType(e.target.value as TimetableSlotRecord['slotType'])}
                    className="px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  >
                    <option value="Lecture">Lecture</option>
                    <option value="Lab">Lab</option>
                    <option value="Tutorial">Tutorial</option>
                    <option value="Seminar">Seminar</option>
                  </select>
                  <input
                    type="text"
                    required
                    value={ttStart}
                    onChange={(e) => setTtStart(e.target.value)}
                    placeholder="Start (09:15)"
                    className="px-3 py-2 text-xs font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                  <input
                    type="text"
                    required
                    value={ttEnd}
                    onChange={(e) => setTtEnd(e.target.value)}
                    placeholder="End (10:15)"
                    className="px-3 py-2 text-xs font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                  <input
                    type="text"
                    required
                    value={ttSubjCode}
                    onChange={(e) => setTtSubjCode(e.target.value)}
                    placeholder="Subject Code (CS401)"
                    className="px-3 py-2 text-xs font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                  <input
                    type="text"
                    required
                    value={ttSubjName}
                    onChange={(e) => setTtSubjName(e.target.value)}
                    placeholder="Subject Name"
                    className="px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                  <input
                    type="text"
                    value={ttFaculty}
                    onChange={(e) => setTtFaculty(e.target.value)}
                    placeholder="Faculty Name"
                    className="px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                  <input
                    type="text"
                    value={ttRoom}
                    onChange={(e) => setTtRoom(e.target.value)}
                    placeholder="Room / Lab #"
                    className="px-3 py-2 text-xs font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ttIsDemo}
                      onChange={(e) => setTtIsDemo(e.target.checked)}
                      className="rounded border-slate-300 dark:border-slate-600 text-[#1E40AF]"
                    />
                    Mark as DEMO timetable slot
                  </label>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-semibold text-white bg-[#1E40AF] dark:bg-blue-600 rounded-lg hover:bg-[#1E3A8A] cursor-pointer"
                  >
                    Add Timetable Slot
                  </button>
                </div>
              </form>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 font-display font-bold text-sm text-slate-900 dark:text-slate-100">
                  Published Timetable Slots ({timetableSlots.length})
                </div>
                {timetableSlots.length === 0 ? (
                  <div className="p-6 text-xs text-slate-500 dark:text-slate-400">
                    No timetable slots published yet. Add slots above or click &quot;Seed Mon–Sat Sample Slots&quot;.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {timetableSlots.map((slot) => (
                      <div key={slot.id} className="px-6 py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div>
                          <span className="font-mono font-bold text-[#1E40AF] dark:text-blue-400">
                            {slot.dayOfWeek} · {slot.startTime}–{slot.endTime}
                          </span>{' '}
                          · <span className="font-semibold text-slate-900 dark:text-slate-100">{slot.subjectCode} {slot.subjectName}</span>{' '}
                          <span className="text-slate-500 dark:text-slate-400">
                            ({slot.slotType} · {slot.roomNumber} · {slot.facultyName})
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteTimetableSlotByAdmin(slot.id)}
                          className="text-red-600 dark:text-red-400 hover:underline cursor-pointer"
                          aria-label="Delete timetable slot"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4B: PLACEMENTS, JOBS & INTERNSHIPS */}
      {tab === 'placements' && (
        <div className="space-y-6">
          <form
            onSubmit={handleCreatePlacementDrive}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4"
          >
            <h2 className="font-display font-bold text-slate-900 dark:text-slate-100">
              Post Campus Placement, Full-Time Job or Internship Drive
            </h2>
            {drvFeedback && (
              <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/70 text-xs text-emerald-800 dark:text-emerald-300">
                {drvFeedback}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <input
                type="text"
                required
                value={drvTitle}
                onChange={(e) => setDrvTitle(e.target.value)}
                placeholder="Role / Drive Title (e.g., Graduate Engineer Trainee)"
                className="px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
              <input
                type="text"
                required
                value={drvCompany}
                onChange={(e) => setDrvCompany(e.target.value)}
                placeholder="Company / Organization Name"
                className="px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
              <select
                value={drvType}
                onChange={(e) => setDrvType(e.target.value as PlacementOpportunityRecord['opportunityType'])}
                className="px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              >
                <option value="Campus Placement">Campus Placement</option>
                <option value="Full-Time Job">Full-Time Job</option>
                <option value="Internship">Internship</option>
              </select>
              <input
                type="text"
                value={drvCategory}
                onChange={(e) => setDrvCategory(e.target.value)}
                placeholder="Domain (e.g., Software / VLSI)"
                className="px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
              <input
                type="text"
                value={drvCtc}
                onChange={(e) => setDrvCtc(e.target.value)}
                placeholder="CTC / Stipend (e.g., ₹6.5 LPA)"
                className="px-3 py-2 text-xs font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
              <input
                type="text"
                value={drvLocation}
                onChange={(e) => setDrvLocation(e.target.value)}
                placeholder="Work Location"
                className="px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
              <input
                type="text"
                value={drvEligibility}
                onChange={(e) => setDrvEligibility(e.target.value)}
                placeholder="Eligible Branches / Batch"
                className="px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
              <input
                type="number"
                step="0.1"
                min={0}
                max={10}
                value={drvMinCgpa}
                onChange={(e) => setDrvMinCgpa(e.target.value)}
                placeholder="Min CGPA Cutoff"
                className="px-3 py-2 text-xs font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
              <input
                type="date"
                value={drvDeadline}
                onChange={(e) => setDrvDeadline(e.target.value)}
                className="px-3 py-2 text-xs font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="url"
                value={drvUrl}
                onChange={(e) => setDrvUrl(e.target.value)}
                placeholder="External Registration URL (Optional)"
                className="px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
              <input
                type="text"
                value={drvDesc}
                onChange={(e) => setDrvDesc(e.target.value)}
                placeholder="Role summary & selection stages..."
                className="sm:col-span-2 px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={drvIsDemo}
                  onChange={(e) => setDrvIsDemo(e.target.checked)}
                  className="rounded border-slate-300 dark:border-slate-600 text-[#1E40AF]"
                />
                Mark as DEMO drive
              </label>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-[#1E40AF] dark:bg-blue-600 rounded-lg hover:bg-[#1E3A8A] cursor-pointer"
              >
                Publish Placement Drive
              </button>
            </div>
          </form>

          {/* Posted Drives */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 font-display font-bold text-sm text-slate-900 dark:text-slate-100">
              College Placement Drives ({placementOpportunities.length})
            </div>
            {placementOpportunities.length === 0 ? (
              <div className="p-6 text-xs text-slate-500 dark:text-slate-400">
                No college-specific placement drives posted yet (students also see curated statewide AICTE/APSCHE tracks).
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {placementOpportunities.map((drv) => (
                  <div key={drv.id} className="px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {drv.title} — {drv.companyName} ({drv.opportunityType})
                      </div>
                      <div className="text-slate-500 dark:text-slate-400 font-mono">
                        {drv.ctcOrStipend} · Min CGPA {drv.minCgpa} · Status: {drv.status} · Due {drv.deadlineDate}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => deletePlacementOpportunityByAdmin(drv.id)}
                      className="text-red-600 dark:text-red-400 hover:underline cursor-pointer"
                      aria-label="Delete drive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Student Applications Review */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 font-display font-bold text-sm text-slate-900 dark:text-slate-100">
              Candidate Applications ({placementApplications.length})
            </div>
            {placementApplications.length === 0 ? (
              <div className="p-6 text-xs text-slate-500 dark:text-slate-400">
                No student placement or internship applications received yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {placementApplications.map((app) => {
                  const remarkDraft = plcRemarkDrafts[app.id] ?? app.authorityRemark;
                  return (
                    <div key={app.id} className="p-5 space-y-3 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="font-mono text-slate-500 dark:text-slate-400">
                            {app.studentRollId} · {app.studentName} · CGPA {app.cgpaSnapshot.toFixed(2)}
                          </div>
                          <div className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                            {app.opportunityTitle} — {app.companyName}
                          </div>
                        </div>
                        <span className="font-semibold text-[#1E40AF] dark:text-blue-400">
                          Status: {app.status}
                        </span>
                      </div>
                      {app.coverNote && (
                        <div className="text-slate-600 dark:text-slate-300">Note: {app.coverNote}</div>
                      )}
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          value={remarkDraft}
                          onChange={(e) =>
                            setPlcRemarkDrafts((prev) => ({ ...prev, [app.id]: e.target.value }))
                          }
                          placeholder="Enter interview schedule or placement cell remark..."
                          className="flex-1 px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                        />
                        <div className="flex flex-wrap gap-1.5">
                          {(
                            ['Shortlisted', 'Interview Scheduled', 'Selected', 'Not Selected'] as const
                          ).map((nextSt) => (
                            <button
                              key={nextSt}
                              type="button"
                              onClick={() =>
                                user?.email &&
                                updatePlacementApplicationByAdmin({
                                  application: app,
                                  status: nextSt,
                                  authorityRemark: remarkDraft || `Status updated to ${nextSt}.`,
                                  adminUid: user.uid,
                                  adminEmail: user.email,
                                  actorRole: isActiveCollegeAdmin ? 'college_admin' : 'state_admin',
                                })
                              }
                              className="px-2.5 py-1.5 font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg cursor-pointer"
                            >
                              {nextSt}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4C: CAMPUS SERVICES (HOSTEL, TRANSPORT, LIBRARY) */}
      {tab === 'campus_services' && (
        <div className="space-y-6">
          <form
            onSubmit={handleCreateCollegeService}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4"
          >
            <h2 className="font-display font-bold text-slate-900 dark:text-slate-100">
              Assign Hostel Allotment, Bus Route Pass or Library Card
            </h2>
            {srvFeedback && (
              <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/70 text-xs text-emerald-800 dark:text-emerald-300">
                {srvFeedback}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <select
                value={srvStudentUid}
                onChange={(e) => setSrvStudentUid(e.target.value)}
                className="px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              >
                {students.map((s) => (
                  <option key={s.uid} value={s.uid}>
                    {s.studentRollId} — {s.fullName}
                  </option>
                ))}
              </select>
              <select
                value={srvType}
                onChange={(e) => setSrvType(e.target.value as CollegeServiceRecord['serviceType'])}
                className="px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              >
                <option value="Hostel">Hostel Residence</option>
                <option value="Transport">Transport / Bus Pass</option>
                <option value="Library">Central Library</option>
              </select>
              <input
                type="text"
                value={srvRefCode}
                onChange={(e) => setSrvRefCode(e.target.value)}
                placeholder="Pass / Room / Card Code (Auto if blank)"
                className="px-3 py-2 text-xs font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
              <input
                type="text"
                required
                value={srvTitle}
                onChange={(e) => setSrvTitle(e.target.value)}
                placeholder="Allotment / Pass Title"
                className="px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
              <input
                type="text"
                required
                value={srvPrimary}
                onChange={(e) => setSrvPrimary(e.target.value)}
                placeholder="Room / Bus Route / Book Details"
                className="px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  value={srvSecondary}
                  onChange={(e) => setSrvSecondary(e.target.value)}
                  placeholder="Schedule / Validity"
                  className="flex-1 px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
                <select
                  value={srvStatus}
                  onChange={(e) => setSrvStatus(e.target.value as CollegeServiceRecord['status'])}
                  className="px-2.5 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                >
                  <option value="Active">Active</option>
                  <option value="Approved">Approved</option>
                </select>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={srvIsDemo}
                  onChange={(e) => setSrvIsDemo(e.target.checked)}
                  className="rounded border-slate-300 dark:border-slate-600 text-[#1E40AF]"
                />
                Mark as DEMO pass
              </label>
              <button
                type="submit"
                disabled={students.length === 0}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#1E40AF] dark:bg-blue-600 rounded-lg hover:bg-[#1E3A8A] disabled:opacity-50 cursor-pointer"
              >
                Issue Campus Service Record
              </button>
            </div>
          </form>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="font-display font-bold text-sm text-slate-900 dark:text-slate-100">
                Hostel, Transport &amp; Library Requests ({collegeServices.length})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(['All', 'Requested', 'Approved', 'Active', 'Action Required', 'Closed'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setSrvFilter(st)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md border cursor-pointer ${
                      srvFilter === st
                        ? 'bg-[#1E40AF] text-white border-[#1E40AF]'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>
            {collegeServices.filter((s) => srvFilter === 'All' || s.status === srvFilter).length === 0 ? (
              <div className="p-6 text-xs text-slate-500 dark:text-slate-400">
                No campus service requests or active passes in this view.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {collegeServices
                  .filter((s) => srvFilter === 'All' || s.status === srvFilter)
                  .map((srv) => {
                    const remarkDraft = srvRemarkDrafts[srv.id] ?? srv.authorityRemark;
                    return (
                      <div key={srv.id} className="p-5 space-y-2.5 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="font-mono text-slate-500 dark:text-slate-400">
                              {srv.serviceType} · {srv.referenceCode} · {srv.studentName} ({srv.studentRollId})
                              {srv.isDemo ? ' · DEMO' : ''}
                            </div>
                            <div className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                              {srv.requestTitle}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-semibold text-[#1E40AF] dark:text-blue-400">
                              {srv.status}
                            </span>
                            <button
                              type="button"
                              onClick={() => deleteCollegeServiceByAdmin(srv.id)}
                              className="text-red-600 dark:text-red-400 hover:underline cursor-pointer"
                              aria-label="Delete service record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <div className="text-slate-700 dark:text-slate-300">
                          {srv.detailsPrimary} · <span className="text-slate-500">{srv.detailsSecondary}</span>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            type="text"
                            value={remarkDraft}
                            onChange={(e) =>
                              setSrvRemarkDrafts((prev) => ({ ...prev, [srv.id]: e.target.value }))
                            }
                            placeholder="Enter room number, bus pass code, or authority remark..."
                            className="flex-1 px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                          />
                          <div className="flex flex-wrap gap-1.5">
                            {(['Approved', 'Active', 'Action Required', 'Closed'] as const).map((nextSt) => (
                              <button
                                key={nextSt}
                                type="button"
                                onClick={() =>
                                  user?.email &&
                                  upsertCollegeServiceByAdmin({
                                    service: {
                                      ...srv,
                                      status: nextSt,
                                      authorityRemark: remarkDraft || `Status updated to ${nextSt}.`,
                                    },
                                    adminUid: user.uid,
                                    adminEmail: user.email,
                                    actorRole: isActiveCollegeAdmin ? 'college_admin' : 'state_admin',
                                  })
                                }
                                className="px-2.5 py-1.5 font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg cursor-pointer"
                              >
                                {nextSt}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: FEE SCHEDULES & ERP INTEGRATION */}
      {tab === 'integrations' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Fee Structures */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
              <h2 className="font-display font-bold text-slate-900 dark:text-slate-100">
                Institutional Fee Schedules ({feeStructures.length})
              </h2>
              {fsFeedback && (
                <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/70 text-xs text-emerald-800 dark:text-emerald-300">
                  {fsFeedback}
                </div>
              )}
              <form onSubmit={handleAddFeeStructure} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  value={fsYear}
                  onChange={(e) => setFsYear(e.target.value)}
                  placeholder="Academic Year"
                  className="px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
                <input
                  type="text"
                  required
                  value={fsCourse}
                  onChange={(e) => setFsCourse(e.target.value)}
                  placeholder="Course / Batch (e.g., B.Tech CSE)"
                  className="px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
                <select
                  value={fsCategory}
                  onChange={(e) => setFsCategory(e.target.value as FeeStructureRecord['category'])}
                  className="px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                >
                  <option value="Tuition Fee">Tuition Fee</option>
                  <option value="Hostel & Mess">Hostel & Mess</option>
                  <option value="Exam Fee">Exam Fee</option>
                  <option value="Lab & Library">Lab & Library</option>
                  <option value="Transport">Transport</option>
                  <option value="Miscellaneous">Miscellaneous</option>
                </select>
                <input
                  type="number"
                  min={0}
                  required
                  value={fsAmount}
                  onChange={(e) => setFsAmount(e.target.value)}
                  placeholder="Amount (INR)"
                  className="px-3 py-2 text-xs font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
                <input
                  type="date"
                  required
                  value={fsDueDate}
                  onChange={(e) => setFsDueDate(e.target.value)}
                  className="px-3 py-2 text-xs font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
                <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fsIsDemo}
                    onChange={(e) => setFsIsDemo(e.target.checked)}
                    className="rounded border-slate-300 dark:border-slate-600 text-[#1E40AF]"
                  />
                  Mark as DEMO schedule
                </label>
                <button
                  type="submit"
                  className="sm:col-span-2 px-4 py-2 text-xs font-semibold text-white bg-[#1E40AF] dark:bg-blue-600 rounded-lg hover:bg-[#1E3A8A] cursor-pointer"
                >
                  Save Fee Schedule
                </button>
              </form>

              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {feeStructures.map((fs) => (
                  <div key={fs.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {fs.category} · {fs.course} ({fs.academicYear})
                      </div>
                      <div className="text-slate-500 dark:text-slate-400 font-mono">
                        ₹{fs.amount.toLocaleString('en-IN')} · Due {fs.dueDate} {fs.isDemo ? '· DEMO' : ''}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteFeeStructureByAdmin(fs.id)}
                      className="text-red-600 dark:text-red-400 hover:underline cursor-pointer"
                      aria-label="Delete fee structure"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* College ERP Integration Adapter */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display font-bold text-slate-900 dark:text-slate-100">
                  College ERP & Database Adapter
                </h2>
                <span className="font-mono text-xs font-semibold text-[#1E40AF] dark:text-blue-400">
                  {integration?.status || 'Requires Integration'}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                External college ERP connections operate strictly read-only by default and require written
                institutional authorization before any synchronization is enabled.
              </p>

              {integFeedback && (
                <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/70 text-xs text-emerald-800 dark:text-emerald-300">
                  {integFeedback}
                </div>
              )}
              {integError && (
                <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/70 text-xs text-red-700 dark:text-red-300">
                  {integError}
                </div>
              )}

              <form onSubmit={handleConfigureIntegration} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <select
                    value={integAdapter}
                    onChange={(e) =>
                      setIntegAdapter(e.target.value as CollegeIntegrationRecord['adapterType'])
                    }
                    className="px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  >
                    <option value="CSV_XLSX_IMPORT">CSV / Excel Authorised Import</option>
                    <option value="REST_API_READONLY">REST API (Read-Only Adapter)</option>
                    <option value="SFTP_BATCH">SFTP Batch Sync</option>
                    <option value="WEBHOOK_SYNC">Signed Webhook Adapter</option>
                    <option value="None">None (Manual Verification Only)</option>
                  </select>
                  <input
                    type="text"
                    required
                    value={integAuthRef}
                    onChange={(e) => setIntegAuthRef(e.target.value)}
                    placeholder="Written Auth Ref # (e.g., NECG/MOU/2026-01)"
                    className="px-3 py-2 text-xs font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={integOfficer}
                    onChange={(e) => setIntegOfficer(e.target.value)}
                    placeholder="Authorizing Officer / Principal"
                    className="px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                  <input
                    type="text"
                    value={integEndpoint}
                    onChange={(e) => setIntegEndpoint(e.target.value)}
                    placeholder="ERP Read-Only Endpoint URL (Optional)"
                    className="px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={integReadOnly}
                      onChange={(e) => setIntegReadOnly(e.target.checked)}
                      className="rounded border-slate-300 dark:border-slate-600 text-[#1E40AF]"
                    />
                    Enforce Read-Only synchronization (Recommended default)
                  </label>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      required
                      checked={integAttested}
                      onChange={(e) => setIntegAttested(e.target.checked)}
                      className="mt-0.5 rounded border-slate-300 dark:border-slate-600 text-[#1E40AF]"
                    />
                    <span>
                      I confirm written authorization and valid credentials have been granted by the
                      institution before enabling synchronization.
                    </span>
                  </label>
                </div>
                <button
                  type="submit"
                  disabled={integBusy}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#1E40AF] dark:bg-blue-600 rounded-lg hover:bg-[#1E3A8A] disabled:opacity-50 cursor-pointer"
                >
                  Save Adapter Configuration
                </button>
              </form>

              {/* Run Read-Only Sync / Validate CSV Roster */}
              <form onSubmit={handleRunSync} className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    Read-Only Sync & CSV Roster Check
                  </span>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(e) => handleCsvRosterUpload(e.target.files?.[0] || null)}
                    className="text-xs text-slate-600 dark:text-slate-300"
                  />
                </div>
                <textarea
                  rows={3}
                  value={integCsvText}
                  onChange={(e) => setIntegCsvText(e.target.value)}
                  placeholder="Optional: paste authorized CSV student export rows here for read-only validation..."
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
                <button
                  type="submit"
                  disabled={integBusy || !integration?.authorizationRef || integration?.adapterType === 'None'}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-slate-700 rounded-lg hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Run Read-Only Sync Check
                </button>
              </form>
            </div>
          </div>

          {syncLogs.length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <div className="px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 font-display font-bold text-sm text-slate-900 dark:text-slate-100">
                Recent Institutional Sync Logs ({syncLogs.length})
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {syncLogs.map((log) => (
                  <div key={log.id} className="px-6 py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div>
                      <span className="font-mono font-semibold text-[#1E40AF] dark:text-blue-400">
                        {log.adapterType}
                      </span>{' '}
                      · <span className="text-slate-700 dark:text-slate-300">{log.summary}</span>
                    </div>
                    <span className="font-mono text-slate-500 dark:text-slate-400">
                      {log.status} · {log.actorEmail}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: OFFICIAL COLLEGE PHOTOGRAPHS & LOGOS */}
      {tab === 'media' && (
        <div className="space-y-6">
          <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-xs text-slate-700 dark:text-slate-200 space-y-1">
            <div className="font-semibold text-[#1E40AF] dark:text-blue-400 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              <span>Authentic Institutional Media &amp; Student Privacy Standards</span>
            </div>
            <p className="leading-relaxed">
              Upload only real photographs of{' '}
              <span className="font-semibold">{collegeAdminProfile?.collegeName}</span> (campus gates,
              academic buildings, labs, libraries, official logo, and permitted student-faculty activities).
              Do NOT upload AI-generated imagery, external stock photos, or identifiable student photos with
              readable ID cards, phone numbers, or personal details. All uploads require State Admin verification before publishing publicly.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <form
              onSubmit={handleUploadCollegeMedia}
              className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4"
            >
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-[#1E40AF] dark:text-blue-400" />
                <h2 className="font-display font-bold text-slate-900 dark:text-slate-100">
                  Upload Official College Photograph
                </h2>
              </div>

              {mediaFeedback && (
                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-800 dark:text-emerald-300">
                  {mediaFeedback}
                </div>
              )}
              {mediaError && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
                  {mediaError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Photograph Category
                </label>
                <select
                  value={mediaCategory}
                  onChange={(e) => setMediaCategory(e.target.value as CollegeMediaCategory)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                >
                  {ALL_MEDIA_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Photograph Title
                </label>
                <input
                  type="text"
                  required
                  value={mediaTitle}
                  onChange={(e) => setMediaTitle(e.target.value)}
                  placeholder="e.g., Central Computer Science Lab - Block A"
                  className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Description / Institutional Context
                </label>
                <textarea
                  rows={2}
                  required
                  value={mediaCaption}
                  onChange={(e) => setMediaCaption(e.target.value)}
                  placeholder="Describe the academic block, lab facility, or campus event shown..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Official Source URL or Institutional Circular Reference
                </label>
                <input
                  type="text"
                  required
                  value={mediaSourceUrl}
                  onChange={(e) => setMediaSourceUrl(e.target.value)}
                  placeholder="e.g., https://college.ac.in/gallery or PR/IQAC/2026-04"
                  className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Permission / Licence Details
                </label>
                <input
                  type="text"
                  required
                  value={mediaLicense}
                  onChange={(e) => setMediaLicense(e.target.value)}
                  placeholder="e.g., Authorised Institutional Gallery Release (Principal/PRO)"
                  className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="p-3.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 space-y-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                  <Upload className="w-4 h-4 text-[#1E40AF] dark:text-blue-400" />
                  <span>Select Image (JPEG, PNG, WEBP — auto-compressed on device)</span>
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => handleSelectMediaFile(e.target.files?.[0] || null)}
                  className="block w-full text-xs text-slate-600 dark:text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-white dark:file:bg-slate-700 file:text-slate-800 dark:file:text-slate-100 cursor-pointer"
                />
                {mediaCompressing && (
                  <div className="text-xs text-[#1E40AF] dark:text-blue-400">
                    Compressing image for high-speed responsive delivery...
                  </div>
                )}
                {mediaCompressed && (
                  <div className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400">
                    Optimized: {mediaCompressed.width}×{mediaCompressed.height}px ·{' '}
                    {Math.round(mediaCompressed.originalSize / 1024)} KB →{' '}
                    {Math.round(mediaCompressed.compressedSize / 1024)} KB ({mediaCompressed.mimeType})
                  </div>
                )}
                {mediaPreviewUrl && (
                  <img
                    src={mediaPreviewUrl}
                    alt="Upload preview"
                    className="w-full max-h-40 object-cover rounded-lg border border-slate-200 dark:border-slate-700"
                  />
                )}
              </div>

              <label className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  required
                  checked={mediaConsentAttested}
                  onChange={(e) => setMediaConsentAttested(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 dark:border-slate-600 text-[#1E40AF]"
                />
                <span>
                  I confirm institutional permission to publish this photograph for{' '}
                  <strong>{collegeAdminProfile?.collegeCode}</strong>, that it is NOT AI-generated or
                  mismatched stock media, and that no readable student ID numbers, phone numbers, or
                  private PII appear in it.
                </span>
              </label>

              <button
                type="submit"
                disabled={mediaUploading || mediaCompressing || !mediaCompressed}
                className="w-full px-4 py-2.5 text-xs font-semibold text-white bg-[#1E40AF] dark:bg-blue-600 rounded-lg hover:bg-[#1E3A8A] disabled:opacity-50 cursor-pointer ash-btn-press"
              >
                {mediaUploading ? 'Uploading & Submitting...' : 'Submit Photograph for Verification'}
              </button>
            </form>

            <div className="lg:col-span-7 space-y-5">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-display font-bold text-slate-900 dark:text-slate-100">
                    Submitted College Photographs ({mergedLiveCollegeMedia.length})
                  </h2>
                  <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                    College ID: {targetCollegeId}
                  </span>
                </div>

                {mergedLiveCollegeMedia.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                    No photographs uploaded by your institution yet. Submit official campus, classroom,
                    laboratory, library, and permitted student activity photographs on the left.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {mergedLiveCollegeMedia.map((m) => (
                      <div
                        key={m.id}
                        className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-slate-50/50 dark:bg-slate-950/60 flex flex-col justify-between"
                      >
                        <InstitutionalPhotoFrame
                          src={m.imageUrl}
                          alt={m.title}
                          aspectClass="aspect-[16/10]"
                          categoryLabel={m.mediaCategory}
                          collegeName={m.collegeCode}
                          isVerified={m.approvalStatus === 'Approved'}
                          compact
                        />
                        <div className="p-3.5 space-y-2 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`font-semibold px-2 py-0.5 rounded-md ${
                                m.approvalStatus === 'Approved'
                                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                  : m.approvalStatus === 'Rejected'
                                    ? 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300'
                                    : 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                              }`}
                            >
                              {m.approvalStatus}
                            </span>
                            <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                              {Math.round(m.sizeBytes / 1024)} KB
                            </span>
                          </div>
                          <div className="font-display font-bold text-slate-900 dark:text-slate-100">
                            {m.title}
                          </div>
                          <p className="text-slate-600 dark:text-slate-300 line-clamp-2">{m.caption}</p>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            Licence: {m.licenseOrPermission}
                          </div>
                          {m.reviewRemark && (
                            <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-700 dark:text-slate-300">
                              <span className="font-semibold">State Admin Remark:</span> {m.reviewRemark}
                            </div>
                          )}
                          <div className="flex items-center justify-between pt-1">
                            {m.sourceUrl.startsWith('http') ? (
                              <a
                                href={m.sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[#1E40AF] dark:text-blue-400 hover:underline"
                              >
                                Source <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : (
                              <span className="font-mono text-[11px] text-slate-500 truncate max-w-[160px]">
                                {m.sourceUrl}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                user?.email &&
                                deleteCollegeMediaRecord({
                                  media: m,
                                  actorUid: user.uid,
                                  actorEmail: user.email,
                                  actorRole: isActiveCollegeAdmin ? 'college_admin' : 'state_admin',
                                })
                              }
                              className="inline-flex items-center gap-1 text-red-700 dark:text-red-400 hover:underline cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {seededMediaForThisCollege.length > 0 && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
                  <div>
                    <h3 className="font-display font-bold text-sm text-slate-900 dark:text-slate-100">
                      Published Public Commons Photos ({seededMediaForThisCollege.length})
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Pre-verified open-licence institutional photographs already linked to your institution.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {seededMediaForThisCollege.map((sm) => (
                      <InstitutionalPhotoFrame
                        key={sm.id}
                        src={sm.imageUrl}
                        alt={sm.title}
                        aspectClass="aspect-[16/10]"
                        categoryLabel={sm.mediaCategory}
                        collegeName={sm.collegeCode}
                        caption={sm.title}
                        sourceUrl={sm.sourceUrl}
                        licenseOrPermission={sm.licenseOrPermission}
                        isVerified
                        showAttributionBar
                        compact
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: COLLEGE PROFILE & ANNOUNCEMENTS */}
      {tab === 'profile_notices' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <form
            onSubmit={handleSaveCollegeProfile}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4"
          >
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[#1E40AF] dark:text-blue-400" />
              <h2 className="font-display font-bold text-slate-900 dark:text-slate-100">
                Manage College Profile
              </h2>
            </div>
            {colSavedMsg && (
              <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/70 text-xs text-emerald-800 dark:text-emerald-300">
                {colSavedMsg}
              </div>
            )}
            {colSaveError && (
              <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/70 text-xs text-red-700 dark:text-red-300">
                {colSaveError}
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Address
              </label>
              <input
                type="text"
                value={colAddress}
                onChange={(e) => setColAddress(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Affiliated University
              </label>
              <input
                type="text"
                value={colUniv}
                onChange={(e) => setColUniv(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Accreditation
              </label>
              <input
                type="text"
                value={colAccr}
                onChange={(e) => setColAccr(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Official Website
                </label>
                <input
                  type="url"
                  value={colWebsite}
                  onChange={(e) => setColWebsite(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Contact Email
                </label>
                <input
                  type="text"
                  value={colEmail}
                  onChange={(e) => setColEmail(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Contact Phone
              </label>
              <input
                type="text"
                value={colPhone}
                onChange={(e) => setColPhone(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-[#1E40AF] dark:bg-blue-600 hover:bg-[#1E3A8A] dark:hover:bg-blue-500 rounded-lg cursor-pointer"
            >
              Save Profile Updates
            </button>
          </form>

          <form
            onSubmit={handleSendAnnouncement}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4"
          >
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-[#D97706] dark:text-amber-400" />
              <h2 className="font-display font-bold text-slate-900 dark:text-slate-100">
                Send Student Announcement
              </h2>
            </div>
            {noticeFeedback && (
              <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/70 text-xs text-emerald-800 dark:text-emerald-300">
                {noticeFeedback}
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Category
              </label>
              <select
                value={noticeCategory}
                onChange={(e) =>
                  setNoticeCategory(e.target.value as NotificationRecord['category'])
                }
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              >
                <option>Announcement</option>
                <option>Fee Alert</option>
                <option>Scholarship</option>
                <option>Exam Update</option>
                <option>NPTEL</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Title
              </label>
              <input
                type="text"
                required
                value={noticeTitle}
                onChange={(e) => setNoticeTitle(e.target.value)}
                placeholder="e.g., Semester II Fee Verification Schedule"
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Message
              </label>
              <textarea
                rows={3}
                required
                value={noticeMessage}
                onChange={(e) => setNoticeMessage(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600 rounded-lg cursor-pointer ash-btn-press"
            >
              Publish College Announcement
            </button>
          </form>
        </div>
      )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
