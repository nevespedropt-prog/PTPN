import { useEffect, useState } from 'react'
import { NavLink, Navigate, Route, Routes, Link } from 'react-router-dom'
import { useAuth } from './auth'
import { configured, supabase } from './lib/supabase'
import { useUnread } from './hooks'
import { Logo } from './components/Logo'
import Icon, { type IconName } from './components/Icon'
import { Avatar } from './components/ui'
import Login from './pages/Login'
import Account from './pages/Account'
import More from './pages/More'
import Home from './pages/client/Home'
import Train from './pages/client/Train'
import Nutrition from './pages/client/Nutrition'
import WorkoutPlayer from './pages/WorkoutPlayer'
import WorkoutBuilder from './pages/coach/WorkoutBuilder'
import Recipes from './pages/Recipes'
import MealPlans from './pages/MealPlans'
import Progress from './pages/Progress'
import { ClientChat, CoachChat } from './pages/Chat'
import Book from './pages/Book'
import Community from './pages/Community'
import Resources from './pages/Resources'
import Dashboard from './pages/coach/Dashboard'
import Clients from './pages/coach/Clients'
import ClientDetail from './pages/coach/ClientDetail'
import Library from './pages/coach/Library'
import ProgramBuilder from './pages/coach/ProgramBuilder'
import Inbox from './pages/coach/Inbox'
import CoachSlots from './pages/CoachSlots'

interface NavItem { to: string; icon: IconName; label: string; badge?: number; where?: 'm' | 'd' }

function Shell({ items, extras, children }: { items: NavItem[]; extras: NavItem[]; children: React.ReactNode }) {
  const { profile, session } = useAuth()
  const [menu, setMenu] = useState(false)
  const name = profile?.full_name || session?.user.email || ''
  const link = (n: NavItem) => (
    <NavLink key={n.to} to={n.to} className={n.where === 'm' ? 'm-only' : n.where === 'd' ? 'd-only' : undefined}>
      <Icon name={n.icon} />
      <span>{n.label}</span>
      {!!n.badge && <span className="dot">{n.badge > 9 ? '9+' : n.badge}</span>}
    </NavLink>
  )
  // The hamburger drawer lists every page that does not have a tab on the phone bar.
  const drawer = [...items.filter(n => n.where === 'd'), ...extras]
  const menuBadge = drawer.reduce((t, n) => t + (n.badge ?? 0), 0)

  useEffect(() => {
    if (!menu) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(false) }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [menu])

  return (
    <>
      <header className="top">
        <Link to="/" aria-label="Home"><Logo size={30} /></Link>
        <div className="actions">
          <Link to="/account" aria-label="Account"><Avatar name={name} size={34} /></Link>
        </div>
      </header>
      <nav className="nav" aria-label="Main">
        <div className="nav-head"><Logo size={34} tagline /></div>
        {items.map(link)}
        <button type="button" className="menu-btn m-only" onClick={() => setMenu(true)} aria-label="Open menu" aria-expanded={menu}>
          <Icon name="menu" />
          <span>Menu</span>
          {menuBadge > 0 && <span className="dot">{menuBadge > 9 ? '9+' : menuBadge}</span>}
        </button>
        <span className="nav-label">More</span>
        {extras.map(n => link({ ...n, where: 'd' }))}
        <Link to="/account" className="nav-foot item" style={{ borderTop: '1px solid var(--line)', paddingTop: 14, gap: 10 }}>
          <Avatar name={name} size={36} />
          <span className="grow"><span className="title truncate" style={{ display: 'block' }}>{profile?.full_name || 'Account'}</span><span className="meta">{profile?.role === 'coach' ? 'Coach' : 'Client'}</span></span>
        </Link>
      </nav>
      {menu && (
        <div className="drawer-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setMenu(false) }}>
          <aside className="drawer" role="dialog" aria-modal="true" aria-label="Menu">
            <div className="drawer-head">
              <Logo size={30} />
              <button className="icon" onClick={() => setMenu(false)} aria-label="Close menu"><Icon name="x" size={18} /></button>
            </div>
            <Link to="/account" className="drawer-user" onClick={() => setMenu(false)}>
              <Avatar name={name} size={44} />
              <span className="grow"><b>{profile?.full_name || 'Account'}</b><br /><span className="mute small">{profile?.role === 'coach' ? 'Coach' : 'Client'} · Account and password</span></span>
              <Icon name="chev" />
            </Link>
            <div className="drawer-list">
              {drawer.map(n => (
                <Link key={n.to} to={n.to} className="drawer-item" onClick={() => setMenu(false)}>
                  <span className="drawer-icon"><Icon name={n.icon} size={19} /></span>
                  <span className="grow">{n.label}</span>
                  {!!n.badge && <span className="dot" style={{ position: 'static' }}>{n.badge > 9 ? '9+' : n.badge}</span>}
                  <Icon name="chev" size={16} />
                </Link>
              ))}
            </div>
            <button className="ghost block" onClick={() => supabase.auth.signOut()}><Icon name="logout" size={18} />Sign out</button>
          </aside>
        </div>
      )}
      <main><div className="wrap">{children}</div></main>
    </>
  )
}

