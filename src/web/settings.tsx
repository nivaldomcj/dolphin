interface Option<T extends string> {
  value: T;
  label: string;
  title?: string;
}

/** A row of joined buttons where exactly one is active. */
function Segmented<T extends string>({ value, options, onChange }: { value: T; options: Option<T>[]; onChange: (v: T) => void }) {
  return (
    <div class="join">
      {options.map((o) => (
        <button
          type="button"
          key={o.value}
          title={o.title}
          class={`btn btn-xs join-item ${o.value === value ? "btn-active btn-primary" : ""}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const ON_OFF: Option<"on" | "off">[] = [
  { value: "on", label: "on" },
  { value: "off", label: "off" },
];

function Switch({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <>
      <span>{label}</span>
      <Segmented value={value ? "on" : "off"} options={ON_OFF} onChange={(v) => onChange(v === "on")} />
    </>
  );
}

export type Theme = "system" | "light" | "dark";

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
  onLegend: (v: boolean) => void;
  privacy: boolean;
  onPrivacy: (v: boolean) => void;
}

/** The 🎛️ button and its dropdown of display settings. Clicking outside closes it (DaisyUI focus dropdown). */
export function Settings(p: Props) {
  return (
    <div class="dropdown dropdown-end">
      <div tabIndex={0} role="button" class="btn btn-ghost btn-sm btn-square" title="Settings" aria-label="Settings">🎛️</div>
      <div tabIndex={0} class="dropdown-content z-30 mt-2 grid whitespace-nowrap grid-cols-[auto_auto] items-center gap-x-6 gap-y-2 rounded-box bg-base-100 p-4 text-sm shadow-lg ring-1 ring-base-300">
        <span>theme</span>
        <Segmented
          value={p.theme}
          onChange={p.onTheme}
          options={[
            { value: "system", label: "💻", title: "System" },
            { value: "light", label: "☀️", title: "Light" },
            { value: "dark", label: "🌔", title: "Dark" },
          ]}
        />
        <Switch label="titles" value={p.titles} onChange={p.onTitles} />
        <Switch label="positions" value={p.positions} onChange={p.onPositions} />
        <Switch label="in-lane blockers" value={p.inLane} onChange={p.onInLane} />
        <Switch label="legend" value={p.legend} onChange={p.onLegend} />
        <span>privacy</span>
        <Segmented
          value={p.privacy ? "on" : "off"}
          onChange={(v) => p.onPrivacy(v === "on")}
          options={[
            { value: "on", label: "🙈", title: "Privacy on: hide titles and lane names" },
            { value: "off", label: "🙉", title: "Privacy off" },
          ]}
        />
      </div>
    </div>
  );
}
