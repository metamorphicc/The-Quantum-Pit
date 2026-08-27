import { useMemo } from 'react'
import { P } from '../styles/palette'
const CHARS: Record<string, string> = {
  k: P.ink,
  K: P.shadow,
  u: P.woodDark,
  w: P.wood,
  W: P.woodLit,
  o: P.goldDark,
  g: P.gold,
  G: P.goldLit,
  q: P.emberDeep,
  e: P.ember,
  E: P.emberLit,
  t: P.teal,
  T: P.tealLit,
  c: P.spirit,
  C: P.spiritLit,
  B: P.spiritPale,
  b: P.bone,
  n: P.boneDim,
  N: P.boneDeep,
  r: P.blood,
  R: P.bloodLit,
  d: P.plateDark,
  l: P.plateLit,
  p: P.skin,
  y: P.straw,
  Y: P.strawLit,
  m: P.green,
  M: P.greenLit,
  s: P.stone,
  S: P.stoneHi,
}

const ART = {
  stew: [
    '..kkkk..',
    '.kbbbbk.',
    'kbbkbbbk',
    'kbMMMMbk',
    'kbbbbbbk',
    'kbgggbbk',
    '.kkkkkk.',
    '........',
  ],
  bolt: [
    '.....GG.',
    '....GG..',
    '...GG...',
    '..GGGG..',
    '.GGGG...',
    '...GG...',
    '..GG....',
    '.GG.....',
  ],
  mask: [
    '.kkkkkk.',
    'kbbbbbbk',
    'kbkbbkbk',
    'kbbbbbbk',
    'kbkkkkbk',
    '.kbbbbk.',
    '..kbbk..',
    '...kk...',
  ],
  brush: [
    '.kkkkkk.',
    'kbCCCCbk',
    'kbbbbbbk',
    'kbkbkbkk',
    'kbbbbbbk',
    'kbkbkbkk',
    '.kkkkkk.',
    '........',
  ],
  flame: [
    '..kkkk..',
    '.keEEek.',
    'kebbbbek',
    'keEbbEek',
    'kebbEbek',
    'keEEEEek',
    '.keeeek.',
    '..kkkk..',
  ],
  coin: [
    'kkkkkkkk',
    'kMMMMMMk',
    'kMMbMMMk',
    'kMbMMbMk',
    'kMMMbMMk',
    'kMMbMMMk',
    'kMMMMMMk',
    'kkkkkkkk',
  ],
  shard: [
    '...c....',
    '..cCc...',
    '.cCBCc..',
    'cCBBBCc.',
    '.cCBCc..',
    '..cCc...',
    '...c....',
    '........',
  ],
  bed: [
    '..kkkk..',
    '.kllllk.',
    'kllllllk',
    '..dkkd..',
    '.dkkkkd.',
    '.d....d.',
    'd......d',
    '........',
  ],
  dice: [
    'kkkkkkkk',
    'kCCkCCkk',
    'kCkkkCkk',
    'kCCCCCCk',
    'kkkCCkkk',
    'kCkkkkCk',
    'kkkkkkkk',
    '........',
  ],
  /** a little cathode terminal on a stand - the ticket machine */
  terminal: [
    'kkkkkkkk',
    'kCMMMCCk',
    'kMMCCMMk',
    'kCCMMMmk',
    'kkkkkkkk',
    '..kkkk..',
    '.kllllk.',
    'kkkkkkkk',
  ],
  star: [
    '...c....',
    '...C....',
    '.c.C.c..',
    '..CBC...',
    'cCBBBCc.',
    '..CBC...',
    '.c.C.c..',
    '...c....',
  ],
  gear: [
    '..n..n..',
    '.nnnnnn.',
    'nnkkkknn',
    '.nk..kn.',
    '.nk..kn.',
    'nnkkkknn',
    '.nnnnnn.',
    '..n..n..',
  ],
  lock: [
    '..bbbb..',
    '.b....b.',
    '.b....b.',
    'gggggggg',
    'gGGGGGGg',
    'gGGkkGGg',
    'gGGkkGGg',
    'gggggggg',
  ],
  bag: [
    '..k..k..',
    '..kkkk..',
    '.kwwwwk.',
    'kwWWWWwk',
    'kwWggWwk',
    'kwWWWWwk',
    'kwwwwwwk',
    '.kkkkkk.',
  ],
  arrowLeft: [
    '........',
    '...b....',
    '..bb....',
    '.bbbbbbb',
    'bbbbbbbb',
    '.bbbbbbb',
    '..bb....',
    '...b....',
  ],
  close: [
    'bb....bb',
    '.bb..bb.',
    '..bbbb..',
    '...bb...',
    '...bb...',
    '..bbbb..',
    '.bb..bb.',
    'bb....bb',
  ],
  check: [
    '........',
    '......Mm',
    '.....MM.',
    '....MM..',
    '.m..MM..',
    '.MMMM...',
    '..MM....',
    '........',
  ],
  plus: [
    '........',
    '...bb...',
    '...bb...',
    '.bbbbbb.',
    '.bbbbbb.',
    '...bb...',
    '...bb...',
    '........',
  ],
  skull: [
    '.bbbbbb.',
    'bbbbbbbb',
    'bkkbbkkb',
    'bkkbbkkb',
    'bbbbbbbb',
    '.bkbkbb.',
    '..bbbb..',
    '...bb...',
  ],
  torch: [
    'kkkkkkkk',
    'kCccCcck',
    'kccCccCk',
    'kCCCcCCk',
    'kccCccck',
    'kkkkkkkk',
    '..kkkk..',
    '........',
  ],
  warden: [
    '..dddd..',
    '.dppppd.',
    '.pkppkp.',
    '.dbbbbd.',
    '.dlllld.',
    'ddbbbbdd',
    'dgddddgd',
    '..dddd..',
  ],
  bread: [
    '........',
    '..kkkk..',
    '.kWWWWk.',
    'kWwWWwWk',
    'kWWwWWWk',
    'kWWWWWWk',
    '.kkkkkk.',
    '........',
  ],
  fish: [
    '........',
    '.kkkk.k.',
    'ktTTTktk',
    'kTkTTTTk',
    'ktTTTktk',
    '.kkkk.k.',
    '........',
    '........',
  ],
  mushroom: [
    '..rrrr..',
    '.rRbbRr.',
    'rRbRRbRr',
    'rRRRRRRr',
    '.kkkkkk.',
    '..bnnb..',
    '..bnnb..',
    '..kkkk..',
  ],
  meat: [
    '.....bb.',
    '....bbb.',
    '..rrrb..',
    '.rRRRr..',
    'rRRRRr..',
    'rRRRr...',
    '.rrr....',
    '........',
  ],
  ale: [
    '.nnnnn..',
    'nbbbbbn.',
    'nWWWWWn.',
    'nWWWWWnn',
    'nWWWWWn.',
    'nWWWWWnn',
    'nWWWWWn.',
    '.nnnnn..',
  ],
  honey: [
    '..kkkk..',
    '..kGGk..',
    '.kkkkkk.',
    'kGGGGGGk',
    'kGgGGgGk',
    'kGGGGGGk',
    'kGgGGGGk',
    '.kkkkkk.',
  ],
  potion: [
    '...kk...',
    '...ww...',
    '..kkkk..',
    '.kCCCCk.',
    'kCCcCCCk',
    'kCcccCCk',
    'kCCCCCCk',
    '.kkkkkk.',
  ],
  helm: [
    'kkkkkkkk',
    'kCMMMCkk',
    'kMMMMMCk',
    'kkkkkkkk',
    '..dddd..',
    '.dlllld.',
    'dlllllld',
    '........',
  ],
  crown: [
    '........',
    'G..GG..G',
    'G.GGGG.G',
    'GGGGGGGG',
    'gGGrrGGg',
    'gggggggg',
    'kkkkkkkk',
    '........',
  ],
  antler: [
    'b......b',
    '.b.dd.b.',
    'b.dddd.b',
    '.bddddb.',
    '..dllld.',
    '..dkkkd.',
    '...ddd..',
    '........',
  ],
  cloak: [
    '.t....t.',
    'tTt..tTt',
    'tTTttTTt',
    'tTTTTTTt',
    'tTTTTTTt',
    'tTTTTTTt',
    'tTtTTtTt',
    '.t.tt.t.',
  ],
  pelt: [
    '..NNNN..',
    '.NnnnnN.',
    'NnbbbbnN',
    'NnbnnbnN',
    'NnbbbbnN',
    '.NnnnnN.',
    '.N.nn.N.',
    '..N..N..',
  ],
  sword: [
    '..kkkk..',
    '.kbbbbk.',
    'kbMMMMbk',
    'kbbbbbbk',
    'kbMMMMbk',
    '.kkkkkk.',
    '..kk....',
    '.kkkk...',
  ],
  swordBlue: [
    '........',
    'k.....Ck',
    'k...CCkk',
    'k.CC..kk',
    'kC....kk',
    'kkkkkkkk',
    '........',
    '........',
  ],
  swordRed: [
    'kkkkkkkk',
    'keeeeEek',
    'kebbEbek',
    'keEbbbek',
    'kebbEbek',
    'keeeeEek',
    'kkkkkkkk',
    '........',
  ],
} as const

