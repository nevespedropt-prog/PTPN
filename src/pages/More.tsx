import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
import { supabase } from '../lib/supabase'
import Icon, { type IconName } from '../components/Icon'
import { Avatar, PageHead } from '../components/ui'

export default function More() {
  const { profile, session } = useAuth()
  const coach = profile?.role === 'coach'
  const rows: { to: string; icon: IconName; title: string; sub: string }[] = coach
    ? [
        { to: '/slots', icon: 'calendar', title: 'Sessions', sub: 'Open and booked PT slots' },
        { to: '/recipes', icon: 'nutrition', title: 'Recipe book', sub: 'Meal ideas with macros' },
        { to: '/community', icon: 'trophy', title: 'Community', sub: 'Announcements and challenges' },
        { to: '/resources', icon: 'link', title: 'Resources', sub: 'Guides and links for clients' },
      ]
    : [
        { to: '/recipes', icon: 'nutrition', title: 'Recipe book', sub: 'Meal ideas with macros' },
        { to: '/community', icon: 'trophy', title: 'Community', sub: 'Announcements and challenges' },
        { to: '/book', icon: 'calendar', title: 'Book a session', sub: 'Pick a PT slot' },
        { to: '/resources', icon: 'link', title: 'Resources', sub: 'Guides from your coach' },
      ]
  return (
    <>
      <PageHead title="More" />
      <Link to="/account" className="card click" style={{ display: 'flex', alignItems: 'center', gap: 14, color: 'var(--ink)' }}>
        <Avatar name={profile?.full_name || session?.user.email || ''} size={48} />
        <span className="grow"><b>{profile?.full_name || 'Account'}</b><br /><span className="mute small">{session?.user.email}</span></span>
        <Icon name="chev" />
      </Link>
      <div className="card tight">
        <div className="list">
          {rows.map(r => (
            <Link key={r.to} to={r.to} className="item">
              <span className="avatar" style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,.06)' }}><Icon name={r.icon} size={19} /></span>
              <span className="grow"><span className="title">{r.title}</span><br /><span className="meta">{r.sub}</span></span>
              <Icon name="chev" />
            </Link>
          ))}
        </div>
      </div>
      <button className="ghost block" onClick={() => supabase.auth.signOut()}><Icon name="logout" size={18} />Sign out</button>
    </>
  )
}
