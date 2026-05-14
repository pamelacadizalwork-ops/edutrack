import { useState, useEffect } from "react";
import { db } from "../firebase/config";
import {
  collection, addDoc, getDocs, doc, setDoc, getDoc,
  query, where, orderBy, onSnapshot, deleteDoc, updateDoc, serverTimestamp
} from "firebase/firestore";

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
  const cfg = { present: { bg: COLORS.presentBg, color: "#166534", label: "Present" }, late: { bg: COLORS.lateBg, color: "#92400e", label: "Late" }, absent: { bg: COLORS.absentBg, color: "#991b1b", label: "Absent" }, excused: { bg: COLORS.excusedBg, color: "#1e40af", label: "Excused" } };
  const c = cfg[status] || { bg: "#f3f4f6", color: "#6b7280", label: "—" };
  return <span style={{ background: c.bg, color: c.color, borderRadius: 999, padding: "2px 10px", fontSize: 12, fontWeight: 600 }}>{c.label}</span>;
}

function MiniBarChart({ data }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 56 }}>
      {data.map((d, i) => (
        <div key={i} title={`${d.label}: ${d.value}%`} style={{ flex: 1, background: d.color || "#4f46e5", borderRadius: "3px 3px 0 0", height: `${(d.value / max) * 100}%`, minHeight: 4, opacity: 0.85 }} />
      ))}
    </div>
  );
}

