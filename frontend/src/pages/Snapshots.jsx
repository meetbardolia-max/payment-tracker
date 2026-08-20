import { useEffect, useState } from "react";
import { History, ChevronRight } from "lucide-react";
import { client, money, fmtDate } from "@/lib/api";

export default function Snapshots({ user }) {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    client.get("/snapshots").then((r) => setRows(r.data));
  }, []);

  return (
    <div className="page" data-testid="snapshots-page">
      <div className="page-head compact">
        <div>
          <span className="eyebrow">HISTORY</span>
          <h1>Outstanding snapshots</h1>
          <p className="muted">Every upload is preserved so ageing and history remain visible.</p>
        </div>
      </div>

      <section className="table-panel">
        <table>
          <thead>
            <tr>
              <th>Snapshot</th>
              <th>Source file</th>
              <th>Uploaded</th>
              <th>Parties</th>
              <th>Outstanding</th>
              <th>Received</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} data-testid={`snapshot-row-${s.id}`}>
                <td>
                  <b>{s.period_label}</b>
                  <small>{s.active ? <span className="status status-paidclosed">Active</span> : "Archived"}</small>
                </td>
                <td>{s.source_file}</td>
                <td>
                  <b>{fmtDate(s.uploaded_at)}</b>
                  <small>by {s.uploaded_by_name}</small>
                </td>
                <td className="num">{s.party_count}</td>
                <td className="num strong">{money(s.total_outstanding)}</td>
                <td className="num">{money(s.total_received)}</td>
                <td></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <div className="empty">No snapshots yet</div>}
      </section>
    </div>
  );
}
