import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth'
import { configured, supabase } from './lib/supabase'
import Login from './pages/Login'
import MyProgramme from './pages/MyProgramme'
import Progress from './pages/Progress'
import Book from './pages/Book'
import CoachClients from './pages/CoachClients'
import CoachSlots from './pages/CoachSlots'

export default function App() {
  const { session, profile, loading } = useAuth()

  if (!configured) {
    return <main><div className="card"><h1>Setup needed</h1>
      <p>Copy <code>.env.example</code> to <code>.env</code> and add your Supabase URL and anon key, then restart <code>npm run dev</code>.</p></div></main>
  }
  if (loading) return <main><p className="mute">Loading...</p></main>
  if (!session) return <Login />
  if (!profile) return <main><p className="err">No profile found for this account.</p><button onClick={() => supabase.auth.signOut()}>Sign out</button></main>

  const coach = profile.role === 'coach'
  return (
    <>
      <header className="top">
        <b>MY GYM</b>
        <span>{profile.full_name || session.user.email} <button className="ghost" style={{ background: '#fff' }} onClick={() => supabase.auth.signOut()}>Sign out</button></span>
      </header>
      <nav>
        {coach ? (<>
          <NavLink to="/clients">Clients</NavLink>
          <NavLink to="/slots">Session slots</NavLink>
        </>) : (<>
          <NavLink to="/programme">Programme</NavLink>
          <NavLink to="/progress">Progress</NavLink>
          <NavLink to="/book">Book</NavLink>
        </>)}
      </nav>
      <main>
        <Routes>
          {coach ? (<>
            <Route path="/clients" element={<CoachClients />} />
            <Route path="/slots" element={<CoachSlots />} />
            <Route path="*" element={<Navigate to="/clients" replace />} />
          </>) : (<>
            <Route path="/programme" element={<MyProgramme />} />
            <Route path="/progress" element={<Progress clientId={profile.id} />} />
            <Route path="/book" element={<Book />} />
            <Route path="*" element={<Navigate to="/programme" replace />} />
          </>)}
        </Routes>
      </main>
    </>
  )
}
