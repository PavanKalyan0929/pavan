import React, { useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { AuthProvider } from './context/AuthContext.tsx';
import { ThemeProvider } from './context/ThemeContext.tsx';
import { Navbar, type AppView } from './components/Navbar.tsx';
import { HomeView } from './components/HomeView.tsx';
import { CollegeDirectoryView } from './components/CollegeDirectoryView.tsx';
import { ScholarshipsResourcesView } from './components/ScholarshipsResourcesView.tsx';
import { AiAssistantView } from './components/AiAssistantView.tsx';
import { StudentDashboardView } from './components/StudentDashboardView.tsx';
import { CollegeAdminDashboardView } from './components/CollegeAdminDashboardView.tsx';
import { StateAdminDashboardView } from './components/StateAdminDashboardView.tsx';
import { AuthOnboardingModal } from './components/AuthOnboardingModal.tsx';
import type { CollegeRecord } from './types.ts';

function AppShell() {
  const [activeView, setActiveView] = useState<AppView>('home');
  const [directorySearch, setDirectorySearch] = useState('');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authIntent, setAuthIntent] = useState<'login' | 'register'>('login');
  const [preselectedCollege, setPreselectedCollege] = useState<CollegeRecord | null>(null);

  function handleNavigate(view: AppView) {
    setActiveView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleOpenAuth(intent: 'login' | 'register' = 'login') {
    setAuthIntent(intent);
    setAuthModalOpen(true);
  }

  function handleExploreCollegesWithQuery(query: string) {
    setDirectorySearch(query);
    handleNavigate('colleges');
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] dark:bg-slate-950 text-[#0F172A] dark:text-slate-100 transition-colors duration-200">
      <Navbar
        activeView={activeView}
        onNavigate={handleNavigate}
        onOpenAuth={handleOpenAuth}
      />

      <div className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeView}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            {activeView === 'home' && (
              <HomeView
                onNavigate={handleNavigate}
                onSearchColleges={handleExploreCollegesWithQuery}
                onOpenAuth={() => handleOpenAuth('register')}
              />
            )}

            {activeView === 'colleges' && (
              <CollegeDirectoryView
                initialSearch={directorySearch}
                onSelectForRegistration={(college) => {
                  setPreselectedCollege(college);
                  handleOpenAuth('register');
                }}
              />
            )}

            {activeView === 'scholarships' && (
              <ScholarshipsResourcesView
                initialSection="scholarships"
                onOpenAuth={() => handleOpenAuth('register')}
                onGoToDashboard={() => handleNavigate('student_dashboard')}
              />
            )}

            {activeView === 'exams' && (
              <ScholarshipsResourcesView
                initialSection="exams_careers"
                onOpenAuth={() => handleOpenAuth('register')}
                onGoToDashboard={() => handleNavigate('student_dashboard')}
              />
            )}

            {activeView === 'ai' && <AiAssistantView />}

            {activeView === 'student_dashboard' && (
              <StudentDashboardView
                onNavigate={handleNavigate}
                onOpenAuth={() => handleOpenAuth('login')}
              />
            )}

            {activeView === 'college_admin' && (
              <CollegeAdminDashboardView onNavigate={handleNavigate} />
            )}

            {activeView === 'state_admin' && (
              <StateAdminDashboardView onNavigate={handleNavigate} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Institutional Multi-Column Footer */}
      <footer className="bg-[#0F172A] dark:bg-slate-900 border-t border-slate-800 mt-auto text-slate-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 md:grid-cols-12 gap-8 text-xs">
          <div className="md:col-span-5 space-y-2.5">
            <div className="font-display font-bold text-white text-base">
              Andhra Student Hub (ASH)
            </div>
            <p className="text-slate-400 leading-relaxed max-w-md">
              Unified higher-education portal connecting Andhra Pradesh engineering, degree, and
              postgraduate students with verified institution directories, scholarship workflows,
              transparent fee records, and authority-monitored grievance redressal.
            </p>
            <p className="text-slate-500 text-[11px]">
              Records marked DEMO are sample placeholders; verified institutions display their
              official source URL and verification date.
            </p>
          </div>

          <div className="md:col-span-3 space-y-2.5">
            <div className="font-semibold text-white uppercase tracking-wider text-[11px]">
              Platform Modules
            </div>
            <ul className="space-y-2 text-slate-400">
              <li>
                <button
                  type="button"
                  onClick={() => handleNavigate('colleges')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  AP College Directory
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleNavigate('scholarships')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Scholarships & Fee Ledger
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleNavigate('exams')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Exams, NPTEL & Careers
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleNavigate('ai')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  AI Student Guidance Desk
                </button>
              </li>
            </ul>
          </div>

          <div className="md:col-span-4 space-y-2.5">
            <div className="font-semibold text-white uppercase tracking-wider text-[11px]">
              Official AP & National Portals
            </div>
            <ul className="space-y-2 text-slate-400">
              <li>
                <a
                  href="https://apsche.ap.gov.in"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white transition-colors"
                >
                  APSCHE (State Higher Education Council) ↗
                </a>
              </li>
              <li>
                <a
                  href="https://jnanabhumi.ap.gov.in"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white transition-colors"
                >
                  AP Jnanabhumi Scholarship Portal ↗
                </a>
              </li>
              <li>
                <a
                  href="https://scholarships.gov.in"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white transition-colors"
                >
                  National Scholarship Portal (NSP) ↗
                </a>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleOpenAuth('login')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Student & Institutional Admin Login →
                </button>
              </li>
            </ul>
          </div>
        </div>
      </footer>

      <AuthOnboardingModal
        open={authModalOpen}
        initialIntent={authIntent}
        preselectedCollege={preselectedCollege}
        onClose={() => {
          setAuthModalOpen(false);
          setPreselectedCollege(null);
        }}
        onSuccess={(role) => {
          setAuthModalOpen(false);
          setPreselectedCollege(null);
          if (role === 'state_admin') handleNavigate('state_admin');
          else if (role === 'college_admin') handleNavigate('college_admin');
          else handleNavigate('student_dashboard');
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <ThemeProvider>
        <AuthProvider>
          <AppShell />
        </AuthProvider>
      </ThemeProvider>
    </MotionConfig>
  );
}
