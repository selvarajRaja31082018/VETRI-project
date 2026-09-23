/*
 * Drive the real app in a real browser: log in as the gate operator, open
 * Register Visitor, and capture the rendered page at several widths. Reports
 * layout problems (horizontal overflow, control height drift) and console
 * errors rather than only taking pictures.
 */
'use strict';

const path = require('path');
const { chromium } = require('playwright-core');

const BASE = process.env.UI_BASE || 'http://localhost:5173';
const OUT = process.env.UI_OUT || '.';
const EMAIL = 'gate@vetri.local';
const PASSWORD = 'GatePass@123';

const VIEWPORTS = [
  { name: '1440', width: 1440, height: 900 },
  { name: '1280', width: 1280, height: 860 },
  { name: '1024', width: 1024, height: 820 },
  { name: '768', width: 768, height: 900 },
  { name: '480', width: 480, height: 900 },
  { name: '375', width: 375, height: 860 },
];

(async () => {
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    permissions: ['camera'],
  });

  const consoleErrors = [];
  context.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  context.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));

  const page = await context.newPage();

  /* ---------------------------------------------------------------- login */
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[type="text"], input[name="identifier"], input#identifier', EMAIL).catch(async () => {
    await page.locator('input').first().fill(EMAIL);
  });
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/gate\//, { timeout: 20000 });
  console.log('  logged in ->', page.url());

  /* ------------------------------------------------- register visitor page */
  await page.goto(`${BASE}/gate/visitors/new`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.register-page', { timeout: 15000 });
  await page.waitForTimeout(600);

  const problems = [];

  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(350);

    // Horizontal overflow check.
    const overflow = await page.evaluate(() => {
      const de = document.documentElement;
      const offenders = [];
      if (de.scrollWidth > de.clientWidth + 1) {
        for (const el of document.querySelectorAll('body *')) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.right > de.clientWidth + 1) {
            offenders.push(
              `${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]} right=${Math.round(r.right)}`,
            );
          }
        }
      }
      return { scrollWidth: de.scrollWidth, clientWidth: de.clientWidth, offenders: offenders.slice(0, 6) };
    });
    if (overflow.scrollWidth > overflow.clientWidth + 1) {
      problems.push(
        `[${vp.name}] horizontal overflow ${overflow.scrollWidth} > ${overflow.clientWidth}: ${overflow.offenders.join(' | ')}`,
      );
    }

    await page.screenshot({ path: path.join(OUT, `register-${vp.name}.png`), fullPage: vp.width >= 1024 });
  }

  /* ------------------------------------------------ consistency at desktop */
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(300);

  const metrics = await page.evaluate(() => {
    const heights = (sel) =>
      [...document.querySelectorAll(sel)].map((el) => Math.round(el.getBoundingClientRect().height));
    const camera = document.querySelector('.camera-stage');
    const cameraRect = camera ? camera.getBoundingClientRect() : null;
    return {
      inputHeights: [...new Set(heights('input.field-control'))],
      selectHeights: [...new Set(heights('select.field-control'))],
      buttonHeights: [...new Set(heights('.btn-md'))],
      smallButtonHeights: [...new Set(heights('.btn-sm'))],
      cameraAspect: cameraRect ? +(cameraRect.width / cameraRect.height).toFixed(2) : null,
      cameraIsCircle: camera ? getComputedStyle(camera).borderRadius.includes('50%') : null,
      sections: [...document.querySelectorAll('.card')].length,
      steps: [...document.querySelectorAll('.steps-item')].map((el) => el.textContent.trim()),
      actionBarSticky: (() => {
        const b = document.querySelector('.action-bar');
        return b ? getComputedStyle(b).position : null;
      })(),
      sidebarWidth: (() => {
        const s = document.querySelector('.app-sidebar');
        return s ? Math.round(s.getBoundingClientRect().width) : null;
      })(),
      navIcons: document.querySelectorAll('.app-nav-icon svg').length,
      activeNav: document.querySelector('.app-nav-link.is-active')?.textContent?.trim() || null,
      breadcrumb: document.querySelector('.app-breadcrumb')?.textContent?.trim() || null,
      primaryColour: getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim(),
    };
  });

  console.log('\n  --- rendered metrics ---');
  for (const [k, v] of Object.entries(metrics)) console.log(`  ${k}:`, JSON.stringify(v));

  if (metrics.inputHeights.length > 1) problems.push(`inconsistent input heights: ${metrics.inputHeights}`);
  if (metrics.selectHeights.length > 1) problems.push(`inconsistent select heights: ${metrics.selectHeights}`);
  if (metrics.buttonHeights.length > 1) problems.push(`inconsistent md button heights: ${metrics.buttonHeights}`);
  if (metrics.inputHeights[0] < 44) problems.push(`input height ${metrics.inputHeights[0]} < 44px`);
  if (metrics.primaryColour !== '#7a1024') problems.push(`brand colour changed: ${metrics.primaryColour}`);
  if (metrics.cameraIsCircle) problems.push('camera stage is still circular');

  /* ------------------------------------------------------- camera start UI */
  const startBtn = page.locator('.camera-actions button', { hasText: 'Start camera' }).first();
  if (await startBtn.count()) {
    await startBtn.click();
    await page.waitForTimeout(1800);
    const cam = await page.evaluate(() => {
      const stage = document.querySelector('.camera-stage');
      const video = document.querySelector('.camera-video');
      return {
        live: stage?.classList.contains('is-live') ?? null,
        videoVisible: video ? !video.hidden : null,
        guides: !!document.querySelector('.camera-guides'),
        status: document.querySelector('.camera-panel-top .status-pill')?.textContent?.trim() || null,
        actions: [...document.querySelectorAll('.camera-actions button')].map((b) => b.textContent.trim()),
      };
    });
    console.log('\n  --- camera after start ---');
    console.log('  ', JSON.stringify(cam));
    await page.screenshot({ path: path.join(OUT, 'register-camera-live.png') });
    if (cam.status && cam.status !== 'Live') problems.push(`camera status after start = ${cam.status}`);
  }

  /* --------------------------------------------------------- mobile drawer */
  await page.setViewportSize({ width: 375, height: 860 });
  await page.waitForTimeout(300);
  const toggle = page.locator('.app-nav-toggle');
  if (await toggle.count()) {
    await toggle.click();
    await page.waitForTimeout(400);
    const drawer = await page.evaluate(() => {
      const s = document.querySelector('.app-sidebar');
      const scrim = document.querySelector('.app-scrim');
      return {
        open: s?.classList.contains('is-open'),
        x: s ? Math.round(s.getBoundingClientRect().x) : null,
        scrimVisible: scrim ? getComputedStyle(scrim).opacity : null,
        bodyLocked: getComputedStyle(document.body).overflow,
      };
    });
    console.log('\n  --- mobile drawer ---');
    console.log('  ', JSON.stringify(drawer));
    await page.screenshot({ path: path.join(OUT, 'register-drawer.png') });
    if (drawer.x !== 0) problems.push(`drawer not fully open (x=${drawer.x})`);
    if (drawer.bodyLocked !== 'hidden') problems.push(`body scroll not locked behind drawer (${drawer.bodyLocked})`);
  }

  /* ------------------------------------------------------------- report */
  console.log('\n  --- console errors ---');
  const realErrors = consoleErrors.filter((e) => !/favicon|ERR_NETWORK_CHANGED/i.test(e));
  console.log(realErrors.length ? realErrors.slice(0, 8).join('\n  ') : '  none');

  console.log('\n  --- layout problems ---');
  console.log(problems.length ? problems.map((p) => `  ! ${p}`).join('\n') : '  none');

  await browser.close();
  process.exit(problems.length ? 1 : 0);
})().catch((err) => {
  console.error('INSPECTION FAILED:', err.message);
  process.exit(2);
});
