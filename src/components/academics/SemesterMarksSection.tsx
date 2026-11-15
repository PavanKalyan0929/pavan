import React, { useMemo, useState } from 'react';
import { BookOpen, Search } from 'lucide-react';
import { AcademicProgressBar } from './AcademicProgressBar.tsx';
import type { AcademicSubjectRecord, StudentProfile } from '../../types.ts';

interface SemesterMarksSectionProps {
  student: StudentProfile;
  records: AcademicSubjectRecord[];
  semesterFilter: string;
  onSelectSemester: (semester: string) => void;
  onLoadDemo?: () => void;
  seedingDemo?: boolean;
}

export function SemesterMarksSection({
  student,
  records,
  semesterFilter,
  onSelectSemester,
  onLoadDemo,
  seedingDemo = false,
}: SemesterMarksSectionProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Defensive client-side student & college isolation
  const scopedRecords = useMemo(
    () =>
      records.filter(
        (r) => r.studentUid === student.uid && r.collegeId === student.collegeId
      ),
    [records, student.uid, student.collegeId]
  );

  // Semester-wise grouped rollups for visual comparison
  const semesterRollups = useMemo(() => {
    const groups = new Map<
      string,
      {
        semester: string;
        academicYear: string;
        subjectsCount: number;
        credits: number;
        totalMarksSum: number;
        internalSum: number;
        externalSum: number;
      }
    >();

    for (const r of scopedRecords) {
      const existing = groups.get(r.semester) || {
        semester: r.semester,
        academicYear: r.academicYear,
        subjectsCount: 0,
        credits: 0,
        totalMarksSum: 0,
        internalSum: 0,
        externalSum: 0,
      };
      existing.subjectsCount += 1;
      existing.credits += r.credits;
      existing.totalMarksSum += r.totalMarks;
      existing.internalSum += r.internalMarks;
      existing.externalSum += r.externalMarks;
      groups.set(r.semester, existing);
    }

    return Array.from(groups.values()).sort((a, b) => a.semester.localeCompare(b.semester));
  }, [scopedRecords]);

  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return scopedRecords.filter((rec) => {
      if (semesterFilter !== 'All' && rec.semester !== semesterFilter) return false;
      if (!q) return true;
      return (
        rec.subjectCode.toLowerCase().includes(q) ||
        rec.subjectName.toLowerCase().includes(q) ||
        rec.semester.toLowerCase().includes(q)
      );
    });
  }, [scopedRecords, semesterFilter, searchQuery]);

  if (scopedRecords.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center space-y-4">
        <BookOpen className="w-8 h-8 text-slate-400 dark:text-slate-500 mx-auto" />
        <div className="space-y-1.5">
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
            No semester marks published yet
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 max-w-lg mx-auto leading-relaxed">
            Internal mid-term scores and external university evaluation marks appear here once synced by your institution.
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
      {/* Semester-Wise Performance Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {semesterRollups.map((sem) => {
          const avgScore =
            sem.subjectsCount > 0 ? Math.round((sem.totalMarksSum / sem.subjectsCount) * 10) / 10 : 0;
          const isSelected = semesterFilter === sem.semester;
          return (
            <button
              key={sem.semester}
              type="button"
              onClick={() => onSelectSemester(isSelected ? 'All' : sem.semester)}
              className={`text-left rounded-xl p-5 border transition-colors cursor-pointer space-y-2.5 ${
                isSelected
                  ? 'bg-blue-50/60 dark:bg-blue-950/30 border-[#1E40AF] dark:border-blue-500'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span>
                  {sem.semester} · {sem.academicYear}
                </span>
                <span className="font-mono font-semibold text-[#1E40AF] dark:text-blue-400">
                  {sem.subjectsCount} Subjects
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <div className="font-mono text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                  {avgScore.toFixed(1)}%
                </div>
                <div className="text-xs font-mono text-slate-600 dark:text-slate-300 tabular-nums">
                  {sem.credits} Credits
                </div>
              </div>
              <AcademicProgressBar
                value={avgScore}
                max={100}
                tone={avgScore >= 75 ? 'emerald' : avgScore >= 50 ? 'blue' : 'amber'}
                label={`${sem.semester} average score`}
              />
              <div className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                Total Marks: {sem.totalMarksSum} / {sem.subjectsCount * 100}
              </div>
            </button>
          );
        })}
      </div>

      {/* Semester-wise Marks Data Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-display font-bold text-sm text-slate-900 dark:text-slate-100">
              Semester-Wise Subject Marks ({filteredRecords.length})
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Continuous Internal Evaluation (CIE) and Semester End Examination (SEE) score breakdown.
            </p>
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search subject or code..."
              aria-label="Search semester marks"
              className="pl-8 pr-3 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 w-52"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3 font-semibold">Subject &amp; Semester</th>
                <th className="px-4 py-3 font-semibold text-right">Credits</th>
                <th className="px-4 py-3 font-semibold text-right">Internal</th>
                <th className="px-4 py-3 font-semibold text-right">External</th>
                <th className="px-4 py-3 font-semibold min-w-[200px]">Total Score Progress</th>
                <th className="px-4 py-3 font-semibold text-right">Grade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                    No mark records match your search query.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec) => {
                  const tone =
                    rec.totalMarks >= 80
                      ? 'emerald'
                      : rec.totalMarks >= 60
                        ? 'blue'
                        : rec.totalMarks >= 40
                          ? 'amber'
                          : 'red';
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
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                        {rec.internalMarks}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                        {rec.externalMarks}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <AcademicProgressBar
                              value={rec.totalMarks}
                              max={100}
                              tone={tone}
                              label={`${rec.subjectCode} total marks`}
                            />
                          </div>
                          <span className="font-mono text-xs font-bold tabular-nums text-slate-900 dark:text-slate-100 w-14 text-right">
                            {rec.totalMarks}/100
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-[#5B21B6] dark:text-violet-400">
                        {rec.grade}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
