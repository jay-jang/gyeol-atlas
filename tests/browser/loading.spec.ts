import { test, expect } from '@playwright/test';
import { ready } from './helpers';

test('leaving a detailed reference does not mark unloaded overview layers ready', async ({ page }) => {
  test.setTimeout(90000);
  let release: () => void = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  let requested = false;
  await page.route('**/models/organ.glb', async route => {
    requested = true;
    await gate;
    await route.continue();
  });
  try {
    await page.goto('/'); await ready(page);
    await page.locator('.featured-anatomy > button').filter({has:page.getByText('심장',{exact:true})}).click(); await ready(page);
    await page.getByRole('button',{name:'전신으로 돌아가기',exact:true}).click();
    await expect.poll(()=>requested).toBe(true);
    await expect(page.getByText('해부 모델 로드 완료')).not.toBeVisible({timeout:1500});
    release(); await ready(page);
    await expect.poll(async()=>Number(await page.locator('canvas').getAttribute('data-visible-organ'))).toBeGreaterThan(0);
  } finally {
    release();
  }
});
