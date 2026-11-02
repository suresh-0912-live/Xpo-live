import { Bell, Logo, Search } from './Icons.jsx'

export default function MobileHeader({
  initials = 'AS',
  hasNotification = false,
  showSearch = false,
  showAvatar = true,
  onNotifications,
}) {
  return (
    <header className="hdr">
      <Logo />
      <div className="hdr__right">
        {showSearch && (
          <button type="button" className="hdr__search" aria-label="Search">
            <Search />
          </button>
        )}
        <button type="button" className="hdr__bell" aria-label="Notifications" onClick={onNotifications}>
          <Bell />
          {hasNotification && <span className="hdr__dot" />}
        </button>
        {showAvatar && (
          <button type="button" className="hdr__avatar" aria-label="Profile">
            {initials}
          </button>
        )}
      </div>
    </header>
  )
}