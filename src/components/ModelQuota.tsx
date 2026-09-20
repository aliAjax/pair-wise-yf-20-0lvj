import { BATCHES, MODELS } from "../data";
import type { Segment } from "../types";
import { batchRemaining, batchUsage } from "../validation";

interface Props {
  segments: Segment[];
}

export default function ModelQuota({ segments }: Props) {
  const usage = batchUsage(segments);

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">AMMUNITION QUOTA</p>
          <h2>型号配额 · 批次余量</h2>
        </div>
        <span className="muted">驳回申报不占用任何库存</span>
      </div>

      <div className="quota-grid">
        {MODELS.map((m) => {
          const batches = BATCHES.filter((b) => b.modelId === m.id);
          const usedModel = batches.reduce(
            (sum, b) => sum + (usage[b.id] ?? 0),
            0
          );
          const ratio = m.total === 0 ? 0 : usedModel / m.total;
          const tight = m.total - usedModel <= 4;
          return (
            <article
              key={m.id}
              className={`quota-card ${tight ? "tight" : ""}`}
              style={{ ["--model-color" as string]: m.color }}
            >
              <header>
                <i className="quota-swatch" style={{ background: m.color }} />
                <div>
                  <h3>{m.name}</h3>
                  <p>
                    {m.kind} · {m.caliber}mm
                  </p>
                </div>
                <strong className={tight ? "warn" : ""}>
                  {m.total - usedModel}
                  <small>/{m.total}</small>
                </strong>
              </header>

              <div className="quota-bar">
                <i style={{ width: `${Math.min(ratio * 100, 100)}%` }} />
              </div>

              <ul className="batch-list">
                {batches.map((b) => {
                  const left = batchRemaining(b.id, segments);
                  return (
                    <li key={b.id} className={left <= 0 ? "empty" : ""}>
                      <code>{b.id}</code>
                      <span>{b.receivedAt}</span>
                      <b>
                        {left}/{b.total}
                      </b>
                      <em className="usage-line">
                        <i
                          style={{
                            width: `${Math.max(0, Math.min(1 - left / b.total, 1)) * 100}%`,
                          }}
                        />
                      </em>
                    </li>
                  );
                })}
              </ul>
            </article>
          );
        })}
      </div>
    </section>
  );
}
