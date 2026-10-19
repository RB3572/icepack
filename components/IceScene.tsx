// Decorative ice scenery. Pure SVG, no hooks, so it can sit in server or client trees.

const f = (n: number) => Math.round(n * 100) / 100;

// Seamless horizontal wave: quadratic half-periods, repeats every `period` units.
function wavePath(y: number, amp: number, period: number, width: number, bottom: number) {
  let d = `M${-period},${y}`;
  let x = -period;
  let up = true;
  while (x < width + period) {
    d += ` Q${f(x + period / 4)},${f(up ? y - 2 * amp : y + 2 * amp)} ${f(x + period / 2)},${y}`;
    x += period / 2;
    up = !up;
  }
  return `${d} L${f(x)},${bottom} L${-period},${bottom} Z`;
}

const FLAKES = [
  [60, 2.1, 9, 0], [130, 1.4, 12, 3], [205, 1.8, 10, 6], [290, 1.3, 13, 1],
  [372, 2, 9.5, 4], [455, 1.5, 12.5, 7], [540, 1.9, 10.5, 2], [622, 1.3, 13.5, 5],
  [705, 2.2, 9, 8], [790, 1.5, 11.5, 3], [868, 1.8, 10, 6], [950, 1.3, 13, 0],
  [1030, 2, 9.5, 4], [1090, 1.5, 12, 7],
] as const;

