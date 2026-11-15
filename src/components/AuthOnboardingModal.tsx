import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { collection, onSnapshot } from 'firebase/firestore';
import { CheckCircle2, KeyRound, Mail, ShieldCheck, UserPlus, X } from 'lucide-react';
import { AP_DISTRICTS, DEMO_COLLEGES } from '../data/demoColleges.ts';
import { db } from '../lib/firebase.ts';
import {
  registerStudentProfile,
  requestCollegeAdminRole,
} from '../lib/firestoreService.ts';
import { useAuth } from '../context/AuthContext.tsx';
import type { CollegeRecord } from '../types.ts';

interface AuthOnboardingModalProps {
  open: boolean;
  initialIntent?: 'login' | 'register';
  preselectedCollege?: CollegeRecord | null;
  onClose: () => void;
  onSuccess: (role: 'student' | 'college_admin' | 'state_admin') => void;
}

export function AuthOnboardingModal({
  open,
  initialIntent = 'login',
  preselectedCollege,
  onClose,
  onSuccess,
}: AuthOnboardingModalProps) {
  const {
    user,
    studentProfile,
    collegeAdminProfile,
    isStateAdmin,
    isActiveCollegeAdmin,
    signInWithGoogle,
  } = useAuth();

  const [mode, setMode] = useState<'student' | 'college_admin'>('student');
  const [liveColleges, setLiveColleges] = useState<CollegeRecord[]>([]);
  const [apiColleges, setApiColleges] = useState<CollegeRecord[]>([]);
  const [districtFilter, setDistrictFilter] = useState('All');
  const [collegeSearch, setCollegeSearch] = useState('');
  const [selectedCollegeId, setSelectedCollegeId] = useState('');

  // Complete Part 5 Student Registration fields
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [studentRollId, setStudentRollId] = useState('');
  const [collegeEmail, setCollegeEmail] = useState('');
  const [course, setCourse] = useState('B.Tech');
  const [department, setDepartment] = useState('Computer Science & Engineering');
  const [academicYear, setAcademicYear] = useState('2nd Year');
  const [admissionYear, setAdmissionYear] = useState(String(new Date().getFullYear()));
  const [portalPassword, setPortalPassword] = useState('');

  // College Email OTP Verification State
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpPreviewHint, setOtpPreviewHint] = useState<string | null>(null);
  const [otpVerifiedAt, setOtpVerifiedAt] = useState('');
  const [otpBusy, setOtpBusy] = useState(false);

  // College admin request fields
  const [designation, setDesignation] = useState('Nodal Grievance Officer');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const unsub = onSnapshot(
      collection(db, 'colleges'),
      (snap) => setLiveColleges(snap.docs.map((d) => d.data() as CollegeRecord)),
      () => undefined
    );
    fetch('/api/colleges?limit=100')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { items?: CollegeRecord[] } | null) => {
        if (data?.items) setApiColleges(data.items);
      })
      .catch(() => undefined);
    return () => unsub();
  }, [open]);

  const allColleges = useMemo(() => {
    const map = new Map<string, CollegeRecord>();
    DEMO_COLLEGES.forEach((c) => map.set(c.id, c));
    apiColleges.forEach((c) => map.set(c.id, c));
    liveColleges.forEach((c) => map.set(c.id, c));
    return Array.from(map.values());
  }, [apiColleges, liveColleges]);

  useEffect(() => {
    if (user?.displayName && !fullName) {
      setFullName(user.displayName);
    }
    if (user?.email && !collegeEmail) {
      setCollegeEmail(user.email);
    }
  }, [user, fullName, collegeEmail]);

  useEffect(() => {
    if (preselectedCollege) {
      setSelectedCollegeId(preselectedCollege.id);
      setDistrictFilter(preselectedCollege.district);
    } else if (!selectedCollegeId && allColleges.length > 0) {
      setSelectedCollegeId(allColleges[0].id);
    }
  }, [preselectedCollege, allColleges, selectedCollegeId]);

  const matchingColleges = useMemo(() => {
    const q = collegeSearch.trim().toLowerCase();
    return allColleges
      .filter((c) => {
        if (districtFilter !== 'All' && c.district !== districtFilter) return false;
        if (q && !`${c.name} ${c.code} ${c.district}`.toLowerCase().includes(q)) return false;
        return true;
      })
      .slice(0, 80);
  }, [allColleges, districtFilter, collegeSearch]);

  const selectedCollege = useMemo(
    () => allColleges.find((c) => c.id === selectedCollegeId) || matchingColleges[0] || allColleges[0],
    [allColleges, selectedCollegeId, matchingColleges]
  );

  async function handleGoogleSignIn() {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSendOtp() {
    if (!collegeEmail.trim()) {
      setError('Enter your college email address first to receive an OTP.');
      return;
    }
    setOtpBusy(true);
    setError(null);
    setOtpPreviewHint(null);
    try {
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: collegeEmail.trim(),
          collegeId: selectedCollege?.id || '',
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        message?: string;
        previewCode?: string;
      };
      if (!res.ok) throw new Error(data.error || 'Could not generate OTP.');
      setOtpSent(true);
      if (data.previewCode) {
        setOtpPreviewHint(`Sandbox preview OTP: ${data.previewCode} (valid for 10 minutes)`);
      }
      setInfoMessage(data.message || 'Verification OTP sent.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OTP send failed.');
    } finally {
      setOtpBusy(false);
    }
  }

  async function handleVerifyOtp() {
    if (!otpCode.trim()) return;
    setOtpBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: collegeEmail.trim(),
          otp: otpCode.trim(),
        }),
      });
      const data = (await res.json()) as { error?: string; verifiedAt?: string };
      if (!res.ok) throw new Error(data.error || 'OTP verification failed.');
      setOtpVerifiedAt(data.verifiedAt || new Date().toISOString());
      setInfoMessage('College email OTP verified successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OTP verification failed.');
    } finally {
      setOtpBusy(false);
    }
  }

  async function handleStudentSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !user.email || !selectedCollege) return;
    if (mobile.replace(/\D/g, '').length < 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }
    if (portalPassword && portalPassword.length < 8) {
      setError('Institutional portal password must be at least 8 characters.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      if (portalPassword.trim().length >= 8) {
        const token = await user.getIdToken();
        const pwRes = await fetch('/api/auth/password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ action: 'set', password: portalPassword.trim() }),
        });
        if (!pwRes.ok) {
          const pwErr = (await pwRes.json()) as { error?: string };
          throw new Error(pwErr.error || 'Failed to store hashed institutional password.');
        }
      }

      await registerStudentProfile({
        uid: user.uid,
        email: user.email,
        collegeEmail: collegeEmail.trim() || user.email,
        collegeEmailVerified: Boolean(otpVerifiedAt),
        otpVerifiedAt,
        fullName: fullName.trim(),
        mobile: mobile.trim(),
        college: selectedCollege,
        studentRollId: studentRollId.trim(),
        course: course.trim(),
        branch: department.trim(),
        department: department.trim(),
        academicYear,
        admissionYear: admissionYear.trim(),
      });
      onSuccess('student');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleCollegeAdminRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !user.email || !selectedCollege) return;

    setBusy(true);
    setError(null);
    try {
      await requestCollegeAdminRole({
        uid: user.uid,
        email: user.email,
        fullName: fullName.trim() || user.displayName || 'College Representative',
        designation: designation.trim(),
        college: selectedCollege,
      });
      setInfoMessage(
        'College Administrator access request submitted. A State Administrator must verify and activate your account before institutional privileges take effect.'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit request.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="fixed inset-0 z-50 bg-slate-900/55 dark:bg-black/75 backdrop-blur-[2px] flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.2 }}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl max-w-2xl w-full p-6 space-y-5 max-h-[92vh] overflow-y-auto shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold text-[#1E40AF] dark:text-blue-400">
                  Andhra Student Hub · Identity & Institutional Onboarding
                </div>
                <h2 className="font-display text-xl font-bold text-[#0F172A] dark:text-slate-100 mt-0.5">
                  {!user
                    ? initialIntent === 'register'
                      ? 'Student & Institutional Registration'
                      : 'Sign In to Andhra Student Hub'
                    : 'Complete Student / Institutional Profile'}
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close modal"
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
                {error}
              </div>
            )}

            {infoMessage && (
              <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-800 dark:text-emerald-300">
                {infoMessage}
              </div>
            )}

            {!user ? (
              <div className="space-y-5 py-2">
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Authenticate securely with your verified Google account to link your Andhra Pradesh
                  college record, verify your institutional email via OTP, set an institutional portal
                  password, or request College Administrator access.
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleGoogleSignIn}
                  className="w-full py-3 px-4 bg-[#1E40AF] dark:bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-[#1E3A8A] disabled:opacity-50 transition-colors cursor-pointer ash-btn-press"
                >
                  {busy ? 'Opening Google Sign-In...' : 'Continue with Google Account'}
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                {(studentProfile || isActiveCollegeAdmin || isStateAdmin) && (
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Active Portal Access for {user.email}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {studentProfile && (
                        <button
                          type="button"
                          onClick={() => onSuccess('student')}
                          className="px-3.5 py-2 text-xs font-semibold bg-[#1E40AF] text-white rounded-lg cursor-pointer"
                        >
                          Open Student Dashboard
                        </button>
                      )}
                      {isActiveCollegeAdmin && (
                        <button
                          type="button"
                          onClick={() => onSuccess('college_admin')}
                          className="px-3.5 py-2 text-xs font-semibold bg-[#0F172A] text-white rounded-lg cursor-pointer"
                        >
                          Open College Admin Dashboard
                        </button>
                      )}
                      {isStateAdmin && (
                        <button
                          type="button"
                          onClick={() => onSuccess('state_admin')}
                          className="px-3.5 py-2 text-xs font-semibold bg-amber-600 text-white rounded-lg cursor-pointer"
                        >
                          Open State Admin Dashboard
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Role Mode Switch */}
                <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setMode('student')}
                    className={`flex-1 py-2 text-xs font-semibold rounded-md cursor-pointer transition-colors ${
                      mode === 'student'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    Student Registration
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('college_admin')}
                    className={`flex-1 py-2 text-xs font-semibold rounded-md cursor-pointer transition-colors ${
                      mode === 'college_admin'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    College Admin Access
                  </button>
                </div>

                {/* Institution Picker */}
                <div className="space-y-2.5 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Select Your Andhra Pradesh Institution
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <select
                      aria-label="Filter colleges by district"
                      value={districtFilter}
                      onChange={(e) => setDistrictFilter(e.target.value)}
                      className="px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                    >
                      <option value="All">All 26 Districts</option>
                      {AP_DISTRICTS.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={collegeSearch}
                      onChange={(e) => setCollegeSearch(e.target.value)}
                      placeholder="Search college name or code (NRNG, NARN)..."
                      className="px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <select
                    aria-label="Select college"
                    value={selectedCollege?.id || ''}
                    onChange={(e) => setSelectedCollegeId(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  >
                    {matchingColleges.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} — {c.name} ({c.district})
                      </option>
                    ))}
                  </select>
                </div>

                {mode === 'student' ? (
                  studentProfile ? (
                    <div className="text-xs text-slate-600 dark:text-slate-300">
                      Your student profile is already registered under{' '}
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {studentProfile.collegeName}
                      </span>
                      . Manage profile edits or verify your college email OTP inside your Student Dashboard.
                    </div>
                  ) : (
                    <form onSubmit={handleStudentSubmit} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Student Full Name *
                          </label>
                          <input
                            type="text"
                            required
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Student ID / Hall Ticket / Roll No. *
                          </label>
                          <input
                            type="text"
                            required
                            value={studentRollId}
                            onChange={(e) => setStudentRollId(e.target.value)}
                            placeholder="e.g., 24F21A0501"
                            className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Mobile Number (+91) *
                          </label>
                          <input
                            type="tel"
                            required
                            value={mobile}
                            onChange={(e) => setMobile(e.target.value)}
                            placeholder="9876543210"
                            className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Admission Year *
                          </label>
                          <input
                            type="text"
                            required
                            value={admissionYear}
                            onChange={(e) => setAdmissionYear(e.target.value)}
                            placeholder="2024"
                            className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Course / Programme *
                          </label>
                          <input
                            type="text"
                            required
                            value={course}
                            onChange={(e) => setCourse(e.target.value)}
                            placeholder="B.Tech / B.Sc / MBA"
                            className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Department *
                          </label>
                          <input
                            type="text"
                            required
                            value={department}
                            onChange={(e) => setDepartment(e.target.value)}
                            placeholder="Computer Science & Engineering"
                            className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Academic Year *
                          </label>
                          <select
                            value={academicYear}
                            onChange={(e) => setAcademicYear(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                          >
                            <option>1st Year</option>
                            <option>2nd Year</option>
                            <option>3rd Year</option>
                            <option>4th Year</option>
                            <option>PG 1st Year</option>
                            <option>PG 2nd Year</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Institutional Portal Password (min 8 chars) *
                          </label>
                          <div className="relative">
                            <KeyRound className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                              type="password"
                              required
                              minLength={8}
                              value={portalPassword}
                              onChange={(e) => setPortalPassword(e.target.value)}
                              placeholder="Salted scrypt-hashed password"
                              className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                            />
                          </div>
                        </div>
                      </div>

                      {/* College Email + OTP Verification */}
                      <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5 text-[#1E40AF] dark:text-blue-400" />
                            College Email & OTP Verification
                          </label>
                          {otpVerifiedAt && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              OTP Verified
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            type="email"
                            required
                            value={collegeEmail}
                            onChange={(e) => {
                              setCollegeEmail(e.target.value);
                              setOtpVerifiedAt('');
                            }}
                            placeholder="student@college.edu.in"
                            className="flex-1 px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                          />
                          <button
                            type="button"
                            disabled={otpBusy || !collegeEmail.trim()}
                            onClick={handleSendOtp}
                            className="px-3.5 py-2 text-xs font-semibold bg-[#0F172A] dark:bg-slate-700 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 cursor-pointer whitespace-nowrap"
                          >
                            {otpBusy ? 'Sending...' : otpSent ? 'Resend OTP' : 'Send Email OTP'}
                          </button>
                        </div>

                        {otpSent && !otpVerifiedAt && (
                          <div className="space-y-2 pt-1">
                            {otpPreviewHint && (
                              <div className="text-[11px] font-mono text-[#5B21B6] dark:text-violet-300">
                                {otpPreviewHint}
                              </div>
                            )}
                            <div className="flex gap-2">
                              <input
                                type="text"
                                maxLength={6}
                                value={otpCode}
                                onChange={(e) => setOtpCode(e.target.value)}
                                placeholder="Enter 6-digit OTP"
                                className="flex-1 px-3 py-1.5 text-xs font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                              />
                              <button
                                type="button"
                                disabled={otpBusy || otpCode.trim().length !== 6}
                                onClick={handleVerifyOtp}
                                className="px-3.5 py-1.5 text-xs font-semibold bg-emerald-700 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 cursor-pointer"
                              >
                                Verify OTP
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      <button
                        type="submit"
                        disabled={busy}
                        className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-[#1E40AF] dark:bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-[#1E3A8A] disabled:opacity-50 cursor-pointer ash-btn-press"
                      >
                        <UserPlus className="w-4 h-4" />
                        {busy ? 'Creating Student Profile...' : 'Complete Student Registration'}
                      </button>
                    </form>
                  )
                ) : (
                  <form onSubmit={handleCollegeAdminRequest} className="space-y-3.5">
                    {collegeAdminProfile && (
                      <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900 text-xs text-amber-900 dark:text-amber-300">
                        Current Request Status:{' '}
                        <span className="font-mono font-semibold uppercase">
                          {collegeAdminProfile.status}
                        </span>{' '}
                        for {collegeAdminProfile.collegeName}
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Officer Full Name
                        </label>
                        <input
                          type="text"
                          required
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Institutional Designation
                        </label>
                        <input
                          type="text"
                          required
                          value={designation}
                          onChange={(e) => setDesignation(e.target.value)}
                          placeholder="Principal / Nodal Officer / AO"
                          className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={busy}
                      className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-[#0F172A] dark:bg-slate-700 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 disabled:opacity-50 cursor-pointer ash-btn-press"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      {busy ? 'Submitting Request...' : 'Request College Admin Approval'}
                    </button>
                  </form>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
