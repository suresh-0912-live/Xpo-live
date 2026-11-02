import BottomNavigation from '../components/BottomNavigation.jsx'
import MobileHeader from '../components/MobileHeader.jsx'
import RecentTransactions from '../components/RecentTransactions.jsx'
import { navItemsFor } from '../data/dashboardData.js'
import '../dashboard.css'
import './Transactions.css'

// `transactions` / `state` come from App's dashboard loader so this page
// shows the same authenticated data (and honest empty states) as Home.
export default function Transactions({ onNavigate, transactions = [], state = 'ready' }) {
  return (
    <div className="shell">
      <MobileHeader showAvatar={false} />

      <main className="screen">
        <section className="txn__head">
          <h1 className="txn__title">Transactions</h1>
          <p className="txn__sub">Your recent account activity</p>
        </section>

        <RecentTransactions transactions={transactions} state={state} />
      </main>

      <BottomNavigation
        items={navItemsFor('transactions')}
        onSelect={onNavigate}
      />
    </div>
  )
}