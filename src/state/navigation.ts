import { signal } from '@preact/signals';

/** The destination is already mounted while its Moodle document is arriving. */
export const navigationLoading = signal(false);

/** A link to a page Moodle must render itself was clicked: the skeleton stands in until the browser loads it. */
export const hardNavigating = signal(false);

/** The page changed in place at least once: titles that played on the first load stay still. */
export const softEntered = signal(false);

/** A course link in the sidebar was pressed: the highlight moves there at once, before the course has loaded. */
export const pressedCourseId = signal<number | null>(null);
