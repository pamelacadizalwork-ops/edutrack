import { useState, useEffect, useRef } from "react";
import { db } from "../firebase/config";
import { doc, getDoc, updateDoc, arrayUnion, setDoc, serverTimestamp } from "firebase/firestore";

export default function QRScanner({ user, dark }) {
  const [status, setStatus] = useState("idle"); // idle | scanning | loading | success | error | expired
  const [message, setMessage] = useState("");
  const [sessionInfo, setSessionInfo] = useState(null);
  const [manualCode, setManualCode] = useState("");
  const scannerRef = useRef(null);
  const html5QrRef = useRef(null);

  const accent = "#4f46e5";
  const surface = dark ? "#1e293b" : "#ffffff";
  const surface2 = dark ? "#334155" : "#f1f5f9";
  const border = dark ? "#334155" : "#e2e8f0";
  const text = dark ? "#f1f5f9" : "#0f172a";
  const textMuted = dark ? "#94a3b8" : "#64748b";
  const card = { background: surface, border: `1px solid ${border}`, borderRadius: 16, padding: "1.5rem", marginBottom: "1rem" };

  // Check if arriving via QR scan URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session");
    if (sessionId) {
      processAttendance(sessionId);
    }
  }, []);

  const processAttendance = async (sessionId) => {
    setStatus("loading");
    setMessage("Verifying QR code...");
    try {
      const sessionDoc = await getDoc(doc(db, "qrSessions", sessionId));
      if (!sessionDoc.exists()) {
        setStatus("error");
        setMessage("QR session not found. Please ask your teacher to generate a new QR code.");
        return;
      }

      const session = sessionDoc.data();

      // Check if expired
      if (Date.now() > session.expiresAt) {
        setStatus("expired");
        setMessage("This QR code has expired. Ask your teacher to generate a new one.");
        setSessionInfo(session);
        return;
      }

      setSessionInfo(session);

      // Find student in the students collection
      const todayStr = new Date().toISOString().split("T")[0];
      const scannedTime = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

      // Check if already scanned
      const alreadyScanned = session.scannedStudents?.find(s => s.userId === user.uid);
      if (alreadyScanned) {
        setStatus("success");
        setMessage(`You already scanned at ${alreadyScanned.scannedAt}. Your attendance is recorded!`);
        return;
      }

      // Mark attendance in attendance collection
      const attendanceDocId = `${session.classId}_${user.uid}_${todayStr}`;
      await setDoc(doc(db, "attendance", attendanceDocId), {
        classId: session.classId,
        className: session.className,
        studentId: user.uid,
        studentName: user.name,
        section: session.section,
        date: todayStr,
        status: "present",
        teacherId: session.teacherId,
        updatedAt: serverTimestamp(),
        markedByQR: true,
        scannedAt: scannedTime,
      });

      // Update session with scanned student
      await updateDoc(doc(db, "qrSessions", sessionId), {
        scannedStudents: arrayUnion({
          userId: user.uid,
          studentName: user.name,
          studentId: user.uid,
          scannedAt: scannedTime,
        })
      });

      setStatus("success");
      setMessage(`Attendance marked! ✅ You're recorded as Present for ${session.className}`);

    } catch (e) {
      setStatus("error");
      setMessage("Something went wrong: " + e.message);
    }
  };

  const startCameraScanner = async () => {
    setStatus("scanning");
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      html5QrRef.current = new Html5Qrcode("qr-reader");
      await html5QrRef.current.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText) => {
          await html5QrRef.current.stop();
          setStatus("loading");
          // Extract session ID from URL
          try {
            const url = new URL(decodedText);
            const sessionId = url.searchParams.get("session");
            if (sessionId) {
              await processAttendance(sessionId);
            } else {
              setStatus("error");
              setMessage("Invalid QR code. Please scan your teacher's EduTrack QR code.");
            }
          } catch {
            setStatus("error");
            setMessage("Invalid QR code format.");
          }
        },
        () => {} // ignore errors during scanning
      );
    } catch (e) {
      setStatus("error");
      setMessage("Camera access denied. Please allow camera permission or use the manual link method.");
    }
  };

  const stopScanner = async () => {
    if (html5QrRef.current) {
      try { await html5QrRef.current.stop(); } catch {}
    }
    setStatus("idle");
  };

  const handleManualCode = async () => {
    if (!manualCode.trim()) return;
    await processAttendance(manualCode.trim());
  };

  return (
    <div>
      {/* Status: Success */}
      {status === "success" && (
        <div style={{ ...card, background: "#dcfce7", border: "2px solid #22c55e", textAlign: "center", padding: "2.5rem" }}>
          <div style={{ fontSize: 64, marginBottom: 12 }}>✅</div>
          <h2 style={{ color: "#166534", margin: "0 0 8px", fontSize: 22 }}>Attendance Recorded!</h2>
          <p style={{ color: "#15803d", fontSize: 15, marginBottom: 16 }}>{message}</p>
          {sessionInfo && (
            <div style={{ background: "#fff", borderRadius: 10, padding: "12px 16px", display: "inline-block" }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{sessionInfo.className}</div>
              <div style={{ fontSize: 13, color: "#64748b" }}>Section {sessionInfo.section}</div>
              <div style={{ fontSize: 13, color: "#64748b" }}>{sessionInfo.date}</div>
            </div>
          )}
          <div style={{ marginTop: 16 }}>
            <button onClick={() => setStatus("idle")} style={{ background: "#22c55e", color: "#fff", border: "none", borderRadius: 10, padding: "10px 24px", cursor: "pointer", fontWeight: 700, fontSize: 14 }}>
              Scan Another Class
            </button>
          </div>
        </div>
      )}

      {/* Status: Expired */}
      {status === "expired" && (
        <div style={{ ...card, background: "#fef3c7", border: "2px solid #f59e0b", textAlign: "center", padding: "2.5rem" }}>
          <div style={{ fontSize: 64, marginBottom: 12 }}>⏰</div>
          <h2 style={{ color: "#92400e", margin: "0 0 8px" }}>QR Code Expired</h2>
          <p style={{ color: "#a16207", fontSize: 14 }}>{message}</p>
          <button onClick={() => setStatus("idle")} style={{ marginTop: 16, background: "#f59e0b", color: "#fff", border: "none", borderRadius: 10, padding: "10px 24px", cursor: "pointer", fontWeight: 700, fontSize: 14 }}>Try Again</button>
        </div>
      )}

      {/* Status: Error */}
      {status === "error" && (
        <div style={{ ...card, background: "#fee2e2", border: "2px solid #ef4444", textAlign: "center", padding: "2.5rem" }}>
          <div style={{ fontSize: 64, marginBottom: 12 }}>❌</div>
          <h2 style={{ color: "#991b1b", margin: "0 0 8px" }}>Error</h2>
          <p style={{ color: "#b91c1c", fontSize: 14 }}>{message}</p>
          <button onClick={() => setStatus("idle")} style={{ marginTop: 16, background: "#ef4444", color: "#fff", border: "none", borderRadius: 10, padding: "10px 24px", cursor: "pointer", fontWeight: 700, fontSize: 14 }}>Try Again</button>
        </div>
      )}

      {/* Status: Loading */}
      {status === "loading" && (
        <div style={{ ...card, textAlign: "center", padding: "3rem" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>⏳</div>
          <h3 style={{ color: accent }}>{message}</h3>
        </div>
      )}

      {/* Status: Idle */}
      {status === "idle" && (
        <div>
          <div style={{ ...card, textAlign: "center", padding: "2rem" }}>
            <div style={{ fontSize: 56, marginBottom: 12 }}>📱</div>
            <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700 }}>Scan QR Code</h3>
            <p style={{ color: textMuted, fontSize: 14, marginBottom: 20 }}>Scan your teacher's QR code to mark your attendance automatically</p>
            <button
              onClick={startCameraScanner}
              style={{ background: accent, color: "#fff", border: "none", borderRadius: 12, padding: "14px 32px", cursor: "pointer", fontWeight: 700, fontSize: 15, marginBottom: 8 }}
            >
              📷 Open Camera Scanner
            </button>
            <div style={{ fontSize: 12, color: textMuted }}>Allow camera permission when prompted</div>
          </div>

          {/* Manual link entry */}
          <div style={card}>
            <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700 }}>🔗 Or Enter Session Code Manually</h3>
            <p style={{ color: textMuted, fontSize: 13, marginBottom: 12 }}>If you can't scan the QR, ask your teacher for the session code</p>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                style={{ flex: 1, padding: "9px 13px", borderRadius: 9, border: `1.5px solid ${border}`, background: dark ? "#0f172a" : "#f8fafc", color: text, fontSize: 14 }}
                placeholder="Paste session code or link here..."
                value={manualCode}
                onChange={e => setManualCode(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleManualCode()}
              />
              <button
                onClick={handleManualCode}
                style={{ background: accent, color: "#fff", border: "none", borderRadius: 9, padding: "9px 18px", cursor: "pointer", fontWeight: 700, fontSize: 13 }}
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Camera scanner view */}
      {status === "scanning" && (
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>📷 Camera Active — Point at QR Code</h3>
            <button onClick={stopScanner} style={{ background: "#fee2e2", color: "#991b1b", border: "none", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>Stop</button>
          </div>
          <div id="qr-reader" ref={scannerRef} style={{ width: "100%", borderRadius: 12, overflow: "hidden" }} />
          <p style={{ color: textMuted, fontSize: 13, textAlign: "center", marginTop: 12 }}>Hold your phone steady and point the camera at the QR code</p>
        </div>
      )}
    </div>
  );
}
