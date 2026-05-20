// ============================================================
// SeenKa - Class Join Code System
// Teachers get a unique 6-char code per class
// Students enter the code on signup to auto-join
// ============================================================

// Generate a random 6-character alphanumeric join code
export function generateJoinCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no confusable chars (0,O,1,I)
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// Format code for display: ABC123 → ABC-123
export function formatJoinCode(code) {
  if (!code) return "";
  const clean = code.replace(/[-\s]/g, "").toUpperCase();
  return clean.length >= 3 ? `${clean.slice(0, 3)}-${clean.slice(3)}` : clean;
}

// Strip formatting for storage/lookup
export function normalizeJoinCode(code) {
  return (code || "").replace(/[-\s]/g, "").toUpperCase().trim();
}
