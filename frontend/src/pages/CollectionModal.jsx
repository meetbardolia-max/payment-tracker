import { useEffect, useState } from "react";
import { X, Upload, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { client, money } from "@/lib/api";

const OUTCOMES = [
  { key: "paid_full", label: "Paid in full" },
  { key: "paid_partial", label: "Paid partial" },
  { key: "not_paid", label: "Not paid" },
];

const METHODS = ["Cash", "Cheque", "Bank transfer", "UPI", "RTGS / NEFT"];

function todayPlus(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function CollectionModal({ party, snapshotId, onClose, onSaved }) {
  const [outcome, setOutcome] = useState("paid_full");
  const [reasons, setReasons] = useState([]);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    amount_received: "",
    remaining_amount: party?.total_outstanding || 0,
    reason: "",
    reason_other: "",
    notes: "",
    next_followup_date: "",
    payment_method: "Cheque",
    cheque_number: "",
    cheque_date: "",
    cheque_image: "",
    promise_date: "",
    promise_amount: "",
  });
  const [chequePreview, setChequePreview] = useState("");

  useEffect(() => {
    client.get("/reasons").then((r) => setReasons(r.data));
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const uploadCheque = async (file) => {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      const r = await client.post("/follow-ups/cheque", fd, { headers: { "Content-Type": "multipart/form-data" } });
      set("cheque_image", r.data.url);
      setChequePreview(`${process.env.REACT_APP_BACKEND_URL}${r.data.url}`);
      toast.success("Cheque image uploaded");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Cheque upload failed");
    }
  };

  const submit = async () => {
    // Validate
    if (outcome === "paid_full" && !form.amount_received) {
      return toast.error("Enter the amount received");
    }
    if (outcome === "paid_partial" && !form.amount_received) {
      return toast.error("Enter partial amount received");
    }
    if (outcome === "not_paid" && !form.reason && !form.reason_other) {
      return toast.error("Pick or type a reason");
    }
    if (outcome === "paid_partial" && !form.next_followup_date) {
      return toast.error("Set the next follow-up date");
    }

    setBusy(true);
    const payload = {
      snapshot_id: snapshotId,
      party_id: party.id,
      outcome,
      amount_received: Number(form.amount_received) || null,
      remaining_amount:
        outcome === "paid_partial"
          ? Math.max(0, (party.total_outstanding || 0) - (Number(form.amount_received) || 0))
          : outcome === "paid_full" ? 0 : party.total_outstanding,
      reason: form.reason,
      reason_other: form.reason === "Other" ? form.reason_other : "",
      notes: form.notes,
      next_followup_date: form.next_followup_date || null,
      payment_method: outcome === "not_paid" ? null : form.payment_method,
      cheque_number: form.cheque_number || null,
      cheque_date: form.cheque_date || null,
      cheque_image: form.cheque_image || null,
      promise_date: form.promise_date || null,
      promise_amount: form.promise_amount ? Number(form.promise_amount) : null,
    };
    try {
      await client.post("/follow-ups", payload);
      toast.success("Follow-up saved");
      onSaved();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Could not save follow-up");
    } finally {
      setBusy(false);
    }
  };

  const isCheque = form.payment_method === "Cheque";

  return (
    <div className="modal-overlay" onClick={onClose} data-testid="collection-modal">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} data-testid="modal-close">
          <X size={16} />
        </button>
        <span className="eyebrow">RECORD COLLECTION · {party?.party_name}</span>
        <h2>Outstanding {money(party?.total_outstanding || 0)}</h2>

        <div className="outcome-tabs" data-testid="outcome-tabs">
          {OUTCOMES.map((o) => (
            <button
              key={o.key}
              data-testid={`outcome-${o.key}`}
              className={outcome === o.key ? "active" : ""}
              onClick={() => setOutcome(o.key)}
            >
              {o.label}
            </button>
          ))}
        </div>

        <div className="form-grid">
          {(outcome === "paid_full" || outcome === "paid_partial") && (
            <>
              <label className="field">
                <span>Amount received (₹)</span>
                <input
                  data-testid="amount-received-input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount_received}
                  onChange={(e) => set("amount_received", e.target.value)}
                />
              </label>
              <label className="field">
                <span>Payment method</span>
                <select
                  data-testid="method-select"
                  value={form.payment_method}
                  onChange={(e) => set("payment_method", e.target.value)}
                >
                  {METHODS.map((m) => <option key={m}>{m}</option>)}
                </select>
              </label>
              {isCheque && (
                <>
                  <label className="field">
                    <span>Cheque number</span>
                    <input
                      data-testid="cheque-number-input"
                      value={form.cheque_number}
                      onChange={(e) => set("cheque_number", e.target.value)}
                    />
                  </label>
                  <label className="field">
                    <span>Cheque date</span>
                    <input
                      data-testid="cheque-date-input"
                      type="date"
                      value={form.cheque_date}
                      onChange={(e) => set("cheque_date", e.target.value)}
                    />
                  </label>
                  <label className="field full">
                    <span>Cheque image</span>
                    <div className="cheque-upload">
                      <input
                        data-testid="cheque-file-input"
                        type="file"
                        accept="image/*"
                        onChange={(e) => uploadCheque(e.target.files[0])}
                      />
                      {chequePreview
                        ? <img src={chequePreview} alt="cheque" className="cheque-preview" />
                        : <span className="cheque-empty"><Upload size={14} /> No image yet</span>}
                    </div>
                  </label>
                </>
              )}
            </>
          )}

          {outcome === "paid_partial" && (
            <>
              <label className="field">
                <span>Remaining outstanding (₹)</span>
                <input
                  data-testid="remaining-amount-display"
                  type="text"
                  readOnly
                  value={Math.max(0, (party?.total_outstanding || 0) - (Number(form.amount_received) || 0)).toFixed(2)}
                />
              </label>
              <label className="field">
                <span>Reason for balance</span>
                <select
                  data-testid="reason-select-partial"
                  value={form.reason}
                  onChange={(e) => set("reason", e.target.value)}
                >
                  <option value="">Select reason…</option>
                  {reasons.map((r) => <option key={r}>{r}</option>)}
                </select>
              </label>
            </>
          )}

          {outcome === "not_paid" && (
            <>
              <label className="field full">
                <span>Reason (preloaded)</span>
                <select
                  data-testid="reason-select"
                  value={form.reason}
                  onChange={(e) => set("reason", e.target.value)}
                >
                  <option value="">Select reason…</option>
                  {reasons.map((r) => <option key={r}>{r}</option>)}
                </select>
              </label>
              {form.reason === "Other" && (
                <label className="field full">
                  <span>Type the reason</span>
                  <input
                    data-testid="reason-other-input"
                    value={form.reason_other}
                    onChange={(e) => set("reason_other", e.target.value)}
                    placeholder="e.g. wants to visit mill first"
                  />
                </label>
              )}
              <label className="field">
                <span>Promise-to-pay date (optional)</span>
                <input
                  data-testid="promise-date-input"
                  type="date"
                  value={form.promise_date}
                  onChange={(e) => set("promise_date", e.target.value)}
                />
              </label>
              <label className="field">
                <span>Promise amount (₹)</span>
                <input
                  data-testid="promise-amount-input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.promise_amount}
                  onChange={(e) => set("promise_amount", e.target.value)}
                />
              </label>
            </>
          )}

          {(outcome === "paid_partial" || outcome === "not_paid") && (
            <label className="field">
              <span>Next follow-up date</span>
              <div className="date-pick">
                <input
                  data-testid="next-followup-date"
                  type="date"
                  value={form.next_followup_date}
                  onChange={(e) => set("next_followup_date", e.target.value)}
                />
                <div className="date-chips">
                  {[3, 7, 15].map((d) => (
                    <button
                      key={d}
                      type="button"
                      data-testid={`remind-in-${d}`}
                      onClick={() => set("next_followup_date", todayPlus(d))}
                    >
                      +{d}d
                    </button>
                  ))}
                </div>
              </div>
            </label>
          )}

          <label className="field full">
            <span>Notes</span>
            <textarea
              data-testid="notes-input"
              value={form.notes}
              rows={3}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Anything else the next officer should know"
            />
          </label>
        </div>

        <div className="modal-actions">
          <button className="secondary-button" onClick={onClose} data-testid="modal-cancel">Cancel</button>
          <button className="primary-button" onClick={submit} disabled={busy} data-testid="modal-submit">
            {busy ? "Saving…" : "Save follow-up"} <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
