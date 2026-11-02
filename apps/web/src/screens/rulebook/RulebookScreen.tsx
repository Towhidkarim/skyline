import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  PRESETS,
  PRESET_TWISTS,
  SPACES,
  UTILITIES,
  RAILROADS,
  CHANCE_CARDS,
  CHEST_CARDS,
} from '@skyline/engine'
import { navigate } from '../../net/route.ts'
import { groupColor } from '../../spaceInfo.ts'
import { fmtMoney } from '../game/format.ts'
import { SkylineIcon } from '../game/icons.tsx'
import { SHORTCUTS } from '../game/shortcuts.ts'
import {
  BoardMap,
  CardFace,
  Coins,
  DicePair,
  DistrictStrip,
  GrowthStrip,
  LoanBar,
  LockupArt,
  SpeedFaces,
} from './art.tsx'

/** The district names, in color order (the same ones the tooltips use). */
const DISTRICTS = ['Docks', 'Old Town', 'Gardens', 'Market', 'Theater', 'Tech', 'Uptown', 'Crown']

const CHAPTERS = [
  ['goal', 'The goal'],
  ['box', 'The board'],
  ['setup', 'Setting up'],
  ['turn', 'Your turn'],
  ['spaces', 'Landing on things'],
  ['sets', 'Sets and building'],
  ['stations', 'Stations and utilities'],
  ['lockup', 'The Lockup'],
  ['cards', 'Cards'],
  ['money', 'Money trouble'],
  ['auctions', 'Auctions'],
  ['trades', 'Trading'],
  ['winning', 'Winning'],
  ['twists', 'Twists'],
  ['online', 'Playing online'],
  ['controls', 'Controls'],
] as const

// ---- page furniture ----------------------------------------------------------------------------

