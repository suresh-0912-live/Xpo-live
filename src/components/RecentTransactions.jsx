import TransactionRow from './TransactionRow.jsx'
import SectionHeader from './SectionHeader.jsx'

// Honest placeholders when the list has nothing to show. `state` comes from
// App's dashboard loader: loading | ready | error | bypass.
const STATE_TEXT = {
  loading: 'Loading transactions…',
  error: 'Transactions are unavailable right now.',
  bypass: 'No live account in this dev session — transactions are not loaded.',
}

export default function RecentTransactions({
  title = 'Recent Transactions',
  transactions = [],
  state = 'ready',
}) {
  const emptyText =
    STATE_TEXT[state] ??
    'No transactions yet — your deposits and withdrawals will appear here.'

  return (
    <section>
      <SectionHeader title={title} />
      <ul className="panel">
        {transactions.length > 0 ? (
          transactions.map((transaction) => (
            <TransactionRow key={transaction.id} {...transaction} />
          ))
        ) : (
          <li className="row row--empty">{emptyText}</li>
        )}
      </ul>
    </section>
  )
}