import { inModal, isTypingTarget } from './dom';

export type Scope = 'global' | 'palette' | 'course' | 'workspace' | 'preview';

export interface Binding {
  /** "ctrl+k", "alt+shift+o", "g w" (chord), "?", "escape". Lower-case. */
  keys: string;
  scope: Scope;
  /** i18n key of the description shown in the help overlay. */
  description: string;
  /** Display group in the help overlay. */
  group: 'General' | 'Navigate' | 'Lists' | 'Course';
  run: (e: KeyboardEvent) => void;
  /** Fire even while typing in a field (Ctrl+K, Esc). */
  allowInInput?: boolean;
  /** Extra guard; return false to let the key through. */
  when?: (e: KeyboardEvent) => boolean;
}

interface Candidate {
  binding: { b: Binding; p: Parsed };
  step: number;
}

interface Parsed {
  steps: { key: string; ctrl: boolean; alt: boolean; shift: boolean; meta: boolean }[];
}

function parse(spec: string): Parsed {
  const steps = spec.split(' ').map((part) => {
    const bits = part.split('+');
    const key = bits.pop() ?? '';
    return {
      key,
      ctrl: bits.includes('ctrl'),
      alt: bits.includes('alt'),
      shift: bits.includes('shift'),
      meta: bits.includes('meta'),
    };
  });
  return { steps };
}

function normKey(e: KeyboardEvent): string {
  const k = e.key;
  if (k === ' ') return 'space';
  if (k.length === 1) return k.toLowerCase();
  return k.toLowerCase(); // "Escape" -> "escape", "ArrowUp" -> "arrowup"
}

/** Does this event match one step? Shift is only compared for named/modified keys, not for symbols like "?". */
function stepMatches(step: Parsed['steps'][number], e: KeyboardEvent): boolean {
  if (normKey(e) !== step.key) {
    // Alt+digit produces symbols on some layouts; fall back to the physical key.
    if (!(step.alt && /^\d$/.test(step.key) && e.code === `Digit${step.key}`)) return false;
  }
  if (e.ctrlKey !== step.ctrl || e.altKey !== step.alt || e.metaKey !== step.meta) return false;
  const isSymbol = step.key.length === 1 && !/[a-z0-9]/.test(step.key);
  if (!isSymbol && e.shiftKey !== step.shift) return false;
  return true;
}

export const CHORD_TIMEOUT_MS = 1000;

/** One capture-phase keydown listener; supports chords ("g w") and scopes. */
export class KeyManager {
  private bindings: { b: Binding; p: Parsed }[] = [];
  private scopes = new Set<Scope>(['global']);
  private pending: Candidate[] = [];
  private timer: number | undefined;
  private attached = false;
  private suspended = false;

  constructor(private readonly target: Document | Window = window) {}

  register(bindings: Binding[]): () => void {
    const added = bindings.map((b) => ({ b, p: parse(b.keys) }));
    this.bindings.push(...added);
    return () => {
      this.bindings = this.bindings.filter((x) => !added.includes(x));
    };
  }

  all(): Binding[] {
    return this.bindings.map((x) => x.b);
  }

  setScope(scope: Scope, on: boolean): void {
    if (on) this.scopes.add(scope);
    else this.scopes.delete(scope);
  }

  /** Suspend everything except bindings flagged allowInInput (used while the palette owns the keyboard). */
  suspend(on: boolean): void {
    this.suspended = on;
  }

  attach(): void {
    if (this.attached) return;
    this.attached = true;
    this.target.addEventListener('keydown', this.onKeyDown as EventListener, true);
  }

  detach(): void {
    this.attached = false;
    this.target.removeEventListener('keydown', this.onKeyDown as EventListener, true);
    this.resetChord();
  }

  private resetChord(): void {
    this.pending = [];
    if (this.timer !== undefined) window.clearTimeout(this.timer);
    this.timer = undefined;
  }

  private fresh(): Candidate[] {
    return this.bindings.filter((x) => this.scopes.has(x.b.scope)).map((binding) => ({ binding, step: 0 }));
  }

  /** Try the candidates against this event. Returns "fired", "pending" (chord continues) or "none". */
  private evaluate(candidates: Candidate[], e: KeyboardEvent, typing: boolean): 'fired' | 'pending' | 'none' {
    const next: Candidate[] = [];
    for (const c of candidates) {
      const step = c.binding.p.steps[c.step];
      if (!step || !stepMatches(step, e)) continue;
      const { b } = c.binding;
      if (this.suspended && !b.allowInInput) continue;
      if (typing && !b.allowInInput) continue;
      if (b.when && !b.when(e)) continue;
      if (c.step + 1 < c.binding.p.steps.length) {
        next.push({ binding: c.binding, step: c.step + 1 });
      } else {
        e.preventDefault();
        e.stopPropagation();
        this.resetChord();
        b.run(e);
        return 'fired';
      }
    }
    if (next.length) {
      e.preventDefault();
      this.resetChord();
      this.pending = next;
      this.timer = window.setTimeout(() => this.resetChord(), CHORD_TIMEOUT_MS);
      return 'pending';
    }
    return 'none';
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.isComposing) return;
    if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') return;
    const typing = isTypingTarget(e.target) || inModal(e.target);
    if (this.pending.length) {
      const r = this.evaluate(this.pending, e, typing);
      if (r !== 'none') return;
      this.resetChord();
    }
    this.evaluate(this.fresh(), e, typing);
  };
}

/** Pretty label for a key spec: "ctrl+k" -> ["Ctrl", "K"]; "g w" -> ["G", "then", "W"]. */
export function keyLabel(spec: string): string[] {
  const names: Record<string, string> = {
    ctrl: 'Ctrl', alt: 'Alt', shift: 'Shift', meta: 'Meta', escape: 'Esc', arrowup: '↑', arrowdown: '↓', arrowleft: '←', arrowright: '→',
    enter: '↵', space: 'Space',
  };
  const out: string[] = [];
  spec.split(' ').forEach((part, i) => {
    if (i > 0) out.push('then');
    for (const bit of part.split('+')) out.push(names[bit] ?? (bit.length === 1 ? bit.toUpperCase() : bit));
  });
  return out;
}
