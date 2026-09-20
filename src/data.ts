import type {
  AmmoModel,
  Batch,
  Position,
  Segment,
  SegmentDraft,
} from "./types";

export const STORAGE_KEY = "cue-console-v1";
export const DATA_VERSION = 1;

/** 同一点位相邻点火窗口最小安全间隔（秒） */
export const MIN_GAP = 1.2;

/** 预置：五个点位 */
export const POSITIONS: Position[] = [
  { id: "P1", name: "一号位·湖心", x: 50, y: 46, zone: "水面平台" },
  { id: "P2", name: "二号位·东岸", x: 82, y: 30, zone: "东岸高架" },
  { id: "P3", name: "三号位·西岸", x: 18, y: 30, zone: "西岸高架" },
  { id: "P4", name: "四号位·北岸", x: 50, y: 10, zone: "北岸楼体" },
  { id: "P5", name: "五号位·前景", x: 50, y: 84, zone: "观众前场" },
];

/** 预置：四款弹药（型号配额） */
export const MODELS: AmmoModel[] = [
  {
    id: "M1",
    name: "惊雷·礼花弹",
    kind: "礼花弹",
    caliber: 75,
    total: 24,
    color: "#f97316",
  },
  {
    id: "M2",
    name: "银瀑·罗马烛光",
    kind: "罗马烛光",
    caliber: 30,
    total: 40,
    color: "#38bdf8",
  },
  {
    id: "M3",
    name: "孔雀·扇形架",
    kind: "扇形架",
    caliber: 45,
    total: 16,
    color: "#a78bfa",
  },
  {
    id: "M4",
    name: "霜花·冷焰火",
    kind: "冷焰火",
    caliber: 25,
    total: 32,
    color: "#e2e8f0",
  },
];

/** 预置：领用批次 */
export const BATCHES: Batch[] = [
  { id: "B-M1-A", modelId: "M1", total: 14, receivedAt: "09-18 批次 A" },
  { id: "B-M1-B", modelId: "M1", total: 10, receivedAt: "09-19 批次 B" },
  { id: "B-M2-A", modelId: "M2", total: 24, receivedAt: "09-18 批次 A" },
  { id: "B-M2-B", modelId: "M2", total: 16, receivedAt: "09-19 批次 B" },
  { id: "B-M3-A", modelId: "M3", total: 10, receivedAt: "09-18 批次 A" },
  { id: "B-M3-B", modelId: "M3", total: 6, receivedAt: "09-19 批次 B" },
  { id: "B-M4-A", modelId: "M4", total: 20, receivedAt: "09-18 批次 A" },
  { id: "B-M4-B", modelId: "M4", total: 12, receivedAt: "09-19 批次 B" },
];

export const PROGRAMS = ["序章·启幕", "华章·竞放", "高潮·齐鸣", "终章·星雨"];

export const EMPTY_DRAFT: SegmentDraft = {
  program: PROGRAMS[0],
  positionId: "P1",
  modelId: "M1",
  batchId: "B-M1-A",
  start: "",
  duration: "3",
  angle: "90",
  caliber: "75",
  safetyDistance: "60",
  quantity: "1",
};

/** 预置：四段节目（彼此时间轴不重叠；同点位间隔均 ≥ 1.2s；批次余量充足） */
export const SEED_SEGMENTS: Segment[] = [
  {
    id: "S001",
    program: "序章·启幕",
    positionId: "P1",
    modelId: "M2",
    batchId: "B-M2-A",
    start: 0,
    duration: 4,
    angle: 82,
    caliber: 30,
    safetyDistance: 35,
    quantity: 6,
    createdAt: "2026-09-20T09:00:00.000Z",
  },
  {
    id: "S002",
    program: "华章·竞放",
    positionId: "P2",
    modelId: "M1",
    batchId: "B-M1-A",
    start: 6,
    duration: 5,
    angle: 90,
    caliber: 75,
    safetyDistance: 60,
    quantity: 4,
    createdAt: "2026-09-20T09:01:00.000Z",
  },
  {
    id: "S003",
    program: "高潮·齐鸣",
    positionId: "P3",
    modelId: "M3",
    batchId: "B-M3-A",
    start: 14,
    duration: 4,
    angle: 70,
    caliber: 45,
    safetyDistance: 50,
    quantity: 4,
    createdAt: "2026-09-20T09:02:00.000Z",
  },
  {
    id: "S004",
    program: "终章·星雨",
    positionId: "P1",
    modelId: "M4",
    batchId: "B-M4-A",
    start: 26,
    duration: 8,
    angle: 90,
    caliber: 25,
    safetyDistance: 25,
    quantity: 10,
    createdAt: "2026-09-20T09:03:00.000Z",
  },
];

export function modelById(id: string): AmmoModel | undefined {
  return MODELS.find((m) => m.id === id);
}

export function batchesOfModel(modelId: string): Batch[] {
  return BATCHES.filter((b) => b.modelId === modelId);
}

export function batchById(id: string): Batch | undefined {
  return BATCHES.find((b) => b.id === id);
}

export function positionById(id: string): Position | undefined {
  return POSITIONS.find((p) => p.id === id);
}

/** 秒 → m:ss.d */
export function formatTime(sec: number): string {
  if (!Number.isFinite(sec)) return "—";
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}
