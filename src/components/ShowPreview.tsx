import { useEffect, useMemo, useRef, useState } from "react";
import {
  PROGRAMS,
  formatTime,
  modelById,
  positionById,
} from "../data";
import type { Segment } from "../types";

interface Props {
  segments: Segment[];
  cursor: number | null;
  setCursor: (t: number | null) => void;
  playing: boolean;
  setPlaying: (v: boolean) => void;
}

export default function ShowPreview({
  segments,
  cursor,
  setCursor,
  playing,
  setPlaying,
}: Props) {
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number>(0);
  const cursorRef = useRef(cursor);
  const setCursorRef = useRef(setCursor);
  useEffect(() => {
    cursorRef.current = cursor;
  }, [cursor]);
  useEffect(() => {
    setCursorRef.current = setCursor;
  }, [setCursor]);

  const duration = useMemo(
    () =>
      Math.max(
        segments.reduce((max, s) => Math.max(max, s.start + s.duration), 0),
        1
      ),
    [segments]
  );

  const sorted = useMemo(
    () => [...segments].sort((a, b) => a.start - b.start),
    [segments]
  );

  const active = useMemo(
    () =>
      cursor === null
        ? []
        : segments.filter(
            (s) => cursor >= s.start && cursor < s.start + s.duration
          ),
    [cursor, segments]
  );

  useEffect(() => {
    if (!playing) return;
    lastRef.current = performance.now();
    const tick = (now: number) => {
      const dt = (now - lastRef.current) / 1000;
      lastRef.current = now;
      let next = (cursorRef.current ?? 0) + dt;
      if (next >= duration) {
        next = duration;
        setPlaying(false);
      }
      setCursorRef.current(next);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, duration, setPlaying]);

  const play = () => {
    if (cursor === null || cursor >= duration) setCursor(0);
    setPlaying(true);
  };
  const pause = () => setPlaying(false);
  const stop = () => {
    setPlaying(false);
    setCursor(null);
  };

  // 节目进度：当前/下一段提示
  const nextUp = sorted.find((s) => (cursor ?? 0) < s.start);

  return (
    <section className="panel preview-panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">FULL SHOW PREVIEW</p>
          <h2>整场预览</h2>
        </div>
        <div className="transport">
          {playing ? (
            <button type="button" className="btn small" onClick={pause}>
              暂停
            </button>
          ) : (
            <button type="button" className="btn small primary" onClick={play}>
              播放
            </button>
          )}
          <button type="button" className="btn small ghost" onClick={stop}>
            复位
          </button>
          <span className="time-readout">
            {formatTime(cursor ?? 0)} / {formatTime(duration)}
          </span>
        </div>
      </div>

      <div className="sky-stage">
        <div className="sky-glow" />
        {PROGRAMS.map((p, idx) => {
          const segs = sorted.filter((s) => s.program === p);
          const start = segs[0]?.start ?? 0;
          const end = segs.reduce((m, s) => Math.max(m, s.start + s.duration), 0);
          const isNow = active.some((s) => s.program === p);
          return (
            <div
              key={p}
              className={`sky-program ${isNow ? "on" : ""}`}
              style={{
                left: `${(start / duration) * 100}%`,
                width: `${Math.max(((end - start) / duration) * 100, 4)}%`,
                animationDelay: `${idx * 0.2}s`,
              }}
            >
              <span>{p}</span>
            </div>
          );
        })}

        {active.map((s) => {
          const m = modelById(s.modelId);
          const pos = positionById(s.positionId);
          return (
            <div
              key={s.id}
              className="burst"
              style={{
                left: `${pos?.x ?? 50}%`,
                top: `${pos ? 14 + pos.y * 0.42 : 40}%`,
                color: m?.color,
              }}
            >
              <i className="ray r1" />
              <i className="ray r2" />
              <i className="ray r3" />
              <i className="ray r4" />
              <i className="core" />
              <em>
                {s.id} · {pos?.id} · {m?.name}
              </em>
            </div>
          );
        })}

        <div className="sky-caption">
          {active.length === 0 ? (
            <span>
              {cursor === null
                ? "按播放预览整场，时间轴点击可定位。"
                : nextUp
                ? `待发：${nextUp.id}「${nextUp.program}」@ ${formatTime(nextUp.start)}`
                : "—— 终场 ——"}
            </span>
          ) : (
            <span>
              燃放中：{active.map((s) => s.id).join("、")}
            </span>
          )}
        </div>
      </div>

      <ol className="cue-sheet">
        {sorted.map((s) => {
          const m = modelById(s.modelId);
          const pos = positionById(s.positionId);
          const isNow = active.some((a) => a.id === s.id);
          const isPast = cursor !== null && cursor >= s.start + s.duration;
          return (
            <li key={s.id} className={isNow ? "now" : isPast ? "past" : ""}>
              <span className="cue-time">{formatTime(s.start)}</span>
              <span className="dot" style={{ background: m?.color }} />
              <code>{s.id}</code>
              <span>{s.program}</span>
              <span className="muted">{pos?.id}</span>
              <span className="muted">
                {m?.name} ×{s.quantity}（{s.batchId}）
              </span>
              <span className="muted">{s.angle}° · 安全{s.safetyDistance}m</span>
            </li>
          );
        })}
        {sorted.length === 0 && <li className="muted empty-note">暂无节目段落。</li>}
      </ol>
    </section>
  );
}
