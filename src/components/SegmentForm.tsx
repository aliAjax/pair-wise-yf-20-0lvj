import { useMemo } from "react";
import {
  BATCHES,
  MIN_GAP,
  MODELS,
  POSITIONS,
  PROGRAMS,
  batchesOfModel,
  formatTime,
  modelById,
} from "../data";
import type {
  CheckIssue,
  RejectedSubmission,
  Segment,
  SegmentDraft,
} from "../types";
import { batchRemaining, validateDraft } from "../validation";

interface Props {
  draft: SegmentDraft;
  segments: Segment[];
  linked: RejectedSubmission[];
  onUpdate: (patch: Partial<SegmentDraft>) => void;
  onSubmit: () => void;
  onReset: () => void;
  onUnlink: (id: string) => void;
}

const TYPE_LABEL: Record<CheckIssue["type"], string> = {
  form: "字段",
  overlap: "时间轴重叠",
  gap: `同点位间隔<${MIN_GAP}s`,
  stock: "批次余量",
  caliber: "口径不符",
};

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span className="field-label">
        {label}
        {hint ? <em className="field-hint">{hint}</em> : null}
      </span>
      {children}
    </label>
  );
}

export default function SegmentForm({
  draft,
  segments,
  linked,
  onUpdate,
  onSubmit,
  onReset,
  onUnlink,
}: Props) {
  const issues = useMemo(
    () => validateDraft(draft, segments),
    [draft, segments]
  );
  const errors = issues.filter((i) => i.level === "error");
  const model = modelById(draft.modelId);
  const startNum = Number(draft.start);
  const batches = batchesOfModel(draft.modelId);

  const issueTypes = new Set(issues.map((i) => i.type));

  return (
    <section className="panel form-panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">SEGMENT DECLARATION</p>
          <h2>新增段落申报</h2>
        </div>
        <button className="btn ghost" type="button" onClick={onReset}>
          清空表单
        </button>
      </div>

      {linked.length > 0 && (
        <div className="linked-bar">
          <span>修正重提关联：</span>
          {linked.map((r) => (
            <span key={r.id} className="linked-chip">
              {r.id}（原批次 {r.draft.batchId}）
              <button
                type="button"
                aria-label={`取消关联 ${r.id}`}
                onClick={() => onUnlink(r.id)}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="field-grid">
        <Field label="所属节目">
          <select
            value={draft.program}
            onChange={(e) => onUpdate({ program: e.target.value })}
          >
            {PROGRAMS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Field>

        <Field label="燃放点位">
          <select
            value={draft.positionId}
            onChange={(e) => onUpdate({ positionId: e.target.value })}
          >
            {POSITIONS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id} · {p.name}（{p.zone}）
              </option>
            ))}
          </select>
        </Field>

        <Field label="弹药型号">
          <select
            value={draft.modelId}
            onChange={(e) => {
              const next = batchesOfModel(e.target.value)[0];
              const m = modelById(e.target.value);
              onUpdate({
                modelId: e.target.value,
                batchId: next?.id ?? "",
                caliber: m ? String(m.caliber) : draft.caliber,
              });
            }}
          >
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.id} · {m.name}（{m.kind} {m.caliber}mm）
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="领用批次"
          hint={
            model
              ? `型号余量 ${batchRemainingOfModel(draft.modelId, segments)}/${
                  model.total
                }`
              : undefined
          }
        >
          <select
            value={draft.batchId}
            onChange={(e) => onUpdate({ batchId: e.target.value })}
          >
            {batches.map((b) => {
              const left = batchRemaining(b.id, segments);
              return (
                <option key={b.id} value={b.id} disabled={left <= 0}>
                  {b.id} · {b.receivedAt}｜余量 {left}/{b.total}
                  {left <= 0 ? "（已罄）" : ""}
                </option>
              );
            })}
          </select>
        </Field>

        <Field
          label="点火窗口起点（秒）"
          hint={
            Number.isFinite(startNum) && startNum >= 0
              ? formatTime(startNum)
              : undefined
          }
        >
          <input
            type="number"
            min={0}
            step={0.1}
            placeholder="例如 12.5"
            value={draft.start}
            onChange={(e) => onUpdate({ start: e.target.value })}
          />
        </Field>

        <Field label="窗口长度（秒）">
          <input
            type="number"
            min={0.1}
            step={0.1}
            value={draft.duration}
            onChange={(e) => onUpdate({ duration: e.target.value })}
          />
        </Field>

        <Field label="发射角（°）" hint="90° 垂直向上">
          <input
            type="number"
            min={0}
            max={180}
            step={1}
            value={draft.angle}
            onChange={(e) => onUpdate({ angle: e.target.value })}
          />
        </Field>

        <Field
          label="口径（mm）"
          hint={model ? `型号标定 ${model.caliber}mm` : undefined}
        >
          <input
            type="number"
            min={1}
            step={1}
            className={issueTypes.has("caliber") ? "input-bad" : ""}
            value={draft.caliber}
            onChange={(e) => onUpdate({ caliber: e.target.value })}
          />
        </Field>

        <Field label="安全距离（m）">
          <input
            type="number"
            min={1}
            step={1}
            value={draft.safetyDistance}
            onChange={(e) => onUpdate({ safetyDistance: e.target.value })}
          />
        </Field>

        <Field label="领用数量（发）">
          <input
            type="number"
            min={1}
            step={1}
            value={draft.quantity}
            onChange={(e) => onUpdate({ quantity: e.target.value })}
          />
        </Field>
      </div>

      <div className="submit-row">
        <div className="preflight">
          {errors.length === 0 ? (
            <span className="check-ok">● 预检通过：可入时间轴</span>
          ) : (
            <span className="check-bad">● 预检未通过 {errors.length} 项</span>
          )}
          {(["overlap", "gap", "stock", "caliber"] as const).map((t) => (
            <span
              key={t}
              className={`rule-chip ${issueTypes.has(t) ? "bad" : "ok"}`}
            >
              {TYPE_LABEL[t]}
            </span>
          ))}
        </div>
        <button className="btn primary" type="button" onClick={onSubmit}>
          校验并申报入时间轴
        </button>
      </div>

      {issues.length > 0 && (
        <ul className="issue-preview">
          {issues.map((issue, idx) => (
            <li key={`${issue.type}-${idx}`} className={`issue ${issue.type}`}>
              <b>{TYPE_LABEL[issue.type]}</b>
              <span>{issue.message}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="form-foot">
        任一项不通过则整段不入时间轴，已占用弹药全部回滚；驳回后可修正并以原批次重新申报。
      </p>
    </section>
  );
}

function batchRemainingOfModel(modelId: string, segments: Segment[]): number {
  const ids = new Set(
    BATCHES.filter((b) => b.modelId === modelId).map((b) => b.id)
  );
  return batchesOfModel(modelId).reduce(
    (sum, b) => sum + batchRemaining(b.id, segments),
    0
  );
}
