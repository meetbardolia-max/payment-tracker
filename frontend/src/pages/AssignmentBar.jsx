import { useState } from "react";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { client } from "@/lib/api";

export default function AssignmentBar({ selection, officers, snapshotId, onDone }) {
  const [officerId, setOfficerId] = useState("");
  const [busy, setBusy] = useState(false);

  if (selection.length === 0) return null;

  const submit = async () => {
    if (!officerId) return toast.error("Choose an officer");
    setBusy(true);
    try {
      const r = await client.post("/assignments", {
        snapshot_id: snapshotId,
        party_ids: selection,
        officer_id: officerId,
      });
      toast.success(`Assigned ${r.data.assigned} parties to ${r.data.officer}`);
      onDone();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Assignment failed");
    }
    setBusy(false);
  };

  return (
    <div className="assign-bar" data-testid="assign-bar">
      <span><b>{selection.length}</b> selected</span>
      <select
        data-testid="assign-officer-select"
        value={officerId}
        onChange={(e) => setOfficerId(e.target.value)}
      >
        <option value="">Assign to…</option>
        {officers.map((o) => (
          <option key={o.id} value={o.id}>{o.name}</option>
        ))}
      </select>
      <button
        className="primary-button small"
        onClick={submit}
        disabled={busy}
        data-testid="assign-submit"
      >
        <UserPlus size={14} /> Assign
      </button>
    </div>
  );
}
