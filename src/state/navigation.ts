import { signal } from '@preact/signals';

/** The destination is already mounted while its Moodle document is arriving. */
export const navigationLoading = signal(false);

/** A link to a page Moodle must render itself was clicked: the skeleton stands in until the browser loads it. */
export const hardNavigating = signal(false);
