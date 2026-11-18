import { useEffect, useState } from "preact/hooks";
import type { Board, RefreshSummary } from "../types";

/** A successful refresh hides itself after this long. A failure stays until closed. */
const TOAST_MS = 6000;

type Toast =
  | { kind: "busy" }
  | { kind: "done"; title: string; lines: string[]; failed: boolean };

function describe(s: RefreshSummary): Toast {
  const errors = Object.entries(s.errors).map(([source, msg]) => `${source}: ${msg}`);
  const parts = [
    s.changes.length > 0 && `${s.changes.length} changed`,
    s.added.length > 0 && `${s.added.length} new`,
    errors.length > 0 && `${errors.length} source failed`,
  ].filter(Boolean);
  const lines = [
    ...s.changes.map((c) => `${c.id}: ${c.from} → ${c.to}`),
    ...s.added.map((id) => `${id}: new, in lane N`),
    ...errors,
  ];
  return { kind: "done", title: parts.length > 0 ? parts.join(", ") : "Up to date", lines, failed: errors.length > 0 };
}

/** Pulls statuses from Linear and GitHub, hands the new board to the page, and reports in a toast. */
export function RefreshButton({ onBoard }: { onBoard: (b: Board) => void }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const busy = toast?.kind === "busy";

  useEffect(() => {
    if (toast?.kind !== "done" || toast.failed) return;
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const run = async () => {
    setToast({ kind: "busy" });
    try {
      const res = await fetch("/api/refresh", { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { summary, board } = (await res.json()) as { summary: RefreshSummary; board: Board };
      onBoard(board);
      setToast(describe(summary));
    } catch (e) {
      setToast({ kind: "done", title: "Refresh failed", lines: [e instanceof Error ? e.message : String(e)], failed: true });
    }
  };

  return (
    <>
      <button type="button" class="refresh" onClick={run} disabled={busy}>🔄 Refresh</button>
      {toast && (
        <div class={`toast${toast.kind === "done" && toast.failed ? " failed" : ""}`} role="status">
          {toast.kind === "busy" ? (
            <span>Refreshing…</span>
          ) : (
            <>
              <button type="button" class="toast-close" aria-label="Close" onClick={() => setToast(null)}>×</button>
              <b>{toast.title}</b>
              {toast.lines.length > 0 && (
                <ul>{toast.lines.map((l) => <li key={l}>{l}</li>)}</ul>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}
