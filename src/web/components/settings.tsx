import { THEMES, type Theme } from "../theme";
interface Option<T extends string> {
  value: T;
  label: string;
  title?: string;
}

/** A row of joined buttons where exactly one is active. */
function Segmented<T extends string>({ value, options, onChange }: { value: T; options: Option<T>[]; onChange: (v: T) => void }) {
  return (
    <div class="join w-28">
      {options.map((o) => (
        <button
          type="button"
          key={o.value}
          aria-label={o.title}
          data-tip={o.title}
          class={`tooltip btn btn-xs join-item flex-1 ${o.value === value ? "btn-active btn-primary" : ""}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}


function Switch({ label, value, onChange, on = "🟢", off = "🔴" }: { label: string; value: boolean; onChange: (v: boolean) => void; on?: string; off?: string }) {
  return (
    <>
      <span>{label}</span>
      <Segmented
        value={value ? "on" : "off"}
        onChange={(v) => onChange(v === "on")}
        options={[
          { value: "on", label: on, title: `${label}: on` },
          { value: "off", label: off, title: `${label}: off` },
        ]}
      />
    </>
  );
}


interface Props {
  theme: Theme;
  onTheme: (t: Theme) => void;
  titles: boolean;
  onTitles: (v: boolean) => void;
  positions: boolean;
  onPositions: (v: boolean) => void;
  inLane: boolean;
  onInLane: (v: boolean) => void;
  legend: boolean;
  completed: boolean;
  onCompleted: (v: boolean) => void;
  onLegend: (v: boolean) => void;
  privacy: boolean;
  onPrivacy: (v: boolean) => void;
}

/** The 🎛️ button and its dropdown of display settings. Clicking outside closes it (DaisyUI focus dropdown). */
export function Settings(p: Props) {
  return (
    <div class="dropdown dropdown-end">
      <div tabIndex={0} role="button" class="tooltip tooltip-left btn btn-ghost btn-sm btn-square" data-tip="Settings" aria-label="Settings">🎛️</div>
      <div tabIndex={0} class="dropdown-content z-30 mt-2 grid whitespace-nowrap grid-cols-[auto_auto] items-center gap-x-6 gap-y-2 rounded-box bg-base-100 p-4 text-sm shadow-lg ring-1 ring-base-300">
        <span>theme</span>
        <Segmented
          value={p.theme}
          onChange={p.onTheme}
          options={[...THEMES]}
        />
        <Switch label="titles" value={p.titles} onChange={p.onTitles} />
        <Switch label="positions" value={p.positions} onChange={p.onPositions} />
        <Switch label="in-lane blockers" value={p.inLane} onChange={p.onInLane} />
        <Switch label="completed" value={p.completed} onChange={p.onCompleted} />
        <Switch label="legend" value={p.legend} onChange={p.onLegend} />
        <Switch label="privacy" value={p.privacy} onChange={p.onPrivacy} on="🙈" off="🙉" />
      </div>
    </div>
  );
}
