import type { ComponentChildren } from 'preact';
import type { GroupModel } from '../../data/topics';

interface SubsectionCardProps {
  group: GroupModel;
  index: number;
  children: ComponentChildren;
}

/** A subsection (Moodle 4.5 `mod_subsection`): a titled card inside its parent topic, with its own summary and progress. */
export function SubsectionCard({ group, index, children }: SubsectionCardProps) {
  const titleId = `kex-group-${group.section.id}`;
  const { done, total } = group;
  return (
    <li class="kex-group" data-kex-group={group.section.id} data-kex-test={`group-${index}`}>
      <section class="kex-groupcard" aria-labelledby={titleId}>
        <header class="kex-groupcard__head">
          <h4 class="kex-groupcard__title" id={titleId}>{group.title}</h4>
          {total > 0 && (
            <span class="kex-groupcard__progress kex-mono" data-kex-test={`group-${index}-progress`}>
              <span>{done}/{total}</span>
              <span class="kex-groupcard__bar" role="progressbar" aria-labelledby={titleId} aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
                <span style={{ width: `${Math.round((done / total) * 100)}%` }} />
              </span>
            </span>
          )}
        </header>
        {group.summaryHtml && <div class="kex-detail__summary kex-groupcard__summary" dangerouslySetInnerHTML={{ __html: group.summaryHtml }} />}
        {group.rows.length > 0 && <ul class="kex-groupcard__rows">{children}</ul>}
      </section>
    </li>
  );
}
