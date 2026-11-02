import QuickActionCard from './QuickActionCard.jsx'
import SectionHeader from './SectionHeader.jsx'

export default function QuickActions({ actions, onSelect }) {
  return (
    <section className="qa">
      <SectionHeader title="Quick Actions" arrowOnly />
      <div className="qa__grid">
        {actions.map((action) => (
          <QuickActionCard
            key={action.id}
            {...action}
            onClick={() => onSelect?.(action.id)}
          />
        ))}
      </div>
    </section>
  )
}