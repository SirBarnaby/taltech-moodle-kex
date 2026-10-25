/** Safe to expose in every build: no user identifiers, URLs or private data. */
export function markBuild(): string {
  document.documentElement.dataset.kexBuild = __BUILD_ID__;
  return __BUILD_ID__;
}
