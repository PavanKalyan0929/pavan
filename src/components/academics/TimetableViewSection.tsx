import React, { useMemo, useState } from 'react';
import { CalendarClock, Clock, Lock, MapPin } from 'lucide-react';
import type { StudentProfile, TimetableSlotRecord } from '../../types.ts';

interface TimetableViewSectionProps {
  student: StudentProfile;
  slots: TimetableSlotRecord[];
}

const DAYS_OF_WEEK: TimetableSlotRecord['dayOfWeek'][] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const READONLY_SAMPLE_TIMETABLE: Array<
  Pick<
    TimetableSlotRecord,
    | 'id'
    | 'dayOfWeek'
    | 'startTime'
    | 'endTime'
    | 'subjectCode'
    | 'subjectName'
    | 'facultyName'
    | 'roomNumber'
    | 'slotType'
    | 'semester'
    | 'department'
  >
> = [
  {
    id: 'preview-1',
    dayOfWeek: 'Monday',
    startTime: '09:15',
    endTime: '10:15',
    subjectCode: 'CS401',
    subjectName: 'Operating Systems & Kernel Design',
    facultyName: 'Dr. M. Lakshmi Narayana',
    roomNumber: 'LH-204',
    slotType: 'Lecture',
    semester: 'Semester IV',
    department: 'CSE',
  },
  {
    id: 'preview-2',
    dayOfWeek: 'Monday',
    startTime: '10:15',
    endTime: '11:15',
    subjectCode: 'CS402',
    subjectName: 'Computer Networks & Security',
    facultyName: 'Prof. S. Harika',
    roomNumber: 'LH-204',
    slotType: 'Lecture',
    semester: 'Semester IV',
    department: 'CSE',
  },
  {
    id: 'preview-3',
    dayOfWeek: 'Tuesday',
    startTime: '09:15',
    endTime: '11:30',
    subjectCode: 'CS403',
    subjectName: 'Full-Stack Web Systems Lab',
    facultyName: 'Prof. P. Rajesh',
    roomNumber: 'LAB-3',
    slotType: 'Lab',
    semester: 'Semester IV',
    department: 'CSE',
  },
  {
    id: 'preview-4',
    dayOfWeek: 'Wednesday',
    startTime: '10:15',
    endTime: '11:15',
    subjectCode: 'CS301',
    subjectName: 'Data Structures & Algorithms',
    facultyName: 'Dr. R. Subramanyam',
    roomNumber: 'LH-201',
    slotType: 'Lecture',
    semester: 'Semester IV',
    department: 'CSE',
  },
  {
    id: 'preview-5',
    dayOfWeek: 'Thursday',
    startTime: '11:30',
    endTime: '12:30',
    subjectCode: 'CS302',
    subjectName: 'Database Management Systems',
    facultyName: 'Prof. K. Padmavathi',
    roomNumber: 'LH-204',
    slotType: 'Tutorial',
    semester: 'Semester IV',
    department: 'CSE',
  },
  {
    id: 'preview-6',
    dayOfWeek: 'Friday',
    startTime: '14:00',
    endTime: '16:00',
    subjectCode: 'CS490',
    subjectName: 'Campus Placement Readiness Seminar',
    facultyName: 'Training & Placement Cell',
    roomNumber: 'AUD-1',
    slotType: 'Seminar',
    semester: 'Semester IV',
    department: 'CSE',
  },
  {
    id: 'preview-7',
    dayOfWeek: 'Saturday',
    startTime: '09:30',
    endTime: '11:00',
    subjectCode: 'APT-01',
    subjectName: 'GATE & Quantitative Aptitude Clinic',
    facultyName: 'Prof. A. Srinivas',
    roomNumber: 'LH-102',
    slotType: 'Tutorial',
    semester: 'Semester IV',
    department: 'CSE',
  },
];

