import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth'
import { configured, supabase } from './lib/supabase'
import { Logo } from './components/Logo'
import Icon from './components/Icon'
import Login from './pages/Login'
import MyProgramme from './pages/MyProgramme'
import Progress from './pages/Progress'
import Book from './pages/Book'
import Today from './pages/Today'
import Account from './pages/Account'
import CoachClients from './pages/CoachClients'
import CoachSlots from './pages/CoachSlots'

export default function App() {
  const { session, profile, loading } = useAuth()

  if (!configured) {
    return <main className="auth"><div className="card"><h1>Setup needed</h1>
      <p>Copy <code>.env.example</code> to <code>.env</code> and add your Supabase URL and anon key, then restart <code>npm run dev</code>.</p></div></main>
  }
  if (loading) return <main className="auth"><div className="hero"><Logo size={56} /></div><p className="mute" style={{ textAlign: 'center' }}>Loading...</p></main>
  if (!session) return <Login />
  if (!profile) return <main><p className="err">No profile found for this account.</p><button onClick={() => supabase.auth.signOut()}>Sign out</button></main>

  const coach = profile.role === 'coach'
  return (
    <>
      <header className="top">
        <Logo size={32} />
        <span className="who"><span>{profile.full_name || session.user.email}</span></span>
      </header>
      <nav>
        {coach ? (<>
          <NavLink to="/clients"><Icon name="clients" />Clients</NavLink>
          <NavLink to="/slots"><Icon name="slots" />Slots</NavLink>
        </>) : (<>
          <NavLink to="/today"><Icon name="today" />Today</NavLink>
          <NavLink to="/programme"><Icon name="programme" />Programme</NavLink>
          <NavLink to="/progress"><Icon name="progress" />Progress</NavLink>
          <NavLink to="/book"><Icon name="book" />Book</NavLink>
        </>)}
        <NavLink to="/account"><Icon name="account" />Account</NavLink>
      </nav>
      <main>
        <Routes>
          <Route path="/account" element={<Account />} />
          {coach ? (<>
            <Route path="/clients" element={<CoachClients />} />
            <Route path="/slots" element={<CoachSlots />} />
            <Route path="*" element={<Navigate to="/clients" replace />} />
          </>) : (<>
            <Route path="/today" element={<Today />} />
            <Route path="/programme" element={<MyProgramme />} />
            <Route path="/progress" element={<Progress clientId={profile.id} />} />
            <Route path="/book" element={<Book />} />
            <Route path="*" element={<Navigate to="/today" replace />} />
          </>)}
        </Routes>
      </main>
    </>
  )
}
