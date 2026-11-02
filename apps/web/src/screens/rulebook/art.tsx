import { SPACES, type SpaceKind } from '@skyline/engine'
import { groupColor } from '../../spaceInfo.ts'
import { fmtMoney } from '../game/format.ts'

/**
 * Code-drawn illustrations for the rulebook (flat, top-down or front-on, in the card-stock
 * palette). They are built from the engine's board data, so a renamed street or a changed price
 * shows up here without anyone editing a picture.
 */

const INK = '#1f2a3d'
const PAPER = '#fbf8f1'
const EDGE = '#d8cfbb'
const GOLD = '#f5b54a'
const AMBER = '#e8a33c'

// ---- the board ---------------------------------------------------------------------------------

const CORNER = 1.6
const SCALE = 52

/** Start and size of column (or row) `k` of the 11 x 11 ring, in board units. */
const span = (k: number): [number, number] =>
  k === 0 ? [0, CORNER] : k === 10 ? [CORNER + 9, CORNER] : [CORNER + k - 1, 1]

/** The ring cell of space `i`: Launch bottom right, then clockwise. */
function cellOf(i: number): { col: number; row: number } {
  if (i <= 10) return { col: 10 - i, row: 10 }
  if (i <= 20) return { col: 0, row: 20 - i }
  if (i <= 30) return { col: i - 20, row: 0 }
  return { col: 10, row: i - 30 }
}

function Glyph({ kind, x, y, s }: { kind: SpaceKind; x: number; y: number; s: number }) {
  const t = `translate(${x} ${y}) scale(${s})`
  switch (kind) {
    case 'railroad':
      return (
        <g transform={t} fill={INK}>
          <rect x={-9} y={-7} width={18} height={11} rx={3} />
          <rect x={-6} y={-4} width={5} height={4} fill={PAPER} />
          <rect x={1} y={-4} width={5} height={4} fill={PAPER} />
          <circle cx={-5} cy={7} r={2.4} />
          <circle cx={5} cy={7} r={2.4} />
        </g>
      )
    case 'utility':
      return (
        <g transform={t} fill="none" stroke={INK} strokeWidth={2.2} strokeLinecap="round">
          <circle cx={0} cy={-3} r={6} />
          <path d="M-3 6h6M-2 9.5h4" />
        </g>
      )
    case 'chance':
      return (
        <text transform={t} textAnchor="middle" y={8} fontSize={24} fontWeight={800} fill="#c47a10">
          ?
        </text>
      )
    case 'chest':
      return (
        <g transform={t} fill="#2d7fb8">
          <rect x={-9} y={-6} width={18} height={13} rx={2} />
          <rect x={-9} y={-6} width={18} height={5} rx={2} fill="#1f5f8c" />
          <rect x={-2} y={-2} width={4} height={5} fill={PAPER} />
        </g>
      )
    case 'tax':
      return (
        <text transform={t} textAnchor="middle" y={8} fontSize={22} fontWeight={800} fill="#b4413a">
          ₵
        </text>
      )
    default:
      return null
  }
}