export function TimetableViewSection({ student, slots }: TimetableViewSectionProps) {
  const [selectedDay, setSelectedDay] = useState<'All' | TimetableSlotRecord['dayOfWeek']>('All');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [showPreviewTimetable, setShowPreviewTimetable] = useState(false);

  const currentWeekday = useMemo(() => {
    const names = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ];
    return names[new Date().getDay()];
  }, []);

  // Defensive institutional scoping
  const collegeSlots = useMemo(
    () => slots.filter((s) => s.collegeId === student.collegeId),
    [slots, student.collegeId]
  );

  const activeRows = useMemo(() => {
    const source =
      collegeSlots.length > 0
        ? collegeSlots
        : showPreviewTimetable
          ? READONLY_SAMPLE_TIMETABLE
          : [];
    const dayFiltered =
      selectedDay === 'All' ? source : source.filter((slot) => slot.dayOfWeek === selectedDay);

    return [...dayFiltered].sort((a, b) => {
      const dayDiff = DAYS_OF_WEEK.indexOf(a.dayOfWeek) - DAYS_OF_WEEK.indexOf(b.dayOfWeek);
      if (dayDiff !== 0) return dayDiff;
      return a.startTime.localeCompare(b.startTime);
    });
  }, [collegeSlots, showPreviewTimetable, selectedDay]);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Lock className="w-3.5 h-3.5 text-[#1E40AF] dark:text-blue-400" />
            <span>Read-Only Institutional Schedule · {student.collegeCode}</span>
          </div>
          <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5">
            Weekly Class &amp; Laboratory Timetable
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              Schedule Table
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              Day Cards
            </button>
          </div>

          <div className="flex flex-wrap gap-1">
            {(['All', ...DAYS_OF_WEEK] as const).map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => setSelectedDay(day)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md border cursor-pointer whitespace-nowrap shrink-0 ${
                  selectedDay === day
                    ? 'bg-[#1E40AF] text-white border-[#1E40AF]'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }`}
              >
                {day === 'All' ? 'All Days' : day.slice(0, 3)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {collegeSlots.length === 0 && !showPreviewTimetable ? (
        <div className="p-8 text-center space-y-4">
          <CalendarClock className="w-8 h-8 text-slate-400 dark:text-slate-500 mx-auto" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              No institutional timetable published yet for {student.collegeCode}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto">
              College Administrators manage class and lab schedules from the College Admin Console.
              You can inspect a read-only sample engineering schedule below.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowPreviewTimetable(true)}
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-slate-700 rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            Preview Read-Only Sample Timetable
          </button>
        </div>
      ) : (
        <div>
          {collegeSlots.length === 0 && showPreviewTimetable && (
            <div className="mx-6 mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/70 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900 dark:text-amber-200">
              <span>
                SAMPLE TIMETABLE PREVIEW: Local read-only preview until your College Admin publishes official timetable slots.
              </span>
              <button
                type="button"
                onClick={() => setShowPreviewTimetable(false)}
                className="font-semibold underline cursor-pointer"
              >
                Hide Preview
              </button>
            </div>
          )}

          {viewMode === 'table' ? (
            <div className="overflow-x-auto mt-2">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Day</th>
                    <th className="px-4 py-3 font-semibold">Time Slot</th>
                    <th className="px-4 py-3 font-semibold">Course &amp; Subject</th>
                    <th className="px-4 py-3 font-semibold">Session Type</th>
                    <th className="px-4 py-3 font-semibold">Faculty</th>
                    <th className="px-4 py-3 font-semibold text-right">Room / Lab</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {activeRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-8 text-center text-xs text-slate-500 dark:text-slate-400"
                      >
                        No timetable sessions scheduled for {selectedDay}.
                      </td>
                    </tr>
                  ) : (
                    activeRows.map((slot) => {
                      const isToday = slot.dayOfWeek === currentWeekday;
                      return (
                        <tr
                          key={slot.id}
                          className={
                            isToday
                              ? 'bg-blue-50/40 dark:bg-blue-950/20 hover:bg-blue-50/70 dark:hover:bg-blue-950/30'
                              : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40'
                          }
                        >
                          <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                            {slot.dayOfWeek}
                            {isToday && (
                              <span className="ml-1.5 text-xs font-mono text-[#1E40AF] dark:text-blue-400">
                                · Today
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-[#1E40AF] dark:text-blue-400 tabular-nums whitespace-nowrap">
                            {slot.startTime} – {slot.endTime}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-900 dark:text-slate-100">
                              <span className="font-mono text-[#5B21B6] dark:text-violet-400 mr-1.5">
                                {slot.subjectCode}
                              </span>
                              {slot.subjectName}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            {slot.slotType}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                            {slot.facultyName}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                            {slot.roomNumber}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeRows.length === 0 ? (
                <div className="md:col-span-2 py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                  No timetable sessions scheduled for {selectedDay}.
                </div>
              ) : (
                activeRows.map((slot) => {
                  const isToday = slot.dayOfWeek === currentWeekday;
                  return (
                    <div
                      key={slot.id}
                      className={`p-4 rounded-xl border space-y-1.5 ${
                        isToday
                          ? 'border-[#1E40AF]/60 dark:border-blue-500/60 bg-blue-50/40 dark:bg-blue-950/20'
                          : 'border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="inline-flex items-center gap-1 font-bold text-[#1E40AF] dark:text-blue-400">
                          <Clock className="w-3.5 h-3.5 shrink-0" />
                          {slot.dayOfWeek} · {slot.startTime} – {slot.endTime}
                        </span>
                        <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-400 font-semibold">
                          <MapPin className="w-3 h-3 shrink-0" />
                          {slot.slotType} · {slot.roomNumber}
                        </span>
                      </div>
                      <div className="font-display font-bold text-sm text-slate-900 dark:text-slate-100">
                        <span className="font-mono text-xs mr-1.5 text-[#5B21B6] dark:text-violet-400">
                          {slot.subjectCode}
                        </span>
                        {slot.subjectName}
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-300">
                        Faculty: {slot.facultyName}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
