import InvestmentRow from './InvestmentRow.jsx'
import SectionHeader from './SectionHeader.jsx'

// Honest placeholders when the account has no holdings yet.
const STATE_TEXT = {
  loading: 'Loading investments…',
  error: 'Investments are unavailable right now.',
  bypass: 'No live account in this dev session — holdings are not loaded.',
}

export default function MyInvestments({
  title = 'My Investments',
  investments = [],
  state = 'ready',
}) {
  const emptyText =
    STATE_TEXT[state] ?? 'No investments yet — your holdings will appear here.'

  return (
    <section>
      <SectionHeader title={title} />
      <ul className="panel">
        {investments.length > 0 ? (
          investments.map((investment) => (
            <InvestmentRow key={investment.id} {...investment} />
          ))
        ) : (
          <li className="row row--empty">{emptyText}</li>
        )}
      </ul>
    </section>
  )
}