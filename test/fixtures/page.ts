import { expect } from 'vitest';
import { parsePageInfo } from '../../src/content/pageinfo';
import { resolveRoute } from '../../src/content/router';
import { parseSkinPage } from '../../src/content/skinpage';
import { captureDoc, captureMeta, type CaptureName } from './load';

export const pageInfoOf = (name: CaptureName) => {
  const u = new URL(captureMeta(name).url);
  return parsePageInfo({ doc: captureDoc(name), pathname: u.pathname, search: u.search });
};

/** What every capture has to give: the signed-in user, the redacted sesskey, the site root, a page- body id, a route; skin routes also a title for the band. */
export function expectCaptureReadable(name: CaptureName): void {
  const i = pageInfoOf(name);
  // The login capture is a guest page: Moodle reports userId 1 there.
  expect([i.userId, i.sesskey, i.wwwroot, i.isGuest, i.bodyId.startsWith('page-')], name).toEqual([name === 'login_index' ? 1 : 333286, 'REDACTED', 'https://moodle.taltech.ee', name === 'login_index', true]);
  const doc = captureDoc(name);
  const route = resolveRoute({ path: new URL(captureMeta(name).url).pathname, bodyId: doc.body.id, bodyClasses: Array.from(doc.body.classList) });
  expect(route.key, name).not.toBe('none');
  if (route.mode === 'skin') expect(parseSkinPage(doc).title.length, `${name} has a title for the band`).toBeGreaterThan(0);
}
