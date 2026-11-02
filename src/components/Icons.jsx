import { coinIcons } from '../data/coinIcons.js'

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

function Svg({ size = 18, children, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  )
}

export function Bell() {
  return (
    <Svg size={17}>
      <path
        {...stroke}
        d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8"
      />
      <path {...stroke} d="M13.7 20a2 2 0 0 1-3.4 0" />
    </Svg>
  )
}

export function ChevronDown() {
  return (
    <Svg size={12}>
      <path {...stroke} d="m6 9 6 6 6-6" />
    </Svg>
  )
}

export function ChevronRight() {
  return (
    <Svg size={15}>
      <path {...stroke} d="m9 6 6 6-6 6" />
    </Svg>
  )
}

export function ChevronLeft() {
  return (
    <Svg size={15}>
      <path {...stroke} d="m15 6-6 6 6 6" />
    </Svg>
  )
}

export function Logout() {
  return (
    <Svg size={16}>
      <path {...stroke} d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path {...stroke} d="m16 17 5-5-5-5" />
      <path {...stroke} d="M21 12H9" />
    </Svg>
  )
}

export function ArrowRight() {
  return (
    <Svg size={14}>
      <path {...stroke} d="M4 12h15m-5-6 6 6-6 6" />
    </Svg>
  )
}

export function ArrowUp() {
  return (
    <Svg size={13}>
      <path {...stroke} d="M12 19V5m-6 6 6-6 6 6" />
    </Svg>
  )
}

export function Eye() {
  return (
    <Svg size={13}>
      <path
        {...stroke}
        d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z"
      />
      <circle cx="12" cy="12" r="2.6" {...stroke} />
    </Svg>
  )
}

export function Wallet() {
  return (
    <Svg size={13}>
      <path
        {...stroke}
        d="M3 8.5A2.5 2.5 0 0 1 5.5 6H18a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V8.5Z"
      />
      <path {...stroke} d="M3 9h13" />
      <circle cx="16.5" cy="13" r="1.2" fill="currentColor" stroke="none" />
    </Svg>
  )
}

export function Bars() {
  return (
    <Svg size={13}>
      <path {...stroke} d="M4 20V11m5 9V5m5 15v-6m5 6V8" />
    </Svg>
  )
}

export function TrendUp() {
  return (
    <Svg size={13}>
      <path {...stroke} d="M3 17 9.5 10.5l4 4L21 7" />
      <path {...stroke} d="M15 7h6v6" />
    </Svg>
  )
}

export function TrendDown() {
  return (
    <Svg size={13}>
      <path {...stroke} d="M3 7 9.5 13.5l4-4L21 17" />
      <path {...stroke} d="M15 17h6v-6" />
    </Svg>
  )
}

export function Download() {
  return (
    <Svg size={17}>
      <path {...stroke} d="M12 3v11m0 0 4-4m-4 4-4-4" />
      <path {...stroke} d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </Svg>
  )
}

export function Upload() {
  return (
    <Svg size={17}>
      <path {...stroke} d="M12 21V10m0 0 4 4m-4-4-4 4" />
      <path {...stroke} d="M4 7V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2" />
    </Svg>
  )
}

export function Swap() {
  return (
    <Svg size={17}>
      <path {...stroke} d="M4 8h13l-3.5-3.5M20 16H7l3.5 3.5" />
    </Svg>
  )
}

export function Plus() {
  return (
    <Svg size={17}>
      <path {...stroke} d="M12 5v14M5 12h14" />
    </Svg>
  )
}

export function Home() {
  return (
    <Svg size={21}>
      <path {...stroke} d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9.5Z" />
    </Svg>
  )
}

export function Candles() {
  return (
    <Svg size={21}>
      <path {...stroke} d="M7 4v3m0 10v3M7 7h0a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z" />
      <path {...stroke} d="M17 3v4m0 8v4M17 7a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1 1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z" />
    </Svg>
  )
}

