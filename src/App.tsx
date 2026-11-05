import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { App as CapacitorApp } from '@capacitor/app';
import { Sidebar, BottomNav } from '@/components/Navigation';
import { MobileHeader } from '@/components/MobileHeader';
import { Landing } from '@/pages/Landing';
import { Dashboard } from '@/pages/Dashboard';
import { ProfilePage } from '@/pages/ProfilePage';
import { ExamIntro } from '@/pages/ExamIntro';
import { ExamRun } from '@/pages/ExamRun';
import { ExamResultPage } from '@/pages/ExamResult';
import { AuthPage } from '@/pages/AuthPage';
import { AdminPage } from '@/pages/AdminPage';
import { AccountPage } from '@/pages/AccountPage';
import { OfflineBanner } from '@/components/OfflineBanner';
import { useAppStore } from '@/store/appStore';
import { useAuthStore } from '@/store/authStore';
import { useProfileStore } from '@/store/profileStore';
import { IntroTour, INTRO_SEEN_KEY } from '@/components/IntroTour';
import { getItem as getStoredItem, setItem as setStoredItem } from '@/lib/safeStorage';
import { initPushNotifications, cleanupPushNotifications } from '@/services/pushNotifications';
import { installDiagnostics } from '@/services/diagnostics';

// Install the global error capture at module load, before React mounts, so early
// failures are recorded too. Safe to call repeatedly.
installDiagnostics();

function AppShell() {
  const currentPage = useAppStore((s) => s.currentPage);
  const setPage = useAppStore((s) => s.setPage);
  const toast = useAppStore((s) => s.toast);
  const clearToast = useAppStore((s) => s.clearToast);
  const examRunning = useAppStore((s) => s.examRunning);
  const session = useAuthStore((s) => s.session);
  const loading = useAuthStore((s) => s.loading);
  const restoreSession = useAuthStore((s) => s.restoreSession);
  const loadProfile = useProfileStore((s) => s.loadProfile);

  // First-run onboarding: shown once before the login page, then remembered
  // in safeStorage (memory fallback on WebViews where localStorage is blocked).
  const [introSeen, setIntroSeen] = useState(() => getStoredItem(INTRO_SEEN_KEY) === '1');
  const [landingDismissed, setLandingDismissed] = useState(false);

  const handleIntroDone = () => {
    setStoredItem(INTRO_SEEN_KEY, '1');
    setIntroSeen(true);
  };

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  useEffect(() => {
    if (session) {
      loadProfile();
    }
  }, [session, loadProfile]);

  // Initialize FCM push notifications on native (Android) builds.
  useEffect(() => {
    initPushNotifications().catch((err) => {
      console.error('[Push] Init failed', err);
    });
    return () => {
      cleanupPushNotifications().catch(() => {});
    };
  }, []);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(clearToast, 3000);
    return () => clearTimeout(t);
  }, [toast, clearToast]);

  // Handle Android back button
  useEffect(() => {
    let listener: { remove: () => Promise<void> } | null = null;
    try {
      CapacitorApp.addListener('backButton', () => {
        // If we're on a sub-page, go back to dashboard
        if (currentPage !== 'dashboard') {
          if (examRunning) return; // avoid accidental exit mid-exam
          setPage('dashboard');
        } else {
          // On dashboard, exit the app
          CapacitorApp.exitApp().catch((error: unknown) => {
            console.error('[ServiceYab] app exit failed', error);
          });
        }
      })
        .then((l) => { listener = l; })
        .catch((error: unknown) => {
          console.error('[ServiceYab] back-button listener unavailable', error);
        });
    } catch (error) {
      console.error('[ServiceYab] back-button initialization failed', error);
    }

    return () => {
      if (listener) listener.remove().catch(() => {});
    };
  }, [currentPage, setPage, examRunning]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="h-8 w-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!session) {
    // First launch: multi-step intro first, then public landing, then login.
    // The seen-flag makes sure the tour never shows a second time.
    if (!introSeen) {
      return <IntroTour onDone={handleIntroDone} />;
    }
    if (!landingDismissed) {
      return <Landing onEnter={() => setLandingDismissed(true)} />;
    }
    return <AuthPage />;
  }

  const pages: Record<string, React.ReactNode> = {
    dashboard: <Dashboard />,
    profile: <ProfilePage />,
    'exam-intro': <ExamIntro />,
    'exam-run': <ExamRun />,
    'exam-result': <ExamResultPage />,
    admin: <AdminPage />,
    account: <AccountPage />,
  };

  return (
    <div className="min-h-screen bg-surface">
      <OfflineBanner />
      {/* Ambient background blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-indigo-200/30 blur-3xl" />
        <div className="absolute top-1/2 -left-40 h-96 w-96 rounded-full bg-cyan-200/20 blur-3xl" />
        <div className="absolute bottom-0 right-1/3 h-80 w-80 rounded-full bg-indigo-100/40 blur-3xl" />
      </div>

      <Sidebar />
      <MobileHeader />

      <main className="relative lg:mr-64">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-6 pb-28 lg:pb-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPage}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              {pages[currentPage] ?? <Dashboard />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <BottomNav />

      {/* Global toast */}
      {toast && (
        <div className="fixed bottom-24 lg:bottom-8 inset-x-0 z-50 flex justify-center pointer-events-none">
          <div className="rounded-xl bg-slate-900/90 text-white text-sm px-5 py-3 shadow-2xl backdrop-blur">
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}

// Kept as a thin wrapper so the root stays a stable mount point.
function App() {
  return <AppShell />;
}

export default App;
