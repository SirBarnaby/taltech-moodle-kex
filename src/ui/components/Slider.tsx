/**
 * A range slider in KEX's look. It is the browser's own range input underneath, so arrow keys, Page Up and Down, touch and screen
 * readers work as everywhere; only the track and the knob are drawn by controls.css (`--kex-fill` is the filled part).
 */
export function Slider({ id, label, value, min = 0, max = 100, step = 5, onChange }: {
  id: string;
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  const fill = `${((value - min) / Math.max(1, max - min)) * 100}%`;
  return (
    <input
      type="range"
      class="kex-slider"
      id={id}
      aria-label={label}
      min={min}
      max={max}
      step={step}
      value={value}
      style={{ '--kex-fill': fill }}
      onInput={(e) => onChange(Number((e.currentTarget as HTMLInputElement).value))}
    />
  );
}
