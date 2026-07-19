"use client";

export function Chip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm font-medium transition-all active:scale-95 ${
        selected
          ? "border-ink bg-ink text-cream shadow-soft"
          : "border-sand bg-surface text-ink hover:border-muted"
      }`}
    >
      {label}
    </button>
  );
}

export function ChipGroup({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string | null;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <Chip key={o} label={o} selected={value === o} onClick={() => onChange(o)} />
      ))}
    </div>
  );
}

export function MultiChipGroup({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (o: string) =>
    onChange(value.includes(o) ? value.filter((v) => v !== o) : [...value, o]);
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <Chip
          key={o}
          label={o}
          selected={value.includes(o)}
          onClick={() => toggle(o)}
        />
      ))}
    </div>
  );
}
