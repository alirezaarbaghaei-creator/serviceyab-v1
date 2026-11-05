import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Home, Calendar, CheckSquare, MessageCircle, MoreHorizontal } from 'lucide-react';
import { useManagerStore } from '@/store/managerStore';
import { HomeTab } from './manager/HomeTab';
import { TasksTab } from './manager/TasksTab';
import { CalendarTab } from './manager/CalendarTab';
import { AssistantTab } from './manager/AssistantTab';
import { MoreTab } from './manager/MoreTab';

type ManagerTab = 'home' | 'calendar' | 'tasks' | 'assistant' | 'more';

const TABS: { key: ManagerTab; label: string; icon: typeof Home }[] = [
  { key: 'home', label: 'خانه', icon: Home },
  { key: 'calendar', label: 'تقویم', icon: Calendar },
  { key: 'tasks', label: 'کارها', icon: CheckSquare },
  { key: 'assistant', label: 'دستیار', icon: MessageCircle },
  { key: 'more', label: 'بیشتر', icon: MoreHorizontal },
];

/**
 * «مدیر من» — full Life Manager module (ported from the life_manager Expo
 * app) running inside Kateb's React + Vite + Tailwind stack.
 */
export function ManagerPage() {
  const [tab, setTab] = useState<ManagerTab>('home');
  const refresh = useManagerStore((s) => s.refresh);
  const loaded = useManagerStore((s) => s.loaded);

  useEffect(() => {
    if (!loaded) void refresh();
  }, [loaded, refresh]);

  return (
    <div className="space-y-4">
      {/* Content */}
      <motion.div
        key={tab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      >
        {tab === 'home' && <HomeTab />}
        {tab === 'calendar' && <CalendarTab />}
        {tab === 'tasks' && <TasksTab />}
        {tab === 'assistant' && <AssistantTab />}
        {tab === 'more' && <MoreTab />}
      </motion.div>

      {/* Inner tab bar (desktop: inline pill; mobile: bottom is Kateb's nav, so keep it top-friendly) */}
      <div className="sticky bottom-20 z-30 mx-auto w-full max-w-md lg:bottom-4">
        <nav className="glass flex items-center justify-around rounded-2xl border border-white/60 px-2 py-2 shadow-glass">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className="flex flex-col items-center gap-0.5 px-3 py-1.5 transition-all"
              >
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
                    active
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 scale-105'
                      : 'text-slate-400 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <span className={`text-[10px] font-medium ${active ? 'text-indigo-600' : 'text-slate-400'}`}>
                  {t.label}
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
