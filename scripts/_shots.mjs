import { chromium } from 'playwright';
import { installKex, login, LAB, iter3Seed } from '../test/harness/kex.ts';
const [,, theme, outdir, ...paths] = process.argv;
const full = process.env.FULL ? true : false;
const b = await chromium.launch();
const ctx = await b.newContext({ viewport:{width:1585,height:992} });
await login(ctx);
const { mkdirSync } = await import('node:fs'); mkdirSync(outdir, {recursive:true});
for (const path of paths) {
  const p = await ctx.newPage();
  p.on('pageerror', e=>console.log(path,'pageerror', e.message));
  p.on('console', m=>{ if(m.type()==='error') console.log(path,'console.error', m.text().slice(0,200)); });
  await installKex(p, iter3Seed({theme, debug:{freezeTime:7.3}}));
  try { await p.goto(LAB+path); } catch (e) { console.log(path, "goto:", e.message.split("\n")[0]); await p.close(); continue; }
  await p.waitForTimeout(3000);
  const name = path.replace(/[^a-z0-9]+/gi,'_').slice(0,60);
  await p.screenshot({ path: `${outdir}/${name}.png`, fullPage: full });
  await p.close();
}
await b.close();
