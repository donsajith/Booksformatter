import asyncio, sys, os
from playwright.async_api import async_playwright
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT=os.path.join(ROOT,'test','out'); os.makedirs(OUT, exist_ok=True)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width':1440,'height':900}, accept_downloads=True)
        page = await ctx.new_page()
        logs=[]
        page.on('console', lambda m: logs.append(m.type+': '+m.text) if m.type in ('error','warning') else None)
        page.on('pageerror', lambda e: logs.append('PAGEERROR: '+str(e)))
        await page.goto('file://'+ROOT+'/index.html')
        await page.wait_for_selector('body.ready', timeout=20000)
        await page.wait_for_timeout(1200)
        await page.screenshot(path=OUT+'/ui-1.png')
        for tab in ['setup','matter','cover','export']:
            await page.click('#tab-'+tab); await page.wait_for_timeout(500)
            await page.screenshot(path=f'{OUT}/ui-{tab}.png')
        if 'build' in sys.argv:
            await page.click('text=Build all files')
            await page.wait_for_selector('text=Save everything', timeout=120000)
            await page.screenshot(path=OUT+'/ui-built.png')
            os.makedirs(OUT+'/dl', exist_ok=True)
            n = await page.locator('.file .btn').count()
            for i in range(n):
                async with page.expect_download() as d:
                    await page.locator('.file .btn').nth(i).click()
                dl = await d.value; await dl.save_as(OUT+'/dl/'+dl.suggested_filename)
            async with page.expect_download() as d:
                await page.click('text=Save everything')
            dl = await d.value; await dl.save_as(OUT+'/dl/'+dl.suggested_filename)
        print('\n'.join(logs[:30]) or 'no console errors')
        await b.close()
asyncio.run(main())
