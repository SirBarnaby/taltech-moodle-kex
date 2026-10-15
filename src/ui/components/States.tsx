import type { ComponentChildren } from 'preact';

/** Empty state: kicker, one title line, text and optionally one button (design-spec §7). */
export function EmptyState({ kicker, title, text, children, tone = 'plain' }: { kicker: string; title: string; text?: string; children?: ComponentChildren; tone?: 'plain' | 'error' }) {
  return (
    <div class={`kex-empty${tone === 'error' ? ' kex-empty--error' : ''}`} role={tone === 'error' ? 'alert' : undefined}>
      <p class="kex-empty__kicker kex-mono">{kicker}</p>
      <h4 class="kex-empty__title">{title}</h4>
      {text && <p class="kex-empty__text">{text}</p>}
      {children && <div class="kex-empty__actions">{children}</div>}
    </div>
  );
}

export function RowSkeleton({ n = 3 }: { n?: number }) {
  return (
    <ul class="kex-rows kex-rows--skel" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <li class="kex-row" key={i}>
          <span class="kex-skel kex-skel--thumb" />
          <div class="kex-row__text">
            <span class="kex-skel kex-skel--line kex-skel--w1" />
            <span class="kex-skel kex-skel--line kex-skel--w2" />
          </div>
          <span class="kex-skel kex-skel--btn" />
        </li>
      ))}
    </ul>
  );
}

export function TopicSkeleton({ n = 6 }: { n?: number }) {
  return (
    <div class="kex-topics kex-topics--skel" aria-hidden="true">
      <p class="kex-topics__label kex-mono">&nbsp;</p>
      <ol class="kex-topics__list">
        {Array.from({ length: n }, (_, i) => (
          <li key={i}>
            <span class="kex-topic">
              <span class="kex-skel kex-skel--num" />
              <span class="kex-skel kex-skel--line" style={{ width: `${48 + ((i * 17) % 36)}%` }} />
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
