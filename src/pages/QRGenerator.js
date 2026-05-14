import { useState, useEffect, useRef } from "react";
import { db } from "../firebase/config";
import { doc, setDoc, onSnapshot, serverTimestamp, updateDoc, arrayUnion } from "firebase/firestore";

export default function QRGenerator({ user, classes, students, dark }) {
  const [selectedClass, setSelectedClass] = useState(classes[0] || null);
  const [qrSession, setQrSession] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [scannedStudents, setScannedStudents] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [expiryMinutes, setExpiryMinutes] = useState(15);
  const [qrImageUrl, setQrImageUrl] = useState("");
  const timerRef = useRef(null);

  const accent = "#4f46e5";
  const surface = dark ? "#1e293b" : "#ffffff";
  const surface2 = dark ? "#334155" : "#f1f5f9";
  const border = dark ? "#334155" : "#e2e8f0";
  const text = dark ? "#f1f5f9" : "#0f172a";
  const textMuted = dark ? "#94a3b8" : "#64748b";
  const card = { background: surface, border: `1px solid ${border}`, borderRadius: 16, padding: "1.5rem", marginBottom: "1rem" };
  const inputStyle = { width: "100%", padding: "9px 13px", borderRadius: 9, border: `1.5px solid ${border}`, background: dark ? "#0f172a" : "#f8fafc", color: text, fontSize: 14, outline: "none", boxSizing: "border-box" };

  // Update selectedClass when classes load
  useEffect(() => {
    if (classes.length > 0 && !selectedClass) {
      setSelectedClass(classes[0]);
    }
  }, [classes]);

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
        setQrImageUrl("");
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

      // Build scan URL — students click this to mark attendance
      const scanUrl = `${window.location.origin}?session=${sessionId}`;

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
        scanUrl,
        scannedStudents: [],
        createdAt: serverTimestamp(),
      };

      await setDoc(doc(db, "qrSessions", sessionId), sessionData);

      // Generate QR image using Google Charts API (no library needed)
      const encodedUrl = encodeURIComponent(scanUrl);
      const qrUrl = `https://chart.googleapis.com/chart?chs=250x250&cht=qr&chl=${encodedUrl}&choe=UTF-8`;
      setQrImageUrl(qrUrl);

      setQrSession({ ...sessionData, expiresAt });
      setTimeLeft(expiryMinutes * 60);
      setScannedStudents([]);
    } catch (e) {
      alert("Error generating QR: " + e.message);
    }
    setGenerating(false);
  };

  const stopQR = async () => {
    if (!qrSession) return;
    clearInterval(timerRef.current);

    // Mark non-scanned students as absent
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
    setQrImageUrl("");
    setScannedStudents([]);
    alert("Attendance saved! Present students recorded, absent students marked.");
  };

  const copyLink = () => {
    if (qrSession?.scanUrl) {
      navigator.clipboard.writeText(qrSession.scanUrl)
        .then(() => alert("✅ Link copied! Share it via GC or Messenger."))
        .catch(() => alert("Could not copy. Link: " + qrSession.scanUrl));
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const classStudents = selectedClass ? students.filter(s => s.section === selectedClass.section) : [];
  const notYetScanned = classStudents.filter(s => !scannedStudents.find(sc => sc.studentId === s.id));
  const timerColor = timeLeft > 120 ? "#22c55e" : timeLeft > 60 ? "#f59e0b" : "#ef4444";

  if (classes.length === 0) {
    return (
      <div style={{ ...card, textAlign: "center", padding: "3rem" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>📚</div>
        <h3 style={{ color: accent, margin: "0 0 8px" }}>No Classes Yet</h3>
        <p style={{ color: textMuted }}>Create a class first before using QR attendance.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Settings Card */}
      <div style={card}>
        <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700 }}>⚙️ QR Session Settings</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: textMuted, display: "block", marginBottom: 5 }}>Select Class</label>
            <select
              value={selectedClass?.id || ""}
              onChange={e => setSelectedClass(classes.find(c => c.id === e.target.value))}
              style={inputStyle}
              disabled={!!qrSession}
            >
              {classes.map(c => <option key={c.id} value={c.id}>{c.name} ({c.section})</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: textMuted, display: "block", marginBottom: 5 }}>QR Valid For</label>
            <select
              value={expiryMinutes}
              onChange={e => setExpiryMinutes(Number(e.target.value))}
              style={inputStyle}
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
            disabled={generating}
            style={{ background: accent, color: "#fff", border: "none", borderRadius: 10, padding: "12px 28px", cursor: "pointer", fontWeight: 700, fontSize: 15, opacity: generating ? 0.7 : 1 }}
          >
            {generating ? "⏳ Generating..." : "🔲 Generate QR Code"}
          </button>
        ) : (
          <button
            onClick={stopQR}
            style={{ background: "#ef4444", color: "#fff", border: "none", borderRadius: 10, padding: "12px 28px", cursor: "pointer", fontWeight: 700, fontSize: 15 }}
          >
            ⏹ Stop & Save Attendance
          </button>
        )}
      </div>

      {/* Active QR Session */}
      {qrSession && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

          {/* QR Code */}
          <div style={{ ...card, textAlign: "center" }}>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{selectedClass?.name}</div>
              <div style={{ fontSize: 13, color: textMuted }}>Section {selectedClass?.section} · {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</div>
            </div>

            {/* QR Image */}
            <div style={{ display: "inline-block", padding: 16, background: "#fff", borderRadius: 16, marginBottom: 16, boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}>
              {qrImageUrl ? (
                <img src={qrImageUrl} alt="QR Code" width={220} height={220} style={{ display: "block" }} />
              ) : (
                <div style={{ width: 220, height: 220, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8" }}>Loading QR...</div>
              )}
            </div>

            {/* Timer */}
            <div style={{ background: dark ? "#0f172a" : "#f8fafc", borderRadius: 12, padding: "12px 20px", marginBottom: 12 }}>
              <div style={{ fontSize: 40, fontWeight: 900, color: timerColor, fontFamily: "monospace" }}>{formatTime(timeLeft)}</div>
              <div style={{ fontSize: 12, color: textMuted }}>time remaining</div>
            </div>

            {/* Progress bar */}
            <div style={{ background: surface2, borderRadius: 6, height: 8, overflow: "hidden", marginBottom: 16 }}>
              <div style={{ width: `${(timeLeft / (expiryMinutes * 60)) * 100}%`, height: "100%", background: timerColor, borderRadius: 6, transition: "width 1s linear" }} />
            </div>

            {/* Share link */}
            <div style={{ fontSize: 13, color: textMuted, marginBottom: 8 }}>
              📱 Students scan with phone camera<br />
              💬 Or share this link via GC/Messenger:
            </div>
            <div style={{ background: surface2, borderRadius: 8, padding: "8px 12px", fontSize: 11, color: accent, wordBreak: "break-all", marginBottom: 8 }}>
              {qrSession.scanUrl}
            </div>
            <button onClick={copyLink} style={{ background: "#ede9fe", color: accent, border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
              📋 Copy Link to Share
            </button>
          </div>

          {/* Live Attendance List */}
          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Live Attendance</h3>
              <div style={{ display: "flex", gap: 8 }}>
                <span style={{ background: "#dcfce7", color: "#166534", borderRadius: 8, padding: "4px 10px", fontSize: 13, fontWeight: 700 }}>✅ {scannedStudents.length}</span>
                <span style={{ background: "#fee2e2", color: "#991b1b", borderRadius: 8, padding: "4px 10px", fontSize: 13, fontWeight: 700 }}>⏳ {notYetScanned.length}</span>
              </div>
            </div>

            <div style={{ maxHeight: 400, overflowY: "auto" }}>
              {/* Scanned */}
              {scannedStudents.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#166534", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>✅ Present ({scannedStudents.length})</div>
                  {scannedStudents.map((s, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "#dcfce7", borderRadius: 8, marginBottom: 5 }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#22c55e", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
                        {s.studentName?.split(" ").map(n => n[0]).join("").slice(0, 2)}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: "#166534" }}>{s.studentName}</div>
                        <div style={{ fontSize: 11, color: "#16a34a" }}>Scanned at {s.scannedAt}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Not yet scanned */}
              {notYetScanned.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#991b1b", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>⏳ Not Yet Scanned ({notYetScanned.length})</div>
                  {notYetScanned.map((s, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: surface2, borderRadius: 8, marginBottom: 5 }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: border, display: "flex", alignItems: "center", justifyContent: "center", color: textMuted, fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
                        {s.name?.split(" ").map(n => n[0]).join("").slice(0, 2)}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{s.name}</div>
                        <div style={{ fontSize: 11, color: textMuted }}>{s.studentId}</div>
                      </div>
                      <span style={{ color: textMuted }}>⏳</span>
                    </div>
                  ))}
                </div>
              )}

              {classStudents.length === 0 && (
                <p style={{ color: textMuted, fontSize: 14, textAlign: "center" }}>No students in section {selectedClass?.section} yet.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Instructions when no active session */}
      {!qrSession && (
        <div style={{ ...card, background: "#ede9fe", border: "1px solid #c4b5fd" }}>
          <h3 style={{ margin: "0 0 12px", color: accent, fontSize: 15, fontWeight: 700 }}>📱 How QR Attendance Works</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: accent, marginBottom: 10 }}>👩‍🏫 Teacher:</div>
              {["Select your class and expiry time", "Click Generate QR Code", "Show QR on projector or screen", "OR copy the link and share via GC", "Click Stop & Save when class ends"].map((s, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 7, fontSize: 13 }}>
                  <span style={{ background: accent, color: "#fff", borderRadius: "50%", width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                  <span style={{ color: "#4338ca" }}>{s}</span>
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#7c3aed", marginBottom: 10 }}>🎒 Student:</div>
              {["Open phone camera", "Point at the QR code on screen", "Tap the link that appears", "Log in to EduTrack if needed", "Attendance marked automatically ✅"].map((s, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 7, fontSize: 13 }}>
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
