import { h, render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { gridColumns } from '../../src/actions/wskeys';
import { softTarget } from '../../src/content/softnav';
import { Segmented } from '../../src/ui/components/Segmented';

const CTX = { origin: 'https://moodle.taltech.ee', wwwroot: 'https://moodle.taltech.ee', routeModes: {} };
const u = (p: string) => new URL(p, 'https://moodle.taltech.ee');

describe('course navigation targets', () => {
  it('pages Moodle renders itself are hard loads; the grades overview is a view of ours', () => {
    expect(softTarget(u('/user/index.php?id=7'), CTX)).toBeNull();
    expect(softTarget(u('/grade/report/user/index.php?id=7'), CTX)).toBeNull();
    expect(softTarget(u('/competency/coursecompetencies.php?id=7'), CTX)).toBeNull();
    expect(softTarget(u('/grade/report/overview/index.php'), CTX)?.key).toBe('grades');
  });
});

describe('course grid keyboard step', () => {
  it('counts the cards that share the first row', () => {
    expect(gridColumns([])).toBe(1);
    expect(gridColumns([{ offsetTop: 0 }])).toBe(1);
    expect(gridColumns([{ offsetTop: 10 }, { offsetTop: 10 }, { offsetTop: 10 }, { offsetTop: 200 }])).toBe(3);
    expect(gridColumns([{ offsetTop: 0 }, { offsetTop: 0 }])).toBe(2);
    expect(gridColumns([{ offsetTop: 0 }, { offsetTop: 120 }])).toBe(1);
  });
});

describe('segmented slide', () => {
  let host: HTMLDivElement;
  afterEach(() => {
    act(() => render(null, host));
    host.remove();
  });
  it('renders the sliding highlight only when asked', () => {
    host = document.createElement('div');
    document.body.append(host);
    const opts = [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] as const;
    act(() => render(h(Segmented, { value: 'a', options: opts, onChange: () => undefined, label: 'x', slide: true }), host));
    expect(host.querySelector('.kex-segmented--slide .kex-segmented__thumb')).not.toBeNull();
    act(() => render(h(Segmented, { value: 'a', options: opts, onChange: () => undefined, label: 'x' }), host));
    expect(host.querySelector('.kex-segmented__thumb')).toBeNull();
  });
});
