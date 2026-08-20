import { useEffect, useState } from "react";
import "@/App.css";
import { BrowserRouter, NavLink, Route, Routes, useNavigate } from "react-router-dom";
import {
  BookOpen, ChevronRight, ClipboardList, FileUp, LayoutDashboard,
  LogOut, Menu, Users, X, ListChecks, History, ShieldCheck,
} from "lucide-react";
import { Toaster } from "sonner";
import { client, ROLE_LABEL, initials } from "@/lib/api";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Outstanding from "@/pages/Outstanding";
import Upload from "@/pages/Upload";
import Snapshots from "@/pages/Snapshots";
import FollowUps from "@/pages/FollowUps";
import Reports from "@/pages/Reports";

function Loading() {
  return (
    <div className="loading" data-testid="loading-state">
      <div className="spinner" />
      Loading your collection desk…
    </div>
  );
}

function Shell({ user, setUser }) {
  const [mobile, setMobile] = useState(false);
  const nav = useNavigate();
  const items = [
    ["/", "Overview", LayoutDashboard, ["owner", "head_officer", "field_officer"]],
    ["/outstanding", "Outstanding", Users, ["owner", "head_officer", "field_officer"]],
    ["/follow-ups", "Follow-ups", ListChecks, ["owner", "head_officer", "field_officer"]],
    ["/upload", "Upload snapshot", FileUp, ["owner", "head_officer"]],
    ["/snapshots", "Snapshots", History, ["owner", "head_officer", "field_officer"]],
    ["/reports", "Reports", ClipboardList, ["owner", "head_officer"]],
  ].filter(([, , , roles]) => roles.includes(user.role));

  const logout = async () => {
    try { await client.post("/auth/logout"); } catch { /* empty */ }
    setUser(null);
    nav("/");
  };

  return (
    <div className="app-shell">
      <aside className={mobile ? "rail open" : "rail"}>
        <div className="rail-brand">
          <span className="brand-stamp">SP</span>
          <div>
            <strong>Collection Desk</strong>
            <small>Sripati Processors</small>
          </div>
          <button data-testid="mobile-nav-close" className="icon-button mobile-only" onClick={() => setMobile(false)}>
            <X size={18} />
          </button>
        </div>
        <nav>
          {items.map(([to, label, Icon]) => (
            <NavLink
              key={to}
              end={to === "/"}
              data-testid={`nav-${label.toLowerCase().replaceAll(" ", "-")}`}
              onClick={() => setMobile(false)}
              className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}
              to={to}
            >
              <Icon size={17} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="rail-footer">
          <div className="secure-note">
            <ShieldCheck size={15} />
            <span>Every action is audit-logged</span>
          </div>
          <button data-testid="logout-button" className="logout" onClick={logout}>
            <LogOut size={15} /> Sign out
          </button>
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <button data-testid="mobile-nav-open" className="icon-button mobile-only" onClick={() => setMobile(true)}>
            <Menu size={20} />
          </button>
          <div className="crumb">
            <BookOpen size={13} />
            <span>Outstanding register</span>
          </div>
          <div className="top-actions">
            <div className="avatar" data-testid="current-user-avatar">{initials(user.name)}</div>
            <div className="user-copy">
              <b data-testid="current-user-name">{user.name}</b>
              <small>{user.demo ? "Demo · " : ""}{ROLE_LABEL[user.role] || user.role}</small>
            </div>
          </div>
        </header>
        <main className="content">
          <Routes>
            <Route path="/" element={<Dashboard user={user} />} />
            <Route path="/outstanding" element={<Outstanding user={user} />} />
            <Route path="/follow-ups" element={<FollowUps user={user} />} />
            <Route path="/upload" element={<Upload user={user} />} />
            <Route path="/snapshots" element={<Snapshots user={user} />} />
            <Route path="/reports" element={<Reports user={user} />} />
            <Route path="*" element={<Dashboard user={user} />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(undefined);
  useEffect(() => {
    client.get("/auth/me").then((r) => setUser(r.data)).catch(() => setUser(null));
  }, []);
  if (user === undefined) return <Loading />;
  return (
    <BrowserRouter>
      {user ? <Shell user={user} setUser={setUser} /> : <Login onLogin={setUser} />}
      <Toaster position="bottom-right" richColors closeButton />
    </BrowserRouter>
  );
}

export default App;
export { Loading };

export function ChevronArrow() {
  return <ChevronRight size={15} />;
}
