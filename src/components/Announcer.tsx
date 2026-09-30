import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

type Announce = (message: string) => void;

const AnnounceContext = createContext<Announce>(() => {});

/**
 * One stable polite live region for the whole app. Repeated announcements
 * need a region that exists before its text changes, so it is rendered once
 * here and every component posts through the context.
 */
export function AnnouncerProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('');
  const timer = useRef<number | null>(null);
  const current = useRef('');

  const announce = useCallback<Announce>((text) => {
    if (timer.current) window.clearTimeout(timer.current);
    if (current.current === text) {
      // Clear first so an identical message is announced again.
      setMessage('');
      timer.current = window.setTimeout(() => setMessage(text), 30);
    } else {
      setMessage(text);
    }
    current.current = text;
  }, []);

  const value = useMemo(() => announce, [announce]);

  return (
    <AnnounceContext.Provider value={value}>
      {children}
      <div className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
        {message}
      </div>
    </AnnounceContext.Provider>
  );
}

export function useAnnounce(): Announce {
  return useContext(AnnounceContext);
}
