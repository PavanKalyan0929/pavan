export type UserRole = 'guest' | 'student' | 'college_admin' | 'state_admin';

export type CollegeCategory =
  | 'Engineering & Technology'
  | 'Degree & PG'
  | 'University Campus'
  | 'Polytechnic & Technical';

export type IntegrationStatus = 'Connected' | 'Read-Only Sync' | 'Requires Integration';

export interface CollegeRecord {
  id: string;
  code: string;
  name: string;
  location?: string;
  district: string;
  address: string;
  website?: string;
  contactEmail?: string;
  contactPhone?: string;
  management: 'Government' | 'Private Aided' | 'Private Un-aided' | 'Autonomous';
  category?: CollegeCategory;
  affiliatedUniversity: string;
  accreditation: string;
  verificationStatus: 'DEMO' | 'Verified' | 'Pending Verification';
  isDemo: boolean;
  coursesCount: number;
  courses?: string[];
  departments?: string[];
  sourceUrl?: string;
  lastVerifiedDate?: string;
  integrationStatus?: IntegrationStatus;
  integrationAdapter?: string;
  lastSyncAt?: string;
  logoUrl?: string;
  mainCampusPhotoUrl?: string;
  mainCampusPhotoStatus?: 'Verified' | 'Pending Approval' | 'Unavailable';
  photoSource?: string;
  photoLicense?: string;
  verifiedPhotosCount?: number;
  studentActivityPhotosCount?: number;
  lastPhotoVerifiedAt?: string;
  adminEmails: string[];
  updatedByUid?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface DepartmentRecord {
  id: string;
  collegeId: string;
  collegeCode: string;
  name: string;
  code: string;
  hodName: string;
  contactEmail: string;
  isDemo: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CourseRecord {
  id: string;
  collegeId: string;
  collegeCode: string;
  name: string;
  degreeLevel: 'UG' | 'PG' | 'Diploma' | 'Integrated';
  branch: string;
  department?: string;
  durationYears: number;
  intake: number;
  isDemo: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface StudentProfile {
  uid: string;
  fullName: string;
  email: string;
  collegeEmail?: string;
  collegeEmailVerified?: boolean;
  otpVerifiedAt?: string;
  mobile: string;
  collegeId: string;
  collegeCode: string;
  collegeName: string;
  district: string;
  studentRollId: string;
  course: string;
  branch: string;
  department?: string;
  academicYear: string;
  admissionYear?: string;
  verificationStatus: 'Pending' | 'Verified' | 'Rejected';
  verifiedByUid: string;
  collegeAdminEmails: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CollegeAdminProfile {
  uid: string;
  email: string;
  fullName: string;
  designation: string;
  collegeId: string;
  collegeCode: string;
  collegeName: string;
  status: 'pending' | 'active' | 'revoked';
  active: boolean;
  approvedByUid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CollegeIntegrationRecord {
  collegeId: string;
  collegeCode: string;
  collegeName: string;
  district: string;
  adapterType: 'None' | 'REST_API_READONLY' | 'CSV_XLSX_IMPORT' | 'SFTP_BATCH' | 'WEBHOOK_SYNC';
  status: IntegrationStatus;
  readOnlySync: boolean;
  authorizedByOfficer: string;
  authorizationRef: string;
  endpointUrl: string;
  lastSyncAt: string;
  lastSyncStatus: 'Idle' | 'Success' | 'Partial' | 'Failed';
  recordsSynced: number;
  updatedAt?: unknown;
}

export interface IntegrationSyncLog {
  id: string;
  collegeId: string;
  collegeCode: string;
  adapterType: string;
  mode: 'read_only_api' | 'csv_import' | 'manual_verification';
  status: 'Success' | 'Failed' | 'Skipped';
  recordsProcessed: number;
  recordsCreated: number;
  recordsSkipped: number;
  summary: string;
  actorEmail: string;
  createdAt: string;
}

export interface FeeStructureRecord {
  id: string;
  collegeId: string;
  collegeCode: string;
  academicYear: string;
  course: string;
  category: 'Tuition Fee' | 'Hostel & Mess' | 'Exam Fee' | 'Lab & Library' | 'Transport' | 'Miscellaneous';
  amount: number;
  dueDate: string;
  isDemo: boolean;
  updatedByUid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface FeeRecord {
  id: string;
  studentUid: string;
  studentRollId: string;
  studentName: string;
  collegeId: string;
  collegeName: string;
  academicYear: string;
  semester: string;
  feeCategory?: 'Tuition Fee' | 'Hostel & Mess' | 'Exam Fee' | 'Lab & Library' | 'Composite Term Fee';
  dueDate?: string;
  totalFee: number;
  paidAmount: number;
  pendingAmount: number;
  isDemo: boolean;
  status: 'Pending' | 'Partial' | 'Paid' | 'Disputed';
  discrepancyReported: boolean;
  discrepancyNote: string;
  collegeAdminEmails: string[];
  updatedByUid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface FeePayment {
  id: string;
  feeRecordId: string;
  studentUid: string;
  collegeId: string;
  amount: number;
  receiptNumber: string;
  paymentMode: 'UPI' | 'NEFT' | 'Challan' | 'Scholarship Reimbursement' | 'DEMO';
  isDemo: boolean;
  paidAtLabel: string;
  collegeAdminEmails: string[];
  recordedByUid: string;
  createdAt?: unknown;
}

export interface GrievanceRecord {
  id: string;
  trackingNumber: string;
  studentUid: string;
  studentName: string;
  contactEmail: string;
  contactMobile: string;
  collegeId: string;
  collegeName: string;
  district: string;
  category: string;
  subject: string;
  description: string;
  aiSuggestedCategory: string;
  aiUrgency: 'Low' | 'Medium' | 'High' | 'Critical';
  aiTriageSummary: string;
  aiVerificationDisclaimer: string;
  status: 'Submitted' | 'Under College Review' | 'Escalated to University/State' | 'Resolved' | 'Closed';
  escalationLevel: 'College Nodal Officer' | 'Principal / Dean' | 'University Grievance Cell' | 'State Oversight';
  resolutionNotes: string;
  handledByUid: string;
  collegeAdminEmails: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface GrievanceEvidenceRecord {
  id: string;
  grievanceId: string;
  studentUid: string;
  collegeId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  storagePath: string;
  aiAssistNote: string;
  humanVerificationStatus: 'Pending Human Verification' | 'Verified by Authority' | 'Needs Clarification';
  verifiedByUid: string;
  collegeAdminEmails: string[];
  createdAt?: unknown;
}

export interface ScholarshipRecord {
  id: string;
  title: string;
  provider: string;
  scholarshipType?: 'State Government' | 'Central Government' | 'Private / Institutional';
  category: string;
  amountLabel: string;
  eligibilitySummary: string;
  requiredDocuments?: string[];
  deadlineLabel: string;
  officialPortalUrl: string;
  isDemo: boolean;
  active: boolean;
}

export interface ScholarshipApplicationRecord {
  id: string;
  scholarshipId: string;
  scholarshipTitle: string;
  studentUid: string;
  studentName: string;
  collegeId: string;
  collegeName: string;
  applicationRef: string;
  status: 'Draft' | 'Submitted' | 'Institution Verified' | 'Disbursement Pending' | 'Disbursed' | 'Query Raised';
  grievanceNote: string;
  collegeAdminEmails: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface NotificationRecord {
  id: string;
  title: string;
  message: string;
  scope: 'state' | 'college' | 'student';
  category: 'Announcement' | 'Scholarship' | 'Fee Alert' | 'Grievance Update' | 'NPTEL' | 'Exam Update';
  collegeId: string;
  targetUid: string;
  authorUid: string;
  authorRole: 'state_admin' | 'college_admin' | 'system';
  collegeAdminEmails: string[];
  isDemo: boolean;
  createdAt?: unknown;
}

export interface AuditLogRecord {
  id: string;
  actorUid: string;
  actorEmail: string;
  actorRole: 'state_admin' | 'college_admin' | 'student';
  action: string;
  targetCollection: string;
  targetId: string;
  collegeId: string;
  summary: string;
  createdAt?: unknown;
}

export interface ExamUpdateItem {
  id: string;
  examName: string;
  conductingBody: string;
  stream: string;
  windowLabel: string;
  officialPortalUrl?: string;
  summary: string;
  isDemo: boolean;
}

export interface NptelUpdateItem {
  id: string;
  title: string;
  domain: string;
  creditsLabel: string;
  scheduleLabel: string;
  officialPortalUrl?: string;
  summary: string;
  isDemo: boolean;
}

export interface CareerOpportunityItem {
  id: string;
  title: string;
  track: 'APPSC' | 'UPSC' | 'SSC' | 'GATE' | 'NPTEL' | 'Internship' | 'Skill Development';
  organization: string;
  eligibility: string;
  modeOrLocation: string;
  officialPortalUrl: string;
  summary: string;
  isDemo: boolean;
}

export interface PlatformStats {
  totalColleges: number;
  verifiedColleges: number;
  pendingVerificationColleges: number;
  demoColleges: number;
  districtsCovered: number;
  connectedIntegrations: number;
  activeScholarships: number;
  careerTracks: number;
  examPortals: number;
  syncEventsRecorded: number;
  collegesWithVerifiedPhotos?: number;
  collegesWithStudentActivityPhotos?: number;
  collegesRequiringPhotos?: number;
  verifiedMediaTotal?: number;
  lastUpdated: string;
}

export type CollegeMediaCategory =
  | 'Official Logo'
  | 'Main Campus & Entrance'
  | 'Academic Building'
  | 'Classroom & Lecture Hall'
  | 'Computer & Engineering Lab'
  | 'Library & Reading Room'
  | 'Student Activity & Events'
  | 'Student-Faculty Communication'
  | 'Help Desk & Administration'
  | 'Infrastructure & Facilities';

export interface CollegeMediaRecord {
  id: string;
  collegeId: string;
  collegeCode: string;
  collegeName: string;
  district: string;
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
  approvalStatus: 'Pending Approval' | 'Approved' | 'Rejected';
  reviewRemark: string;
  uploadedByUid: string;
  uploadedByEmail: string;
  reviewedByUid: string;
  collegeAdminEmails: string[];
  isVerifiedPublicSeed?: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

// --- ACADEMIC RECORDS (ATTENDANCE, MARKS, TIMETABLE, RESULTS) ---

export interface AcademicSubjectRecord {
  id: string;
  studentUid: string;
  studentRollId: string;
  studentName: string;
  collegeId: string;
  collegeCode: string;
  academicYear: string;
  semester: string;
  subjectCode: string;
  subjectName: string;
  facultyName: string;
  credits: number;
  classesTotal: number;
  classesAttended: number;
  internalMarks: number;
  externalMarks: number;
  totalMarks: number;
  grade: 'O' | 'A+' | 'A' | 'B+' | 'B' | 'C' | 'F' | 'Pending';
  resultStatus: 'Pass' | 'Fail' | 'Pending';
  isDemo: boolean;
  collegeAdminEmails: string[];
  updatedByUid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface TimetableSlotRecord {
  id: string;
  collegeId: string;
  collegeCode: string;
  department: string;
  academicYear: string;
  semester: string;
  dayOfWeek: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';
  startTime: string;
  endTime: string;
  subjectCode: string;
  subjectName: string;
  facultyName: string;
  roomNumber: string;
  slotType: 'Lecture' | 'Lab' | 'Tutorial' | 'Seminar';
  isDemo: boolean;
  updatedByUid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

// --- CAREER SUITE (PLACEMENTS, JOBS, INTERNSHIPS, RESUME) ---

export interface PlacementOpportunityRecord {
  id: string;
  collegeId: string;
  collegeCode: string;
  title: string;
  companyName: string;
  opportunityType: 'Campus Placement' | 'Full-Time Job' | 'Internship';
  roleCategory: string;
  ctcOrStipend: string;
  location: string;
  eligibilityCriteria: string;
  minCgpa: number;
  deadlineDate: string;
  applyUrl: string;
  status: 'Open' | 'Shortlisting' | 'Closed';
  description: string;
  isDemo: boolean;
  postedByUid: string;
  collegeAdminEmails: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PlacementApplicationRecord {
  id: string;
  opportunityId: string;
  opportunityTitle: string;
  companyName: string;
  opportunityType: 'Campus Placement' | 'Full-Time Job' | 'Internship';
  studentUid: string;
  studentName: string;
  studentRollId: string;
  collegeId: string;
  collegeName: string;
  cgpaSnapshot: number;
  resumeSnapshotId: string;
  coverNote: string;
  status: 'Applied' | 'Shortlisted' | 'Interview Scheduled' | 'Selected' | 'Not Selected' | 'Withdrawn';
  authorityRemark: string;
  collegeAdminEmails: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ResumeProjectItem {
  title: string;
  role: string;
  techStack: string;
  description: string;
}

export interface StudentResumeRecord {
  uid: string;
  collegeId: string;
  headline: string;
  summary: string;
  cgpa: number;
  skills: string[];
  educationSummary: string;
  projects: ResumeProjectItem[];
  certifications: string[];
  linkedinUrl: string;
  githubUrl: string;
  portfolioUrl: string;
  collegeAdminEmails: string[];
  updatedAt?: unknown;
}

// --- COLLEGE SERVICES (HOSTEL, TRANSPORT, LIBRARY) ---

export interface CollegeServiceRecord {
  id: string;
  studentUid: string;
  studentRollId: string;
  studentName: string;
  collegeId: string;
  collegeCode: string;
  serviceType: 'Hostel' | 'Transport' | 'Library';
  requestTitle: string;
  referenceCode: string;
  detailsPrimary: string;
  detailsSecondary: string;
  status: 'Requested' | 'Approved' | 'Active' | 'Action Required' | 'Closed';
  authorityRemark: string;
  isDemo: boolean;
  collegeAdminEmails: string[];
  handledByUid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

