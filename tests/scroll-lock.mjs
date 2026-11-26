// Opening and closing sheets must always leave the page scrollable.
export async function scrollLockChecks({ open, BASE, ok }) {
  console.log('Scroll lock')
  const coach = await open('coach', { w: 1280, h: 900 })
  await coach.page.goto(BASE + '/community?tab=challenges', { waitUntil: 'networkidle' })
  const overflow = () => coach.page.evaluate(() => document.body.style.overflow)
  await coach.page.getByRole('button', { name: 'Challenge ideas' }).click()
  ok(await overflow() === 'hidden', 'scroll: the page is locked while a sheet is open')
  await coach.page.keyboard.press('Escape')
  await coach.page.locator('.sheet').waitFor({ state: 'hidden' })
  ok(await overflow() === '', 'scroll: the page scrolls again after the sheet closes')
}
