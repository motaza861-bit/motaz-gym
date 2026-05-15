import { NavLink } from 'react-router-dom'
import './BottomNav.css'

const TABS = [
  { to: '/dashboard', icon: '🏠', label: 'Home' },
  { to: '/workout',   icon: '🏋️', label: 'Workout' },
  { to: '/nutrition', icon: '🥗', label: 'Nutrition' },
  { to: '/progress',  icon: '📈', label: 'Progress' },
]

export default function BottomNav() {
  return (
    <nav className="bottom-nav">
      {TABS.map(tab => (
        <NavLink key={tab.to} to={tab.to} className={({ isActive }) =>
          isActive ? 'nav-item active' : 'nav-item'
        }>
          <span className="nav-icon" aria-hidden="true">{tab.icon}</span>
          <span className="nav-label">{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
