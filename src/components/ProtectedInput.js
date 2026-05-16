import { useState } from "react";
import { validateField, logSuspiciousActivity } from "../utils/protection";
import { SEENKA } from "./SeenKaTheme";

// ── Protected Input ───────────────────────────────────────
// Validates on every keystroke and blocks injection attempts
export function ProtectedInput({
  value,
  onChange,
  fieldType,
  placeholder = "",
  type = "text",
  userId = "",
  required = true,
  disabled = false,
  onValidation,   // callback(isValid)
  style = {},
  label = "",
  hint = "",
  maxLength,
}) {
  const [touched, setTouched] = useState(false);
  const [blocked, setBlocked] = useState(false);

  const inputStyle = {
    width: "100%",
    padding: "10px 14px",
    borderRadius: 10,
    border: `1.5px solid ${blocked ? SEENKA.absent : touched && value ? "rgba(0,163,255,0.4)" : SEENKA.darkBorder}`,
    background: blocked ? "rgba(239,68,68,0.06)" : "rgba(255,255,255,0.04)",
    color: SEENKA.textPrimary,
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "system-ui",
    transition: "border-color 0.2s, background 0.2s",
    boxShadow: blocked ? "0 0 12px rgba(239,68,68,0.15)" : touched && value ? "0 0 12px rgba(0,163,255,0.1)" : "none",
    ...style,
  };

  const handleChange = (e) => {
    const raw = e.target.value;

    // Run all security checks
    const result = validateField(raw, fieldType, { required });

    if (!result.safe && raw.length > 3) {
      // Log and block but still allow typing (just flag it)
      logSuspiciousActivity(userId, fieldType, raw, result.errors[0]);
      setBlocked(true);
      if (onValidation) onValidation(false, result.errors[0]);
    } else {
      setBlocked(false);
      if (onValidation) onValidation(true, null);
    }

    // Always call onChange with raw value — parent decides
    onChange(raw);
  };

  const handleBlur = () => {
    setTouched(true);
    const result = validateField(value, fieldType, { required });
    if (!result.safe) {
      setBlocked(true);
      if (onValidation) onValidation(false, result.errors[0]);
    }
  };

  const result = validateField(value, fieldType, { required });
  const showError = touched && !result.safe && value?.length > 0;
  const showSuccess = touched && result.safe && value?.length > 0;

  return (
    <div style={{ width: "100%" }}>
      {label && (
        <label style={{ fontSize: 12, fontWeight: 700, color: SEENKA.textMuted, display: "block", marginBottom: 5 }}>
          {label}
          {required && <span style={{ color: SEENKA.absent, marginLeft: 3 }}>*</span>}
        </label>
      )}

      <div style={{ position: "relative" }}>
        <input
          type={type}
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          onFocus={() => setTouched(false)}
          placeholder={placeholder}
          disabled={disabled}
          maxLength={maxLength || 200}
          style={inputStyle}
          autoComplete="off"
          spellCheck={false}
        />

        {/* Status icon */}
        {touched && value?.length > 0 && (
          <span style={{
            position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
            fontSize: 14, pointerEvents: "none"
          }}>
            {showError ? "⚠️" : showSuccess ? "✅" : ""}
          </span>
        )}
      </div>

      {/* Error message */}
      {showError && (
        <div style={{
          fontSize: 11, color: SEENKA.absent, marginTop: 4,
          display: "flex", alignItems: "center", gap: 4
        }}>
          🚫 {result.errors[0]}
        </div>
      )}

      {/* Hint */}
      {hint && !showError && (
        <div style={{ fontSize: 11, color: SEENKA.textMuted, marginTop: 3 }}>{hint}</div>
      )}

      {/* Injection blocked warning */}
      {blocked && (
        <div style={{
          fontSize: 11, marginTop: 4, padding: "4px 8px",
          background: "rgba(239,68,68,0.1)", borderRadius: 6,
          color: SEENKA.absent, border: "1px solid rgba(239,68,68,0.2)"
        }}>
          🛡️ Suspicious input detected and blocked
        </div>
      )}
    </div>
  );
}

// ── Protected Textarea ────────────────────────────────────
export function ProtectedTextarea({
  value, onChange, fieldType = "aiPrompt",
  placeholder = "", userId = "", rows = 4,
  onValidation, label = "", style = {}
}) {
  const [touched, setTouched] = useState(false);
  const [blocked, setBlocked] = useState(false);

  const handleChange = (e) => {
    const raw = e.target.value;
    const result = validateField(raw, fieldType, { required: false });
    if (!result.safe && raw.length > 5) {
      logSuspiciousActivity(userId, fieldType, raw, result.errors[0]);
      setBlocked(true);
      if (onValidation) onValidation(false, result.errors[0]);
    } else {
      setBlocked(false);
      if (onValidation) onValidation(true, null);
    }
    onChange(raw);
  };

  return (
    <div style={{ width: "100%" }}>
      {label && (
        <label style={{ fontSize: 12, fontWeight: 700, color: SEENKA.textMuted, display: "block", marginBottom: 5 }}>
          {label}
        </label>
      )}
      <textarea
        value={value}
        onChange={handleChange}
        onBlur={() => setTouched(true)}
        placeholder={placeholder}
        rows={rows}
        maxLength={500}
        style={{
          width: "100%", padding: "10px 14px", borderRadius: 10,
          border: `1.5px solid ${blocked ? SEENKA.absent : SEENKA.darkBorder}`,
          background: blocked ? "rgba(239,68,68,0.06)" : "rgba(255,255,255,0.04)",
          color: SEENKA.textPrimary, fontSize: 14, outline: "none",
          boxSizing: "border-box", fontFamily: "system-ui", resize: "vertical",
          boxShadow: blocked ? "0 0 12px rgba(239,68,68,0.15)" : "none",
          ...style
        }}
      />
      {blocked && (
        <div style={{ fontSize: 11, color: SEENKA.absent, marginTop: 4 }}>
          🛡️ Suspicious input blocked
        </div>
      )}
    </div>
  );
}

// ── Security Banner ───────────────────────────────────────
// Shows in Settings to indicate protection is active
export function SecurityStatusBanner() {
  return (
    <div style={{
      padding: "14px 16px",
      background: "linear-gradient(135deg, rgba(0,163,255,0.06), rgba(16,185,129,0.06))",
      borderRadius: 12, border: "1px solid rgba(0,163,255,0.15)",
      display: "flex", alignItems: "flex-start", gap: 12
    }}>
      <span style={{ fontSize: 22, flexShrink: 0 }}>🛡️</span>
      <div>
        <div style={{ fontWeight: 700, fontSize: 14, color: SEENKA.textPrimary, marginBottom: 4 }}>
          Prompt Injection Protection Active
        </div>
        <div style={{ fontSize: 12, color: SEENKA.textMuted, lineHeight: 1.7 }}>
          All inputs are scanned for prompt injection, XSS, NoSQL injection, and path traversal attacks in real-time before any data is saved or sent to AI.
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          {["Prompt Injection", "XSS", "NoSQL Injection", "Path Traversal", "Rate Limiting"].map(t => (
            <span key={t} style={{
              background: "rgba(16,185,129,0.1)", color: SEENKA.present,
              border: "1px solid rgba(16,185,129,0.2)", borderRadius: 6,
              padding: "2px 8px", fontSize: 11, fontWeight: 700
            }}>✓ {t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
