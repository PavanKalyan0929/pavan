import React, { useMemo, useState } from 'react';
import {
  Award,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Download,
  ExternalLink,
  GraduationCap,
  Lock,
  Percent,
} from 'lucide-react';
import { DEMO_NPTEL_UPDATES } from '../data/demoColleges.ts';
import { createDemoAcademicSampleForStudent } from '../lib/firestoreService.ts';
import { generateAcademicTranscriptPdf } from '../lib/pdfGenerator.ts';
import { AcademicAttendanceSection } from './academics/AcademicAttendanceSection.tsx';
import { ExamResultsSection } from './academics/ExamResultsSection.tsx';
import { SemesterMarksSection } from './academics/SemesterMarksSection.tsx';
import { TimetableViewSection } from './academics/TimetableViewSection.tsx';
import type {
  AcademicSubjectRecord,
  CollegeIntegrationRecord,
  CollegeRecord,
  CourseRecord,
  DepartmentRecord,
  StudentProfile,
  TimetableSlotRecord,
} from '../types.ts';

interface StudentAcademicSuiteProps {
  student: StudentProfile;
  college: CollegeRecord | null;
  integration: CollegeIntegrationRecord | null;
  departments: DepartmentRecord[];
  courses: CourseRecord[];
  academicRecords: AcademicSubjectRecord[];
  timetableSlots: TimetableSlotRecord[];
}

type AcademicSubTab = 'attendance' | 'marks' | 'timetable' | 'results' | 'college_depts';

