export type BrowserNotificationPermissionState =
  | 'default'
  | 'granted'
  | 'denied'
  | 'unsupported';

export type PushAlertCategory = 'Scholarship' | 'Grievance Update';

export interface StudentPushPreferences {
  browserEnabled: boolean;
  scholarshipAlerts: boolean;
  grievanceAlerts: boolean;
}

export interface StudentPushAlert {
  id: string;
  category: PushAlertCategory;
  title: string;
  message: string;
  targetTab: 'scholarships' | 'grievances' | 'notifications';
  timestampLabel: string;
  createdAtMs: number;
  read: boolean;
}

const DEFAULT_PREFS: StudentPushPreferences = {
  browserEnabled: true,
  scholarshipAlerts: true,
  grievanceAlerts: true,
};

export function getBrowserNotificationPermission(): BrowserNotificationPermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return window.Notification.permission;
}

export async function requestBrowserNotificationPermission(): Promise<BrowserNotificationPermissionState> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  try {
    const result = await window.Notification.requestPermission();
    return result;
  } catch {
    return getBrowserNotificationPermission();
  }
}

export function loadStudentPushPreferences(uid: string): StudentPushPreferences {
  if (typeof window === 'undefined' || !uid) return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(`ash_push_prefs_${uid}`);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<StudentPushPreferences>;
    return {
      browserEnabled: parsed.browserEnabled ?? DEFAULT_PREFS.browserEnabled,
      scholarshipAlerts: parsed.scholarshipAlerts ?? DEFAULT_PREFS.scholarshipAlerts,
      grievanceAlerts: parsed.grievanceAlerts ?? DEFAULT_PREFS.grievanceAlerts,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function saveStudentPushPreferences(uid: string, prefs: StudentPushPreferences): void {
  if (typeof window === 'undefined' || !uid) return;
  try {
    window.localStorage.setItem(`ash_push_prefs_${uid}`, JSON.stringify(prefs));
  } catch {
    // Ignore storage quota errors in restricted browsing contexts
  }
}

export function loadStoredPushAlerts(uid: string): StudentPushAlert[] {
  if (typeof window === 'undefined' || !uid) return [];
  try {
    const raw = window.localStorage.getItem(`ash_push_alerts_${uid}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StudentPushAlert[];
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, 40);
  } catch {
    return [];
  }
}

export function saveStoredPushAlerts(uid: string, alerts: StudentPushAlert[]): void {
  if (typeof window === 'undefined' || !uid) return;
  try {
    window.localStorage.setItem(`ash_push_alerts_${uid}`, JSON.stringify(alerts.slice(0, 40)));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadSeenStatusSnapshots(uid: string): {
  grievances: Record<string, string>;
  scholarships: Record<string, string>;
} {
  if (typeof window === 'undefined' || !uid) {
    return { grievances: {}, scholarships: {} };
  }
  try {
    const raw = window.localStorage.getItem(`ash_push_snapshots_${uid}`);
    if (!raw) return { grievances: {}, scholarships: {} };
    const parsed = JSON.parse(raw) as {
      grievances?: Record<string, string>;
      scholarships?: Record<string, string>;
    };
    return {
      grievances: parsed.grievances || {},
      scholarships: parsed.scholarships || {},
    };
  } catch {
    return { grievances: {}, scholarships: {} };
  }
}

export function saveSeenStatusSnapshots(
  uid: string,
  snapshots: {
    grievances: Record<string, string>;
    scholarships: Record<string, string>;
  }
): void {
  if (typeof window === 'undefined' || !uid) return;
  try {
    window.localStorage.setItem(`ash_push_snapshots_${uid}`, JSON.stringify(snapshots));
  } catch {
    // Ignore storage quota errors
  }
}

export function dispatchBrowserPushNotification(
  alert: Pick<StudentPushAlert, 'id' | 'title' | 'message'>,
  onSelect?: () => void
): boolean {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  if (window.Notification.permission !== 'granted') {
    return false;
  }

  try {
    const notification = new window.Notification(alert.title, {
      body: alert.message,
      tag: alert.id,
    });
    notification.onclick = () => {
      try {
        window.focus();
      } catch {
        // Ignore focus restriction in sandboxed iframe
      }
      onSelect?.();
      notification.close();
    };
    return true;
  } catch {
    return false;
  }
}
