import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { BankrollPoint } from "@/core/aggregate";
import { dateTime, eur, signedEur } from "@/lib/format";

// Géométrie (reprend le viewBox de la maquette PokerDash).
const W = 1200;
const H = 300;
const TOP = 34;
const BOTTOM = 278;
const FLOOR = 284; // base de l'aplat

function niceScale(min: number, max: number) {
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const rawStep = (max - min) / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = niceMax; v >= niceMin - 1e-9; v -= step) ticks.push(round2(v));
  return { niceMin, niceMax, ticks };
}

function hitRadius(m: number): number {
  if (m >= 100) return 6;
  if (m >= 25) return 6;
  if (m >= 10) return 5;
  return 4;
}

interface GameNode {
  x: number;
  y: number;
  p: BankrollPoint;
}

export function BankrollCurve({
  points,
  startingBankroll,
}: {
  points: BankrollPoint[];
  startingBankroll: number;
}) {
  const lineRef = useRef<SVGPathElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const gradId = useId();
  const [hovered, setHovered] = useState<number | null>(null);

  const geo = useMemo(() => {
    const values = [startingBankroll, ...points.map((p) => p.bankroll)];
    const n = points.length; // segments
    const min = Math.min(...values);
    const max = Math.max(...values);
    const { niceMin, niceMax, ticks } = niceScale(min, max);
    const x = (i: number) => (n <= 0 ? 0 : (i / n) * W);
    const y = (v: number) =>
      TOP + ((niceMax - v) / (niceMax - niceMin || 1)) * (BOTTOM - TOP);

    const nodes = values.map((v, i) => ({ x: x(i), y: y(v) }));
    const line = nodes.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
    const area = `M0 ${FLOOR} ${line} L ${W} ${FLOOR} Z`;

    // Nœuds de partie (hors point de départ) — cibles de survol.
    const gameNodes: GameNode[] = points.map((p, i) => ({ x: nodes[i + 1].x, y: nodes[i + 1].y, p }));

    // Hits : parties gagnantes avec multiplicateur (taille ∝ multiplicateur).
    const hits = gameNodes
      .filter((gn) => gn.p.multiplier !== null && gn.p.profit > 0)
      .map((gn) => ({ cx: gn.x, cy: gn.y, m: gn.p.multiplier as number }));

    const tickY = ticks.map((v) => ({ v, y: y(v) }));
    return { line, area, hits, tickY, n, gameNodes };
  }, [points, startingBankroll]);

  // Animation du tracé (stroke-dashoffset), comme la maquette.
  useEffect(() => {
    const p = lineRef.current;
    if (!p) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let len = 0;
    try {
      len = p.getTotalLength();
    } catch {
      return;
    }
    if (reduce || !len) return;
    p.style.strokeDasharray = String(len);
    p.style.strokeDashoffset = String(len);
    p.getBoundingClientRect();
    requestAnimationFrame(() => {
      p.style.transition = "stroke-dashoffset 850ms cubic-bezier(.2,.7,.2,1)";
      p.style.strokeDashoffset = "0";
    });
  }, [geo.line]);

  // Survol : trouve le nœud le plus proche en x (robuste même quand les points sont denses).
  function handleMove(e: React.MouseEvent) {
    const svg = svgRef.current;
    if (!svg || geo.gameNodes.length === 0) return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const loc = pt.matrixTransform(ctm.inverse());
    let best = 0;
    let bd = Infinity;
    geo.gameNodes.forEach((gn, i) => {
      const d = Math.abs(gn.x - loc.x);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    setHovered(best);
  }

  const hn = hovered !== null ? geo.gameNodes[hovered] : null;

  return (
    <div style={{ marginTop: 20, position: "relative" }}>
      <svg
        ref={svgRef}
        viewBox="0 0 1240 300"
        width="100%"
        style={{ display: "block", overflow: "visible" }}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--curve)" stopOpacity="0.2" />
            <stop offset="1" stopColor="var(--curve)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* gridlines + labels d'axe */}
        <g stroke="#27272A" strokeWidth="1" pointerEvents="none">
          {geo.tickY.map((t) => (
            <line key={t.v} x1="0" y1={t.y} x2={W} y2={t.y} opacity="0.55" />
          ))}
        </g>
        <g fontFamily="var(--font-mono)" fontSize="11" fill="#52525B" textAnchor="start" pointerEvents="none">
          {geo.tickY.map((t) => (
            <text key={t.v} x={W + 8} y={t.y + 4}>
              {Math.round(t.v)}&nbsp;€
            </text>
          ))}
        </g>

        {/* aplat + ligne */}
        <path
          className="bk-anim"
          style={{ animation: "bkFade 700ms ease 200ms backwards" }}
          d={geo.area}
          fill={`url(#${gradId})`}
          pointerEvents="none"
        />
        <path
          ref={lineRef}
          d={geo.line}
          fill="none"
          stroke="var(--curve)"
          strokeWidth="1.6"
          strokeLinejoin="round"
          strokeLinecap="round"
          pointerEvents="none"
        />

        {/* hits multiplicateurs (décoratifs) */}
        <g pointerEvents="none">
          {geo.hits.map((h, i) => {
            const r = hitRadius(h.m);
            const halo = h.m >= 5;
            const label = h.m >= 25;
            return (
              <g
                key={i}
                className="bk-anim"
                style={{
                  animation: `bkPop 520ms cubic-bezier(.2,.7,.2,1) ${700 + i * 60}ms backwards`,
                  transformBox: "fill-box",
                  transformOrigin: "center",
                }}
              >
                {halo && <circle cx={h.cx} cy={h.cy} r={r + 7} fill="var(--point)" opacity="0.13" />}
                <circle cx={h.cx} cy={h.cy} r={r} fill="var(--point)" />
                {label && (
                  <text x={h.cx - 16} y={h.cy - 6} textAnchor="end" fontFamily="var(--font-mono)" fontSize="13" fontWeight="500" fill="#FAFAFA">
                    ×{h.m}
                  </text>
                )}
              </g>
            );
          })}
        </g>

        {/* point survolé : guide vertical + halo */}
        {hn && (
          <g pointerEvents="none">
            <line x1={hn.x} y1={TOP} x2={hn.x} y2={BOTTOM} stroke="#3F3F46" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx={hn.x} cy={hn.y} r="5.5" fill="var(--curve)" stroke="#09090B" strokeWidth="2" />
          </g>
        )}

        {/* zone de capture du survol */}
        <rect x="0" y="0" width={W} height={H} fill="transparent" onMouseMove={handleMove} onMouseLeave={() => setHovered(null)} />

        {/* infobulle */}
        {hn && <Tooltip node={hn} />}
      </svg>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 6,
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "#52525B",
        }}
      >
        <span>partie 1</span>
        <span>partie {geo.n}</span>
      </div>
    </div>
  );
}

