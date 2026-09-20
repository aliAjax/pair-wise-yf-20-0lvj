import { useMemo } from "react";
import {
  MODELS,
  POSITIONS,
  modelById,
} from "../data";
import type { Segment } from "../types";

interface Props {
  segments: Segment[];
  cursor: number | null;
}

/** 安全距离圈：10m → 8px，封顶半径 46px */
function radiusOf(distance: number): number {
  return Math.min(distance * 0.8, 46);
}

export default function PositionMap({ segments, cursor }: Props) {
  const byPosition = useMemo(() => {
    const map = new Map<string, Segment[]>();
    for (const p of POSITIONS) map.set(p.id, []);
    for (const s of segments) map.get(s.positionId)?.push(s);
    for (const list of map.values()) list.sort((a, b) => a.start - b.start);
    return map;
  }, [segments]);

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">SITE MAP</p>
          <h2>点位平面图</h2>
        </div>
        <span className="muted">圈为申报安全距离 · 扇形为发射角</span>
      </div>

      <div className="map-wrap">
        <svg viewBox="0 0 100 60" className="map" role="img" aria-label="五个燃放点位平面图">
          <defs>
            <pattern id="water" width="6" height="6" patternUnits="userSpaceOnUse">
              <path d="M0 3 Q1.5 1 3 3 T6 3" fill="none" stroke="#1e3a5f" strokeWidth="0.5" />
            </pattern>
          </defs>

          {/* 场地轮廓：北岸楼体 + 湖面 + 观众前场 */}
          <rect x="0" y="0" width="100" height="60" fill="#0b1424" />
          <rect x="0" y="18" width="100" height="30" fill="url(#water)" opacity="0.55" />
          <rect x="0" y="48" width="100" height="12" fill="#101a2e" />
          <text x="50" y="33.5" textAnchor="middle" className="map-water-label">
            湖 面
          </text>
          <text x="50" y="56" textAnchor="middle" className="map-zone-label">
            观众前场（保持安全距离外）
          </text>

          {POSITIONS.map((p) => {
            const list = byPosition.get(p.id) ?? [];
            const active = cursor !== null
              ? list.find((s) => cursor >= s.start && cursor < s.start + s.duration)
              : undefined;
            const next = active ?? list[0];
            const model = next ? modelById(next.modelId) : undefined;
            const color = active ? model?.color ?? "#f59e0b" : "#475569";
            const radius = next ? radiusOf(next.safetyDistance) : 10;
            const angle = next ? next.angle : 90;

            // 发射角扇形：垂直向上为 90°，向两侧各展开 12°
            const spread = 12;
            const a1 = angle - spread;
            const a2 = angle + spread;
            const rad = (deg: number) => ((90 - deg) * Math.PI) / 180;
            const rr = 9;
            const x1 = p.x + rr * Math.cos(rad(a1));
            const y1 = p.y - rr * Math.sin(rad(a1));
            const x2 = p.x + rr * Math.cos(rad(a2));
            const y2 = p.y - rr * Math.sin(rad(a2));

            return (
              <g key={p.id}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={radius / 4.2}
                  fill="none"
                  stroke={color}
                  strokeWidth={0.4}
                  strokeDasharray="1.2 1"
                  opacity={active ? 0.95 : 0.5}
                />
                {next && (
                  <path
                    d={`M ${p.x} ${p.y} L ${x1} ${y1} A ${rr} ${rr} 0 0 1 ${x2} ${y2} Z`}
                    fill={color}
                    opacity={active ? 0.55 : 0.16}
                  />
                )}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={active ? 2.4 : 1.8}
                  fill={color}
                  stroke="#0b1424"
                  strokeWidth={0.6}
                />
                <text
                  x={p.x}
                  y={p.y + (p.y < 20 ? 5.2 : p.y > 70 ? 4.6 : -radius / 4.2 - 2.2)}
                  textAnchor="middle"
                  className="map-pin-label"
                >
                  {p.id}
                </text>
                <text
                  x={p.x}
                  y={p.y + (p.y < 20 ? 8.6 : p.y > 70 ? 8 : -radius / 4.2 - 5)}
                  textAnchor="middle"
                  className="map-pin-sub"
                >
                  {p.name.replace(/^.号位·/, "")}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <ul className="map-legend">
        {POSITIONS.map((p) => {
          const list = byPosition.get(p.id) ?? [];
          return (
            <li key={p.id}>
              <b>{p.id}</b>
              <span>{p.name}</span>
              <em className={list.length ? "" : "muted"}>{list.length} 段</em>
            </li>
          );
        })}
      </ul>
      <ul className="map-model-legend">
        {MODELS.map((m) => (
          <li key={m.id}>
            <i style={{ background: m.color }} />
            {m.name} {m.caliber}mm
          </li>
        ))}
      </ul>
    </section>
  );
}
