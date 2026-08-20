import { useState } from "react";
import { FileUp, ShieldCheck, ChevronRight, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { client, money, shortMoney } from "@/lib/api";

function Empty({ text }) {
  return <div className="empty">{text}</div>;
}

export default function Upload({ user }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [periodLabel, setPeriodLabel] = useState("");

  const upload = async () => {
    if (!file) return toast.error("Choose the outstanding .xlsx report first");
    setBusy(true);
    setPreview(null);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const r = await client.post("/outstanding/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setPreview(r.data);
      if (!periodLabel) setPeriodLabel(r.data.report_period || `As of ${new Date().toLocaleDateString("en-GB")}`);
      toast.success(`Parsed ${r.data.party_count} parties`);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Could not parse the workbook");
    }
    setBusy(false);
  };

  const commit = async () => {
    if (!preview) return;
    setBusy(true);
    try {
      const r = await client.post("/outstanding/commit", {
        parties: preview.parties,
        period_label: periodLabel,
        report_period: preview.report_period,
        source_file: preview.source_file,
        total_outstanding: preview.total_outstanding,
        total_bill_amt: preview.total_bill_amt,
        total_received: preview.total_received,
      });
      toast.success(`Snapshot ${r.data.period_label} activated`);
      setPreview(null);
      setFile(null);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Commit failed");
    }
    setBusy(false);
  };

  return (
    <div className="page" data-testid="upload-page">
      <div className="page-head compact">
        <div>
          <span className="eyebrow">SNAPSHOT INTAKE</span>
          <h1>Upload monthly outstanding</h1>
          <p className="muted">Each upload becomes an immutable snapshot. Follow-ups continue against the newest active one.</p>
        </div>
      </div>

      <section className="import-layout">
        <div className="upload-panel">
          <div className="upload-icon"><FileUp size={22} /></div>
          <h3>Upload the workbook</h3>
          <p className="muted">.xlsx · Masterwise Groupwise Partywise Outstanding</p>
          <input
            data-testid="upload-file-input"
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => { setFile(e.target.files[0]); setPreview(null); }}
          />
          <div className="selected-file">{file ? file.name : "No file selected"}</div>
          <button
            data-testid="parse-button"
            className="primary-button full"
            onClick={upload}
            disabled={busy}
          >
            {busy && !preview ? "Parsing…" : "Parse for review"} <ChevronRight size={15} />
          </button>
          <label className="field" style={{ marginTop: 24 }}>
            <span>Snapshot label</span>
            <input
              data-testid="period-label-input"
              value={periodLabel}
              onChange={(e) => setPeriodLabel(e.target.value)}
              placeholder="e.g. Outstanding as of 31 Jul 2026"
            />
          </label>
          <div className="source-note"><ShieldCheck size={13} /> Source filename and timestamp are preserved.</div>
        </div>

        {preview ? (
          <section className="review-panel" data-testid="review-panel">
            <div className="review-head">
              <div>
                <span className="eyebrow">REVIEW</span>
                <h3>Parsed {preview.party_count} parties</h3>
                <small className="muted">{preview.source_file} · {preview.report_period}</small>
              </div>
              <div className="review-summary">
                <span><b>{preview.party_count}</b>parties</span>
                <span><b>{shortMoney(preview.total_outstanding)}</b>outstanding</span>
                <span><b>{shortMoney(preview.total_bill_amt)}</b>bill amt</span>
                <span><b>{shortMoney(preview.total_received)}</b>received</span>
              </div>
            </div>

            {preview.duplicate_warning && (
              <div className="warn-banner" data-testid="dup-warning">
                <AlertTriangle size={14} /> This file name was uploaded before. Committing will activate a new snapshot and keep older ones for history.
              </div>
            )}

            <div className="review-table">
              <table>
                <thead>
                  <tr>
                    <th>Party</th>
                    <th>Master / Group</th>
                    <th>Bills</th>
                    <th>Bill amt</th>
                    <th>Received</th>
                    <th>Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.parties.slice(0, 40).map((p) => (
                    <tr key={p.id} data-testid={`preview-row-${p.id}`}>
                      <td>
                        <b>{p.party_name}</b>
                        <small>{p.party_code || "—"}</small>
                      </td>
                      <td>
                        <b>{p.master}</b>
                        <small>{p.group}</small>
                      </td>
                      <td className="num">{p.bill_count}</td>
                      <td className="num">{money(p.total_bill_amt)}</td>
                      <td className="num">{money(p.total_received)}</td>
                      <td className="num strong">{money(p.total_outstanding)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.parties.length > 40 && (
                <div className="empty">…and {preview.parties.length - 40} more parties in the file.</div>
              )}
            </div>

            <div className="review-actions">
              <span className="muted">Historical snapshots stay searchable after commit.</span>
              <button className="primary-button" onClick={commit} disabled={busy} data-testid="commit-button">
                {busy ? "Committing…" : "Commit snapshot"} <ChevronRight size={15} />
              </button>
            </div>
          </section>
        ) : (
          <div className="empty-import">
            <FileUp size={30} />
            <h3>Upload to see the review</h3>
            <p>Party count, bill totals and outstanding will be summarised before you commit.</p>
          </div>
        )}
      </section>
    </div>
  );
}
