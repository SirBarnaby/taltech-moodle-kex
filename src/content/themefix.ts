/** TalTech's theme ships `a:hover, a:focus { background-color: transparent !important }`. An !important rule beats any
 *  specificity of ours, so every link-shaped button in KEX (login providers, Open, sidebar rows) lost its fill on hover and focus.
 *  Dropping that one declaration from the live stylesheet is the only fix; the rest of the theme is left alone. */
const LINK_STATE = /^a:(hover|focus)(,\s*a:(hover|focus))*$/;

/** Sheets already looked through: the scan runs once per sheet, however often the mode changes. */
const seen = new WeakSet<CSSStyleSheet>();

/**
 * The theme's sheet has some 25,000 rules and reading a rule's selector is not free, so the scan stops at the first match and
 * runs from the end: the rule sits in Bootstrap's reboot near the end of TalTech's bundle (found after ~1,000 rules, not 25,000).
 */
function drop(rules: CSSRuleList): boolean {
  for (let i = rules.length - 1; i >= 0; i--) {
    const rule = rules[i];
    if (!rule) continue;
    if (rule.type === 1) {
      const style = rule as CSSStyleRule;
      if (style.selectorText.startsWith('a:') && LINK_STATE.test(style.selectorText) && style.style.getPropertyPriority('background-color') === 'important') {
        style.style.removeProperty('background-color');
        return true;
      }
    } else if ('cssRules' in rule && drop((rule as CSSGroupingRule).cssRules)) {
      return true;
    }
  }
  return false;
}

/** Safe to call repeatedly; cross-origin sheets and KEX's own are skipped. */
export function neutralizeThemeLinkBackground(doc: Document = document): void {
  for (const sheet of Array.from(doc.styleSheets)) {
    if (seen.has(sheet)) continue;
    const owner = sheet.ownerNode;
    if (owner instanceof Element && (owner.id.startsWith('kex') || owner.closest('#kex-root'))) continue;
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    // (An empty sheet may still be loading: looked at again on the next call.)
    if (rules.length) seen.add(sheet);
    drop(rules);
  }
}