export default function App() {
  const { session, profile, loading } = useAuth()
  const unread = useUnread(profile?.id)

  if (!configured) {
    return <main className="auth"><div className="card"><h1>Setup needed</h1>
      <p>Copy <code>.env.example</code> to <code>.env</code> and add your Supabase URL and anon key, then restart <code>npm run dev</code>.</p></div></main>
  }
  if (loading) return <main className="auth"><div className="hero"><Logo size={56} /></div><p className="mute center">Loading...</p></main>
  if (!session) return <Login />
  if (!profile) return <main className="auth"><div className="card"><p className="err">No profile found for this account.</p><button onClick={() => supabase.auth.signOut()}>Sign out</button></div></main>

  if (profile.role === 'coach') {
    return (
      <Shell
        items={[
          { to: '/dashboard', icon: 'dashboard', label: 'Dashboard' },
          { to: '/clients', icon: 'clients', label: 'Clients' },
          { to: '/library', icon: 'library', label: 'Library' },
          { to: '/inbox', icon: 'inbox', label: 'Inbox', badge: unread },
        ]}
        extras={[
          { to: '/slots', icon: 'calendar', label: 'Sessions' },
          { to: '/meal-plans', icon: 'nutrition', label: 'Meal plans' },
          { to: '/recipes', icon: 'nutrition', label: 'Recipe book' },
          { to: '/community', icon: 'trophy', label: 'Community' },
          { to: '/resources', icon: 'link', label: 'Resources' },
        ]}>
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/clients/:id" element={<ClientDetail />} />
          <Route path="/library" element={<Library />} />
          <Route path="/library/workouts/:id" element={<WorkoutBuilder />} />
          <Route path="/library/programs/:id" element={<ProgramBuilder />} />
          <Route path="/workout/:id" element={<WorkoutPlayer />} />
          <Route path="/inbox" element={<Inbox />} />
          <Route path="/inbox/:clientId" element={<CoachChat />} />
          <Route path="/meal-plans" element={<MealPlans />} />
          <Route path="/recipes" element={<Recipes />} />
          <Route path="/slots" element={<CoachSlots />} />
          <Route path="/community" element={<Community />} />
          <Route path="/resources" element={<Resources />} />
          <Route path="/account" element={<Account />} />
          <Route path="/more" element={<More />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Shell>
    )
  }

  return (
    <Shell
      items={[
        { to: '/home', icon: 'home', label: 'Home' },
        { to: '/train', icon: 'train', label: 'Train' },
        { to: '/nutrition', icon: 'nutrition', label: 'Nutrition' },
        { to: '/progress', icon: 'progress', label: 'Progress' },
        { to: '/chat', icon: 'chat', label: 'Coach', badge: unread, where: 'd' },
      ]}
      extras={[
        { to: '/meal-plans', icon: 'nutrition', label: 'Meal plans' },
          { to: '/recipes', icon: 'nutrition', label: 'Recipe book' },
        { to: '/community', icon: 'trophy', label: 'Community' },
        { to: '/book', icon: 'calendar', label: 'Book a session' },
        { to: '/resources', icon: 'link', label: 'Resources' },
      ]}>
      <Routes>
        <Route path="/home" element={<Home />} />
        <Route path="/train" element={<Train />} />
        <Route path="/workout/:id" element={<WorkoutPlayer />} />
        <Route path="/build/:id" element={<WorkoutBuilder />} />
        <Route path="/nutrition" element={<Nutrition />} />
        <Route path="/meal-plans" element={<MealPlans />} />
          <Route path="/recipes" element={<Recipes />} />
        <Route path="/progress" element={<Progress clientId={profile.id} />} />
        <Route path="/chat" element={<ClientChat />} />
        <Route path="/book" element={<Book />} />
        <Route path="/community" element={<Community />} />
        <Route path="/resources" element={<Resources />} />
        <Route path="/account" element={<Account />} />
        <Route path="/more" element={<More />} />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </Shell>
  )
}
