// Chip rows that overflow can be scrolled sideways: a visible scrollbar with a mouse, a swipe on a phone.
export async function chipScrollChecks({ open, BASE, shot, ok }) {
  console.log('Chip scroll')
  for (const [label, size] of [['desktop', { w: 1280, h: 900 }], ['phone', { w: 390, h: 844 }]]) {
    const coach = await open('coach', size)
    await coach.page.goto(BASE + '/library?tab=exercises&equip=Dumbbells', { waitUntil: 'networkidle' })
    const row = coach.page.locator('.chips[aria-label="Equipment"]').first()
    await row.waitFor()
    const m = await row.evaluate(el => { const before = el.scrollLeft; el.scrollLeft = 200; return { over: el.scrollWidth > el.clientWidth, moved: el.scrollLeft > before, bar: el.offsetHeight - el.clientHeight } })
    ok(m.over && m.moved, `chips (${label}): the equipment row overflows and scrolls sideways`)
    if (label === 'desktop') {
      await row.evaluate(el => { el.scrollLeft = 0 })
      const b = await row.boundingBox()
      await coach.page.mouse.move(b.x + b.width - 40, b.y + b.height / 2)
      await coach.page.mouse.down(); await coach.page.mouse.move(b.x + 60, b.y + b.height / 2, { steps: 8 }); await coach.page.mouse.up()
      ok(await row.evaluate(el => el.scrollLeft) > 100, 'chips (desktop): dragging the row with the mouse scrolls it')
    }
    await row.evaluate(el => { el.scrollLeft = 0 })
    await shot(coach.page, 'chips-' + label)
    await coach.ctx.close()
  }
}