export function StudentAcademicSuite({
  student,
  college,
  integration,
  departments,
  courses,
  academicRecords,
  timetableSlots,
}: StudentAcademicSuiteProps) {
  const [subTab, setSubTab] = useState<AcademicSubTab>('attendance');
  const [semesterFilter, setSemesterFilter] = useState<string>('All');
  const [seedingDemo, setSeedingDemo] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Defensive ownership & institutional scope filter on top of Firestore Security Rules
  const scopedAcademicRecords = useMemo(
    () =>
      academicRecords.filter(
        (r) => r.studentUid === student.uid && r.collegeId === student.collegeId
      ),
    [academicRecords, student.uid, student.collegeId]
  );

  const scopedTimetableSlots = useMemo(
    () => timetableSlots.filter((s) => s.collegeId === student.collegeId),
    [timetableSlots, student.collegeId]
  );

  const semesters = useMemo(() => {
    const unique = Array.from(new Set(scopedAcademicRecords.map((r) => r.semester).filter(Boolean)));
    return unique.sort();
  }, [scopedAcademicRecords]);

  const filteredRecords = useMemo(() => {
    if (semesterFilter === 'All') return scopedAcademicRecords;
    return scopedAcademicRecords.filter((r) => r.semester === semesterFilter);
  }, [scopedAcademicRecords, semesterFilter]);

  const hasDemoAcademic = scopedAcademicRecords.some((r) => r.isDemo);

  async function handleLoadDemoAcademics() {
    setSeedingDemo(true);
    setError(null);
    setFeedback(null);
    try {
      await createDemoAcademicSampleForStudent(student);
      setFeedback('Demo attendance, semester marks & exam result records added to your portal.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load sample academic records.');
    } finally {
      setSeedingDemo(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Verified Scope Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
          <Lock className="w-3.5 h-3.5 text-[#1E40AF] dark:text-blue-400 shrink-0" />
          <span>
            Read-Only Academic Registry · Scoped to Roll ID{' '}
            <strong className="font-mono text-slate-900 dark:text-slate-100">
              {student.studentRollId}
            </strong>{' '}
            · Institution{' '}
            <strong className="font-mono text-slate-900 dark:text-slate-100">
              {student.collegeCode}
            </strong>
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="font-mono tabular-nums">
            {scopedAcademicRecords.length} subject(s) · {scopedTimetableSlots.length} schedule slot(s)
          </span>
        </div>
      </div>

      {/* Sub-navigation Switcher + Semester & Statement Export Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
          {(
            [
              { id: 'attendance', label: 'Attendance %', icon: <Percent className="w-3.5 h-3.5" /> },
              { id: 'marks', label: 'Semester Marks', icon: <BookOpen className="w-3.5 h-3.5" /> },
              { id: 'timetable', label: 'Timetable View', icon: <CalendarClock className="w-3.5 h-3.5" /> },
              { id: 'results', label: 'Exam Results', icon: <Award className="w-3.5 h-3.5" /> },
              { id: 'college_depts', label: 'College & Departments', icon: <GraduationCap className="w-3.5 h-3.5" /> },
            ] as { id: AcademicSubTab; label: string; icon: React.ReactNode }[]
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSubTab(item.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
                subTab === item.id
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>

        {(subTab === 'marks' || subTab === 'results') && scopedAcademicRecords.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {semesters.length > 0 && (
              <select
                value={semesterFilter}
                onChange={(e) => setSemesterFilter(e.target.value)}
                aria-label="Filter academic records by semester"
                className="px-3 py-1.5 text-xs font-medium border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              >
                <option value="All">All Semesters ({scopedAcademicRecords.length})</option>
                {semesters.map((sem) => (
                  <option key={sem} value={sem}>
                    {sem}
                  </option>
                ))}
              </select>
            )}
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
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-[#1E40AF] dark:bg-blue-600 hover:bg-[#1E3A8A] dark:hover:bg-blue-500 rounded-lg cursor-pointer whitespace-nowrap shrink-0 ash-btn-press"
            >
              <Download className="w-3.5 h-3.5" />
              Download Statement PDF
            </button>
          </div>
        )}
      </div>

      {hasDemoAcademic && subTab !== 'timetable' && subTab !== 'college_depts' && (
        <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/70 text-xs text-amber-900 dark:text-amber-200">
          DEMO ACADEMIC SAMPLE NOTICE: Records marked DEMO illustrate subject attendance,
          internal/external marks, and SGPA computation until official ERP records sync.
        </div>
      )}

      {feedback && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/70 text-xs text-emerald-800 dark:text-emerald-300">
          {feedback}
        </div>
      )}
      {error && (
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/70 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* SUB-TAB 1: ATTENDANCE PERCENTAGES */}
      {subTab === 'attendance' && (
        <AcademicAttendanceSection
          student={student}
          records={scopedAcademicRecords}
          onLoadDemo={handleLoadDemoAcademics}
          seedingDemo={seedingDemo}
        />
      )}

      {/* SUB-TAB 2: SEMESTER-WISE MARKS */}
      {subTab === 'marks' && (
        <SemesterMarksSection
          student={student}
          records={scopedAcademicRecords}
          semesterFilter={semesterFilter}
          onSelectSemester={setSemesterFilter}
          onLoadDemo={handleLoadDemoAcademics}
          seedingDemo={seedingDemo}
        />
      )}

      {/* SUB-TAB 3: TIMETABLE VIEW */}
      {subTab === 'timetable' && (
        <TimetableViewSection student={student} slots={scopedTimetableSlots} />
      )}

      {/* SUB-TAB 4: EXAM RESULTS & SGPA */}
      {subTab === 'results' && (
        <ExamResultsSection
          student={student}
          records={scopedAcademicRecords}
          semesterFilter={semesterFilter}
          onLoadDemo={handleLoadDemoAcademics}
          seedingDemo={seedingDemo}
        />
      )}

      {/* SUB-TAB 5: COLLEGE, DEPARTMENTS & NPTEL */}
      {subTab === 'college_depts' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <div className="text-xs font-mono text-[#1E40AF] dark:text-blue-400">
                  {student.collegeCode} · {college?.verificationStatus || 'Directory Record'} ·{' '}
                  {integration?.status || college?.integrationStatus || 'Requires Integration'}
                </div>
                <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                  {college?.name || student.collegeName}
                </h2>
                <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  {college?.affiliatedUniversity || 'Andhra Pradesh Higher Education Institution'} ·{' '}
                  {college?.accreditation || 'Accreditation synced via Admin'}
                </div>
              </div>
              {college?.website && college.website.startsWith('http') && (
                <a
                  href={college.website}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#1E40AF] rounded-lg hover:bg-[#1E3A8A]"
                >
                  Official Website <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-display font-bold text-sm text-slate-900 dark:text-slate-100 mb-2">
                  Academic Departments ({departments.length || college?.departments?.length || 0})
                </h3>
                {departments.length > 0 ? (
                  <ul className="space-y-2 text-xs">
                    {departments.map((dept) => (
                      <li
                        key={dept.id}
                        className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700"
                      >
                        <span className="font-mono font-bold text-[#1E40AF] dark:text-blue-400">
                          {dept.code}
                        </span>{' '}
                        · {dept.name}
                        {dept.hodName && (
                          <span className="text-slate-500 dark:text-slate-400">
                            {' '}
                            (HoD: {dept.hodName})
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                    {(college?.departments || [student.department || student.branch]).map((d) => (
                      <li key={d}>· {d}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h3 className="font-display font-bold text-sm text-slate-900 dark:text-slate-100 mb-2">
                  Courses &amp; Programmes ({courses.length || college?.courses?.length || 0})
                </h3>
                {courses.length > 0 ? (
                  <ul className="space-y-2 text-xs">
                    {courses.map((crs) => (
                      <li
                        key={crs.id}
                        className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700"
                      >
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {crs.degreeLevel} · {crs.name} ({crs.branch})
                        </span>
                        <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                          Duration: {crs.durationYears} yrs · Sanctioned Intake: {crs.intake}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                    {(college?.courses || [student.course]).map((c) => (
                      <li key={c}>· {c}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-3">
            <h3 className="font-display font-bold text-base text-slate-900 dark:text-slate-100">
              SWAYAM–NPTEL Academic Credit Guidance
            </h3>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {DEMO_NPTEL_UPDATES.map((np) => (
                <div key={np.id} className="py-3 first:pt-0 last:pb-0 text-xs space-y-1">
                  <div className="font-semibold text-slate-900 dark:text-slate-100">
                    {np.title} ({np.creditsLabel})
                  </div>
                  <p className="text-slate-600 dark:text-slate-300">{np.summary}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
