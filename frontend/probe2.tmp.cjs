const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ channel: 'msedge', headless: true });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
  await p.locator('button', { hasText: 'Gate Operator' }).first().click();
  await p.waitForTimeout(500);
  console.log('after demo click url:', p.url());
  console.log('filled:', await p.evaluate(() => [...document.querySelectorAll('input')].map(i => i.value)));
  const signIn = p.locator('button', { hasText: /^Sign in$/ });
  if (await signIn.count()) { await signIn.click(); }
  await p.waitForTimeout(3000);
  console.log('after signin url:', p.url());
  console.log('alerts:', await p.evaluate(() => [...document.querySelectorAll('[role="alert"]')].map(e => e.textContent.trim())));
  await b.close();
})();