// Faces right; stands with its feet on (0, 0). `flip` mirrors it to face left.
function Penguin({
  x,
  y,
  scale = 1,
  flip = false,
  delay = 0,
}: {
  x: number;
  y: number;
  scale?: number;
  flip?: boolean;
  delay?: number;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -scale : scale} ${scale})`}>
      <g className="penguin" style={{ animationDelay: `-${delay}s` }}>
        <ellipse cx="-2.6" cy="-0.6" rx="3.2" ry="1.3" fill="#f2a33a" />
        <ellipse cx="3.2" cy="-0.6" rx="3.2" ry="1.3" fill="#f2a33a" />
        <ellipse cx="0" cy="-11" rx="7" ry="11" fill="#0d3d5c" />
        <ellipse cx="1.4" cy="-9.2" rx="4.4" ry="8" fill="#ffffff" />
        <ellipse cx="-5.6" cy="-9.5" rx="1.9" ry="5.6" transform="rotate(14 -5.6 -9.5)" fill="#0b3556" />
        <path d="M2.6 -17.6 L7.6 -16 L2.8 -14.8Z" fill="#f2a33a" />
        <circle cx="2" cy="-18.4" r="1.5" fill="#ffffff" />
        <circle cx="2.4" cy="-18.4" r="0.7" fill="#0d3d5c" />
      </g>
    </g>
  );
}

export function MastheadScene() {
  const W = 1120;
  const H = 140;
  return (
    <svg
      className="masthead-scene"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMaxYMax slice"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="ms-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b9def2" />
          <stop offset="0.7" stopColor="#dcf0fa" />
          <stop offset="1" stopColor="#eef9fe" />
        </linearGradient>
        <radialGradient id="ms-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ms-sub" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e6f6fd" stopOpacity="0.8" />
          <stop offset="1" stopColor="#bfe5f7" stopOpacity="0.25" />
        </linearGradient>
      </defs>

      <rect width={W} height={H} fill="url(#ms-sky)" />
      <ellipse cx="930" cy="70" rx="210" ry="76" fill="url(#ms-glow)" />

      <path
        d="M440 96 L500 72 L532 82 L578 54 L622 78 L660 62 L714 88 L756 68 L812 84 L872 58 L926 80 L988 50 L1040 76 L1090 56 L1120 66 L1120 96Z"
        fill="#cbe6f5"
        opacity="0.85"
      />
      <path
        d="M578 54 L596 70 L578 78Z M988 50 L1008 68 L990 76Z M872 58 L890 72 L872 80Z"
        fill="#eaf7fd"
        opacity="0.9"
      />

      {FLAKES.map(([x, r, dur, delay]) => (
        <circle
          key={x}
          className="flake"
          cx={x}
          cy={0}
          r={r}
          fill="#ffffff"
          style={{ animationDuration: `${dur}s`, animationDelay: `-${delay}s` }}
        />
      ))}

      <g className="berg" style={{ animationDuration: "9s", animationDelay: "-2s" }}>
        <path d="M556 96 L572 80 L588 74 L602 60 L618 78 L640 84 L650 96Z" fill="#c9e8f7" />
        <path d="M556 96 L572 80 L588 74 L602 60 L610 96Z" fill="#ffffff" />
        <path d="M618 78 L640 84 L650 96 L626 96Z" fill="#a9d9f1" />
        <path d="M556 96 L650 96 L664 110 L632 130 L588 132 L560 112Z" fill="url(#ms-sub)" />
      </g>

      <g className="berg" style={{ animationDuration: "6s", animationDelay: "-4s" }}>
        <path d="M674 96 L683 87 L715 87 L726 96Z" fill="#e3f4fc" />
        <path d="M674 96 L683 87 L700 87 L704 96Z" fill="#ffffff" />
        <path d="M674 96 L726 96 L714 109 L688 109Z" fill="url(#ms-sub)" />
        <Penguin x={700} y={87} scale={1.5} />
      </g>

      <g className="berg" style={{ animationDuration: "11s" }}>
        <path
          d="M736 96 L756 68 L772 62 L792 42 L810 16 L826 36 L842 32 L864 56 L888 68 L906 96Z"
          fill="#c9e8f7"
        />
        <path d="M736 96 L756 68 L772 62 L792 42 L810 16 L824 96Z" fill="#ffffff" />
        <path d="M842 32 L864 56 L888 68 L906 96 L868 96 L850 62Z" fill="#a9d9f1" />
        <path d="M810 16 L824 96" stroke="#8fd0ee" strokeWidth="1" opacity="0.7" fill="none" />
        <path
          d="M736 96 L906 96 L928 116 L882 138 L812 142 L756 130 L722 110Z"
          fill="url(#ms-sub)"
        />
      </g>

      <g className="berg" style={{ animationDuration: "8s", animationDelay: "-5s" }}>
        <path d="M966 96 L984 80 L1000 74 L1014 60 L1032 82 L1048 96Z" fill="#c9e8f7" />
        <path d="M966 96 L984 80 L1000 74 L1014 60 L1020 96Z" fill="#ffffff" />
        <path d="M1032 82 L1048 96 L1030 96Z" fill="#a9d9f1" />
        <path d="M966 96 L1048 96 L1060 110 L1026 130 L988 130 L962 112Z" fill="url(#ms-sub)" />
      </g>

      <g className="berg" style={{ animationDuration: "7s", animationDelay: "-1s" }}>
        <path d="M1056 96 L1066 87 L1108 87 L1118 96Z" fill="#e3f4fc" />
        <path d="M1056 96 L1066 87 L1086 87 L1090 96Z" fill="#ffffff" />
        <path d="M1056 96 L1118 96 L1106 109 L1070 109Z" fill="url(#ms-sub)" />
        <Penguin x={1082} y={87} scale={1.5} flip delay={0.9} />
        <Penguin x={1101} y={87} scale={0.9} flip delay={1.8} />
      </g>

      <g className="wave" style={{ ["--shift" as string]: "-180px", animationDuration: "26s" }}>
        <path d={wavePath(97, 2.5, 180, W, H)} fill="#8fd0ee" opacity="0.62" />
      </g>
      <g className="wave" style={{ ["--shift" as string]: "220px", animationDuration: "21s" }}>
        <path d={wavePath(109, 3.5, 220, W, H)} fill="#5fb6e0" opacity="0.88" />
      </g>
      <g className="wave" style={{ ["--shift" as string]: "-260px", animationDuration: "17s" }}>
        <path d={wavePath(123, 3, 260, W, H)} fill="#2176ae" />
      </g>
    </svg>
  );
}

export function FooterWaves() {
  const W = 1120;
  const H = 34;
  return (
    <svg
      className="footer-waves"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
      focusable="false"
    >
      <g className="berg" style={{ animationDuration: "10s", animationDelay: "-3s" }}>
        <path d="M120 22 L134 11 L148 8 L158 -2 L172 12 L190 22Z" fill="#c9e8f7" />
        <path d="M120 22 L134 11 L148 8 L158 -2 L164 22Z" fill="#ffffff" />
      </g>
      <g className="berg" style={{ animationDuration: "8s", animationDelay: "-6s" }}>
        <path d="M930 22 L942 14 L956 12 L964 4 L976 16 L990 22Z" fill="#c9e8f7" />
        <path d="M930 22 L942 14 L956 12 L964 4 L968 22Z" fill="#ffffff" />
      </g>
      <g className="wave" style={{ ["--shift" as string]: "200px", animationDuration: "24s" }}>
        <path d={wavePath(22, 2.5, 200, W, H)} fill="#5fb6e0" opacity="0.8" />
      </g>
      <g className="wave" style={{ ["--shift" as string]: "-240px", animationDuration: "19s" }}>
        <path d={wavePath(28, 2.5, 240, W, H)} fill="#2176ae" />
      </g>
    </svg>
  );
}

export function FrozenPadlock() {
  return (
    <svg
      className="frozen-lock"
      viewBox="0 0 220 124"
      role="img"
      aria-label="A padlock frozen into an iceberg"
    >
      <defs>
        <linearGradient id="fl-sub" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e6f6fd" stopOpacity="0.9" />
          <stop offset="1" stopColor="#8fd0ee" stopOpacity="0.2" />
        </linearGradient>
      </defs>
      <g className="berg" style={{ animationDuration: "9s" }}>
        <path d="M50 70 L72 46 L92 40 L112 14 L132 40 L152 36 L180 70Z" fill="#c9e8f7" />
        <path d="M50 70 L72 46 L92 40 L112 14 L118 70Z" fill="#ffffff" />
        <path d="M152 36 L180 70 L150 70 L140 46Z" fill="#a9d9f1" />
        <path d="M50 70 L180 70 L200 94 L160 118 L96 120 L58 100Z" fill="url(#fl-sub)" />
        <g transform="translate(100 44)">
          <path
            d="M6 14 V9 a8 8 0 0 1 16 0 V14"
            fill="none"
            stroke="#155b8a"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <rect x="2" y="13" width="24" height="17" rx="3" fill="#155b8a" />
          <circle cx="14" cy="21" r="2.6" fill="#e6f6fd" />
          <rect x="13" y="22" width="2" height="5" rx="1" fill="#e6f6fd" />
        </g>
      </g>
      <g className="berg" style={{ animationDuration: "7s", animationDelay: "-2s" }}>
        <path d="M164 76 L172 66 L206 66 L214 76Z" fill="#e3f4fc" />
        <path d="M164 76 L172 66 L188 66 L192 76Z" fill="#ffffff" />
        <Penguin x={186} y={66} flip />
      </g>
      <g className="wave" style={{ ["--shift" as string]: "-120px", animationDuration: "14s" }}>
        <path d={wavePath(72, 2.5, 120, 220, 124)} fill="#8fd0ee" opacity="0.6" />
      </g>
      <g className="wave" style={{ ["--shift" as string]: "140px", animationDuration: "11s" }}>
        <path d={wavePath(84, 3, 140, 220, 124)} fill="#5fb6e0" opacity="0.9" />
      </g>
      <g className="wave" style={{ ["--shift" as string]: "-160px", animationDuration: "9s" }}>
        <path d={wavePath(98, 3, 160, 220, 124)} fill="#2176ae" />
      </g>
    </svg>
  );
}

const HAIRPINS: Array<[number, number, number, number]> = [
  [112, 186, -14, 1],
  [196, 208, 8, 0.9],
  [268, 184, 18, 1.05],
  [150, 232, 168, 0.9],
  [232, 240, 190, 0.95],
];

export function IcebergFigure() {
  return (
    <figure className="berg-figure">
      <svg
        viewBox="0 0 380 272"
        role="img"
        aria-label="An iceberg: the visible tip is the minimum free energy structure and the submerged bulk is the rest of the ensemble"
      >
        <defs>
          <linearGradient id="bf-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#c4e5f6" />
            <stop offset="1" stopColor="#eef9fe" />
          </linearGradient>
          <linearGradient id="bf-sea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#8fd0ee" />
            <stop offset="1" stopColor="#155b8a" />
          </linearGradient>
          <linearGradient id="bf-body" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f3fbff" stopOpacity="0.85" />
            <stop offset="1" stopColor="#bfe5f7" stopOpacity="0.28" />
          </linearGradient>
        </defs>
        <rect width="380" height="272" rx="4" fill="url(#bf-sea)" />
        <rect width="380" height="100" rx="4" fill="url(#bf-sky)" />
        <rect y="96" width="380" height="4" fill="url(#bf-sky)" />
        <path
          d="M0 100 Q24 96 48 100 T96 100 T144 100 T192 100 T240 100 T288 100 T336 100 T384 100"
          fill="none"
          stroke="#f2fbff"
          strokeWidth="1.6"
        />
        <g className="berg" style={{ animationDuration: "9s", animationDelay: "-3s" }}>
          <path d="M16 100 L26 91 L72 91 L84 100Z" fill="#e3f4fc" />
          <path d="M16 100 L26 91 L50 91 L54 100Z" fill="#ffffff" />
          <Penguin x={52} y={91} scale={1.25} />
        </g>
        <g className="berg" style={{ animationDuration: "12s" }}>
          <path
            d="M96 100 L122 70 L148 62 L166 36 L188 10 L206 38 L224 30 L252 62 L286 76 L304 100Z"
            fill="#c9e8f7"
          />
          <path d="M96 100 L122 70 L148 62 L166 36 L188 10 L205 100Z" fill="#ffffff" />
          <path d="M224 30 L252 62 L286 76 L304 100 L258 100 L238 66Z" fill="#a9d9f1" />
          <path
            d="M96 100 L304 100 L330 140 L304 196 L246 250 L150 256 L90 214 L62 150Z"
            fill="url(#bf-body)"
          />
          {HAIRPINS.map(([x, y, rot, s]) => (
            <g
              key={`${x}-${y}`}
              transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}
              fill="none"
              stroke="#ffffff"
              strokeWidth="1.7"
              strokeLinecap="round"
              opacity="0.95"
            >
              <path d="M-5 0 L-5 -15 A5 5 0 0 1 5 -15 L5 0" />
              <path d="M-5 -4 H5 M-5 -9 H5" strokeWidth="1.1" />
            </g>
          ))}
        </g>
        <g fontFamily="Arial, Helvetica, sans-serif" fontSize="11">
          <text x="214" y="20" fill="#0d3d5c" fontWeight="700">MFE structure</text>
          <text x="214" y="33" fill="#155b8a" fontFamily="Courier New, monospace" fontSize="10">{"(((((....)))))"}</text>
          <text x="14" y="117" fill="#0d3d5c">the surface</text>
          <text x="338" y="150" textAnchor="end" fill="#f3fbff" fontWeight="700">the rest of</text>
          <text x="338" y="164" textAnchor="end" fill="#f3fbff" fontWeight="700">the ensemble</text>
          <text x="190" y="266" textAnchor="middle" fill="#ffffff" fontFamily="Courier New, monospace" fontSize="10.5">
            Z = &Sigma; exp(&minus;&Delta;G / kT)
          </text>
        </g>
      </svg>
      <figcaption className="note">
        The minimum free energy structure is only the tip of the iceberg. The
        partition function accounts for the whole ensemble beneath the surface.
      </figcaption>
    </figure>
  );
}
