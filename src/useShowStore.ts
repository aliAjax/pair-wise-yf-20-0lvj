import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DATA_VERSION,
  EMPTY_DRAFT,
  SEED_SEGMENTS,
  STORAGE_KEY,
} from "./data";
import type {
  PersistedState,
  RejectedSubmission,
  Segment,
  SegmentDraft,
} from "./types";
import { parseDraft, businessChecks } from "./validation";

function freshState(): PersistedState {
  return {
    version: DATA_VERSION,
    segments: SEED_SEGMENTS,
    rejected: [],
    draft: { ...EMPTY_DRAFT },
    seq: SEED_SEGMENTS.length,
  };
}

function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshState();
    const parsed = JSON.parse(raw) as PersistedState;
    if (parsed.version !== DATA_VERSION) return freshState();
    if (!Array.isArray(parsed.segments) || !Array.isArray(parsed.rejected)) {
      return freshState();
    }
    return {
      version: DATA_VERSION,
      segments: parsed.segments,
      rejected: parsed.rejected,
      draft: { ...EMPTY_DRAFT, ...(parsed.draft ?? {}) },
      seq: typeof parsed.seq === "number" ? parsed.seq : parsed.segments.length,
    };
  } catch {
    return freshState();
  }
}

export interface SubmitResult {
  ok: boolean;
  segmentId?: string;
  rejectionId?: string;
  issueCount: number;
}

export function useShowStore() {
  const [state, setState] = useState<PersistedState>(loadState);
  const [linkedRejections, setLinkedRejections] = useState<string[]>([]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* 存储不可用时静默降级，不影响当前编排 */
    }
  }, [state]);

  const updateDraft = useCallback((patch: Partial<SegmentDraft>) => {
    setState((prev) => ({ ...prev, draft: { ...prev.draft, ...patch } }));
  }, []);

  const resetDraft = useCallback(() => {
    setState((prev) => ({ ...prev, draft: { ...EMPTY_DRAFT } }));
    setLinkedRejections([]);
  }, []);

  /**
   * 关键路径：整段校验后一次性提交。
   * 任一规则不通过 → 不构造 Segment、不写时间轴、不扣批次，占用天然回滚；
   * 仅登记一条驳回记录，表单原值保留，可在同批次上修正后重提。
   */
  const submit = useCallback((): SubmitResult => {
    const draft = state.draft;
    const { candidate, errors } = parseDraft(draft);
    const issues = candidate
      ? [...errors, ...businessChecks(candidate, state.segments)]
      : errors;

    if (issues.length > 0) {
      const id = `R${String(state.rejected.length + 1).padStart(3, "0")}`;
      const rejection: RejectedSubmission = {
        id,
        createdAt: new Date().toISOString(),
        draft: { ...draft },
        issues,
      };
      setState((prev) => ({ ...prev, rejected: [...prev.rejected, rejection] }));
      setLinkedRejections((prev) =>
        prev.includes(id) ? prev : [...prev, id]
      );
      return { ok: false, rejectionId: id, issueCount: issues.length };
    }

    const seq = state.seq + 1;
    const segment: Segment = {
      id: `S${String(seq).padStart(3, "0")}`,
      ...(candidate as Omit<
        Segment,
        "id" | "createdAt"
      >),
      createdAt: new Date().toISOString(),
    };
    const resolved = new Set(linkedRejections);
    setState((prev) => ({
      ...prev,
      seq,
      segments: [...prev.segments, segment],
      rejected: prev.rejected.map((r) =>
        resolved.has(r.id) ? { ...r, resolvedBy: segment.id } : r
      ),
      draft: { ...EMPTY_DRAFT },
    }));
    setLinkedRejections([]);
    return { ok: true, segmentId: segment.id, issueCount: 0 };
  }, [state.draft, state.segments, state.rejected.length, state.seq, linkedRejections]);

  const loadRejection = useCallback((r: RejectedSubmission) => {
    setState((prev) => ({ ...prev, draft: { ...r.draft } }));
    setLinkedRejections((prev) =>
      prev.includes(r.id) ? prev : [...prev, r.id]
    );
  }, []);

  const unlinkRejection = useCallback((id: string) => {
    setLinkedRejections((prev) => prev.filter((x) => x !== id));
  }, []);

  const discardRejection = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      rejected: prev.rejected.filter((r) => r.id !== id),
    }));
    setLinkedRejections((prev) => prev.filter((x) => x !== id));
  }, []);

  const deleteSegment = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      segments: prev.segments.filter((s) => s.id !== id),
    }));
  }, []);

  const resetAll = useCallback(() => {
    setState(freshState());
    setLinkedRejections([]);
  }, []);

  const openRejected = useMemo(
    () => state.rejected.filter((r) => !r.resolvedBy),
    [state.rejected]
  );

  return {
    segments: state.segments,
    rejected: state.rejected,
    openRejected,
    draft: state.draft,
    linkedRejections,
    updateDraft,
    resetDraft,
    submit,
    loadRejection,
    unlinkRejection,
    discardRejection,
    deleteSegment,
    resetAll,
  };
}
