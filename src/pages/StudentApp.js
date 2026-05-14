import { useState, useEffect } from "react";
import { db } from "../firebase/config";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";

const COLORS = {
  present: "#22c55e", late: "#f59e0b", absent: "#ef4444", excused: "#3b82f6",
  presentBg: "#dcfce7", lateBg: "#fef3c7", absentBg: "#fee2e2", excusedBg: "#dbeafe",
};

function Avatar({ name = "?", size = 36, style = {} }) {
  const colors = ["#4f46e5","#0891b2","#059669","#d97706","#dc2626","#7c3aed","#db2777"];
  const idx = (name.charCodeAt(0) || 0) % colors.length;
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: colors[idx], display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: size * 0.35, flexShrink: 0, ...style }}>
      {name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
    </div>
  );
}

function StatusBadge({ status }) {
  const cfg = {
    present: { bg: COLORS.presentBg, color: "#166534", label: "Present" },
    late: { bg: COLORS.lateBg, color: "#92400e", label: "Late" },
    absent: { bg: COLORS.absentBg, color: "#991b1b", label: "Absent" },
    excused: { bg: COLORS.excusedBg, color: "#1e40af", label: "Excused" },
  };
  const c = cfg[status] || { bg: "#f3f4f6", color: "#6b7280", label: "Not Marked" };
  return (
    <span style={{ background: c.bg, color: c.color, borderRadius: 999, padding: "3px 12px", fontSize: 12, fontWeight: 700 }}>
      {c.label}
    </span>
  );
}

