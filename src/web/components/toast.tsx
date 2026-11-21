import type { ComponentChildren } from "preact";
import { useEffect } from "preact/hooks";

/** What a toast reports when an action ends: a title, detail lines, and whether it failed. */
export interface Notice {
  title: string;
  lines: string[];
  failed: boolean;
}

/** A notice that did not fail hides itself after this long. A failure stays until closed. */
const HIDE_MS = 6000;

/** Clears a notice after `HIDE_MS`, unless it failed. */
export function useAutoHide(notice: Notice | null, clear: () => void) {
  useEffect(() => {
    if (!notice || notice.failed) return;
    const timer = setTimeout(clear, HIDE_MS);
    return () => clearTimeout(timer);
  }, [notice]);
}

// Whole class names, so Tailwind's scan of the source finds them.
const SIDE = { start: "toast-start", end: "toast-end" } as const;
const TONE = { success: "alert-success", warning: "alert-warning" } as const;

/** The bottom corner a toast sits in. Refresh uses the left, drag and drop the right, so both can show at once. */
export function Toast({ side, children }: { side: keyof typeof SIDE; children: ComponentChildren }) {
  return <div class={`toast ${SIDE[side]} toast-bottom z-20`}>{children}</div>;
}

interface NoticeAlertProps {
  notice: Notice;
  /** The color when it did not fail. A failure is always red. */
  tone: keyof typeof TONE;
  /** Lines that can name real projects are hidden in privacy mode. */
  sensitive?: boolean;
  onClose: () => void;
}

export function NoticeAlert({ notice, tone, sensitive = false, onClose }: NoticeAlertProps) {
  return (
    <div role="status" class={`alert ${notice.failed ? "alert-error" : TONE[tone]} alert-soft max-w-md items-start`}>
      <div>
        <b>{notice.title}</b>
        {notice.lines.length > 0 && (
          <ul class={`mt-1 list-disc pl-5 text-xs${sensitive ? " sensitive" : ""}`}>
            {notice.lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        )}
      </div>
      <button type="button" class="btn btn-ghost btn-xs btn-circle" aria-label="Close" onClick={onClose}>
        ✕
      </button>
    </div>
  );
}