export function Briefcase() {
  return (
    <Svg size={21}>
      <rect x="3" y="7.5" width="18" height="12" rx="2.5" {...stroke} />
      <path {...stroke} d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5" />
    </Svg>
  )
}

export function ListIcon() {
  return (
    <Svg size={21}>
      <path {...stroke} d="M6 7h13M6 12h13M6 17h9" />
      <circle cx="4" cy="7" r="1" fill="currentColor" stroke="none" />
      <circle cx="4" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="4" cy="17" r="1" fill="currentColor" stroke="none" />
    </Svg>
  )
}

export function Dots() {
  return (
    <Svg size={21}>
      <circle cx="6" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="18" cy="12" r="1.6" fill="currentColor" stroke="none" />
    </Svg>
  )
}

export function Search() {
  return (
    <Svg size={16}>
      <circle cx="11" cy="11" r="6.5" {...stroke} />
      <path {...stroke} d="m15.8 15.8 4.4 4.4" />
    </Svg>
  )
}

export function Sliders() {
  return (
    <Svg size={16}>
      <path {...stroke} d="M3 7h6" />
      <circle cx="12" cy="7" r="2.2" {...stroke} />
      <path {...stroke} d="M15 7h6" />
      <path {...stroke} d="M3 12h9" />
      <circle cx="15" cy="12" r="2.2" {...stroke} />
      <path {...stroke} d="M18 12h3" />
      <path {...stroke} d="M3 17h4" />
      <circle cx="10" cy="17" r="2.2" {...stroke} />
      <path {...stroke} d="M13 17h8" />
    </Svg>
  )
}

export function SortArrows() {
  return (
    <Svg size={10}>
      <path {...stroke} strokeWidth={2.6} d="M5 4.5 8 1.5l3 3" />
      <path {...stroke} strokeWidth={2.6} d="M5 9.5l3 3 3-3" />
    </Svg>
  )
}

export function Logo() {
  return (
    <svg
      className="hdr__logo"
      viewBox="0 0 110 30"
      role="img"
      aria-label="WPS.in"
    >
      <defs>
        <linearGradient id="yxpo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4f9dff" />
          <stop offset="1" stopColor="#0066ff" />
        </linearGradient>
      </defs>
      <path
        d="M5 4.5h16v4.2l-6 6.6 6 6.6v4.2H5v-4.2l6-6.6-6-6.6V4.5Z"
        fill="url(#yxpo-g)"
      />
      <path
        d="M2 16.5h6l5-8.5v14"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.9"
      />
      <text
        x="30"
        y="21"
        fill="#ffffff"
        fontSize="14"
        fontWeight="700"
        letterSpacing="1.4"
        fontFamily="Inter, system-ui, sans-serif"
      >
        WPS
      </text>
      <text
        x="70"
        y="21"
        fill="url(#yxpo-g)"
        fontSize="14"
        fontWeight="800"
        letterSpacing="1.4"
        fontFamily="Inter, system-ui, sans-serif"
      >
        XPO
      </text>
    </svg>
  )
}

export function CoinIcon({ name, size = 16 }) {
  const coin = coinIcons[name] ?? coinIcons.globe
  return (
    <span
      style={{
        fontSize: coin.glyph.length > 1 ? size * 0.52 : size * 0.78,
        lineHeight: 1,
        fontWeight: 700,
      }}
      aria-hidden="true"
    >
      {coin.glyph}
    </span>
  )
}

const uiIcons = {
  wallet: Wallet,
  bars: Bars,
  trendUp: TrendUp,
  trendDown: TrendDown,
  download: Download,
  upload: Upload,
  swap: Swap,
  plus: Plus,
}

export function UiIcon({ name, size = 18 }) {
  const Cmp = uiIcons[name] ?? Plus
  return <Cmp size={size} />
}

const navIcons = {
  home: Home,
  candles: Candles,
  briefcase: Briefcase,
  list: ListIcon,
  dots: Dots,
}

export function NavIcon({ name, size = 21 }) {
  const Cmp = navIcons[name] ?? Home
  return <Cmp size={size} />
}