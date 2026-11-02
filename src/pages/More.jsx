import BottomNavigation from '../components/BottomNavigation.jsx'
import { ChevronRight, CoinIcon } from '../components/Icons.jsx'
import MobileHeader from '../components/MobileHeader.jsx'
import { displayName, initialsFor } from '../api/auth.js'
import { navItemsFor } from '../data/dashboardData.js'
import { generalSupportWhatsAppLink } from '../utils/whatsapp.js'
import '../dashboard.css'
import './More.css'

export default function More({ onNavigate, user }) {
  return (
    <div className="shell">
      <MobileHeader showAvatar={false} />

      <main className="screen">
        <section className="more__head">
          <h1 className="more__title">Account</h1>
          <p className="more__sub">Account and app options</p>
        </section>

        <ul className="panel">
          <li className="row">
            <a className="more__btn" href={generalSupportWhatsAppLink(user)} target="_blank" rel="noreferrer">
              <span className="row__ico row__ico--blue" aria-hidden="true">?</span>
              <span className="row__body">
                <span className="row__name">WhatsApp support</span>
                <span className="row__sub">Review your message before sending</span>
              </span>
              <span className="row__chev"><ChevronRight /></span>
            </a>
          </li>
          <li className="row">
            <button type="button" className="more__btn" onClick={() => onNavigate('finance')}>
              <span className="row__ico row__ico--blue" aria-hidden="true">₹</span>
              <span className="row__body">
                <span className="row__name">Wallet &amp; transfers</span>
                <span className="row__sub">Balance, deposits and withdrawals</span>
              </span>
              <span className="row__chev"><ChevronRight /></span>
            </button>
          </li>
          <li className="row">
            <button
              type="button"
              className="more__btn"
              onClick={() => onNavigate('profile')}
            >
              <span className="row__ico more__ico" aria-hidden="true">
                {initialsFor(user)}
              </span>
              <span className="row__body">
                <span className="row__name">Profile</span>
                <span className="row__sub">{displayName(user)}</span>
              </span>
              <span className="row__chev">
                <ChevronRight />
              </span>
            </button>
          </li>
        </ul>

        <ul className="panel">
          <li className="row">
            <button
              type="button"
              className="more__btn"
              onClick={() => onNavigate('crypto-investment')}
            >
              <span className="row__ico row__ico--blue" aria-hidden="true">
                <CoinIcon name="btc" size={15} />
              </span>
              <span className="row__body">
                <span className="row__name">Crypto Investment</span>
                <span className="row__sub">Invest in top cryptocurrencies</span>
              </span>
              <span className="row__chev">
                <ChevronRight />
              </span>
            </button>
          </li>
          <li className="row">
            <button
              type="button"
              className="more__btn"
              onClick={() => onNavigate('forex-investment')}
            >
              <span className="row__ico row__ico--blue" aria-hidden="true">
                <CoinIcon name="eur" size={15} />
              </span>
              <span className="row__body">
                <span className="row__name">Forex Investment</span>
                <span className="row__sub">Access global currency markets</span>
              </span>
              <span className="row__chev">
                <ChevronRight />
              </span>
            </button>
          </li>
        </ul>
      </main>

      <BottomNavigation items={navItemsFor('more')} onSelect={onNavigate} />
    </div>
  )
}