export default function StudentApp({ user, onSignOut, dark, setDark }) {
  const [page, setPage] = useState("attendance");
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [studentInfo, setStudentInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterMonth, setFilterMonth] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const accent = "#4f46e5";
  const bg = dark ? "#0f172a" : "#f8fafc";
  const surface = dark ? "#1e293b" : "#ffffff";
  const surface2 = dark ? "#334155" : "#f1f5f9";
  const border = dark ? "#334155" : "#e2e8f0";
  const text = dark ? "#f1f5f9" : "#0f172a";
  const textMuted = dark ? "#94a3b8" : "#64748b";
  const card = { background: surface, border: `1px solid ${border}`, borderRadius: 16, padding: "1.25rem", marginBottom: "1rem" };

  // Load attendance records for this student by matching name or studentId
  useEffect(() => {
    // Try to find student record by email or name
    const q = query(
      collection(db, "attendance"),
      where("studentName", "==", user.name)
    );
    const unsub = onSnapshot(q, snap => {
      const records = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      records.sort((a, b) => b.date.localeCompare(a.date));
      setAttendanceRecords(records);
      setLoading(false);
    });
    return unsub;
  }, [user.name]);

  // Also try to find student profile info from students collection
  useEffect(() => {
    const q = query(collection(db, "students"), where("email", "==", user.email));
    const unsub = onSnapshot(q, snap => {
      if (!snap.empty) {
        setStudentInfo({ id: snap.docs[0].id, ...snap.docs[0].data() });
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
    { id: "overview", icon: "📊", label: "Overview" },
    { id: "settings", icon: "⚙️", label: "Settings" },
  ];

  // Get unique months from records
  const months = [...new Set(attendanceRecords.map(r => r.date?.slice(0, 7)))].sort().reverse();

  return (
    <div style={{ minHeight: "100vh", background: bg, display: "flex", fontFamily: "system-ui, sans-serif", color: text }}>

      {/* Sidebar */}
      <div style={{ width: sidebarOpen ? 240 : 64, background: surface, borderRight: `1px solid ${border}`, display: "flex", flexDirection: "column", transition: "width 0.2s", flexShrink: 0, position: "sticky", top: 0, height: "100vh", overflow: "hidden" }}>
        <div style={{ padding: "1.25rem 1rem", borderBottom: `1px solid ${border}`, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, background: accent, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>🎓</div>
          {sidebarOpen && <span style={{ fontWeight: 800, fontSize: 17, color: accent }}>EduTrack</span>}
        </div>
        <nav style={{ flex: 1, padding: "1rem 0.5rem" }}>
          {navItems.map(item => (
            <button key={item.id} onClick={() => setPage(item.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, border: "none", background: page === item.id ? "#ede9fe" : "none", color: page === item.id ? accent : textMuted, cursor: "pointer", fontWeight: page === item.id ? 700 : 500, fontSize: 14, marginBottom: 2, textAlign: "left" }}>
              <span style={{ fontSize: 18 }}>{item.icon}</span>
              {sidebarOpen && item.label}
            </button>
          ))}
        </nav>
        <div style={{ padding: "1rem 0.75rem", borderTop: `1px solid ${border}` }}>
          {sidebarOpen && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <Avatar name={user.name} size={32} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{user.name}</div>
                <div style={{ fontSize: 11, color: textMuted }}>Student</div>
              </div>
            </div>
          )}
          <button onClick={onSignOut} style={{ background: surface2, color: text, border: `1px solid ${border}`, borderRadius: 9, padding: "8px", cursor: "pointer", fontWeight: 500, fontSize: 12, width: "100%" }}>
            {sidebarOpen ? "🚪 Sign Out" : "🚪"}
          </button>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Topbar */}
        <div style={{ background: surface, borderBottom: `1px solid ${border}`, padding: "0.75rem 1.5rem", display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, zIndex: 10 }}>
          <button onClick={() => setSidebarOpen(o => !o)} style={{ background: surface2, border: `1px solid ${border}`, borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 16, color: text }}>☰</button>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{navItems.find(n => n.id === page)?.label}</h2>
            <p style={{ margin: 0, fontSize: 12, color: textMuted }}>{new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
          </div>
          <button onClick={() => setDark(!dark)} style={{ background: surface2, border: `1px solid ${border}`, borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 18 }}>{dark ? "☀️" : "🌙"}</button>
        </div>

        <div style={{ flex: 1, padding: "1.5rem", overflowY: "auto" }}>

          {/* MY ATTENDANCE PAGE */}
          {page === "attendance" && (
            <div>
              {/* Profile Card */}
              <div style={{ ...card, background: `linear-gradient(135deg, ${accent}, #7c3aed)`, color: "#fff", display: "flex", gap: 16, alignItems: "center", marginBottom: "1.5rem" }}>
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
                <div style={{ background: "#fee2e2", border: "1.5px solid #fca5a5", borderRadius: 12, padding: "14px 18px", marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 24 }}>⚠️</span>
                  <div>
                    <div style={{ fontWeight: 700, color: "#991b1b", fontSize: 15 }}>Attendance Warning!</div>
                    <div style={{ color: "#b91c1c", fontSize: 13 }}>Your attendance is below 75%. You are at risk of being barred from examinations. Please coordinate with your instructor.</div>
                  </div>
                </div>
              )}

              {/* Stats */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: "1.5rem" }}>
                {[
                  { label: "Present", value: stats.present, color: COLORS.present, bg: COLORS.presentBg },
                  { label: "Late", value: stats.late, color: "#92400e", bg: COLORS.lateBg },
                  { label: "Absent", value: stats.absent, color: "#991b1b", bg: COLORS.absentBg },
                  { label: "Excused", value: stats.excused, color: "#1e40af", bg: COLORS.excusedBg },
                ].map((s, i) => (
                  <div key={i} style={{ background: s.bg, borderRadius: 12, padding: "1rem", textAlign: "center" }}>
                    <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: 12, color: s.color, fontWeight: 600 }}>{s.label}</div>
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
                <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700 }}>My Profile</h3>
                <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 0", borderBottom: `1px solid ${border}`, marginBottom: 12 }}>
                  <Avatar name={user.name} size={56} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 17 }}>{user.name}</div>
                    <div style={{ color: textMuted, fontSize: 13 }}>{user.email}</div>
                    {studentInfo && <div style={{ color: textMuted, fontSize: 13 }}>ID: {studentInfo.studentId} · {studentInfo.section}</div>}
                    <span style={{ background: "#dbeafe", color: "#1e40af", borderRadius: 6, padding: "2px 8px", fontSize: 12, fontWeight: 700 }}>Student</span>
                  </div>
                </div>
              </div>

              <div style={card}>
                <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700 }}>Appearance</h3>
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
                <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700 }}>Attendance Policy</h3>
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
