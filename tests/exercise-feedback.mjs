export async function videoDbChecks(db, ids, ok) {
  const { coach: C, ana: A, bo: B } = ids
  async function as(who, q, params = []) {
    await db.exec('reset role')
    await db.query("select set_config('request.jwt.claims', $1, false)", [who ? JSON.stringify({ sub: who, role: 'authenticated' }) : ''])
    await db.exec(who ? 'set role authenticated' : 'set role anon')
    try { return { rows: (await db.query(q, params)).rows } }
    catch (e) { return { error: e.message } }
    finally { await db.exec('reset role') }
  }
  const cw = (await db.query('select id,workout_id from client_workouts where client_id=$1 limit 1', [A])).rows[0]
  const item = (await db.query("insert into workout_items(workout_id,exercise_name) values($1,'Technique test') returning id", [cw.workout_id])).rows[0].id
  const id = '55555555-5555-5555-5555-555555555555', path = A + '/' + id + '/clip.webm'
  const insert = (who, client = A, wi = item, name = 'Technique test', rowId = crypto.randomUUID()) => as(who,
    'insert into exercise_videos(id,client_id,client_workout_id,workout_item_id,exercise_name,video_path) values($1,$2,$3,$4,$5,$6) returning id',
    [rowId, client, cw.id, wi, name, client + '/' + rowId + '/clip.webm'])
  ok(!(await insert(A, A, item, 'Technique test', id)).error, 'technique: client attaches clip to own assigned exercise')
  ok(!!(await insert(B, B)).error, 'technique: cannot attach to another client workout')
  ok(!!(await insert(B)).error, 'technique: cannot spoof owner')
  ok(!!(await insert(A, A, crypto.randomUUID())).error, 'technique: item must belong to assigned workout')
  ok(!!(await insert(A, A, item, 'Fake exercise')).error, 'technique: exercise snapshot must match assigned item')
  ok((await as(B, 'select * from exercise_videos where id=$1', [id])).rows.length === 0, 'technique: other client cannot read request')
  ok((await as(C, 'select * from exercise_videos where id=$1', [id])).rows.length === 1, 'technique: coach reads request')
  ok(!!(await as(null, 'select * from exercise_videos')).error, 'technique: anonymous cannot read requests')
  ok(!!(await as(A, "update exercise_videos set question='Changed' where id=$1", [id])).error, 'technique: client cannot rewrite submitted request')
  ok(!!(await as(A, 'delete from exercise_videos where id=$1', [id])).error, 'technique: API cannot delete request history')
  const audio = A + '/' + id + '/voice.webm'
  const review = (who, text = 'Good control', voice = audio) => as(who,
    'insert into exercise_video_reviews(video_id,feedback,audio_path) values($1,$2,$3)', [id, text, voice])
  ok(!!(await review(A)).error, 'technique: client cannot create coach feedback')
  ok(!(await review(C)).error, 'technique: coach saves written and voice feedback')
  ok((await as(A, 'select * from exercise_video_reviews where video_id=$1', [id])).rows.length === 1, 'technique: client reads own review')
  ok((await as(B, 'select * from exercise_video_reviews where video_id=$1', [id])).rows.length === 0, 'technique: other client cannot read review')
  ok(!!(await as(null, 'select * from exercise_video_reviews')).error, 'technique: anonymous cannot read reviews')
  ok((await as(A, "update exercise_video_reviews set feedback='Spoof' where video_id=$1 returning *", [id])).rows?.length === 0, 'technique: client cannot alter coach review')
  ok((await as(C, "update exercise_video_reviews set feedback='Updated' where video_id=$1 returning *", [id])).rows?.length === 1, 'technique: coach can update feedback')
  ok(!!(await as(C, "update exercise_video_reviews set feedback='', audio_path=null where video_id=$1", [id])).error, 'technique: empty review rejected')
  const storageInsert = (who, bucket, name) => as(who, 'insert into storage.objects(bucket_id,name) values($1,$2)', [bucket, name])
  ok(!(await storageInsert(A, 'exercise-videos', path)).error, 'technique: client uploads own clip')
  ok(!!(await storageInsert(B, 'exercise-videos', A + '/other/clip.webm')).error, 'technique: cannot upload to another folder')
  ok((await as(B, "select * from storage.objects where bucket_id='exercise-videos'")).rows.length === 0, 'technique: other client cannot read stored clip')
  ok((await as(C, "select * from storage.objects where bucket_id='exercise-videos'")).rows.length === 1, 'technique: coach reads stored clip')
  ok(!!(await storageInsert(A, 'exercise-voice', audio)).error, 'technique: client cannot upload coach voice feedback')
  ok(!(await storageInsert(C, 'exercise-voice', audio)).error, 'technique: coach uploads voice feedback')
  ok((await as(A, "select * from storage.objects where bucket_id='exercise-voice'")).rows.length === 1, 'technique: client reads own voice feedback')
  ok((await as(B, "select * from storage.objects where bucket_id='exercise-voice'")).rows.length === 0, 'technique: other client cannot read voice feedback')
  ok((await as(A, "delete from storage.objects where bucket_id='exercise-voice' returning *")).rows.length === 0, 'technique: client cannot remove coach voice recording')
  const buckets = (await db.query("select id,public,file_size_limit from storage.buckets where id in ('exercise-videos','exercise-voice')")).rows
  ok(buckets.length === 2 && buckets.every(b => !b.public), 'technique: both media buckets private')
  ok(Number(buckets.find(b => b.id === 'exercise-videos').file_size_limit) === 20971520 && Number(buckets.find(b => b.id === 'exercise-voice').file_size_limit) === 5242880, 'technique: server upload limits configured')
  await db.query('delete from workout_items where id=$1', [item])
  ok((await as(A, 'select id from exercise_videos where id=$1', [id])).rows.length === 1, 'technique: exercise template edits preserve submitted clips')
  await db.query('delete from exercise_videos where id=$1', [id])
  ok((await db.query('select * from exercise_video_reviews where video_id=$1', [id])).rows.length === 0, 'technique: request deletion cascades review')
  await db.exec("delete from storage.objects where bucket_id in ('exercise-videos','exercise-voice')")
}

