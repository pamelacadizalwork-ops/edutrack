import { useState, useEffect, useRef } from "react";
import { db } from "../firebase/config";
import { doc, setDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { QRCodeSVG } from "qrcode.react";

export default function QRGenerator({ user, classes, students, dark }) {
  const [selectedClass, setSelectedClass] = useState(classes[0] || null);
  const [qrSession, setQrSession] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [scannedStudents, setScannedStudents] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [expiryMinutes, setExpiryMinutes] = useState(15);
  const timerRef = useRef(null);

  const accent = "#4f46e5";
  const surface = dark ? "#1e293b" : "#ffffff";
  const surface2 = dark ? "#334155" : "#f1f5f9";
  const border = dark ? "#334155" : "#e2e8f0";
  const text = dark ? "#f1f5f9" : "#0f172a";
  const textMuted = dark ? "#94a3b8" : "#64748b";
  const card = { background: surface, border: `1px solid ${border}`, borderRadius: 16, padding: "1.5rem", marginBottom: "1rem" };

  // Listen for scanned students in real-time
  useEffect(() => {
    if (!qrSession) return;
    const unsub = onSnapshot(doc(db, "qrSessions", qrSession.id), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setScannedStudents(data.scannedStudents || []);
      }
    });
    return unsub;
  }, [qrSession]);

  // Countdown timer
  useEffect(() => {
    if (!qrSession) return;
    timerRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.floor((qrSession.expiresAt - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining === 0) {
        clearInterval(timerRef.current);
        setQrSession(null);
      }
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [qrSession]);

  const generateQR = async () => {
    if (!selectedClass) return;
    setGenerating(true);
    try {
      const sessionId = `${selectedClass.id}_${Date.now()}`;
      const expiresAt = Date.now() + expiryMinutes * 60 * 1000;
      const todayStr = new Date().toISOString().split("T")[0];

      const sessionData = {
        id: sessionId,
        classId: selectedClass.id,
        className: selectedClass.name,
        section: selectedClass.section,
        teacherId: user.uid,
        teacherName: user.name,
        date: todayStr,
        expiresAt,
        expiryMinutes,
        scannedStudents: [],
        createdAt: serverTimestamp(),
      };

      await setDoc(doc(db, "qrSessions", sessionId), sessionData);
      setQrSession({ ...sessionData, expiresAt });
      setTimeLeft(expiryMinutes * 60);
      setScannedStudents([]);
    } catch (e) {
      console.error("Error generating QR:", e);
    }
    setGenerating(false);
  };

  const stopQR = async () => {
    if (!qrSession) return;
    clearInterval(timerRef.current);

    // Mark all non-scanned students as absent
    const classStudents = students.filter(s => s.section === selectedClass.section);
    const todayStr = new Date().toISOString().split("T")[0];

    const promises = classStudents.map(async (student) => {
      const alreadyScanned = scannedStudents.find(s => s.studentId === student.id);
      if (!alreadyScanned) {
        const docId = `${selectedClass.id}_${student.id}_${todayStr}`;
        await setDoc(doc(db, "attendance", docId), {
          classId: selectedClass.id,
          className: selectedClass.name,
          studentId: student.id,
          studentName: student.name,
          section: selectedClass.section,
          date: todayStr,
          status: "absent",
          teacherId: user.uid,
          updatedAt: serverTimestamp(),
          markedByQR: false,
        });
      }
    });
    await Promise.all(promises);
    setQrSession(null);
    setScannedStudents([]);
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const classStudents = selectedClass ? students.filter(s => s.section === selectedClass.section) : [];
  const notYetScanned = classStudents.filter(s => !scannedStudents.find(sc => sc.studentId === s.id));

  // QR code value — this is the URL students will be redirected to
  const qrValue = qrSession
    ? `${window.location.origin}/scan?session=${qrSession.id}&class=${encodeURIComponent(selectedClass.name)}`
    : "";

  const timerColor = timeLeft > 120 ? "#22c55e" : timeLeft > 60 ? "#f59e0b" : "#ef4444";

  return (
    <div>
      {/* Class selector and settings */}
      <div style={card}>
        <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700 }}>⚙️ QR Session Settings</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: textMuted, display: "block", marginBottom: 5 }}>Select Class</label>
            <select
              value={selectedClass?.id || ""}
              onChange={e => setSelectedClass(classes.find(c => c.id === e.target.value))}
              style={{ width: "100%", padding: "9px 13px", borderRadius: 9, border: `1.5px solid ${border}`, background: dark ? "#0f172a" : "#f8fafc", color: text, fontSize: 14 }}
              disabled={!!qrSession}
            >
              {classes.map(c => <option key={c.id} value={c.id}>{c.name} ({c.section})</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: textMuted, display: "block", marginBottom: 5 }}>QR Expires After</label>
            <select
              value={expiryMinutes}
              onChange={e => setExpiryMinutes(Number(e.target.value))}
              style={{ width: "100%", padding: "9px 13px", borderRadius: 9, border: `1.5px solid ${border}`, background: dark ? "#0f172a" : "#f8fafc", color: text, fontSize: 14 }}
              disabled={!!qrSession}
            >
              <option value={5}>5 minutes</option>
              <option value={10}>10 minutes</option>
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={60}>1 hour</option>
            </select>
          </div>
        </div>

        {!qrSession ? (
          <button
            onClick={generateQR}
            disabled={generating || classes.length === 0}
            style={{ background: accent, color: "#fff", border: "none", borderRadius: 10, padding: "12px 24px", cursor: "pointer", fontWeight: 700, fontSize: 15, opacity: generating ? 0.7 : 1 }}
          >
            {generating ? "Generating..." : "🔲 Generate QR Code"}
          </button>
        ) : (
          <button
            onClick={stopQR}
            style={{ background: "#ef4444", color: "#fff", border: "none", borderRadius: 10, padding: "12px 24px", cursor: "pointer", fontWeight: 700, fontSize: 15 }}
          >
            ⏹ Stop & Save Attendance
          </button>
        )}
      </div>

      {/* Active QR Session */}
      {qrSession && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

          {/* QR Code Display */}
          <div style={{ ...card, textAlign: "center" }}>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: textMuted, marginBottom: 4 }}>{selectedClass?.name} · {selectedClass?.section}</div>
              <div style={{ fontSize: 13, color: textMuted }}>{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</div>
            </div>

            {/* QR Code */}
            <div style={{ display: "inline-block", padding: 16, background: "#fff", borderRadius: 16, marginBottom: 16, boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}>
              <QRCodeSVG
                value={qrValue}
                size={200}
                level="H"
                includeMargin={false}
                imageSettings={{
                  src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ctext y='18' font-size='18'%3E🎓%3C/text%3E%3C/svg%3E",
                  height: 30,
                  width: 30,
                  excavate: true,
                }}
              />
            </div>

            {/* Timer */}
            <div style={{ background: dark ? "#0f172a" : "#f8fafc", borderRadius: 12, padding: "12px 20px", marginBottom: 12 }}>
              <div style={{ fontSize: 36, fontWeight: 900, color: timerColor, fontFamily: "monospace" }}>{formatTime(timeLeft)}</div>
              <div style={{ fontSize: 12, color: textMuted }}>time remaining</div>
            </div>

            {/* Progress bar */}
            <div style={{ background: surface2, borderRadius: 6, height: 8, overflow: "hidden", marginBottom: 12 }}>
              <div style={{
                width: `${(timeLeft / (expiryMinutes * 60)) * 100}%`,
                height: "100%",
                background: timerColor,
                borderRadius: 6,
                transition: "width 1s linear, background 0.3s"
              }} />
            </div>

            <div style={{ fontSize: 13, color: textMuted, lineHeight: 1.6 }}>
              📱 Students scan this with their phone camera<br />
              🔗 Or share this link:
            </div>
            <div style={{ background: surface2, borderRadius: 8, padding: "6px 10px", marginTop: 8, fontSize: 11, color: accent, wordBreak: "break-all" }}>
              {qrValue}
            </div>
            <button
              onClick={() => navigator.clipboard.writeText(qrValue).then(() => alert("Link copied!"))}
              style={{ marginTop: 8, background: "#ede9fe", color: accent, border: "none", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}
            >
              📋 Copy Link
            </button>
          </div>

          {/* Scanned Students List */}
          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Live Attendance</h3>
              <div style={{ display: "flex", gap: 8 }}>
                <span style={{ background: "#dcfce7", color: "#166534", borderRadius: 8, padding: "4px 10px", fontSize: 13, fontWeight: 700 }}>✅ {scannedStudents.length}</span>
                <span style={{ background: "#fee2e2", color: "#991b1b", borderRadius: 8, padding: "4px 10px", fontSize: 13, fontWeight: 700 }}>❌ {notYetScanned.length}</span>
              </div>
            </div>

            {/* Scanned */}
            {scannedStudents.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#166534", marginBottom: 8 }}>✅ PRESENT ({scannedStudents.length})</div>
                {scannedStudents.map((s, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "#dcfce7", borderRadius: 8, marginBottom: 6 }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#22c55e", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
                      {s.studentName?.split(" ").map(n => n[0]).join("").slice(0, 2)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: "#166534" }}>{s.studentName}</div>
                      <div style={{ fontSize: 11, color: "#16a34a" }}>Scanned at {s.scannedAt}</div>
                    </div>
                    <span style={{ fontSize: 18 }}>✅</span>
                  </div>
                ))}
              </div>
            )}

            {/* Not yet scanned */}
            {notYetScanned.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#991b1b", marginBottom: 8 }}>⏳ NOT YET SCANNED ({notYetScanned.length})</div>
                {notYetScanned.map((s, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: surface2, borderRadius: 8, marginBottom: 6 }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: border, display: "flex", alignItems: "center", justifyContent: "center", color: textMuted, fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
                      {s.name?.split(" ").map(n => n[0]).join("").slice(0, 2)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: textMuted }}>{s.studentId}</div>
                    </div>
                    <span style={{ fontSize: 16, color: textMuted }}>⏳</span>
                  </div>
                ))}
              </div>
            )}

            {classStudents.length === 0 && (
              <p style={{ color: textMuted, fontSize: 14, textAlign: "center" }}>No students in this section yet.</p>
            )}
          </div>
        </div>
      )}

      {/* Instructions */}
      {!qrSession && (
        <div style={{ ...card, background: "#ede9fe", border: "1px solid #c4b5fd" }}>
          <h3 style={{ margin: "0 0 12px", color: accent, fontSize: 15, fontWeight: 700 }}>📱 How QR Attendance Works</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: accent, marginBottom: 8 }}>👩‍🏫 Teacher Steps:</div>
              {["Select your class above", "Choose how long the QR is valid", "Click 'Generate QR Code'", "Show QR on projector or screen", "Click 'Stop & Save' when done"].map((s, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, fontSize: 13 }}>
                  <span style={{ background: accent, color: "#fff", borderRadius: "50%", width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                  <span style={{ color: "#4338ca" }}>{s}</span>
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: accent, marginBottom: 8 }}>🎒 Student Steps:</div>
              {["Open phone camera", "Point at the QR code", "Tap the link that appears", "Log in to EduTrack if needed", "Attendance marked automatically! ✅"].map((s, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, fontSize: 13 }}>
                  <span style={{ background: "#7c3aed", color: "#fff", borderRadius: "50%", width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                  <span style={{ color: "#4338ca" }}>{s}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
