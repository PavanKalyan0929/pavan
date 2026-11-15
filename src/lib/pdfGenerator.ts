import { jsPDF } from 'jspdf';
import type {
  AcademicSubjectRecord,
  CollegeRecord,
  FeePayment,
  FeeRecord,
  GrievanceEvidenceRecord,
  GrievanceRecord,
  StudentProfile,
  StudentResumeRecord,
} from '../types.ts';

export interface PdfBuildResult {
  doc: jsPDF;
  fileName: string;
}

export interface PdfPreviewArtifact {
  blobUrl: string;
  fileName: string;
  pageCount: number;
  sizeKb: number;
  save: () => void;
}

function formatInr(amount: number): string {
  return `INR ${amount.toLocaleString('en-IN')}`;
}

function drawHeader(doc: jsPDF, subtitle: string) {
  doc.setFillColor(30, 64, 175); // #1E40AF
  doc.rect(0, 0, 210, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('ANDHRA STUDENT HUB (ASH)', 16, 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(subtitle, 16, 21);
}

function drawKeyValueRow(
  doc: jsPDF,
  label: string,
  value: string,
  x: number,
  y: number,
  labelWidth = 46
): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105);
  doc.text(label, x, y);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  const wrapped = doc.splitTextToSize(value || '-', 194 - (x + labelWidth));
  doc.text(wrapped, x + labelWidth, y);
  return y + Math.max(6.5, wrapped.length * 5);
}

