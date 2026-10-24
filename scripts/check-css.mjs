// CSS sanity check, run before every build: a stylesheet mistake must fail the build instead of silently switching rules off.
//   - every file parses (no unclosed block);
//   - @keyframes only at the top level (browsers ignore keyframes nested inside a style rule);
//   - no nested rule that restarts at #kex-root or :root without `&` (it would only match #kex-root inside #kex-root);
//   - every kex- animation name that is used is defined somewhere.
import postcss from 'postcss';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function cssFiles(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await cssFiles(p)));
    else if (e.name.endsWith('.css')) out.push(p);
  }
  return out;
}

const insideRule = (node) => {
  for (let p = node.parent; p && p.type !== 'root'; p = p.parent) if (p.type === 'rule') return true;
  return false;
};

export async function checkCss(dir = path.join(root, 'src/styles')) {
  const problems = [];
  const defined = new Set();
  const used = [];
  for (const file of await cssFiles(dir)) {
    const rel = path.relative(root, file);
    let tree;
    try {
      tree = postcss.parse(await readFile(file, 'utf8'), { from: file });
    } catch (e) {
      problems.push(`${rel}:${e.line ?? '?'}: ${e.reason ?? e.message}`);
      continue;
    }
    tree.walkAtRules('keyframes', (a) => {
      if (insideRule(a)) problems.push(`${rel}:${a.source.start.line}: @keyframes ${a.params} is nested inside a rule (ignored by browsers)`);
      else defined.add(a.params.trim());
    });
    tree.walkRules((r) => {
      if (r.parent.type !== 'rule') return;
      for (const sel of r.selectors) {
        if (/^(#kex-root|:root)\b/.test(sel.trim()) && !sel.includes('&')) {
          problems.push(`${rel}:${r.source.start.line}: nested selector "${sel.trim().slice(0, 60)}" restarts at the root and can never match`);
        }
      }
    });
    tree.walkDecls(/^animation(-name)?$/, (d) => {
      for (const tok of d.value.split(/[\s,]+/)) if (/^kex-[\w-]+$/.test(tok)) used.push([tok, `${rel}:${d.source.start.line}`]);
    });
  }
  for (const [name, where] of used) if (!defined.has(name)) problems.push(`${where}: animation "${name}" has no @keyframes`);
  return problems;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const problems = await checkCss();
  if (problems.length) {
    console.error(`CSS check failed:\n  ${problems.join('\n  ')}`);
    process.exit(1);
  }
  console.log('CSS check passed');
}
