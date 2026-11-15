import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertTriangle, CheckCircle2, Search, ShieldCheck } from 'lucide-react';
import { AcademicProgressBar } from './AcademicProgressBar.tsx';
import type { AcademicSubjectRecord, StudentProfile } from '../../types.ts';

interface AcademicAttendanceSectionProps {
  student: StudentProfile;
  records: AcademicSubjectRecord[];
  onLoadDemo?: () => void;
  seedingDemo?: boolean;
}

type AttendanceFilter = 'all' | 'eligible' | 'shortage';

function computeShortfallClassesNeeded(attended: number, total: number, minRatio = 0.75): number {
  if (total <= 0) return 0;
  if (attended / total >= minRatio) return 0;
  // (attended + x) / (total + x) >= 0.75 => x >= 3*total - 4*attended
  const needed = Math.ceil((minRatio * total - attended) / (1 - minRatio));
  return Math.max(1, needed);
}

export function AcademicAttendanceSection({
  student,
  records,
  onLoadDemo,
  seedingDemo = false,
}: AcademicAttendanceSectionProps) {
  const [filterMode, setFilterMode] = useState<AttendanceFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Defensive client-side student & college isolation
  const scopedRecords = useMemo(
    () =>
      records.filter(
        (r) => r.studentUid === student.uid && r.collegeId === student.collegeId
      ),
    [records, student.uid, student.collegeId]
  );

  const stats = useMemo(() => {
    let classesTotal = 0;
    let classesAttended = 0;
    let eligibleSubjects = 0;
    let shortageSubjects = 0;

    for (const r of scopedRecords) {
      classesTotal += r.classesTotal;
      classesAttended += r.classesAttended;
      const pct = r.classesTotal > 0 ? (r.classesAttended / r.classesTotal) * 100 : 0;
      if (pct >= 75) eligibleSubjects += 1;
      else shortageSubjects += 1;
    }

    const overallPct =
      classesTotal > 0 ? Math.round((classesAttended / classesTotal) * 1000) / 10 : 0;
    const classesNeededOverall = computeShortfallClassesNeeded(classesAttended, classesTotal, 0.75);

    return {
      classesTotal,
      classesAttended,
      overallPct,
      eligibleSubjects,
      shortageSubjects,
      classesNeededOverall,
    };
  }, [scopedRecords]);

  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return scopedRecords.filter((rec) => {
      const pct = rec.classesTotal > 0 ? (rec.classesAttended / rec.classesTotal) * 100 : 0;
      if (filterMode === 'eligible' && pct < 75) return false;
      if (filterMode === 'shortage' && pct >= 75) return false;
      if (!q) return true;
      return (
        rec.subjectCode.toLowerCase().includes(q) ||
        rec.subjectName.toLowerCase().includes(q) ||
        rec.semester.toLowerCase().includes(q) ||
        rec.facultyName.toLowerCase().includes(q)
      );
    });
  }, [scopedRecords, filterMode, searchQuery]);

  const chartData = useMemo(
    () =>
      filteredRecords.map((r) => ({
        subject: r.subjectCode,
        attendancePct:
          r.classesTotal > 0 ? Math.round((r.classesAttended / r.classesTotal) * 1000) / 10 : 0,
        classesAttended: r.classesAttended,
        classesTotal: r.classesTotal,
      })),
    [filteredRecords]
  );

  if (scopedRecords.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center space-y-4">
        <ShieldCheck className="w-8 h-8 text-slate-400 dark:text-slate-500 mx-auto" />
        <div className="space-y-1.5">
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
            No attendance records synchronized yet
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 max-w-lg mx-auto leading-relaxed">
            Subject-wise class attendance logs published by your institution&apos;s College Admin will
            appear here with 75% APSCHE eligibility progress tracking.
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
      {/* KPI Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-2.5">
          <div className="text-xs text-slate-500 dark:text-slate-400">Cumulative Attendance</div>
          <div
            className={`font-mono text-2xl font-bold tabular-nums ${
              stats.overallPct >= 75
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-amber-700 dark:text-amber-400'
            }`}
          >
            {stats.overallPct.toFixed(1)}%
          </div>
          <AcademicProgressBar
            value={stats.overallPct}
            max={100}
            thresholdPct={75}
            tone={stats.overallPct >= 75 ? 'emerald' : 'amber'}
            label="Cumulative attendance compliance"
          />
          <div className="text-xs text-slate-600 dark:text-slate-400 font-mono tabular-nums">
            {stats.classesAttended} / {stats.classesTotal} sessions attended
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-2">
          <div className="text-xs text-slate-500 dark:text-slate-400">Exam Regulation Status</div>
          <div className="flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-slate-100 mt-1">
            {stats.overallPct >= 75 ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Eligible (≥ 75% Norm)</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>Shortage Alert (&lt; 75%)</span>
              </>
            )}
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            {stats.overallPct >= 75
              ? 'Cleared for university end-semester theory & lab examinations.'
              : `Attend next ${stats.classesNeededOverall} session(s) consecutively to restore 75% overall.`}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-2">
          <div className="text-xs text-slate-500 dark:text-slate-400">Compliant Subjects</div>
          <div className="font-mono text-2xl font-bold text-[#1E40AF] dark:text-blue-400 tabular-nums">
            {stats.eligibleSubjects} / {scopedRecords.length}
          </div>
          <AcademicProgressBar
            value={stats.eligibleSubjects}
            max={scopedRecords.length}
            tone="blue"
            label="Subjects meeting 75% attendance"
          />
          <div className="text-xs text-slate-600 dark:text-slate-400">
            Subjects meeting 75% attendance threshold
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-2">
          <div className="text-xs text-slate-500 dark:text-slate-400">Subjects Below 75%</div>
          <div
            className={`font-mono text-2xl font-bold tabular-nums ${
              stats.shortageSubjects > 0
                ? 'text-amber-700 dark:text-amber-400'
                : 'text-emerald-700 dark:text-emerald-400'
            }`}
          >
            {stats.shortageSubjects}
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-400">
            {stats.shortageSubjects === 0
              ? 'Zero condonation risk across recorded subjects'
              : 'Immediate attendance catch-up advised'}
          </div>
        </div>
      </div>

      {/* Attendance Percentage Chart */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-display font-bold text-base text-slate-900 dark:text-slate-100">
              Subject Attendance % vs. 75% Minimum Threshold
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Dashed reference indicates 75% institutional eligibility line.
            </p>
          </div>
        </div>
        <div className="h-60 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 16, left: -12, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.25} />
              <XAxis dataKey="subject" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  borderRadius: '8px',
                  color: '#f8fafc',
                  fontSize: '12px',
                }}
                formatter={(val: unknown) => [`${val}%`, 'Attendance']}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <ReferenceLine y={75} stroke="#D97706" strokeDasharray="4 4" />
              <Bar dataKey="attendancePct" name="Attendance %" fill="#1E40AF" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Attendance Ledger Data Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="font-display font-bold text-sm text-slate-900 dark:text-slate-100">
              Subject-Wise Attendance Ledger ({filteredRecords.length})
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Progress marker indicates 75% institutional regulation minimum.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search code, subject..."
                aria-label="Filter attendance subjects"
                className="pl-8 pr-3 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 w-44"
              />
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'eligible', label: '≥ 75%' },
                  { id: 'shortage', label: 'Shortage' },
                ] as { id: AttendanceFilter; label: string }[]
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilterMode(f.id)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
                    filterMode === f.id
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3 font-semibold">Subject &amp; Faculty</th>
                <th className="px-4 py-3 font-semibold">Semester</th>
                <th className="px-4 py-3 font-semibold text-right">Attended / Total</th>
                <th className="px-4 py-3 font-semibold min-w-[200px]">Attendance Progress</th>
                <th className="px-4 py-3 font-semibold text-right">Compliance Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                    No subjects match the current filter criteria.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec) => {
                  const pct =
                    rec.classesTotal > 0
                      ? Math.round((rec.classesAttended / rec.classesTotal) * 1000) / 10
                      : 0;
                  const shortfall = computeShortfallClassesNeeded(rec.classesAttended, rec.classesTotal);
                  const tone = pct >= 80 ? 'emerald' : pct >= 75 ? 'blue' : pct >= 65 ? 'amber' : 'red';
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
                          {rec.facultyName || 'Department Faculty'}
                          {rec.isDemo ? ' · DEMO' : ''}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {rec.semester} · {rec.academicYear}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-800 dark:text-slate-200 whitespace-nowrap">
                        {rec.classesAttended} / {rec.classesTotal}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <AcademicProgressBar
                              value={pct}
                              max={100}
                              thresholdPct={75}
                              tone={tone}
                              label={`${rec.subjectCode} attendance percentage`}
                            />
                          </div>
                          <span
                            className={`font-mono text-xs font-bold tabular-nums w-12 text-right ${
                              pct >= 75
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-amber-700 dark:text-amber-400'
                            }`}
                          >
                            {pct.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-xs font-semibold whitespace-nowrap">
                        {pct >= 75 ? (
                          <span className="inline-flex items-center justify-end gap-1 text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            Meets 75% Norm
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-end gap-1 text-amber-700 dark:text-amber-400">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            Need +{shortfall} class{shortfall === 1 ? '' : 'es'}
                          </span>
                        )}
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
