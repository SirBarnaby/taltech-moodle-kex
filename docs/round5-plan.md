# Round 5 plan (user feedback 2026-10-19)

Planned on Opus 5.5 (effort high); implemented on Sonnet 5.5 (effort high), switched in the thread so the change is visible.

## Causes (checked in code and in the lab)

1. **Shader pops in ~1 s after the text (course heroes).** `swapView` unmounts and remounts the route on every course switch, so `Hero` runs `effects.register` again: a new WebGL2 context and a new shader compile each time, and the old context is destroyed (`loseContext`). Until the compile finishes the hero shows the flat CSS fallback with the canvas `display:none`; when it is ready the canvas switches on in one frame. On the user's Windows GPU the compile takes about a second; in the lab (software GL in a container) it is near-instant, which is why tests never saw it.
2. **Login "shader shifts / compresses" after ~1 s.** Same compile delay, but the default fallback is `hero-fallback.webp` (a picture framed for the wide 1339x253 hero) at `cover` on a tall half-width panel. When the live shader takes over, the framing jumps.
3. **Accent words.** They should keep their later timing but slide in like the white words.
4. **Scroll to top "sometimes" not smooth.** Soft navigation (app views) always scrolls under the page fade (verified in the lab from the sidebar and My courses). Hard loads never do: every click from a Moodle-rendered page (Participants, Grades, activities: `canSoft()` is false there) and every soft-navigation fallback is a full page load that just starts at the top. That is the "sometimes".

## Fix

1. **One persistent hero canvas** (`src/fx/heroCanvas.ts`): a module singleton canvas + effects handle. `Hero` and the login `Art` render a host element and adopt the canvas on mount, detach it on unmount (no dispose). Seed, school style and intensity change through a new `EffectHandle.update(opts)` (`RibbonsRenderer.setOptions`). The canvas is created and the shader compile started as early as possible at boot (`warmHeroCanvas()`), before the view mounts.
2. **Fade, never pop**: the renderer marks `data-drawn` on the canvas after its first real frame. CSS: canvas `opacity:0` until `[data-drawn]`, then `opacity:1` with a 280 ms ease-out transition; the fallback background stays underneath. A canvas moved into a new hero is already drawn, so it is simply there. Reduced motion: no transition.
3. **Login fallback** = plain `var(--kex-hero-bg)` gradient (no wide picture), plus the same fade.
4. **Accent line**: `slideUp` gets `lineDelay` (extra seconds per line). Hero and login pass `[0, MOTION.accentDelay/1000]` (200 ms). Every piece still slides; durations stay under 300 ms.
5. **Scroll across hard loads**: before any hard navigation started by a click (and the soft-navigation fallback), store `{y, t}` in `sessionStorage` (`kex-nav-from`). On the next page, when it is fresh (< 4 s) and motion is full, run the same page enter (fade + slide down from `-min(y,160)` px, 240 ms) on `.kex-main`. Soft path: the enter step retries for up to 3 frames when the new `.kex-main` is not there yet, instead of giving up.

## Check (lab, Firefox, 960 and 1585 px)

- Course switch: same canvas element before and after, `data-drawn` already set, no new WebGL context (`window.__kexRibbonsInits` stays 1).
- Accent pieces animate and start about 200 ms after the first white piece.
- Login: no picture fallback; canvas fades in.
- From Participants, click another course in the sidebar: after load `.kex-main` has the enter animation.
