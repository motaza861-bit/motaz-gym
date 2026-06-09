import { NavLink } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'
import './BottomNav.css'

const TABS = [
  { to: '/dashboard', icon: '🏠', key: 'nav.home' },
  { to: '/workout',   icon: '🏋️', key: 'nav.workout' },
  { to: '/nutrition', icon: '🥗', key: 'nav.nutrition' },
  { to: '/progress',  icon: '📈', key: 'nav.progress' },
  { to: '/schedule',  icon: '📅', key: 'nav.schedule' },
]

export default function BottomNav() {
  const { t } = useLanguage()
  return (
    <nav className="bottom-nav">
      {TABS.map(tab => (
        <NavLink key={tab.to} to={tab.to} className={({ isActive }) =>
          isActive ? 'nav-item active' : 'nav-item'
        }>
          <span className="nav-icon" aria-hidden="true">{tab.icon}</span>
          <span className="nav-label">{t(tab.key)}</span>
        </NavLink>
      ))}
    </nav>
  )
}
