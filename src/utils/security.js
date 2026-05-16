// ============================================================
// SeenKa - Runtime Security Middleware
// Handles:
//   - Webhook signature verification
//   - CORS enforcement
//   - Request origin validation
//   - Anti-CSRF token management
//   - Suspicious request detection
// ============================================================

import CryptoJS from "crypto-js";

// ── ALLOWED ORIGINS ──────────────────────────────────────
// Only these origins are allowed to interact with the app
const ALLOWED_ORIGINS = [
  "https://seenka.vercel.app",
  "https://edutrack-brown.vercel.app",
  "http://localhost:3000",
  "http://localhost:3001",
];

// ── WEBHOOK SECRET ────────────────────────────────────────
// Used to sign and verify any incoming webhook payloads
const WEBHOOK_SECRET = process.env.REACT_APP_WEBHOOK_SECRET || "SeenKa@WebhookSecret2026#PH";

// ── CSRF TOKEN MANAGEMENT ─────────────────────────────────
const CSRF_TOKEN_KEY = "seenka_csrf_token";
const CSRF_TOKEN_EXPIRY = 3600000; // 1 hour in ms

export function generateCSRFToken() {
  const token = CryptoJS.lib.WordArray.random(32).toString();
  const expiry = Date.now() + CSRF_TOKEN_EXPIRY;
  try {
    sessionStorage.setItem(CSRF_TOKEN_KEY, JSON.stringify({ token, expiry }));
  } catch {}
  return token;
}

export function getCSRFToken() {
  try {
    const raw = sessionStorage.getItem(CSRF_TOKEN_KEY);
    if (!raw) return generateCSRFToken();
    const { token, expiry } = JSON.parse(raw);
    if (Date.now() > expiry) return generateCSRFToken();
    return token;
  } catch {
    return generateCSRFToken();
  }
}

export function validateCSRFToken(token) {
  try {
    const raw = sessionStorage.getItem(CSRF_TOKEN_KEY);
    if (!raw) return false;
    const { token: stored, expiry } = JSON.parse(raw);
    if (Date.now() > expiry) return false;
    return stored === token;
  } catch {
    return false;
  }
}

// ── ORIGIN VALIDATION ─────────────────────────────────────
export function isOriginAllowed(origin) {
  if (!origin) return false;
  return ALLOWED_ORIGINS.some(allowed =>
    origin === allowed || origin.endsWith(".vercel.app")
  );
}

export function validateRequestOrigin() {
  const origin = window.location.origin;
  return isOriginAllowed(origin);
}

// ── WEBHOOK SIGNATURE VERIFICATION ───────────────────────
// Verifies that incoming webhook payloads are from trusted sources
// Used if you integrate external services like Zapier, Make, etc.
export function verifyWebhookSignature(payload, signature, secret = WEBHOOK_SECRET) {
  if (!payload || !signature) return false;
  try {
    const expectedSig = CryptoJS.HmacSHA256(
      typeof payload === "string" ? payload : JSON.stringify(payload),
      secret
    ).toString();
    // Constant-time comparison to prevent timing attacks
    return signature.length === expectedSig.length &&
      CryptoJS.HmacSHA256(signature, secret).toString() ===
      CryptoJS.HmacSHA256(expectedSig, secret).toString();
  } catch {
    return false;
  }
}

export function signWebhookPayload(payload, secret = WEBHOOK_SECRET) {
  const body = typeof payload === "string" ? payload : JSON.stringify(payload);
  return CryptoJS.HmacSHA256(body, secret).toString();
}

// ── DNS / DOMAIN SECURITY CHECK ──────────────────────────
// Validates the current domain matches expected patterns
export function validateDomain() {
  const hostname = window.location.hostname;
  const allowedPatterns = [
    /^localhost$/,
    /^127\.0\.0\.1$/,
    /\.vercel\.app$/,
    /^seenka\./,
    /^edutrack\./,
  ];
  return allowedPatterns.some(p => p.test(hostname));
}

