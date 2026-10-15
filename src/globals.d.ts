/** Injected by esbuild `define` (scripts/build.mjs). */
declare const __DEBUG__: boolean;
declare const __VERSION__: string;

declare module '*.glsl' {
  const source: string;
  export default source;
}
declare module '*.svg' {
  const source: string;
  export default source;
}