export async function videoBrowserChecks({ open, sql, IDS, BASE, shot, clean, ok }) {
  await sql("insert into client_health(client_id,allergies,health_conditions,consent_data,consent_health,consent_accurate,consent_version,consented_at) values($1,'None','None',true,true,true,1,now())", [IDS.ana])
  const w = (await sql("insert into workouts(name,created_by) values('Technique review test',$1) returning id", [IDS.coach]))[0].id
  const item = (await sql("insert into workout_items(workout_id,exercise_name,sets,reps) values($1,'Technique squat test',1,'5') returning id", [w]))[0].id
  const cw = (await sql("insert into client_workouts(client_id,workout_id,date,status) values($1,$2,current_date,'done') returning id", [IDS.ana, w]))[0].id
  const client = await open('ana')
  await client.page.goto(BASE + '/workout/' + cw, { waitUntil: 'networkidle' })
  await client.page.getByRole('button', { name: 'Technique feedback for Technique squat test', exact: true }).click()
  const sheet = client.page.getByRole('dialog', { name: 'Technique feedback: Technique squat test', exact: true })
  await sheet.getByLabel('Technique video').setInputFiles({ name: 'bad.txt', mimeType: 'text/plain', buffer: Buffer.from('bad') })
  await sheet.getByText('Choose an MP4, MOV or WebM video.', { exact: true }).waitFor()
  ok(await sheet.getByRole('button', { name: 'Send technique video', exact: true }).isDisabled(), 'technique: invalid upload rejected before sending')
  const bytes = await client.page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 64
    const context = canvas.getContext('2d')
    const media = canvas.captureStream(10)
    const recorder = new MediaRecorder(media, { mimeType: 'video/webm' })
    const parts = []
    return await new Promise(resolve => {
      recorder.ondataavailable = e => { if (e.data.size) parts.push(e.data) }
      recorder.onstop = async () => { media.getTracks().forEach(t => t.stop()); resolve(Array.from(new Uint8Array(await new Blob(parts, { type: 'video/webm' }).arrayBuffer()))) }
      recorder.start()
      const draw = setInterval(() => { context.fillStyle = '#d7b978'; context.fillRect(0, 0, 64, 64) }, 50)
      setTimeout(() => { clearInterval(draw); recorder.stop() }, 500)
    })
  })
  await sheet.getByLabel('Technique video').setInputFiles({ name: 'technique.webm', mimeType: 'video/webm', buffer: Buffer.from(bytes) })
  await sheet.getByLabel('What would you like feedback on?').fill('Please check my squat depth.')
  await sheet.getByRole('button', { name: 'Send technique video', exact: true }).click()
  await sheet.getByText('Awaiting technique review', { exact: true }).waitFor()
  const video = (await sql('select * from exercise_videos where client_workout_id=$1', [cw]))[0]
  ok(video.workout_item_id === item && video.question === 'Please check my squat depth.', 'technique: request attached to correct workout and exercise')
  await sheet.getByRole('button', { name: 'Load technique video', exact: true }).click()
  await client.page.waitForFunction(() => (document.querySelector('video')?.readyState ?? 0) >= 1)
  ok(true, 'technique: private uploaded video decodes through signed URL')
  const signed = await sheet.locator('video').getAttribute('src')
  ok((await fetch(signed.replace(/token=[^&]+/, 'token=invalid'))).status === 403, 'technique: invalid signed URL denied')
  ok(await client.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'technique: client sheet fits phone width')
  await shot(client.page, 'technique-client-upload-phone')
  clean('technique client upload', client.errors)
  await client.ctx.close()

  const coach = await open('coach')
  await coach.ctx.grantPermissions(['microphone'])
  const queue = coach.page.getByRole('region', { name: 'Technique reviews', exact: true })
  await queue.getByRole('link', { name: /Technique squat test/ }).click()
  const review = coach.page.getByRole('dialog', { name: 'Technique feedback: Technique squat test', exact: true })
  await review.getByLabel('Written feedback').waitFor()
  await review.getByLabel('Written feedback').fill('Good control. Keep the same depth and brace before each rep.')
  await review.getByRole('button', { name: 'Record voice note', exact: true }).click()
  await review.getByText('Recording, up to 60 seconds...', { exact: true }).waitFor({ timeout: 10000 }).catch(async error => {
    console.error('Recording diagnostic:', await review.ariaSnapshot())
    console.error('Recorder probe:', await coach.page.evaluate(async () => {
      const result = { stage: 'microphone', attempts: [] }
      let stream
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        result.stage = 'encoder'; result.tracks = stream.getTracks().map(t => ({ kind: t.kind, readyState: t.readyState }))
        for (const type of ['audio/mp4','audio/webm','audio/ogg']) {
          try {
            const recorder = new MediaRecorder(stream, { mimeType: type })
            recorder.start(); result.attempts.push({ type, state: recorder.state }); recorder.stop()
          } catch (e) { result.attempts.push({ type, name: e.name, error: e.message }) }
        }
      } catch (e) { result.name = e.name; result.error = e.message }
      finally { stream?.getTracks().forEach(t => t.stop()) }
      return result
    }))
    throw error
  })
  await coach.page.waitForTimeout(600) // collect real audio from Chromium's fake microphone
  await review.getByRole('button', { name: 'Stop recording', exact: true }).click()
  await review.getByLabel('Voice note preview').waitFor()
  await coach.page.waitForFunction(() => (document.querySelector('audio[aria-label="Voice note preview"]')?.readyState ?? 0) >= 1)
  ok(true, 'technique: microphone recording produces playable voice preview')
  await review.getByRole('button', { name: 'Save technique feedback', exact: true }).click()
  await review.getByText('Feedback saved and visible to your client.', { exact: true }).waitFor()
  const response = (await sql('select * from exercise_video_reviews where video_id=$1', [video.id]))[0]
  ok(response.feedback.startsWith('Good control') && response.audio_path.startsWith(IDS.ana + '/' + video.id + '/'), 'technique: written and voice feedback saved together')
  ok(await coach.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'technique: recording controls fit phone width')
  await shot(coach.page, 'technique-coach-voice-phone')
  await coach.page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await coach.page.getByRole('region', { name: 'Technique reviews', exact: true }).getByText('No pending reviews among the latest 100 clips.', { exact: true }).waitFor()
  ok(true, 'technique: reviewed clip leaves dashboard queue')
  clean('technique coach review', coach.errors)
  await coach.ctx.close()

  const feedback = await open('ana')
  await feedback.page.goto(BASE + '/workout/' + cw + '?feedback=' + video.id, { waitUntil: 'networkidle' })
  const result = feedback.page.getByRole('dialog', { name: 'Technique feedback: Technique squat test', exact: true })
  await result.getByText(response.feedback, { exact: true }).waitFor()
  await result.getByRole('button', { name: 'Load voice feedback', exact: true }).click()
  await feedback.page.waitForFunction(() => (document.querySelector('audio')?.readyState ?? 0) >= 1)
  ok(true, 'technique: client can play private coach voice feedback after reload')
  ok(await result.getByRole('button', { name: 'Save technique feedback', exact: true }).count() === 0, 'technique: client cannot edit coach response')
  await shot(feedback.page, 'technique-client-feedback-phone')
  clean('technique client feedback', feedback.errors)
  await feedback.ctx.close()
  await sql('delete from client_workouts where id=$1', [cw])
  await sql('delete from workouts where id=$1', [w])
  await sql('delete from client_health where client_id=$1', [IDS.ana])
  await sql("delete from storage.objects where bucket_id in ('exercise-videos','exercise-voice')")
}