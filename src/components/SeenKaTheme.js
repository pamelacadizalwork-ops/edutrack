// SeenKa Brand Theme
export const SEENKA = {
  // Core colors
  electricBlue: "#00A3FF",
  neonPurple: "#A855F7",
  cyan: "#06B6D4",
  darkNav: "#0A0F1E",
  darkCard: "#111827",
  darkCardElevated: "#1a2236",
  darkBorder: "#1e2d45",
  darkBorder2: "#243352",
  textPrimary: "#F0F4FF",
  textMuted: "#6B8DB5",
  textDim: "#3D5A80",

  // Gradients
  gradientPrimary: "linear-gradient(135deg, #00A3FF, #A855F7)",
  gradientBlue: "linear-gradient(135deg, #00A3FF, #0066CC)",
  gradientPurple: "linear-gradient(135deg, #A855F7, #7C3AED)",
  gradientCyan: "linear-gradient(135deg, #06B6D4, #00A3FF)",
  gradientCard: "linear-gradient(135deg, rgba(0,163,255,0.08), rgba(168,85,247,0.08))",
  gradientGlow: "linear-gradient(135deg, rgba(0,163,255,0.15), rgba(168,85,247,0.15))",

  // Status colors
  present: "#10B981",
  late: "#F59E0B",
  absent: "#EF4444",
  excused: "#00A3FF",
  presentBg: "rgba(16,185,129,0.15)",
  lateBg: "rgba(245,158,11,0.15)",
  absentBg: "rgba(239,68,68,0.15)",
  excusedBg: "rgba(0,163,255,0.15)",

  // Shadows / glows
  glowBlue: "0 0 20px rgba(0,163,255,0.25)",
  glowPurple: "0 0 20px rgba(168,85,247,0.25)",
  glowGreen: "0 0 15px rgba(16,185,129,0.2)",
  shadowCard: "0 4px 24px rgba(0,0,0,0.4)",
  shadowButton: "0 4px 16px rgba(0,163,255,0.35)",
};

// SeenKa Logo SVG (inline)
export function SeenKaLogo({ size = 36, showText = false, textSize = 20 }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="sk-grad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#A855F7" />
            <stop offset="100%" stopColor="#00A3FF" />
          </linearGradient>
        </defs>
        {/* S-shape arrows */}
        <path d="M8 30 L16 22 L24 28 L32 12" stroke="url(#sk-grad)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        <path d="M8 22 L16 14 L24 20 L32 4" stroke="url(#sk-grad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.5"/>
        {/* Arrow head */}
        <path d="M26 4 L32 4 L32 10" stroke="url(#sk-grad)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        {/* Sound waves */}
        <circle cx="20" cy="24" r="2" fill="#00A3FF" opacity="0.8"/>
        <path d="M17 21 Q20 18 23 21" stroke="#00A3FF" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.6"/>
        <path d="M15 19 Q20 14 25 19" stroke="#A855F7" strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.4"/>
      </svg>
      {showText && (
        <span style={{ fontWeight: 800, fontSize: textSize, background: "linear-gradient(135deg, #00A3FF, #A855F7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", letterSpacing: "-0.5px" }}>
          SeenKa
        </span>
      )}
    </div>
  );
}

// Gradient button
export function GradientButton({ onClick, children, disabled, style = {}, variant = "primary" }) {
  const bg = variant === "danger" ? "linear-gradient(135deg, #EF4444, #DC2626)"
    : variant === "purple" ? "linear-gradient(135deg, #A855F7, #7C3AED)"
    : variant === "success" ? "linear-gradient(135deg, #10B981, #059669)"
    : "linear-gradient(135deg, #00A3FF, #A855F7)";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: disabled ? "#1e2d45" : bg,
        color: disabled ? "#3D5A80" : "#fff",
        border: "none", borderRadius: 10, padding: "10px 20px",
        cursor: disabled ? "not-allowed" : "pointer",
        fontWeight: 700, fontSize: 13,
        boxShadow: disabled ? "none" : "0 4px 16px rgba(0,163,255,0.3)",
        transition: "all 0.2s", ...style
      }}
    >
      {children}
    </button>
  );
}

// Glass card
export function GlassCard({ children, style = {}, glow = false }) {
  return (
    <div style={{
      background: "rgba(17,24,39,0.85)",
      backdropFilter: "blur(12px)",
      border: `1px solid ${glow ? "rgba(0,163,255,0.3)" : "#1e2d45"}`,
      borderRadius: 16,
      padding: "1.25rem",
      boxShadow: glow ? "0 0 30px rgba(0,163,255,0.1), 0 4px 24px rgba(0,0,0,0.4)" : "0 4px 24px rgba(0,0,0,0.3)",
      marginBottom: "1rem",
      ...style
    }}>
      {children}
    </div>
  );
}

// Status badge
export function StatusBadge({ status }) {
  const cfg = {
    present: { bg: "rgba(16,185,129,0.15)", color: "#10B981", border: "rgba(16,185,129,0.3)", label: "Present", dot: "#10B981" },
    late: { bg: "rgba(245,158,11,0.15)", color: "#F59E0B", border: "rgba(245,158,11,0.3)", label: "Late", dot: "#F59E0B" },
    absent: { bg: "rgba(239,68,68,0.15)", color: "#EF4444", border: "rgba(239,68,68,0.3)", label: "Absent", dot: "#EF4444" },
    excused: { bg: "rgba(0,163,255,0.15)", color: "#00A3FF", border: "rgba(0,163,255,0.3)", label: "Excused", dot: "#00A3FF" },
  };
  const c = cfg[status] || { bg: "rgba(107,141,181,0.15)", color: "#6B8DB5", border: "rgba(107,141,181,0.3)", label: "—", dot: "#6B8DB5" };
  return (
    <span style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}`, borderRadius: 999, padding: "3px 12px", fontSize: 12, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.dot, display: "inline-block", boxShadow: `0 0 6px ${c.dot}` }} />
      {c.label}
    </span>
  );
}

// Stat card
export function StatCard({ icon, label, value, color, glow }) {
  return (
    <div style={{
      background: "rgba(17,24,39,0.9)", border: `1px solid ${glow ? color + "40" : "#1e2d45"}`,
      borderRadius: 16, padding: "1.1rem",
      boxShadow: glow ? `0 0 20px ${color}20` : "0 4px 16px rgba(0,0,0,0.3)"
    }}>
      <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 26, fontWeight: 900, color, marginBottom: 2, letterSpacing: "-1px" }}>{value}</div>
      <div style={{ fontSize: 12, color: "#6B8DB5", fontWeight: 500 }}>{label}</div>
    </div>
  );
}
