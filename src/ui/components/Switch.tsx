interface SwitchProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  id?: string;
}

/** Accessible toggle: a button with role=switch (track 36×20, knob 16). */
export function Switch({ checked, onChange, label, id }: SwitchProps) {
  return (
    <button
      type="button"
      id={id}
      class="kex-switch"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
    >
      <span class="kex-switch__knob" />
    </button>
  );
}