export type IconName = keyof typeof ART

export const ICON_NAMES = Object.keys(ART) as IconName[]

interface Run {
  x: number
  y: number
  w: number
  fill: string
}

/** Merge horizontal runs of the same colour into single rects. */
function toRuns(rows: readonly string[]): Run[] {
  const runs: Run[] = []
  rows.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      const ch = row[x]!
      if (ch === '.' || !CHARS[ch]) {
        x++
        continue
      }
      let w = 1
      while (x + w < row.length && row[x + w] === ch) w++
      runs.push({ x, y, w, fill: CHARS[ch]! })
      x += w
    }
  })
  return runs
}

const runCache = new Map<IconName, Run[]>()

function runsFor(name: IconName): Run[] {
  let runs = runCache.get(name)
  if (!runs) {
    runs = toRuns(ART[name])
    runCache.set(name, runs)
  }
  return runs
}

export interface PixelIconProps {
  name: IconName
  /** rendered size in px - use multiples of 8 for perfect pixels */
  size?: number
  className?: string
  /** paints every pixel one colour (silhouette mode) */
  tint?: string
  style?: React.CSSProperties
}

export function PixelIcon({ name, size = 16, className, tint, style }: PixelIconProps) {
  const runs = useMemo(() => runsFor(name), [name])
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 8 8"
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
      style={{ display: 'block', flex: '0 0 auto', ...style }}
    >
      {runs.map((r, i) => (
        <rect
          key={i}
          x={r.x}
          y={r.y}
          width={r.w}
          height={1}
          fill={tint ?? r.fill}
        />
      ))}
    </svg>
  )
}
