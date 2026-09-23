const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ channel: 'msedge', headless: true });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  p.on('console', m => m.type()==='error' && errs.push(m.text()));
  p.on('pageerror', e => errs.push('pageerror: '+e.message));
  await p.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
  console.log('url:', p.url());
  console.log('inputs:', await p.evaluate(() => [...document.querySelectorAll('input')].map(i => ({name:i.name,type:i.type,id:i.id,ph:i.placeholder}))));
  console.log('buttons:', await p.evaluate(() => [...document.querySelectorAll('button')].map(b => b.textContent.trim()).slice(0,10)));
  console.log('errors:', errs.slice(0,5));
  await p.screenshot({ path: 'C:/Users/Selvaraj/AppData/Local/Temp/claude/e--newproject/19032b65-43ae-4ad8-9fc1-3ae86fcbe8a6/scratchpad/shots/login.png' });
  await b.close();
})();