/** All 40 spaces in a ring, colored by district, with the four corners named. */
export function BoardMap() {
  const size = (CORNER * 2 + 9) * SCALE
  const corners: Record<number, [string, string]> = {
    0: ['LAUNCH', 'Salary'],
    10: ['LOCKUP', 'Just visiting'],
    20: ['CENTRAL', 'PARK'],
    30: ['GO TO', 'LOCKUP'],
  }
  return (
    <svg
      viewBox={`-6 -6 ${size + 12} ${size + 12}`}
      className="mx-auto h-auto w-full max-w-[560px] min-w-[480px]"
    >
      <title>
        The board: 40 spaces in a ring. Launch is the bottom-right corner and play runs clockwise.
      </title>
      <rect x={-6} y={-6} width={size + 12} height={size + 12} rx={22} fill="#e9e1cd" />
      <rect x={CORNER * SCALE} y={CORNER * SCALE} width={9 * SCALE} height={9 * SCALE} fill="#cfe1d6" />
      {SPACES.map((sp, i) => {
        const { col, row } = cellOf(i)
        const [cx, cw] = span(col)
        const [ry, rh] = span(row)
        const x = cx * SCALE
        const y = ry * SCALE
        const w = cw * SCALE
        const h = rh * SCALE
        const corner = i % 10 === 0
        // The color band sits on the inner edge, facing the city.
        const band = 15
        let bx = x
        let by = y
        let bw = w
        let bh = h
        if (row === 10) {
          bh = band
        } else if (row === 0) {
          by = y + h - band
          bh = band
        } else if (col === 0) {
          bx = x + w - band
          bw = band
        } else {
          bw = band
        }
        return (
          <g key={i}>
            <rect x={x} y={y} width={w} height={h} fill={PAPER} stroke={EDGE} strokeWidth={1.5} />
            {sp.kind === 'property' && (
              <rect x={bx} y={by} width={bw} height={bh} fill={groupColor(sp.group)} />
            )}
            {!corner && (
              <>
                <Glyph kind={sp.kind} x={x + w / 2} y={y + h / 2} s={1} />
                {sp.kind === 'property' && (
                  <text
                    x={x + w / 2}
                    y={row === 10 ? y + h - 7 : row === 0 ? y + 14 : y + h / 2 + 4}
                    textAnchor="middle"
                    fontSize={9}
                    fontWeight={700}
                    fill={INK}
                    opacity={0.7}
                  >
                    {sp.price}
                  </text>
                )}
              </>
            )}
            {corner && (
              <g textAnchor="middle" fontWeight={800} fill={INK}>
                <text x={x + w / 2} y={y + h / 2 - 2} fontSize={15} letterSpacing={0.5}>
                  {corners[i]![0]}
                </text>
                <text
                  x={x + w / 2}
                  y={y + h / 2 + 15}
                  fontSize={i === 20 || i === 30 ? 15 : 9.5}
                  fontWeight={i === 20 || i === 30 ? 800 : 600}
                >
                  {corners[i]![1]}
                </text>
              </g>
            )}
          </g>
        )
      })}
      {/* Direction of play along the inside of the ring. */}
      <g transform={`translate(${size / 2} ${size / 2})`} textAnchor="middle" fill={INK}>
        <text y={-8} fontSize={34} fontWeight={800} letterSpacing={6}>
          SKYLINE
        </text>
        <text y={20} fontSize={13} fontWeight={600} opacity={0.65}>
          Play runs clockwise from Launch
        </text>
      </g>
    </svg>
  )
}

// ---- dice --------------------------------------------------------------------------------------

const PIPS: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [
    [0.28, 0.28],
    [0.72, 0.72],
  ],
  3: [
    [0.28, 0.28],
    [0.5, 0.5],
    [0.72, 0.72],
  ],
  4: [
    [0.28, 0.28],
    [0.72, 0.28],
    [0.28, 0.72],
    [0.72, 0.72],
  ],
  5: [
    [0.28, 0.28],
    [0.72, 0.28],
    [0.5, 0.5],
    [0.28, 0.72],
    [0.72, 0.72],
  ],
  6: [
    [0.28, 0.25],
    [0.72, 0.25],
    [0.28, 0.5],
    [0.72, 0.5],
    [0.28, 0.75],
    [0.72, 0.75],
  ],
}

export function Die({ value, size = 56, tilt = 0 }: { value: number; size?: number; tilt?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 60 60" aria-hidden="true" style={{ rotate: `${tilt}deg` }}>
      <rect x={4} y={6} width={52} height={50} rx={11} fill="#d8cfbb" />
      <rect x={4} y={3} width={52} height={50} rx={11} fill="#fff" stroke={EDGE} strokeWidth={1.5} />
      {(PIPS[value] ?? []).map(([px, py], i) => (
        <circle key={i} cx={4 + px * 52} cy={3 + py * 50} r={5} fill={INK} />
      ))}
    </svg>
  )
}

export function DicePair({ a, b, tilt = true }: { a: number; b: number; tilt?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <Die value={a} tilt={tilt ? -8 : 0} />
      <Die value={b} tilt={tilt ? 7 : 0} />
    </div>
  )
}

// ---- districts ---------------------------------------------------------------------------------

