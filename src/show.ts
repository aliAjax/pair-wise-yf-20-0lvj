// 烟花燃放脚本编排 —— 领域模型、预置数据与校验规则

export const SAFETY_GAP = 1.2; // 同点位安全间隔（秒）
export const STORAGE_KEY = "hxyfront-62008:show-state:v1";

export interface Position {
  id: string;
  name: string;
  zone: string;
  x: number; // 平面图坐标（0-100）
  y: number; // 平面图坐标（0-62）
}

export interface AmmoModel {
  id: string;
  name: string;
  caliber: number; // 口径 mm
  minSafety: number; // 最小安全距离 m
  angleMin: number; // 允许发射角
  angleMax: number;
  color: string;
}

export interface Batch {
  id: string;
  modelId: string;
  code: string; // 批次号
  total: number; // 领用总量（发）
}

export interface Segment {
  id: string;
  name: string;
  positionId: string;
  modelId: string;
  batchId: string;
  start: number; // 点火窗口起点（秒）
  duration: number; // 窗口时长（秒）
  shots: number; // 弹药量（发）
  angle: number; // 发射角（度）
  caliber: number; // 申报口径 mm
  safety: number; // 申报安全距离 m
}

export type SegmentDraft = Omit<Segment, "id">;

export interface Conflict {
  id: string;
  at: number; // 提交时间戳
  name: string;
  reasons: string[];
  rolledBackShots: number; // 已回滚的弹药量
  batchCode: string;
  draft: SegmentDraft; // 原始草稿，供原批次重提
}

// ---------- 预置数据：5 点位 / 4 型号 / 4 批次 / 4 段落 ----------

export const POSITIONS: Position[] = [
  { id: "P-A", name: "A 主发射区", zone: "高空礼花区", x: 22, y: 44 },
  { id: "P-B", name: "B 东坡阵地", zone: "高空礼花区", x: 78, y: 40 },
  { id: "P-C", name: "C 湖面浮台", zone: "水面倒影区", x: 50, y: 14 },
  { id: "P-D", name: "D 西坡阵地", zone: "中低空区", x: 14, y: 16 },
  { id: "P-E", name: "E 近景冷焰区", zone: "观众近景区", x: 84, y: 56 },
];

export const MODELS: AmmoModel[] = [
  { id: "M-LH", name: "礼花弹", caliber: 75, minSafety: 70, angleMin: 45, angleMax: 90, color: "#dc2626" },
  { id: "M-LM", name: "罗马烛光", caliber: 30, minSafety: 35, angleMin: 60, angleMax: 90, color: "#1d4ed8" },
  { id: "M-SX", name: "扇形架", caliber: 30, minSafety: 35, angleMin: 30, angleMax: 120, color: "#f59e0b" },
  { id: "M-LY", name: "冷焰火", caliber: 10, minSafety: 8, angleMin: 0, angleMax: 180, color: "#0d9488" },
];

export const BATCHES: Batch[] = [
  { id: "B-2501", modelId: "M-LH", code: "LY-2501", total: 40 },
  { id: "B-2502", modelId: "M-LM", code: "LM-2502", total: 120 },
  { id: "B-2503", modelId: "M-SX", code: "SX-2503", total: 60 },
  { id: "B-2504", modelId: "M-LY", code: "LH-2504", total: 200 },
];

export const PRESET_SEGMENTS: Segment[] = [
  { id: "S-01", name: "开场迎宾", positionId: "P-A", modelId: "M-SX", batchId: "B-2503", start: 12.5, duration: 8, shots: 12, angle: 60, caliber: 30, safety: 35 },
  { id: "S-02", name: "第一乐章", positionId: "P-B", modelId: "M-LH", batchId: "B-2501", start: 68.2, duration: 12, shots: 10, angle: 75, caliber: 75, safety: 70 },
  { id: "S-03", name: "湖面倒影", positionId: "P-C", modelId: "M-LM", batchId: "B-2502", start: 110, duration: 15, shots: 24, angle: 90, caliber: 30, safety: 35 },
  { id: "S-04", name: "终章齐鸣", positionId: "P-A", modelId: "M-LH", batchId: "B-2501", start: 222, duration: 20, shots: 16, angle: 80, caliber: 75, safety: 70 },
];

// ---------- 工具 ----------