function Tooltip({ node }: { node: GameNode }) {
  const boxW = 224;
  const boxH = 66;
  const bx = Math.max(0, Math.min(node.x - boxW / 2, W - boxW));
  const above = node.y - boxH - 16 >= 0;
  const by = above ? node.y - boxH - 16 : node.y + 16;
  const gain = node.p.profit >= 0;
  return (
    <g pointerEvents="none">
      <rect x={bx} y={by} width={boxW} height={boxH} rx="8" fill="#0E0E11" stroke="#27272A" strokeWidth="1" />
      <text x={bx + 14} y={by + 21} fontFamily="var(--font-mono)" fontSize="12" fill="#A1A1AA">
        {dateTime(node.p.date)}
      </text>
      <text x={bx + 14} y={by + 42} fontFamily="var(--font-mono)" fontSize="15" fontWeight="600" fill="#FAFAFA">
        {eur(node.p.bankroll)}
      </text>
      <text x={bx + 14} y={by + 59} fontFamily="var(--font-mono)" fontSize="13">
        <tspan fill={gain ? "var(--gain)" : "var(--loss)"}>{signedEur(node.p.profit)}</tspan>
        {node.p.multiplier !== null && <tspan fill="#71717A"> · ×{node.p.multiplier}</tspan>}
      </text>
    </g>
  );
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
