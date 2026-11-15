import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase.ts';
import type {
  AcademicSubjectRecord,
  CollegeAdminProfile,
  CollegeIntegrationRecord,
  CollegeMediaCategory,
  CollegeMediaRecord,
  CollegeRecord,
  CollegeServiceRecord,
  CourseRecord,
  DepartmentRecord,
  FeeRecord,
  FeeStructureRecord,
  GrievanceRecord,
  NotificationRecord,
  PlacementApplicationRecord,
  PlacementOpportunityRecord,
  ScholarshipApplicationRecord,
  ScholarshipRecord,
  StudentProfile,
  StudentResumeRecord,
  TimetableSlotRecord,
} from '../types.ts';

function safeId(prefix: string): string {
  const rnd = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now()}_${rnd}`.replace(/[^a-zA-Z0-9_-]/g, '');
}

function clampStr(val: string, max: number): string {
  return String(val || '').trim().slice(0, max);
}

export async function getCollegeAdminEmailsForCollege(collegeId: string): Promise<string[]> {
  try {
    const snap = await getDoc(doc(db, 'colleges', collegeId));
    if (snap.exists()) {
      const list = snap.data()?.adminEmails;
      if (Array.isArray(list)) {
        return list.filter((e): e is string => typeof e === 'string').slice(0, 3);
      }
    }
    return [];
  } catch {
    return [];
  }
}

export async function writeAuditLog(params: {
  actorUid: string;
  actorEmail: string;
  actorRole: 'state_admin' | 'college_admin' | 'student';
  action: string;
  targetCollection: string;
  targetId: string;
  collegeId: string;
  summary: string;
}) {
  const id = safeId('log');
  const path = `audit_logs/${id}`;
  try {
    await setDoc(doc(db, 'audit_logs', id), {
      id,
      actorUid: params.actorUid,
      actorEmail: clampStr(params.actorEmail, 180),
      actorRole: params.actorRole,
      action: clampStr(params.action, 120),
      targetCollection: clampStr(params.targetCollection, 80),
      targetId: clampStr(params.targetId, 128),
      collegeId: clampStr(params.collegeId, 128),
      summary: clampStr(params.summary, 400),
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function registerStudentProfile(params: {
  uid: string;
  email: string;
  collegeEmail?: string;
  collegeEmailVerified?: boolean;
  otpVerifiedAt?: string;
  fullName: string;
  mobile: string;
  college: CollegeRecord;
  studentRollId: string;
  course: string;
  branch: string;
  department?: string;
  academicYear: string;
  admissionYear?: string;
}) {
  const path = `students/${params.uid}`;
  const collegeAdminEmails = await getCollegeAdminEmailsForCollege(params.college.id);
  try {
    await setDoc(doc(db, 'students', params.uid), {
      uid: params.uid,
      fullName: clampStr(params.fullName, 120),
      email: clampStr(params.email, 180),
      collegeEmail: clampStr(params.collegeEmail || params.email, 180),
      collegeEmailVerified: Boolean(params.collegeEmailVerified),
      otpVerifiedAt: clampStr(params.otpVerifiedAt || '', 64),
      mobile: clampStr(params.mobile, 20),
      collegeId: params.college.id,
      collegeCode: clampStr(params.college.code, 32),
      collegeName: clampStr(params.college.name, 200),
      district: clampStr(params.college.district, 80),
      studentRollId: clampStr(params.studentRollId, 64),
      course: clampStr(params.course, 120),
      branch: clampStr(params.branch, 120),
      department: clampStr(params.department || params.branch, 120),
      academicYear: clampStr(params.academicYear, 32),
      admissionYear: clampStr(params.admissionYear || String(new Date().getFullYear()), 16),
      verificationStatus: 'Pending',
      verifiedByUid: '',
      collegeAdminEmails,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await writeAuditLog({
      actorUid: params.uid,
      actorEmail: params.email,
      actorRole: 'student',
      action: 'STUDENT_REGISTERED',
      targetCollection: 'students',
      targetId: params.uid,
      collegeId: params.college.id,
      summary: `Student ${clampStr(params.fullName, 60)} registered under ${params.college.code}.`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function updateStudentSelfProfile(
  uid: string,
  updates: {
    fullName: string;
    mobile: string;
    studentRollId: string;
    course: string;
    branch: string;
    department?: string;
    academicYear: string;
    admissionYear?: string;
    collegeEmail?: string;
    collegeEmailVerified?: boolean;
    otpVerifiedAt?: string;
  }
) {
  const path = `students/${uid}`;
  try {
    const payload: Record<string, unknown> = {
      fullName: clampStr(updates.fullName, 120),
      mobile: clampStr(updates.mobile, 20),
      studentRollId: clampStr(updates.studentRollId, 64),
      course: clampStr(updates.course, 120),
      branch: clampStr(updates.branch, 120),
      department: clampStr(updates.department || updates.branch, 120),
      academicYear: clampStr(updates.academicYear, 32),
      updatedAt: serverTimestamp(),
    };
    if (updates.admissionYear !== undefined) {
      payload.admissionYear = clampStr(updates.admissionYear, 16);
    }
    if (updates.collegeEmail !== undefined) {
      payload.collegeEmail = clampStr(updates.collegeEmail, 180);
    }
    if (updates.collegeEmailVerified !== undefined) {
      payload.collegeEmailVerified = Boolean(updates.collegeEmailVerified);
    }
    if (updates.otpVerifiedAt !== undefined) {
      payload.otpVerifiedAt = clampStr(updates.otpVerifiedAt, 64);
    }
    await updateDoc(doc(db, 'students', uid), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function requestCollegeAdminRole(params: {
  uid: string;
  email: string;
  fullName: string;
  designation: string;
  college: CollegeRecord;
}) {
  const path = `college_admins/${params.uid}`;
  try {
    await setDoc(doc(db, 'college_admins', params.uid), {
      uid: params.uid,
      email: clampStr(params.email, 180),
      fullName: clampStr(params.fullName, 120),
      designation: clampStr(params.designation, 120),
      collegeId: params.college.id,
      collegeCode: clampStr(params.college.code, 32),
      collegeName: clampStr(params.college.name, 200),
      status: 'pending',
      active: false,
      approvedByUid: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await writeAuditLog({
      actorUid: params.uid,
      actorEmail: params.email,
      actorRole: 'college_admin',
      action: 'COLLEGE_ADMIN_REQUESTED',
      targetCollection: 'college_admins',
      targetId: params.uid,
      collegeId: params.college.id,
      summary: `${params.email} requested College Admin access for ${params.college.code}.`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function createDemoFeeSampleForStudent(student: StudentProfile) {
  const batch = writeBatch(db);
  const tsSuffix = String(Date.now()).slice(-6);
  const demoTerms = [
    {
      semester: 'Demo Sem I (Sample)',
      academicYear: '2025-26',
      feeCategory: 'Tuition Fee (Sample)',
      dueDate: '2025-07-31',
      totalFee: 45000,
      paidAmount: 45000,
      pendingAmount: 0,
      status: 'Paid' as const,
      paidAtLabel: 'Demo Payment · Jul 2025',
      receiptSuffix: '01',
    },
    {
      semester: 'Demo Sem II (Sample)',
      academicYear: '2025-26',
      feeCategory: 'Tuition & Lab Fee (Sample)',
      dueDate: '2026-01-31',
      totalFee: 45000,
      paidAmount: 45000,
      pendingAmount: 0,
      status: 'Paid' as const,
      paidAtLabel: 'Demo Payment · Jan 2026',
      receiptSuffix: '02',
    },
    {
      semester: 'Demo Sem III (Sample)',
      academicYear: student.academicYear || '2026-27',
      feeCategory: 'Tuition & Exam Fee (Sample)',
      dueDate: '2026-08-31',
      totalFee: 48000,
      paidAmount: 28000,
      pendingAmount: 20000,
      status: 'Partial' as const,
      paidAtLabel: 'Demo Payment · Jul 2026',
      receiptSuffix: '03',
    },
  ];

  const firstFeeId = safeId('fee_demo');
  const path = `fee_records/${firstFeeId}`;

  try {
    demoTerms.forEach((term, idx) => {
      const feeId = idx === 0 ? firstFeeId : safeId(`fee_demo_${idx + 1}`);
      const payId = safeId(`pay_demo_${idx + 1}`);

      batch.set(doc(db, 'fee_records', feeId), {
        id: feeId,
        studentUid: student.uid,
        studentRollId: student.studentRollId,
        studentName: student.fullName,
        collegeId: student.collegeId,
        collegeName: student.collegeName,
        academicYear: clampStr(term.academicYear, 32),
        semester: clampStr(term.semester, 32),
        feeCategory: clampStr(term.feeCategory, 80),
        dueDate: clampStr(term.dueDate, 40),
        totalFee: term.totalFee,
        paidAmount: term.paidAmount,
        pendingAmount: term.pendingAmount,
        isDemo: true,
        status: term.status,
        discrepancyReported: false,
        discrepancyNote: '',
        collegeAdminEmails: student.collegeAdminEmails || [],
        updatedByUid: student.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      batch.set(doc(db, 'fee_payments', payId), {
        id: payId,
        feeRecordId: feeId,
        studentUid: student.uid,
        collegeId: student.collegeId,
        amount: term.paidAmount,
        receiptNumber: `DEMO-RCPT-${tsSuffix}-${term.receiptSuffix}`,
        paymentMode: 'DEMO',
        isDemo: true,
        paidAtLabel: term.paidAtLabel,
        collegeAdminEmails: student.collegeAdminEmails || [],
        recordedByUid: student.uid,
        createdAt: serverTimestamp(),
      });
    });

    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function reportFeeDiscrepancy(feeRecordId: string, note: string) {
  const path = `fee_records/${feeRecordId}`;
  try {
    await updateDoc(doc(db, 'fee_records', feeRecordId), {
      discrepancyReported: true,
      discrepancyNote: clampStr(note, 600),
      status: 'Disputed',
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function createGrievanceWithEvidence(params: {
  student: StudentProfile;
  category: string;
  subject: string;
  description: string;
  contactMobile: string;
  aiSuggestedCategory: string;
  aiUrgency: GrievanceRecord['aiUrgency'];
  aiTriageSummary: string;
  aiVerificationDisclaimer: string;
  escalationLevel: GrievanceRecord['escalationLevel'];
  evidence?: {
    evidenceId: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    sha256: string;
    storagePath: string;
    aiAssistNote: string;
  } | null;
}): Promise<{ grievanceId: string; trackingNumber: string }> {
  const grievanceId = safeId('grv');
  const trackingNumber = `ASH-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
  const adminEmails = await getCollegeAdminEmailsForCollege(params.student.collegeId);
  const effectiveAdminEmails = adminEmails.length > 0 ? adminEmails : params.student.collegeAdminEmails || [];

  const batch = writeBatch(db);
  try {
    batch.set(doc(db, 'grievances', grievanceId), {
      id: grievanceId,
      trackingNumber,
      studentUid: params.student.uid,
      studentName: clampStr(params.student.fullName, 120),
      contactEmail: clampStr(params.student.email, 180),
      contactMobile: clampStr(params.contactMobile || params.student.mobile, 20),
      collegeId: params.student.collegeId,
      collegeName: clampStr(params.student.collegeName, 200),
      district: clampStr(params.student.district, 80),
      category: clampStr(params.category, 80),
      subject: clampStr(params.subject, 180),
      description: clampStr(params.description, 2500),
      aiSuggestedCategory: clampStr(params.aiSuggestedCategory, 80),
      aiUrgency: params.aiUrgency,
      aiTriageSummary: clampStr(params.aiTriageSummary, 600),
      aiVerificationDisclaimer: clampStr(params.aiVerificationDisclaimer, 200),
      status: 'Submitted',
      escalationLevel: params.escalationLevel,
      resolutionNotes: '',
      handledByUid: '',
      collegeAdminEmails: effectiveAdminEmails,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (params.evidence) {
      const evId = params.evidence.evidenceId.replace(/[^a-zA-Z0-9_-]/g, '');
      batch.set(doc(db, 'grievance_evidence', evId), {
        id: evId,
        grievanceId,
        studentUid: params.student.uid,
        collegeId: params.student.collegeId,
        fileName: clampStr(params.evidence.fileName, 200),
        mimeType: clampStr(params.evidence.mimeType, 80),
        sizeBytes: params.evidence.sizeBytes,
        sha256: clampStr(params.evidence.sha256, 80),
        storagePath: clampStr(params.evidence.storagePath, 300),
        aiAssistNote: clampStr(params.evidence.aiAssistNote, 600),
        humanVerificationStatus: 'Pending Human Verification',
        verifiedByUid: '',
        collegeAdminEmails: effectiveAdminEmails,
        createdAt: serverTimestamp(),
      });
    }

    await batch.commit();

    await writeAuditLog({
      actorUid: params.student.uid,
      actorEmail: params.student.email,
      actorRole: 'student',
      action: 'GRIEVANCE_SUBMITTED',
      targetCollection: 'grievances',
      targetId: grievanceId,
      collegeId: params.student.collegeId,
      summary: `Tracking ${trackingNumber} submitted under ${params.category} (${params.aiUrgency}).`,
    });

    return { grievanceId, trackingNumber };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `grievances/${grievanceId}`);
  }
}

