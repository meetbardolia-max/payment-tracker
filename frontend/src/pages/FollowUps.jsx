import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Filter } from "lucide-react";
import { client, money, fmtDate, OUTCOME_LABEL } from "@/lib/api";

export default function FollowUps({ user }) {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [outcome, setOutcome] = useState("");
  const nav = useNavigate();

  useEffect(() => {
    client.get("/follow-ups").then((r) => setRows(r.data));
  }, []);

  const filtered = useMemo(() => {
    const ql = q.toLowerCase();
    return rows.filter((r) =>
      (!outcome || r.outcome === outcome) &&
      (!ql
        || (r.party_name || "").toLowerCase().includes(ql)
        || (r.officer_name || "").toLowerCase().includes(ql)
        || (r.reason || "").toLowerCase().includes(ql)));
  }, [rows, q, outcome]);

  return (
    <div className="page" data-testid="follow-ups-page">
      <div className="page-head compact">
        <div>
          <span className="eyebrow">COLLECTION TIMELINE</span>
          <h1>Follow-ups</h1>
          <p className="muted">Every call, visit, payment and promise across the collection team.</p>
        </div>
      </div>

      <div className="toolbar">
        <div className="search-box">
          <Search size={15} />
          <input
            data-testid="follow-ups-search"
            placeholder="Search party, officer or reason"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select data-testid="follow-ups-filter" value={outcome} onChange={(e) => setOutcome(e.target.value)}>
          <option value="">All outcomes</option>
          <option value="paid_full">Paid in full</option>
          <option value="paid_partial">Paid partial</option>
          <option value="not_paid">Not paid</option>
        </select>
      </div>

      <section className="table-panel">
        <table>
          <thead>
            <tr>
              <th>Party</th>
              <th>Outcome</th>
              <th>Received</th>
              <th>Reason / Notes</th>
              <th>Next follow-up</th>
              <th>Officer</th>
              <th>Logged</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((f) => (
              <tr key={f.id} data-testid={`follow-up-row-${f.id}`}>
                <td>
                  <b>{f.party_name}</b>
                  <small>{f.master}</small>
                </td>
                <td>
                  <span className={`status outcome-badge outcome-${f.outcome}`}>
                    {OUTCOME_LABEL[f.outcome]}
                  </span>
                </td>
                <td className="num">{f.amount_received ? money(f.amount_received) : "—"}</td>
                <td>
                  <b style={{ fontWeight: 500 }}>{f.reason || "—"}</b>
                  {f.notes && <small>{f.notes}</small>}
                </td>
                <td>{fmtDate(f.next_followup_date)}</td>
                <td>{f.officer_name}</td>
                <td>{fmtDate(f.created_at)}</td>
                <td>
                  <button
                    className="secondary-button small"
                    data-testid={`follow-up-open-${f.id}`}
                    onClick={() => nav(`/outstanding?party=${f.party_id}`)}
                  >
                    Open
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length && <div className="empty">No follow-ups yet</div>}
      </section>
    </div>
  );
}