function Chapter({
  id,
  n,
  title,
  intro,
  children,
}: {
  id: string
  n: number
  title: string
  intro: string
  children: ReactNode
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-h`}
      className="relative scroll-mt-16 rounded-[22px] lg:scroll-mt-6 bg-card p-6 font-card-body text-card-ink shadow-card sm:p-9"
    >
      <header className="mb-5 flex items-start gap-4">
        <span
          className="flex size-11 flex-none items-center justify-center rounded-full bg-card-ink font-display text-lg font-bold text-card"
          aria-hidden="true"
        >
          {n}
        </span>
        <div className="min-w-0">
          <h2
            id={`${id}-h`}
            className="m-0 font-card text-[28px] leading-tight font-extrabold sm:text-[32px]"
          >
            {title}
          </h2>
          <p className="m-0 mt-1 text-[15px] leading-relaxed text-card-muted">{intro}</p>
        </div>
      </header>
      <div className="flex flex-col gap-5 text-[15px] leading-relaxed [&_p]:m-0">{children}</div>
    </section>
  )
}

function Figure({
  children,
  caption,
  className = '',
}: {
  children: ReactNode
  caption?: string
  className?: string
}) {
  return (
    <figure
      className={`m-0 flex flex-col items-center gap-2.5 rounded-2xl border border-card-edge bg-[#f4efe2] p-4 sm:p-5 ${className}`}
    >
      {children}
      {caption && (
        <figcaption className="max-w-[60ch] text-center text-[13px] leading-snug text-card-muted">
          {caption}
        </figcaption>
      )}
    </figure>
  )
}

const TONES = {
  tip: ['Good to know', '#1d7354', '#e3f1ea'],
  careful: ['Careful', '#b4413a', '#f8e6e3'],
  rule: ['House rule', '#8a6318', '#f8eccd'],
} as const

function Note({ tone = 'tip', children }: { tone?: keyof typeof TONES; children: ReactNode }) {
  const [label, ink, bg] = TONES[tone]
  return (
    <aside
      className="rounded-xl border-l-4 px-4 py-3 text-[14px] leading-relaxed"
      style={{ borderColor: ink, background: bg }}
    >
      <b className="mr-1.5 text-[11px] tracking-[0.16em] uppercase" style={{ color: ink }}>
        {label}
      </b>
      {children}
    </aside>
  )
}

function Steps({ items }: { items: [string, string][] }) {
  return (
    <ol className="m-0 grid list-none gap-2.5 p-0 sm:grid-cols-2">
      {items.map(([title, body], i) => (
        <li key={title} className="flex gap-3 rounded-xl border border-card-edge bg-white px-4 py-3">
          <span className="flex size-7 flex-none items-center justify-center rounded-full bg-accent font-display text-[13px] font-bold text-accent-ink">
            {i + 1}
          </span>
          <span>
            <b className="font-card text-base font-extrabold">{title}</b>
            <span className="block text-[14px] leading-snug text-[#3d4757]">{body}</span>
          </span>
        </li>
      ))}
    </ol>
  )
}

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-card-edge">
      <table className="w-full min-w-[300px] border-collapse text-left text-[14px]">
        <thead>
          <tr className="bg-[#efe8d6]">
            {head.map((h) => (
              <th
                key={h}
                scope="col"
                className="px-3.5 py-2 font-card text-[12px] font-extrabold tracking-[0.1em] text-card-muted uppercase"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-card-edge bg-white">
              {r.map((c, j) => (
                <td key={j} className={`px-3.5 py-2 ${j === 0 ? 'font-bold' : ''}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const Money = ({ v }: { v: number }) => <b className="text-card-money">{fmtMoney(v)}</b>

// ---- chapters ----------------------------------------------------------------------------------

const classic = PRESETS.classic
const sample = SPACES.find((s) => s.name === 'Market Street')!

function twistNames(p: keyof typeof PRESET_TWISTS) {
  const t = PRESET_TWISTS[p]
  const on = [
    t.underdogSalary && 'Comeback',
    t.secondWind && 'Second Wind',
    t.bankTakesEstate && 'Bank takes the city',
  ].filter(Boolean)
  return on.length ? on.join(', ') : 'None'
}

function Chapters() {
  const stations = RAILROADS.map((i) => SPACES[i]!)
  const utility = SPACES[UTILITIES[0]!]!
  const standard = PRESETS.standard
  const turbo = PRESETS.turbo
  return (
    <>
      <Chapter
        id="goal"
        n={1}
        title="The goal"
        intro="Buy the city, build it up, and make everyone else pay to walk through it."
      >
        <p>
          Skyline is a board game for two to six players. Everyone starts with the same pile of money and a
          piece at <b>Launch</b>. You take turns rolling dice and walking your piece around a ring of 40
          spaces. Land on a street that nobody owns and you can buy it. Land on someone else&rsquo;s and you
          pay them rent. Collect whole districts, put houses and hotels on them, and the rent gets serious.
        </p>
        <Steps
          items={[
            [
              'Win by being richest',
              'Standard and Turbo end after a set number of rounds. Whoever has the most net worth then wins.',
            ],
            [
              'Or by being last standing',
              'Run out of money and you are bankrupt and out. If everyone else goes under first, you win straight away.',
            ],
          ]}
        />
        <Note>
          Net worth is your cash, plus your properties at their price, plus what you spent on buildings, minus
          any loan. Mortgaged properties count at their mortgage value.
        </Note>
      </Chapter>

      <Chapter
        id="box"
        n={2}
        title="The board"
        intro="Forty spaces in a ring around a little city. Launch is the bottom-right corner, and play runs clockwise."
      >
        <Figure caption="Every space on the board. Colored bands are streets, grouped into eight districts; the number is the price.">
          <div className="w-full overflow-x-auto">
            <BoardMap />
          </div>
        </Figure>
        <div className="grid gap-2.5 sm:grid-cols-2">
          <Table
            head={['Space', 'How many']}
            rows={[
              ['Streets', '22, in 8 colors'],
              ['Stations', '4'],
              ['Utilities', '2'],
              ['Opportunity / City Fund', '3 / 3'],
              ['Taxes', '2'],
              ['Corners', '4'],
            ]}
          />
          <div className="flex flex-col gap-2.5">
            <p>
              <b>Dice.</b> Two six-sided dice, rolled by the game. The throw you see on the board is just the
              animation of a result the game already settled, so nothing you do on screen can change it.
            </p>
            <p>
              <b>Money.</b> Cash is shown with the <b>₵</b> sign. The bank never runs out of it.
            </p>
            <p>
              <b>Pieces.</b> A taxi, bus, drone, balloon or pawn. They move differently, but it is only for
              looks.
            </p>
          </div>
        </div>
        <DistrictStrip names={DISTRICTS} />
        <Note>
          The city is generated from a seed, so every game builds a different skyline around the same 40
          spaces.
        </Note>
      </Chapter>

      <Chapter
        id="setup"
        n={3}
        title="Setting up"
        intro="Pick a mode, add players and bots, and press Start."
      >
        <p>
          On the setup screen, give each seat a name, a piece and a color, and decide who is a person and who
          is a bot. Then choose a mode:
        </p>
        <Table
          head={['', 'Classic', 'Standard', 'Turbo']}
          rows={[
            [
              'Starting cash',
              fmtMoney(classic.startingCash),
              fmtMoney(standard.startingCash),
              fmtMoney(turbo.startingCash),
            ],
            [
              'Salary at Launch',
              fmtMoney(classic.goSalary),
              fmtMoney(standard.goSalary),
              fmtMoney(turbo.goSalary),
            ],
            [
              'Properties dealt at the start',
              'None',
              `${standard.dealtProperties} each`,
              `${turbo.dealtProperties} each`,
            ],
            [
              'Ends after',
              'Never; play to the end',
              `${standard.roundLimit} rounds`,
              `${turbo.roundLimit} rounds`,
            ],
            ['Twists switched on', twistNames('classic'), twistNames('standard'), twistNames('turbo')],
          ]}
        />
        <p>
          <b>Classic</b> is the long game you know. <b>Standard</b> deals everyone a couple of streets so the
          first laps aren&rsquo;t all shopping, and ends on a round limit. <b>Turbo</b> is faster and bigger:
          more streets, bigger salary, shorter game. Every twist can be switched on or off before you start;
          see{' '}
          <a className="font-bold underline decoration-accent decoration-2 underline-offset-2" href="#twists">
            Twists
          </a>
          .
        </p>
        <Note tone="rule">
          All modes share these: jail fine {fmtMoney(classic.jailFine)}, {classic.houses} houses and{' '}
          {classic.hotels} hotels in the bank, even building, 10% mortgage interest, auctions when you decline
          to buy.
        </Note>
      </Chapter>

      <Chapter
        id="turn"
        n={4}
        title="Your turn"
        intro="Roll, move, deal with where you land, then pass the dice."
      >
        <Steps
          items={[
            [
              'Roll',
              'Press Roll (or Space). Two dice are thrown and your piece walks that many spaces clockwise.',
            ],
            [
              'Land',
              'What happens depends on the space: buy it, pay rent, draw a card, pay a tax, or go to the Lockup.',
            ],
            [
              'Doubles go again',
              'Rolled the same number on both dice? Take another turn after you finish this one.',
            ],
            ['End your turn', 'When nothing is left to resolve, press End turn. The next player is up.'],
          ]}
        />
        <div className="grid items-center gap-4 sm:grid-cols-[auto_1fr]">
          <Figure caption="Doubles">
            <DicePair a={4} b={4} />
          </Figure>
          <div className="flex flex-col gap-2.5">
            <p>
              Roll doubles and you roll again, then again if you keep doing it.{' '}
              <b>The third double in a row sends you straight to the Lockup</b>
              &nbsp;without moving.
            </p>
            <p>
              Passing <b>Launch</b> on the way round pays you a salary of <Money v={classic.goSalary} /> (more
              in Turbo). Landing exactly on it pays once, too.
            </p>
          </div>
        </div>
        <Note>
          You can build, mortgage and make trade offers at any time, even on other people&rsquo;s turns. You
          never have to wait to act on your own plans.
        </Note>
      </Chapter>

      <Chapter
        id="spaces"
        n={5}
        title="Landing on things"
        intro="Every one of the 40 spaces does something when you stop on it."
      >
        <Table
          head={['Space', 'What happens']}
          rows={[
            [
              'A street nobody owns',
              'You may buy it at the price on its card. Decline and it goes to auction.',
            ],
            [
              'A property someone owns',
              'You pay the owner rent. The amount is on the card and grows with sets and buildings.',
            ],
            ['Your own property', 'Nothing. Relax.'],
            ['A mortgaged property', 'No rent. The owner took the cash and gave up the income.'],
            [
              'Launch',
              `You collect your salary (${fmtMoney(classic.goSalary)} in Classic and Standard, more in Turbo).`,
            ],
            ['Opportunity or City Fund', 'Draw the top card and do what it says.'],
            [
              'Income Tax / Luxury Tax',
              `Pay the bank ${fmtMoney(SPACES.find((s) => s.name === 'Income Tax')!.tax)} / ${fmtMoney(SPACES.find((s) => s.name === 'Luxury Tax')!.tax)}.`,
            ],
            ['Central Park', 'A free rest. Nothing happens.'],
            ['Go to Lockup', 'Straight to the Lockup. No salary on the way.'],
            ['Lockup (visiting)', 'Just visiting. No fine, nothing to do.'],
          ]}
        />
        <p>
          Before you roll, hovering a space (or using the odds overlay) shows what landing there would cost or
          earn. It is the quickest way to read the board.
        </p>
      </Chapter>

      <Chapter
        id="sets"
        n={6}
        title="Sets and building"
        intro="One street is a toll booth. A whole district is a business."
      >
        <p>
          Own <b>every street of one color</b> and you hold a <b>set</b>. Two things change straight away:
        </p>
        <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5">
          <li>
            Rent on those streets with no buildings is <b>doubled</b>.
          </li>
          <li>You may start building houses on them.</li>
        </ul>
        <Figure
          caption={`Market Street (${fmtMoney(sample.price)}) as an example. Each house costs ${fmtMoney(sample.houseCost)}; the hotel is the fifth step and costs the same again. With no buildings, a full set pays double the first figure.`}
        >
          <GrowthStrip street="Market Street" />
        </Figure>
        <Table
          head={['Rule', 'How it works']}
          rows={[
            [
              'Build evenly',
              'No street can be more than one step ahead of the others in its set. Selling goes the same way, in reverse.',
            ],
            [
              'Four houses become a hotel',
              'The fifth step swaps the four houses for one hotel. The houses go back in the bank.',
            ],
            [
              'A limited supply',
              `The bank holds ${classic.houses} houses and ${classic.hotels} hotels. When they run out, nobody can build more of that kind.`,
            ],
            [
              'No mortgages in the set',
              'Every street in the district must be un-mortgaged before you build on any of them.',
            ],
            ['In My city', 'One click adds a step to each street in the set at once, in the even order.'],
          ]}
        />
        <Note tone="careful">
          Buildings must be sold before you can trade a district away, and they only sell back for half of
          what you paid.
        </Note>
      </Chapter>

      <Chapter
        id="stations"
        n={7}
        title="Stations and utilities"
        intro="They can't be built on, but they pay by how many of them you own."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <b className="font-card text-lg font-extrabold">Stations</b>
            <p>
              Four of them, {fmtMoney(stations[0]!.price)} each. Rent depends on how many stations the same
              player owns:
            </p>
            <Table
              head={['Owned', 'Rent']}
              rows={stations[0]!.rent.map((r, i) => [`${i + 1}`, <Money key={i} v={r} />])}
            />
          </div>
          <div className="flex flex-col gap-2">
            <b className="font-card text-lg font-extrabold">Utilities</b>
            <p>
              Two of them, {fmtMoney(utility.price)} each. Rent is a multiple of the dice you rolled to land
              there:
            </p>
            <Table
              head={['Owned', 'Rent']}
              rows={utility.rent.map((m, i) => [`${i + 1}`, <b key={i}>{m}&times; the dice</b>])}
            />
          </div>
        </div>
      </Chapter>

      <Chapter
        id="lockup"
        n={8}
        title="The Lockup"
        intro="You land in jail by Go to Lockup, a card, or three doubles. Getting out is easier than it sounds."
      >
        <div className="grid items-center gap-5 sm:grid-cols-[auto_1fr]">
          <Figure>
            <LockupArt />
          </Figure>
          <div className="flex flex-col gap-2.5">
            <p>
              While you are in the Lockup you still collect rent, build, trade and mortgage. You only skip
              moving. On each of your turns you can:
            </p>
            <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5">
              <li>
                <b>Pay the fine</b> of <Money v={classic.jailFine} /> before rolling, then roll and move as
                normal.
              </li>
              <li>
                <b>Use a Get out of Lockup free card</b>, if you hold one.
              </li>
              <li>
                <b>Roll doubles</b> to walk out and move that many spaces. You don&rsquo;t roll again.
              </li>
            </ul>
            <p>
              Fail to roll doubles {classic.maxJailTurns} turns in a row and the fine is paid for you, then
              you move with that last roll.
            </p>
          </div>
        </div>
      </Chapter>

      <Chapter
        id="cards"
        n={9}
        title="Cards"
        intro="Opportunity and City Fund decks. Draw one, do it, and it goes back under the pile."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <CardFace deck="chance" text={CHANCE_CARDS[7]!.text} />
          <CardFace deck="chest" text={CHEST_CARDS[1]!.text} />
          <CardFace deck="chance" text={CHANCE_CARDS[9]!.text} />
          <CardFace deck="chest" text={CHEST_CARDS[8]!.text} />
        </div>
        <p>
          Each deck has {CHANCE_CARDS.length} cards, shuffled with the game&rsquo;s seeded dice at the start.
          Cards can pay you, fine you, move your piece (forward collecting salary if you pass Launch, or
          backward without it), charge you for every house and hotel you own, send you to the Lockup, or hand
          you a keepable Get out of Lockup free card. A card that moves you to a station or utility says what
          the owner is paid.
        </p>
      </Chapter>

      <Chapter
        id="money"
        n={10}
        title="Money trouble"
        intro="Owe more than you have and you need a plan fast."
      >
        <Steps
          items={[
            [
              'Sell buildings',
              'Houses and hotels sell back to the bank for half of what you paid, evenly across the set.',
            ],
            [
              'Mortgage a property',
              'The bank pays half the price. A mortgaged property earns no rent, and its district can’t be built on.',
            ],
            [
              'Lift a mortgage',
              'Pay the mortgage back plus 10% interest to bring the property back to life.',
            ],
            ['Trade', 'Sell properties or cards to other players, for whatever price you can agree.'],
          ]}
        />
        <p>
          If a payment is more than you can cover, it becomes a <b>debt</b> that blocks your turn actions
          until you raise the cash. Other players keep playing, and your debt is paid the moment you can
          afford it.
        </p>
        <p>
          <b>Bankruptcy.</b> If you cannot raise enough, you go bankrupt and leave the game. Your buildings
          are sold back to the bank at half price first. In Standard and Turbo,{' '}
          <b>the bank pays everyone you owed, in full, and takes your whole city back</b>: your streets become
          unowned and un-mortgaged, ready to be bought again. In Classic, the player you owed inherits
          everything.
        </p>
        <Note>
          Standard has Second Wind switched on: a loan can keep you in the game. See{' '}
          <a className="font-bold underline decoration-accent decoration-2 underline-offset-2" href="#twists">
            Twists
          </a>
          .
        </Note>
      </Chapter>

      <Chapter
        id="auctions"
        n={11}
        title="Auctions"
        intro="Say no to a street and everyone gets a shot at it."
      >
        <p>
          When you land on an unowned property and decline to buy, it goes to auction. Bidding starts with the
          player after you and goes round in seat order. On your turn to bid you can <b>raise</b> (by a quick
          step or any amount you can afford) or <b>pass</b>. Once you pass, you are out of that auction. The
          last bidder standing pays their bid and gets the property.
        </p>
        <Figure caption="Quick bids: 1 to 4 raise by a step, or bid the list price.">
          <div className="flex flex-wrap items-center justify-center gap-2">
            {['+10', '+25', '+50', 'List price'].map((l, i) => (
              <span
                key={l}
                className="flex items-center gap-1.5 rounded-lg border border-card-edge bg-white px-3 py-1.5 text-sm font-bold"
              >
                <kbd className="flex size-5 items-center justify-center rounded border border-[#d8cfbb] bg-card font-display text-[11px] shadow-[0_2px_0_#d8cfbb]">
                  {i + 1}
                </kbd>
                {l}
              </span>
            ))}
          </div>
        </Figure>
        <Note tone="careful">If an online turn timer runs out, it counts as a pass.</Note>
      </Chapter>

      <Chapter
        id="trades"
        n={12}
        title="Trading"
        intro="Properties, cash and Lockup cards, any time, in any combination."
      >
        <p>
          Open the trade table (
          <kbd className="rounded border border-[#d8cfbb] bg-white px-1.5 font-display text-xs shadow-[0_2px_0_#d8cfbb]">
            T
          </kbd>
          ) and pick a player. Choose what you give and what you want, add cash if you like, and send the
          offer. They can accept, decline, or ignore it. A few notes:
        </p>
        <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5">
          <li>
            You can have up to <b>{classic.maxOpenTrades}</b> offers out at once.
          </li>
          <li>An offer cancels itself the moment anything in it changes hands or gets built on.</li>
          <li>You can&rsquo;t trade away a district that has buildings. Sell them first.</li>
          <li>Receiving a mortgaged property costs you the 10% fee, which is shown before you accept.</li>
          <li>Bots make offers too, and they answer yours.</li>
        </ul>
      </Chapter>

      <Chapter id="winning" n={13} title="Winning" intro="Two ways the game can end.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Figure className="items-stretch !gap-1 text-left">
            <b className="font-card text-lg font-extrabold">Last one standing</b>
            <p>Everyone else is bankrupt. You win on the spot, in any mode.</p>
          </Figure>
          <Figure className="items-stretch !gap-1 text-left">
            <b className="font-card text-lg font-extrabold">The round limit</b>
            <p>
              In Standard ({standard.roundLimit} rounds) and Turbo ({turbo.roundLimit}), the player with the
              highest net worth when the last round ends wins.
            </p>
          </Figure>
        </div>
        <p>
          After the last turn, a results screen shows how the game went: net worth round by round, and each
          player&rsquo;s rent collected and paid, buying, building, trades and best earning space.
        </p>
      </Chapter>

      <Chapter
        id="twists"
        n={14}
        title="Twists"
        intro="Optional rules that make the game kinder, faster, or stranger. Switch them on at setup."
      >
        <TwistBlock title="Comeback" tag="on in Standard">
          <p>
            Passing Launch while behind pays a <b>bonus on top of your salary</b>, growing with how far behind
            you are. The leader gets the normal salary and nobody&rsquo;s money is taken away. By default the
            bonus reaches double the salary for someone two thirds behind or more; a slider at setup changes
            the top end.
          </p>
          <Figure caption="Behind by two thirds or more: the salary pays double extra.">
            <div className="flex items-center gap-3 font-display text-lg font-bold">
              <Coins n={2} />
              <span>
                {fmtMoney(classic.goSalary)} <span className="text-card-muted">+</span>{' '}
                <span className="text-card-money">{fmtMoney(classic.goSalary * 2)}</span>
              </span>
            </div>
          </Figure>
        </TwistBlock>

        <TwistBlock title="Second Wind" tag="on in Standard">
          <p>
            Can&rsquo;t pay a bill? Take a <b>bank loan</b> for exactly the shortfall instead of selling
            anything. The bank pays the creditor at once, you keep every building, and your city keeps
            earning. <b>Half of everything you earn goes to repaying it</b>, plus interest: 10% the first
            time, 25% the second, 50% after that. You can borrow up to what your city is worth, one loan at a
            time. A loan counts against your net worth.
          </p>
          <Figure caption="The gold bar on your player card drains with every repayment.">
            <div className="w-full max-w-[360px]">
              <LoanBar left={140} of={220} />
            </div>
          </Figure>
        </TwistBlock>

        <TwistBlock title="Bank takes the city" tag="on in Standard and Turbo">
          <p>
            When a player goes bankrupt, the bank pays everyone they owed, in full, and takes their properties
            back for sale. It stops one lucky creditor from inheriting a whole district in a single move.
          </p>
        </TwistBlock>

        <TwistBlock title="Speed die" tag="off by default">
          <p>
            A third, amber die rolls with your two white ones. Its faces are 1, 2, 3, Bus, and two Scouts.
          </p>
          <Figure caption="The six faces of the Speed die.">
            <SpeedFaces />
          </Figure>
          <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5">
            <li>
              <b>1, 2 or 3</b> adds to your move.
            </li>
            <li>
              <b>Bus</b>: choose to move by one die, the other die, or both. Pick a destination on the board.
            </li>
            <li>
              <b>Scout</b>: move by the white dice and resolve that space, then jump to the nearest lot still
              for sale. If none is left, to the nearest rival property that charges rent.
            </li>
            <li>
              <b>Triples</b> (all three dice the same): after the normal move, go to any space on the board.
            </li>
          </ul>
          <Note tone="rule">
            Three white-dice doubles still send you to the Lockup, and triples don&rsquo;t count as doubles.
            The Speed die isn&rsquo;t rolled when you try to leave the Lockup.
          </Note>
        </TwistBlock>
      </Chapter>

      <Chapter id="online" n={15} title="Playing online" intro="Same game, each player on their own device.">
        <Steps
          items={[
            [
              'Create a room',
              'Choose Play online on the setup screen, pick a name and color, and press Create room.',
            ],
            [
              'Share the link',
              'The room has a short code. Send the invite link, or let friends enter the code.',
            ],
            [
              'Fill the seats',
              'Up to six seats. The host can add bots, kick, lock the room, and pick the mode, twists and a turn timer.',
            ],
            [
              'Ready, then Start',
              'Everyone presses Ready, the host starts, and the same game screen opens for everybody.',
            ],
          ]}
        />
        <p>
          A central room decides every roll and checks every move, so nobody can cheat from their end. Refresh
          the page or lose the connection and you drop right back into your seat. If you stay away for a
          minute and the host allowed it, a bot plays for you until you return.
        </p>
      </Chapter>

      <Chapter
        id="controls"
        n={16}
        title="Controls"
        intro="Everything works with a mouse, a finger or a keyboard."
      >
        <div className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
          {SHORTCUTS.map(([keys, what]) => (
            <div
              key={keys.join() + what}
              className="flex items-center gap-3 border-b border-dashed border-[#e7dfcd] pb-2"
            >
              <span className="flex w-[84px] flex-none gap-1">
                {keys.map((k) => (
                  <kbd
                    key={k}
                    className="flex h-[26px] min-w-[22px] items-center justify-center rounded-md border border-[#d8cfbb] bg-white px-[7px] font-display text-xs font-bold shadow-[0_3px_0_#d8cfbb]"
                  >
                    {k}
                  </kbd>
                ))}
              </span>
              <span className="text-[14px] text-[#3d4757]">{what}</span>
            </div>
          ))}
        </div>
        <p>
          On a phone: tap a space to read it, press and hold for more, and pull panels up from the bottom. In
          the menu you can slow down or skip animations, switch day and night, turn the music off, turn on
          reduced motion, or switch on battery saver.
        </p>
      </Chapter>
    </>
  )
}

function TwistBlock({ title, tag, children }: { title: string; tag: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-card-edge bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2.5">
        <h3 className="m-0 font-card text-xl font-extrabold">{title}</h3>
        <span className="rounded-full bg-[#f8eccd] px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-[#8a6318] uppercase">
          {tag}
        </span>
      </div>
      {children}
    </div>
  )
}

// ---- the page ----------------------------------------------------------------------------------

/** The rulebook at /how-to-play: a book of chapters with a contents list that follows the reader. */
export function RulebookScreen() {
  const scroller = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState<string>(CHAPTERS[0][0])

  useEffect(() => {
    const root = scroller.current
    if (!root) return
    const seen = new Map<string, boolean>()
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(e.target.id, e.isIntersecting)
        const first = CHAPTERS.find(([id]) => seen.get(id))
        if (first) setActive(first[0])
      },
      { root, rootMargin: '-10% 0px -70% 0px' },
    )
    for (const [id] of CHAPTERS) {
      const el = document.getElementById(id)
      if (el) io.observe(el)
    }
    return () => io.disconnect()
  }, [])

  // Deep links: /how-to-play#twists opens at that chapter.
  useEffect(() => {
    const id = window.location.hash.slice(1)
    if (CHAPTERS.some(([c]) => c === id)) document.getElementById(id)?.scrollIntoView()
  }, [])

  useEffect(() => {
    const prev = document.title
    document.title = 'How to play · Skyline'
    return () => {
      document.title = prev
    }
  }, [])

  const goto = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault()
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActive(id)
  }

  return (
    <div
      ref={scroller}
      className="h-full overflow-y-auto scroll-smooth bg-[radial-gradient(ellipse_at_top,#16264a_0%,var(--color-table)_60%)]"
    >
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-8 px-4 pt-5 pb-24 sm:px-6">
        <nav className="flex items-center justify-between gap-3" aria-label="Site">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex items-center gap-2 rounded-xl border border-line px-3.5 py-2 text-sm font-bold text-ink transition-[background-color,scale] duration-200 ease-spring hover:bg-white/5 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <span aria-hidden="true">&larr;</span> Back to the game
          </button>
          <span className="flex items-center gap-2 font-display text-sm font-bold text-ink-muted">
            <SkylineIcon size={20} /> Skyline
          </span>
        </nav>

        <header className="relative overflow-hidden rounded-[26px] border border-line bg-panel px-6 py-10 text-center shadow-panel-lg sm:px-12 sm:py-14">
          <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-24 opacity-30">
            <svg viewBox="0 0 800 96" preserveAspectRatio="none" className="size-full">
              {Array.from({ length: 26 }).map((_, i) => {
                const h = 24 + ((i * 37) % 60)
                return (
                  <rect
                    key={i}
                    x={i * 31 + 4}
                    y={96 - h}
                    width={24}
                    height={h}
                    rx={2}
                    fill={groupColor(i % 8)}
                    opacity={0.55}
                  />
                )
              })}
            </svg>
          </div>
          <div className="relative flex flex-col items-center gap-3">
            <span className="font-card text-[13px] font-extrabold tracking-[0.3em] text-accent uppercase">
              The rulebook
            </span>
            <h1 className="m-0 font-display text-[40px] leading-[1.05] font-extrabold sm:text-[60px]">
              How to play Skyline
            </h1>
            <p className="m-0 max-w-[52ch] text-base leading-relaxed text-ink-muted sm:text-lg">
              Roll, buy, build and scheme. A city board game for two to six players, with bots that play well
              and a few rules of our own on top of the classics.
            </p>
            <div className="mt-2 flex flex-wrap justify-center gap-2 text-xs font-bold text-ink-muted">
              {['2 to 6 players', 'Bots and online', 'Phone friendly'].map((t) => (
                <span key={t} className="rounded-full border border-line px-3 py-1">
                  {t}
                </span>
              ))}
            </div>
          </div>
        </header>

        {/* Phones: the contents are a row of chips that scrolls sideways under the header. */}
        <nav
          aria-label="Chapters"
          className="sticky top-0 z-10 -mx-4 overflow-x-auto bg-table/90 px-4 py-2 backdrop-blur lg:hidden"
        >
          <ul className="m-0 flex list-none gap-2 p-0">
            {CHAPTERS.map(([id, label]) => (
              <li key={id} className="flex-none">
                <a
                  href={`#${id}`}
                  onClick={goto(id)}
                  aria-current={active === id ? 'true' : undefined}
                  className={`block rounded-full border px-3 py-1.5 text-[13px] font-bold whitespace-nowrap transition-colors ${active === id ? 'border-accent bg-accent text-accent-ink' : 'border-line text-ink-muted'}`}
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="grid items-start gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
          <nav aria-label="Chapters" className="sticky top-6 hidden lg:block">
            <p className="m-0 mb-2 px-3 font-card text-[12px] font-extrabold tracking-[0.2em] text-ink-muted uppercase">
              Contents
            </p>
            <ol className="m-0 flex list-none flex-col gap-0.5 p-0">
              {CHAPTERS.map(([id, label], i) => (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    onClick={goto(id)}
                    aria-current={active === id ? 'true' : undefined}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm font-bold transition-colors ${active === id ? 'bg-white/10 text-accent' : 'text-ink-muted hover:bg-white/5 hover:text-ink'}`}
                  >
                    <span className="w-5 text-right font-display text-xs opacity-70">{i + 1}</span>
                    {label}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
          <main className="flex min-w-0 flex-col gap-6">
            <Chapters />
            <footer className="flex flex-col items-center gap-3 rounded-[22px] border border-line bg-panel px-6 py-9 text-center">
              <h2 className="m-0 font-display text-2xl font-extrabold">Ready to play?</h2>
              <p className="m-0 text-ink-muted">
                The best way to learn is to roll the dice. The game shows you what each space costs before you
                land.
              </p>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="mt-1 h-14 rounded-[16px] bg-accent px-8 font-display text-lg font-bold text-accent-ink shadow-gold-lg transition-[scale] duration-200 ease-spring hover:-translate-y-px active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                Start a game
              </button>
            </footer>
          </main>
        </div>
      </div>
    </div>
  )
}
