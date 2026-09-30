import { useEffect, useRef, useState } from 'react';
import { useAnnounce } from './Announcer';

interface CopyButtonProps {
  /** Text placed on the clipboard. */
  value: string;
  /** What the value is, for the accessible name: "address", "transaction hash". */
  what?: string;
  /** Hide the visible "Copy" text and show only the icon. */
  iconOnly?: boolean;
  className?: string;
}

type CopyState = 'idle' | 'copied' | 'failed';

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

export function CopyButton({ value, what = 'address', iconOnly = false, className = '' }: CopyButtonProps) {
  const [state, setState] = useState<CopyState>('idle');
  const announce = useAnnounce();
  const timer = useRef<number | null>(null);

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  const handleClick = async () => {
    const ok = await copyText(value);
    setState(ok ? 'copied' : 'failed');
    announce(ok ? `Copied ${what} to the clipboard.` : `Unable to copy the ${what}. Select the text and copy it manually.`);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState('idle'), ok ? 1800 : 4000);
  };

  const label = state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : 'Copy';

  return (
    <button
      type="button"
      className={`copy-button ${iconOnly ? 'copy-button--icon' : ''} ${state !== 'idle' ? `copy-button--${state}` : ''} ${className}`.trim()}
      onClick={handleClick}
      aria-label={`${label}: ${what} ${value}`}
      data-state={state}
    >
      <span className="copy-button__icon" aria-hidden="true">
        {state === 'copied' ? (
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 8.5l3 3 7-7" />
          </svg>
        ) : (
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
            <path d="M10.5 5.5v-2a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2" />
          </svg>
        )}
      </span>
      {!iconOnly && <span className="copy-button__text">{label}</span>}
    </button>
  );
}
