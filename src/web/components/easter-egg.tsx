import { useEffect, useRef, useState } from "preact/hooks";

const VIDEO = "https://www.youtube.com/embed/64eXjTSC4mU?autoplay=1";

/** The page title. Clicking it opens a video in a modal; the iframe exists only while open, so closing stops it. */
export function Title() {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (open) dialog.current?.showModal();
  }, [open]);

  return (
    <>
      <h1 class="mr-auto text-base font-bold">
        <button type="button" class="tooltip tooltip-right cursor-pointer" data-tip="Click me!" onClick={() => setOpen(true)}>
          🐬 dolphin
        </button>
      </h1>
      {open && (
        <dialog ref={dialog} class="modal" onClose={() => setOpen(false)}>
          <div class="modal-box w-11/12 max-w-3xl p-2 pt-10">
            {/* Esc does not reach the dialog while the iframe has focus, so the box needs its own close button. */}
            <form method="dialog">
              <button type="submit" class="btn btn-ghost btn-sm btn-circle absolute top-1 right-1" aria-label="Close">
                ✕
              </button>
            </form>
            <iframe
              class="aspect-video w-full rounded-box"
              src={VIDEO}
              title="🐬"
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
              referrerpolicy="strict-origin-when-cross-origin"
            />
          </div>
          <form method="dialog" class="modal-backdrop">
            <button type="submit" aria-label="Close">
              close
            </button>
          </form>
        </dialog>
      )}
    </>
  );
}
