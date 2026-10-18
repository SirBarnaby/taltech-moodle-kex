import { describe, expect, it } from 'vitest';
import { neutralizeThemeLinkBackground } from '../../src/content/themefix';

describe('neutralizeThemeLinkBackground', () => {
  it('drops the theme hover/focus background override and keeps the rest of the rule', () => {
    const style = document.createElement('style');
    style.textContent = 'a:hover, a:focus { color: #342b60; background-color: transparent !important; }';
    document.head.append(style);
    neutralizeThemeLinkBackground(document);
    const rule = style.sheet?.cssRules[0] as CSSStyleRule;
    expect(rule.style.getPropertyValue('background-color')).toBe('');
    expect(rule.style.getPropertyValue('color')).not.toBe('');
    style.remove();
  });

  it('leaves unrelated !important backgrounds alone', () => {
    const style = document.createElement('style');
    style.textContent = '.keep { background-color: red !important; }';
    document.head.append(style);
    neutralizeThemeLinkBackground(document);
    const rule = style.sheet?.cssRules[0] as CSSStyleRule;
    expect(rule.style.getPropertyValue('background-color')).toBe('red');
    style.remove();
  });
});
