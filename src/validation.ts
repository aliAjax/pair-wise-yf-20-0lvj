import {
  BATCHES,
  MIN_GAP,
  MODELS,
  POSITIONS,
  PROGRAMS,
  batchById,
  batchesOfModel,
  modelById,
  positionById,
} from "./data";
import type {
  CheckIssue,
  Segment,
  SegmentDraft,
} from "./types";

/** 由表单解析出的候选段落（数值已转换） */
export interface Candidate {
  program: string;
  positionId: string;
  modelId: string;
  batchId: string;
  start: number;
  duration: number;
  angle: number;
  caliber: number;
  safetyDistance: number;
  quantity: number;
}

function num(raw: string): number {
  const v = Number(raw);
  return Number.isFinite(v) ? v : NaN;
}

/** 仅解析表单、校验字段自洽性（不对照时间轴/库存） */
export function parseDraft(draft: SegmentDraft): {
  candidate?: Candidate;
  errors: CheckIssue[];
} {
  const errors: CheckIssue[] = [];

  if (!PROGRAMS.includes(draft.program)) {
    errors.push({ type: "form", level: "error", message: "请选择所属节目" });
  }
  if (!positionById(draft.positionId)) {
    errors.push({ type: "form", level: "error", message: "请选择有效燃放点位" });
  }
  const model = modelById(draft.modelId);
  if (!model) {
    errors.push({ type: "form", level: "error", message: "请选择有效弹药型号" });
  }
  const batch = batchById(draft.batchId);
  if (!batch) {
    errors.push({ type: "form", level: "error", message: "请选择领用批次" });
  } else if (model && batch.modelId !== model.id) {
    errors.push({
      type: "form",
      level: "error",
      message: `批次 ${batch.id} 不属于型号「${model.name}」`,
    });
  }

  const start = num(draft.start);
  if (draft.start.trim() === "" || !Number.isFinite(start) || start < 0) {
    errors.push({
      type: "form",
      level: "error",
      message: "点火时刻需为不小于 0 的秒数",
    });
  }

  const duration = num(draft.duration);
  if (!Number.isFinite(duration) || duration <= 0 || duration > 900) {
    errors.push({
      type: "form",
      level: "error",
      message: "点火窗口长度需在 0–900 秒之间",
    });
  }

  const angle = num(draft.angle);
  if (!Number.isFinite(angle) || angle < 0 || angle > 180) {
    errors.push({
      type: "form",
      level: "error",
      message: "发射角需在 0–180° 之间",
    });
  }

  const caliber = num(draft.caliber);
  if (!Number.isFinite(caliber) || caliber <= 0 || caliber > 500) {
    errors.push({
      type: "form",
      level: "error",
      message: "口径需为 1–500mm 之间的数值",
    });
  } else if (model && caliber !== model.caliber) {
    errors.push({
      type: "caliber",
      level: "error",
      message: `申报口径 ${caliber}mm 与型号「${model.name}」标定口径 ${model.caliber}mm 不符`,
    });
  }

  const safetyDistance = num(draft.safetyDistance);
  if (!Number.isFinite(safetyDistance) || safetyDistance <= 0) {
    errors.push({
      type: "form",
      level: "error",
      message: "安全距离需为大于 0 的米数",
    });
  }

  const quantity = num(draft.quantity);
  if (!Number.isFinite(quantity) || quantity < 1 || !Number.isInteger(quantity)) {
    errors.push({
      type: "form",
      level: "error",
      message: "领用数量需为不小于 1 的整数",
    });
  }

  if (errors.length > 0) {
    return { errors };
  }

  return {
    candidate: {
      program: draft.program,
      positionId: draft.positionId,
      modelId: draft.modelId,
      batchId: draft.batchId,
      start,
      duration,
      angle,
      caliber,
      safetyDistance,
      quantity,
    },
    errors: [],
  };
}

/** 批次已占用数量 */
export function batchUsage(segments: Segment[]): Record<string, number> {
  const usage: Record<string, number> = {};
  for (const s of segments) {
    usage[s.batchId] = (usage[s.batchId] ?? 0) + s.quantity;
  }
  return usage;
}

/** 型号已占用数量（跨批次汇总） */
export function modelUsage(segments: Segment[]): Record<string, number> {
  const usage: Record<string, number> = {};
  for (const s of segments) {
    usage[s.modelId] = (usage[s.modelId] ?? 0) + s.quantity;
  }
  return usage;
}

