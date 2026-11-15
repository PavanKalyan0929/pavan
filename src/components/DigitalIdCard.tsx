import React, { useState } from 'react';
import {
  CheckCircle2,
  Download,
  Mail,
  QrCode,
  RotateCw,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { QrMatrixSvg } from './QrMatrixSvg.tsx';
import { generateDigitalIdPdf } from '../lib/pdfGenerator.ts';
import type { CollegeRecord, StudentProfile } from '../types.ts';

interface DigitalIdCardProps {
  student: StudentProfile;
  college: CollegeRecord | null;
}

export function DigitalIdCard({ student, college }: DigitalIdCardProps) {
  const [flipped, setFlipped] = useState(false);

  const verificationToken = `ASH-ID|${student.collegeCode}|${student.studentRollId}|${student.uid.slice(0, 8).toUpperCase()}|${student.verificationStatus}`;
  const isVerified = student.verificationStatus === 'Verified';
  const initials = student.fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('');

  return (
    <div className="space-y-6">
      {/* Summary Header & Actions */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs font-mono text-[#1E40AF] dark:text-blue-400">
            Digital Student Identity · {student.collegeCode}
          </div>
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
            Institutional Smart Identity Pass
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Tamper-evident identity card bound strictly to your Firestore verification status and college roll ID.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setFlipped((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer ash-btn-press whitespace-nowrap shrink-0"
          >
            <RotateCw className="w-3.5 h-3.5" />
            {flipped ? 'Show Front Side' : 'Flip for QR & Verification'}
          </button>
          <button
            type="button"
            onClick={() => generateDigitalIdPdf({ student, college })}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1E40AF] dark:bg-blue-600 rounded-lg hover:bg-[#1E3A8A] dark:hover:bg-blue-500 cursor-pointer ash-btn-press whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            Download Digital ID (PDF)
          </button>
        </div>
      </div>

      {/* 3D Interactive ID Card + Authority Check */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-7 ash-perspective">
          <div
            className={`relative w-full min-h-[300px] sm:min-h-[320px] ash-card-3d ${
              flipped ? 'is-flipped' : ''
            }`}
          >
            {/* FRONT FACE */}
            <div className="ash-card-face absolute inset-0 rounded-2xl overflow-hidden border border-slate-800 bg-[#0F172A] text-white shadow-xl flex flex-col justify-between">
              <div className="ash-id-sheen absolute inset-0 pointer-events-none" />
              <div className="relative z-10 bg-[#1E40AF] px-6 py-4 flex items-center justify-between gap-4 border-b border-blue-700/60">
                <div className="min-w-0">
                  <div className="text-[11px] font-mono text-blue-200 tracking-wide">
                    ANDHRA STUDENT HUB · INSTITUTIONAL PASS
                  </div>
                  <div className="font-display text-sm sm:text-base font-bold truncate mt-0.5">
                    {student.collegeName}
                  </div>
                </div>
                <span className="font-mono text-xs font-bold px-2.5 py-1 rounded bg-white/10 border border-white/20 shrink-0">
                  {student.collegeCode}
                </span>
              </div>

              <div className="relative z-10 px-6 py-5 flex flex-col sm:flex-row sm:items-center gap-5">
                <div className="w-20 h-24 rounded-xl bg-slate-800 border border-slate-700 flex flex-col items-center justify-center shrink-0">
                  <span className="font-display text-2xl font-bold text-blue-300">
                    {initials || 'ST'}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 mt-1">
                    {student.admissionYear || 'ID'}
                  </span>
                </div>

                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="font-display text-xl font-bold truncate">{student.fullName}</div>
                  <div className="font-mono text-xs text-blue-300">
                    Roll / HT No: {student.studentRollId}
                  </div>
                  <div className="text-xs text-slate-300">
                    {student.course} · {student.department || student.branch}
                  </div>
                  <div className="text-xs text-slate-400">
                    {student.academicYear} · {student.district} District, AP
                  </div>
                </div>

                <div className="hidden sm:block shrink-0">
                  <QrMatrixSvg value={verificationToken} size={88} />
                </div>
              </div>

              <div className="relative z-10 px-6 py-3 bg-slate-950/70 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span
                  className={`inline-flex items-center gap-1.5 font-semibold ${
                    isVerified
                      ? 'text-emerald-400'
                      : student.verificationStatus === 'Rejected'
                        ? 'text-red-400'
                        : 'text-amber-300'
                  }`}
                >
                  {isVerified ? (
                    <ShieldCheck className="w-4 h-4" />
                  ) : (
                    <ShieldAlert className="w-4 h-4" />
                  )}
                  Authority Status: {student.verificationStatus}
                </span>
                <span className="font-mono text-[11px] text-slate-400">
                  REF: {student.uid.slice(0, 8).toUpperCase()}
                </span>
              </div>
            </div>

            {/* BACK FACE */}
            <div className="ash-card-face ash-card-back absolute inset-0 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xl p-6 flex flex-col justify-between">
              <div className="flex items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
                <div>
                  <div className="text-xs font-mono text-[#1E40AF] dark:text-blue-400">
                    CAMPUS GATE & LIBRARY VERIFICATION
                  </div>
                  <h3 className="font-display text-base font-bold mt-0.5">
                    Institutional Security Telemetry
                  </h3>
                </div>
                <QrCode className="w-5 h-5 text-slate-400 shrink-0" />
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-5 py-2">
                <QrMatrixSvg value={verificationToken} size={118} />
                <div className="space-y-1.5 text-xs flex-1 min-w-0">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Signature Payload: </span>
                    <span className="font-mono break-all text-slate-800 dark:text-slate-200">
                      {verificationToken}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Registered Contact: </span>
                    <span className="font-mono">{student.mobile}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">College Email: </span>
                    <span className="break-all">{student.collegeEmail || student.email}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Affiliation: </span>
                    <span>{college?.affiliatedUniversity || 'Andhra Pradesh Higher Education'}</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between gap-2">
                <span>Non-transferable digital credential</span>
                <span>College Code: {student.collegeCode}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Verification Audit Panel */}
        <div className="xl:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
            Identity Trust Signals
          </h3>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            <div className="py-3 first:pt-0 flex items-center justify-between gap-3">
              <span className="text-slate-600 dark:text-slate-400">College Authority Approval</span>
              <span
                className={`font-semibold inline-flex items-center gap-1 ${
                  isVerified
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-amber-700 dark:text-amber-400'
                }`}
              >
                {isVerified ? <CheckCircle2 className="w-3.5 h-3.5" /> : <ShieldAlert className="w-3.5 h-3.5" />}
                {student.verificationStatus}
              </span>
            </div>
            <div className="py-3 flex items-center justify-between gap-3">
              <span className="text-slate-600 dark:text-slate-400">College Email OTP</span>
              <span
                className={`font-semibold inline-flex items-center gap-1 ${
                  student.collegeEmailVerified
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-amber-700 dark:text-amber-400'
                }`}
              >
                <Mail className="w-3.5 h-3.5" />
                {student.collegeEmailVerified ? 'Verified' : 'Pending OTP'}
              </span>
            </div>
            <div className="py-3 flex items-center justify-between gap-3">
              <span className="text-slate-600 dark:text-slate-400">Campus Gate / Library Token</span>
              <span className="font-mono text-slate-900 dark:text-slate-100">
                {student.collegeCode}-{student.studentRollId}
              </span>
            </div>
            <div className="py-3 last:pb-0 flex items-center justify-between gap-3">
              <span className="text-slate-600 dark:text-slate-400">Institution Record Status</span>
              <span className="font-medium text-slate-900 dark:text-slate-100">
                {college?.verificationStatus || 'Directory Synced'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
