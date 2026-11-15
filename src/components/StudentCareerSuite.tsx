import React, { useEffect, useMemo, useState } from 'react';
import {
  Briefcase,
  Building2,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  MapPin,
  Plus,
  Save,
  Search,
  Trash2,
} from 'lucide-react';
import { CURATED_PLACEMENT_DRIVES } from '../data/demoColleges.ts';
import {
  applyToPlacementByStudent,
  saveStudentResume,
  withdrawPlacementApplicationByStudent,
} from '../lib/firestoreService.ts';
import { generateResumePdf } from '../lib/pdfGenerator.ts';
import type {
  PlacementApplicationRecord,
  PlacementOpportunityRecord,
  ResumeProjectItem,
  StudentProfile,
  StudentResumeRecord,
} from '../types.ts';

interface StudentCareerSuiteProps {
  student: StudentProfile;
  opportunities: PlacementOpportunityRecord[];
  applications: PlacementApplicationRecord[];
  resume: StudentResumeRecord | null;
  inferredCgpa: number;
}

type CareerSubTab = 'drives' | 'applications' | 'resume';

export function StudentCareerSuite({
  student,
  opportunities,
  applications,
  resume,
  inferredCgpa,
}: StudentCareerSuiteProps) {
  const [subTab, setSubTab] = useState<CareerSubTab>('drives');
  const [typeFilter, setTypeFilter] = useState<'All' | PlacementOpportunityRecord['opportunityType']>('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [eligibleOnly, setEligibleOnly] = useState(false);

  // Application draft state
  const [applyingDrive, setApplyingDrive] = useState<PlacementOpportunityRecord | null>(null);
  const [coverNote, setCoverNote] = useState('');
  const [applyBusy, setApplyBusy] = useState(false);
  const [driveFeedback, setDriveFeedback] = useState<string | null>(null);
  const [driveError, setDriveError] = useState<string | null>(null);

  // Structured Resume State
  const [headline, setHeadline] = useState('');
  const [summary, setSummary] = useState('');
  const [cgpaInput, setCgpaInput] = useState('');
  const [educationSummary, setEducationSummary] = useState('');
  const [skillsInput, setSkillsInput] = useState('');
  const [certsInput, setCertsInput] = useState('');
  const [projects, setProjects] = useState<ResumeProjectItem[]>([]);
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [resumeBusy, setResumeBusy] = useState(false);
  const [resumeFeedback, setResumeFeedback] = useState<string | null>(null);
  const [resumeError, setResumeError] = useState<string | null>(null);

  useEffect(() => {
    if (resume) {
      setHeadline(resume.headline);
      setSummary(resume.summary);
      setCgpaInput(String(resume.cgpa || inferredCgpa || 7.5));
      setEducationSummary(resume.educationSummary);
      setSkillsInput(resume.skills.join(', '));
      setCertsInput(resume.certifications.join('\n'));
      setProjects(resume.projects);
      setLinkedinUrl(resume.linkedinUrl);
      setGithubUrl(resume.githubUrl);
      setPortfolioUrl(resume.portfolioUrl);
    } else {
      setHeadline(`${student.course} (${student.department || student.branch}) Candidate`);
      setSummary(
        `Undergraduate learner at ${student.collegeName} (${student.collegeCode}) focused on practical software systems, analytical problem-solving, and structured institutional projects.`
      );
      setCgpaInput(String(inferredCgpa > 0 ? inferredCgpa.toFixed(2) : '7.80'));
      setEducationSummary(`${student.course} · ${student.academicYear} · Admission ${student.admissionYear || '2023'}`);
      setSkillsInput('TypeScript, React, Python, SQL, Problem Solving');
      setCertsInput('SWAYAM-NPTEL Foundation Certification');
      setProjects([
        {
          title: 'Academic Portal Capstone Module',
          role: 'Lead Developer',
          techStack: 'React, TypeScript, Firebase, Node.js',
          description: 'Designed responsive dashboards with real-time state updates and PDF reporting.',
        },
      ]);
    }
  }, [resume, student, inferredCgpa]);

  const effectiveCgpa = useMemo(() => {
    const parsed = Number(cgpaInput);
    if (!Number.isNaN(parsed) && parsed > 0) return Math.min(10, Math.max(0, parsed));
    return resume?.cgpa || inferredCgpa || 7.5;
  }, [cgpaInput, resume?.cgpa, inferredCgpa]);

  const mergedDrives = useMemo<PlacementOpportunityRecord[]>(() => {
    const map = new Map<string, PlacementOpportunityRecord>();
    for (const item of CURATED_PLACEMENT_DRIVES) {
      map.set(item.id, {
        ...item,
        postedByUid: 'system',
        collegeAdminEmails: [],
      });
    }
    for (const opp of opportunities) {
      if (opp.collegeId === student.collegeId || opp.collegeId === 'STATEWIDE') {
        map.set(opp.id, opp);
      }
    }
    return Array.from(map.values());
  }, [opportunities, student.collegeId]);

  const visibleDrives = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return mergedDrives.filter((d) => {
      if (typeFilter !== 'All' && d.opportunityType !== typeFilter) return false;
      if (eligibleOnly && effectiveCgpa < d.minCgpa) return false;
      if (!q) return true;
      return (
        d.title.toLowerCase().includes(q) ||
        d.companyName.toLowerCase().includes(q) ||
        d.roleCategory.toLowerCase().includes(q) ||
        d.location.toLowerCase().includes(q)
      );
    });
  }, [mergedDrives, typeFilter, eligibleOnly, effectiveCgpa, searchTerm]);

  const applicationByOpportunityId = useMemo(() => {
    const map = new Map<string, PlacementApplicationRecord>();
    for (const app of applications) {
      map.set(app.opportunityId, app);
    }
    return map;
  }, [applications]);

  const resumeDraftObject: StudentResumeRecord = useMemo(
    () => ({
      uid: student.uid,
      collegeId: student.collegeId,
      headline: headline.trim() || `${student.course} Candidate`,
      summary: summary.trim(),
      cgpa: effectiveCgpa,
      skills: skillsInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 30),
      educationSummary: educationSummary.trim(),
      projects: projects.filter((p) => p.title.trim()).slice(0, 10),
      certifications: certsInput
        .split('\n')
        .map((c) => c.trim())
        .filter(Boolean)
        .slice(0, 20),
      linkedinUrl: linkedinUrl.trim(),
      githubUrl: githubUrl.trim(),
      portfolioUrl: portfolioUrl.trim(),
      collegeAdminEmails: student.collegeAdminEmails || [],
    }),
    [
      student,
      headline,
      summary,
      effectiveCgpa,
      skillsInput,
      educationSummary,
      projects,
      certsInput,
      linkedinUrl,
      githubUrl,
      portfolioUrl,
    ]
  );

  async function handleSubmitApplication(e: React.FormEvent) {
    e.preventDefault();
    if (!applyingDrive) return;
    setApplyBusy(true);
    setDriveError(null);
    setDriveFeedback(null);
    try {
      await applyToPlacementByStudent({
        opportunity: applyingDrive,
        student,
        cgpaSnapshot: effectiveCgpa,
        resumeSnapshotId: resume ? student.uid : '',
        coverNote: coverNote.trim(),
      });
      setDriveFeedback(
        `Applied to ${applyingDrive.companyName} (${applyingDrive.title}). Track status under "My Applications".`
      );
      setApplyingDrive(null);
      setCoverNote('');
    } catch (err) {
      setDriveError(err instanceof Error ? err.message : 'Unable to submit placement application.');
    } finally {
      setApplyBusy(false);
    }
  }

  async function handleSaveResume(e: React.FormEvent) {
    e.preventDefault();
    setResumeBusy(true);
    setResumeError(null);
    setResumeFeedback(null);
    try {
      await saveStudentResume(resumeDraftObject);
      setResumeFeedback('Structured resume profile saved securely to Firestore.');
    } catch (err) {
      setResumeError(err instanceof Error ? err.message : 'Unable to save resume.');
    } finally {
      setResumeBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
          {(
            [
              { id: 'drives', label: `Placements, Jobs & Internships (${mergedDrives.length})`, icon: <Briefcase className="w-3.5 h-3.5" /> },
              { id: 'applications', label: `My Applications (${applications.length})`, icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
              { id: 'resume', label: 'Resume Builder & PDF', icon: <FileText className="w-3.5 h-3.5" /> },
            ] as { id: CareerSubTab; label: string; icon: React.ReactNode }[]
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

        <div className="text-xs font-mono text-slate-600 dark:text-slate-400">
          Profile CGPA Basis: <strong className="text-[#1E40AF] dark:text-blue-400">{effectiveCgpa.toFixed(2)}</strong>
        </div>
      </div>

      {/* SUB-TAB 1: PLACEMENTS, JOBS & INTERNSHIPS */}
      {subTab === 'drives' && (
        <div className="space-y-5">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex flex-wrap gap-1.5">
                {(['All', 'Campus Placement', 'Full-Time Job', 'Internship'] as const).map((tp) => (
                  <button
                    key={tp}
                    type="button"
                    onClick={() => setTypeFilter(tp)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer ${
                      typeFilter === tp
                        ? 'bg-[#1E40AF] text-white border-[#1E40AF]'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {tp}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={eligibleOnly}
                    onChange={(e) => setEligibleOnly(e.target.checked)}
                    className="rounded border-slate-300 dark:border-slate-600 text-[#1E40AF]"
                  />
                  Eligible Only (CGPA ≤ {effectiveCgpa.toFixed(1)})
                </label>
                <div className="relative w-full sm:w-60">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search company, role, location..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
            </div>

            {driveFeedback && (
              <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/70 text-xs text-emerald-800 dark:text-emerald-300">
                {driveFeedback}
              </div>
            )}
            {driveError && (
              <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/70 text-xs text-red-700 dark:text-red-300">
                {driveError}
              </div>
            )}
          </div>

          {/* Inline Apply Composer */}
          {applyingDrive && (
            <form
              onSubmit={handleSubmitApplication}
              className="bg-white dark:bg-slate-900 border border-[#1E40AF] dark:border-blue-500 rounded-xl p-6 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-mono text-[#1E40AF] dark:text-blue-400">
                    Applying to {applyingDrive.companyName} · {applyingDrive.opportunityType}
                  </div>
                  <h3 className="font-display font-bold text-base text-slate-900 dark:text-slate-100">
                    {applyingDrive.title}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setApplyingDrive(null)}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-300">
                Your verified roll ID (<span className="font-mono">{student.studentRollId}</span>),
                college affiliation, CGPA snapshot (<span className="font-mono">{effectiveCgpa.toFixed(2)}</span>),
                and saved Resume Profile will accompany this application.
              </div>
              <textarea
                rows={2}
                maxLength={800}
                value={coverNote}
                onChange={(e) => setCoverNote(e.target.value)}
                placeholder="Optional note to Training & Placement Cell (relevant skills, project highlights, or availability)..."
                className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="submit"
                  disabled={applyBusy}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#1E40AF] dark:bg-blue-600 rounded-lg hover:bg-[#1E3A8A] disabled:opacity-50 cursor-pointer"
                >
                  {applyBusy ? 'Submitting...' : 'Confirm & Submit Application'}
                </button>
              </div>
            </form>
          )}

          {/* Drives Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {visibleDrives.map((drive) => {
              const existingApp = applicationByOpportunityId.get(drive.id);
              const isEligible = effectiveCgpa >= drive.minCgpa;
              return (
                <article
                  key={drive.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between gap-4 ash-card-interactive"
                >
                  <div className="space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                      <span className="font-semibold text-[#5B21B6] dark:text-violet-400">
                        {drive.opportunityType} · {drive.collegeCode}
                        {drive.isDemo ? ' · DEMO' : ''}
                      </span>
                      <span
                        className={`font-semibold ${
                          drive.status === 'Open'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-amber-700 dark:text-amber-400'
                        }`}
                      >
                        {drive.status} · Due {drive.deadlineDate}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-display font-bold text-base text-slate-900 dark:text-slate-100">
                        {drive.title}
                      </h3>
                      <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-0.5 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{drive.companyName}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
                      <span className="font-mono font-semibold text-slate-900 dark:text-slate-200">
                        {drive.ctcOrStipend}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        {drive.location}
                      </span>
                    </div>

                    <div className="text-xs">
                      <span
                        className={`font-mono font-semibold ${
                          isEligible
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-amber-700 dark:text-amber-400'
                        }`}
                      >
                        Min CGPA {drive.minCgpa.toFixed(1)} ({isEligible ? 'Eligible' : 'Below Cutoff'})
                      </span>
                      <span className="text-slate-500 dark:text-slate-400">
                        {' '}
                        · {drive.eligibilityCriteria}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {drive.description}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                    {drive.applyUrl ? (
                      <a
                        href={drive.applyUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-[#1E40AF] dark:hover:text-blue-400"
                      >
                        External Portal <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        On-Campus T&P Workflow
                      </span>
                    )}

                    {existingApp ? (
                      <button
                        type="button"
                        onClick={() => setSubTab('applications')}
                        className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                      >
                        Status: {existingApp.status} →
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={drive.status === 'Closed' || !isEligible}
                        onClick={() => setApplyingDrive(drive)}
                        className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#1E40AF] dark:bg-blue-600 rounded-lg hover:bg-[#1E3A8A] disabled:opacity-45 cursor-pointer ash-btn-press"
                      >
                        Apply via Portal
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB-TAB 2: MY APPLICATIONS */}
      {subTab === 'applications' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h2 className="font-display font-bold text-sm text-slate-900 dark:text-slate-100">
              Placement, Job & Internship Pipeline ({applications.length})
            </h2>
          </div>
          {applications.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
              No placement or internship applications submitted yet. Browse open drives to apply.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {applications.map((app) => (
                <div
                  key={app.id}
                  className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
                      {app.opportunityType} · {app.companyName} · CGPA Snapshot {app.cgpaSnapshot.toFixed(2)}
                    </div>
                    <div className="font-display font-bold text-slate-900 dark:text-slate-100">
                      {app.opportunityTitle}
                    </div>
                    {app.coverNote && (
                      <div className="text-xs text-slate-600 dark:text-slate-300">
                        Note: {app.coverNote}
                      </div>
                    )}
                    {app.authorityRemark && (
                      <div className="text-xs text-[#1E40AF] dark:text-blue-400 font-medium">
                        T&amp;P Cell Remark: {app.authorityRemark}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs font-semibold text-[#1E40AF] dark:text-blue-400">
                      {app.status}
                    </span>
                    {app.status === 'Applied' && (
                      <button
                        type="button"
                        onClick={() => withdrawPlacementApplicationByStudent(app.id)}
                        className="px-2.5 py-1 text-xs font-semibold text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/50 rounded-md hover:bg-red-100 cursor-pointer"
                      >
                        Withdraw
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 3: RESUME BUILDER & ATS PDF */}
      {subTab === 'resume' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Structured Resume Form */}
          <form
            onSubmit={handleSaveResume}
            className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h2 className="font-display font-bold text-base text-slate-900 dark:text-slate-100">
                  Student Resume Builder
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Saved to your verified portal profile for one-click T&amp;P applications and ATS PDF export.
                </p>
              </div>
              <button
                type="button"
                onClick={() => generateResumePdf({ student, resume: resumeDraftObject })}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 dark:bg-slate-700 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Download ATS PDF
              </button>
            </div>

            {resumeFeedback && (
              <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/70 text-xs text-emerald-800 dark:text-emerald-300">
                {resumeFeedback}
              </div>
            )}
            {resumeError && (
              <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/70 text-xs text-red-700 dark:text-red-300">
                {resumeError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Target Headline
                </label>
                <input
                  type="text"
                  required
                  maxLength={180}
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Current CGPA (0–10)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  max={10}
                  required
                  value={cgpaInput}
                  onChange={(e) => setCgpaInput(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Career Summary
              </label>
              <textarea
                rows={2}
                maxLength={1200}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Skills (comma separated, max 30)
                </label>
                <input
                  type="text"
                  value={skillsInput}
                  onChange={(e) => setSkillsInput(e.target.value)}
                  placeholder="TypeScript, React, Java, SQL, CAD..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Academic Highlights / Honours
                </label>
                <input
                  type="text"
                  maxLength={400}
                  value={educationSummary}
                  onChange={(e) => setEducationSummary(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            {/* Structured Projects */}
            <div className="space-y-2.5 pt-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Projects ({projects.length}/10)
                </label>
                {projects.length < 10 && (
                  <button
                    type="button"
                    onClick={() =>
                      setProjects((prev) => [
                        ...prev,
                        { title: '', role: '', techStack: '', description: '' },
                      ])
                    }
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#1E40AF] dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Project
                  </button>
                )}
              </div>

              {projects.map((proj, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-mono text-slate-500">Project #{idx + 1}</span>
                    <button
                      type="button"
                      onClick={() => setProjects((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-red-600 dark:text-red-400 hover:underline cursor-pointer"
                      aria-label="Remove project"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      maxLength={120}
                      placeholder="Project Title"
                      value={proj.title}
                      onChange={(e) =>
                        setProjects((prev) =>
                          prev.map((p, i) => (i === idx ? { ...p, title: e.target.value } : p))
                        )
                      }
                      className="px-2.5 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                    />
                    <input
                      type="text"
                      maxLength={80}
                      placeholder="Your Role"
                      value={proj.role}
                      onChange={(e) =>
                        setProjects((prev) =>
                          prev.map((p, i) => (i === idx ? { ...p, role: e.target.value } : p))
                        )
                      }
                      className="px-2.5 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                    />
                    <input
                      type="text"
                      maxLength={160}
                      placeholder="Tech Stack"
                      value={proj.techStack}
                      onChange={(e) =>
                        setProjects((prev) =>
                          prev.map((p, i) => (i === idx ? { ...p, techStack: e.target.value } : p))
                        )
                      }
                      className="px-2.5 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <input
                    type="text"
                    maxLength={400}
                    placeholder="Concise impact/outcome description..."
                    value={proj.description}
                    onChange={(e) =>
                      setProjects((prev) =>
                        prev.map((p, i) => (i === idx ? { ...p, description: e.target.value } : p))
                      )
                    }
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  />
                </div>
              ))}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Certifications (one per line)
              </label>
              <textarea
                rows={2}
                value={certsInput}
                onChange={(e) => setCertsInput(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="url"
                maxLength={240}
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                placeholder="LinkedIn URL"
                className="px-2.5 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
              <input
                type="url"
                maxLength={240}
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                placeholder="GitHub URL"
                className="px-2.5 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
              <input
                type="url"
                maxLength={240}
                value={portfolioUrl}
                onChange={(e) => setPortfolioUrl(e.target.value)}
                placeholder="Portfolio URL"
                className="px-2.5 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={resumeBusy}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1E40AF] dark:bg-blue-600 rounded-lg hover:bg-[#1E3A8A] disabled:opacity-50 cursor-pointer ash-btn-press"
              >
                <Save className="w-3.5 h-3.5" />
                {resumeBusy ? 'Saving...' : 'Save Resume to Profile'}
              </button>
            </div>
          </form>

          {/* Live Executive Paper Preview */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="bg-slate-900 text-white px-6 py-5 space-y-1">
              <div className="font-display text-lg font-bold">{student.fullName}</div>
              <div className="text-xs text-blue-200">{resumeDraftObject.headline}</div>
              <div className="text-[11px] text-slate-300 font-mono">
                {student.collegeEmail || student.email} · {student.mobile} · {student.collegeCode}
              </div>
            </div>
            <div className="p-6 space-y-4 text-xs text-slate-700 dark:text-slate-300">
              {resumeDraftObject.summary && (
                <div>
                  <div className="font-bold text-[11px] uppercase tracking-wider text-[#1E40AF] dark:text-blue-400 border-b border-slate-200 dark:border-slate-800 pb-1 mb-1.5">
                    Summary
                  </div>
                  <p className="leading-relaxed">{resumeDraftObject.summary}</p>
                </div>
              )}

              <div>
                <div className="font-bold text-[11px] uppercase tracking-wider text-[#1E40AF] dark:text-blue-400 border-b border-slate-200 dark:border-slate-800 pb-1 mb-1.5">
                  Education
                </div>
                <div className="font-semibold text-slate-900 dark:text-slate-100">
                  {student.collegeName} ({student.collegeCode})
                </div>
                <div>
                  {student.course} · {student.department || student.branch} · CGPA{' '}
                  <span className="font-mono font-bold">{resumeDraftObject.cgpa.toFixed(2)}/10</span>
                </div>
                {resumeDraftObject.educationSummary && (
                  <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                    {resumeDraftObject.educationSummary}
                  </div>
                )}
              </div>

              {resumeDraftObject.skills.length > 0 && (
                <div>
                  <div className="font-bold text-[11px] uppercase tracking-wider text-[#1E40AF] dark:text-blue-400 border-b border-slate-200 dark:border-slate-800 pb-1 mb-1.5">
                    Skills
                  </div>
                  <div>{resumeDraftObject.skills.join(' · ')}</div>
                </div>
              )}

              {resumeDraftObject.projects.length > 0 && (
                <div className="space-y-2">
                  <div className="font-bold text-[11px] uppercase tracking-wider text-[#1E40AF] dark:text-blue-400 border-b border-slate-200 dark:border-slate-800 pb-1">
                    Projects
                  </div>
                  {resumeDraftObject.projects.map((p, i) => (
                    <div key={i}>
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {p.title} {p.role ? `— ${p.role}` : ''}
                      </div>
                      {p.techStack && (
                        <div className="font-mono text-[11px] text-slate-500">{p.techStack}</div>
                      )}
                      {p.description && <p className="mt-0.5">{p.description}</p>}
                    </div>
                  ))}
                </div>
              )}

              {resumeDraftObject.certifications.length > 0 && (
                <div>
                  <div className="font-bold text-[11px] uppercase tracking-wider text-[#1E40AF] dark:text-blue-400 border-b border-slate-200 dark:border-slate-800 pb-1 mb-1.5">
                    Certifications
                  </div>
                  <ul className="space-y-1 list-disc list-inside">
                    {resumeDraftObject.certifications.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
