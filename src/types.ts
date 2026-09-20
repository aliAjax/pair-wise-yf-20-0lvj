export type IssueLevel = "error" | "warn";
export type IssueType =
  | "form"
  | "overlap"
  | "gap"
  | "stock"
  | "caliber";

export interface CheckIssue {
  type: IssueType;
  level: IssueLevel;
  message: string;
  against?: string;
}

/** 燃放点位 */
export interface Position {
  id: string;
  name: string;
  x: number; // 平面图百分比坐标
  y: number;
  zone: string;
}

/** 弹药型号（四款） */
export interface AmmoModel {
  id: string;
  name: string;
  kind: string;
  caliber: number; // mm
  total: number; // 全型号总配额（所有批次之和）
  color: string;
}

/** 领用批次 */
export interface Batch {
  id: string;
  modelId: string;
  total: number;
  receivedAt: string;
}

/** 已入时间轴的燃放段落 */
export interface Segment {
  id: string;
  program: string;
  positionId: string;
  modelId: string;
  batchId: string;
  start: number; // 点火时刻（秒，相对于整场零点）
  duration: number; // 窗口长度（秒）
  angle: number; // 发射角（度）
  caliber: number; // 申报口径（mm）
  safetyDistance: number; // 安全距离（米）
  quantity: number; // 领用数量
  createdAt: string;
}

/** 被驳回的申报（整段未入时间轴，弹药已回滚） */
export interface RejectedSubmission {
  id: string;
  createdAt: string;
  draft: SegmentDraft;
  issues: CheckIssue[];
  resolvedBy?: string; // 修正后成功重提所生成的段落 id
}

/** 新增段落表单草稿 */
export interface SegmentDraft {
  program: string;
  positionId: string;
  modelId: string;
  batchId: string;
  start: string;
  duration: string;
  angle: string;
  caliber: string;
  safetyDistance: string;
  quantity: string;
}

export interface PersistedState {
  version: number;
  segments: Segment[];
  rejected: RejectedSubmission[];
  draft: SegmentDraft;
  seq: number;
}
