export async function notificationBrowserChecks({ open, sql, IDS, BASE, shot, clean, ok }) {
  await sql("insert into client_health(client_id,allergies,health_conditions,consent_data,consent_health,consent_accurate,consent_version,consented_at) values($1,'None','None',true,true,true,1,now())", [IDS.ana])
  const client = await open('ana')
  const { page } = client
  // Test browser subscription APIs and real database writes without sending any notification.
  await page.addInitScript(() => {
    const state = window.__pushTest = { live: sessionStorage.getItem('push-test-live') === '1', permission: 'granted', readError: false, subscribeError: false, unsubscribeError: false, missingRegistration: false, neverReady: false, subscribeCalls: 0, unsubscribeCalls: 0, keyLength: 0 }
    const subscription = {
      endpoint: 'https://push.test/device-under-test',
      toJSON: () => ({ endpoint: subscription.endpoint, keys: { p256dh: 'fake-device-key', auth: 'fake-device-auth' } }),
      unsubscribe: async () => {
        state.unsubscribeCalls++
        if (state.unsubscribeError) throw new Error('Cannot unsubscribe')
        state.live = false; sessionStorage.removeItem('push-test-live'); return true
      },
    }
    const reg = { pushManager: {
      getSubscription: async () => { if (state.readError) throw new Error('Browser unavailable'); return state.live ? subscription : null },
      subscribe: async options => {
        state.subscribeCalls++; state.keyLength = options.applicationServerKey.byteLength
        if (state.subscribeError) throw new DOMException('Unavailable', 'AbortError')
        state.live = true; sessionStorage.setItem('push-test-live', '1'); return subscription
      },
    } }
    Object.defineProperty(Notification, 'permission', { configurable: true, get: () => state.permission })
    Object.defineProperty(Notification, 'requestPermission', { configurable: true, value: async () => state.permission })
    Object.defineProperty(navigator.serviceWorker, 'getRegistration', { configurable: true, value: async () => state.missingRegistration ? undefined : reg })
    Object.defineProperty(navigator.serviceWorker, 'ready', { configurable: true, get: () => state.neverReady ? new Promise(() => {}) : Promise.resolve(reg) })
  })
  const key = Buffer.from([4, ...Array(64).fill(1)]).toString('base64url')
  await page.route('**/rest/v1/rpc/push_public_key', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(key) }))
  await page.goto(BASE + '/account', { waitUntil: 'networkidle' })
  const notifications = page.getByRole('region', { name: 'Notifications', exact: true })
  const on = notifications.getByRole('button', { name: 'Turn on notifications', exact: true })
  const off = notifications.getByRole('button', { name: 'Turn off on this device', exact: true })
  const active = notifications.getByText('Notifications are on for this device.', { exact: true })
  const set = patch => page.evaluate(p => Object.assign(window.__pushTest, p), patch)
  await on.waitFor()
  // A browser subscription belonging to another account must not be labelled on for this one.
  await sql("insert into push_subscriptions(user_id,endpoint,p256dh,auth) values($1,'https://push.test/device-under-test','x','y')", [IDS.bo])
  await set({ live: true })
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await on.waitFor()
  ok(await active.count() === 0, 'push: browser subscription alone is not confirmation for the signed-in account')
  await sql("delete from push_subscriptions where endpoint='https://push.test/device-under-test'")
  await set({ live: false, subscribeError: true })
  await on.click()
  await notifications.getByText('Could not set up notifications on this device. Please retry.', { exact: true }).waitFor()
  ok(await on.isEnabled(), 'push: subscribe exception releases the button for retry')
  await set({ subscribeError: false })
  await page.route('**/rest/v1/push_subscriptions*', route => route.request().method() === 'POST'
    ? route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"Offline"}' }) : route.continue())
  await on.click()
  await notifications.getByText('Could not save this device for notifications. Please retry when connected.', { exact: true }).waitFor()
  ok(await active.count() === 0 && await page.evaluate(() => !window.__pushTest.live), 'push: failed server save does not report on and cleans up new browser subscription')
  ok((await sql('select * from push_subscriptions where user_id=$1', [IDS.ana])).length === 0, 'push: failed registration creates no record')
  await page.unroute('**/rest/v1/push_subscriptions*')
  const before = await page.evaluate(() => window.__pushTest.subscribeCalls)
  await on.evaluate(button => { button.click(); button.click() })
  await active.waitFor()
  ok(await page.evaluate(() => window.__pushTest.subscribeCalls) === before + 1, 'push: rapid duplicate enable clicks subscribe once')
  ok(await page.evaluate(() => window.__pushTest.keyLength) === 65, 'push: VAPID public key is decoded into subscription bytes')
  ok((await sql('select * from push_subscriptions where user_id=$1', [IDS.ana])).length === 1, 'push: successful enable registers the current account')
  await page.reload({ waitUntil: 'networkidle' })
  await active.waitFor(); ok(true, 'push: confirmed state persists after reopening Account')
  await page.route('**/rest/v1/push_subscriptions*', route => route.request().method() === 'GET'
    ? route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"Offline"}' }) : route.continue())
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await notifications.getByRole('button', { name: 'Retry notification settings', exact: true }).waitFor()
  ok(await active.count() === 0, 'push: failed verification reports unknown state instead of false on')
  await page.unroute('**/rest/v1/push_subscriptions*')
  await notifications.getByRole('button', { name: 'Retry notification settings', exact: true }).click()
  await active.waitFor()
  await page.route('**/rest/v1/push_subscriptions*', route => route.request().method() === 'DELETE'
    ? route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"Offline"}' }) : route.continue())
  await off.click()
  await notifications.getByText('Could not turn off notifications. Please retry when connected.', { exact: true }).waitFor()
  ok(await off.isEnabled() && await active.count() === 1, 'push: failed disable remains accurately on and allows retry')
  await page.unroute('**/rest/v1/push_subscriptions*')
  await sql("insert into push_subscriptions(user_id,endpoint,p256dh,auth) values($1,'https://push.test/other-device','x','y')", [IDS.ana])
  await set({ unsubscribeError: true })
  await off.click(); await on.waitFor()
  ok(await active.count() === 0 && (await sql("select * from push_subscriptions where endpoint='https://push.test/device-under-test'")).length === 0, 'push: server removal confirms off even if browser cleanup fails')
  ok((await sql("select * from push_subscriptions where endpoint='https://push.test/other-device'")).length === 1, 'push: disabling this device preserves another device')
  await set({ unsubscribeError: false, live: false, readError: true })
  await page.evaluate(() => { sessionStorage.removeItem('push-test-live'); document.dispatchEvent(new Event('visibilitychange')) })
  await notifications.getByRole('button', { name: 'Retry notification settings', exact: true }).waitFor()
  await set({ readError: false })
  await notifications.getByRole('button', { name: 'Retry notification settings', exact: true }).click()
  await on.waitFor(); ok(true, 'push: browser read failures recover through retry')
  await set({ permission: 'denied' })
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await notifications.getByText('Notifications are blocked for this app. Allow them in your phone or browser settings, then come back.', { exact: true }).waitFor()
  await set({ permission: 'granted' })
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await on.waitFor(); ok(true, 'push: returning from permission settings refreshes the state')
  await page.clock.install()
  await set({ missingRegistration: true, neverReady: true })
  await on.click()
  await notifications.getByRole('button', { name: 'Updating notifications...', exact: true }).waitFor()
  await page.clock.fastForward(11000)
  await notifications.getByText('Notification setup is taking too long. Reload the app and retry.', { exact: true }).waitFor()
  ok(await on.isEnabled(), 'push: missing service worker times out and releases controls')
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'push: notification controls fit phone width')
  await shot(page, 'notification-retry-phone')
  client.errors.splice(0, client.errors.length, ...client.errors.filter(e => !/503/.test(e)))
  clean('notification setup recovery', client.errors)
  await client.ctx.close()
  await sql('delete from push_subscriptions where user_id=$1', [IDS.ana])
  await sql('delete from client_health where client_id=$1', [IDS.ana])
}
