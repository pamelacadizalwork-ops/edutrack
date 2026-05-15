import { useState, useEffect } from "react";
import { db } from "../firebase/config";
import QRScanner from "./QRScanner";
import { Avatar, PhotoUploader } from "../components/PhotoUploader";
import { SeenKaLogo, GradientButton, StatusBadge, SEENKA } from "../components/SeenKaTheme";
import { decryptStudent, decryptAttendance } from "../utils/encryption";
import { collection, query, where, onSnapshot } from "firebase/firestore";

const COLORS = {
  present: "#22c55e", late: "#f59e0b", absent: "#ef4444", excused: "#3b82f6",
  presentBg: "#dcfce7", lateBg: "#fef3c7", absentBg: "#fee2e2", excusedBg: "#dbeafe",
};


export default function StudentApp({ user, onSignOut, dark, setDark, qrSessionId }) {
  const [page, setPage] = useState(qrSessionId ? "qrscan" : "attendance");
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [studentInfo, setStudentInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterMonth, setFilterMonth] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notification, setNotification] = useState(null);

  const notify = (msg, type = "success") => { setNotification({ msg, type }); setTimeout(() => setNotification(null), 3000); };

  const accent = SEENKA.electricBlue;
  const bg = SEENKA.darkNav;
  const surface = SEENKA.darkCard;
  const surface2 = SEENKA.darkCardElevated;
  const border = SEENKA.darkBorder;
  const text = SEENKA.textPrimary;
  const textMuted = SEENKA.textMuted;
  const card = { background: "rgba(17,24,39,0.9)", border: `1px solid ${SEENKA.darkBorder}`, borderRadius: 16, padding: "1.25rem", marginBottom: "1rem", boxShadow: "0 4px 20px rgba(0,0,0,0.3)" };

  // Load attendance records for this student by matching name or studentId
  // Load attendance by studentId (UID) — decrypt each record
  useEffect(() => {
    const q = query(
      collection(db, "attendance"),
      where("studentId", "==", user.uid)
    );
    const unsub = onSnapshot(q, snap => {
      const records = snap.docs.map(d => {
        const raw = { id: d.id, ...d.data() };
        // Try to decrypt — teacherId is stored unencrypted so we can use it as key
        try {
          return decryptAttendance(raw, raw.teacherId || user.uid);
        } catch {
          return raw;
        }
      });
      records.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      setAttendanceRecords(records);
      setLoading(false);
    });
    return unsub;
  }, [user.uid]);

  // Load student profile info — decrypt fields
  useEffect(() => {
    const q = query(collection(db, "students"), where("email", "==", user.email));
    const unsub = onSnapshot(q, snap => {
      if (!snap.empty) {
        const raw = { id: snap.docs[0].id, ...snap.docs[0].data() };
        try {
          setStudentInfo(decryptStudent(raw, raw.teacherId || user.uid));
        } catch {
          setStudentInfo(raw);
        }
      }
    });
    return unsub;
  }, [user.email]);

  const filteredRecords = filterMonth
    ? attendanceRecords.filter(r => r.date?.startsWith(filterMonth))
    : attendanceRecords;

  const stats = {
    total: attendanceRecords.length,
    present: attendanceRecords.filter(r => r.status === "present").length,
    late: attendanceRecords.filter(r => r.status === "late").length,
    absent: attendanceRecords.filter(r => r.status === "absent").length,
    excused: attendanceRecords.filter(r => r.status === "excused").length,
  };

  const attendanceRate = stats.total
    ? Math.round(((stats.present + stats.late) / stats.total) * 100)
    : 100;

  // Group records by subject/class
  const byClass = attendanceRecords.reduce((acc, r) => {
    const key = r.className || "Unknown";
    if (!acc[key]) acc[key] = { present: 0, late: 0, absent: 0, excused: 0, total: 0 };
    acc[key][r.status] = (acc[key][r.status] || 0) + 1;
    acc[key].total++;
    return acc;
  }, {});

  const navItems = [
    { id: "attendance", icon: "📋", label: "My Attendance" },
    { id: "qrscan", icon: "📲", label: "Scan QR Code" },
    { id: "overview", icon: "📊", label: "Overview" },
    { id: "settings", icon: "⚙️", label: "Settings" },
  ];

  // Get unique months from records
  const months = [...new Set(attendanceRecords.map(r => r.date?.slice(0, 7)))].sort().reverse();

  return (
    <div style={{ minHeight: "100vh", background: SEENKA.darkNav, display: "flex", fontFamily: "system-ui, sans-serif", color: SEENKA.textPrimary }}>

      {notification && (
        <div style={{ position: "fixed", top: 20, right: 20, zIndex: 9999, padding: "12px 20px", borderRadius: 12, background: notification.type === "error" ? "#fee2e2" : "#dcfce7", color: notification.type === "error" ? "#991b1b" : "#166534", fontWeight: 600, fontSize: 14, boxShadow: "0 4px 20px rgba(0,0,0,0.15)" }}>
          {notification.type === "error" ? "❌ " : "✅ "}{notification.msg}
        </div>
      )}

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 40, backdropFilter: "blur(2px)" }} />
      )}

      {/* Sidebar */}
      <div style={{
        position: "fixed", top: 0, left: 0, height: "100vh", zIndex: 50,
        width: 240, background: "rgba(10,15,30,0.98)",
        borderRight: `1px solid ${SEENKA.darkBorder}`,
        display: "flex", flexDirection: "column",
        transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 0.25s ease",
        boxShadow: sidebarOpen ? "4px 0 40px rgba(0,0,0,0.6)" : "none"
      }}>
        <div style={{ padding: "1.25rem 1rem", borderBottom: `1px solid ${SEENKA.darkBorder}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <SeenKaLogo size={32} showText={true} textSize={18} />
          <button onClick={() => setSidebarOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: SEENKA.textMuted }}>✕</button>
        </div>
        <nav style={{ flex: 1, padding: "1rem 0.5rem" }}>
          {navItems.map(item => (
            <button key={item.id} onClick={() => { setPage(item.id); setSidebarOpen(false); }} style={{
              width: "100%", display: "flex", alignItems: "center", gap: 10,
              padding: "11px 14px", borderRadius: 10, border: "none",
              background: page === item.id ? "linear-gradient(135deg, rgba(0,163,255,0.15), rgba(168,85,247,0.15))" : "none",
              color: page === item.id ? SEENKA.electricBlue : SEENKA.textMuted,
              cursor: "pointer", fontWeight: page === item.id ? 700 : 500,
              fontSize: 14, marginBottom: 2, textAlign: "left",
              borderLeft: page === item.id ? `3px solid ${SEENKA.electricBlue}` : "3px solid transparent",
              transition: "all 0.15s"
            }}>
              <span style={{ fontSize: 18 }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
        <div style={{ padding: "1rem 0.75rem", borderTop: `1px solid ${SEENKA.darkBorder}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, padding: "8px 10px", background: "rgba(0,163,255,0.06)", borderRadius: 10, border: `1px solid ${SEENKA.darkBorder}` }}>
            <Avatar name={user.name} size={32} photoURL={user.photoURL} />
            <div><div style={{ fontSize: 12, fontWeight: 700, color: SEENKA.textPrimary }}>{user.name}</div><div style={{ fontSize: 10, color: SEENKA.textMuted }}>Student</div></div>
          </div>
          <button onClick={onSignOut} style={{ background: "rgba(255,255,255,0.05)", color: SEENKA.textPrimary, border: `1px solid ${SEENKA.darkBorder}`, borderRadius: 9, padding: "8px", cursor: "pointer", fontWeight: 500, fontSize: 12, width: "100%" }}>
            🚪 Sign Out
          </button>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, width: "100%" }}>
        {/* Topbar */}
        <div style={{ background: "rgba(10,15,30,0.95)", backdropFilter: "blur(12px)", borderBottom: `1px solid ${SEENKA.darkBorder}`, padding: "0.75rem 1rem", display: "flex", alignItems: "center", gap: 10, position: "sticky", top: 0, zIndex: 10 }}>
          <button onClick={() => setSidebarOpen(o => !o)} style={{ background: "rgba(0,163,255,0.08)", border: `1px solid ${SEENKA.darkBorder}`, borderRadius: 8, padding: "8px 11px", cursor: "pointer", fontSize: 16, color: SEENKA.electricBlue, flexShrink: 0 }}>☰</button>
          <SeenKaLogo size={24} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: SEENKA.textPrimary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{navItems.find(n => n.id === page)?.label}</h2>
            <p style={{ margin: 0, fontSize: 11, color: SEENKA.textMuted }}>{new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</p>
          </div>
          <button onClick={() => setDark(!dark)} style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${SEENKA.darkBorder}`, borderRadius: 8, padding: "8px 10px", cursor: "pointer", fontSize: 16, flexShrink: 0 }}>{dark ? "☀️" : "🌙"}</button>
        </div>

        <div style={{ flex: 1, padding: "1rem", overflowY: "auto" }}>

          {/* QR SCANNER PAGE */}
          {page === "qrscan" && (
            <QRScanner user={user} dark={dark} /> 
          )}

          {/* MY ATTENDANCE PAGE */}
          {page === "attendance" && (
            <div>
              {/* Profile Card */}
              <div style={{ ...card, background: `linear-gradient(135deg, rgba(0,163,255,0.15), rgba(168,85,247,0.15))`, border: `1px solid rgba(0,163,255,0.25)`, display: "flex", gap: 16, alignItems: "center", marginBottom: "1.5rem", boxShadow: "0 0 30px rgba(0,163,255,0.1)" }}>
                <Avatar name={user.name} size={60} style={{ background: "rgba(255,255,255,0.25)", fontSize: 22 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 20 }}>{user.name}</div>
                  <div style={{ opacity: 0.85, fontSize: 14 }}>{user.email}</div>
                  {studentInfo && (
                    <>
                      <div style={{ opacity: 0.85, fontSize: 13 }}>{studentInfo.course} · Section {studentInfo.section}</div>
                      <div style={{ opacity: 0.85, fontSize: 13 }}>Student ID: {studentInfo.studentId}</div>
                    </>
                  )}
                </div>
                <div style={{ textAlign: "center", background: "rgba(255,255,255,0.15)", borderRadius: 14, padding: "12px 20px" }}>
                  <div style={{ fontWeight: 900, fontSize: 32 }}>{attendanceRate}%</div>
                  <div style={{ opacity: 0.85, fontSize: 13 }}>Attendance Rate</div>
                </div>
              </div>

              {/* Warning banner */}
              {attendanceRate < 75 && stats.total > 0 && (
                <div style={{ background: "rgba(239,68,68,0.1)", border: "1.5px solid rgba(239,68,68,0.3)", borderRadius: 12, padding: "14px 18px", marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 0 20px rgba(239,68,68,0.1)" }}>
                  <span style={{ fontSize: 24 }}>⚠️</span>
                  <div>
                    <div style={{ fontWeight: 700, color: "#EF4444", fontSize: 15 }}>Attendance Warning!</div>
                    <div style={{ color: "#FCA5A5", fontSize: 13 }}>Your attendance is below 75%. You are at risk of being barred from examinations.</div>
                  </div>
                </div>
              )}

              {/* Stats */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: "1.5rem" }}>
                {[
                  { label: "Present", value: stats.present, color: SEENKA.present, bg: "rgba(16,185,129,0.1)", border: "rgba(16,185,129,0.2)" },
                  { label: "Late", value: stats.late, color: SEENKA.late, bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.2)" },
                  { label: "Absent", value: stats.absent, color: SEENKA.absent, bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.2)" },
                  { label: "Excused", value: stats.excused, color: SEENKA.excused, bg: "rgba(0,163,255,0.1)", border: "rgba(0,163,255,0.2)" },
                ].map((s, i) => (
                  <div key={i} style={{ background: s.bg, borderRadius: 12, padding: "1rem", textAlign: "center", border: `1px solid ${s.border}`, boxShadow: `0 0 12px ${s.border}` }}>
                    <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: 12, color: s.color, fontWeight: 600, opacity: 0.8 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Attendance Records */}
              <div style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Attendance Records</h3>
                  <select
                    value={filterMonth}
                    onChange={e => setFilterMonth(e.target.value)}
                    style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${border}`, background: surface2, color: text, fontSize: 13 }}
                  >
                    <option value="">All Months</option>
                    {months.map(m => (
                      <option key={m} value={m}>{new Date(m + "-01").toLocaleDateString("en-US", { month: "long", year: "numeric" })}</option>
                    ))}
                  </select>
                </div>

                {loading ? (
                  <div style={{ textAlign: "center", padding: "2rem", color: textMuted }}>Loading records...</div>
                ) : filteredRecords.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "2rem", color: textMuted }}>
                    <div style={{ fontSize: 40, marginBottom: 8 }}>📋</div>
                    <p>No attendance records found yet.</p>
                    <p style={{ fontSize: 13 }}>Your teacher will mark your attendance during class.</p>
                  </div>
                ) : (
                  filteredRecords.map((record, i) => (
                    <div key={record.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: i < filteredRecords.length - 1 ? `1px solid ${border}` : "none" }}>
                      <div style={{ background: surface2, borderRadius: 10, padding: "8px 12px", textAlign: "center", minWidth: 56 }}>
                        <div style={{ fontWeight: 800, fontSize: 16 }}>{new Date(record.date).getDate()}</div>
                        <div style={{ fontSize: 10, color: textMuted, fontWeight: 600 }}>{new Date(record.date).toLocaleDateString("en-US", { month: "short" })}</div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{record.className || "Class"}</div>
                        <div style={{ fontSize: 12, color: textMuted }}>
                          {new Date(record.date).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                        </div>
                      </div>
                      <StatusBadge status={record.status} />
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* OVERVIEW PAGE */}
          {page === "overview" && (
            <div>
              {/* Attendance Rate Circle */}
              <div style={{ ...card, textAlign: "center", padding: "2rem" }}>
                <h3 style={{ margin: "0 0 1.5rem", fontSize: 16, fontWeight: 700 }}>Overall Attendance Rate</h3>
                <div style={{ position: "relative", width: 160, height: 160, margin: "0 auto 1.5rem" }}>
                  <svg viewBox="0 0 36 36" style={{ width: "100%", height: "100%", transform: "rotate(-90deg)" }}>
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke={surface2} strokeWidth="3" />
                    <circle
                      cx="18" cy="18" r="15.9" fill="none"
                      stroke={attendanceRate >= 75 ? COLORS.present : attendanceRate >= 60 ? COLORS.late : COLORS.absent}
                      strokeWidth="3"
                      strokeDasharray={`${attendanceRate} ${100 - attendanceRate}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ fontWeight: 900, fontSize: 32, color: attendanceRate >= 75 ? COLORS.present : COLORS.absent }}>{attendanceRate}%</div>
                    <div style={{ fontSize: 12, color: textMuted }}>Rate</div>
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "center", gap: 20 }}>
                  {[
                    { label: "Classes Attended", value: stats.present + stats.late, color: COLORS.present },
                    { label: "Classes Missed", value: stats.absent, color: COLORS.absent },
                    { label: "Total Classes", value: stats.total, color: accent },
                  ].map((s, i) => (
                    <div key={i} style={{ textAlign: "center" }}>
                      <div style={{ fontWeight: 800, fontSize: 20, color: s.color }}>{s.value}</div>
                      <div style={{ fontSize: 12, color: textMuted }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Per Subject Breakdown */}
              <div style={card}>
                <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700 }}>Per Subject Breakdown</h3>
                {Object.keys(byClass).length === 0 ? (
                  <p style={{ color: textMuted, fontSize: 14, textAlign: "center", padding: "1rem" }}>No subject data yet.</p>
                ) : Object.entries(byClass).map(([className, counts]) => {
                  const rate = counts.total ? Math.round(((counts.present + counts.late) / counts.total) * 100) : 0;
                  return (
                    <div key={className} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: `1px solid ${border}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{className}</div>
                          <div style={{ fontSize: 12, color: textMuted }}>{counts.total} total classes</div>
                        </div>
                        <span style={{ fontWeight: 800, fontSize: 18, color: rate >= 75 ? COLORS.present : COLORS.absent }}>{rate}%</span>
                      </div>
                      <div style={{ background: surface2, borderRadius: 6, height: 8, overflow: "hidden" }}>
                        <div style={{ width: `${rate}%`, height: "100%", background: rate >= 75 ? COLORS.present : rate >= 60 ? COLORS.late : COLORS.absent, borderRadius: 6, transition: "width 0.5s" }} />
                      </div>
                      <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                        {[["Present", counts.present, "#166534"], ["Late", counts.late, "#92400e"], ["Absent", counts.absent, "#991b1b"], ["Excused", counts.excused, "#1e40af"]].map(([l, v, c]) => (
                          <span key={l} style={{ fontSize: 12, color: c, fontWeight: 600 }}>{l}: {v}</span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Attendance Status Summary */}
              <div style={card}>
                <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700 }}>Status Summary</h3>
                {[
                  { label: "Present", val: stats.present, color: COLORS.present, bg: COLORS.presentBg },
                  { label: "Late", val: stats.late, color: COLORS.late, bg: COLORS.lateBg },
                  { label: "Absent", val: stats.absent, color: COLORS.absent, bg: COLORS.absentBg },
                  { label: "Excused", val: stats.excused, color: COLORS.excused, bg: COLORS.excusedBg },
                ].map((s, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: s.color, fontSize: 15, flexShrink: 0 }}>{s.val}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{s.label}</div>
                      <div style={{ background: surface2, borderRadius: 4, height: 6, marginTop: 4, overflow: "hidden" }}>
                        <div style={{ width: `${stats.total ? (s.val / stats.total) * 100 : 0}%`, height: "100%", background: s.color, borderRadius: 4 }} />
                      </div>
                    </div>
                    <div style={{ fontSize: 13, color: textMuted, minWidth: 36, textAlign: "right" }}>
                      {stats.total ? Math.round((s.val / stats.total) * 100) : 0}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SETTINGS PAGE */}
          {page === "settings" && (
            <div>
              <div style={card}>
                <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700 }}>👤 My Profile</h3>
                <PhotoUploader
                  userId={user.uid}
                  currentPhotoURL={user.photoURL}
                  userName={user.name}
                  collection="users"
                  dark={dark}
                  onUploadComplete={(url) => notify("Profile photo updated! ✅")}
                />
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${border}` }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{user.name}</div>
                  <div style={{ color: textMuted, fontSize: 13 }}>{user.email}</div>
                  {studentInfo && <div style={{ color: textMuted, fontSize: 13 }}>ID: {studentInfo.studentId} · {studentInfo.section}</div>}
                  <span style={{ background: "#dbeafe", color: "#1e40af", borderRadius: 6, padding: "2px 8px", fontSize: 12, fontWeight: 700, marginTop: 4, display: "inline-block" }}>Student</span>
                </div>
              </div>

              <div style={card}>
                <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700 }}>🎨 Appearance</h3>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>Dark Mode</div>
                    <div style={{ fontSize: 12, color: textMuted }}>Toggle dark/light theme</div>
                  </div>
                  <button onClick={() => setDark(!dark)} style={{ width: 48, height: 26, borderRadius: 13, background: dark ? accent : surface2, border: `1px solid ${border}`, cursor: "pointer", position: "relative" }}>
                    <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: dark ? 24 : 3, transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }} />
                  </button>
                </div>
              </div>

              <div style={card}>
                <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700 }}>📋 Attendance Policy</h3>
                <div style={{ fontSize: 14, color: textMuted, lineHeight: 1.7 }}>
                  <div>📌 Minimum required attendance: <strong style={{ color: text }}>75%</strong></div>
                  <div>📌 Students below 75% will be flagged as "At Risk"</div>
                  <div>📌 Students below 60% may be barred from examinations</div>
                  <div>📌 Always coordinate with your instructor if you have concerns</div>
                </div>
              </div>

              <button onClick={onSignOut} style={{ width: "100%", padding: "12px", borderRadius: 12, border: "none", background: "#fee2e2", color: "#991b1b", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                🚪 Sign Out
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
