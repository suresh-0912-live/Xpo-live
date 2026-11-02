import IndexCard from './IndexCard.jsx'
import SectionHeader from './SectionHeader.jsx'

export default function FeaturedIndexes({
  title = 'Featured Indexes',
  indexes,
  onViewAll,
  onSelect,
}) {
  return (
    <section>
      <SectionHeader title={title} onViewAll={onViewAll} />
      <div className="rail">
        {indexes.map((index) => (
          <IndexCard
            key={index.id}
            {...index}
            onClick={onSelect ? () => onSelect(index) : undefined}
          />
        ))}
      </div>
    </section>
  )
}