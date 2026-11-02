import { ChevronDown } from './Icons.jsx'

export default function GreetingSection({ user }) {
  return (
    <section className="greet">
      <div>
        <p className="greet__hi">{user.greeting}</p>
        <h1 className="greet__name">{user.name}</h1>
        <p className="greet__sub">{user.subtitle}</p>
      </div>
      <div className="greet__meta">
        {user.live && (
          <span className="pill pill--live">
            <span className="pill__dot" />
            Live
          </span>
        )}
        <span className="pill pill--currency">
          {user.currency}
          <span className="pill__caret">
            <ChevronDown />
          </span>
        </span>
      </div>
    </section>
  )
}