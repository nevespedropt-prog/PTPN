const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC', 'base64')

export async function videoThumbChecks({ open, sql, IDS, BASE, shot, clean, ok }) {
  console.log('Workout video thumbnails')
  await sql("insert into client_health(client_id,allergies,health_conditions,consent_data,consent_health,consent_accurate,consent_version,consented_at) values($1,'None','None',true,true,true,1,now()) on conflict (client_id) do nothing", [IDS.ana])
  const id = (await sql("insert into resources(title,url,category) values('Thumb test video','https://www.instagram.com/reel/THUMBTEST01/','Thumb tests') returning id"))[0].id
  try {
    const coach = await open('coach', { w: 390, h: 844 })
    const blankEmbed = r => r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>embed</title>' })
    await coach.page.route(/instagram\.com/, blankEmbed)
    await coach.page.goto(BASE + '/resources', { waitUntil: 'networkidle' })
    ok(await coach.page.locator('.video-thumb').count() === 0, 'thumbnails: videos without a picture keep the numbered tile')
    await coach.page.locator('.video-tile', { hasText: 'Thumb test video' }).click()
    await coach.page.getByRole('button', { name: 'Set thumbnail', exact: true }).waitFor()
    await coach.page.locator('input[aria-label="Thumbnail picture"]').setInputFiles({ name: 'frame.png', mimeType: 'image/png', buffer: PNG })
    await coach.page.getByRole('button', { name: 'Change thumbnail', exact: true }).waitFor()
    const row = (await sql('select thumbnail_path from resources where id=$1', [id]))[0]
    ok(!!row.thumbnail_path && row.thumbnail_path.startsWith(id + '/') && row.thumbnail_path.endsWith('.jpg'), 'thumbnails: the coach can set a picture and it is saved with the video')
    await coach.page.keyboard.press('Escape')
    await coach.page.getByRole('button', { name: 'Close' }).first().click({ timeout: 2000 }).catch(() => {})
    const thumb = coach.page.locator('.video-tile', { hasText: 'Thumb test video' }).locator('img.video-thumb')
    await thumb.waitFor()
    ok(await thumb.evaluate(img => img.complete && img.naturalWidth > 0), 'thumbnails: the tile shows the picture')
    await shot(coach.page, 'video-thumbnails-phone')

    const client = await open('ana', { w: 390, h: 844 })
    await client.page.route(/instagram\.com/, blankEmbed)
    await client.page.goto(BASE + '/resources', { waitUntil: 'networkidle' })
    const clientThumb = client.page.locator('.video-tile', { hasText: 'Thumb test video' }).locator('img.video-thumb')
    await clientThumb.waitFor()
    ok(await clientThumb.evaluate(img => img.complete && img.naturalWidth > 0), 'thumbnails: clients see the picture on the tile')
    await client.page.locator('.video-tile', { hasText: 'Thumb test video' }).click()
    await client.page.getByText('1 of', { exact: false }).waitFor()
    ok(await client.page.getByRole('button', { name: /thumbnail/i }).count() === 0, 'thumbnails: clients cannot change a thumbnail')
    clean('video thumbnails client', client.errors); await client.ctx.close()

    await coach.page.locator('.video-tile', { hasText: 'Thumb test video' }).click()
    await coach.page.getByRole('button', { name: 'Remove thumbnail', exact: true }).click()
    await coach.page.getByRole('button', { name: 'Set thumbnail', exact: true }).waitFor()
    ok((await sql('select thumbnail_path from resources where id=$1', [id]))[0].thumbnail_path === null, 'thumbnails: the coach can remove the picture')
    clean('video thumbnails coach', coach.errors); await coach.ctx.close()
  } finally {
    await sql('delete from resources where id=$1', [id])
    await sql('delete from client_health where client_id=$1', [IDS.ana])
  }
}
