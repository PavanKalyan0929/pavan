import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Download, Eye, FileText, Printer, X } from 'lucide-react';
import {
  buildFeeReceiptPdfDocument,
  buildGrievanceSummaryPdfDocument,
  createPdfPreviewArtifact,
  type PdfPreviewArtifact,
} from '../lib/pdfGenerator.ts';
import type {
  FeePayment,
  FeeRecord,
  GrievanceEvidenceRecord,
  GrievanceRecord,
  StudentProfile,
} from '../types.ts';

export type FeeReceiptPreviewTarget =
  | {
      kind: 'fee_receipt';
      payment: FeePayment;
      feeRecord?: FeeRecord;
      student: StudentProfile;
    }
  | {
      kind: 'grievance_summary';
      grievance: GrievanceRecord;
      student: StudentProfile;
      evidences: GrievanceEvidenceRecord[];
    };

interface FeeReceiptPreviewProps {
  target: FeeReceiptPreviewTarget | null;
  onClose: () => void;
}

export function FeeReceiptPreview({ target, onClose }: FeeReceiptPreviewProps) {
  const [viewMode, setViewMode] = useState<'sheet' | 'pdf'>('sheet');
  const [artifact, setArtifact] = useState<PdfPreviewArtifact | null>(null);
  const [buildError, setBuildError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    if (!target) {
      setArtifact(null);
      return;
    }

    setBuildError(null);
    let created: PdfPreviewArtifact | null = null;
    try {
      const built =
        target.kind === 'fee_receipt'
          ? buildFeeReceiptPdfDocument({
              payment: target.payment,
              feeRecord: target.feeRecord,
              student: target.student,
            })
          : buildGrievanceSummaryPdfDocument({
              grievance: target.grievance,
              student: target.student,
              evidences: target.evidences,
            });
      created = createPdfPreviewArtifact(built);
      setArtifact(created);
    } catch (err) {
      setBuildError(err instanceof Error ? err.message : 'Unable to generate PDF preview.');
      setArtifact(null);
    }

    return () => {
      if (created?.blobUrl) {
        URL.revokeObjectURL(created.blobUrl);
      }
    };
  }, [target]);

  const generatedTimestamp = useMemo(() => new Date().toLocaleString('en-IN'), [target]);

  function handlePrint() {
    if (viewMode === 'pdf' && iframeRef.current?.contentWindow) {
      try {
        iframeRef.current.contentWindow.focus();
        iframeRef.current.contentWindow.print();
        return;
      } catch {
        // Fallback to window.print() if browser blocks cross-frame PDF print call
      }
    }
    window.print();
  }

  return (
    <AnimatePresence>
      {target && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/80 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-6 ash-print-overlay"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl ash-print-container"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Modal Controls (hidden during print) */}
            <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 ash-no-print">
              <div className="min-w-0">
                <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
                  {artifact
                    ? `${artifact.fileName} · ${artifact.pageCount} page(s) · ${artifact.sizeKb} KB`
                    : 'Preparing PDF preview...'}
                </div>
                <h2 className="font-display text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
                  {target.kind === 'fee_receipt'
                    ? 'Fee Receipt Print & PDF Preview'
                    : 'Grievance Summary Print & PDF Preview'}
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* View Mode Toggle */}
                <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setViewMode('sheet')}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md cursor-pointer whitespace-nowrap shrink-0 transition-colors ash-btn-press ${
                      viewMode === 'sheet'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Print Sheet
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('pdf')}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md cursor-pointer whitespace-nowrap shrink-0 transition-colors ash-btn-press ${
                      viewMode === 'pdf'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Live PDF
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer whitespace-nowrap shrink-0 ash-btn-press"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print
                </button>

                <button
                  type="button"
                  disabled={!artifact}
                  onClick={() => artifact?.save()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#1E40AF] dark:bg-blue-600 rounded-lg hover:bg-[#1E3A8A] dark:hover:bg-blue-500 disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0 ash-btn-press"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download PDF
                </button>

                <button
                  type="button"
                  aria-label="Close preview modal"
                  onClick={onClose}
                  className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer ash-btn-press"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

        {/* Preview Viewport */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {buildError && (
            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300 mb-4">
              {buildError}
            </div>
          )}

          {viewMode === 'pdf' && artifact ? (
            <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden h-[68vh] flex flex-col">
              <iframe
                ref={iframeRef}
                title="Live PDF Document Preview"
                src={artifact.blobUrl}
                className="w-full flex-1 border-0"
              />
              <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                <span>
                  If your browser restricts embedded PDF previews, switch to Print Sheet or click
                  Download PDF.
                </span>
                <a
                  href={artifact.blobUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-[#1E40AF] dark:text-blue-400 hover:underline whitespace-nowrap shrink-0"
                >
                  Open PDF in Tab
                </a>
              </div>
            </div>
          ) : (
            /* Print-Ready A4 Sheet Preview (intentionally kept on white paper surface for print fidelity) */
            <div className="bg-white border border-slate-200 dark:border-slate-700 rounded-lg max-w-[794px] mx-auto shadow-sm overflow-hidden ash-print-sheet">
              {/* Official Cobalt Header Band matching jsPDF output */}
              <div className="bg-[#1E40AF] text-white px-7 py-5">
                <div className="font-display text-lg font-extrabold tracking-tight">
                  ANDHRA STUDENT HUB (ASH)
                </div>
                <div className="text-xs text-blue-100 mt-0.5">
                  {target.kind === 'fee_receipt'
                    ? 'College-Wise Fee Payment Receipt'
                    : 'Student Grievance Summary & Redressal Record'}
                </div>
              </div>

              <div className="p-7 space-y-6 text-sm text-slate-900">
                {target.kind === 'fee_receipt' ? (
                  <>
                    {target.payment.isDemo && (
                      <div className="p-3 rounded-lg bg-amber-50 border border-amber-300 text-xs font-semibold text-amber-900">
                        DEMO SAMPLE RECEIPT — Illustrative testing record only. Not an official
                        balance.
                      </div>
                    )}

                    <section className="space-y-3">
                      <h3 className="font-display text-sm font-bold text-slate-900 border-b border-slate-200 pb-1.5">
                        Receipt Details
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="text-slate-500">Receipt Number:</span>{' '}
                          <span className="font-mono font-semibold text-slate-900">
                            {target.payment.receiptNumber}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500">Payment Date:</span>{' '}
                          <span className="font-medium text-slate-900">
                            {target.payment.paidAtLabel}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500">Payment Mode:</span>{' '}
                          <span className="font-medium text-slate-900">
                            {target.payment.paymentMode}
                          </span>
                        </div>
                        {target.feeRecord && (
                          <div>
                            <span className="text-slate-500">Academic Term:</span>{' '}
                            <span className="font-medium text-slate-900">
                              {target.feeRecord.academicYear} ({target.feeRecord.semester})
                            </span>
                          </div>
                        )}
                      </div>
                    </section>

                    <section className="space-y-3">
                      <h3 className="font-display text-sm font-bold text-slate-900 border-b border-slate-200 pb-1.5">
                        Student & Institution Information
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="text-slate-500">Student Name:</span>{' '}
                          <span className="font-semibold text-slate-900">
                            {target.student.fullName}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500">Roll / Hall Ticket ID:</span>{' '}
                          <span className="font-mono font-semibold text-slate-900">
                            {target.student.studentRollId}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500">Course & Branch:</span>{' '}
                          <span className="font-medium text-slate-900">
                            {target.student.course} · {target.student.branch}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500">Academic Year:</span>{' '}
                          <span className="font-medium text-slate-900">
                            {target.student.academicYear}
                          </span>
                        </div>
                        <div className="sm:col-span-2">
                          <span className="text-slate-500">Institution:</span>{' '}
                          <span className="font-medium text-slate-900">
                            {target.student.collegeName} ({target.student.collegeCode}) ·{' '}
                            {target.student.district} District
                          </span>
                        </div>
                      </div>
                    </section>

                    <section className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2.5 text-sm">
                      <div className="flex items-center justify-between font-bold text-emerald-700">
                        <span>Amount Paid (This Receipt)</span>
                        <span className="font-mono tabular-nums">
                          INR {target.payment.amount.toLocaleString('en-IN')}
                        </span>
                      </div>
                      {target.feeRecord && (
                        <>
                          <div className="flex items-center justify-between text-xs text-slate-600 pt-2 border-t border-slate-200">
                            <span>Total Semester Billed Fee</span>
                            <span className="font-mono tabular-nums">
                              INR {target.feeRecord.totalFee.toLocaleString('en-IN')}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs text-slate-600">
                            <span>Total Paid to Date</span>
                            <span className="font-mono tabular-nums">
                              INR {target.feeRecord.paidAmount.toLocaleString('en-IN')}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs font-bold text-slate-900 pt-1">
                            <span>Pending Balance ({target.feeRecord.status})</span>
                            <span className="font-mono tabular-nums">
                              INR {target.feeRecord.pendingAmount.toLocaleString('en-IN')}
                            </span>
                          </div>
                        </>
                      )}
                    </section>
                  </>
                ) : (
                  <>
                    <section className="space-y-3">
                      <h3 className="font-display text-sm font-bold text-slate-900 border-b border-slate-200 pb-1.5">
                        Tracking & Escalation Overview
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="text-slate-500">Tracking Number:</span>{' '}
                          <span className="font-mono font-bold text-[#1E40AF]">
                            {target.grievance.trackingNumber}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500">Current Status:</span>{' '}
                          <span className="font-semibold text-slate-900">
                            {target.grievance.status}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500">Escalation Level:</span>{' '}
                          <span className="font-medium text-slate-900">
                            {target.grievance.escalationLevel}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500">Category & Urgency:</span>{' '}
                          <span className="font-medium text-slate-900">
                            {target.grievance.category} · {target.grievance.aiUrgency}
                          </span>
                        </div>
                      </div>
                    </section>

                    <section className="space-y-3">
                      <h3 className="font-display text-sm font-bold text-slate-900 border-b border-slate-200 pb-1.5">
                        Complainant & Institution Details
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="text-slate-500">Student Name:</span>{' '}
                          <span className="font-semibold text-slate-900">
                            {target.grievance.studentName || target.student.fullName}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500">Roll / Hall Ticket ID:</span>{' '}
                          <span className="font-mono font-semibold text-slate-900">
                            {target.student.studentRollId}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500">Contact:</span>{' '}
                          <span className="font-medium text-slate-900">
                            {target.grievance.contactEmail} · {target.grievance.contactMobile}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500">Institution & District:</span>{' '}
                          <span className="font-medium text-slate-900">
                            {target.grievance.collegeName} ({target.grievance.district})
                          </span>
                        </div>
                      </div>
                    </section>

                    <section className="space-y-2">
                      <h3 className="font-display text-sm font-bold text-slate-900 border-b border-slate-200 pb-1.5">
                        Grievance Statement
                      </h3>
                      <div className="text-xs font-semibold text-slate-900">
                        Subject: {target.grievance.subject}
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                        {target.grievance.description}
                      </p>
                    </section>

                    <section className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-1.5 text-xs">
                      <div className="font-semibold text-[#1E40AF]">
                        AI-Assisted Preliminary Classification
                      </div>
                      <div className="text-slate-700">
                        Suggested Category: {target.grievance.aiSuggestedCategory} ·{' '}
                        {target.grievance.aiTriageSummary}
                      </div>
                      <div className="font-semibold text-amber-800">
                        {target.grievance.aiVerificationDisclaimer}
                      </div>
                    </section>

                    {target.evidences.length > 0 && (
                      <section className="space-y-2">
                        <h3 className="font-display text-sm font-bold text-slate-900 border-b border-slate-200 pb-1.5">
                          Supporting Evidence ({target.evidences.length})
                        </h3>
                        <div className="space-y-1.5 text-xs">
                          {target.evidences.map((ev) => (
                            <div key={ev.id} className="p-2.5 rounded bg-slate-50 border border-slate-200">
                              <div className="font-mono font-semibold text-slate-900">
                                {ev.fileName} ({ev.mimeType}, {Math.max(1, Math.round(ev.sizeBytes / 1024))} KB)
                              </div>
                              <div className="text-slate-600 mt-0.5">
                                {ev.humanVerificationStatus} · SHA-256: {ev.sha256.slice(0, 16)}...
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}

                    {target.grievance.resolutionNotes && (
                      <section className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
                        <div className="font-semibold mb-1">Authority Resolution Notes</div>
                        <div>{target.grievance.resolutionNotes}</div>
                      </section>
                    )}
                  </>
                )}

                <div className="pt-4 border-t border-slate-200 text-[11px] text-slate-500">
                  Generated via Andhra Student Hub on {generatedTimestamp}. Electronically generated
                  summary.
                </div>
              </div>
            </div>
          )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
