// test-sky.js — quick Playwright verification
const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const ctx  = await browser.newContext();
    const page = await ctx.newPage();

    const logs = [];
    page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`));

    await page.goto('http://localhost:8765');

    // Wait up to 8 s for the dynamic data load log
    await page.waitForFunction(
        () => typeof app !== 'undefined' && app.stars.length > 100,
        { timeout: 8000 }
    ).catch(() => {});

    // Apply Christchurch via JS (avoids CLI quoting issues)
    await page.evaluate(() =>
        app.applyLocation(-43.5321, 172.6362, 'Christchurch, NZ')
    );
    await page.waitForTimeout(1500);

    // Collect results
    const starCount  = await page.evaluate(() => app.stars.length);
    const conCount   = await page.evaluate(() =>
        app.dynamicConstellations ? app.dynamicConstellations.length : 'fallback'
    );
    const visStars   = await page.evaluate(() => app.stars.filter(s => s.visible).length);
    const visPlanets = await page.evaluate(() => app.planets.filter(p => p.visible).length);

    await page.screenshot({ path: 'sky-christchurch.png', fullPage: false });

    console.log('=== Results ===');
    console.log(`Stars loaded   : ${starCount}`);
    console.log(`Constellations : ${conCount}`);
    console.log(`Stars visible  : ${visStars}`);
    console.log(`Planets visible: ${visPlanets}`);
    console.log('Console messages:');
    logs.forEach(l => console.log(' ', l));

    await browser.close();
})();
