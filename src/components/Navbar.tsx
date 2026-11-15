import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { GraduationCap, Menu, Moon, Sun, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useTheme } from '../context/ThemeContext.tsx';

export type AppView =
  | 'home'
  | 'colleges'
  | 'scholarships'
  | 'exams'
  | 'ai'
  | 'student_dashboard'
  | 'college_admin'
  | 'state_admin';

interface NavbarProps {
  activeView: AppView;
  onNavigate: (view: AppView) => void;
  onOpenAuth: (intent?: 'login' | 'register') => void;
}

export function Navbar({ activeView, onNavigate, onOpenAuth }: NavbarProps) {
  const { user, studentProfile, isActiveCollegeAdmin, isStateAdmin } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems: { id: AppView; label: string; action: () => void }[] = [
    { id: 'home', label: 'Home', action: () => onNavigate('home') },
    { id: 'colleges', label: 'Explore Colleges', action: () => onNavigate('colleges') },
    {
      id: 'student_dashboard',
      label: 'Student Services',
      action: () => {
        if (user) {
          onNavigate('student_dashboard');
        } else {
          onNavigate('home');
          setTimeout(() => {
            document.getElementById('student-services')?.scrollIntoView({ behavior: 'smooth' });
          }, 80);
        }
      },
    },
    { id: 'scholarships', label: 'Scholarships', action: () => onNavigate('scholarships') },
    { id: 'exams', label: 'Exams & Careers', action: () => onNavigate('exams') },
    { id: 'ai', label: 'AI Assistant', action: () => onNavigate('ai') },
  ];

  function handlePrimaryAction() {
    if (!user) {
      onOpenAuth('login');
      return;
    }
    if (isStateAdmin) {
      onNavigate('state_admin');
    } else if (isActiveCollegeAdmin) {
      onNavigate('college_admin');
    } else {
      onNavigate('student_dashboard');
    }
  }

  const primaryLabel = isStateAdmin
    ? 'State Console'
    : isActiveCollegeAdmin
      ? 'College Admin'
      : studentProfile
        ? 'My Dashboard'
        : 'Complete Setup';

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand Wordmark */}
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className="inline-flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 group cursor-pointer ash-btn-press"
        >
          <span className="w-8 h-8 rounded-lg bg-[#0F172A] dark:bg-blue-600 text-white inline-flex items-center justify-center shrink-0">
            <GraduationCap className="w-4 h-4" />
          </span>
          <span className="font-display text-base sm:text-lg font-bold tracking-tight text-[#0F172A] dark:text-slate-100 group-hover:text-[#1E40AF] dark:group-hover:text-blue-400 transition-colors">
            Andhra Student Hub
          </span>
        </button>

        {/* Single-line Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-5 text-[13px] font-medium text-slate-600 dark:text-slate-300">
          {navItems.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={item.action}
                className={`relative py-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  isActive
                    ? 'text-[#1E40AF] dark:text-blue-400 font-semibold'
                    : 'text-slate-600 dark:text-slate-300 hover:text-[#0F172A] dark:hover:text-white'
                }`}
              >
                {item.label}
                {isActive && (
                  <motion.span
                    layoutId="ash-nav-underline"
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute left-0 right-0 bottom-0 h-0.5 bg-[#1E40AF] dark:bg-blue-400 rounded-full"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Actions: Theme Toggle + Login/Register or Role Console */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="inline-flex items-center justify-center p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-amber-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer shrink-0 ash-btn-press"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={isDark ? 'sun' : 'moon'}
                initial={{ opacity: 0, rotate: -35, scale: 0.8 }}
                animate={{ opacity: 1, rotate: 0, scale: 1 }}
                exit={{ opacity: 0, rotate: 35, scale: 0.8 }}
                transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                className="inline-flex"
              >
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </motion.span>
            </AnimatePresence>
          </button>

          {!user ? (
            <>
              <button
                type="button"
                onClick={() => onOpenAuth('login')}
                className="hidden sm:inline-flex items-center justify-center px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer ash-btn-press"
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => onOpenAuth('register')}
                className="hidden sm:inline-flex items-center justify-center px-3.5 py-2 text-xs font-semibold text-white bg-[#1E40AF] dark:bg-blue-600 rounded-lg hover:bg-[#1E3A8A] dark:hover:bg-blue-500 transition-colors whitespace-nowrap shrink-0 cursor-pointer ash-btn-press"
              >
                Register
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handlePrimaryAction}
              className="hidden sm:inline-flex items-center justify-center px-4 py-2 text-xs font-semibold text-white bg-[#1E40AF] dark:bg-blue-600 rounded-lg hover:bg-[#1E3A8A] dark:hover:bg-blue-500 transition-colors whitespace-nowrap shrink-0 cursor-pointer ash-btn-press"
            >
              {primaryLabel}
            </button>
          )}

          <button
            type="button"
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            onClick={() => setMobileOpen((prev) => !prev)}
            className="lg:hidden p-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer ash-btn-press"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Responsive Mobile & Tablet Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="lg:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 space-y-2"
          >
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  item.action();
                  setMobileOpen(false);
                }}
                className={`block w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ash-btn-press ${
                  activeView === item.id
                    ? 'bg-slate-100 dark:bg-slate-800 text-[#1E40AF] dark:text-blue-400 font-semibold'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                {item.label}
              </button>
            ))}

            {isActiveCollegeAdmin && (
              <button
                type="button"
                onClick={() => {
                  onNavigate('college_admin');
                  setMobileOpen(false);
                }}
                className="block w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60"
              >
                College Admin Console
              </button>
            )}
            {isStateAdmin && (
              <button
                type="button"
                onClick={() => {
                  onNavigate('state_admin');
                  setMobileOpen(false);
                }}
                className="block w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60"
              >
                State Admin Console
              </button>
            )}

            {!user ? (
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    onOpenAuth('login');
                    setMobileOpen(false);
                  }}
                  className="px-4 py-2.5 text-sm font-semibold text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg"
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onOpenAuth('register');
                    setMobileOpen(false);
                  }}
                  className="px-4 py-2.5 text-sm font-semibold text-white bg-[#1E40AF] dark:bg-blue-600 rounded-lg"
                >
                  Register
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  handlePrimaryAction();
                  setMobileOpen(false);
                }}
                className="w-full px-4 py-2.5 text-sm font-semibold text-white bg-[#1E40AF] dark:bg-blue-600 rounded-lg"
              >
                {primaryLabel}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
