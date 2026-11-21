import { useState } from "preact/hooks";
import type { Board, RefreshSummary } from "../../types";
import { type Notice, NoticeAlert, Toast, useAutoHide } from "./toast";

type State = { kind: "busy" } | ({ kind: "done" } & Notice);

/** The toast for a refresh summary: a short title, one line per change, new task and failed source. */
export function describeRefresh(s: RefreshSummary): State {
  const errors = Object.entries(s.errors).map(([source, msg]) => `${source}: ${msg}`);
  const parts = [
    s.changes.length > 0 && `${s.changes.length} changed`,
    s.added.length > 0 && `${s.added.length} new`,
    errors.length > 0 && `${errors.length} source failed`,
  ].filter(Boolean);
  const lines = [...s.changes.map((c) => `${c.id}: ${c.from} → ${c.to}`), ...s.added.map((id) => `${id}: new, in lane N`), ...errors];
  return { kind: "done", title: parts.length > 0 ? parts.join(", ") : "Up to date", lines, failed: errors.length > 0 };
}

/** Pulls statuses from Linear and GitHub, hands the new board to the page, and reports in a toast. */
export function RefreshButton({ onBoard }: { onBoard: (b: Board) => void }) {
  const [toast, setToast] = useState<State | null>(null);
  const busy = toast?.kind === "busy";
  useAutoHide(toast?.kind === "done" ? toast : null, () => setToast(null));

  const run = async () => {
    setToast({ kind: "busy" });
    try {
      const res = await fetch("/api/refresh", { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { summary, board } = (await res.json()) as { summary: RefreshSummary; board: Board };
      onBoard(board);
      setToast(describeRefresh(summary));
    } catch (e) {
      setToast({ kind: "done", title: "Refresh failed", lines: [e instanceof Error ? e.message : String(e)], failed: true });
    }
  };

  return (
    <>
      <button
        type="button"
        class="tooltip tooltip-left btn btn-ghost btn-sm btn-square"
        data-tip="Refresh statuses from Linear and GitHub"
        aria-label="Refresh"
        onClick={run}
        disabled={busy}
      >
        {busy ? <span class="loading loading-spinner loading-xs" /> : "🔁"}
      </button>
      {toast && (
        <Toast side="start">
          {toast.kind === "busy" ? (
            <div role="status" class="alert">
              <span class="loading loading-spinner loading-sm" />
              <span>Refreshing…</span>
            </div>
          ) : (
            <NoticeAlert notice={toast} tone="success" onClose={() => setToast(null)} />
          )}
        </Toast>
      )}
    </>
  );
}
