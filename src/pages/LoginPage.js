import { useState } from "react";
import { auth, db } from "../firebase/config";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { SeenKaLogo, GradientButton, SEENKA } from "../components/SeenKaTheme";

export default function LoginPage({ dark, setDark, qrSessionId }) {
  const [mode, setMode] = useState("login");
  const [role, setRole] = useState("teacher");
  const [form, setForm] = useState({ email: "", password: "", name: "", studentId: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const inputStyle = {
    width: "100%", padding: "12px 16px", borderRadius: 12,
    border: "1.5px solid #1e2d45", background: "rgba(255,255,255,0.04)",
    color: SEENKA.textPrimary, fontSize: 14, outline: "none",
    boxSizing: "border-box", fontFamily: "system-ui",
    transition: "border-color 0.2s",
  };

  const handleSubmit = async () => {
    setError(""); setLoading(true);
    try {
      if (mode === "login") {
        await signInWithEmailAndPassword(auth, form.email, form.password);
      } else {
        const cred = await createUserWithEmailAndPassword(auth, form.email, form.password);
        await setDoc(doc(db, "users", cred.user.uid), {
          name: form.name, email: form.email, role,
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
    <div style={{
      minHeight: "100vh", background: SEENKA.darkNav,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20, fontFamily: "system-ui, sans-serif", position: "relative", overflow: "hidden"
    }}>
      {/* Background glow orbs */}
      <div style={{ position: "absolute", top: "-20%", left: "-10%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(0,163,255,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "-20%", right: "-10%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(168,85,247,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />

      <div style={{
        background: "rgba(17,24,39,0.9)", backdropFilter: "blur(20px)",
        borderRadius: 24, padding: "2.5rem",
        width: "100%", maxWidth: 440,
        border: "1px solid #1e2d45",
        boxShadow: "0 0 60px rgba(0,163,255,0.08), 0 24px 64px rgba(0,0,0,0.5)",
        position: "relative", zIndex: 1
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
            <div style={{
              width: 72, height: 72, borderRadius: 20,
              background: "linear-gradient(135deg, rgba(0,163,255,0.15), rgba(168,85,247,0.15))",
              border: "1px solid rgba(0,163,255,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 0 30px rgba(0,163,255,0.2)"
            }}>
              <SeenKaLogo size={44} />
            </div>
          </div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, background: SEENKA.gradientPrimary, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>SeenKa</h1>
          <p style={{ margin: "4px 0 0", color: SEENKA.textMuted, fontSize: 14 }}>Be Seen. Be Counted.</p>
        </div>

        {/* Mode toggle */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 4, border: "1px solid #1e2d45" }}>
          {["login", "register"].map(m => (
            <button key={m} onClick={() => setMode(m)} style={{
              flex: 1, padding: "9px", borderRadius: 9, border: "none",
              background: mode === m ? SEENKA.gradientPrimary : "none",
              color: mode === m ? "#fff" : SEENKA.textMuted,
              fontWeight: 700, cursor: "pointer", fontSize: 13,
              boxShadow: mode === m ? SEENKA.shadowButton : "none",
              transition: "all 0.2s"
            }}>
              {m === "login" ? "Sign In" : "Register"}
            </button>
          ))}
        </div>

        {/* Role selector */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {[["teacher", "👩‍🏫", "Teacher"], ["student", "🎒", "Student"]].map(([r, icon, label]) => (
            <button key={r} onClick={() => setRole(r)} style={{
              flex: 1, padding: "10px", borderRadius: 12,
              border: `1.5px solid ${role === r ? SEENKA.electricBlue : "#1e2d45"}`,
              background: role === r ? "rgba(0,163,255,0.1)" : "rgba(255,255,255,0.02)",
              color: role === r ? SEENKA.electricBlue : SEENKA.textMuted,
              fontWeight: 700, cursor: "pointer", fontSize: 13,
              boxShadow: role === r ? "0 0 16px rgba(0,163,255,0.15)" : "none",
              transition: "all 0.2s"
            }}>
              {icon} {label}
            </button>
          ))}
        </div>

        {/* Form fields */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {mode === "register" && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: SEENKA.textMuted, display: "block", marginBottom: 6 }}>Full Name</label>
              <input style={inputStyle} placeholder="e.g. Maria Santos" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} onFocus={e => e.target.style.borderColor = SEENKA.electricBlue} onBlur={e => e.target.style.borderColor = "#1e2d45"} />
            </div>
          )}
          {mode === "register" && role === "student" && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: SEENKA.textMuted, display: "block", marginBottom: 6 }}>Student ID</label>
              <input style={inputStyle} placeholder="e.g. 2024-001" value={form.studentId} onChange={e => setForm(f => ({ ...f, studentId: e.target.value }))} onFocus={e => e.target.style.borderColor = SEENKA.electricBlue} onBlur={e => e.target.style.borderColor = "#1e2d45"} />
            </div>
          )}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: SEENKA.textMuted, display: "block", marginBottom: 6 }}>Email Address</label>
            <input style={inputStyle} type="email" placeholder="you@college.edu" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} onFocus={e => e.target.style.borderColor = SEENKA.electricBlue} onBlur={e => e.target.style.borderColor = "#1e2d45"} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: SEENKA.textMuted, display: "block", marginBottom: 6 }}>Password</label>
            <input style={inputStyle} type="password" placeholder="minimum 6 characters" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} onKeyDown={e => e.key === "Enter" && handleSubmit()} onFocus={e => e.target.style.borderColor = SEENKA.electricBlue} onBlur={e => e.target.style.borderColor = "#1e2d45"} />
          </div>
        </div>

        {error && (
          <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 10, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#EF4444", fontSize: 13, fontWeight: 500 }}>
            ❌ {error}
          </div>
        )}

        <GradientButton onClick={handleSubmit} disabled={loading} style={{ width: "100%", padding: "13px", fontSize: 15, borderRadius: 12, marginTop: 18 }}>
          {loading ? "⏳ Please wait..." : mode === "login" ? "Sign In →" : "Create Account →"}
        </GradientButton>

        <div style={{ marginTop: 16, padding: "12px 14px", background: "rgba(0,163,255,0.05)", borderRadius: 10, border: "1px solid rgba(0,163,255,0.15)", fontSize: 12, color: SEENKA.textMuted, lineHeight: 1.7 }}>
          <span style={{ color: SEENKA.electricBlue, fontWeight: 700 }}>First time?</span> Click Register to create your account. Teachers register first, then add students from the dashboard.
        </div>

        <div style={{ textAlign: "right", marginTop: 12 }}>
          <button onClick={() => setDark(!dark)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, opacity: 0.6 }}>{dark ? "☀️" : "🌙"}</button>
        </div>
      </div>
    </div>
  );
}
