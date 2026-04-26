import { useEffect } from 'react';
import { Sidebar } from './components/Sidebar.js';
import { ChatView } from './components/ChatView.js';
import { useAppStore } from './stores/app.js';

export default function App() {
  const theme = useAppStore((s) => s.theme);
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const setFeatures = useAppStore((s) => s.setFeatures);

  // Fetch feature flags from the main process once on mount.
  useEffect(() => {
    window.api.getConfig().then((c) => setFeatures(c.features));
  }, [setFeatures]);

  // Apply theme — `system` follows the OS; `paper`/`ink` are explicit.
  useEffect(() => {
    const apply = (resolved: 'paper' | 'ink') => {
      document.documentElement.classList.remove('dark', 'light');
      // `ink` = dark-mode palette via the `.dark` selector.
      // `paper` = the :root defaults (no class needed).
      if (resolved === 'ink') document.documentElement.classList.add('dark');
    };
    if (theme === 'system') {
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      apply(mql.matches ? 'ink' : 'paper');
      const listener = (e: MediaQueryListEvent) => apply(e.matches ? 'ink' : 'paper');
      mql.addEventListener('change', listener);
      return () => mql.removeEventListener('change', listener);
    }
    apply(theme);
  }, [theme]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {sidebarOpen && <Sidebar />}
      <ChatView />
    </div>
  );
}
