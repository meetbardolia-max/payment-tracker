import { useState } from "react";
import { ChevronRight, BookOpen } from "lucide-react";
import { client } from "@/lib/api";

const demos = [
  ["owner@sripati.local", "Owner"],
  ["head@sripati.local", "Head officer"],
  ["field1@sripati.local", "Field officer"],
];

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("owner@sripati.local");
  const [password, setPassword] = useState("Sripati@123");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await client.post("/auth/login", { email, password });
      onLogin(r.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to sign in");
    }
    setBusy(false);
  };

  return (
    <main className="login-page">
      <div className="login-aside">
        <span className="eyebrow" style={{ color: "#e0d7c4" }}>SRIPATI PROCESSORS</span>
        <h1>The outstanding register, now with a follow-up trail.</h1>
        <p>
          Import the monthly outstanding sheet, work Party-wise and Master-wise,
          and keep every collection promise on record.
        </p>
        <div className="register-mark">
          <BookOpen size={20} />
          <span>Masterwise Groupwise Partywise Outstanding Report</span>
        </div>
      </div>

      <form className="login-form" onSubmit={submit}>
        <div className="brand-lockup">
          <span className="brand-stamp">SP</span>
          <div>
            <strong>Collection Desk</strong>
            <small>Mill receivables</small>
          </div>
        </div>
        <h2>Welcome back</h2>
        <p className="muted">Sign in to continue to your collection workspace.</p>

        <label>Email
          <input
            data-testid="login-email-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            autoComplete="username"
            required
          />
        </label>
        <label>Password
          <input
            data-testid="login-password-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="current-password"
            required
          />
        </label>

        {error && <div data-testid="login-error" className="error">{error}</div>}

        <button data-testid="login-submit-button" className="primary-button" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"} <ChevronRight size={16} />
        </button>

        <div className="demo-picks" data-testid="demo-picker">
          <small className="demo-note">Demo access · password Sripati@123</small>
          <div className="demo-buttons">
            {demos.map(([e, label]) => (
              <button
                key={e}
                type="button"
                data-testid={`demo-${label.toLowerCase().replaceAll(" ", "-")}`}
                className="demo-chip"
                onClick={() => { setEmail(e); setPassword("Sripati@123"); }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </form>
    </main>
  );
}
