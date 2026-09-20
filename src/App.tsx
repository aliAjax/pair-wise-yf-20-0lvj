import { useEffect, useMemo, useState } from "react";
import "./styles.css";
import {
  BATCHES,
  MODELS,
  POSITIONS,
  SAFETY_GAP,
  batchOf,
  batchUsed,
  commitSegment,
  fmtTime,
  loadState,
  modelOf,
  positionOf,
  saveState,
  INITIAL_STATE,
  type Conflict,
  type SegmentDraft,
} from "./show";

const emptyDraft = (): SegmentDraft => ({
  name: "",
  positionId: POSITIONS[0].id,
  modelId: MODELS[0].id,
  batchId: BATCHES.find((b) => b.modelId === MODELS[0].id)!.id,
  start: 0,
  duration: 10,
  shots: 10,
  angle: MODELS[0].angleMin,
  caliber: MODELS[0].caliber,
  safety: MODELS[0].minSafety,
});

function App() {
  const [state, setState] = useState(loadState);
  const [draft, setDraft] = useState<SegmentDraft>(emptyDraft);
  const [notice, setNotice] = useState<string>("");

  const { segments, conflicts } = state;

  // 本地刷新保留：任何状态变化都写入 localStorage
  useEffect(() => {
    saveState(state);
  }, [state]);

  const model = modelOf(draft.modelId);
  const modelBatches = BATCHES.filter((b) => b.modelId === draft.modelId);

  const patchDraft = (patch: Partial<SegmentDraft>) => setDraft((d) => ({ ...d, ...patch }));

  const onModelChange = (modelId: string) => {
    const m = modelOf(modelId);
    const firstBatch = BATCHES.find((b) => b.modelId === modelId)!;
    setDraft((d) => ({
      ...d,
      modelId,
      batchId: firstBatch.id,
      caliber: m.caliber,
      safety: m.minSafety,
      angle: Math.min(Math.max(d.angle, m.angleMin), m.angleMax),
    }));
  };

  const submit = () => {
    const result = commitSegment(draft, segments, state.seq);
    if (result.ok) {
      setState((s) => ({ ...s, segments: result.segments, seq: s.seq + 1 }));
      setNotice(`✅ 「${draft.name}」已通过全部检查，写入时间轴`);
      setDraft(emptyDraft());
    } else {
      // 整段拒绝 + 弹药回滚，冲突入清单，草稿保留在表单中便于修正后原批次重提
      setState((s) => ({ ...s, conflicts: [result.conflict!, ...s.conflicts] }));
      setNotice(`⛔ 「${draft.name || "未命名段落"}」未通过检查，整段未入时间轴，弹药已回滚`);
    }
  };

  const resubmit = (c: Conflict) => {
    // 原批次重提：把当时的草稿（含原批次）装回表单
    setDraft({ ...c.draft });
    setNotice(`已装回「${c.name}」的原始申报（批次 ${c.batchCode}），修正后可再次提交`);
  };

  const removeSegment = (id: string) => {
    setState((s) => ({ ...s, segments: s.segments.filter((seg) => seg.id !== id) }));
  };

  const resetAll = () => {
    setState(INITIAL_STATE);
    setDraft(emptyDraft());
    setNotice("已恢复预置脚本（4 段节目 / 5 点位 / 4 批次）");
  };

  const sorted = useMemo(
    () => [...segments].sort((a, b) => a.start - b.start),
    [segments]
  );
  const showEnd = Math.max(60, ...segments.map((s) => s.start + s.duration)) * 1.08;
  const totalShots = segments.reduce((n, s) => n + s.shots, 0);
  const minSafety = segments.length ? Math.min(...segments.map((s) => s.safety)) : 0;

  return (
    <main className="app">
      <section className="hero">
        <p>hxyfront-62008 · 烟花燃放编排 · 本地自动保存</p>
        <h1>烟花燃放脚本编排台</h1>
        <span>
          新增段落需申报点火窗口、发射角、口径、安全距离与领用批次；系统自动检查时间轴重叠、
          同点位安全间隔（≥{SAFETY_GAP} 秒）与批次余量，任一不通过即整段拒绝并回滚弹药，修正后可按原批次重提。
        </span>
      </section>

      <section className="metrics">
        <article><small>节目段落</small><strong>{segments.length}</strong></article>
        <article><small>点火节点（发）</small><strong>{totalShots}</strong></article>
        <article><small>冲突提示</small><strong>{conflicts.length}</strong></article>
        <article><small>最小安全距离</small><strong>{minSafety}m</strong></article>
      </section>

      {notice && <div className="notice" role="status">{notice}</div>}

      <section className="workspace">
        <aside className="panel">
          <h2>燃放点位平面图</h2>
          <svg viewBox="0 0 100 62" className="sitemap" aria-label="点位平面图">
            <rect x="1" y="1" width="98" height="60" rx="3" className="site-bound" />
            <text x="50" y="6.5" className="site-label" textAnchor="middle">观众席方向 ↓（南侧）</text>
            {POSITIONS.map((p) => {
              const active = p.id === draft.positionId;
              const segCount = segments.filter((s) => s.positionId === p.id).length;
              return (
                <g key={p.id} onClick={() => patchDraft({ positionId: p.id })} className="site-pos">
                  {active && (
                    <circle cx={p.x} cy={p.y} r={Math.max(4, model.minSafety / 6)} className="safety-ring" />
                  )}
                  <circle cx={p.x} cy={p.y} r="3.2" className={active ? "pos-dot active" : "pos-dot"} />
                  <text x={p.x} y={p.y - 5} textAnchor="middle" className="pos-name">{p.name}</text>
                  <text x={p.x} y={p.y + 7.5} textAnchor="middle" className="pos-zone">
                    {p.zone} · {segCount} 段
                  </text>
                </g>
              );
            })}
          </svg>
          <p className="hint">点击点位即可选入下方申报单；虚线圈为当前型号的最小安全距离示意。</p>

          <h2 className="mt">型号配额</h2>
          <div className="quota-list">
            {MODELS.map((m) => {
              const batches = BATCHES.filter((b) => b.modelId === m.id);
              const total = batches.reduce((n, b) => n + b.total, 0);
              const used = batches.reduce((n, b) => n + batchUsed(segments, b.id), 0);
              const pct = total ? Math.round((used / total) * 100) : 0;
              return (
                <div key={m.id} className="quota">
                  <div className="quota-head">
                    <b style={{ color: m.color }}>{m.name} {m.caliber}mm</b>
                    <span>{used}/{total} 发</span>
                  </div>
                  <div className="bar"><i style={{ width: `${pct}%`, background: m.color }} /></div>
                  {batches.map((b) => (
                    <small key={b.id} className="batch-line">
                      批次 {b.code}：剩 {b.total - batchUsed(segments, b.id)} / {b.total} 发
                    </small>
                  ))}
                </div>
              );
            })}
          </div>
        </aside>

        <section className="panel form-panel">
          <div className="heading">
            <div>
              <p>新增段落申报</p>
              <h2>点火窗口与弹药领用</h2>
            </div>
            <button onClick={resetAll}>恢复预置</button>
          </div>
          <div className="field-grid">
            <label>
              <span>节目段落名称</span>
              <input value={draft.name} onChange={(e) => patchDraft({ name: e.target.value })} placeholder="如：第二乐章" />
            </label>
            <label>
              <span>燃放点位</span>
              <select value={draft.positionId} onChange={(e) => patchDraft({ positionId: e.target.value })}>
                {POSITIONS.map((p) => <option key={p.id} value={p.id}>{p.name}（{p.zone}）</option>)}
              </select>
            </label>
            <label>
              <span>烟花型号</span>
              <select value={draft.modelId} onChange={(e) => onModelChange(e.target.value)}>
                {MODELS.map((m) => <option key={m.id} value={m.id}>{m.name} · {m.caliber}mm · 安全≥{m.minSafety}m</option>)}
              </select>
            </label>
            <label>
              <span>领用批次</span>
              <select value={draft.batchId} onChange={(e) => patchDraft({ batchId: e.target.value })}>
                {modelBatches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code}（剩 {b.total - batchUsed(segments, b.id)} 发）
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>点火窗口起点（秒）</span>
              <input type="number" min="0" step="0.1" value={draft.start}
                onChange={(e) => patchDraft({ start: Number(e.target.value) })} />
            </label>
            <label>
              <span>窗口时长（秒）</span>
              <input type="number" min="0.1" step="0.1" value={draft.duration}
                onChange={(e) => patchDraft({ duration: Number(e.target.value) })} />
            </label>
            <label>
              <span>发射角（{model.angleMin}°–{model.angleMax}°）</span>
              <input type="number" step="1" value={draft.angle}
                onChange={(e) => patchDraft({ angle: Number(e.target.value) })} />
            </label>
            <label>
              <span>申报口径（随型号锁定）</span>
              <input value={`${draft.caliber} mm`} readOnly />
            </label>
            <label>
              <span>安全距离（≥{model.minSafety}m）</span>
              <input type="number" min="0" step="1" value={draft.safety}
                onChange={(e) => patchDraft({ safety: Number(e.target.value) })} />
            </label>
            <label>
              <span>弹药量（发）</span>
              <input type="number" min="1" step="1" value={draft.shots}
                onChange={(e) => patchDraft({ shots: Math.floor(Number(e.target.value)) })} />
            </label>
          </div>
          <div className="form-foot">
            <span className="hint">
              窗口 {fmtTime(Math.max(0, draft.start))} – {fmtTime(Math.max(0, draft.start) + Math.max(0, draft.duration))}
              · 批次 {batchOf(draft.batchId).code}
            </span>
            <button className="primary" onClick={submit}>校验并写入时间轴</button>
          </div>
        </section>
      </section>

      <section className="panel">
        <div className="heading">
          <div>
            <p>时间轴编排</p>
            <h2>各点位点火窗口（同点位间隔 ≥ {SAFETY_GAP}s）</h2>
          </div>
        </div>
        <div className="timeline">
          {POSITIONS.map((p) => (
            <div key={p.id} className="lane">
              <span className="lane-name">{p.name}</span>
              <div className="lane-track">
                {sorted.filter((s) => s.positionId === p.id).map((s) => {
                  const m = modelOf(s.modelId);
                  return (
                    <div
                      key={s.id}
                      className="seg-block"
                      title={`${s.name} · ${fmtTime(s.start)}–${fmtTime(s.start + s.duration)} · ${s.shots}发`}
                      style={{
                        left: `${(s.start / showEnd) * 100}%`,
                        width: `${Math.max(1.2, (s.duration / showEnd) * 100)}%`,
                        background: m.color,
                      }}
                    >
                      {s.name}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="axis">
            {[0, 0.25, 0.5, 0.75, 1].map((f) => (
              <span key={f} style={{ left: `${f * 100}%` }}>{fmtTime(showEnd * f)}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="workspace bottom">
        <section className="panel">
          <div className="heading">
            <div>
              <p>冲突清单</p>
              <h2>未通过检查的申请（{conflicts.length}）</h2>
            </div>
          </div>
          {conflicts.length === 0 && <p className="hint">暂无冲突，所有申报均已通过。</p>}
          <div className="conflict-list">
            {conflicts.map((c) => (
              <article key={c.id} className="conflict">
                <div className="conflict-head">
                  <b>{c.name}</b>
                  <span>{new Date(c.at).toLocaleTimeString("zh-CN")}</span>
                </div>
                <ul>
                  {c.reasons.map((r) => <li key={r}>{r}</li>)}
                </ul>
                <div className="conflict-foot">
                  <small>已回滚 {c.rolledBackShots} 发 · 批次 {c.batchCode}</small>
                  <button onClick={() => resubmit(c)}>按原批次重提</button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="heading">
            <div>
              <p>整场预览</p>
              <h2>燃放程序单（{fmtTime(showEnd / 1.08)} 收场）</h2>
            </div>
          </div>
          <div className="rundown">
            {sorted.map((s, i) => {
              const m = modelOf(s.modelId);
              const pos = positionOf(s.positionId);
              return (
                <article key={s.id} className="cue">
                  <b style={{ background: m.color }}>{String(i + 1).padStart(2, "0")}</b>
                  <div>
                    <h3>{s.name}</h3>
                    <p>
                      {fmtTime(s.start)}–{fmtTime(s.start + s.duration)} · {pos.name} · {m.name} {s.caliber}mm ·
                      {s.angle}° · 安全 {s.safety}m · {s.shots} 发（{batchOf(s.batchId).code}）
                    </p>
                  </div>
                  <button className="danger" onClick={() => removeSegment(s.id)}>撤下</button>
                </article>
              );
            })}
          </div>
        </section>
      </section>
    </main>
  );
}

export default App;