export function batchRemaining(batchId: string, segments: Segment[]): number {
  const batch = batchById(batchId);
  if (!batch) return 0;
  return batch.total - (batchUsage(segments)[batchId] ?? 0);
}

/** 对照已入时间轴段落，执行三条硬性业务校验 */
export function businessChecks(
  candidate: Candidate,
  segments: Segment[]
): CheckIssue[] {
  const issues: CheckIssue[] = [];
  const cStart = candidate.start;
  const cEnd = candidate.start + candidate.duration;
  const batch = batchById(candidate.batchId);
  const remaining = batch
    ? batch.total - (batchUsage(segments)[batch.id] ?? 0)
    : NaN;

  for (const s of segments) {
    const sEnd = s.start + s.duration;
    const overlap = cStart < sEnd - 1e-9 && s.start < cEnd - 1e-9;
    if (overlap) {
      issues.push({
        type: "overlap",
        level: "error",
        against: s.id,
        message: `时间轴重叠：与 ${s.id}「${s.program}」窗口冲突（${s.start.toFixed(
          1
        )}s–${sEnd.toFixed(1)}s）`,
      });
      continue; // 已重叠的段落不再重复报间隔
    }

    if (s.positionId === candidate.positionId) {
      const gap =
        cStart >= sEnd ? cStart - sEnd : sStartGap(s, cEnd);
      if (gap < MIN_GAP - 1e-9) {
        const pos = positionById(s.positionId);
        issues.push({
          type: "gap",
          level: "error",
          against: s.id,
          message: `同点位安全间隔不足：与 ${pos?.name ?? s.positionId} 的 ${
            s.id
          } 仅间隔 ${gap.toFixed(2)}s（要求 ≥ ${MIN_GAP}s）`,
        });
      }
    }
  }

  if (Number.isFinite(remaining) && candidate.quantity > remaining) {
    issues.push({
      type: "stock",
      level: "error",
      message:
        remaining <= 0
          ? `批次 ${candidate.batchId} 余量不足：该批次已无库存，申报 ${candidate.quantity} 发`
          : `批次 ${candidate.batchId} 余量不足：仅剩 ${remaining} 发，申报 ${candidate.quantity} 发`,
    });
  }

  return issues;
}

function sStartGap(s: Segment, cEnd: number): number {
  return s.start - cEnd;
}

/** 完整预检：字段 + 业务规则 */
export function validateDraft(
  draft: SegmentDraft,
  segments: Segment[]
): CheckIssue[] {
  const { candidate, errors } = parseDraft(draft);
  if (!candidate) return errors;
  return [...errors, ...businessChecks(candidate, segments)];
}

export interface AuditResult {
  overlapCount: number;
  minGapByPosition: Record<string, number>;
  totalRemaining: number;
  emptyBatches: string[];
}

/** 对已入时间轴的段落做全场复核（正常情况下硬性冲突应为 0） */
export function auditTimeline(segments: Segment[]): AuditResult {
  let overlapCount = 0;
  const sorted = [...segments].sort((a, b) => a.start - b.start);
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i];
      const b = sorted[j];
      if (b.start >= a.start + a.duration) break;
      overlapCount += 1;
    }
  }

  const minGapByPosition: Record<string, number> = {};
  for (const pos of POSITIONS) {
    const mine = segments
      .filter((s) => s.positionId === pos.id)
      .sort((a, b) => a.start - b.start);
    let min = Infinity;
    for (let i = 1; i < mine.length; i++) {
      const gap = mine[i].start - (mine[i - 1].start + mine[i - 1].duration);
      if (gap >= -1e-9 && gap < min) min = gap;
    }
    if (Number.isFinite(min)) minGapByPosition[pos.id] = min;
  }

  const usage = batchUsage(segments);
  let totalRemaining = 0;
  const emptyBatches: string[] = [];
  for (const b of BATCHES) {
    const left = b.total - (usage[b.id] ?? 0);
    totalRemaining += left;
    if (left <= 0) emptyBatches.push(b.id);
  }

  return { overlapCount, minGapByPosition, totalRemaining, emptyBatches };
}

export function modelOptions() {
  return MODELS;
}

export function batchOptions(modelId: string, segments: Segment[]) {
  const usage = batchUsage(segments);
  return batchesOfModel(modelId).map((b) => ({
    batch: b,
    used: usage[b.id] ?? 0,
    remaining: b.total - (usage[b.id] ?? 0),
  }));
}
