/**
 * The bundled fonts (fonts.css) load only once some text uses them, so the first render laid out in a fallback face and then
 * reflowed when the real one arrived (a wrapped toolbar on My courses jumped 68 px). They are started at document_start instead,
 * and the first render waits for them, briefly: they are local files and arrive in a few milliseconds.
 */

/** One weight per family loads the whole variable file; the sample covers both the latin and the latin-ext slices. */
const FACES = ['400 16px "Inter Variable"', '600 16px "Inter Tight Variable"', '400 16px "JetBrains Mono Variable"'];
const SAMPLE = 'Aa õäöü šž';
/** Longest the first render waits; past it the page renders anyway and the fonts swap in when they come. */
const WAIT_MS = 300;

let loading: Promise<void> | undefined;

export function warmFonts(): Promise<void> {
  if (!loading) {
    try {
      loading = Promise.all(FACES.map((f) => document.fonts.load(f, SAMPLE))).then(
        () => undefined,
        () => undefined,
      );
    } catch {
      loading = Promise.resolve();
    }
  }
  return loading;
}

/** Resolves once the fonts are in, or after WAIT_MS. */
export function fontsSettled(): Promise<void> {
  return Promise.race([warmFonts(), new Promise<void>((r) => window.setTimeout(r, WAIT_MS))]);
}
