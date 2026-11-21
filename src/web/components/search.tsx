import { useEffect, useRef } from "preact/hooks";

interface Props {
  open: boolean;
  query: string;
  /** 0-based index of the current match, and how many matches there are. */
  current: number;
  total: number;
  onToggle: () => void;
  onOpen: () => void;
  onClose: () => void;
  onQuery: (q: string) => void;
  onStep: (delta: 1 | -1) => void;
}

/**
 * The 🔍 button and, when open, the search box beside it. ⌘F / Ctrl+F opens it in place of the
 * browser's find, Enter and Shift+Enter step through the matches, Esc closes it and clears the search.
 */
export function Search({ open, query, current, total, onToggle, onOpen, onClose, onQuery, onStep }: Props) {
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        onOpen();
        input.current?.select();
      }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [onOpen]);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  return (
    <>
      {open && (
        <label class="input input-sm w-64">
          <input
            ref={input}
            type="search"
            class="grow sensitive"
            placeholder="Search ID, title or app"
            value={query}
            onInput={(e) => onQuery(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "Enter") onStep(e.shiftKey ? -1 : 1);
            }}
          />
          {query.trim() && <span class="text-xs text-base-content/60">{total ? `${current + 1}/${total}` : "0"}</span>}
        </label>
      )}
      <button
        type="button"
        class={`tooltip tooltip-bottom btn btn-ghost btn-sm btn-square ${open ? "btn-active" : ""}`}
        data-tip="Search (⌘F)"
        aria-label="Search"
        onClick={onToggle}
      >
        🔍
      </button>
    </>
  );
}
