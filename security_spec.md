# Andhra Student Hub — Security Specification (Phase 0)

## 1. Data Invariants
1. **Identity Integrity**: Every user-owned document (`students/{uid}`, `fee_records.studentUid`, `grievances.studentUid`, `grievance_evidence.studentUid`, `scholarship_applications.studentUid`) MUST match `request.auth.uid` on creation and remain immutable on update.
2. **Email Verification Mandate**: All authenticated reads of PII and all writes require `request.auth.token.email_verified == true`.
3. **Anti-Self-Promotion**: A user creating `students/{uid}` MUST set `verificationStatus == 'Pending'` and `verifiedByUid == ''`. A user requesting `college_admins/{uid}` MUST set `status == 'pending'`, `active == false`, and `approvedByUid == ''`. Only a State Admin can activate a `college_admins` record or create `state_admins`.
4. **College-Level Isolation**:
   - Students can read/list ONLY their own `students/{uid}`, `fee_records`, `fee_payments`, `grievances`, `grievance_evidence`, and `scholarship_applications`.
   - Students can read `notifications` ONLY if `scope == 'state'`, `targetUid == request.auth.uid`, or `collegeId == student.collegeId`.
   - College Admins can read/manage ONLY records whose `collegeId` matches their active `college_admins/{uid}.collegeId`.
5. **Terminal State Locking**: Once a grievance reaches `status == 'Closed'`, students cannot mutate it; only College Admin (for their college) or State Admin can modify or reopen.
6. **Temporal Integrity**: `createdAt` on create and `updatedAt` on update MUST equal `request.time`. `createdAt` is immutable on update.
7. **Audit Log Immutability**: `audit_logs` are append-only (`create` allowed for verified actors matching `actorUid == request.auth.uid`; `update` and `delete` strictly denied for everyone).
8. **Academic & Integration Isolation**: `departments` and `college_integrations` are readable publicly for directory transparency, while writes are restricted to the assigned active College Admin (`collegeId`) or State Admin; `college_integrations` enforces `readOnlySync == true` by default unless explicitly authorized by an administrator. `fee_structures` are readable by verified users and writable only by the assigned active College Admin or State Admin.
9. **Academic Integrity (`academic_records` & `timetables`)**: Students may never modify authoritative attendance, marks, grades, or official timetables; students may only create clearly-marked `isDemo == true` self-samples. Only the assigned active College Admin (`collegeId`) or State Admin may create/update official `academic_records` and `timetables`.
10. **Placement & Career Isolation (`placement_opportunities`, `placement_applications`, `student_resumes`)**: Students may submit `placement_applications` only in `Applied` state (`authorityRemark == ''`) and may only withdraw while `Applied`. Terminal placement outcomes (`Selected`, `Not Selected`, `Withdrawn`) cannot be altered by students. `student_resumes/{uid}` is readable only by the student owner, their assigned College Admin, or State Admin.
11. **College Services Isolation (`college_services`)**: Students can submit `Hostel`, `Transport`, or `Library` requests with `status == 'Requested'` (or `isDemo == true` sample passes) and cancel only non-approved requests (`Closed`). Allotment approvals, room/route numbers, and active pass issuance are restricted to the assigned active College Admin or State Admin.
12. **Institutional Media Governance (`college_media`)**: Public reads are strictly limited to `approvalStatus == 'Approved'` records. College Admins can submit official photographs strictly for their bound `collegeId`, requiring `consentAttested == true` (confirming permission and zero readable student IDs/phone numbers) and `approvalStatus == 'Pending Approval'`. Only verified State Admins can transition media to `Approved` or `Rejected`.

## 2. The "Dirty Dozen" + Extended Adversarial Payloads
1. **Privilege Escalation (Student -> Verified)**: Creating `students/{uid}` with `verificationStatus: 'Verified'`. -> Expected: `PERMISSION_DENIED`.
2. **College Admin Self-Approval**: Creating `college_admins/{uid}` with `active: true, status: 'active'`. -> Expected: `PERMISSION_DENIED`.
3. **Ghost Field Injection**: Creating `grievances/{id}` with an extra field `isAdminApproved: true`. -> Expected: `PERMISSION_DENIED`.
4. **UID Spoofing**: Creating `grievances/{id}` with `studentUid: 'victim-uid'`. -> Expected: `PERMISSION_DENIED`.
5. **Timestamp Forgery**: Creating `students/{uid}` with client-supplied past `createdAt`. -> Expected: `PERMISSION_DENIED`.
6. **Unverified Email Bypass**: Attempting write with `email_verified: false`. -> Expected: `PERMISSION_DENIED`.
7. **Cross-College Admin Tampering**: College Admin A (`collegeId: 'c1'`) attempting to update a grievance or fee record belonging to `collegeId: 'c2'`. -> Expected: `PERMISSION_DENIED`.
8. **Student Mutating Fee Balance**: Student attempting to update `paidAmount` or `pendingAmount` on `fee_records/{id}` (students may only set `discrepancyReported` & `discrepancyNote`). -> Expected: `PERMISSION_DENIED`.
9. **ID Poisoning**: Creating a document with a 300-character ID or invalid characters (`../admin`). -> Expected: `PERMISSION_DENIED`.
10. **Audit Log Tampering**: Any user attempting `update` or `delete` on `audit_logs/{id}`. -> Expected: `PERMISSION_DENIED`.
11. **PII Cross-Student Read**: Student A attempting `get` on `students/{studentB_uid}` or `student_resumes/{studentB_uid}`. -> Expected: `PERMISSION_DENIED`.
12. **Terminal Grievance Mutation**: Student attempting to alter a `Closed` grievance. -> Expected: `PERMISSION_DENIED`.
13. **Academic Grade Forgery**: Student attempting `update` on `academic_records/{id}` to raise `externalMarks` or `grade`. -> Expected: `PERMISSION_DENIED`.
14. **Placement Self-Selection**: Student creating or updating `placement_applications/{id}` with `status: 'Selected'`. -> Expected: `PERMISSION_DENIED`.
15. **Self-Issued Hostel/Bus Pass**: Student creating non-demo `college_services/{id}` with `status: 'Active'`. -> Expected: `PERMISSION_DENIED`.
16. **Statewide Placement Spoofing**: College Admin creating `placement_opportunities/{id}` with `collegeId: 'STATEWIDE'`. -> Expected: `PERMISSION_DENIED`.