/** The eight color sets, with the streets in each. */
export function DistrictStrip({ names }: { names: string[] }) {
  return (
    <ul className="m-0 grid list-none grid-cols-2 gap-2.5 p-0 sm:grid-cols-4">
      {names.map((name, g) => {
        const streets = SPACES.filter((s) => s.group === g)
        const price = streets.map((s) => s.price)
        return (
          <li key={name} className="overflow-hidden rounded-xl border border-card-edge bg-white">
            <div className="h-3.5" style={{ background: groupColor(g) }} />
            <div className="px-2.5 pt-2 pb-2.5">
              <div className="font-card text-sm font-extrabold">{name}</div>
              <div className="text-[11px] text-card-muted">
                {streets.length} streets ·{' '}
                {Math.min(...price) === Math.max(...price)
                  ? fmtMoney(Math.min(...price))
                  : `${fmtMoney(Math.min(...price))}–${fmtMoney(Math.max(...price))}`}
              </div>
              <div className="mt-1 text-[11px] leading-snug text-[#3d4757]">
                {streets.map((s) => s.name).join(', ')}
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

// ---- buildings ---------------------------------------------------------------------------------

function Tower({ x, floors, color, hotel }: { x: number; floors: number; color: string; hotel?: boolean }) {
  const fh = 15
  const w = hotel ? 40 : 46
  const h = hotel ? 8 * fh : Math.max(1, floors) * fh + 8
  const base = 150
  return (
    <g transform={`translate(${x} 0)`}>
      {floors === 0 && !hotel ? (
        <g>
          <rect x={-22} y={base - 5} width={44} height={5} rx={2} fill="#bdb49e" />
          <rect
            x={-20}
            y={base - 12}
            width={40}
            height={7}
            rx={2}
            fill="none"
            stroke="#bdb49e"
            strokeWidth={2}
            strokeDasharray="5 4"
          />
        </g>
      ) : (
        <g>
          <rect
            x={-w / 2}
            y={base - h}
            width={w}
            height={h}
            rx={3}
            fill={hotel ? '#2f3f66' : '#e7dfcd'}
            stroke={hotel ? INK : '#b9ae94'}
            strokeWidth={1.5}
          />
          <rect x={-w / 2} y={base - h} width={w} height={6} rx={3} fill={color} />
          {Array.from({ length: hotel ? 7 : floors }).map((_, r) =>
            [-1, 0, 1].map((c) => (
              <rect
                key={`${r}${c}`}
                x={c * 12 - 4}
                y={base - h + 12 + r * (hotel ? 15 : fh)}
                width={8}
                height={7}
                rx={1.5}
                fill={hotel ? '#ffd98a' : '#8fb3d4'}
              />
            )),
          )}
          {hotel && (
            <g>
              <path d={`M0 ${base - h} V${base - h - 14}`} stroke={INK} strokeWidth={2} />
              <circle cx={0} cy={base - h - 16} r={4} fill="#fb7185" />
            </g>
          )}
        </g>
      )}
    </g>
  )
}

/** One street as it grows: empty lot, one to four houses, then a hotel, with its rent underneath. */
export function GrowthStrip({ street }: { street: string }) {
  const sp = SPACES.find((s) => s.name === street)!
  const color = groupColor(sp.group)
  const labels = ['Empty lot', '1 house', '2 houses', '3 houses', '4 houses', 'Hotel']
  return (
    <svg viewBox="0 0 660 232" className="h-auto w-full">
      <title>{`${street} grows from an empty lot to a hotel, and its rent rises each step.`}</title>
      <rect x={0} y={0} width={660} height={232} rx={16} fill="#eef2f6" />
      {sp.rent.map((rent, i) => {
        const cx = 55 + i * 110
        return (
          <g key={i}>
            <Tower x={cx} floors={i === 5 ? 0 : i} color={color} hotel={i === 5} />
            <rect x={cx - 52} y={158} width={104} height={4} rx={2} fill="#bdb49e" />
            <text x={cx} y={182} textAnchor="middle" fontSize={11.5} fontWeight={700} fill={INK}>
              {labels[i]}
            </text>
            <text x={cx} y={206} textAnchor="middle" fontSize={17} fontWeight={800} fill="#1d7354">
              {fmtMoney(rent)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ---- the Lockup --------------------------------------------------------------------------------

export function LockupArt() {
  return (
    <svg viewBox="0 0 220 150" className="h-auto w-full max-w-[260px]">
      <title>A cell with bars</title>
      <rect width={220} height={150} rx={16} fill="#eef2f6" />
      <rect x={34} y={22} width={152} height={104} rx={8} fill="#cfd6e0" stroke={INK} strokeWidth={3} />
      <rect x={44} y={32} width={132} height={84} rx={4} fill="#8da0bd" />
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x={58 + i * 26} y={30} width={7} height={88} rx={3} fill={INK} />
      ))}
      <rect x={96} y={126} width={28} height={10} rx={3} fill={INK} />
    </svg>
  )
}

// ---- cards -------------------------------------------------------------------------------------

export function CardFace({ deck, text }: { deck: 'chance' | 'chest'; text: string }) {
  const chance = deck === 'chance'
  return (
    <figure
      className="m-0 flex min-h-[132px] flex-col overflow-hidden rounded-xl border border-card-edge bg-white shadow-[0_6px_14px_rgba(40,30,10,0.14)]"
      style={{ rotate: chance ? '-1.2deg' : '1deg' }}
    >
      <div
        className="flex items-center gap-2 px-3 py-1.5 text-[11px] font-extrabold tracking-[0.16em] text-white uppercase"
        style={{ background: chance ? '#c47a10' : '#2d7fb8' }}
      >
        {chance ? 'Opportunity' : 'City Fund'}
      </div>
      <figcaption className="flex flex-1 items-center px-3.5 py-3 font-card text-[15px] leading-snug font-bold">
        {text}
      </figcaption>
    </figure>
  )
}

// ---- the Speed die -----------------------------------------------------------------------------

function Bus() {
  return (
    <g fill="none" stroke={INK} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round">
      <rect x={-17} y={-15} width={34} height={26} rx={5} fill="#fff7e6" />
      <path d="M-17 -2H17" />
      <path d="M-10 11v6M10 11v6" />
      <circle cx={-8} cy={4} r={1.4} fill={INK} />
      <circle cx={8} cy={4} r={1.4} fill={INK} />
    </g>
  )
}

function Pin({ star }: { star?: boolean }) {
  return (
    <g>
      <path
        d="M0 18C-14 4-16-4-16-9a16 16 0 0 1 32 0c0 5-2 13-16 27z"
        fill="#fff7e6"
        stroke={INK}
        strokeWidth={3}
        strokeLinejoin="round"
        transform="translate(0 -8) scale(.9)"
      />
      <circle cx={0} cy={-10} r={star ? 0 : 5} fill={INK} />
      {star && (
        <path
          d="M0-18l3.2 6.4 7 1-5.1 5 1.2 7L0-2l-6.3 3.4 1.2-7-5.1-5 7-1z"
          fill={INK}
          transform="translate(0 4) scale(.8)"
        />
      )}
    </g>
  )
}

export function SpeedFaces() {
  const faces: { key: string; label: string; body: React.ReactNode }[] = [
    ...[1, 2, 3].map((n) => ({
      key: `n${n}`,
      label: `${n}`,
      body: (PIPS[n] ?? []).map(([px, py], i) => (
        <circle key={i} cx={(px - 0.5) * 44} cy={(py - 0.5) * 44} r={4.6} fill={INK} />
      )),
    })),
    { key: 'bus', label: 'Bus', body: <Bus /> },
    { key: 's1', label: 'Scout', body: <Pin star /> },
    { key: 's2', label: 'Scout', body: <Pin star /> },
  ]
  return (
    <ul className="m-0 flex list-none flex-wrap gap-3 p-0">
      {faces.map((f) => (
        <li key={f.key} className="flex flex-col items-center gap-1.5">
          <svg width={64} height={64} viewBox="-32 -32 64 64" aria-hidden="true">
            <rect x={-28} y={-26} width={56} height={56} rx={12} fill="#b9791f" />
            <rect
              x={-28}
              y={-30}
              width={56}
              height={56}
              rx={12}
              fill={AMBER}
              stroke="#8a5a12"
              strokeWidth={1.5}
            />
            <g transform="translate(0 -2)">{f.body}</g>
          </svg>
          <span className="text-[11px] font-bold text-card-muted">{f.label}</span>
        </li>
      ))}
    </ul>
  )
}

// ---- money -------------------------------------------------------------------------------------

/** A loan bar draining as repayments come in. */
export function LoanBar({ left, of }: { left: number; of: number }) {
  const pct = Math.round((left / of) * 100)
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between text-[11px] font-bold text-card-muted">
        <span>Second Wind loan</span>
        <span>
          {fmtMoney(left)} left of {fmtMoney(of)}
        </span>
      </div>
      <div aria-hidden="true" className="h-3 overflow-hidden rounded-full bg-[#ece4d2]">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${GOLD}, #ffcf70)` }}
        />
      </div>
    </div>
  )
}

/** A stack of coins with a label, for salary and fee callouts. */
export function Coins({ n = 3 }: { n?: number }) {
  return (
    <svg width={44} height={36} viewBox="0 0 44 36" aria-hidden="true">
      {Array.from({ length: n }).map((_, i) => (
        <g key={i} transform={`translate(0 ${-i * 7})`}>
          <ellipse cx={22} cy={29} rx={17} ry={6} fill="#c8962a" />
          <ellipse cx={22} cy={26} rx={17} ry={6} fill="#f2c14e" stroke="#c8962a" strokeWidth={1} />
        </g>
      ))}
    </svg>
  )
}
