import { useState } from "react";
import { auth, db } from "../firebase/config";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, collection, query, where, getDocs } from "firebase/firestore";
import { SeenKaLogo, GradientButton, SEENKA } from "../components/SeenKaTheme";
import { ProtectedInput } from "../components/ProtectedInput";
import { validateForm, checkRateLimit, logSuspiciousActivity } from "../utils/protection";
import { normalizeJoinCode, formatJoinCode } from "../utils/joinCode";
import { encryptStudent } from "../utils/encryption";

export default function LoginPage({ dark, setDark, qrSessionId }) {
  const [mode, setMode] = useState("login");
  const [role, setRole] = useState("teacher");
  const [form, setForm] = useState({ email: "", password: "", name: "", studentId: "", joinCode: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [joinCodeStatus, setJoinCodeStatus] = useState(null); // null | "checking" | "found" | "notfound"
  const [foundClass, setFoundClass] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  const inputStyle = {
    width: "100%", padding: "12px 16px", borderRadius: 12,
    border: "1.5px solid #1e2d45", background: "rgba(255,255,255,0.04)",
    color: SEENKA.textPrimary, fontSize: 14, outline: "none",
    boxSizing: "border-box", fontFamily: "system-ui", transition: "border-color 0.2s",
  };

  // Live join code lookup as student types
  const handleJoinCodeChange = async (val) => {
    // Strip dashes, spaces, uppercase
    const cleaned = normalizeJoinCode(val);
    setForm(f => ({ ...f, joinCode: val }));
    setFoundClass(null);
    setJoinCodeStatus(null);

    // Only search when we have exactly 6 characters
    if (cleaned.length < 6) return;

    setJoinCodeStatus("checking");
    try {
      // Search Firestore for matching joinCode (stored unencrypted)
      const q = query(collection(db, "classes"), where("joinCode", "==", cleaned));
      const snap = await getDocs(q);

      if (!snap.empty) {
        const classDoc = snap.docs[0];
        const rawData = classDoc.data();
        // joinCode and teacherId are stored unencrypted
        // className may be encrypted - just use raw or show generic
        setFoundClass({
          id: classDoc.id,
          ...rawData,
          // Use unencrypted fields only for display
          name: rawData.teacherName ? `Class by ${rawData.teacherName}` : "Class found",
          teacherId: rawData.teacherId,
          teacherName: rawData.teacherName,
          joinCode: rawData.joinCode,
          section: rawData.section || "",
          course: rawData.course || "",
        });
        setJoinCodeStatus("found");
      } else {
        setJoinCodeStatus("notfound");
      }
    } catch (err) {
      console.error("Join code lookup error:", err);
      setJoinCodeStatus("notfound");
    }
  };

  const handleSubmit = async () => {
    setError("");
    setFieldErrors({});

    // Rate limit
    const rl = checkRateLimit(`login_${form.email}`, 5, 60000);
    if (!rl.allowed) { setError(`Too many attempts. Wait ${rl.retryAfter}s.`); return; }

    // Validate student join code on register
    if (mode === "register" && role === "student") {
      if (!form.joinCode || form.joinCode.trim().length < 6) {
        setError("Please enter your class join code."); return;
      }
      if (joinCodeStatus !== "found" || !foundClass) {
        setError("Invalid join code. Please check with your teacher."); return;
      }
    }

    setLoading(true);
    try {
      if (mode === "login") {
        await signInWithEmailAndPassword(auth, form.email.trim(), form.password);
      } else {
        const cred = await createUserWithEmailAndPassword(auth, form.email.trim(), form.password);
        const uid = cred.user.uid;

        // Save user profile
        await setDoc(doc(db, "users", uid), {
          name: form.name.trim(),
          email: form.email.trim(),
          role,
          studentId: role === "student" ? form.studentId.trim() : null,
          createdAt: new Date().toISOString()
        });

        // If student — auto-create student record linked to the class
        if (role === "student" && foundClass) {
          const studentData = {
            name: form.name.trim(),
            studentId: form.studentId.trim(),
            email: form.email.trim(),
            course: "",
            section: "",
            classId: foundClass.id,
            className: "",
            teacherId: foundClass.teacherId,
            userId: uid,
            joinedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          };
          // Encrypt sensitive fields
          const encrypted = encryptStudent(studentData, foundClass.teacherId);
          // Keep these unencrypted for queries
          encrypted.userId = uid;
          encrypted.classId = foundClass.id;
          encrypted.teacherId = foundClass.teacherId;
          await setDoc(doc(db, "students", uid), encrypted);
        }
      }
    } catch (err) {
      setError(err.message.replace("Firebase: ", "").replace(/\(auth.*\)\.?/, ""));
    }
    setLoading(false);
  };

  const joinCodeColor = joinCodeStatus === "found" ? SEENKA.present
    : joinCodeStatus === "notfound" ? SEENKA.absent
    : joinCodeStatus === "checking" ? SEENKA.late
    : SEENKA.darkBorder;

  return (
    <div style={{ minHeight: "100vh", background: SEENKA.darkNav, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "system-ui, sans-serif", position: "relative", overflow: "hidden" }}>
      {/* Background glow orbs */}
      <div style={{ position: "absolute", top: "-20%", left: "-10%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(0,163,255,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "-20%", right: "-10%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(168,85,247,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />

      <div style={{ background: "rgba(17,24,39,0.9)", backdropFilter: "blur(20px)", borderRadius: 24, padding: "2.5rem", width: "100%", maxWidth: 460, border: "1px solid #1e2d45", boxShadow: "0 0 60px rgba(0,163,255,0.08), 0 24px 64px rgba(0,0,0,0.5)", position: "relative", zIndex: 1 }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
            <div style={{ width: 72, height: 72, borderRadius: 20, background: "linear-gradient(135deg, rgba(0,163,255,0.15), rgba(168,85,247,0.15))", border: "1px solid rgba(0,163,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 30px rgba(0,163,255,0.2)" }}>
              <SeenKaLogo size={44} />
            </div>
          </div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, background: "linear-gradient(135deg, #00A3FF, #A855F7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>SeenKa</h1>
          <p style={{ margin: "4px 0 0", color: SEENKA.textMuted, fontSize: 14 }}>Be Seen. Be Counted.</p>
        </div>

        {/* Mode toggle */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 4, border: "1px solid #1e2d45" }}>
          {["login", "register"].map(m => (
            <button key={m} onClick={() => setMode(m)} style={{ flex: 1, padding: "9px", borderRadius: 9, border: "none", background: mode === m ? "linear-gradient(135deg, #00A3FF, #A855F7)" : "none", color: mode === m ? "#fff" : SEENKA.textMuted, fontWeight: 700, cursor: "pointer", fontSize: 13, boxShadow: mode === m ? "0 4px 16px rgba(0,163,255,0.3)" : "none", transition: "all 0.2s" }}>
              {m === "login" ? "Sign In" : "Register"}
            </button>
          ))}
        </div>

        {/* Role selector */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {[["teacher", "👩‍🏫", "Teacher"], ["student", "🎒", "Student"]].map(([r, icon, label]) => (
            <button key={r} onClick={() => setRole(r)} style={{ flex: 1, padding: "10px", borderRadius: 12, border: `1.5px solid ${role === r ? SEENKA.electricBlue : "#1e2d45"}`, background: role === r ? "rgba(0,163,255,0.1)" : "rgba(255,255,255,0.02)", color: role === r ? SEENKA.electricBlue : SEENKA.textMuted, fontWeight: 700, cursor: "pointer", fontSize: 13, boxShadow: role === r ? "0 0 16px rgba(0,163,255,0.15)" : "none", transition: "all 0.2s" }}>
              {icon} {label}
            </button>
          ))}
        </div>

        {/* Form fields */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {mode === "register" && (
            <ProtectedInput label="Full Name" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} fieldType="name" placeholder="e.g. Maria Santos" required={true} />
          )}

          {mode === "register" && role === "student" && (
            <ProtectedInput label="Student ID" value={form.studentId} onChange={v => setForm(f => ({ ...f, studentId: v }))} fieldType="studentId" placeholder="e.g. 2024-001" required={true} />
          )}

          <ProtectedInput label="Email Address" type="email" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} fieldType="email" placeholder="you@college.edu" required={true} />

          <ProtectedInput label="Password" type="password" value={form.password} onChange={v => setForm(f => ({ ...f, password: v }))} fieldType="password" placeholder="minimum 6 characters" required={true} />

          {/* Join Code field — only for student registration */}
          {mode === "register" && role === "student" && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: SEENKA.textMuted, display: "block", marginBottom: 6 }}>
                Class Join Code <span style={{ color: SEENKA.absent }}>*</span>
              </label>
              <div style={{ position: "relative" }}>
                <input
                  style={{ ...inputStyle, border: `1.5px solid ${joinCodeColor}`, letterSpacing: 4, fontFamily: "monospace", fontSize: 18, fontWeight: 800, textTransform: "uppercase", paddingRight: 40 }}
                  placeholder="ABC-123"
                  value={form.joinCode}
                  onChange={e => handleJoinCodeChange(e.target.value)}
                  maxLength={7}
                />
                <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16 }}>
                  {joinCodeStatus === "checking" && "⏳"}
                  {joinCodeStatus === "found" && "✅"}
                  {joinCodeStatus === "notfound" && "❌"}
                </span>
              </div>

              {/* Class found preview */}
              {joinCodeStatus === "found" && foundClass && (
                <div style={{ marginTop: 8, padding: "10px 14px", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: 10, display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 20 }}>📚</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: SEENKA.present }}>✅ Class found! You will be enrolled.</div>
                    <div style={{ fontSize: 12, color: SEENKA.textMuted }}>Teacher: {foundClass.teacherName || "Your instructor"}</div>
                  </div>
                </div>
              )}

              {joinCodeStatus === "notfound" && (
                <div style={{ marginTop: 6, fontSize: 12, color: SEENKA.absent }}>
                  ❌ Code not found. Ask your teacher for the correct code.
                </div>
              )}

              <div style={{ marginTop: 6, fontSize: 11, color: SEENKA.textMuted }}>
                Ask your teacher for the 6-character class join code
              </div>
            </div>
          )}
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
          {mode === "register" && role === "student"
            ? <><span style={{ color: SEENKA.electricBlue, fontWeight: 700 }}>How it works:</span> Your teacher will give you a 6-character class code. Enter it above to automatically join their class.</>
            : <><span style={{ color: SEENKA.electricBlue, fontWeight: 700 }}>First time?</span> Click Register to create your account. Teachers register first, then share class join codes with students.</>
          }
        </div>

        <div style={{ textAlign: "right", marginTop: 12 }}>
          <button onClick={() => setDark(!dark)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, opacity: 0.6 }}>{dark ? "☀️" : "🌙"}</button>
        </div>
      </div>
    </div>
  );
}
