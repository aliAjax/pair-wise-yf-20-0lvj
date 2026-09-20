import {
  MIN_GAP,
  POSITIONS,
  formatTime,
  modelById,
} from "../data";
import type { RejectedSubmission, Segment } from "../types";
import { auditTimeline } from "../validation";

interface Props {
  rejected: RejectedSubmission[];
  segments: Segment[];
  linkedIds: string[];
  onLoad: (r: RejectedSubmission) => void;
  onDiscard: (id: string) => void;
}

const TYPE_LABEL: Record<string, string> = {
  form: "字段",
  overlap: "时间轴重叠",
  gap: "同点间隔",
  stock: "批次余量",
  caliber: "口径不符",
};

export default function ConflictList({
  rejected,
  segments,
  linkedIds,
  onLoad,
  onDiscard,
}: Props) {
  const open = rejected.filter((r) => !r.resolvedBy);
  const resolved = rejected.filter((r) => r.resolvedBy);
  const audit = auditTimeline(segments);

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">CONFLICTS</p>
          <h2>冲突清单</h2>
        </div>
        <span className={`badge ${open.length ? "badge-bad" : "badge-ok"}`}>
          {open.length ? `${open.length} 条待处理` : "全部合规"}
        </span>
      </div>

      {/* 已入轴段落的实时复核 */}
      <div className="audit-row">
        <span className={audit.overlapCount ? "audit-bad" : "audit-ok"}>
          时间轴重叠 {audit.overlapCount}
        </span>
        {POSITIONS.map((p) => {
          const gap = audit.minGapByPosition[p.id];
          return (
            <span
              key={p.id}
              className={gap === undefined ? "audit-na" : gap < MIN_GAP ? "audit-bad" : "audit-ok"}
              title={`${p.name} 相邻段落最小间隔`}
            >
              {p.id} {gap === undefined ? "—" : `${gap.toFixed(2)}s`}
            </span>
          );
        })}
        <span className="audit-ok">
          全场剩余 {audit.totalRemaining} 发
        </span>
      </div>

      {open.length === 0 ? (
        <p className="empty-conflict">
          当前没有被驳回的申报。不满足规则的段落将整段退回此处，弹药不发生占用。
        </p>
      ) : (
        <ul className="reject-list">
          {open.map((r) => {
            const m = modelById(r.draft.modelId);
            const linked = linkedIds.includes(r.id);
            return (
              <li key={r.id} className={linked ? "linked" : ""}>
                <header>
                  <code>{r.id}</code>
                  <span className="muted">{new Date(r.createdAt).toLocaleTimeString("zh-CN")}</span>
                  {linked && <span className="linked-flag">已载入表单待重提</span>}
                </header>
                <div className="reject-meta">
                  <b>{r.draft.program}</b>
                  <span>
                    {r.draft.positionId} · {m?.name} · 批次 {r.draft.batchId}
                  </span>
                  <span>
                    {formatTime(Number(r.draft.start))} 起 · {r.draft.duration}s ·{" "}
                    {r.draft.angle}° · {r.draft.caliber}mm · 安全 {r.draft.safetyDistance}m ·{" "}
                    {r.draft.quantity} 发
                  </span>
                </div>
                <ul className="reject-issues">
                  {r.issues.map((issue, idx) => (
                    <li key={idx} className={`issue-tag ${issue.type}`}>
                      <b>{TYPE_LABEL[issue.type]}</b> {issue.message}
                    </li>
                  ))}
                </ul>
                <footer>
                  <button type="button" className="btn small" onClick={() => onLoad(r)}>
                    载入并修正
                  </button>
                  <button
                    type="button"
                    className="btn small ghost"
                    onClick={() => onDiscard(r.id)}
                  >
                    丢弃
                  </button>
                </footer>
              </li>
            );
          })}
        </ul>
      )}

      {resolved.length > 0 && (
        <details className="resolved-box">
          <summary>已修正重提归档（{resolved.length}）</summary>
          <ul>
            {resolved.map((r) => (
              <li key={r.id}>
                <code>{r.id}</code>
                <span>
                  {r.draft.program}（批次 {r.draft.batchId}）→ 修正后入轴为{" "}
                  <b>{r.resolvedBy}</b>
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
