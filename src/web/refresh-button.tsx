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
      <button type="button" class="btn btn-ghost btn-sm btn-square" title="Refresh statuses from Linear and GitHub" aria-label="Refresh" onClick={run} disabled={busy}>
        {busy ? <span class="loading loading-spinner loading-xs" /> : "🔁"}
      </button>
      {toast && (
        <div class="toast toast-start toast-bottom z-20">
          {toast.kind === "busy" ? (
            <div role="status" class="alert">
              <span class="loading loading-spinner loading-sm" />
              <span>Refreshing…</span>
            </div>
          ) : (
            <div role="status" class={`alert ${toast.failed ? "alert-error" : "alert-success"} alert-soft max-w-md items-start`}>
              <div>
                <b>{toast.title}</b>
                {toast.lines.length > 0 && (
                  <ul class="mt-1 list-disc pl-5 text-xs">{toast.lines.map((l) => <li key={l}>{l}</li>)}</ul>
                )}
              </div>
              <button type="button" class="btn btn-ghost btn-xs btn-circle" aria-label="Close" onClick={() => setToast(null)}>✕</button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
