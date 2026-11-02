import BottomNavigation from '../components/BottomNavigation.jsx'
import { ChevronLeft, Logout } from '../components/Icons.jsx'
import MobileHeader from '../components/MobileHeader.jsx'
import { displayName, initialsFor } from '../api/auth.js'
import { navItemsFor } from '../data/dashboardData.js'
import '../dashboard.css'
import './Profile.css'

export default function Profile({ onNavigate, user, onLogout }) {
  return (
    <div className="shell">
      <MobileHeader showAvatar={false} />

      <main className="screen">
        <section className="prof__bar">
          <button
            type="button"
            className="prof__back"
            aria-label="Back to Account"
            onClick={() => onNavigate('more')}
          >
            <ChevronLeft />
          </button>
          <h1 className="prof__title">Profile</h1>
          <span className="prof__spacer" aria-hidden="true" />
        </section>

        <section className="prof__card">
          <span className="prof__avatar" aria-hidden="true">
            {initialsFor(user)}
          </span>
          <p className="prof__name">{displayName(user)}</p>
          {user?.email && <p className="prof__email">{user.email}</p>}
        </section>

        <button
          type="button"
          className="prof__logout"
          onClick={onLogout}
          aria-label="Log out of your account"
        >
          <Logout />
          Log out
        </button>
      </main>

      <BottomNavigation items={navItemsFor('more')} onSelect={onNavigate} />
    </div>
  )
}