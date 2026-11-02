// Page hero for the investment pages: title, description and highlight
// features. Reuses the Markets heading classes so typography and spacing
// stay identical to the rest of the app.
export default function InvestmentHero({ title, description, features = [] }) {
  return (
    <section className="mk__head invhero">
      <h1 className="mk__title">{title}</h1>
      <p className="mk__sub">{description}</p>

      {features.length > 0 && (
        <ul className="invhero__feats">
          {features.map((feature) => (
            <li className="invfeat" key={feature}>
              {feature}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
