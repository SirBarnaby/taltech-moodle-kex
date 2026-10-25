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

/**
 * Load a captured page into the current happy-dom document (scripts are not executed).
 * Returns the parsed document so tests can query it.
 */
export function loadCapture(name: CaptureName): Document {
  const html = captureHtml(name);
  document.open();
  document.write(html.replace(/<script\b[^>]*\bsrc\s*=[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<link\b[^>]*>/gi, ''));
  document.close();
  return document;
}
