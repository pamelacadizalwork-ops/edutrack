// ============================================================
// SeenKa - Prompt Injection Protection Module
// Protects all user inputs from:
//   1. Prompt injection attacks (AI manipulation)
//   2. XSS (Cross-Site Scripting)
//   3. SQL/NoSQL injection patterns
//   4. Command injection
//   5. Path traversal
//   6. Malicious Unicode / homoglyph attacks
//   7. Excessive input abuse
// ============================================================

// ── KNOWN INJECTION PATTERNS ──────────────────────────────
const PROMPT_INJECTION_PATTERNS = [
  // Direct instruction overrides
  /ignore\s+(previous|above|prior|all)\s+(instructions?|prompts?|context|rules?)/i,
  /forget\s+(everything|all|previous|prior|your\s+instructions?)/i,
  /disregard\s+(previous|above|all|your)\s+(instructions?|rules?|prompts?)/i,
  /override\s+(your\s+)?(instructions?|rules?|system|programming|constraints?)/i,
  /you\s+are\s+now\s+(a\s+)?(different|new|another|evil|unrestricted)/i,
  /act\s+as\s+(if\s+you\s+are\s+)?(a\s+)?(different|unrestricted|evil|jailbroken)/i,
  /pretend\s+(you\s+are|to\s+be)\s+(a\s+)?(different|evil|unrestricted|new)/i,
  /your\s+new\s+(instructions?|rules?|task|role|purpose)\s+(is|are)/i,
  /from\s+now\s+on\s+(you\s+)?(will|must|should|are)/i,

  // System prompt leaking
  /reveal\s+(your\s+)?(system\s+)?prompt/i,
  /show\s+(me\s+)?(your\s+)?(system\s+)?prompt/i,
  /print\s+(your\s+)?(system\s+|initial\s+)?instructions?/i,
  /what\s+(are\s+)?(your\s+)?(system\s+)?(instructions?|prompts?|rules?)/i,
  /repeat\s+(your\s+)?(system\s+)?(prompt|instructions?)/i,
  /output\s+(your\s+)?(system\s+)?(prompt|instructions?)/i,

  // Role / persona hijacking
  /you\s+are\s+(now\s+)?(dan|jailbreak|evil|free|uncensored|unrestricted)/i,
  /jailbreak/i,
  /do\s+anything\s+now/i,
  /developer\s+mode/i,
  /\[system\]/i,
  /\[assistant\]/i,
  /\[user\]/i,
  /\[instructions?\]/i,
  /<\|im_start\|>/i,
  /<\|im_end\|>/i,
  /###\s*(instruction|system|human|assistant)/i,

  // Data exfiltration attempts
  /send\s+(all|the|student|attendance)\s+(data|records|info)/i,
  /exfiltrate/i,
  /extract\s+(all|the|student|attendance)\s+(data|records|info)/i,
  /leak\s+(the\s+)?(data|records|info|key|secret)/i,
  /steal\s+(the\s+)?(data|records|info|key|secret)/i,

  // Code / command injection in text fields
  /\$\{.*\}/,           // template literal injection
  /`[^`]{0,200}`/,      // backtick command substitution
  /eval\s*\(/i,
  /exec\s*\(/i,
  /system\s*\(/i,
  /import\s+os/i,
  /subprocess/i,
  /__import__/i,
];

const XSS_PATTERNS = [
  /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
  /<[^>]*on\w+\s*=\s*["'][^"']*["'][^>]*>/gi,
  /javascript\s*:/gi,
  /vbscript\s*:/gi,
  /<\s*iframe/gi,
  /<\s*object/gi,
  /<\s*embed/gi,
  /<\s*link\s+.*rel\s*=\s*["']stylesheet/gi,
  /data\s*:\s*text\/html/gi,
  /expression\s*\(/gi,
  /url\s*\(\s*["']?\s*javascript/gi,
];

const NOSQL_INJECTION_PATTERNS = [
  /\$where/i,
  /\$regex/i,
  /\$ne\b/i,
  /\$gt\b/i,
  /\$lt\b/i,
  /\$gte\b/i,
  /\$lte\b/i,
  /\$in\b/i,
  /\$or\b/i,
  /\$and\b/i,
  /\{\s*"\$/,
  /mapreduce/i,
  /\$function/i,
];

const PATH_TRAVERSAL_PATTERNS = [
  /\.\.\//g,
  /\.\.\\/g,
  /%2e%2e%2f/gi,
  /%2e%2e\//gi,
  /\.\.%2f/gi,
  /\/etc\/passwd/i,
  /\/etc\/shadow/i,
  /\/windows\/system32/i,
];

// ── FIELD LIMITS ──────────────────────────────────────────
export const FIELD_LIMITS = {
  name:      { min: 2, max: 80,  label: "Name" },
  studentId: { min: 3, max: 30,  label: "Student ID" },
  email:     { min: 5, max: 100, label: "Email" },
  course:    { min: 2, max: 100, label: "Course" },
  section:   { min: 1, max: 20,  label: "Section" },
  schedule:  { min: 3, max: 80,  label: "Schedule" },
  code:      { min: 2, max: 20,  label: "Subject Code" },
  subjectName: { min: 2, max: 100, label: "Subject Name" },
  password:  { min: 6, max: 128, label: "Password" },
  aiPrompt:  { min: 1, max: 500, label: "AI Prompt" },
};

// ── ALLOWED CHARACTER SETS ────────────────────────────────
const ALLOWED_PATTERNS = {
  name:      /^[a-zA-ZÀ-ÖØ-öø-ÿ\s\-'.]+$/,
  studentId: /^[a-zA-Z0-9\-_]+$/,
  email:     /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  section:   /^[a-zA-Z0-9\-_\s]+$/,
  code:      /^[a-zA-Z0-9\-_\s]+$/,
  schedule:  /^[a-zA-Z0-9\s\-:.,\/]+$/,
};

// ── SANITIZE: strip dangerous HTML/JS ────────────────────
export function sanitizeHTML(input) {
  if (typeof input !== "string") return "";
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}

// ── SANITIZE: strip to plain safe text ───────────────────
export function sanitizeText(input) {
  if (typeof input !== "string") return "";
  return input
    .replace(/<[^>]*>/g, "")           // strip HTML tags
    .replace(/[<>{}[\]\\]/g, "")       // strip dangerous chars
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "") // strip control chars
    .trim();
}

// ── DETECT: prompt injection ─────────────────────────────
export function detectPromptInjection(input) {
  if (!input || typeof input !== "string") return { safe: true };
  const lower = input.toLowerCase();
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      return { safe: false, reason: "prompt_injection", pattern: pattern.toString() };
    }
  }
  return { safe: true };
}

// ── DETECT: XSS ──────────────────────────────────────────
export function detectXSS(input) {
  if (!input || typeof input !== "string") return { safe: true };
  for (const pattern of XSS_PATTERNS) {
    if (pattern.test(input)) {
      return { safe: false, reason: "xss" };
    }
  }
  return { safe: true };
}

// ── DETECT: NoSQL injection ───────────────────────────────
export function detectNoSQLInjection(input) {
  if (!input || typeof input !== "string") return { safe: true };
  for (const pattern of NOSQL_INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      return { safe: false, reason: "nosql_injection" };
    }
  }
  return { safe: true };
}

// ── DETECT: Path traversal ────────────────────────────────
export function detectPathTraversal(input) {
  if (!input || typeof input !== "string") return { safe: true };
  for (const pattern of PATH_TRAVERSAL_PATTERNS) {
    if (pattern.test(input)) {
      return { safe: false, reason: "path_traversal" };
    }
  }
  return { safe: true };
}

// ── VALIDATE: field length ────────────────────────────────
export function validateLength(input, fieldType) {
  const limits = FIELD_LIMITS[fieldType];
  if (!limits) return { valid: true };
  if (!input || input.trim().length < limits.min) {
    return { valid: false, error: `${limits.label} must be at least ${limits.min} characters` };
  }
  if (input.trim().length > limits.max) {
    return { valid: false, error: `${limits.label} must be under ${limits.max} characters` };
  }
  return { valid: true };
}

// ── VALIDATE: character set ───────────────────────────────
export function validateCharset(input, fieldType) {
  const pattern = ALLOWED_PATTERNS[fieldType];
  if (!pattern) return { valid: true };
  if (!pattern.test(input.trim())) {
    return { valid: false, error: `${fieldType} contains invalid characters` };
  }
  return { valid: true };
}

// ── MASTER VALIDATOR ─────────────────────────────────────
// Run all checks on a single field value
export function validateField(value, fieldType, options = {}) {
  const errors = [];

  if (!value || String(value).trim() === "") {
    if (options.required !== false) {
      errors.push(`${FIELD_LIMITS[fieldType]?.label || fieldType} is required`);
    }
    return { safe: errors.length === 0, errors };
  }

  const str = String(value);

  // 1. Prompt injection
  const piCheck = detectPromptInjection(str);
  if (!piCheck.safe) errors.push("⚠️ Invalid input detected");

  // 2. XSS
  const xssCheck = detectXSS(str);
  if (!xssCheck.safe) errors.push("⚠️ Unsafe content detected");

  // 3. NoSQL injection
  const nosqlCheck = detectNoSQLInjection(str);
  if (!nosqlCheck.safe) errors.push("⚠️ Invalid characters detected");

  // 4. Path traversal
  const pathCheck = detectPathTraversal(str);
  if (!pathCheck.safe) errors.push("⚠️ Invalid input detected");

  // 5. Length check
  if (fieldType && FIELD_LIMITS[fieldType]) {
    const lenCheck = validateLength(str, fieldType);
    if (!lenCheck.valid) errors.push(lenCheck.error);
  }

  return { safe: errors.length === 0, errors, sanitized: sanitizeText(str) };
}

// ── VALIDATE ENTIRE FORM OBJECT ───────────────────────────
export function validateForm(formData, fieldTypes) {
  const allErrors = {};
  let formSafe = true;

  Object.entries(formData).forEach(([key, value]) => {
    const fieldType = fieldTypes[key] || key;
    const result = validateField(value, fieldType);
    if (!result.safe) {
      allErrors[key] = result.errors[0];
      formSafe = false;
    }
  });

  return { safe: formSafe, errors: allErrors };
}

// ── SANITIZE AI PROMPT ────────────────────────────────────
// Wraps user-influenced data going into AI calls safely
export function sanitizeForAI(data) {
  if (typeof data === "string") {
    // Strip any injection attempts before sending to Claude API
    const clean = sanitizeText(data);
    const check = detectPromptInjection(clean);
    if (!check.safe) return "[REDACTED - unsafe content]";
    // Limit length
    return clean.slice(0, FIELD_LIMITS.aiPrompt.max);
  }
  if (typeof data === "object" && data !== null) {
    const safe = {};
    for (const [k, v] of Object.entries(data)) {
      safe[k] = sanitizeForAI(v);
    }
    return safe;
  }
  return data;
}

// ── RATE LIMITING (in-memory, per session) ────────────────
const rateLimitStore = {};
export function checkRateLimit(key, maxAttempts = 5, windowMs = 60000) {
  const now = Date.now();
  if (!rateLimitStore[key]) rateLimitStore[key] = [];
  // Clear old entries
  rateLimitStore[key] = rateLimitStore[key].filter(t => now - t < windowMs);
  if (rateLimitStore[key].length >= maxAttempts) {
    return { allowed: false, retryAfter: Math.ceil((rateLimitStore[key][0] + windowMs - now) / 1000) };
  }
  rateLimitStore[key].push(now);
  return { allowed: true };
}

// ── LOG SUSPICIOUS ACTIVITY ───────────────────────────────
export function logSuspiciousActivity(userId, field, value, reason) {
  console.warn(`[SeenKa Security] Suspicious input blocked:`, {
    userId: userId || "anonymous",
    field,
    reason,
    timestamp: new Date().toISOString(),
    valuePreview: String(value).slice(0, 50) + "...",
  });
}
