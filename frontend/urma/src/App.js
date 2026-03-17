import { useState, useEffect } from "react";
import "./App.css";

const API = process.env.REACT_APP_BACKEND;
console.log(process.env.REACT_APP_BACKEND)

function timeAgo(ts) {
  if (!ts) return "—";
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function scoreColor(s) {
  if (s == null) return "var(--muted)";
  if (s >= 71) return "var(--high)";
  if (s >= 41) return "var(--medium)";
  return "var(--clean)";
}

function Badge({ level }) {
  if (!level) return <span className="badge badge-null">unscored</span>;
  return <span className={`badge badge-${level}`}>{level}</span>;
}

function ScoreBar({ score }) {
  if (score == null) return <span className="mono muted">—</span>;
  return (
    <div className="score-wrap">
      <div className="score-bar">
        <div className="score-fill" style={{ width: `${score}%`, background: scoreColor(score) }} />
      </div>
      <span className="mono score-num" style={{ color: scoreColor(score) }}>{score}</span>
    </div>
  );
}

function Signals({ signals }) {
  if (!signals) return <span className="muted">—</span>;
  let arr = signals;
  if (typeof signals === "string") {
    try { arr = JSON.parse(signals.replace(/'/g, '"')); } catch { arr = []; }
  }
  if (!arr.length) return <span className="muted">—</span>;
  return (
    <div className="signal-list">
      {arr.map((s) => <span key={s} className="signal mono">{s}</span>)}
    </div>
  );
}

export default function App() {
  const [users, setUsers] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("all");

  const fetchAll = async () => {
    try {
      const [ur, ar] = await Promise.all([
        fetch(`${API}/users`).then((r) => r.json()),
        fetch(`${API}/alerts`).then((r) => r.json()),
      ]);
      setUsers(ur.users || []);
      setAlerts(ar.alerts || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const runScan = async () => {
    setScanning(true);
    try {
      await fetch(`${API}/scan`, { method: "POST" });
      await fetchAll();
    } catch (e) { console.error(e); }
    setScanning(false);
  };

  const filtered =
    tab === "all" ? users
    : tab === "high" ? users.filter((u) => u.risk_level === "high")
    : tab === "medium" ? users.filter((u) => u.risk_level === "medium")
    : users.filter((u) => u.risk_level === "clean" || u.risk_level == null);

  const high = users.filter((u) => u.risk_level === "high").length;
  const medium = users.filter((u) => u.risk_level === "medium").length;
  const clean = users.filter((u) => u.risk_level === "clean").length;

  return (
    <div className="app">
      <header>
        <div className="logo mono"><b>URMA</b> / user risk monitor</div>
        <div className="live mono"><div className="dot" />live</div>
      </header>

      <main>
        <div className="metrics">
          <div className="metric"><div className="metric-label mono">Total users</div><div className="metric-val blue">{users.length}</div></div>
          <div className="metric"><div className="metric-label mono">High risk</div><div className="metric-val red">{high}</div></div>
          <div className="metric"><div className="metric-label mono">Medium risk</div><div className="metric-val amber">{medium}</div></div>
          <div className="metric"><div className="metric-label mono">Clean</div><div className="metric-val green">{clean}</div></div>
        </div>

        <div className="content-row">
          <div className="panel">
            <div className="panel-head">
              <span className="panel-title mono">Users</span>
              <button className="scan-btn mono" onClick={runScan} disabled={scanning}>
                {scanning ? "scanning..." : "run ai scan"}
              </button>
            </div>
            <div className="tab-row">
              {[["all","All"],["high","High"],["medium","Medium"],["clean","Clean"]].map(([v, l]) => (
                <button key={v} className={`tab mono ${tab === v ? "active" : ""}`} onClick={() => setTab(v)}>{l}</button>
              ))}
            </div>
            {loading || scanning ? (
              <div className="state-msg mono"><span className="spinner" />{scanning ? "gemini is analyzing users..." : "loading..."}</div>
            ) : filtered.length === 0 ? (
              <div className="state-msg mono">no users found</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>User</th><th>Score</th><th>Level</th><th>Signals</th><th>Flag reason</th></tr>
                  </thead>
                  <tbody>
                    {filtered.map((u) => (
                      <tr key={u.id}>
                        <td><div className="username">{u.username}</div><div className="mono email">{u.email}</div></td>
                        <td><ScoreBar score={u.risk_score} /></td>
                        <td><Badge level={u.risk_level} /></td>
                        <td><Signals signals={u.signals} /></td>
                        <td><div className="flag-reason">{u.flag_reason || "—"}</div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="panel alerts-panel">
            <div className="panel-head">
              <span className="panel-title mono">Alerts</span>
              <span className="mono muted small">{alerts.length} active</span>
            </div>
            {alerts.length === 0 ? (
              <div className="state-msg mono">no active alerts</div>
            ) : (
              alerts.map((a) => (
                <div key={a.id} className="alert-item">
                  <div className={`alert-dot sev-${a.severity}`} />
                  <div className="alert-body">
                    <div className="alert-title">{a.title}</div>
                    {a.description && <div className="alert-desc">{a.description}</div>}
                  </div>
                  <div className="mono alert-time">{timeAgo(a.created_at)}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}