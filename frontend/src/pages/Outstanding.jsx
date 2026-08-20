import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Users, Layers, X, Phone, Building2, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { client, money, shortMoney, fmtDate, initials, OUTCOME_LABEL } from "@/lib/api";
import CollectionModal from "@/pages/CollectionModal";
import AssignmentBar from "@/pages/AssignmentBar";

function Empty({ text }) {
  return <div className="empty">{text}</div>;
}

export default function Outstanding({ user }) {
  const [params, setParams] = useSearchParams();
  const [snapshot, setSnapshot] = useState(null);
  const [view, setView] = useState("party"); // party | master
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("outstanding_desc");
  const [rows, setRows] = useState([]);
  const [loadedView, setLoadedView] = useState("party");
  const [loading, setLoading] = useState(true);
  const [activePartyId, setActivePartyId] = useState(params.get("party") || null);
  const [selection, setSelection] = useState([]); // for assignment
  const [officers, setOfficers] = useState([]);

  const canAssign = user.role === "owner" || user.role === "head_officer";

  useEffect(() => {
    client.get("/snapshots/active").then((r) => setSnapshot(r.data)).catch(() => setSnapshot(null));
    if (canAssign) client.get("/officers").then((r) => setOfficers(r.data));
  }, [canAssign]);

  useEffect(() => {
    if (!snapshot) { setRows([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    setRows([]);
    const requestedView = view;
    client
      .get(`/snapshots/${snapshot.id}/parties`, { params: { search, view: requestedView, sort } })
      .then((r) => {
        if (cancelled) return;
        setRows(r.data);
        setLoadedView(requestedView);
      })
      .catch(() => { if (!cancelled) toast.error("Could not load outstanding list"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [snapshot, search, view, sort]);

  const totals = useMemo(() => {
    if (loadedView === "master") {
      return {
        total: rows.reduce((s, g) => s + (g.total_outstanding || 0), 0),
        count: rows.reduce((s, g) => s + (g.party_count || 0), 0),
      };
    }
    return {
      total: rows.reduce((s, p) => s + (p.total_outstanding || 0), 0),
      count: rows.length,
    };
  }, [rows, loadedView]);

  const toggleSel = (id) =>
    setSelection((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const refresh = () => {
    if (snapshot) {
      client.get(`/snapshots/${snapshot.id}/parties`, { params: { search, view, sort } })
        .then((r) => setRows(r.data));
    }
  };

  if (!snapshot) {
    return (
      <div className="page">
        <div className="page-head compact">
          <div>
            <span className="eyebrow">OUTSTANDING WORKSPACE</span>
            <h1>No snapshot active</h1>
            <p className="muted">Ask the head officer to upload the monthly outstanding report.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page" data-testid="outstanding-page">
      <div className="page-head compact">
        <div>
          <span className="eyebrow">SNAPSHOT · {snapshot.period_label}</span>
          <h1>Outstanding workspace</h1>
          <p className="muted">
            {totals.count} {view === "master" ? "masters" : "parties"} · {shortMoney(totals.total)} open
          </p>
        </div>
        <div className="view-toggle" data-testid="view-toggle">
          <button
            data-testid="view-party"
            className={view === "party" ? "active" : ""}
            onClick={() => setView("party")}
          >
            <Users size={14} /> Party-wise
          </button>
          <button
            data-testid="view-master"
            className={view === "master" ? "active" : ""}
            onClick={() => setView("master")}
          >
            <Layers size={14} /> Master-wise
          </button>
        </div>
      </div>

      <div className="toolbar">
        <div className="search-box">
          <Search size={16} />
          <input
            data-testid="outstanding-search-input"
            placeholder={view === "master" ? "Search master / group / party" : "Search party, code, master"}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          data-testid="outstanding-sort-select"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          title="Sort parties"
        >
          <option value="outstanding_desc">Outstanding · high → low</option>
          <option value="outstanding_asc">Outstanding · low → high</option>
          <option value="code_asc">Party code · A → Z</option>
          <option value="code_desc">Party code · Z → A</option>
          <option value="name_asc">Party name · A → Z</option>
          <option value="name_desc">Party name · Z → A</option>
        </select>
        {view === "party" && canAssign && (
          <AssignmentBar
            selection={selection}
            officers={officers}
            snapshotId={snapshot.id}
            onDone={() => { setSelection([]); refresh(); }}
          />
        )}
      </div>

      {loadedView === "party" ? (
        <section className="table-panel" data-testid="party-table">
          <table>
            <thead>
              <tr>
                {canAssign && <th style={{ width: 40 }}></th>}
                <th>Party</th>
                <th>Master / Group</th>
                <th>Bills</th>
                <th>Bill amount</th>
                <th>Received</th>
                <th>Outstanding</th>
                <th>Assigned to</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr
                  key={p.id}
                  data-testid={`party-row-${p.id}`}
                  className={selection.includes(p.id) ? "row-selected" : ""}
                >
                  {canAssign && (
                    <td>
                      <input
                        type="checkbox"
                        data-testid={`party-select-${p.id}`}
                        checked={selection.includes(p.id)}
                        onChange={() => toggleSel(p.id)}
                      />
                    </td>
                  )}
                  <td>
                    <b>{p.party_name}</b>
                    <small>{p.party_code || "—"} · {p.mobile || "no mobile"}</small>
                  </td>
                  <td>
                    <b>{p.master}</b>
                    <small>{p.group}</small>
                  </td>
                  <td className="num">{p.bill_count}</td>
                  <td className="num">{money(p.total_bill_amt)}</td>
                  <td className="num">{money(p.total_received)}</td>
                  <td className="num strong">{money(p.total_outstanding)}</td>
                  <td>
                    {p.assigned_officer_name
                      ? <span className="status status-paidclosed">{p.assigned_officer_name}</span>
                      : <span className="status status-overdue">Unassigned</span>}
                  </td>
                  <td>
                    <button
                      data-testid={`open-party-${p.id}`}
                      className="secondary-button small"
                      onClick={() => { setActivePartyId(p.id); setParams({ party: p.id }); }}
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && !loading && <Empty text="No parties match" />}
        </section>
      ) : (
        <div className="master-grid" data-testid="master-grid">
          {rows.map((g) => (
            <section className="master-card" key={g.master} data-testid={`master-card-${g.master}`}>
              <div className="master-head">
                <div>
                  <span className="eyebrow">MASTER</span>
                  <h3>{g.master}</h3>
                </div>
                <div className="master-amount">
                  <b>{money(g.total_outstanding)}</b>
                  <small>{g.party_count} parties</small>
                </div>
              </div>
              <div className="master-bills">
                {(g.parties || []).map((p) => (
                  <button
                    key={p.id}
                    data-testid={`master-party-${p.id}`}
                    onClick={() => { setActivePartyId(p.id); setParams({ party: p.id }); }}
                    className="master-party"
                  >
                    <div>
                      <b>{p.party_name}</b>
                      <small>{p.party_code || "—"} · {p.bill_count} bills</small>
                    </div>
                    <span className="num">{money(p.total_outstanding)}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
          {!rows.length && !loading && <Empty text="No masters match" />}
        </div>
      )}

      {activePartyId && (
        <PartyDrawer
          user={user}
          partyId={activePartyId}
          onClose={() => { setActivePartyId(null); setParams({}); refresh(); }}
          snapshotId={snapshot.id}
        />
      )}
    </div>
  );
}

function PartyDrawer({ user, partyId, onClose, snapshotId }) {
  const [party, setParty] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    client
      .get(`/parties/${partyId}`)
      .then((r) => setParty(r.data))
      .catch((e) => {
        toast.error(e.response?.data?.detail || "Cannot load party");
        onClose();
      })
      .finally(() => setLoading(false));
  };
  useEffect(load, [partyId]);

  return (
    <div className="drawer-overlay" data-testid="party-drawer" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <button className="drawer-close" onClick={onClose} data-testid="party-drawer-close">
          <X size={18} />
        </button>
        {loading || !party ? <div className="empty">Loading…</div> : (
          <>
            <div className="drawer-head">
              <span className="eyebrow">{party.master} · {party.group}</span>
              <h2 data-testid="party-name">{party.party_name}</h2>
              <p className="muted">
                Code {party.party_code || "—"} · {party.mobile ? <a href={`tel:${party.mobile}`} data-testid="party-call-link"><Phone size={12} /> {party.mobile}</a> : "no mobile"}
              </p>
              {party.address && <p className="muted"><Building2 size={12} /> {party.address}</p>}
              <div className="drawer-stats">
                <div><small>Outstanding</small><b data-testid="party-outstanding">{money(party.total_outstanding)}</b></div>
                <div><small>Bill amount</small><b>{money(party.total_bill_amt)}</b></div>
                <div><small>Received</small><b>{money(party.total_received)}</b></div>
                <div><small>Bills</small><b>{party.bill_count}</b></div>
              </div>
              <button
                data-testid="record-collection-btn"
                className="primary-button full"
                onClick={() => setModalOpen(true)}
              >
                <ClipboardList size={16} /> Record collection outcome
              </button>
            </div>

            <div className="drawer-section">
              <div className="section-head">
                <span className="eyebrow">BILL PERIODS</span>
                <h3>Outstanding by period</h3>
              </div>
              <div className="bills-list">
                {party.bills.map((b, i) => (
                  <div className="bill-row" key={i} data-testid={`bill-row-${i}`}>
                    <div>
                      <b>{b.period_label}</b>
                      <small>{b.display_date} · {b.mtrs} mtrs · rate {b.rate}</small>
                    </div>
                    <div className="bill-nums">
                      <span><small>Bill</small><b className="num">{money(b.bill_amt)}</b></span>
                      <span><small>Rcvd</small><b className="num">{money(b.rcvd_amt)}</b></span>
                      <span><small>O/s</small><b className="num strong">{money(b.bill_os)}</b></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="drawer-section">
              <div className="section-head">
                <span className="eyebrow">TIMELINE</span>
                <h3>Follow-up history</h3>
              </div>
              {party.follow_ups.length ? party.follow_ups.map((f) => (
                <div className="timeline-row" key={f.id} data-testid={`timeline-${f.id}`}>
                  <span className={`timeline-dot outcome-${f.outcome}`} />
                  <div className="timeline-content">
                    <div className="timeline-head">
                      <b>{OUTCOME_LABEL[f.outcome]}</b>
                      <small>{f.officer_name} · {fmtDate(f.created_at)}</small>
                    </div>
                    {(f.amount_received || f.remaining_amount) && (
                      <div className="timeline-numbers">
                        {f.amount_received ? <span>Received {money(f.amount_received)}</span> : null}
                        {f.remaining_amount ? <span>Remaining {money(f.remaining_amount)}</span> : null}
                        {f.promise_amount ? <span>Promise {money(f.promise_amount)}</span> : null}
                      </div>
                    )}
                    {f.reason && <p className="muted">{f.reason}</p>}
                    {f.notes && <p className="notes">&ldquo;{f.notes}&rdquo;</p>}
                    {f.cheque_number && (
                      <p className="muted">Cheque #{f.cheque_number} · {fmtDate(f.cheque_date)}</p>
                    )}
                    {f.cheque_image && (
                      <a
                        href={`${process.env.REACT_APP_BACKEND_URL}${f.cheque_image}`}
                        target="_blank"
                        rel="noreferrer"
                        className="cheque-thumb"
                        data-testid={`cheque-view-${f.id}`}
                      >View cheque image</a>
                    )}
                    {f.next_followup_date && (
                      <p className="muted">Next follow-up: <b>{fmtDate(f.next_followup_date)}</b></p>
                    )}
                    {f.promise_date && (
                      <p className="muted">Promised on: <b>{fmtDate(f.promise_date)}</b></p>
                    )}
                  </div>
                </div>
              )) : <Empty text="No follow-ups recorded yet" />}
            </div>
          </>
        )}

        {modalOpen && (
          <CollectionModal
            party={party}
            snapshotId={snapshotId}
            onClose={() => setModalOpen(false)}
            onSaved={() => { setModalOpen(false); load(); }}
          />
        )}
      </aside>
    </div>
  );
}
