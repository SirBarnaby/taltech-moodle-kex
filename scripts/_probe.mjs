// scratch: run a function body in a KEX page. usage: node scripts/_probe.mjs <path> '<js expr evaluated in page>' [theme]
import { chromium } from 'playwright';
import { installKex, login, LAB, iter3Seed } from '../test/harness/kex.ts';
const [,, url, expr, theme='light'] = process.argv;
const b = await chromium.launch();
const ctx = await b.newContext({ viewport:{width:1585,height:992}, colorScheme: theme });
await login(ctx);
const p = await ctx.newPage();
p.on('pageerror', e=>console.log('pageerror', e.message));
p.on('console', m=>{ if(m.type()==='error') console.log('console.error', m.text().slice(0,200)); });
await installKex(p, iter3Seed({theme, debug:{freezeTime:7.3}}));
await p.goto(LAB+url);
await p.waitForTimeout(3000);
console.log(JSON.stringify(await p.evaluate(expr), null, 1));
await b.close();
