import { chromium } from 'playwright';
import { login, LAB } from '../test/harness/kex.ts';
const [,, method, argsJson = '{}'] = process.argv;
const b = await chromium.launch();
const ctx = await b.newContext();
await login(ctx);
const p = await ctx.newPage();
await p.goto(LAB + '/my/');
const out = await p.evaluate(async ([m, a]) => {
  const sk = window.M.cfg.sesskey;
  const r = await fetch(`/lib/ajax/service.php?sesskey=${sk}&info=${m}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify([{ index: 0, methodname: m, args: JSON.parse(a) }]) });
  return await r.text();
}, [method, argsJson]);
console.log(out);
await b.close();
