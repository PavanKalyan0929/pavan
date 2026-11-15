import React, { useMemo } from 'react';
import { Award, CheckCircle2, Clock, Download, XCircle } from 'lucide-react';
import { generateAcademicTranscriptPdf } from '../../lib/pdfGenerator.ts';
import { AcademicProgressBar } from './AcademicProgressBar.tsx';
import type { AcademicSubjectRecord, StudentProfile } from '../../types.ts';

interface ExamResultsSectionProps {
  student: StudentProfile;
  records: AcademicSubjectRecord[];
  semesterFilter: string;
  onLoadDemo?: () => void;
  seedingDemo?: boolean;
}

const GRADE_POINTS: Record<AcademicSubjectRecord['grade'], number> = {
  O: 10,
  'A+': 9,
  A: 8,
  'B+': 7,
  B: 6,
  C: 5,
  F: 0,
  Pending: 0,
};

export function ExamResultsSection({
  student,
  records,
  semesterFilter,
  onLoadDemo,
  seedingDemo = false,
}: ExamResultsSectionProps) {
  // Defensive student & college ownership scoping
  const scopedRecords = useMemo(
    () =>
      records.filter(
        (r) => r.studentUid === student.uid && r.collegeId === student.collegeId
      ),
    [records, student.uid, student.collegeId]
  );

  const filteredRecords = useMemo(() => {
    if (semesterFilter === 'All') return scopedRecords;
    return scopedRecords.filter((r) => r.semester === semesterFilter);
  }, [scopedRecords, semesterFilter]);

  const metrics = useMemo(() => {
    let allWeighted = 0;
    let allGradedCredits = 0;
    let passedCredits = 0;
    let totalCredits = 0;
    let semWeighted = 0;
    let semGradedCredits = 0;
    let passCount = 0;
    let failCount = 0;
    let pendingCount = 0;

    for (const r of scopedRecords) {
      totalCredits += r.credits;
      if (r.resultStatus === 'Pass') passedCredits += r.credits;
      if (r.grade !== 'Pending') {
        allWeighted += (GRADE_POINTS[r.grade] || 0) * r.credits;
        allGradedCredits += r.credits;
      }
    }

    for (const r of filteredRecords) {
      if (r.resultStatus === 'Pass') passCount += 1;
      else if (r.resultStatus === 'Fail') failCount += 1;
      else pendingCount += 1;

      if (r.grade !== 'Pending') {
        semWeighted += (GRADE_POINTS[r.grade] || 0) * r.credits;
        semGradedCredits += r.credits;
      }
    }

    const cgpa = allGradedCredits > 0 ? Math.round((allWeighted / allGradedCredits) * 100) / 100 : 0;
    const sgpa = semGradedCredits > 0 ? Math.round((semWeighted / semGradedCredits) * 100) / 100 : 0;

    return {
      cgpa,
      sgpa,
      passedCredits,
      totalCredits,
      passCount,
      failCount,
      pendingCount,
    };
  }, [scopedRecords, filteredRecords]);

  if (scopedRecords.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center space-y-4">
        <Award className="w-8 h-8 text-slate-400 dark:text-slate-500 mx-auto" />
        <div className="space-y-1.5">
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
            No examination results published yet
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 max-w-lg mx-auto leading-relaxed">
            Semester grades, 10-point SGPA/CGPA calculations, and downloadable statements appear once published by your institution.
          </p>
        </div>
        {onLoadDemo && (
          <button
            type="button"
            disabled={seedingDemo}
            onClick={onLoadDemo}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#1E40AF] dark:bg-blue-600 rounded-lg hover:bg-[#1E3A8A] dark:hover:bg-blue-500 disabled:opacity-50 cursor-pointer ash-btn-press"
          >
            {seedingDemo ? 'Loading Demo Records...' : 'Load Clearly-Labelled DEMO Academic Sample'}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Results Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-2.5">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {semesterFilter === 'All' ? 'Overall SGPA / CGPA' : `${semesterFilter} SGPA`}
          </div>
          <div className="font-mono text-2xl font-bold text-[#1E40AF] dark:text-blue-400 tabular-nums">
            {metrics.sgpa.toFixed(2)}{' '}
            <span className="text-sm font-normal text-slate-500 dark:text-slate-400">/ 10.00</span>
          </div>
          <AcademicProgressBar
            value={metrics.sgpa}
            max={10}
            tone="blue"
            label="Semester grade point average out of 10"
          />
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Cumulative CGPA: <strong className="font-mono text-slate-900 dark:text-slate-100">{metrics.cgpa.toFixed(2)}</strong>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-2.5">
          <div className="text-xs text-slate-500 dark:text-slate-400">Academic Credits Earned</div>
          <div className="font-mono text-2xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
            {metrics.passedCredits}{' '}
            <span className="text-sm font-normal text-slate-500 dark:text-slate-400">
              / {metrics.totalCredits}
            </span>
          </div>
          <AcademicProgressBar
            value={metrics.passedCredits}
            max={Math.max(1, metrics.totalCredits)}
            tone="emerald"
            label="Credits earned out of registered credits"
          />
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Across {scopedRecords.length} recorded university course(s)
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-2.5">
          <div className="text-xs text-slate-500 dark:text-slate-400">Result Standing</div>
          <div className="font-mono text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
            {metrics.passCount} Passed
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-400">
            {metrics.failCount > 0
              ? `${metrics.failCount} Backlog/Supplementary · `
              : 'Zero active backlogs · '}
            {metrics.pendingCount} Pending
          </div>
          <button
            type="button"
            onClick={() =>
              generateAcademicTranscriptPdf({
                student,
                records: filteredRecords,
                semesterLabel:
                  semesterFilter === 'All' ? 'All Recorded Semesters' : semesterFilter,
              })
            }
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1E40AF] dark:text-blue-400 hover:underline cursor-pointer pt-0.5"
          >
            <Download className="w-3.5 h-3.5" />
            Export Verified Grade Statement PDF
          </button>
        </div>
      </div>

      {/* Professional Exam Results Data Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display font-bold text-sm text-slate-900 dark:text-slate-100">
              University Examination Results Ledger ({filteredRecords.length})
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              10-point APSCHE grading scale (O=10, A+=9, A=8, B+=7, B=6, C=5, F=0).
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3 font-semibold">Subject &amp; Semester</th>
                <th className="px-4 py-3 font-semibold text-right">Credits</th>
                <th className="px-4 py-3 font-semibold text-right">Total Marks</th>
                <th className="px-4 py-3 font-semibold min-w-[170px]">Grade Point Progress</th>
                <th className="px-4 py-3 font-semibold text-right">Letter Grade</th>
                <th className="px-4 py-3 font-semibold text-right">Result Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredRecords.map((rec) => {
                const gp = GRADE_POINTS[rec.grade] ?? 0;
                const gpTone = gp >= 8 ? 'emerald' : gp >= 6 ? 'blue' : gp > 0 ? 'amber' : 'red';
                return (
                  <tr key={rec.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        <span className="font-mono text-[#1E40AF] dark:text-blue-400 mr-1.5">
                          {rec.subjectCode}
                        </span>
                        {rec.subjectName}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {rec.semester} · {rec.academicYear}
                        {rec.isDemo ? ' · DEMO' : ''}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      {rec.credits}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold tabular-nums text-slate-900 dark:text-slate-100">
                      {rec.totalMarks}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <AcademicProgressBar
                            value={gp}
                            max={10}
                            tone={rec.grade === 'Pending' ? 'amber' : gpTone}
                            label={`${rec.subjectCode} grade point`}
                          />
                        </div>
                        <span className="font-mono text-xs font-semibold tabular-nums text-slate-700 dark:text-slate-300 w-10 text-right">
                          {rec.grade === 'Pending' ? '—' : `${gp}/10`}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-[#5B21B6] dark:text-violet-400">
                      {rec.grade}
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-semibold whitespace-nowrap">
                      {rec.resultStatus === 'Pass' ? (
                        <span className="inline-flex items-center justify-end gap-1 text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          Pass
                        </span>
                      ) : rec.resultStatus === 'Fail' ? (
                        <span className="inline-flex items-center justify-end gap-1 text-red-700 dark:text-red-400">
                          <XCircle className="w-3.5 h-3.5 shrink-0" />
                          Fail
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-end gap-1 text-amber-700 dark:text-amber-400">
                          <Clock className="w-3.5 h-3.5 shrink-0" />
                          Pending
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
