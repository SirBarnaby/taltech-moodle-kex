import { signal } from '@preact/signals';
import type { EffectMode } from '../fx/effects';

/** What the hero shader is doing right now ("fallback" = CSS image, e.g. effects off or no WebGL2). */
export const heroEffectMode = signal<EffectMode>('static');
