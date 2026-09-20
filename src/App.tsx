import { useCallback, useRef, useState } from "react";
import "./styles.css";
import SegmentForm from "./components/SegmentForm";
import Timeline from "./components/Timeline";
import PositionMap from "./components/PositionMap";
import ModelQuota from "./components/ModelQuota";
import ConflictList from "./components/ConflictList";
import ShowPreview from "./components/ShowPreview";
import { useShowStore } from "./useShowStore";

interface Toast {
  id: number;
  kind: "ok" | "bad";
  text: string;
}

function App() {
  const store = useShowStore();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const toastSeq = useRef(0);

  const pushToast = useCallback((kind: Toast["kind"], text: string) => {
    const id = ++toastSeq.current;
    setToasts((prev) => [...prev, { id, kind, text }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  const handleSubmit = useCallback(() => {
    const result = store.submit();
    if (result.ok) {
      pushToast(
        "ok",
        `校验通过，段落 ${result.segmentId} 已入时间轴，批次库存已锁定。`
      );
    } else {
      pushToast(
        "bad",
        `申报被驳回（${result.issueCount} 项不通过）：整段未入时间轴，占用弹药已回滚，可修正后以原批次重提。`
      );
    }
  }, [store, pushToast]);

  const handleResetAll = useCallback(() => {
    if (!window.confirm("恢复到预置数据？当前编排与驳回记录将被清除。")) return;
    store.resetAll();
    setCursor(null);
    setPlaying(false);
    pushToast("ok", "已恢复为预置五点位、四节目、四弹药初始状态。");
  }, [store, pushToast]);

  return (
    <main className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">✦</span>
          <div>
            <h1>烟花燃放脚本编排台</h1>
            <p>五点位 · 四段节目 · 四款弹药 ｜ 点火窗口 / 发射角 / 口径 / 安全距离 / 领用批次 一体化校验</p>
          </div>
        </div>
        <div className="top-actions">
          <span className="save-note" title="数据通过 localStorage 本地保存">
            ● 本地自动保存
          </span>
          <button type="button" className="btn ghost" onClick={handleResetAll}>
            恢复预置
          </button>
        </div>
      </header>

      <section className="rule-strip">
        <span>硬性规则：</span>
        <b>① 时间轴不得重叠</b>
        <b>② 同点位相邻窗口间隔 ≥ 1.2s</b>
        <b>③ 领用批次余量必须充足</b>
        <em>任一不通过 → 整段不入时间轴，已占用弹药全部回滚</em>
      </section>

      <div className="layout-top">
        <SegmentForm
          draft={store.draft}
          segments={store.segments}
          linked={store.rejected.filter((r) =>
            store.linkedRejections.includes(r.id)
          )}
          onUpdate={store.updateDraft}
          onSubmit={handleSubmit}
          onReset={store.resetDraft}
          onUnlink={store.unlinkRejection}
        />
        <PositionMap segments={store.segments} cursor={cursor} />
      </div>

      <Timeline
        segments={store.segments}
        cursor={cursor}
        onSeek={(t) => {
          setPlaying(false);
          setCursor(t);
        }}
        onDelete={(id) => {
          store.deleteSegment(id);
          pushToast("ok", `段落 ${id} 已撤档，对应弹药退回批次库存。`);
        }}
      />

      <div className="layout-mid">
        <ConflictList
          rejected={store.rejected}
          segments={store.segments}
          linkedIds={store.linkedRejections}
          onLoad={store.loadRejection}
          onDiscard={store.discardRejection}
        />
        <ModelQuota segments={store.segments} />
      </div>

      <ShowPreview
        segments={store.segments}
        cursor={cursor}
        setCursor={setCursor}
        playing={playing}
        setPlaying={setPlaying}
      />

      <footer className="footer-note">
        编排数据保存在浏览器 localStorage（cue-console-v1），刷新页面后保留；
        撤档段落会自动归还其批次领用数量。
      </footer>

      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            <span>{t.kind === "ok" ? "✓" : "✕"}</span>
            <p>{t.text}</p>
          </div>
        ))}
      </div>
    </main>
  );
}

export default App;
