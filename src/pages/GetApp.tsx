import { Link } from 'react-router-dom'
import { Logo } from '../components/Logo'
import { APK_URL, isInstalled, onIOS, useInstallPrompt } from '../components/Install'

/** Public page: how to get PTPN on a phone. Works signed in or out. */
export default function GetApp() {
  const { canInstall, install } = useInstallPrompt()
  const ios = onIOS()
  const android = /android/i.test(navigator.userAgent)
  const here = isInstalled()
  const order = ios ? ['ios', 'android'] : ['android', 'ios']

  const androidCard = (
    <div className="card col" key="android">
      <h2>Android</h2>
      <div><b>Install from Chrome (recommended)</b></div>
      <div className="mute small">Gets you the app icon, full screen, offline start and notifications.</div>
      {canInstall
        ? <button onClick={install}>Install now</button>
        : <ol className="small" style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7 }}>
            <li>Open this page in Chrome.</li>
            <li>Tap the menu (three dots), then Install app or Add to Home screen.</li>
          </ol>}
      <hr style={{ border: 0, borderTop: '1px solid var(--line, #26262c)', width: '100%' }} />
      <div><b>Or download the app file</b></div>
      <div className="mute small">An .apk you install yourself. It opens the same app, but it does not show notifications.</div>
      <a className="btn block" href={APK_URL} style={{ minHeight: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Download PTPN.apk</a>
      <ol className="small" style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7 }}>
        <li>Open the downloaded file.</li>
        <li>If Android asks, allow your browser to install apps from this source.</li>
        <li>Tap Install, then Open.</li>
      </ol>
    </div>
  )
  const iosCard = (
    <div className="card col" key="ios">
      <h2>iPhone and iPad</h2>
      <div className="mute small">Apple only offers downloads through the App Store, so on iPhone you add the app to your Home Screen. It then works like any other app, including notifications.</div>
      <ol className="small" style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7 }}>
        <li>Open this page in Safari.</li>
        <li>Tap the Share button (the square with an arrow).</li>
        <li>Scroll down and tap Add to Home Screen, then Add.</li>
        <li>Open PTPN from your Home Screen.</li>
      </ol>
    </div>
  )

  return (
    <main className="auth">
      <div className="hero"><Logo size={64} /></div>
      <h1 style={{ textAlign: 'center' }}>Get the app</h1>
      {here && <div className="card"><span className="ok">You are already using the installed app.</span></div>}
      {order.map(k => (k === 'ios' ? iosCard : androidCard))}
      <p className="center small mute">{android || ios ? '' : 'Open this page on your phone to install. '}<Link to="/">Back to PTPN</Link></p>
    </main>
  )
}
