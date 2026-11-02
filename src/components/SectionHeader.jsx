import { ArrowRight } from './Icons.jsx'

export default function SectionHeader({
  title,
  linkLabel = 'View All',
  arrowOnly = false,
  onViewAll,
}) {
  return (
    <div className="shead">
      <h2 className="shead__title">{title}</h2>
      {/* Only sections with a real destination get a handler; elsewhere the
          arrow stays decorative exactly as before. */}
      <button type="button" className="shead__link" onClick={onViewAll}>
        {arrowOnly ? null : linkLabel}
        <ArrowRight />
      </button>
    </div>
  )
}