export async function escalateGrievanceByStudent(
  grievanceId: string,
  escalationLevel: GrievanceRecord['escalationLevel'],
  followUpNote?: string
) {
  const path = `grievances/${grievanceId}`;
  try {
    const payload: Record<string, unknown> = {
      escalationLevel,
      updatedAt: serverTimestamp(),
    };
    if (followUpNote && followUpNote.trim().length >= 10) {
      payload.description = clampStr(followUpNote, 2500);
    }
    await updateDoc(doc(db, 'grievances', grievanceId), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function submitScholarshipApplication(params: {
  student: StudentProfile;
  scholarship: ScholarshipRecord;
  applicationRef: string;
  grievanceNote: string;
}) {
  const id = safeId('sch_app');
  const path = `scholarship_applications/${id}`;
  try {
    await setDoc(doc(db, 'scholarship_applications', id), {
      id,
      scholarshipId: params.scholarship.id,
      scholarshipTitle: clampStr(params.scholarship.title, 200),
      studentUid: params.student.uid,
      studentName: clampStr(params.student.fullName, 120),
      collegeId: params.student.collegeId,
      collegeName: clampStr(params.student.collegeName, 200),
      applicationRef: clampStr(params.applicationRef, 64),
      status: 'Submitted',
      grievanceNote: clampStr(params.grievanceNote, 600),
      collegeAdminEmails: params.student.collegeAdminEmails || [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

// --- COLLEGE ADMIN OPERATIONS ---

export async function verifyStudentByCollegeAdmin(params: {
  studentUid: string;
  status: 'Verified' | 'Rejected';
  adminUid: string;
  adminEmail: string;
  collegeId: string;
}) {
  const path = `students/${params.studentUid}`;
  try {
    const existingEmails = await getCollegeAdminEmailsForCollege(params.collegeId);
    const mergedEmails = Array.from(new Set([...existingEmails, params.adminEmail])).slice(0, 3);
    await updateDoc(doc(db, 'students', params.studentUid), {
      verificationStatus: params.status,
      verifiedByUid: params.adminUid,
      collegeAdminEmails: mergedEmails,
      updatedAt: serverTimestamp(),
    });
    await writeAuditLog({
      actorUid: params.adminUid,
      actorEmail: params.adminEmail,
      actorRole: 'college_admin',
      action: `STUDENT_${params.status.toUpperCase()}`,
      targetCollection: 'students',
      targetId: params.studentUid,
      collegeId: params.collegeId,
      summary: `College admin marked student ${params.studentUid} as ${params.status}.`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function createFeeRecordByAdmin(params: {
  student: StudentProfile;
  academicYear: string;
  semester: string;
  feeCategory?: string;
  dueDate?: string;
  totalFee: number;
  paidAmount: number;
  adminUid: string;
  adminEmail: string;
  isDemo: boolean;
}) {
  const id = safeId('fee');
  const pendingAmount = Math.max(0, params.totalFee - params.paidAmount);
  const status: FeeRecord['status'] =
    pendingAmount === 0 ? 'Paid' : params.paidAmount > 0 ? 'Partial' : 'Pending';
  const adminEmails = Array.from(new Set([...(params.student.collegeAdminEmails || []), params.adminEmail])).slice(0, 3);

  try {
    await setDoc(doc(db, 'fee_records', id), {
      id,
      studentUid: params.student.uid,
      studentRollId: params.student.studentRollId,
      studentName: params.student.fullName,
      collegeId: params.student.collegeId,
      collegeName: params.student.collegeName,
      academicYear: clampStr(params.academicYear, 32),
      semester: clampStr(params.semester, 32),
      feeCategory: clampStr(params.feeCategory || 'Tuition Fee', 80),
      dueDate: clampStr(params.dueDate || '', 40),
      totalFee: params.totalFee,
      paidAmount: params.paidAmount,
      pendingAmount,
      isDemo: params.isDemo,
      status,
      discrepancyReported: false,
      discrepancyNote: '',
      collegeAdminEmails: adminEmails,
      updatedByUid: params.adminUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await writeAuditLog({
      actorUid: params.adminUid,
      actorEmail: params.adminEmail,
      actorRole: 'college_admin',
      action: 'FEE_RECORD_CREATED',
      targetCollection: 'fee_records',
      targetId: id,
      collegeId: params.student.collegeId,
      summary: `Fee record created for ${params.student.studentRollId} (Total ₹${params.totalFee}).`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `fee_records/${id}`);
  }
}

export async function recordFeePaymentByAdmin(params: {
  feeRecord: FeeRecord;
  amount: number;
  paymentMode: 'UPI' | 'NEFT' | 'Challan' | 'Scholarship Reimbursement' | 'DEMO';
  receiptNumber: string;
  adminUid: string;
  adminEmail: string;
}) {
  const payId = safeId('pay');
  const newPaid = Math.min(params.feeRecord.totalFee, params.feeRecord.paidAmount + params.amount);
  const newPending = Math.max(0, params.feeRecord.totalFee - newPaid);
  const newStatus: FeeRecord['status'] = newPending === 0 ? 'Paid' : 'Partial';

  const batch = writeBatch(db);
  try {
    batch.set(doc(db, 'fee_payments', payId), {
      id: payId,
      feeRecordId: params.feeRecord.id,
      studentUid: params.feeRecord.studentUid,
      collegeId: params.feeRecord.collegeId,
      amount: params.amount,
      receiptNumber: clampStr(params.receiptNumber, 64),
      paymentMode: params.paymentMode,
      isDemo: params.feeRecord.isDemo,
      paidAtLabel: new Date().toLocaleDateString('en-IN'),
      collegeAdminEmails: params.feeRecord.collegeAdminEmails || [params.adminEmail],
      recordedByUid: params.adminUid,
      createdAt: serverTimestamp(),
    });

    batch.update(doc(db, 'fee_records', params.feeRecord.id), {
      paidAmount: newPaid,
      pendingAmount: newPending,
      status: newStatus,
      discrepancyReported: false,
      updatedByUid: params.adminUid,
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `fee_payments/${payId}`);
  }
}

export async function updateGrievanceByAdmin(params: {
  grievanceId: string;
  collegeId: string;
  status: GrievanceRecord['status'];
  escalationLevel: GrievanceRecord['escalationLevel'];
  resolutionNotes: string;
  adminUid: string;
  adminEmail: string;
  actorRole: 'college_admin' | 'state_admin';
  studentUid?: string;
  trackingNumber?: string;
  subject?: string;
  collegeAdminEmails?: string[];
}) {
  const path = `grievances/${params.grievanceId}`;
  try {
    await updateDoc(doc(db, 'grievances', params.grievanceId), {
      status: params.status,
      escalationLevel: params.escalationLevel,
      resolutionNotes: clampStr(params.resolutionNotes, 1500),
      handledByUid: params.adminUid,
      updatedAt: serverTimestamp(),
    });
    if (params.studentUid) {
      const ntfId = safeId('ntf_grv');
      await setDoc(doc(db, 'notifications', ntfId), {
        id: ntfId,
        title: clampStr(
          `Grievance Update${params.trackingNumber ? ` · ${params.trackingNumber}` : ''}`,
          180
        ),
        message: clampStr(
          `${params.subject ? `"${params.subject}" ` : 'Your grievance '}was updated to ${params.status} (${params.escalationLevel}).${
            params.resolutionNotes ? ` Note: ${params.resolutionNotes}` : ''
          }`,
          1000
        ),
        scope: 'student',
        category: 'Grievance Update',
        collegeId: clampStr(params.collegeId, 128),
        targetUid: clampStr(params.studentUid, 128),
        authorUid: params.adminUid,
        authorRole: params.actorRole,
        collegeAdminEmails: (params.collegeAdminEmails || [params.adminEmail]).slice(0, 3),
        isDemo: false,
        createdAt: serverTimestamp(),
      });
    }
    await writeAuditLog({
      actorUid: params.adminUid,
      actorEmail: params.adminEmail,
      actorRole: params.actorRole,
      action: 'GRIEVANCE_STATUS_UPDATED',
      targetCollection: 'grievances',
      targetId: params.grievanceId,
      collegeId: params.collegeId,
      summary: `Grievance ${params.grievanceId} updated to ${params.status} (${params.escalationLevel}).`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function batchUpdateGrievancesByAdmin(params: {
  grievances: Pick<
    GrievanceRecord,
    | 'id'
    | 'collegeId'
    | 'escalationLevel'
    | 'trackingNumber'
    | 'resolutionNotes'
    | 'studentUid'
    | 'subject'
    | 'collegeAdminEmails'
  >[];
  status: GrievanceRecord['status'];
  escalationLevel?: GrievanceRecord['escalationLevel'] | 'keep';
  resolutionNotes?: string;
  adminUid: string;
  adminEmail: string;
  actorRole: 'college_admin' | 'state_admin';
}): Promise<{ updatedCount: number }> {
  if (params.grievances.length === 0) {
    return { updatedCount: 0 };
  }

  const CHUNK_SIZE = 150;
  const trimmedNote = clampStr(params.resolutionNotes || '', 1500);
  let updatedCount = 0;

  try {
    for (let i = 0; i < params.grievances.length; i += CHUNK_SIZE) {
      const chunk = params.grievances.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);

      for (const item of chunk) {
        const nextEscalation: GrievanceRecord['escalationLevel'] =
          params.escalationLevel && params.escalationLevel !== 'keep'
            ? params.escalationLevel
            : params.status === 'Escalated to University/State'
              ? 'University Grievance Cell'
              : item.escalationLevel;

        const nextNotes = trimmedNote
          ? trimmedNote
          : clampStr(item.resolutionNotes || `Batch status updated to ${params.status}.`, 1500);

        batch.update(doc(db, 'grievances', item.id), {
          status: params.status,
          escalationLevel: nextEscalation,
          resolutionNotes: nextNotes,
          handledByUid: params.adminUid,
          updatedAt: serverTimestamp(),
        });

        if (item.studentUid) {
          const ntfId = safeId('ntf_grv');
          batch.set(doc(db, 'notifications', ntfId), {
            id: ntfId,
            title: clampStr(`Grievance Update · ${item.trackingNumber}`, 180),
            message: clampStr(
              `"${item.subject}" was updated to ${params.status} (${nextEscalation}).${
                nextNotes ? ` Note: ${nextNotes}` : ''
              }`,
              1000
            ),
            scope: 'student',
            category: 'Grievance Update',
            collegeId: clampStr(item.collegeId, 128),
            targetUid: clampStr(item.studentUid, 128),
            authorUid: params.adminUid,
            authorRole: params.actorRole,
            collegeAdminEmails: (item.collegeAdminEmails || [params.adminEmail]).slice(0, 3),
            isDemo: false,
            createdAt: serverTimestamp(),
          });
        }

        const logId = safeId('log');
        batch.set(doc(db, 'audit_logs', logId), {
          id: logId,
          actorUid: params.adminUid,
          actorEmail: clampStr(params.adminEmail, 180),
          actorRole: params.actorRole,
          action: 'GRIEVANCE_BATCH_STATUS_UPDATED',
          targetCollection: 'grievances',
          targetId: clampStr(item.id, 128),
          collegeId: clampStr(item.collegeId, 128),
          summary: clampStr(
            `Batch updated ${item.trackingNumber} to ${params.status} (${nextEscalation}).`,
            400
          ),
          createdAt: serverTimestamp(),
        });
      }

      await batch.commit();
      updatedCount += chunk.length;
    }

    return { updatedCount };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'grievances/batch');
  }
}

export async function updateScholarshipApplicationByAdmin(params: {
  application: ScholarshipApplicationRecord;
  status: ScholarshipApplicationRecord['status'];
  grievanceNote?: string;
  adminUid: string;
  adminEmail: string;
  actorRole: 'college_admin' | 'state_admin';
}) {
  const path = `scholarship_applications/${params.application.id}`;
  const noteToSave = clampStr(
    params.grievanceNote !== undefined ? params.grievanceNote : params.application.grievanceNote,
    600
  );
  try {
    await updateDoc(doc(db, 'scholarship_applications', params.application.id), {
      status: params.status,
      grievanceNote: noteToSave,
      updatedAt: serverTimestamp(),
    });

    const ntfId = safeId('ntf_sch');
    await setDoc(doc(db, 'notifications', ntfId), {
      id: ntfId,
      title: clampStr(`Scholarship Status: ${params.status}`, 180),
      message: clampStr(
        `${params.application.scholarshipTitle} (Ref: ${params.application.applicationRef}) moved to "${params.status}".${
          noteToSave ? ` Authority note: ${noteToSave}` : ''
        }`,
        1000
      ),
      scope: 'student',
      category: 'Scholarship',
      collegeId: clampStr(params.application.collegeId, 128),
      targetUid: clampStr(params.application.studentUid, 128),
      authorUid: params.adminUid,
      authorRole: params.actorRole,
      collegeAdminEmails: (params.application.collegeAdminEmails || [params.adminEmail]).slice(0, 3),
      isDemo: false,
      createdAt: serverTimestamp(),
    });

    await writeAuditLog({
      actorUid: params.adminUid,
      actorEmail: params.adminEmail,
      actorRole: params.actorRole,
      action: 'SCHOLARSHIP_STATUS_UPDATED',
      targetCollection: 'scholarship_applications',
      targetId: params.application.id,
      collegeId: params.application.collegeId,
      summary: `Scholarship ${params.application.applicationRef} updated to ${params.status}.`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function verifyEvidenceByAdmin(params: {
  evidenceId: string;
  status: 'Verified by Authority' | 'Needs Clarification';
  adminUid: string;
}) {
  const path = `grievance_evidence/${params.evidenceId}`;
  try {
    await updateDoc(doc(db, 'grievance_evidence', params.evidenceId), {
      humanVerificationStatus: params.status,
      verifiedByUid: params.adminUid,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function sendCollegeAnnouncement(params: {
  title: string;
  message: string;
  category: NotificationRecord['category'];
  collegeId: string;
  adminUid: string;
  adminEmail: string;
  targetStudents: StudentProfile[];
}) {
  const batch = writeBatch(db);
  const collegeNoticeId = safeId('ntf_col');

  try {
    batch.set(doc(db, 'notifications', collegeNoticeId), {
      id: collegeNoticeId,
      title: clampStr(params.title, 180),
      message: clampStr(params.message, 1000),
      scope: 'college',
      category: params.category,
      collegeId: params.collegeId,
      targetUid: '',
      authorUid: params.adminUid,
      authorRole: 'college_admin',
      collegeAdminEmails: [params.adminEmail],
      isDemo: false,
      createdAt: serverTimestamp(),
    });

    params.targetStudents.slice(0, 50).forEach((stu) => {
      const stuNoticeId = safeId('ntf_stu');
      batch.set(doc(db, 'notifications', stuNoticeId), {
        id: stuNoticeId,
        title: clampStr(params.title, 180),
        message: clampStr(params.message, 1000),
        scope: 'student',
        category: params.category,
        collegeId: params.collegeId,
        targetUid: stu.uid,
        authorUid: params.adminUid,
        authorRole: 'college_admin',
        collegeAdminEmails: [params.adminEmail],
        isDemo: false,
        createdAt: serverTimestamp(),
      });
    });

    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `notifications/${collegeNoticeId}`);
  }
}

// --- ACADEMIC DEPARTMENTS, COURSES, FEE STRUCTURES & INTEGRATIONS ---

export async function upsertDepartmentByAdmin(params: {
  department: Omit<DepartmentRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };
  adminUid: string;
  adminEmail: string;
  actorRole: 'college_admin' | 'state_admin';
}) {
  const id = params.department.id || safeId('dept');
  const path = `departments/${id}`;
  try {
    const existing = params.department.id ? await getDoc(doc(db, 'departments', id)) : null;
    await setDoc(doc(db, 'departments', id), {
      id,
      collegeId: clampStr(params.department.collegeId, 128),
      collegeCode: clampStr(params.department.collegeCode, 32),
      name: clampStr(params.department.name, 160),
      code: clampStr(params.department.code, 32),
      hodName: clampStr(params.department.hodName || '', 120),
      contactEmail: clampStr(params.department.contactEmail || '', 180),
      isDemo: Boolean(params.department.isDemo),
      createdAt: existing?.exists() ? existing.data().createdAt : serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await writeAuditLog({
      actorUid: params.adminUid,
      actorEmail: params.adminEmail,
      actorRole: params.actorRole,
      action: 'DEPARTMENT_UPSERTED',
      targetCollection: 'departments',
      targetId: id,
      collegeId: params.department.collegeId,
      summary: `Saved department ${params.department.code} (${params.department.name}).`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteDepartmentByAdmin(departmentId: string) {
  const path = `departments/${departmentId}`;
  try {
    await deleteDoc(doc(db, 'departments', departmentId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function upsertCourseByAdmin(params: {
  course: Omit<CourseRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };
  adminUid: string;
  adminEmail: string;
  actorRole: 'college_admin' | 'state_admin';
}) {
  const id = params.course.id || safeId('crs');
  const path = `courses/${id}`;
  try {
    const existing = params.course.id ? await getDoc(doc(db, 'courses', id)) : null;
    await setDoc(doc(db, 'courses', id), {
      id,
      collegeId: clampStr(params.course.collegeId, 128),
      collegeCode: clampStr(params.course.collegeCode, 32),
      name: clampStr(params.course.name, 160),
      degreeLevel: params.course.degreeLevel,
      branch: clampStr(params.course.branch, 120),
      department: clampStr(params.course.department || params.course.branch, 120),
      durationYears: Number(params.course.durationYears || 4),
      intake: Number(params.course.intake || 60),
      isDemo: Boolean(params.course.isDemo),
      createdAt: existing?.exists() ? existing.data().createdAt : serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await writeAuditLog({
      actorUid: params.adminUid,
      actorEmail: params.adminEmail,
      actorRole: params.actorRole,
      action: 'COURSE_UPSERTED',
      targetCollection: 'courses',
      targetId: id,
      collegeId: params.course.collegeId,
      summary: `Saved course ${params.course.degreeLevel} - ${params.course.name} (${params.course.branch}, Intake ${params.course.intake}).`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteCourseByAdmin(courseId: string) {
  const path = `courses/${courseId}`;
  try {
    await deleteDoc(doc(db, 'courses', courseId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function upsertFeeStructureByAdmin(params: {
  structure: Omit<FeeStructureRecord, 'id' | 'updatedByUid' | 'createdAt' | 'updatedAt'> & { id?: string };
  adminUid: string;
  adminEmail: string;
}) {
  const id = params.structure.id || safeId('fstr');
  const path = `fee_structures/${id}`;
  try {
    const existing = params.structure.id ? await getDoc(doc(db, 'fee_structures', id)) : null;
    await setDoc(doc(db, 'fee_structures', id), {
      id,
      collegeId: clampStr(params.structure.collegeId, 128),
      collegeCode: clampStr(params.structure.collegeCode, 32),
      academicYear: clampStr(params.structure.academicYear, 32),
      course: clampStr(params.structure.course, 120),
      category: params.structure.category,
      amount: Number(params.structure.amount || 0),
      dueDate: clampStr(params.structure.dueDate, 40),
      isDemo: Boolean(params.structure.isDemo),
      updatedByUid: params.adminUid,
      createdAt: existing?.exists() ? existing.data().createdAt : serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await writeAuditLog({
      actorUid: params.adminUid,
      actorEmail: params.adminEmail,
      actorRole: 'college_admin',
      action: 'FEE_STRUCTURE_UPSERTED',
      targetCollection: 'fee_structures',
      targetId: id,
      collegeId: params.structure.collegeId,
      summary: `Saved fee schedule ${params.structure.category} (${params.structure.course}): ₹${params.structure.amount}.`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteFeeStructureByAdmin(structureId: string) {
  const path = `fee_structures/${structureId}`;
  try {
    await deleteDoc(doc(db, 'fee_structures', structureId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function upsertCollegeIntegrationByAdmin(params: {
  integration: Omit<CollegeIntegrationRecord, 'updatedAt'>;
  adminUid: string;
  adminEmail: string;
  actorRole: 'college_admin' | 'state_admin';
}) {
  const path = `college_integrations/${params.integration.collegeId}`;
  try {
    await setDoc(doc(db, 'college_integrations', params.integration.collegeId), {
      collegeId: clampStr(params.integration.collegeId, 128),
      collegeCode: clampStr(params.integration.collegeCode, 32),
      collegeName: clampStr(params.integration.collegeName, 200),
      district: clampStr(params.integration.district, 80),
      adapterType: params.integration.adapterType,
      status: params.integration.status,
      readOnlySync: Boolean(params.integration.readOnlySync),
      authorizedByOfficer: clampStr(params.integration.authorizedByOfficer || params.adminEmail, 160),
      authorizationRef: clampStr(params.integration.authorizationRef || '', 120),
      endpointUrl: clampStr(params.integration.endpointUrl || '', 240),
      lastSyncAt: clampStr(params.integration.lastSyncAt || '', 64),
      lastSyncStatus: params.integration.lastSyncStatus || 'Idle',
      recordsSynced: Number(params.integration.recordsSynced || 0),
      updatedAt: serverTimestamp(),
    });
    await writeAuditLog({
      actorUid: params.adminUid,
      actorEmail: params.adminEmail,
      actorRole: params.actorRole,
      action: 'INTEGRATION_CONFIGURED',
      targetCollection: 'college_integrations',
      targetId: params.integration.collegeId,
      collegeId: params.integration.collegeId,
      summary: `Configured ${params.integration.adapterType} (${params.integration.status}) for ${params.integration.collegeCode}.`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function updateCollegeProfileByAdmin(params: {
  college: CollegeRecord;
  adminUid: string;
  adminEmail: string;
}) {
  const path = `colleges/${params.college.id}`;
  try {
    await updateDoc(doc(db, 'colleges', params.college.id), {
      address: clampStr(params.college.address, 300),
      location: clampStr(params.college.location || params.college.district, 120),
      affiliatedUniversity: clampStr(params.college.affiliatedUniversity, 160),
      accreditation: clampStr(params.college.accreditation, 160),
      website: clampStr(params.college.website || '', 240),
      contactEmail: clampStr(params.college.contactEmail || '', 180),
      contactPhone: clampStr(params.college.contactPhone || '', 80),
      updatedByUid: params.adminUid,
      updatedAt: serverTimestamp(),
    });

    await writeAuditLog({
      actorUid: params.adminUid,
      actorEmail: params.adminEmail,
      actorRole: 'college_admin',
      action: 'COLLEGE_PROFILE_UPDATED',
      targetCollection: 'colleges',
      targetId: params.college.id,
      collegeId: params.college.id,
      summary: `College admin updated profile for ${params.college.code}.`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

// --- STATE ADMIN OPERATIONS ---

export async function upsertVerifiedCollegeByStateAdmin(params: {
  college: CollegeRecord;
  adminUid: string;
  adminEmail: string;
}) {
  const path = `colleges/${params.college.id}`;
  try {
    const existing = await getDoc(doc(db, 'colleges', params.college.id));
    await setDoc(doc(db, 'colleges', params.college.id), {
      id: params.college.id,
      code: clampStr(params.college.code, 32),
      name: clampStr(params.college.name, 200),
      location: clampStr(params.college.location || params.college.district, 120),
      district: clampStr(params.college.district, 80),
      address: clampStr(params.college.address, 300),
      management: params.college.management,
      category: params.college.category || 'Engineering & Technology',
      affiliatedUniversity: clampStr(params.college.affiliatedUniversity, 160),
      accreditation: clampStr(params.college.accreditation, 160),
      website: clampStr(params.college.website || '', 240),
      contactEmail: clampStr(params.college.contactEmail || '', 180),
      contactPhone: clampStr(params.college.contactPhone || '', 80),
      verificationStatus: params.college.verificationStatus,
      integrationStatus: params.college.integrationStatus || 'Requires Integration',
      sourceUrl: clampStr(params.college.sourceUrl || '', 240),
      lastVerifiedDate: clampStr(params.college.lastVerifiedDate || new Date().toISOString().slice(0, 10), 40),
      isDemo: params.college.isDemo,
      coursesCount: params.college.coursesCount,
      adminEmails: params.college.adminEmails.slice(0, 3),
      updatedByUid: params.adminUid,
      createdAt: existing.exists() ? existing.data().createdAt : serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await writeAuditLog({
      actorUid: params.adminUid,
      actorEmail: params.adminEmail,
      actorRole: 'state_admin',
      action: 'COLLEGE_UPSERTED',
      targetCollection: 'colleges',
      targetId: params.college.id,
      collegeId: params.college.id,
      summary: `State Admin saved college ${params.college.code} (${params.college.verificationStatus}).`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function batchImportCollegesByStateAdmin(params: {
  colleges: CollegeRecord[];
  adminUid: string;
  adminEmail: string;
}) {
  if (params.colleges.length === 0) return;
  const CHUNK = 200;
  try {
    for (let i = 0; i < params.colleges.length; i += CHUNK) {
      const slice = params.colleges.slice(i, i + CHUNK);
      const batch = writeBatch(db);
      for (const col of slice) {
        batch.set(
          doc(db, 'colleges', col.id),
          {
            id: col.id,
            code: clampStr(col.code, 32),
            name: clampStr(col.name, 200),
            location: clampStr(col.location || col.district, 120),
            district: clampStr(col.district, 80),
            address: clampStr(col.address, 300),
            management: col.management,
            category: col.category || 'Engineering & Technology',
            affiliatedUniversity: clampStr(col.affiliatedUniversity, 160),
            accreditation: clampStr(col.accreditation, 160),
            website: clampStr(col.website || '', 240),
            contactEmail: clampStr(col.contactEmail || '', 180),
            contactPhone: clampStr(col.contactPhone || '', 80),
            verificationStatus: col.verificationStatus,
            integrationStatus: col.integrationStatus || 'Requires Integration',
            sourceUrl: clampStr(col.sourceUrl || '', 240),
            lastVerifiedDate: clampStr(col.lastVerifiedDate || new Date().toISOString().slice(0, 10), 40),
            isDemo: col.isDemo,
            coursesCount: col.coursesCount,
            adminEmails: col.adminEmails.slice(0, 3),
            updatedByUid: params.adminUid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }
      await batch.commit();
    }
    await writeAuditLog({
      actorUid: params.adminUid,
      actorEmail: params.adminEmail,
      actorRole: 'state_admin',
      action: 'COLLEGES_BULK_IMPORTED',
      targetCollection: 'colleges',
      targetId: `batch_${params.colleges.length}`,
      collegeId: '',
      summary: `State Admin bulk imported ${params.colleges.length} colleges into Firestore.`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'colleges/batch');
  }
}

export async function approveOrRevokeCollegeAdmin(params: {
  collegeAdmin: CollegeAdminProfile;
  decision: 'active' | 'revoked';
  stateAdminUid: string;
  stateAdminEmail: string;
  baseCollege?: CollegeRecord;
}) {
  const path = `college_admins/${params.collegeAdmin.uid}`;
  try {
    await updateDoc(doc(db, 'college_admins', params.collegeAdmin.uid), {
      status: params.decision,
      active: params.decision === 'active',
      approvedByUid: params.stateAdminUid,
      updatedAt: serverTimestamp(),
    });

    const colRef = doc(db, 'colleges', params.collegeAdmin.collegeId);
    const colSnap = await getDoc(colRef);
    if (colSnap.exists()) {
      const currentEmails = Array.isArray(colSnap.data().adminEmails) ? (colSnap.data().adminEmails as string[]) : [];
      const updatedEmails =
        params.decision === 'active'
          ? Array.from(new Set([...currentEmails, params.collegeAdmin.email])).slice(0, 3)
          : currentEmails.filter((e) => e !== params.collegeAdmin.email);
      await updateDoc(colRef, {
        adminEmails: updatedEmails,
        updatedByUid: params.stateAdminUid,
        updatedAt: serverTimestamp(),
      });
    } else if (params.baseCollege) {
      await setDoc(colRef, {
        id: params.baseCollege.id,
        code: params.baseCollege.code,
        name: params.baseCollege.name,
        location: params.baseCollege.location || params.baseCollege.district,
        district: params.baseCollege.district,
        address: params.baseCollege.address,
        management: params.baseCollege.management,
        category: params.baseCollege.category || 'Engineering & Technology',
        affiliatedUniversity: params.baseCollege.affiliatedUniversity,
        accreditation: params.baseCollege.accreditation,
        website: params.baseCollege.website || '',
        contactEmail: params.baseCollege.contactEmail || '',
        contactPhone: params.baseCollege.contactPhone || '',
        verificationStatus: params.baseCollege.verificationStatus,
        integrationStatus: params.baseCollege.integrationStatus || 'Requires Integration',
        sourceUrl: params.baseCollege.sourceUrl || '',
        lastVerifiedDate: params.baseCollege.lastVerifiedDate || '',
        isDemo: params.baseCollege.isDemo,
        coursesCount: params.baseCollege.coursesCount,
        adminEmails: params.decision === 'active' ? [params.collegeAdmin.email] : [],
        updatedByUid: params.stateAdminUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await writeAuditLog({
      actorUid: params.stateAdminUid,
      actorEmail: params.stateAdminEmail,
      actorRole: 'state_admin',
      action: `COLLEGE_ADMIN_${params.decision.toUpperCase()}`,
      targetCollection: 'college_admins',
      targetId: params.collegeAdmin.uid,
      collegeId: params.collegeAdmin.collegeId,
      summary: `State Admin set ${params.collegeAdmin.email} (${params.collegeAdmin.collegeCode}) to ${params.decision}.`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function createStateAnnouncement(params: {
  title: string;
  message: string;
  category: NotificationRecord['category'];
  adminUid: string;
  adminEmail: string;
}) {
  const id = safeId('ntf_state');
  const path = `notifications/${id}`;
  try {
    await setDoc(doc(db, 'notifications', id), {
      id,
      title: clampStr(params.title, 180),
      message: clampStr(params.message, 1000),
      scope: 'state',
      category: params.category,
      collegeId: '',
      targetUid: '',
      authorUid: params.adminUid,
      authorRole: 'state_admin',
      collegeAdminEmails: [],
      isDemo: false,
      createdAt: serverTimestamp(),
    });
    await writeAuditLog({
      actorUid: params.adminUid,
      actorEmail: params.adminEmail,
      actorRole: 'state_admin',
      action: 'STATE_ANNOUNCEMENT_PUBLISHED',
      targetCollection: 'notifications',
      targetId: id,
      collegeId: '',
      summary: `Published state announcement: ${clampStr(params.title, 80)}`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function upsertScholarshipByStateAdmin(params: {
  scholarship: ScholarshipRecord;
  adminUid: string;
  adminEmail: string;
}) {
  const path = `scholarships/${params.scholarship.id}`;
  try {
    await setDoc(doc(db, 'scholarships', params.scholarship.id), {
      ...params.scholarship,
      createdAt: serverTimestamp(),
    });
    await writeAuditLog({
      actorUid: params.adminUid,
      actorEmail: params.adminEmail,
      actorRole: 'state_admin',
      action: 'SCHOLARSHIP_UPSERTED',
      targetCollection: 'scholarships',
      targetId: params.scholarship.id,
      collegeId: '',
      summary: `Saved scholarship scheme: ${clampStr(params.scholarship.title, 80)}`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

// --- STUDENT ACADEMIC SUITE (ATTENDANCE, MARKS, TIMETABLE, RESULTS) ---

export async function createDemoAcademicSampleForStudent(student: StudentProfile) {
  const batch = writeBatch(db);
  const sampleSubjects: Array<
    Omit<
      AcademicSubjectRecord,
      | 'id'
      | 'studentUid'
      | 'studentRollId'
      | 'studentName'
      | 'collegeId'
      | 'collegeCode'
      | 'isDemo'
      | 'collegeAdminEmails'
      | 'updatedByUid'
      | 'createdAt'
      | 'updatedAt'
    >
  > = [
    {
      academicYear: '2025-26',
      semester: 'Semester III',
      subjectCode: 'CS301',
      subjectName: 'Data Structures & Algorithms',
      facultyName: 'Dr. R. Subramanyam',
      credits: 4,
      classesTotal: 48,
      classesAttended: 44,
      internalMarks: 28,
      externalMarks: 62,
      totalMarks: 90,
      grade: 'O',
      resultStatus: 'Pass',
    },
    {
      academicYear: '2025-26',
      semester: 'Semester III',
      subjectCode: 'CS302',
      subjectName: 'Database Management Systems',
      facultyName: 'Prof. K. Padmavathi',
      credits: 4,
      classesTotal: 46,
      classesAttended: 40,
      internalMarks: 27,
      externalMarks: 56,
      totalMarks: 83,
      grade: 'A+',
      resultStatus: 'Pass',
    },
    {
      academicYear: '2025-26',
      semester: 'Semester III',
      subjectCode: 'MA303',
      subjectName: 'Discrete Mathematics & Graph Theory',
      facultyName: 'Dr. V. Narasimha Rao',
      credits: 3,
      classesTotal: 42,
      classesAttended: 34,
      internalMarks: 25,
      externalMarks: 51,
      totalMarks: 76,
      grade: 'A',
      resultStatus: 'Pass',
    },
    {
      academicYear: '2026-27',
      semester: 'Semester IV',
      subjectCode: 'CS401',
      subjectName: 'Operating Systems & Kernel Design',
      facultyName: 'Dr. M. Lakshmi Narayana',
      credits: 4,
      classesTotal: 44,
      classesAttended: 39,
      internalMarks: 29,
      externalMarks: 58,
      totalMarks: 87,
      grade: 'A+',
      resultStatus: 'Pass',
    },
    {
      academicYear: '2026-27',
      semester: 'Semester IV',
      subjectCode: 'CS402',
      subjectName: 'Computer Networks & Security',
      facultyName: 'Prof. S. Harika',
      credits: 3,
      classesTotal: 40,
      classesAttended: 33,
      internalMarks: 26,
      externalMarks: 52,
      totalMarks: 78,
      grade: 'A',
      resultStatus: 'Pass',
    },
    {
      academicYear: '2026-27',
      semester: 'Semester IV',
      subjectCode: 'CS403',
      subjectName: 'Full-Stack Web Systems Lab',
      facultyName: 'Prof. P. Rajesh',
      credits: 2,
      classesTotal: 28,
      classesAttended: 26,
      internalMarks: 38,
      externalMarks: 56,
      totalMarks: 94,
      grade: 'O',
      resultStatus: 'Pass',
    },
  ];

  const firstId = safeId('acad_demo');
  try {
    sampleSubjects.forEach((subj, idx) => {
      const id = idx === 0 ? firstId : safeId(`acad_demo_${idx + 1}`);
      batch.set(doc(db, 'academic_records', id), {
        id,
        studentUid: student.uid,
        studentRollId: clampStr(student.studentRollId, 64),
        studentName: clampStr(student.fullName, 120),
        collegeId: student.collegeId,
        collegeCode: clampStr(student.collegeCode, 32),
        academicYear: clampStr(subj.academicYear, 32),
        semester: clampStr(subj.semester, 32),
        subjectCode: clampStr(subj.subjectCode, 32),
        subjectName: clampStr(subj.subjectName, 160),
        facultyName: clampStr(subj.facultyName, 120),
        credits: subj.credits,
        classesTotal: subj.classesTotal,
        classesAttended: subj.classesAttended,
        internalMarks: subj.internalMarks,
        externalMarks: subj.externalMarks,
        totalMarks: subj.totalMarks,
        grade: subj.grade,
        resultStatus: subj.resultStatus,
        isDemo: true,
        collegeAdminEmails: (student.collegeAdminEmails || []).slice(0, 3),
        updatedByUid: student.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `academic_records/${firstId}`);
  }
}

export async function upsertAcademicRecordByAdmin(params: {
  record: Omit<
    AcademicSubjectRecord,
    'id' | 'updatedByUid' | 'createdAt' | 'updatedAt'
  > & { id?: string };
  adminUid: string;
  adminEmail: string;
  actorRole: 'college_admin' | 'state_admin';
}) {
  const id = params.record.id || safeId('acad');
  const path = `academic_records/${id}`;
  const classesTotal = Math.max(0, Math.min(500, Math.round(Number(params.record.classesTotal || 0))));
  const classesAttended = Math.max(0, Math.min(classesTotal, Math.round(Number(params.record.classesAttended || 0))));
  const internalMarks = Math.max(0, Math.min(100, Number(params.record.internalMarks || 0)));
  const externalMarks = Math.max(0, Math.min(100, Number(params.record.externalMarks || 0)));
  const totalMarks = Math.max(0, Math.min(200, Number(params.record.totalMarks ?? internalMarks + externalMarks)));

  try {
    const existing = params.record.id ? await getDoc(doc(db, 'academic_records', id)) : null;
    await setDoc(doc(db, 'academic_records', id), {
      id,
      studentUid: params.record.studentUid,
      studentRollId: clampStr(params.record.studentRollId, 64),
      studentName: clampStr(params.record.studentName, 120),
      collegeId: params.record.collegeId,
      collegeCode: clampStr(params.record.collegeCode, 32),
      academicYear: clampStr(params.record.academicYear, 32),
      semester: clampStr(params.record.semester, 32),
      subjectCode: clampStr(params.record.subjectCode, 32),
      subjectName: clampStr(params.record.subjectName, 160),
      facultyName: clampStr(params.record.facultyName, 120),
      credits: Math.max(0, Math.min(12, Number(params.record.credits || 3))),
      classesTotal,
      classesAttended,
      internalMarks,
      externalMarks,
      totalMarks,
      grade: params.record.grade,
      resultStatus: params.record.resultStatus,
      isDemo: Boolean(params.record.isDemo),
      collegeAdminEmails: Array.from(
        new Set([...(params.record.collegeAdminEmails || []), params.adminEmail])
      ).slice(0, 3),
      updatedByUid: params.adminUid,
      createdAt: existing?.exists() ? existing.data().createdAt : serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const ntfId = safeId('ntf_acad');
    await setDoc(doc(db, 'notifications', ntfId), {
      id: ntfId,
      title: clampStr(`Academic Record Updated · ${params.record.subjectCode}`, 180),
      message: clampStr(
        `${params.record.subjectName} (${params.record.semester}): Attendance ${params.record.classesAttended}/${params.record.classesTotal}, Total ${params.record.totalMarks} (${params.record.grade} · ${params.record.resultStatus}).`,
        1000
      ),
      scope: 'student',
      category: 'Exam Update',
      collegeId: clampStr(params.record.collegeId, 128),
      targetUid: clampStr(params.record.studentUid, 128),
      authorUid: params.adminUid,
      authorRole: params.actorRole,
      collegeAdminEmails: [params.adminEmail],
      isDemo: Boolean(params.record.isDemo),
      createdAt: serverTimestamp(),
    });

    await writeAuditLog({
      actorUid: params.adminUid,
      actorEmail: params.adminEmail,
      actorRole: params.actorRole,
      action: 'ACADEMIC_RECORD_UPSERTED',
      targetCollection: 'academic_records',
      targetId: id,
      collegeId: params.record.collegeId,
      summary: `Updated academic record ${params.record.subjectCode} for ${params.record.studentRollId}.`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteAcademicRecordByAdmin(recordId: string) {
  const path = `academic_records/${recordId}`;
  try {
    await deleteDoc(doc(db, 'academic_records', recordId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function upsertTimetableSlotByAdmin(params: {
  slot: Omit<TimetableSlotRecord, 'id' | 'updatedByUid' | 'createdAt' | 'updatedAt'> & { id?: string };
  adminUid: string;
  adminEmail: string;
  actorRole: 'college_admin' | 'state_admin';
}) {
  const id = params.slot.id || safeId('tt');
  const path = `timetables/${id}`;
  try {
    const existing = params.slot.id ? await getDoc(doc(db, 'timetables', id)) : null;
    await setDoc(doc(db, 'timetables', id), {
      id,
      collegeId: clampStr(params.slot.collegeId, 128),
      collegeCode: clampStr(params.slot.collegeCode, 32),
      department: clampStr(params.slot.department, 120),
      academicYear: clampStr(params.slot.academicYear, 32),
      semester: clampStr(params.slot.semester, 32),
      dayOfWeek: params.slot.dayOfWeek,
      startTime: clampStr(params.slot.startTime, 20),
      endTime: clampStr(params.slot.endTime, 20),
      subjectCode: clampStr(params.slot.subjectCode, 32),
      subjectName: clampStr(params.slot.subjectName, 160),
      facultyName: clampStr(params.slot.facultyName, 120),
      roomNumber: clampStr(params.slot.roomNumber, 40),
      slotType: params.slot.slotType,
      isDemo: Boolean(params.slot.isDemo),
      updatedByUid: params.adminUid,
      createdAt: existing?.exists() ? existing.data().createdAt : serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await writeAuditLog({
      actorUid: params.adminUid,
      actorEmail: params.adminEmail,
      actorRole: params.actorRole,
      action: 'TIMETABLE_SLOT_SAVED',
      targetCollection: 'timetables',
      targetId: id,
      collegeId: params.slot.collegeId,
      summary: `Saved ${params.slot.dayOfWeek} ${params.slot.startTime} (${params.slot.subjectCode}).`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteTimetableSlotByAdmin(slotId: string) {
  const path = `timetables/${slotId}`;
  try {
    await deleteDoc(doc(db, 'timetables', slotId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function seedSampleTimetableByAdmin(params: {
  collegeId: string;
  collegeCode: string;
  department: string;
  academicYear: string;
  semester: string;
  adminUid: string;
  adminEmail: string;
  actorRole: 'college_admin' | 'state_admin';
}) {
  const presets: Array<
    Pick<
      TimetableSlotRecord,
      'dayOfWeek' | 'startTime' | 'endTime' | 'subjectCode' | 'subjectName' | 'facultyName' | 'roomNumber' | 'slotType'
    >
  > = [
    { dayOfWeek: 'Monday', startTime: '09:15', endTime: '10:15', subjectCode: 'CS401', subjectName: 'Operating Systems', facultyName: 'Dr. M. Narayana', roomNumber: 'LH-204', slotType: 'Lecture' },
    { dayOfWeek: 'Monday', startTime: '10:15', endTime: '11:15', subjectCode: 'CS402', subjectName: 'Computer Networks', facultyName: 'Prof. S. Harika', roomNumber: 'LH-204', slotType: 'Lecture' },
    { dayOfWeek: 'Tuesday', startTime: '09:15', endTime: '11:15', subjectCode: 'CS403', subjectName: 'Full-Stack Web Systems Lab', facultyName: 'Prof. P. Rajesh', roomNumber: 'LAB-3', slotType: 'Lab' },
    { dayOfWeek: 'Wednesday', startTime: '10:15', endTime: '11:15', subjectCode: 'CS301', subjectName: 'Algorithms & Complexity', facultyName: 'Dr. R. Subramanyam', roomNumber: 'LH-201', slotType: 'Lecture' },
    { dayOfWeek: 'Thursday', startTime: '11:30', endTime: '12:30', subjectCode: 'CS302', subjectName: 'Database Systems', facultyName: 'Prof. K. Padmavathi', roomNumber: 'LH-204', slotType: 'Tutorial' },
    { dayOfWeek: 'Friday', startTime: '14:00', endTime: '16:00', subjectCode: 'CS490', subjectName: 'Placement Readiness Seminar', facultyName: 'Training & Placement Cell', roomNumber: 'AUD-1', slotType: 'Seminar' },
    { dayOfWeek: 'Saturday', startTime: '09:30', endTime: '11:00', subjectCode: 'APT-01', subjectName: 'GATE & Quantitative Aptitude', facultyName: 'Prof. A. Srinivas', roomNumber: 'LH-102', slotType: 'Tutorial' },
  ];

  const batch = writeBatch(db);
  const firstId = safeId('tt_demo');
  try {
    presets.forEach((slot, i) => {
      const id = i === 0 ? firstId : safeId(`tt_demo_${i + 1}`);
      batch.set(doc(db, 'timetables', id), {
        id,
        collegeId: clampStr(params.collegeId, 128),
        collegeCode: clampStr(params.collegeCode, 32),
        department: clampStr(params.department, 120),
        academicYear: clampStr(params.academicYear, 32),
        semester: clampStr(params.semester, 32),
        dayOfWeek: slot.dayOfWeek,
        startTime: slot.startTime,
        endTime: slot.endTime,
        subjectCode: slot.subjectCode,
        subjectName: slot.subjectName,
        facultyName: slot.facultyName,
        roomNumber: slot.roomNumber,
        slotType: slot.slotType,
        isDemo: true,
        updatedByUid: params.adminUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `timetables/${firstId}`);
  }
}

// --- CAREER SUITE (PLACEMENTS, JOBS, INTERNSHIPS, RESUME) ---

export async function upsertPlacementOpportunityByAdmin(params: {
  opportunity: Omit<
    PlacementOpportunityRecord,
    'id' | 'postedByUid' | 'createdAt' | 'updatedAt'
  > & { id?: string };
  adminUid: string;
  adminEmail: string;
  actorRole: 'college_admin' | 'state_admin';
}) {
  const id = params.opportunity.id || safeId('drv');
  const path = `placement_opportunities/${id}`;
  try {
    const existing = params.opportunity.id ? await getDoc(doc(db, 'placement_opportunities', id)) : null;
    await setDoc(doc(db, 'placement_opportunities', id), {
      id,
      collegeId: clampStr(params.opportunity.collegeId, 128),
      collegeCode: clampStr(params.opportunity.collegeCode, 32),
      title: clampStr(params.opportunity.title, 200),
      companyName: clampStr(params.opportunity.companyName, 160),
      opportunityType: params.opportunity.opportunityType,
      roleCategory: clampStr(params.opportunity.roleCategory, 100),
      ctcOrStipend: clampStr(params.opportunity.ctcOrStipend, 80),
      location: clampStr(params.opportunity.location, 120),
      eligibilityCriteria: clampStr(params.opportunity.eligibilityCriteria, 300),
      minCgpa: Number(params.opportunity.minCgpa || 0),
      deadlineDate: clampStr(params.opportunity.deadlineDate, 40),
      applyUrl: clampStr(params.opportunity.applyUrl || '', 240),
      status: params.opportunity.status,
      description: clampStr(params.opportunity.description, 1200),
      isDemo: Boolean(params.opportunity.isDemo),
      postedByUid: params.adminUid,
      collegeAdminEmails: Array.from(
        new Set([...(params.opportunity.collegeAdminEmails || []), params.adminEmail])
      ).slice(0, 3),
      createdAt: existing?.exists() ? existing.data().createdAt : serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await writeAuditLog({
      actorUid: params.adminUid,
      actorEmail: params.adminEmail,
      actorRole: params.actorRole,
      action: 'PLACEMENT_DRIVE_UPSERTED',
      targetCollection: 'placement_opportunities',
      targetId: id,
      collegeId: params.opportunity.collegeId,
      summary: `Posted ${params.opportunity.opportunityType}: ${params.opportunity.companyName} — ${params.opportunity.title}.`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deletePlacementOpportunityByAdmin(oppId: string) {
  const path = `placement_opportunities/${oppId}`;
  try {
    await deleteDoc(doc(db, 'placement_opportunities', oppId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function applyToPlacementByStudent(params: {
  opportunity: Pick<
    PlacementOpportunityRecord,
    'id' | 'title' | 'companyName' | 'opportunityType'
  >;
  student: StudentProfile;
  cgpaSnapshot: number;
  resumeSnapshotId: string;
  coverNote: string;
}) {
  const id = safeId('plapp');
  const path = `placement_applications/${id}`;
  try {
    const adminEmails = await getCollegeAdminEmailsForCollege(params.student.collegeId);
    const effectiveAdminEmails =
      adminEmails.length > 0 ? adminEmails : params.student.collegeAdminEmails || [];

    await setDoc(doc(db, 'placement_applications', id), {
      id,
      opportunityId: clampStr(params.opportunity.id, 128),
      opportunityTitle: clampStr(params.opportunity.title, 200),
      companyName: clampStr(params.opportunity.companyName, 160),
      opportunityType: params.opportunity.opportunityType,
      studentUid: params.student.uid,
      studentName: clampStr(params.student.fullName, 120),
      studentRollId: clampStr(params.student.studentRollId, 64),
      collegeId: params.student.collegeId,
      collegeName: clampStr(params.student.collegeName, 200),
      cgpaSnapshot: Math.max(0, Math.min(10, Number(params.cgpaSnapshot || 0))),
      resumeSnapshotId: clampStr(params.resumeSnapshotId, 128),
      coverNote: clampStr(params.coverNote || '', 800),
      status: 'Applied',
      authorityRemark: '',
      collegeAdminEmails: effectiveAdminEmails.slice(0, 3),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function withdrawPlacementApplicationByStudent(appId: string) {
  const path = `placement_applications/${appId}`;
  try {
    await updateDoc(doc(db, 'placement_applications', appId), {
      status: 'Withdrawn',
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function updatePlacementApplicationByAdmin(params: {
  application: PlacementApplicationRecord;
  status: PlacementApplicationRecord['status'];
  authorityRemark: string;
  adminUid: string;
  adminEmail: string;
  actorRole: 'college_admin' | 'state_admin';
}) {
  const path = `placement_applications/${params.application.id}`;
  const cleanRemark = clampStr(params.authorityRemark, 600);
  try {
    await updateDoc(doc(db, 'placement_applications', params.application.id), {
      status: params.status,
      authorityRemark: cleanRemark,
      updatedAt: serverTimestamp(),
    });

    const ntfId = safeId('ntf_plc');
    await setDoc(doc(db, 'notifications', ntfId), {
      id: ntfId,
      title: clampStr(`Placement Update · ${params.application.companyName}`, 180),
      message: clampStr(
        `Your application for "${params.application.opportunityTitle}" (${params.application.opportunityType}) is now ${params.status}.${
          cleanRemark ? ` Placement Cell Note: ${cleanRemark}` : ''
        }`,
        1000
      ),
      scope: 'student',
      category: 'Announcement',
      collegeId: clampStr(params.application.collegeId, 128),
      targetUid: clampStr(params.application.studentUid, 128),
      authorUid: params.adminUid,
      authorRole: params.actorRole,
      collegeAdminEmails: (params.application.collegeAdminEmails || [params.adminEmail]).slice(0, 3),
      isDemo: false,
      createdAt: serverTimestamp(),
    });

    await writeAuditLog({
      actorUid: params.adminUid,
      actorEmail: params.adminEmail,
      actorRole: params.actorRole,
      action: 'PLACEMENT_APPLICATION_UPDATED',
      targetCollection: 'placement_applications',
      targetId: params.application.id,
      collegeId: params.application.collegeId,
      summary: `Updated placement application ${params.application.id} to ${params.status}.`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function saveStudentResume(resume: Omit<StudentResumeRecord, 'updatedAt'>) {
  const path = `student_resumes/${resume.uid}`;
  try {
    const cleanSkills = resume.skills
      .map((s) => clampStr(s, 60))
      .filter(Boolean)
      .slice(0, 30);
    const cleanCerts = resume.certifications
      .map((c) => clampStr(c, 120))
      .filter(Boolean)
      .slice(0, 20);
    const cleanProjects = resume.projects
      .filter((p) => p.title.trim())
      .slice(0, 10)
      .map((p) => ({
        title: clampStr(p.title, 120),
        role: clampStr(p.role, 80),
        techStack: clampStr(p.techStack, 160),
        description: clampStr(p.description, 400),
      }));

    await setDoc(doc(db, 'student_resumes', resume.uid), {
      uid: resume.uid,
      collegeId: clampStr(resume.collegeId, 128),
      headline: clampStr(resume.headline || 'Undergraduate Student', 180),
      summary: clampStr(resume.summary || '', 1200),
      cgpa: Math.max(0, Math.min(10, Number(resume.cgpa || 0))),
      skills: cleanSkills,
      educationSummary: clampStr(resume.educationSummary || '', 400),
      projects: cleanProjects,
      certifications: cleanCerts,
      linkedinUrl: clampStr(resume.linkedinUrl || '', 240),
      githubUrl: clampStr(resume.githubUrl || '', 240),
      portfolioUrl: clampStr(resume.portfolioUrl || '', 240),
      collegeAdminEmails: (resume.collegeAdminEmails || []).slice(0, 3),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

// --- COLLEGE SERVICES (HOSTEL, TRANSPORT, LIBRARY) ---

export async function createCollegeServiceRequestByStudent(params: {
  student: StudentProfile;
  serviceType: CollegeServiceRecord['serviceType'];
  requestTitle: string;
  detailsPrimary: string;
  detailsSecondary: string;
}) {
  const id = safeId('srv');
  const path = `college_services/${id}`;
  const adminEmails = await getCollegeAdminEmailsForCollege(params.student.collegeId);
  const effectiveAdminEmails =
    adminEmails.length > 0 ? adminEmails : params.student.collegeAdminEmails || [];

  try {
    await setDoc(doc(db, 'college_services', id), {
      id,
      studentUid: params.student.uid,
      studentRollId: clampStr(params.student.studentRollId, 64),
      studentName: clampStr(params.student.fullName, 120),
      collegeId: params.student.collegeId,
      collegeCode: clampStr(params.student.collegeCode, 32),
      serviceType: params.serviceType,
      requestTitle: clampStr(params.requestTitle, 180),
      referenceCode: `REQ-${String(Date.now()).slice(-6)}`,
      detailsPrimary: clampStr(params.detailsPrimary, 240),
      detailsSecondary: clampStr(params.detailsSecondary, 240),
      status: 'Requested',
      authorityRemark: '',
      isDemo: false,
      collegeAdminEmails: effectiveAdminEmails.slice(0, 3),
      handledByUid: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function createDemoCollegeServicesForStudent(student: StudentProfile) {
  const batch = writeBatch(db);
  const samples: Array<{
    serviceType: CollegeServiceRecord['serviceType'];
    requestTitle: string;
    referenceCode: string;
    detailsPrimary: string;
    detailsSecondary: string;
    status: CollegeServiceRecord['status'];
    authorityRemark: string;
  }> = [
    {
      serviceType: 'Hostel',
      requestTitle: '[DEMO] Men/Women Campus Residence Allotment',
      referenceCode: `DEMO-HST-${student.collegeCode}`,
      detailsPrimary: 'Block B · Room 214 (Twin Sharing, Non-AC)',
      detailsSecondary: 'Standard Mess Plan · Valid 2026-27 Academic Year',
      status: 'Active',
      authorityRemark: 'Illustrative demo hostel allocation sample.',
    },
    {
      serviceType: 'Transport',
      requestTitle: '[DEMO] Institutional Bus Route Pass',
      referenceCode: `DEMO-BUS-${student.collegeCode}`,
      detailsPrimary: 'Route 04 · Main Town Junction → Campus Gate',
      detailsSecondary: 'Shift A (07:45 AM Pickup) · Term Pass Active',
      status: 'Active',
      authorityRemark: 'Illustrative demo transport pass sample.',
    },
    {
      serviceType: 'Library',
      requestTitle: '[DEMO] Central Library Book Loan & Card',
      referenceCode: `DEMO-LIB-${student.collegeCode}`,
      detailsPrimary: 'Issued: "Operating System Concepts (Silberschatz)"',
      detailsSecondary: 'Loan Quota: 1 / 4 Books · Due in 14 Days',
      status: 'Active',
      authorityRemark: 'Illustrative demo library circulation record.',
    },
  ];

  const firstId = safeId('srv_demo');
  try {
    samples.forEach((s, i) => {
      const id = i === 0 ? firstId : safeId(`srv_demo_${i + 1}`);
      batch.set(doc(db, 'college_services', id), {
        id,
        studentUid: student.uid,
        studentRollId: clampStr(student.studentRollId, 64),
        studentName: clampStr(student.fullName, 120),
        collegeId: student.collegeId,
        collegeCode: clampStr(student.collegeCode, 32),
        serviceType: s.serviceType,
        requestTitle: s.requestTitle,
        referenceCode: clampStr(s.referenceCode, 64),
        detailsPrimary: s.detailsPrimary,
        detailsSecondary: s.detailsSecondary,
        status: s.status,
        authorityRemark: s.authorityRemark,
        isDemo: true,
        collegeAdminEmails: (student.collegeAdminEmails || []).slice(0, 3),
        handledByUid: student.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `college_services/${firstId}`);
  }
}

export async function cancelCollegeServiceByStudent(serviceId: string) {
  const path = `college_services/${serviceId}`;
  try {
    await updateDoc(doc(db, 'college_services', serviceId), {
      status: 'Closed',
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function upsertCollegeServiceByAdmin(params: {
  service: Omit<
    CollegeServiceRecord,
    'id' | 'handledByUid' | 'createdAt' | 'updatedAt'
  > & { id?: string };
  adminUid: string;
  adminEmail: string;
  actorRole: 'college_admin' | 'state_admin';
}) {
  const id = params.service.id || safeId('srv');
  const path = `college_services/${id}`;
  try {
    const existing = params.service.id ? await getDoc(doc(db, 'college_services', id)) : null;
    await setDoc(doc(db, 'college_services', id), {
      id,
      studentUid: params.service.studentUid,
      studentRollId: clampStr(params.service.studentRollId, 64),
      studentName: clampStr(params.service.studentName, 120),
      collegeId: params.service.collegeId,
      collegeCode: clampStr(params.service.collegeCode, 32),
      serviceType: params.service.serviceType,
      requestTitle: clampStr(params.service.requestTitle, 180),
      referenceCode: clampStr(params.service.referenceCode, 64),
      detailsPrimary: clampStr(params.service.detailsPrimary, 240),
      detailsSecondary: clampStr(params.service.detailsSecondary, 240),
      status: params.service.status,
      authorityRemark: clampStr(params.service.authorityRemark, 600),
      isDemo: Boolean(params.service.isDemo),
      collegeAdminEmails: Array.from(
        new Set([...(params.service.collegeAdminEmails || []), params.adminEmail])
      ).slice(0, 3),
      handledByUid: params.adminUid,
      createdAt: existing?.exists() ? existing.data().createdAt : serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const ntfId = safeId('ntf_srv');
    await setDoc(doc(db, 'notifications', ntfId), {
      id: ntfId,
      title: clampStr(`${params.service.serviceType} Service: ${params.service.status}`, 180),
      message: clampStr(
        `${params.service.requestTitle} (${params.service.referenceCode}) is now ${params.service.status}. ${params.service.detailsPrimary}${
          params.service.authorityRemark ? ` · Note: ${params.service.authorityRemark}` : ''
        }`,
        1000
      ),
      scope: 'student',
      category: 'Announcement',
      collegeId: clampStr(params.service.collegeId, 128),
      targetUid: clampStr(params.service.studentUid, 128),
      authorUid: params.adminUid,
      authorRole: params.actorRole,
      collegeAdminEmails: [params.adminEmail],
      isDemo: Boolean(params.service.isDemo),
      createdAt: serverTimestamp(),
    });

    await writeAuditLog({
      actorUid: params.adminUid,
      actorEmail: params.adminEmail,
      actorRole: params.actorRole,
      action: 'COLLEGE_SERVICE_UPDATED',
      targetCollection: 'college_services',
      targetId: id,
      collegeId: params.service.collegeId,
      summary: `${params.service.serviceType} pass/request ${params.service.referenceCode} set to ${params.service.status}.`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteCollegeServiceByAdmin(serviceId: string) {
  const path = `college_services/${serviceId}`;
  try {
    await deleteDoc(doc(db, 'college_services', serviceId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

// --- INSTITUTIONAL PHOTOGRAPHS & LOGOS (IMAGE GOVERNANCE) ---

export async function submitCollegeMediaByAdmin(params: {
  mediaId: string;
  college: Pick<CollegeRecord, 'id' | 'code' | 'name' | 'district'>;
  mediaCategory: CollegeMediaCategory;
  title: string;
  caption: string;
  imageUrl: string;
  storagePath: string;
  mimeType: string;
  width: number;
  height: number;
  sizeBytes: number;
  sha256: string;
  sourceUrl: string;
  licenseOrPermission: string;
  consentAttested: boolean;
  uploaderUid: string;
  uploaderEmail: string;
  actorRole: 'college_admin' | 'state_admin';
}) {
  const cleanId = params.mediaId.replace(/[^a-zA-Z0-9_-]/g, '');
  const path = `college_media/${cleanId}`;
  const isStateUploader = params.actorRole === 'state_admin';
  const approvalStatus: CollegeMediaRecord['approvalStatus'] = isStateUploader
    ? 'Approved'
    : 'Pending Approval';

  try {
    const adminEmails = await getCollegeAdminEmailsForCollege(params.college.id);
    const mergedAdminEmails = Array.from(new Set([...adminEmails, params.uploaderEmail])).slice(0, 3);

    await setDoc(doc(db, 'college_media', cleanId), {
      id: cleanId,
      collegeId: clampStr(params.college.id, 128),
      collegeCode: clampStr(params.college.code, 32),
      collegeName: clampStr(params.college.name, 200),
      district: clampStr(params.college.district, 80),
      mediaCategory: params.mediaCategory,
      title: clampStr(params.title, 180),
      caption: clampStr(params.caption, 400),
      imageUrl: clampStr(params.imageUrl, 300),
      storagePath: clampStr(params.storagePath, 300),
      mimeType: params.mimeType,
      width: Math.max(1, Math.min(12000, Math.round(params.width || 1))),
      height: Math.max(1, Math.min(12000, Math.round(params.height || 1))),
      sizeBytes: Math.max(100, Math.min(5242880, Math.round(params.sizeBytes))),
      sha256: clampStr(params.sha256, 80),
      sourceUrl: clampStr(params.sourceUrl, 300),
      licenseOrPermission: clampStr(params.licenseOrPermission, 240),
      consentAttested: Boolean(params.consentAttested),
      approvalStatus,
      reviewRemark: isStateUploader ? 'Published directly by State Administrator.' : '',
      uploadedByUid: params.uploaderUid,
      uploadedByEmail: clampStr(params.uploaderEmail, 180),
      reviewedByUid: isStateUploader ? params.uploaderUid : '',
      collegeAdminEmails: mergedAdminEmails,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await writeAuditLog({
      actorUid: params.uploaderUid,
      actorEmail: params.uploaderEmail,
      actorRole: params.actorRole,
      action: 'COLLEGE_MEDIA_SUBMITTED',
      targetCollection: 'college_media',
      targetId: cleanId,
      collegeId: params.college.id,
      summary: `Submitted "${clampStr(params.title, 80)}" (${params.mediaCategory}) for ${params.college.code} [${approvalStatus}].`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function reviewCollegeMediaByStateAdmin(params: {
  media: CollegeMediaRecord;
  decision: 'Approved' | 'Rejected';
  reviewRemark: string;
  reviewerUid: string;
  reviewerEmail: string;
}) {
  const path = `college_media/${params.media.id}`;
  const cleanRemark = clampStr(
    params.reviewRemark ||
      (params.decision === 'Approved'
        ? 'Verified institutional match, official source, and publication consent.'
        : 'Rejected during State Admin verification.'),
    500
  );

  try {
    await updateDoc(doc(db, 'college_media', params.media.id), {
      approvalStatus: params.decision,
      reviewRemark: cleanRemark,
      reviewedByUid: params.reviewerUid,
      updatedAt: serverTimestamp(),
    });

    await writeAuditLog({
      actorUid: params.reviewerUid,
      actorEmail: params.reviewerEmail,
      actorRole: 'state_admin',
      action: params.decision === 'Approved' ? 'COLLEGE_MEDIA_APPROVED' : 'COLLEGE_MEDIA_REJECTED',
      targetCollection: 'college_media',
      targetId: params.media.id,
      collegeId: params.media.collegeId,
      summary: `${params.decision} photograph "${clampStr(params.media.title, 60)}" for ${params.media.collegeCode}.`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deleteCollegeMediaRecord(params: {
  media: CollegeMediaRecord;
  actorUid: string;
  actorEmail: string;
  actorRole: 'college_admin' | 'state_admin';
}) {
  const path = `college_media/${params.media.id}`;
  try {
    await deleteDoc(doc(db, 'college_media', params.media.id));
    await writeAuditLog({
      actorUid: params.actorUid,
      actorEmail: params.actorEmail,
      actorRole: params.actorRole,
      action: 'COLLEGE_MEDIA_DELETED',
      targetCollection: 'college_media',
      targetId: params.media.id,
      collegeId: params.media.collegeId,
      summary: `Removed ${params.media.mediaCategory} media "${clampStr(params.media.title, 60)}" from ${params.media.collegeCode}.`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}


