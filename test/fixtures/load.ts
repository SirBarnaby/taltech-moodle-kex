import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const PAGES_DIR = path.join(root, 'captures/pages');

export const CAPTURES = [
  'course_view__id-37582', 'course_view__id-37829', 'course_view__id-38420', 'login_index',
  'mod_forum_view__id-981476', 'my_', 'my_courses', 'user_index__id-37582',
] as const;

export type CaptureName = (typeof CAPTURES)[number];

export function captureHtml(name: CaptureName): string {
  return readFileSync(path.join(PAGES_DIR, `${name}.html`), 'utf8');
}

export interface CaptureMeta {
  url: string;
  kind: string;
  title: string;
  bodyClass: string;
}

export function captureMeta(name: CaptureName): CaptureMeta {
  return JSON.parse(readFileSync(path.join(PAGES_DIR, `${name}.json`), 'utf8')) as CaptureMeta;
}

const parsed = new Map<CaptureName, Document>();

/**
 * Each capture is parsed once per test file and shared. Scripts never run and nothing is fetched.
 * Tests that mutate the page (decorations) take `captureDoc(name).cloneNode(true)`.
 */
export function captureDoc(name: CaptureName): Document {
  let doc = parsed.get(name);
  if (!doc) {
    // External scripts and stylesheets would only make the parser fail to fetch them (slow and noisy); inline scripts stay (M.cfg).
    const html = captureHtml(name)
      .replace(/<script\b[^>]*\bsrc=[^>]*>\s*<\/script>/gi, '')
      .replace(/<link\b[^>]*\brel=["']?stylesheet[^>]*>/gi, '');
    doc = new DOMParser().parseFromString(html, 'text/html');
    parsed.set(name, doc);
  }
  return doc;
}