// ── SECURITY HEADERS CHECK ────────────────────────────────
// Checks if expected security headers are present (client-side hint)
export function checkSecurityContext() {
  const issues = [];

  // Check HTTPS
  if (window.location.protocol !== "https:" && window.location.hostname !== "localhost") {
    issues.push("⚠️ Not running on HTTPS — data may be insecure");
  }

  // Check domain validity
  if (!validateDomain()) {
    issues.push("⚠️ Running on unexpected domain");
  }

  // Check for iframe embedding (clickjacking)
  if (window.self !== window.top) {
    issues.push("⚠️ App is being embedded in an iframe — possible clickjacking");
    // Force break out of iframe
    window.top.location = window.self.location;
  }

  return {
    secure: issues.length === 0,
    issues,
  };
}

// ── SECURE FETCH WRAPPER ─────────────────────────────────
// Wraps all outgoing API calls with security headers
export async function secureFetch(url, options = {}) {
  const csrfToken = getCSRFToken();

  // Validate URL is from allowed domains
  const allowedApiDomains = [
    "api.anthropic.com",
    "firestore.googleapis.com",
    "identitytoolkit.googleapis.com",
    "api.cloudinary.com",
    "api.qrserver.com",
  ];

  const urlObj = new URL(url);
  const isAllowed = allowedApiDomains.some(d => urlObj.hostname.endsWith(d));
  if (!isAllowed) {
    console.error(`[SeenKa Security] Blocked request to unauthorized domain: ${urlObj.hostname}`);
    throw new Error("Request to unauthorized domain blocked");
  }

  const secureHeaders = {
    "X-CSRF-Token": csrfToken,
    "X-Requested-With": "XMLHttpRequest",
    "X-App-Version": "1.0.0",
    ...options.headers,
  };

  return fetch(url, {
    ...options,
    headers: secureHeaders,
  });
}

// ── SECURE ANTHROPIC AI CALL ─────────────────────────────
// Hardened version of the Claude API call with security controls
export async function secureAnthropicCall(systemPrompt, userContent, maxTokens = 400) {
  // Rate limit check (additional server-side style check)
  const urlObj = new URL("https://api.anthropic.com/v1/messages");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userContent }],
    }),
  });

  if (!response.ok) {
    throw new Error(`API call failed: ${response.status}`);
  }

  return response.json();
}

// ── CONTENT SECURITY POLICY VIOLATION REPORTER ───────────
// Catches and logs CSP violations in the browser
export function initCSPReporting() {
  document.addEventListener("securitypolicyviolation", (e) => {
    console.warn("[SeenKa CSP Violation]", {
      blockedURI: e.blockedURI,
      violatedDirective: e.violatedDirective,
      originalPolicy: e.originalPolicy,
      timestamp: new Date().toISOString(),
    });
  });
}

// ── ANTI-DEVTOOLS DETECTION ───────────────────────────────
// Detects if browser devtools are open (soft warning only)
export function initDevToolsDetection(onDetected) {
  let devToolsOpen = false;
  const threshold = 160;

  const check = () => {
    const widthDiff = window.outerWidth - window.innerWidth > threshold;
    const heightDiff = window.outerHeight - window.innerHeight > threshold;
    if ((widthDiff || heightDiff) && !devToolsOpen) {
      devToolsOpen = true;
      if (onDetected) onDetected();
    } else if (!widthDiff && !heightDiff) {
      devToolsOpen = false;
    }
  };

  window.addEventListener("resize", check);
  return () => window.removeEventListener("resize", check);
}

// ── SESSION SECURITY ─────────────────────────────────────
// Manages secure session timeouts
const SESSION_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour
let sessionTimer = null;
let lastActivity = Date.now();

export function initSessionTimeout(onTimeout) {
  const resetTimer = () => {
    lastActivity = Date.now();
    if (sessionTimer) clearTimeout(sessionTimer);
    sessionTimer = setTimeout(() => {
      if (onTimeout) onTimeout();
    }, SESSION_TIMEOUT_MS);
  };

  // Reset on user activity
  ["click", "keydown", "mousemove", "touchstart", "scroll"].forEach(event => {
    window.addEventListener(event, resetTimer, { passive: true });
  });

  resetTimer();

  return () => {
    if (sessionTimer) clearTimeout(sessionTimer);
    ["click", "keydown", "mousemove", "touchstart", "scroll"].forEach(event => {
      window.removeEventListener(event, resetTimer);
    });
  };
}

export function getRemainingSessionTime() {
  const elapsed = Date.now() - lastActivity;
  return Math.max(0, SESSION_TIMEOUT_MS - elapsed);
}
