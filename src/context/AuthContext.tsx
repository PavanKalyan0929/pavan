import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
  testFirestoreConnection,
} from '../lib/firebase.ts';
import type { CollegeAdminProfile, StudentProfile } from '../types.ts';

export const BOOTSTRAPPED_STATE_ADMIN_EMAIL = 'adithyaadhi983@gmail.com';

interface AuthContextValue {
  user: User | null;
  authReady: boolean;
  dbConnected: boolean;
  studentProfile: StudentProfile | null;
  collegeAdminProfile: CollegeAdminProfile | null;
  isStateAdmin: boolean;
  isActiveCollegeAdmin: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  getToken: () => Promise<string>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [dbConnected, setDbConnected] = useState(true);
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null);
  const [collegeAdminProfile, setCollegeAdminProfile] = useState<CollegeAdminProfile | null>(null);
  const [stateAdminDocActive, setStateAdminDocActive] = useState(false);

  useEffect(() => {
    testFirestoreConnection().then(setDbConnected).catch(() => setDbConnected(false));

    const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
      if (!firebaseUser) {
        setStudentProfile(null);
        setCollegeAdminProfile(null);
        setStateAdminDocActive(false);
      }
    });

    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!authReady || !user) return;

    const studentPath = `students/${user.uid}`;
    const unsubStudent = onSnapshot(
      doc(db, 'students', user.uid),
      (snap) => {
        setStudentProfile(snap.exists() ? (snap.data() as StudentProfile) : null);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, studentPath);
      }
    );

    const collegeAdminPath = `college_admins/${user.uid}`;
    const unsubCollegeAdmin = onSnapshot(
      doc(db, 'college_admins', user.uid),
      (snap) => {
        setCollegeAdminProfile(snap.exists() ? (snap.data() as CollegeAdminProfile) : null);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, collegeAdminPath);
      }
    );

    const stateAdminPath = `state_admins/${user.uid}`;
    const unsubStateAdmin = onSnapshot(
      doc(db, 'state_admins', user.uid),
      (snap) => {
        setStateAdminDocActive(snap.exists() && Boolean(snap.data()?.active));
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, stateAdminPath);
      }
    );

    return () => {
      unsubStudent();
      unsubCollegeAdmin();
      unsubStateAdmin();
    };
  }, [authReady, user]);

  const isBootstrappedStateAdmin =
    Boolean(user?.emailVerified) && user?.email === BOOTSTRAPPED_STATE_ADMIN_EMAIL;
  const isStateAdmin = isBootstrappedStateAdmin || stateAdminDocActive;
  const isActiveCollegeAdmin =
    Boolean(collegeAdminProfile?.active) && collegeAdminProfile?.status === 'active';

  async function signInWithGoogle() {
    await signInWithPopup(auth, googleProvider);
  }

  async function signOut() {
    await firebaseSignOut(auth);
  }

  async function getToken() {
    if (!auth.currentUser) throw new Error('Not signed in.');
    return auth.currentUser.getIdToken();
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        authReady,
        dbConnected,
        studentProfile,
        collegeAdminProfile,
        isStateAdmin,
        isActiveCollegeAdmin,
        signInWithGoogle,
        signOut,
        getToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
