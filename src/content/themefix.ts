/** TalTech's theme ships `a:hover, a:focus { background-color: transparent !important }`. An !important rule beats any
 *  specificity of ours, so every link-shaped button in KEX (login providers, Open, sidebar rows) lost its fill on hover and focus.
 *  Dropping that one declaration from the live stylesheet is the only fix; the rest of the theme is left alone. */
const LINK_STATE = /^a:(hover|focus)(,\s*a:(hover|focus))*$/;

function walk(rules: CSSRuleList): void {
  for (const rule of Array.from(rules)) {
    if (rule instanceof CSSStyleRule) {
      if (LINK_STATE.test(rule.selectorText) && rule.style.getPropertyPriority('background-color') === 'important') {
        rule.style.removeProperty('background-color');
      }
    } else if ('cssRules' in rule) {
      walk((rule as CSSGroupingRule).cssRules);
    }
  }
}

/** Safe to call repeatedly; cross-origin sheets are skipped. */
export function neutralizeThemeLinkBackground(doc: Document = document): void {
  for (const sheet of Array.from(doc.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    walk(rules);
  }
}
