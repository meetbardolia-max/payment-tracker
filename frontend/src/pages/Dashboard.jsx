import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  FileUp, ChevronRight, Users, ListChecks, AlertTriangle, TrendingUp, Sparkles,
} from "lucide-react";
import { client, money, shortMoney, fmtDate, OUTCOME_LABEL, initials } from "@/lib/api";
import { Loading } from "@/App";
import { toast } from "sonner";

function Empty({ text }) {
  return <div className="empty" data-testid="empty-state">{text}</div>;
}

function Stat({ label, value, sub, accent, testid }) {
  return (
    <section className={`stat ${accent || ""}`} data-testid={testid}>
      <span className="stat-label">{label}</span>
      <strong>{value}</strong>
      <small>{sub}</small>
    </section>
  );
}

export default function Dashboard({ user }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    client.get("/dashboard").then((r) => setData(r.data)).catch(() => toast.error("Dashboard could not load"));
  }, []);
  if (!data) return <Loading />;

  const m = data.metrics;
  const isField = user.role === "field_officer";
  const canUpload = user.role === "owner" || user.role === "head_officer";
  const snapshot = data.snapshot;

  return (
    <div className="page" data-testid="dashboard-page">
      <div className="page-head">
        <div>
          <span className="eyebrow">
            {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).toUpperCase()}
          </span>
          <h1>{isField ? `Namaste ${user.name.split(" ")[0]}, ready to work?` : "Good morning, keep collections moving."}</h1>
          <p className="muted">
            {snapshot
              ? <>Working from snapshot <b>{snapshot.period_label}</b> · uploaded {fmtDate(snapshot.uploaded_at)} by {snapshot.uploaded_by_name}</>
              : "No outstanding snapshot yet. Upload the monthly report to get started."}
          </p>
        </div>
        {canUpload && (
          <NavLink data-testid="dashboard-upload-cta" className="primary-button" to="/upload">
            <FileUp size={16} /> Upload snapshot
          </NavLink>
        )}
      </div>

      {!snapshot && (
        <section className="hero-empty" data-testid="dashboard-no-snapshot">
          <div className="hero-icon"><FileUp size={26} /></div>
          <h3>No outstanding snapshot yet</h3>
          <p>Upload the Masterwise Groupwise Partywise Outstanding Report (.xlsx) to open the workspace.</p>
          {canUpload && (
            <NavLink to="/upload" className="primary-button" data-testid="hero-upload-cta">
              <FileUp size={16} /> Upload the first snapshot
            </NavLink>
          )}
        </section>
      )}

      {snapshot && (
        <>
          <div className="stats-grid">
            <Stat
              testid="metric-total-outstanding"
              label={isField ? "Your outstanding" : "Total outstanding"}
              value={shortMoney(m.total_outstanding)}
              sub={`${m.party_count} ${isField ? "assigned parties" : "parties in scope"}`}
              accent="stat-primary"
            />
            <Stat
              testid="metric-follow-ups"
              label="Follow-ups logged"
              value={m.follow_up_count}
              sub={`${OUTCOME_LABEL.paid_full}: ${data.outcomes.paid_full} · Partial: ${data.outcomes.paid_partial}`}
              accent="stat-paid"
            />
            <Stat
              testid="metric-due-today"
              label="Due today"
              value={m.due_today_count}
              sub="Follow-ups scheduled for today"
              accent="stat-due"
            />
            <Stat
              testid="metric-broken-promises"
              label="Broken promises"
              value={m.broken_promise_count}
              sub="Promised date passed, still unpaid"
              accent="stat-overdue"
            />
          </div>

          {!isField && (
            <div className="stats-grid stats-secondary">
              <Stat
                testid="metric-assigned"
                label="Assigned parties"
                value={`${m.assigned_count} / ${m.party_count}`}
                sub={`${m.unassigned_count} still unassigned`}
              />
              <Stat
                testid="metric-collected"
                label="Collected in this snapshot"
                value={shortMoney(m.collected_total)}
                sub="Sum of full + partial payments logged"
              />
              <Stat
                testid="metric-bill-amount"
                label="Snapshot bill amount"
                value={shortMoney(snapshot.total_bill_amt)}
                sub={`Received so far ${shortMoney(snapshot.total_received)}`}
              />
              <Stat
                testid="metric-source"
                label="Source file"
                value={<span className="stat-tiny">{snapshot.source_file}</span>}
                sub={snapshot.report_period || "Immutable snapshot"}
              />
            </div>
          )}

          <div className="dashboard-grid">
            <section className="panel priority" data-testid="top-parties-panel">
              <div className="panel-head">
                <div>
                  <span className="eyebrow">HEAVIEST RECEIVABLES</span>
                  <h3>Top parties by outstanding</h3>
                </div>
                <NavLink data-testid="view-outstanding-link" to="/outstanding" className="text-link">
                  Open workspace <ChevronRight size={13} />
                </NavLink>
              </div>
              {data.top_parties.length ? data.top_parties.map((p) => (
                <NavLink
                  data-testid={`top-party-${p.id}`}
                  className="priority-row"
                  to={`/outstanding?party=${p.id}`}
                  key={p.id}
                >
                  <div className="party-dot">{initials(p.party_name)}</div>
                  <div className="priority-copy">
                    <b>{p.party_name}</b>
                    <small>{p.master} · {p.party_code || "—"} · {p.bill_count} bills</small>
                  </div>
                  <div className="priority-amount">
                    <b>{money(p.total_outstanding)}</b>
                    <small>{p.assigned_officer_name ? `→ ${p.assigned_officer_name}` : "unassigned"}</small>
                  </div>
                </NavLink>
              )) : <Empty text="No parties yet" />}
            </section>

            <section className="panel" data-testid="recent-activity-panel">
              <div className="panel-head">
                <div>
                  <span className="eyebrow">COLLECTION LOG</span>
                  <h3>Latest follow-ups</h3>
                </div>
              </div>
              {data.recent_follow_ups.length ? data.recent_follow_ups.map((f) => (
                <div key={f.id} data-testid={`recent-follow-up-${f.id}`} className="activity-row">
                  <span className={`activity-icon activity-${f.outcome}`}>
                    {f.outcome === "paid_full" && <TrendingUp size={14} />}
                    {f.outcome === "paid_partial" && <Sparkles size={14} />}
                    {f.outcome === "not_paid" && <AlertTriangle size={14} />}
                  </span>
                  <div>
                    <b>{OUTCOME_LABEL[f.outcome]}</b>
                    <small>{f.party_name} · {f.officer_name} · {fmtDate(f.created_at)}</small>
                  </div>
                  {f.amount_received ? <span className="activity-tag">{money(f.amount_received)}</span> : null}
                </div>
              )) : <Empty text="No collection activity yet" />}
            </section>
          </div>

          <div className="lower-grid">
            <section className="panel broken" data-testid="broken-promises-panel">
              <div className="panel-head">
                <div>
                  <span className="eyebrow">PROMISE WATCH</span>
                  <h3>Broken promises</h3>
                </div>
                <span className="alert-count" data-testid="broken-count">{data.broken_promises.length}</span>
              </div>
              {data.broken_promises.length ? data.broken_promises.map((p) => (
                <div className="promise-row" key={p.id} data-testid={`broken-promise-${p.id}`}>
                  <span className="promise-line" />
                  <div>
                    <b>{p.party_name}</b>
                    <small>Promised {money(p.promise_amount || 0)} · due {fmtDate(p.promise_date)}</small>
                  </div>
                  <span className="activity-tag">{p.officer_name}</span>
                </div>
              )) : <Empty text="No broken promises" />}
            </section>

            {!isField && (
              <section className="panel officers" data-testid="officer-performance-panel">
                <div className="panel-head">
                  <div>
                    <span className="eyebrow">FIELD TEAM</span>
                    <h3>Officer workload</h3>
                  </div>
                </div>
                {data.officer_performance.map((o) => (
                  <div key={o.id} className="officer-row" data-testid={`officer-row-${o.id}`}>
                    <div className="party-dot">{initials(o.name)}</div>
                    <div className="priority-copy">
                      <b>{o.name}</b>
                      <small>{o.assigned_parties} parties · {o.follow_ups} follow-ups</small>
                    </div>
                    <div className="priority-amount">
                      <b>{money(o.collected)}</b>
                      <small>collected</small>
                    </div>
                  </div>
                ))}
              </section>
            )}

            {isField && (
              <section className="panel" data-testid="due-today-panel">
                <div className="panel-head">
                  <div>
                    <span className="eyebrow">TODAY’S QUEUE</span>
                    <h3>Follow-ups due today</h3>
                  </div>
                  <NavLink data-testid="open-follow-ups-link" to="/follow-ups" className="text-link">
                    See all <ChevronRight size={13} />
                  </NavLink>
                </div>
                {data.due_today.length ? data.due_today.map((f) => (
                  <div className="promise-row" key={f.id} data-testid={`due-today-${f.id}`}>
                    <span className="promise-line due" />
                    <div>
                      <b>{f.party_name}</b>
                      <small>Last outcome: {OUTCOME_LABEL[f.outcome]} · {f.reason || "—"}</small>
                    </div>
                    <NavLink className="mini-cta" to={`/outstanding?party=${f.party_id}`}>
                      <ListChecks size={14} /> Open
                    </NavLink>
                  </div>
                )) : <Empty text="Nothing due today. Nice." />}
              </section>
            )}
          </div>
        </>
      )}
    </div>
  );
}
