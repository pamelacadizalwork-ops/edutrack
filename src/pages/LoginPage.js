import { useState } from "react";
import { auth, db } from "../firebase/config";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";

export default function LoginPage({ dark, setDark }) {
  const [mode, setMode] = useState("login");
  const [role, setRole] = useState("teacher");
  const [form, setForm] = useState({ email: "", password: "", name: "", studentId: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const bg = dark ? "#0f172a" : "#f0f4ff";
  const surface = dark ? "#1e293b" : "#ffffff";
  const border = dark ? "#334155" : "#e2e8f0";
  const text = dark ? "#f1f5f9" : "#0f172a";
  const textMuted = dark ? "#94a3b8" : "#64748b";
  const accent = "#4f46e5";

  const inputStyle = {
    width: "100%", padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${border}`,
    background: dark ? "#0f172a" : "#f8fafc", color: text, fontSize: 14, outline: "none",
    boxSizing: "border-box", fontFamily: "system-ui"
  };

  const handleSubmit = async () => {
    setError("");
    setLoading(true);
    try {
      if (mode === "login") {
        await signInWithEmailAndPassword(auth, form.email, form.password);
      } else {
        const cred = await createUserWithEmailAndPassword(auth, form.email, form.password);
        await setDoc(doc(db, "users", cred.user.uid), {
          name: form.name,
          email: form.email,
          role: role,
          studentId: role === "student" ? form.studentId : null,
          createdAt: new Date().toISOString()
        });
      }
    } catch (err) {
      setError(err.message.replace("Firebase: ", "").replace(/\(auth.*\)\.?/, ""));
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ background: surface, borderRadius: 24, padding: "2.5rem", width: "100%", maxWidth: 440, border: `1px solid ${border}`, boxShadow: "0 20px 60px rgba(79,70,229,0.12)" }}>
        
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{ width: 64, height: 64, background: accent, borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem", fontSize: 30 }}>🎓</div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: accent }}>Ms. Cadizal's Class</h1>
          <p style={{ margin: "4px 0 0", color: textMuted, fontSize: 14 }}>Attendance Management System</p>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 20, background: dark ? "#0f172a" : "#f1f5f9", borderRadius: 12, padding: 4 }}>
          {["login", "register"].map(m => (
            <button key={m} onClick={() => setMode(m)} style={{ flex: 1, padding: "8px", borderRadius: 9, border: "none", background: mode === m ? accent : "none", color: mode === m ? "#fff" : textMuted, fontWeight: 700, cursor: "pointer", fontSize: 13, textTransform: "capitalize" }}>
              {m === "login" ? "Sign In" : "Register"}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {["teacher", "student"].map(r => (
            <button key={r} onClick={() => setRole(r)} style={{ flex: 1, padding: "9px", borderRadius: 10, border: `2px solid ${role === r ? accent : border}`, background: role === r ? "#ede9fe" : "none", color: role === r ? accent : textMuted, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
              {r === "teacher" ? "👩‍🏫 Teacher" : "🎒 Student"}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {mode === "register" && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: textMuted, display: "block", marginBottom: 5 }}>Full Name</label>
              <input style={inputStyle} placeholder="e.g. Maria Santos" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
          )}
          {mode === "register" && role === "student" && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: textMuted, display: "block", marginBottom: 5 }}>Student ID</label>
              <input style={inputStyle} placeholder="e.g. 2024-001" value={form.studentId} onChange={e => setForm(f => ({ ...f, studentId: e.target.value }))} />
            </div>
          )}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: textMuted, display: "block", marginBottom: 5 }}>Email Address</label>
            <input style={inputStyle} type="email" placeholder="you@college.edu" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: textMuted, display: "block", marginBottom: 5 }}>Password</label>
            <input style={inputStyle} type="password" placeholder="minimum 6 characters" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} onKeyDown={e => e.key === "Enter" && handleSubmit()} />
          </div>
        </div>

        {error && (
          <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 10, background: "#fee2e2", color: "#991b1b", fontSize: 13, fontWeight: 500 }}>
            ❌ {error}
          </div>
        )}

        <button onClick={handleSubmit} disabled={loading} style={{ width: "100%", padding: "13px", borderRadius: 12, border: "none", background: loading ? "#a5b4fc" : accent, color: "#fff", fontWeight: 700, fontSize: 15, cursor: loading ? "not-allowed" : "pointer", marginTop: 16, transition: "all 0.2s" }}>
          {loading ? "Please wait..." : mode === "login" ? "Sign In →" : "Create Account →"}
        </button>

        <div style={{ marginTop: 16, padding: "12px 14px", background: dark ? "#0f172a" : "#f0f4ff", borderRadius: 10, fontSize: 12, color: textMuted, lineHeight: 1.6 }}>
          <strong style={{ color: accent }}>First time?</strong> Click Register to create your account. Teachers register first, then add students from the dashboard.
        </div>

        <div style={{ textAlign: "right", marginTop: 12 }}>
          <button onClick={() => setDark(!dark)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20 }}>{dark ? "☀️" : "🌙"}</button>
        </div>
      </div>
    </div>
  );
}