export function buildFeeReceiptPdfDocument(params: {
  payment: FeePayment;
  feeRecord?: FeeRecord;
  student: StudentProfile;
}): PdfBuildResult {
  const { payment, feeRecord, student } = params;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  drawHeader(doc, 'College-Wise Fee Payment Receipt');

  let y = 38;

  if (payment.isDemo) {
    doc.setFillColor(254, 243, 199);
    doc.setDrawColor(217, 119, 6);
    doc.roundedRect(16, y - 4, 178, 11, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(146, 64, 14);
    doc.text(
      'DEMO SAMPLE RECEIPT — Illustrative testing record only. Not an official balance.',
      20,
      y + 3
    );
    y += 16;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('Receipt Details', 16, y);
  y += 6;
  doc.setDrawColor(226, 232, 240);
  doc.line(16, y, 194, y);
  y += 7;

  y = drawKeyValueRow(doc, 'Receipt Number:', payment.receiptNumber, 16, y);
  y = drawKeyValueRow(doc, 'Payment Date:', payment.paidAtLabel, 16, y);
  y = drawKeyValueRow(doc, 'Payment Mode:', payment.paymentMode, 16, y);
  if (feeRecord) {
    y = drawKeyValueRow(
      doc,
      'Academic Term:',
      `${feeRecord.academicYear} (${feeRecord.semester})`,
      16,
      y
    );
  }

  y += 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('Student & Institution Information', 16, y);
  y += 6;
  doc.line(16, y, 194, y);
  y += 7;

  y = drawKeyValueRow(doc, 'Student Name:', student.fullName, 16, y);
  y = drawKeyValueRow(doc, 'Roll / Hall Ticket ID:', student.studentRollId, 16, y);
  y = drawKeyValueRow(doc, 'Course & Branch:', `${student.course} · ${student.branch}`, 16, y);
  y = drawKeyValueRow(doc, 'Academic Year:', student.academicYear, 16, y);
  y = drawKeyValueRow(doc, 'Institution:', `${student.collegeName} (${student.collegeCode})`, 16, y);
  y = drawKeyValueRow(doc, 'District:', student.district, 16, y);
  y = drawKeyValueRow(doc, 'Registered Email:', student.email, 16, y);

  y += 6;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  const boxHeight = feeRecord ? 42 : 22;
  doc.roundedRect(16, y, 178, boxHeight, 2, 2, 'FD');

  let boxY = y + 9;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(21, 128, 61);
  doc.text('Amount Paid (This Receipt):', 22, boxY);
  doc.text(formatInr(payment.amount), 188, boxY, { align: 'right' });

  if (feeRecord) {
    boxY += 9;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(51, 65, 85);
    doc.text('Total Semester Billed Fee:', 22, boxY);
    doc.text(formatInr(feeRecord.totalFee), 188, boxY, { align: 'right' });

    boxY += 7;
    doc.text('Total Paid to Date:', 22, boxY);
    doc.text(formatInr(feeRecord.paidAmount), 188, boxY, { align: 'right' });

    boxY += 7;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`Pending Balance (${feeRecord.status}):`, 22, boxY);
    doc.text(formatInr(feeRecord.pendingAmount), 188, boxY, { align: 'right' });
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Generated via Andhra Student Hub on ${new Date().toLocaleString('en-IN')}. Electronically generated summary.`,
    16,
    282
  );

  const safeFile = payment.receiptNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
  return { doc, fileName: `ASH-Receipt-${safeFile}.pdf` };
}

export function buildGrievanceSummaryPdfDocument(params: {
  grievance: GrievanceRecord;
  student: StudentProfile;
  evidences: GrievanceEvidenceRecord[];
}): PdfBuildResult {
  const { grievance, student, evidences } = params;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  drawHeader(doc, 'Student Grievance Summary & Redressal Record');

  let y = 38;

  const ensureSpace = (needed = 24) => {
    if (y + needed > 274) {
      doc.addPage();
      y = 20;
    }
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('Tracking & Escalation Overview', 16, y);
  y += 6;
  doc.setDrawColor(226, 232, 240);
  doc.line(16, y, 194, y);
  y += 7;

  y = drawKeyValueRow(doc, 'Tracking Number:', grievance.trackingNumber, 16, y);
  y = drawKeyValueRow(doc, 'Current Status:', grievance.status, 16, y);
  y = drawKeyValueRow(doc, 'Escalation Level:', grievance.escalationLevel, 16, y);
  y = drawKeyValueRow(doc, 'Category:', grievance.category, 16, y);
  y = drawKeyValueRow(doc, 'AI Urgency Triage:', grievance.aiUrgency, 16, y);

  y += 5;
  ensureSpace(45);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('Complainant & Institution Details', 16, y);
  y += 6;
  doc.line(16, y, 194, y);
  y += 7;

  y = drawKeyValueRow(doc, 'Student Name:', grievance.studentName || student.fullName, 16, y);
  y = drawKeyValueRow(doc, 'Roll / Hall Ticket ID:', student.studentRollId, 16, y);
  y = drawKeyValueRow(
    doc,
    'Contact Info:',
    `${grievance.contactEmail} · ${grievance.contactMobile}`,
    16,
    y
  );
  y = drawKeyValueRow(doc, 'Institution:', grievance.collegeName, 16, y);
  y = drawKeyValueRow(doc, 'District:', grievance.district, 16, y);

  y += 5;
  ensureSpace(40);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('Grievance Statement', 16, y);
  y += 6;
  doc.line(16, y, 194, y);
  y += 7;

  y = drawKeyValueRow(doc, 'Subject:', grievance.subject, 16, y);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Description:', 16, y);
  y += 5.5;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  const descLines = doc.splitTextToSize(grievance.description || '-', 178);
  for (const line of descLines) {
    ensureSpace(10);
    doc.text(line, 16, y);
    y += 5;
  }

  y += 5;
  ensureSpace(35);

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  const triageLines = doc.splitTextToSize(
    `AI Suggested Category: ${grievance.aiSuggestedCategory} | Summary: ${grievance.aiTriageSummary}`,
    168
  );
  const disclaimerLines = doc.splitTextToSize(grievance.aiVerificationDisclaimer, 168);
  const aiBoxH = 12 + (triageLines.length + disclaimerLines.length) * 5;
  ensureSpace(aiBoxH + 8);
  doc.roundedRect(16, y, 178, aiBoxH, 2, 2, 'FD');

  let aiY = y + 7;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 64, 175);
  doc.text('AI-Assisted Preliminary Classification', 21, aiY);
  aiY += 5.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text(triageLines, 21, aiY);
  aiY += triageLines.length * 5;

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(146, 64, 14);
  doc.text(disclaimerLines, 21, aiY);
  y += aiBoxH + 8;

  if (evidences.length > 0) {
    ensureSpace(30);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(`Supporting Evidence (${evidences.length})`, 16, y);
    y += 6;
    doc.line(16, y, 194, y);
    y += 7;

    for (const ev of evidences) {
      ensureSpace(18);
      const sizeKb = Math.max(1, Math.round(ev.sizeBytes / 1024));
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text(`${ev.fileName} (${ev.mimeType}, ${sizeKb} KB)`, 16, y);
      y += 4.5;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text(
        `Verification Status: ${ev.humanVerificationStatus} · SHA-256: ${ev.sha256.slice(0, 16)}...`,
        16,
        y
      );
      y += 7;
    }
  }

  if (grievance.resolutionNotes) {
    ensureSpace(26);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(21, 128, 61);
    doc.text('Authority Resolution Notes', 16, y);
    y += 6;
    doc.line(16, y, 194, y);
    y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    const resLines = doc.splitTextToSize(grievance.resolutionNotes, 178);
    doc.text(resLines, 16, y);
    y += resLines.length * 5;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Generated via Andhra Student Hub on ${new Date().toLocaleString('en-IN')}.`,
    16,
    282
  );

  const safeTrack = grievance.trackingNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
  return { doc, fileName: `ASH-Grievance-${safeTrack}.pdf` };
}

export function createPdfPreviewArtifact(built: PdfBuildResult): PdfPreviewArtifact {
  const blob = built.doc.output('blob');
  const blobUrl = URL.createObjectURL(blob);
  return {
    blobUrl,
    fileName: built.fileName,
    pageCount: built.doc.getNumberOfPages(),
    sizeKb: Math.max(1, Math.round(blob.size / 1024)),
    save: () => built.doc.save(built.fileName),
  };
}

export function generateFeeReceiptPdf(params: {
  payment: FeePayment;
  feeRecord?: FeeRecord;
  student: StudentProfile;
}): void {
  const { doc, fileName } = buildFeeReceiptPdfDocument(params);
  doc.save(fileName);
}

export function generateGrievanceSummaryPdf(params: {
  grievance: GrievanceRecord;
  student: StudentProfile;
  evidences: GrievanceEvidenceRecord[];
}): void {
  const { doc, fileName } = buildGrievanceSummaryPdfDocument(params);
  doc.save(fileName);
}

export function generateAcademicTranscriptPdf(params: {
  student: StudentProfile;
  records: AcademicSubjectRecord[];
  semesterLabel?: string;
}): void {
  const { student, records, semesterLabel } = params;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  drawHeader(doc, 'Consolidated Academic Attendance, Marks & Result Statement');

  let y = 38;
  const hasDemo = records.some((r) => r.isDemo);
  if (hasDemo) {
    doc.setFillColor(254, 243, 199);
    doc.setDrawColor(217, 119, 6);
    doc.roundedRect(16, y - 4, 178, 10, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(146, 64, 14);
    doc.text('DEMO SAMPLE STATEMENT — Illustrative academic preview until official college sync.', 20, y + 2.5);
    y += 14;
  }

  y = drawKeyValueRow(doc, 'Student Name:', student.fullName, 16, y);
  y = drawKeyValueRow(doc, 'Roll / Hall Ticket ID:', student.studentRollId, 16, y);
  y = drawKeyValueRow(doc, 'Institution:', `${student.collegeName} (${student.collegeCode})`, 16, y);
  y = drawKeyValueRow(doc, 'Programme:', `${student.course} · ${student.department || student.branch}`, 16, y);
  y = drawKeyValueRow(doc, 'Scope:', semesterLabel || 'All Recorded Semesters', 16, y);

  y += 4;
  doc.setFillColor(241, 245, 249);
  doc.rect(16, y, 178, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Code', 18, y + 5.5);
  doc.text('Subject Title', 38, y + 5.5);
  doc.text('Att%', 116, y + 5.5, { align: 'right' });
  doc.text('Int/Ext', 142, y + 5.5, { align: 'right' });
  doc.text('Total', 160, y + 5.5, { align: 'right' });
  doc.text('Grade', 176, y + 5.5, { align: 'right' });
  doc.text('Res', 192, y + 5.5, { align: 'right' });
  y += 11;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  for (const r of records) {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    const attPct = r.classesTotal > 0 ? Math.round((r.classesAttended / r.classesTotal) * 100) : 0;
    doc.setTextColor(15, 23, 42);
    doc.text(r.subjectCode.slice(0, 10), 18, y);
    doc.text(r.subjectName.slice(0, 38), 38, y);
    doc.text(`${attPct}%`, 116, y, { align: 'right' });
    doc.text(`${r.internalMarks}/${r.externalMarks}`, 142, y, { align: 'right' });
    doc.text(String(r.totalMarks), 160, y, { align: 'right' });
    doc.text(r.grade, 176, y, { align: 'right' });
    doc.text(r.resultStatus, 192, y, { align: 'right' });
    doc.setDrawColor(241, 245, 249);
    doc.line(16, y + 2, 194, y + 2);
    y += 7;
  }

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Generated via Andhra Student Hub on ${new Date().toLocaleString('en-IN')}.`,
    16,
    282
  );
  doc.save(`ASH-Academic-Statement-${student.studentRollId.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`);
}

export function generateResumePdf(params: {
  student: StudentProfile;
  resume: StudentResumeRecord;
}): void {
  const { student, resume } = params;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 34, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(student.fullName, 16, 15);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(resume.headline || `${student.course} · ${student.department || student.branch}`, 16, 22);
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225);
  doc.text(
    `${student.collegeEmail || student.email}  |  ${student.mobile}  |  ${student.collegeName} (${student.collegeCode})`,
    16,
    29
  );

  let y = 44;
  const ensure = (need = 16) => {
    if (y + need > 276) {
      doc.addPage();
      y = 20;
    }
  };
  const sectionHeader = (title: string) => {
    ensure(20);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 64, 175);
    doc.text(title.toUpperCase(), 16, y);
    y += 2;
    doc.setDrawColor(203, 213, 225);
    doc.line(16, y, 194, y);
    y += 6;
  };

  if (resume.summary) {
    sectionHeader('Professional Summary');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    const lines = doc.splitTextToSize(resume.summary, 178);
    doc.text(lines, 16, y);
    y += lines.length * 5 + 6;
  }

  sectionHeader('Academic Education');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`${student.collegeName} (${student.collegeCode}) · ${student.district}`, 16, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.text(
    `${student.course} (${student.department || student.branch}) · ${student.academicYear} · CGPA: ${resume.cgpa.toFixed(2)} / 10`,
    16,
    y
  );
  y += 5;
  if (resume.educationSummary) {
    const eduLines = doc.splitTextToSize(resume.educationSummary, 178);
    doc.text(eduLines, 16, y);
    y += eduLines.length * 5;
  }
  y += 5;

  if (resume.skills.length > 0) {
    sectionHeader('Technical & Core Skills');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    const skillLines = doc.splitTextToSize(resume.skills.join('  ·  '), 178);
    doc.text(skillLines, 16, y);
    y += skillLines.length * 5 + 6;
  }

  if (resume.projects.length > 0) {
    sectionHeader('Academic & Engineering Projects');
    for (const proj of resume.projects) {
      ensure(22);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.text(`${proj.title}${proj.role ? ` — ${proj.role}` : ''}`, 16, y);
      y += 4.5;
      if (proj.techStack) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8.5);
        doc.setTextColor(71, 85, 105);
        doc.text(`Stack: ${proj.techStack}`, 16, y);
        y += 4.5;
      }
      if (proj.description) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);
        const pLines = doc.splitTextToSize(proj.description, 178);
        doc.text(pLines, 16, y);
        y += pLines.length * 4.5 + 3;
      }
    }
    y += 3;
  }

  if (resume.certifications.length > 0) {
    sectionHeader('Certifications & Achievements');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    for (const cert of resume.certifications) {
      ensure(10);
      doc.text(`• ${cert}`, 18, y);
      y += 5;
    }
    y += 4;
  }

  const links = [resume.linkedinUrl, resume.githubUrl, resume.portfolioUrl].filter(Boolean);
  if (links.length > 0) {
    sectionHeader('Verified Links');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 64, 175);
    links.forEach((lnk) => {
      ensure(8);
      doc.text(lnk, 16, y);
      y += 5;
    });
  }

  doc.save(`ASH-Resume-${student.fullName.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`);
}

export function generateDigitalIdPdf(params: {
  student: StudentProfile;
  college?: CollegeRecord | null;
}): void {
  const { student, college } = params;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  drawHeader(doc, 'Institutional Digital Student Identity Card');

  // Card frame (CR80 scaled cleanly on A4)
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(22, 42, 166, 98, 4, 4, 'F');
  doc.setFillColor(30, 64, 175);
  doc.rect(22, 42, 166, 20, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(student.collegeName.slice(0, 56), 28, 52);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`${student.collegeCode} · ${student.district} District, Andhra Pradesh`, 28, 58);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(student.fullName, 28, 76);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(203, 213, 225);
  doc.text(`Roll / Hall Ticket: ${student.studentRollId}`, 28, 85);
  doc.text(`Programme: ${student.course} · ${student.department || student.branch}`, 28, 92);
  doc.text(`Academic Year: ${student.academicYear} (Admitted ${student.admissionYear || '—'})`, 28, 99);
  doc.text(`Status: ${student.verificationStatus} · Email OTP: ${student.collegeEmailVerified ? 'Verified' : 'Pending'}`, 28, 106);

  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  const sigToken = `ASH-${student.collegeCode}-${student.studentRollId}-${student.uid.slice(0, 8).toUpperCase()}`;
  doc.text(`Verification Ref: ${sigToken}`, 28, 132);
  if (college?.affiliatedUniversity) {
    doc.text(`Affiliated: ${college.affiliatedUniversity.slice(0, 54)}`, 28, 125);
  }

  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Issued via Andhra Student Hub on ${new Date().toLocaleDateString('en-IN')}. Subject to active college verification status.`,
    22,
    152
  );

  doc.save(`ASH-Digital-ID-${student.studentRollId.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`);
}