export function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${String(m).padStart(2, "0")}:${s.toFixed(1).padStart(4, "0")}`;
}

export function batchUsed(segments: Segment[], batchId: string): number {
  return segments.filter((s) => s.batchId === batchId).reduce((n, s) => n + s.shots, 0);
}

export function modelOf(id: string): AmmoModel {
  return MODELS.find((m) => m.id === id) ?? MODELS[0];
}

export function positionOf(id: string): Position {
  return POSITIONS.find((p) => p.id === id) ?? POSITIONS[0];
}

export function batchOf(id: string): Batch {
  return BATCHES.find((b) => b.id === id) ?? BATCHES[0];
}

// ---------- 校验：任一不通过则整段拒绝 ----------

export function validateDraft(draft: SegmentDraft, segments: Segment[]): string[] {
  const reasons: string[] = [];
  const model = modelOf(draft.modelId);
  const pos = positionOf(draft.positionId);

  if (!draft.name.trim()) reasons.push("段落名称不能为空");
  if (!(draft.start >= 0)) reasons.push("点火窗口起点必须 ≥ 0 秒");
  if (!(draft.duration > 0)) reasons.push("点火窗口时长必须 > 0 秒");
  if (!(draft.shots > 0)) reasons.push("弹药量必须 ≥ 1 发");
  if (draft.caliber !== model.caliber)
    reasons.push(`申报口径 ${draft.caliber}mm 与型号「${model.name}」的 ${model.caliber}mm 不符`);
  if (draft.angle < model.angleMin || draft.angle > model.angleMax)
    reasons.push(`发射角 ${draft.angle}° 超出「${model.name}」允许范围 ${model.angleMin}°–${model.angleMax}°`);
  if (draft.safety < model.minSafety)
    reasons.push(`安全距离 ${draft.safety}m 低于「${model.name}」下限 ${model.minSafety}m`);

  const a0 = draft.start;
  const a1 = draft.start + draft.duration;
  for (const seg of segments) {
    if (seg.positionId !== draft.positionId) continue;
    const b0 = seg.start;
    const b1 = seg.start + seg.duration;
    if (a0 < b1 && b0 < a1) {
      reasons.push(
        `时间轴重叠：${pos.name} 上「${seg.name}」(${fmtTime(b0)}–${fmtTime(b1)}) 与本段 (${fmtTime(a0)}–${fmtTime(a1)}) 相交`
      );
    } else {
      const gap = a1 <= b0 ? b0 - a1 : a0 - b1;
      if (gap < SAFETY_GAP)
        reasons.push(`同点位安全间隔不足 ${SAFETY_GAP} 秒：与「${seg.name}」仅相隔 ${gap.toFixed(1)} 秒`);
    }
  }

  const batch = batchOf(draft.batchId);
  if (batch.modelId !== draft.modelId) {
    reasons.push(`批次 ${batch.code} 不属于型号「${model.name}」`);
  } else {
    const remain = batch.total - batchUsed(segments, draft.batchId);
    if (draft.shots > remain)
      reasons.push(`批次余量不足：${batch.code} 剩余 ${remain} 发，本段需 ${draft.shots} 发`);
  }

  return reasons;
}

export interface CommitResult {
  ok: boolean;
  segments: Segment[];
  conflict: Conflict | null;
}

/**
 * 事务式提交：先按草稿占用弹药生成候选时间轴，逐项校验；
 * 任一不通过则整段不入时间轴，已占用弹药全部回滚，并留下冲突记录。
 */
export function commitSegment(draft: SegmentDraft, segments: Segment[], seq: number): CommitResult {
  const candidate: Segment = { ...draft, id: `S-${String(seq).padStart(2, "0")}` };
  const reasons = validateDraft(draft, segments);
  if (reasons.length > 0) {
    return {
      ok: false,
      segments, // 回滚：时间轴与弹药占用保持原状
      conflict: {
        id: `C-${Date.now()}-${seq}`,
        at: Date.now(),
        name: draft.name || "（未命名段落）",
        reasons,
        rolledBackShots: draft.shots > 0 ? draft.shots : 0,
        batchCode: batchOf(draft.batchId).code,
        draft,
      },
    };
  }
  return { ok: true, segments: [...segments, candidate], conflict: null };
}

// ---------- 本地持久化 ----------

export interface ShowState {
  segments: Segment[];
  conflicts: Conflict[];
  seq: number;
}

export const INITIAL_STATE: ShowState = {
  segments: PRESET_SEGMENTS,
  conflicts: [],
  seq: 5,
};

export function loadState(): ShowState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL_STATE;
    const parsed = JSON.parse(raw) as ShowState;
    if (!Array.isArray(parsed.segments) || !Array.isArray(parsed.conflicts)) return INITIAL_STATE;
    return { ...INITIAL_STATE, ...parsed };
  } catch {
    return INITIAL_STATE;
  }
}

export function saveState(state: ShowState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 存储不可用时静默降级，页面功能不受影响
  }
}