export default function TeacherApp({ user, onSignOut, dark, setDark }) {
  const [page, setPage] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [attendanceRecords, setAttendanceRecords] = useState({});
  const [todayAttendance, setTodayAttendance] = useState({});
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [quickMode, setQuickMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [notification, setNotification] = useState(null);
  const [aiInsight, setAiInsight] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [showAddClass, setShowAddClass] = useState(false);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [classForm, setClassForm] = useState({ name: "", code: "", section: "", schedule: "" });
  const [studentForm, setStudentForm] = useState({ name: "", studentId: "", course: "", section: "", email: "" });
  const [loadingData, setLoadingData] = useState(true);

  const todayStr = new Date().toISOString().split("T")[0];
  const accent = "#4f46e5";
  const bg = dark ? "#0f172a" : "#f8fafc";
  const surface = dark ? "#1e293b" : "#ffffff";
  const surface2 = dark ? "#334155" : "#f1f5f9";
  const border = dark ? "#334155" : "#e2e8f0";
  const text = dark ? "#f1f5f9" : "#0f172a";
  const textMuted = dark ? "#94a3b8" : "#64748b";
  const card = { background: surface, border: `1px solid ${border}`, borderRadius: 16, padding: "1.25rem", marginBottom: "1rem" };
  const inputStyle = { width: "100%", padding: "9px 13px", borderRadius: 9, border: `1.5px solid ${border}`, background: dark ? "#0f172a" : "#f8fafc", color: text, fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "system-ui" };
  const btnPrimary = { background: accent, color: "#fff", border: "none", borderRadius: 9, padding: "9px 18px", cursor: "pointer", fontWeight: 700, fontSize: 13 };
  const btnSecondary = { background: surface2, color: text, border: `1px solid ${border}`, borderRadius: 9, padding: "8px 16px", cursor: "pointer", fontWeight: 500, fontSize: 13 };

  const notify = (msg, type = "success") => { setNotification({ msg, type }); setTimeout(() => setNotification(null), 3000); };

  // Load classes
  useEffect(() => {
    const q = query(collection(db, "classes"), where("teacherId", "==", user.uid));
    const unsub = onSnapshot(q, snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setClasses(data);
      if (data.length > 0 && !selectedClass) setSelectedClass(data[0]);
      setLoadingData(false);
    });
    return unsub;
  }, [user.uid]);

  // Load students
  useEffect(() => {
    const q = query(collection(db, "students"), where("teacherId", "==", user.uid));
    const unsub = onSnapshot(q, snap => {
      setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [user.uid]);

  // Load attendance for selected class
  useEffect(() => {
    if (!selectedClass) return;
    const q = query(collection(db, "attendance"), where("classId", "==", selectedClass.id));
    const unsub = onSnapshot(q, snap => {
      const records = {};
      snap.docs.forEach(d => {
        const data = d.data();
        if (!records[data.date]) records[data.date] = {};
        records[data.date][data.studentId] = data.status;
      });
      setAttendanceRecords(records);
    });
    return unsub;
  }, [selectedClass]);

  // Load today's attendance into local state when date/class changes
  useEffect(() => {
    if (!selectedClass) return;
    const classStudents = students.filter(s => s.section === selectedClass.section);
    const existing = attendanceRecords[selectedDate] || {};
    const init = {};
    classStudents.forEach(s => { init[s.id] = existing[s.id] || null; });
    setTodayAttendance(init);
    setSaved(false);
  }, [selectedDate, selectedClass, students, attendanceRecords]);

  const addClass = async () => {
    if (!classForm.name || !classForm.section) { notify("Class name and section are required", "error"); return; }
    try {
      await addDoc(collection(db, "classes"), { ...classForm, teacherId: user.uid, teacherName: user.name, createdAt: serverTimestamp() });
      setClassForm({ name: "", code: "", section: "", schedule: "" });
      setShowAddClass(false);
      notify("Class added successfully!");
    } catch (e) { notify("Error adding class", "error"); }
  };

  const addStudent = async () => {
    if (!studentForm.name || !studentForm.studentId) { notify("Name and Student ID are required", "error"); return; }
    try {
      await addDoc(collection(db, "students"), { ...studentForm, teacherId: user.uid, createdAt: serverTimestamp() });
      setStudentForm({ name: "", studentId: "", course: "", section: "", email: "" });
      setShowAddStudent(false);
      notify("Student added successfully!");
    } catch (e) { notify("Error adding student: " + e.message, "error"); }
  };

  const deleteStudent = async (studentId) => {
    if (!window.confirm("Delete this student?")) return;
    try {
      await deleteDoc(doc(db, "students", studentId));
      notify("Student removed");
    } catch (e) { notify("Error removing student", "error"); }
  };

  const saveAttendance = async () => {
    if (!selectedClass) { notify("Please select a class first", "error"); return; }
    setSaving(true);
    try {
      const classStudents = students.filter(s => s.section === selectedClass.section);
      const promises = classStudents.map(async (student) => {
        const status = todayAttendance[student.id];
        if (!status) return;
        const docId = `${selectedClass.id}_${student.id}_${selectedDate}`;
        await setDoc(doc(db, "attendance", docId), {
          classId: selectedClass.id,
          className: selectedClass.name,
          studentId: student.id,
          studentName: student.name,
          section: selectedClass.section,
          date: selectedDate,
          status: status,
          teacherId: user.uid,
          updatedAt: serverTimestamp()
        });
      });
      await Promise.all(promises);
      setSaved(true);
      notify("Attendance saved to Firebase! ✅");
    } catch (e) { notify("Error saving: " + e.message, "error"); }
    setSaving(false);
  };

  const markAll = (status) => {
    if (!selectedClass) return;
    const updated = {};
    students.filter(s => s.section === selectedClass.section).forEach(s => { updated[s.id] = status; });
    setTodayAttendance(prev => ({ ...prev, ...updated }));
    setSaved(false);
  };

  const getAttendanceRate = (studentId) => {
    const dates = Object.keys(attendanceRecords);
    if (!dates.length) return 100;
    let present = 0;
    dates.forEach(d => { if (attendanceRecords[d][studentId] === "present" || attendanceRecords[d][studentId] === "late") present++; });
    return Math.round((present / dates.length) * 100);
  };

  const classStudents = selectedClass ? students.filter(s => s.section === selectedClass.section) : [];
  const filteredStudents = classStudents.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.studentId?.includes(searchQuery);
    const matchFilter = filterStatus === "all" || todayAttendance[s.id] === filterStatus;
    return matchSearch && matchFilter;
  });

  const todayStats = {
    present: Object.values(todayAttendance).filter(v => v === "present").length,
    late: Object.values(todayAttendance).filter(v => v === "late").length,
    absent: Object.values(todayAttendance).filter(v => v === "absent").length,
    excused: Object.values(todayAttendance).filter(v => v === "excused").length,
    total: classStudents.length,
  };

  const overallStats = (() => {
    const allDates = Object.keys(attendanceRecords);
    let present = 0, late = 0, absent = 0, excused = 0, total = 0;
    allDates.forEach(d => { Object.values(attendanceRecords[d]).forEach(v => { total++; if (v === "present") present++; else if (v === "late") late++; else if (v === "absent") absent++; else if (v === "excused") excused++; }); });
    return { present, late, absent, excused, total, rate: total ? Math.round(((present + late) / total) * 100) : 0 };
  })();

  const chartData = (() => {
    const dates = Object.keys(attendanceRecords).sort().slice(-7);
    return dates.map(d => {
      const vals = Object.values(attendanceRecords[d]);
      const rate = vals.length ? Math.round((vals.filter(v => v === "present" || v === "late").length / vals.length) * 100) : 0;
      return { label: d.slice(5), value: rate, color: rate >= 80 ? COLORS.present : rate >= 60 ? COLORS.late : COLORS.absent };
    });
  })();

  const fetchAiInsight = async () => {
    setAiLoading(true); setAiInsight("");
    const atRisk = students.filter(s => getAttendanceRate(s.id) < 75);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 1000,
          messages: [{ role: "user", content: `You are an academic attendance advisor. Analyze this attendance data and give a brief, actionable insight (3-4 sentences):\n\nClass: ${selectedClass?.name || "N/A"}\nDate: ${todayStr}\nTotal students: ${students.length}\nStudents at risk (below 75%): ${atRisk.map(s => s.name).join(", ") || "None"}\nToday: ${todayStats.present} present, ${todayStats.absent} absent, ${todayStats.late} late.\nOverall attendance rate: ${overallStats.rate}%\n\nProvide a concise, encouraging insight for the instructor.` }]
        })
      });
      const data = await res.json();
      setAiInsight(data.content?.[0]?.text || "No insight available.");
    } catch { setAiInsight("Could not load AI insight at this time."); }
    setAiLoading(false);
  };

  const navItems = [
    { id: "dashboard", icon: "📊", label: "Dashboard" },
    { id: "attendance", icon: "✅", label: "Take Attendance" },
    { id: "classes", icon: "📚", label: "My Classes" },
    { id: "students", icon: "👥", label: "Students" },
    { id: "reports", icon: "📄", label: "Reports" },
    { id: "settings", icon: "⚙️", label: "Settings" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: bg, display: "flex", fontFamily: "system-ui, sans-serif", color: text }}>
      {notification && (
        <div style={{ position: "fixed", top: 20, right: 20, zIndex: 9999, padding: "12px 20px", borderRadius: 12, background: notification.type === "error" ? "#fee2e2" : "#dcfce7", color: notification.type === "error" ? "#991b1b" : "#166534", fontWeight: 600, fontSize: 14, boxShadow: "0 4px 20px rgba(0,0,0,0.15)" }}>
          {notification.type === "error" ? "❌ " : "✅ "}{notification.msg}
        </div>
      )}

      {/* Sidebar */}
      <div style={{ width: sidebarOpen ? 240 : 64, background: surface, borderRight: `1px solid ${border}`, display: "flex", flexDirection: "column", transition: "width 0.2s", flexShrink: 0, position: "sticky", top: 0, height: "100vh", overflow: "hidden" }}>
        <div style={{ padding: "1.25rem 1rem", borderBottom: `1px solid ${border}`, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, background: accent, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>🎓</div>
          {sidebarOpen && <span style={{ fontWeight: 800, fontSize: 17, color: accent }}>EduTrack</span>}
        </div>
        <nav style={{ flex: 1, padding: "1rem 0.5rem", overflowY: "auto" }}>
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
              <div><div style={{ fontSize: 13, fontWeight: 700 }}>{user.name}</div><div style={{ fontSize: 11, color: textMuted }}>Teacher</div></div>
            </div>
          )}
          <button onClick={onSignOut} style={{ ...btnSecondary, width: "100%", fontSize: 12 }}>{sidebarOpen ? "🚪 Sign Out" : "🚪"}</button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Topbar */}
        <div style={{ background: surface, borderBottom: `1px solid ${border}`, padding: "0.75rem 1.5rem", display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, zIndex: 10 }}>
          <button onClick={() => setSidebarOpen(o => !o)} style={{ background: surface2, border: `1px solid ${border}`, borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 16, color: text }}>☰</button>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{navItems.find(n => n.id === page)?.label}</h2>
            <p style={{ margin: 0, fontSize: 12, color: textMuted }}>{new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
          </div>
          {selectedClass && <span style={{ background: "#ede9fe", color: accent, borderRadius: 8, padding: "4px 12px", fontSize: 13, fontWeight: 700 }}>{selectedClass.name}</span>}
          <button onClick={() => setDark(!dark)} style={{ background: surface2, border: `1px solid ${border}`, borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 18 }}>{dark ? "☀️" : "🌙"}</button>
        </div>

        <div style={{ flex: 1, padding: "1.5rem", overflowY: "auto" }}>

          {/* DASHBOARD */}
          {page === "dashboard" && (
            <div>
              {loadingData ? (
                <div style={{ textAlign: "center", padding: "3rem", color: textMuted }}>Loading your data...</div>
              ) : classes.length === 0 ? (
                <div style={{ ...card, textAlign: "center", padding: "3rem" }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>📚</div>
                  <h3 style={{ margin: "0 0 8px", color: accent }}>Welcome to EduTrack!</h3>
                  <p style={{ color: textMuted, marginBottom: 16 }}>Start by creating your first class, then add students.</p>
                  <button onClick={() => setPage("classes")} style={btnPrimary}>Create First Class →</button>
                </div>
              ) : (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: "1.5rem" }}>
                    {[
                      { label: "Total Students", value: students.length, icon: "👥", color: accent },
                      { label: "Total Classes", value: classes.length, icon: "📚", color: "#0891b2" },
                      { label: "Present Today", value: Object.values(attendanceRecords[todayStr] || {}).filter(v => v === "present").length, icon: "✅", color: COLORS.present },
                      { label: "Absent Today", value: Object.values(attendanceRecords[todayStr] || {}).filter(v => v === "absent").length, icon: "❌", color: COLORS.absent },
                      { label: "Avg Rate", value: overallStats.rate + "%", icon: "📈", color: "#7c3aed" },
                    ].map((stat, i) => (
                      <div key={i} style={{ background: surface, border: `1px solid ${border}`, borderRadius: 16, padding: "1.25rem" }}>
                        <span style={{ fontSize: 22 }}>{stat.icon}</span>
                        <div style={{ fontSize: 26, fontWeight: 800, color: stat.color, marginTop: 4 }}>{stat.value}</div>
                        <div style={{ fontSize: 12, color: textMuted }}>{stat.label}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: "1.5rem" }}>
                    <div style={card}>
                      <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700 }}>7-Day Attendance Trend</h3>
                      {chartData.length > 0 ? <MiniBarChart data={chartData} /> : <p style={{ color: textMuted, fontSize: 13 }}>No data yet. Start taking attendance!</p>}
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                        {chartData.map((d, i) => <span key={i} style={{ fontSize: 10, color: textMuted }}>{d.label}</span>)}
                      </div>
                    </div>
                    <div style={card}>
                      <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700 }}>Status Breakdown</h3>
                      {[
                        { label: "Present", val: overallStats.present, color: COLORS.present },
                        { label: "Late", val: overallStats.late, color: COLORS.late },
                        { label: "Absent", val: overallStats.absent, color: COLORS.absent },
                        { label: "Excused", val: overallStats.excused, color: COLORS.excused },
                      ].map((s, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                          <div style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0 }} />
                          <span style={{ fontSize: 13, flex: 1 }}>{s.label}</span>
                          <div style={{ background: surface2, borderRadius: 4, height: 6, flex: 2, overflow: "hidden" }}>
                            <div style={{ width: `${overallStats.total ? (s.val / overallStats.total) * 100 : 0}%`, height: "100%", background: s.color, borderRadius: 4 }} />
                          </div>
                          <span style={{ fontSize: 12, color: textMuted, minWidth: 28, textAlign: "right" }}>{s.val}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={card}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>🤖 AI Attendance Insight</h3>
                      <button onClick={fetchAiInsight} disabled={aiLoading} style={btnPrimary}>{aiLoading ? "Analyzing..." : "Get AI Insight"}</button>
                    </div>
                    {aiInsight
                      ? <div style={{ padding: "12px 16px", background: "#ede9fe", borderRadius: 10, color: "#4338ca", fontSize: 14, lineHeight: 1.7 }}>{aiInsight}</div>
                      : <p style={{ color: textMuted, fontSize: 14, margin: 0 }}>Click "Get AI Insight" to analyze your class attendance with AI.</p>}
                  </div>

                  <div style={card}>
                    <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700 }}>⚠️ Students at Risk (below 75%)</h3>
                    {students.filter(s => getAttendanceRate(s.id) < 75).length === 0
                      ? <p style={{ color: textMuted, fontSize: 14, margin: 0 }}>✅ All students are in good standing!</p>
                      : students.filter(s => getAttendanceRate(s.id) < 75).map(s => {
                        const rate = getAttendanceRate(s.id);
                        return (
                          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: `1px solid ${border}` }}>
                            <Avatar name={s.name} size={36} />
                            <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 14 }}>{s.name}</div><div style={{ fontSize: 12, color: textMuted }}>{s.studentId} · {s.section}</div></div>
                            <div style={{ textAlign: "right" }}><div style={{ fontWeight: 800, color: rate < 60 ? COLORS.absent : COLORS.late, fontSize: 20 }}>{rate}%</div><div style={{ fontSize: 11, color: textMuted }}>attendance</div></div>
                          </div>
                        );
                      })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAKE ATTENDANCE */}
          {page === "attendance" && (
            <div>
              {classes.length === 0 ? (
                <div style={{ ...card, textAlign: "center", padding: "3rem" }}>
                  <p style={{ color: textMuted }}>No classes yet. <button onClick={() => setPage("classes")} style={{ ...btnPrimary, display: "inline" }}>Create a Class</button></p>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", gap: 12, marginBottom: "1.5rem", flexWrap: "wrap", alignItems: "flex-end" }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, color: textMuted, display: "block", marginBottom: 4 }}>Class</label>
                      <select value={selectedClass?.id || ""} onChange={e => setSelectedClass(classes.find(c => c.id === e.target.value))} style={{ ...inputStyle, width: "auto" }}>
                        {classes.map(c => <option key={c.id} value={c.id}>{c.name} ({c.section})</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, color: textMuted, display: "block", marginBottom: 4 }}>Date</label>
                      <input type="date" value={selectedDate} onChange={e => { setSelectedDate(e.target.value); setSaved(false); }} style={{ ...inputStyle, width: "auto" }} max={todayStr} />
                    </div>
                    <button onClick={() => setQuickMode(!quickMode)} style={{ ...btnSecondary, background: quickMode ? "#ede9fe" : surface2, color: quickMode ? accent : text }}>⚡ Quick Mode {quickMode ? "ON" : "OFF"}</button>
                    <button onClick={saveAttendance} disabled={saving} style={{ ...btnPrimary, background: saved ? "#059669" : accent, opacity: saving ? 0.7 : 1 }}>{saving ? "Saving..." : saved ? "✅ Saved!" : "💾 Save to Firebase"}</button>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: "1rem" }}>
                    {[["✅ All Present", "present", COLORS.present], ["⏰ All Late", "late", COLORS.late], ["❌ All Absent", "absent", COLORS.absent], ["📋 All Excused", "excused", COLORS.excused]].map(([label, status, color]) => (
                      <button key={status} onClick={() => markAll(status)} style={{ padding: "8px", borderRadius: 8, border: `1px solid ${color}40`, background: `${color}18`, color: color, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>{label}</button>
                    ))}
                  </div>

                  <div style={{ display: "flex", gap: 10, marginBottom: "1rem" }}>
                    <input placeholder="🔍 Search student..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                    <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...inputStyle, width: "auto" }}>
                      <option value="all">All</option>
                      <option value="present">Present</option>
                      <option value="late">Late</option>
                      <option value="absent">Absent</option>
                      <option value="excused">Excused</option>
                    </select>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginBottom: "1rem" }}>
                    {[["Total", todayStats.total, accent], ["Present", todayStats.present, COLORS.present], ["Late", todayStats.late, COLORS.late], ["Absent", todayStats.absent, COLORS.absent], ["Excused", todayStats.excused, COLORS.excused]].map(([l, v, c]) => (
                      <div key={l} style={{ background: surface, border: `1px solid ${border}`, borderRadius: 10, padding: "8px 12px", textAlign: "center" }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: c }}>{v}</div>
                        <div style={{ fontSize: 11, color: textMuted }}>{l}</div>
                      </div>
                    ))}
                  </div>

                  {classStudents.length === 0 ? (
                    <div style={{ ...card, textAlign: "center", padding: "2rem" }}>
                      <p style={{ color: textMuted }}>No students in section <strong>{selectedClass?.section}</strong> yet.</p>
                      <button onClick={() => setPage("students")} style={btnPrimary}>Add Students →</button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {filteredStudents.map(student => {
                        const status = todayAttendance[student.id];
                        const rate = getAttendanceRate(student.id);
                        return (
                          <div key={student.id} style={{ background: surface, border: `1.5px solid ${status ? COLORS[status] + "50" : border}`, borderRadius: 14, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, transition: "all 0.15s" }}>
                            <Avatar name={student.name} size={40} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 700, fontSize: 15 }}>{student.name}</div>
                              <div style={{ fontSize: 12, color: textMuted }}>{student.studentId} · {student.section}</div>
                            </div>
                            <div style={{ fontSize: 12, color: rate < 75 ? COLORS.absent : textMuted, fontWeight: rate < 75 ? 700 : 400 }}>{rate}%</div>
                            {quickMode ? (
                              <div style={{ display: "flex", gap: 6 }}>
                                {[["present","✅"], ["late","⏰"], ["absent","❌"], ["excused","📋"]].map(([s, icon]) => (
                                  <button key={s} onClick={() => { setTodayAttendance(prev => ({ ...prev, [student.id]: s })); setSaved(false); }} style={{ width: 34, height: 34, borderRadius: 8, border: `2px solid ${status === s ? COLORS[s] : border}`, background: status === s ? COLORS[s] : "none", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</button>
                                ))}
                              </div>
                            ) : (
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                                {[["present","Present",COLORS.present], ["late","Late",COLORS.late], ["absent","Absent",COLORS.absent], ["excused","Excused",COLORS.excused]].map(([s, label, color]) => (
                                  <button key={s} onClick={() => { setTodayAttendance(prev => ({ ...prev, [student.id]: s })); setSaved(false); }} style={{ padding: "5px 12px", borderRadius: 20, border: `2px solid ${status === s ? color : border}`, background: status === s ? color : "none", color: status === s ? "#fff" : textMuted, cursor: "pointer", fontSize: 12, fontWeight: 700, transition: "all 0.1s" }}>{label}</button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* CLASSES */}
          {page === "classes" && (
            <div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "1rem" }}>
                <button onClick={() => setShowAddClass(!showAddClass)} style={btnPrimary}>+ Add Class</button>
              </div>

              {showAddClass && (
                <div style={{ ...card, background: "#ede9fe", border: `1px solid #c4b5fd`, marginBottom: "1.5rem" }}>
                  <h3 style={{ margin: "0 0 12px", color: accent, fontSize: 15, fontWeight: 700 }}>Create New Class</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    {[["Subject Name", "name", "e.g. Data Structures"], ["Subject Code", "code", "e.g. CS301"], ["Section", "section", "e.g. CS3A"], ["Schedule", "schedule", "e.g. MWF 8:00-9:00 AM"]].map(([label, field, placeholder]) => (
                      <div key={field}>
                        <label style={{ fontSize: 12, color: textMuted, fontWeight: 700, display: "block", marginBottom: 4 }}>{label}</label>
                        <input style={inputStyle} placeholder={placeholder} value={classForm[field]} onChange={e => setClassForm(f => ({ ...f, [field]: e.target.value }))} />
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <button onClick={addClass} style={btnPrimary}>Create Class</button>
                    <button onClick={() => setShowAddClass(false)} style={btnSecondary}>Cancel</button>
                  </div>
                </div>
              )}

              {classes.length === 0
                ? <div style={{ ...card, textAlign: "center", padding: "3rem" }}><p style={{ color: textMuted }}>No classes yet. Create your first class above!</p></div>
                : classes.map(cls => (
                  <div key={cls.id} style={{ ...card, display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 48, height: 48, background: "#ede9fe", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>📚</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>{cls.name}</div>
                      <div style={{ fontSize: 13, color: textMuted }}>{cls.code} · Section {cls.section}</div>
                      <div style={{ fontSize: 12, color: textMuted }}>{cls.schedule}</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontWeight: 800, fontSize: 20, color: accent }}>{students.filter(s => s.section === cls.section).length}</div>
                      <div style={{ fontSize: 11, color: textMuted }}>students</div>
                    </div>
                    <button onClick={() => { setSelectedClass(cls); setPage("attendance"); }} style={btnPrimary}>Take Attendance</button>
                  </div>
                ))
              }
            </div>
          )}

          {/* STUDENTS */}
          {page === "students" && (
            <div>
              <div style={{ display: "flex", gap: 12, marginBottom: "1.5rem", alignItems: "center" }}>
                <input placeholder="🔍 Search students..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                <button onClick={() => setShowAddStudent(!showAddStudent)} style={btnPrimary}>+ Add Student</button>
              </div>

              {showAddStudent && (
                <div style={{ ...card, background: "#ede9fe", border: `1px solid #c4b5fd`, marginBottom: "1.5rem" }}>
                  <h3 style={{ margin: "0 0 12px", color: accent, fontSize: 15, fontWeight: 700 }}>Add New Student</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    {[["Full Name","name","Maria Santos"], ["Student ID","studentId","2024-001"], ["Course","course","BS Computer Science"], ["Section","section","CS3A"], ["Email","email","m.santos@college.edu"]].map(([label, field, placeholder]) => (
                      <div key={field}>
                        <label style={{ fontSize: 12, color: textMuted, fontWeight: 700, display: "block", marginBottom: 4 }}>{label}</label>
                        <input style={inputStyle} placeholder={placeholder} value={studentForm[field]} onChange={e => setStudentForm(f => ({ ...f, [field]: e.target.value }))} />
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <button onClick={addStudent} style={btnPrimary}>Add Student</button>
                    <button onClick={() => setShowAddStudent(false)} style={btnSecondary}>Cancel</button>
                  </div>
                </div>
              )}

              {students.filter(s => s.name?.toLowerCase().includes(searchQuery.toLowerCase()) || s.studentId?.includes(searchQuery)).map(student => {
                const rate = getAttendanceRate(student.id);
                return (
                  <div key={student.id} style={{ ...card, marginBottom: 10, display: "flex", alignItems: "center", gap: 12 }}>
                    <Avatar name={student.name} size={44} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{student.name}</div>
                      <div style={{ fontSize: 12, color: textMuted }}>{student.studentId} · {student.course}</div>
                      <div style={{ fontSize: 12, color: textMuted }}>Section: {student.section} · {student.email}</div>
                    </div>
                    <div style={{ textAlign: "center", minWidth: 56 }}>
                      <div style={{ fontWeight: 800, fontSize: 20, color: rate >= 75 ? COLORS.present : COLORS.absent }}>{rate}%</div>
                      <div style={{ fontSize: 11, color: textMuted }}>attendance</div>
                    </div>
                    {rate < 75 && <span style={{ background: COLORS.absentBg, color: "#991b1b", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>⚠️ At Risk</span>}
                    <button onClick={() => deleteStudent(student.id)} style={{ background: "#fee2e2", color: "#991b1b", border: "none", borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Remove</button>
                  </div>
                );
              })}
              {students.length === 0 && <div style={{ ...card, textAlign: "center", padding: "3rem" }}><p style={{ color: textMuted }}>No students yet. Add your first student above!</p></div>}
            </div>
          )}

          {/* REPORTS */}
          {page === "reports" && (
            <div>
              <div style={card}>
                <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700 }}>Generate Reports</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: "1.5rem" }}>
                  {[
                    { title: "Daily Report", desc: "Attendance for a specific date", icon: "📅" },
                    { title: "Weekly Report", desc: "7-day attendance summary", icon: "📆" },
                    { title: "Monthly Report", desc: "Full monthly breakdown", icon: "🗓️" },
                    { title: "Student Summary", desc: "Individual attendance records", icon: "👤" },
                  ].map((r, i) => (
                    <div key={i} style={{ background: surface2, borderRadius: 12, padding: "1rem", border: `1px solid ${border}` }}>
                      <div style={{ fontSize: 28, marginBottom: 6 }}>{r.icon}</div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{r.title}</div>
                      <div style={{ fontSize: 12, color: textMuted, marginBottom: 10 }}>{r.desc}</div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => notify(`${r.title} PDF generated!`)} style={{ ...btnPrimary, padding: "6px 12px", fontSize: 12 }}>📄 PDF</button>
                        <button onClick={() => notify(`${r.title} Excel generated!`)} style={{ ...btnSecondary, padding: "6px 12px", fontSize: 12 }}>📊 Excel</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={card}>
                <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700 }}>Student Attendance Summary</h3>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: `2px solid ${border}` }}>
                        {["Student", "ID", "Section", "Present", "Late", "Absent", "Excused", "Rate"].map(h => (
                          <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: textMuted, fontWeight: 700 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {students.map(s => {
                        const allDates = Object.keys(attendanceRecords);
                        const counts = { present: 0, late: 0, absent: 0, excused: 0 };
                        allDates.forEach(d => { const v = attendanceRecords[d]?.[s.id]; if (v) counts[v]++; });
                        const rate = getAttendanceRate(s.id);
                        return (
                          <tr key={s.id} style={{ borderBottom: `1px solid ${border}` }}>
                            <td style={{ padding: "10px 12px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <Avatar name={s.name} size={28} />
                                <span style={{ fontWeight: 600 }}>{s.name}</span>
                              </div>
                            </td>
                            <td style={{ padding: "10px 12px", color: textMuted }}>{s.studentId}</td>
                            <td style={{ padding: "10px 12px" }}>{s.section}</td>
                            <td style={{ padding: "10px 12px", color: "#166534", fontWeight: 600 }}>{counts.present}</td>
                            <td style={{ padding: "10px 12px", color: "#92400e", fontWeight: 600 }}>{counts.late}</td>
                            <td style={{ padding: "10px 12px", color: "#991b1b", fontWeight: 600 }}>{counts.absent}</td>
                            <td style={{ padding: "10px 12px", color: "#1e40af", fontWeight: 600 }}>{counts.excused}</td>
                            <td style={{ padding: "10px 12px" }}>
                              <span style={{ fontWeight: 800, color: rate >= 75 ? COLORS.present : COLORS.absent }}>{rate}%</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {students.length === 0 && <p style={{ textAlign: "center", color: textMuted, padding: "2rem" }}>No student data yet.</p>}
                </div>
              </div>
            </div>
          )}

          {/* SETTINGS */}
          {page === "settings" && (
            <div>
              <div style={card}>
                <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700 }}>Account</h3>
                <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 0", borderBottom: `1px solid ${border}` }}>
                  <Avatar name={user.name} size={52} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 17 }}>{user.name}</div>
                    <div style={{ color: textMuted, fontSize: 13 }}>{user.email}</div>
                    <span style={{ background: "#ede9fe", color: accent, borderRadius: 6, padding: "2px 8px", fontSize: 12, fontWeight: 700 }}>Teacher</span>
                  </div>
                </div>
              </div>
              <div style={card}>
                <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700 }}>Appearance</h3>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div><div style={{ fontWeight: 600 }}>Dark Mode</div><div style={{ fontSize: 12, color: textMuted }}>Toggle dark/light theme</div></div>
                  <button onClick={() => setDark(!dark)} style={{ width: 48, height: 26, borderRadius: 13, background: dark ? accent : surface2, border: `1px solid ${border}`, cursor: "pointer", position: "relative" }}>
                    <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: dark ? 24 : 3, transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }} />
                  </button>
                </div>
              </div>
              <div style={card}>
                <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700 }}>Firebase Status</h3>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: COLORS.present }} />
                  <span style={{ fontSize: 14, color: textMuted }}>Connected to Firebase — edutrak-f6e7b</span>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
