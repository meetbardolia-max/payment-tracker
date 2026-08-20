import { useEffect, useState } from "react";
import { ClipboardList } from "lucide-react";
import { client, money, fmtDate, OUTCOME_LABEL } from "@/lib/api";

function Empty({ text }) { return <div className="empty">{text}</div>; }

export default function Reports() {
  const [data, setData] = useState(null);
  useEffect(() => {
    client.get("/reports").then((r) => setData(r.data));
  }, []);
  if (!data) return <div className="empty">Loading…</div>;

  const csv = () => {
    const rows = [["party", "master", "outcome", "amount_received", "reason", "next_followup", "officer", "created_at"]];
    data.follow_ups.forEach((f) => rows.push([
      f.party_name, f.master, OUTCOME_LABEL[f.outcome] || f.outcome,
      f.amount_received || "", (f.reason || "").replaceAll(",", ";"),
      f.next_followup_date || "", f.officer_name, f.created_at,
    ]));
    const blob = new Blob([rows.map((r) => r.join(",")).join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `follow-ups-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="page" data-testid="reports-page">
      <div className="page-head compact">
        <div>
          <span className="eyebrow">CONTROL ROOM</span>
          <h1>Reports & audit</h1>
          <p className="muted">Snapshot history, collection activity and system audit in one view.</p>
        </div>
        <button className="secondary-button" onClick={csv} data-testid="export-csv">
          <ClipboardList size={15} /> Export follow-ups CSV
        </button>
      </div>

      <div className="report-grid">
        <section className="panel report-card">
          <span className="eyebrow">SNAPSHOTS</span>
          <h3>Recent uploads</h3>
          {data.snapshots.length ? data.snapshots.slice(0, 8).map((s) => (
            <div key={s.id} className="report-line" data-testid={`report-snapshot-${s.id}`}>
              <span>
                {s.period_label}
                <small>{fmtDate(s.uploaded_at)} · {s.uploaded_by_name}</small>
              </span>
              <b>{money(s.total_outstanding)}</b>
            </div>
          )) : <Empty text="No snapshots yet" />}
        </section>

        <section className="panel report-card">
          <span className="eyebrow">FOLLOW-UPS</span>
          <h3>Latest collection activity</h3>
          {data.follow_ups.length ? data.follow_ups.slice(0, 8).map((f) => (
            <div key={f.id} className="report-line">
              <span>
                {f.party_name}
                <small>{OUTCOME_LABEL[f.outcome]} · {f.officer_name}</small>
              </span>
              <b>{f.amount_received ? money(f.amount_received) : "—"}</b>
            </div>
          )) : <Empty text="No activity" />}
        </section>

        <section className="panel report-card wide">
          <span className="eyebrow">AUDIT TRAIL</span>
          <h3>System log</h3>
          {data.audit.slice(0, 20).map((a) => (
            <div key={a.id} className="report-line">
              <span>
                {a.action}
                <small>{a.user_name || a.user_id} · {fmtDate(a.created_at)}</small>
              </span>
              <b>{a.party_name || a.snapshot_id || a.officer_name || ""}</b>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
