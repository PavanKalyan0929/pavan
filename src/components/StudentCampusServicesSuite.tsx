import React, { useMemo, useState } from 'react';
import { BookCopy, Bus, Home, Plus, XCircle } from 'lucide-react';
import {
  cancelCollegeServiceByStudent,
  createCollegeServiceRequestByStudent,
  createDemoCollegeServicesForStudent,
} from '../lib/firestoreService.ts';
import type { CollegeServiceRecord, StudentProfile } from '../types.ts';

interface StudentCampusServicesSuiteProps {
  student: StudentProfile;
  services: CollegeServiceRecord[];
}

export function StudentCampusServicesSuite({
  student,
  services,
}: StudentCampusServicesSuiteProps) {
  const [activeType, setActiveType] = useState<'All' | CollegeServiceRecord['serviceType']>('All');
  const [serviceType, setServiceType] = useState<CollegeServiceRecord['serviceType']>('Hostel');
  const [requestTitle, setRequestTitle] = useState('');
  const [detailsPrimary, setDetailsPrimary] = useState('');
  const [detailsSecondary, setDetailsSecondary] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [seedingDemo, setSeedingDemo] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visibleServices = useMemo(() => {
    if (activeType === 'All') return services;
    return services.filter((s) => s.serviceType === activeType);
  }, [services, activeType]);

  const counts = useMemo(() => {
    const map = { Hostel: 0, Transport: 0, Library: 0 };
    services.forEach((s) => {
      if (s.status !== 'Closed') {
        map[s.serviceType] = (map[s.serviceType] || 0) + 1;
      }
    });
    return map;
  }, [services]);

  async function handleSubmitRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!requestTitle.trim() || !detailsPrimary.trim()) return;
    setSubmitting(true);
    setFeedback(null);
    setError(null);
    try {
      await createCollegeServiceRequestByStudent({
        student,
        serviceType,
        requestTitle: requestTitle.trim(),
        detailsPrimary: detailsPrimary.trim(),
        detailsSecondary: detailsSecondary.trim() || `Academic Year ${student.academicYear}`,
      });
      setRequestTitle('');
      setDetailsPrimary('');
      setDetailsSecondary('');
      setFeedback(`${serviceType} service request submitted to ${student.collegeCode} administration.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit service request.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLoadDemoPasses() {
    setSeedingDemo(true);
    setError(null);
    setFeedback(null);
    try {
      await createDemoCollegeServicesForStudent(student);
      setFeedback('Demo Hostel, Bus Pass & Library sample records added.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load sample campus passes.');
    } finally {
      setSeedingDemo(false);
    }
  }

  const placeholders: Record<
    CollegeServiceRecord['serviceType'],
    { title: string; primary: string; secondary: string }
  > = {
    Hostel: {
      title: 'Hostel Seat / Room Allotment Request',
      primary: 'Preferred Block & Room Sharing (e.g., Block B · Twin Sharing)',
      secondary: 'Mess Preference / Medical or Accessibility Note',
    },
    Transport: {
      title: 'College Bus Route Pass Application',
      primary: 'Route & Boarding Point (e.g., Route 04 · Town Bus Stand)',
      secondary: 'Morning Shift / Term Validity (e.g., Semester IV)',
    },
    Library: {
      title: 'Book Reservation / Library Card Issue',
      primary: 'Book Title, Author or ISBN / Card Renewal',
      secondary: 'Department Collection / Preferred Pickup Window',
    },
  };

  return (
    <div className="space-y-6">
      {/* Service Category KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 ash-card-interactive">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Hostel & Residence</span>
            <Home className="w-4 h-4 text-[#1E40AF] dark:text-blue-400" />
          </div>
          <div className="font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100 mt-1">
            {counts.Hostel}
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
            Active allotments & requests
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 ash-card-interactive">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>College Transport & Bus</span>
            <Bus className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
          </div>
          <div className="font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100 mt-1">
            {counts.Transport}
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
            Active bus route passes
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 ash-card-interactive">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Central Library & Loans</span>
            <BookCopy className="w-4 h-4 text-[#5B21B6] dark:text-violet-400" />
          </div>
          <div className="font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100 mt-1">
            {counts.Library}
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
            Issued books & card requests
          </div>
        </div>
      </div>

      {/* Active Allocations & Requests */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
              My Hostel, Transport & Library Passes
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Managed by {student.collegeName} ({student.collegeCode}) campus administration.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              {(['All', 'Hostel', 'Transport', 'Library'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setActiveType(t)}
                  className={`px-3 py-1 text-xs font-semibold rounded-md cursor-pointer whitespace-nowrap shrink-0 ${
                    activeType === t
                      ? 'bg-white dark:bg-slate-900 text-[#1E40AF] dark:text-blue-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            {services.length === 0 && (
              <button
                type="button"
                disabled={seedingDemo}
                onClick={handleLoadDemoPasses}
                className="px-3.5 py-1.5 text-xs font-semibold border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/60 cursor-pointer whitespace-nowrap shrink-0"
              >
                {seedingDemo ? 'Loading...' : 'Load Demo Campus Passes'}
              </button>
            )}
          </div>
        </div>

        {visibleServices.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-slate-200 dark:border-slate-700 rounded-xl space-y-2">
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              No {activeType === 'All' ? 'campus service' : activeType.toLowerCase()} records synced yet
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Submit a new hostel, transport pass, or library request below, or load illustrative demo passes to preview campus layouts.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {visibleServices.map((item) => (
              <article
                key={item.id}
                className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 space-y-2.5 ash-card-interactive"
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-mono font-semibold text-[#1E40AF] dark:text-blue-400">
                    {item.serviceType} · {item.referenceCode}
                  </span>
                  <span
                    className={`font-semibold ${
                      item.status === 'Active' || item.status === 'Approved'
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : item.status === 'Closed'
                          ? 'text-slate-500 dark:text-slate-400'
                          : 'text-amber-700 dark:text-amber-400'
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
                <div className="font-display font-bold text-sm text-slate-900 dark:text-slate-100">
                  {item.requestTitle}
                </div>
                <div className="text-xs text-slate-700 dark:text-slate-300">
                  {item.detailsPrimary}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {item.detailsSecondary}
                </div>
                {item.authorityRemark && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
                    Authority Note: {item.authorityRemark}
                  </div>
                )}
                {(item.status === 'Requested' || item.status === 'Action Required') && (
                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => cancelCollegeServiceByStudent(item.id)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 dark:text-red-400 hover:underline cursor-pointer"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Withdraw Request
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>

      {/* Request New Service Form */}
      <form
        onSubmit={handleSubmitRequest}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4"
      >
        <div className="flex items-center gap-2">
          <Plus className="w-4 h-4 text-[#1E40AF] dark:text-blue-400" />
          <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
            Request Campus Hostel, Transport Pass or Library Service
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Service Department
            </label>
            <select
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value as CollegeServiceRecord['serviceType'])}
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
            >
              <option value="Hostel">Hostel & Mess</option>
              <option value="Transport">College Bus / Transport</option>
              <option value="Library">Central Library</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Request Subject / Title
            </label>
            <input
              type="text"
              required
              value={requestTitle}
              onChange={(e) => setRequestTitle(e.target.value)}
              placeholder={placeholders[serviceType].title}
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Specific Requirement (Block / Route / Book)
            </label>
            <input
              type="text"
              required
              value={detailsPrimary}
              onChange={(e) => setDetailsPrimary(e.target.value)}
              placeholder={placeholders[serviceType].primary}
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Additional Context / Term
            </label>
            <input
              type="text"
              value={detailsSecondary}
              onChange={(e) => setDetailsSecondary(e.target.value)}
              placeholder={placeholders[serviceType].secondary}
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
            {error}
          </div>
        )}
        {feedback && (
          <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300">
            {feedback}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#1E40AF] dark:bg-blue-600 rounded-lg hover:bg-[#1E3A8A] dark:hover:bg-blue-500 disabled:opacity-50 cursor-pointer ash-btn-press"
          >
            {submitting ? 'Submitting...' : 'Submit Service Request'}
          </button>
        </div>
      </form>
    </div>
  );
}
