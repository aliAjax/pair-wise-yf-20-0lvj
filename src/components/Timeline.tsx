import { useMemo } from "react";
import {
  MIN_GAP,
  POSITIONS,
  PROGRAMS,
  formatTime,
  modelById,
  positionById,
} from "../data";
import type { Segment } from "../types";

interface Props {
  segments: Segment[];
  cursor: number | null;
  onSeek: (t: number) => void;
  onDelete: (id: string) => void;
}

export default function Timeline({ segments, cursor, onSeek, onDelete }: Props) {
  const duration = useMemo(() => {
    const end = segments.reduce((max, s) => Math.max(max, s.start + s.duration), 0);
    return Math.max(end + 4, 12);
  }, [segments]);

  const sorted = useMemo(
    () => [...segments].sort((a, b) => a.start - b.start),
    [segments]
  );

  const ticks = useMemo(() => {
    const step = duration > 60 ? 10 : 5;
    const out: number[] = [];
    for (let t = 0; t <= duration + 1e-9; t += step) out.push(t);
    return out;
  }, [duration]);

  /** 同点位相邻间隔标注（低于 1.2s 在已入轴段落中应为 0 条） */
  const tightGaps = useMemo(() => {
    const out: { posId: string; t: number; gap: number }[] = [];
    for (const pos of POSITIONS) {
      const mine = sorted.filter((s) => s.positionId === pos.id);
      for (let i = 1; i < mine.length; i++) {
        const gap = mine[i].start - (mine[i - 1].start + mine[i - 1].duration);
        if (gap >= -1e-9 && gap < MIN_GAP) {
          out.push({ posId: pos.id, t: mine[i - 1].start + mine[i - 1].duration, gap });
        }
      }
    }
    return out;
  }, [sorted]);

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">TIMELINE</p>
          <h2>时间轴编排</h2>
        </div>
        <span className="muted">
          共 {segments.length} 段 · 时长 {formatTime(duration)} · 每行为一个点位
        </span>
      </div>

      <div
        className="timeline"
        style={{ ["--dur" as string]: `${duration}s` }}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          onSeek(((e.clientX - rect.left) / rect.width) * duration);
        }}
      >
        <div className="ruler">
          {ticks.map((t) => (
            <span
              key={t}
              className="tick"
              style={{ left: `${(t / duration) * 100}%` }}
            >
              {formatTime(t)}
            </span>
          ))}
        </div>

        {POSITIONS.map((pos) => {
          const mine = sorted.filter((s) => s.positionId === pos.id);
          return (
            <div className="lane" key={pos.id}>
              <div className="lane-label">
                <b>{pos.id}</b>
                <span>{pos.name.replace(/^.号位·/, "")}</span>
              </div>
              <div className="lane-track">
                {PROGRAMS.map((p) => (
                  <i key={p} className="lane-zebra" />
                ))}
                {mine.map((s) => {
                  const m = modelById(s.modelId);
                  const left = (s.start / duration) * 100;
                  const width = (s.duration / duration) * 100;
                  const firing = cursor !== null && cursor >= s.start && cursor < s.start + s.duration;
                  return (
                    <div
                      key={s.id}
                      className={`block ${firing ? "firing" : ""}`}
                      style={{
                        left: `${left}%`,
                        width: `${Math.max(width, 1.2)}%`,
                        background: m?.color,
                        borderColor: m?.color,
                      }}
                      title={`${s.id}｜${s.program}｜${formatTime(s.start)}+${s.duration}s｜${s.quantity}发｜安全${s.safetyDistance}m`}
                    >
                      <span className="block-id">{s.id}</span>
                      <span className="block-name">{s.program}</span>
                      <button
                        type="button"
                        className="block-del"
                        aria-label={`删除 ${s.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(s.id);
                        }}
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
                {tightGaps
                  .filter((g) => g.posId === pos.id)
                  .map((g, i) => (
                    <span
                      key={i}
                      className="tight-gap"
                      style={{ left: `${(g.t / duration) * 100}%` }}
                      title={`同点间隔 ${g.gap.toFixed(2)}s < ${MIN_GAP}s`}
                    >
                      ⚠
                    </span>
                  ))}
              </div>
            </div>
          );
        })}

        {cursor !== null && (
          <div
            className="playhead"
            style={{ left: `${(cursor / duration) * 100}%` }}
          >
            <b>{formatTime(cursor)}</b>
          </div>
        )}
      </div>

      <ol className="segment-list">
        {sorted.map((s) => {
          const m = modelById(s.modelId);
          const pos = positionById(s.positionId);
          const firing = cursor !== null && cursor >= s.start && cursor < s.start + s.duration;
          return (
            <li key={s.id} className={firing ? "now" : ""}>
              <span className="dot" style={{ background: m?.color }} />
              <code>{s.id}</code>
              <span className="seg-time">{formatTime(s.start)} +{s.duration}s</span>
              <span>{pos?.id} · {pos?.name}</span>
              <span>
                {m?.name} · {s.caliber}mm · {s.angle}°
              </span>
              <span>批次 {s.batchId} × {s.quantity}</span>
              <span className="muted">安全 {s.safetyDistance}m</span>
              <button
                type="button"
                className="link-del"
                onClick={() => onDelete(s.id)}
              >
                撤档
              </button>
            </li>
          );
        })}
        {sorted.length === 0 && <li className="muted empty-note">时间轴为空，先在左侧申报一段节目。</li>}
      </ol>
    </section>
  );
}
