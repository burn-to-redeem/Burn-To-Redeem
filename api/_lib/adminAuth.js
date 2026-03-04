import crypto from 'node:crypto';
import { parseJsonBody } from './claimUtils.js';

const SESSION_COOKIE_NAME = 'burn_admin_session';

function getSessionSecret() {
  return (
    (process.env.ADMIN_SESSION_SECRET || '').trim() ||
    (process.env.CLAIM_SIGNING_SECRET || '').trim()
  );
}

function getAdminUsername() {
  return (process.env.ADMIN_USERNAME || 'admin').trim();
}

function getAdminPassword() {
  return (process.env.ADMIN_PASSWORD || '').trim();
}

function getSessionTtlSeconds() {
  const parsed = Number.parseInt(String(process.env.ADMIN_SESSION_TTL_SECONDS || ''), 10);
  if (Number.isInteger(parsed) && parsed > 0) return parsed;
  return 24 * 60 * 60;
}

function b64UrlEncode(value) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function b64UrlDecode(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function signPayload(payloadPart, secret) {
  return crypto.createHmac('sha256', secret).update(payloadPart).digest('base64url');
}

function safeCompare(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function parseCookies(req) {
  const raw = req.headers?.cookie || '';
  if (!raw) return {};

  const out = {};
  for (const segment of raw.split(';')) {
    const idx = segment.indexOf('=');
    if (idx < 0) continue;
    const key = segment.slice(0, idx).trim();
    const value = segment.slice(idx + 1).trim();
    out[key] = decodeURIComponent(value);
  }
  return out;
}

function sessionCookieHeader(value, maxAgeSeconds) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`;
}

export function assertAdminConfigured() {
  if (!getSessionSecret()) {
    throw new Error('Missing ADMIN_SESSION_SECRET or CLAIM_SIGNING_SECRET env variable.');
  }
  if (!getAdminPassword()) {
    throw new Error('Missing ADMIN_PASSWORD env variable.');
  }
}

export function clearAdminSession(res) {
  res.setHeader('Set-Cookie', sessionCookieHeader('', 0));
}

export function createAdminSession(res, username) {
  const secret = getSessionSecret();
  const ttl = getSessionTtlSeconds();
  const payload = {
    user: username,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + ttl
  };

  const payloadPart = b64UrlEncode(JSON.stringify(payload));
  const signaturePart = signPayload(payloadPart, secret);
  const token = `${payloadPart}.${signaturePart}`;

  res.setHeader('Set-Cookie', sessionCookieHeader(token, ttl));
}

export function readAdminSession(req) {
  const secret = getSessionSecret();
  if (!secret) return null;

  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE_NAME];
  if (!token) return null;

  const [payloadPart, signaturePart] = token.split('.');
  if (!payloadPart || !signaturePart) return null;

  const expected = signPayload(payloadPart, secret);
  if (!safeCompare(signaturePart, expected)) return null;

  try {
    const payload = JSON.parse(b64UrlDecode(payloadPart));
    if (!payload || typeof payload !== 'object') return null;
    if (!payload.exp || Math.floor(Date.now() / 1000) > Number(payload.exp)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function requireAdminSession(req, res) {
  const session = readAdminSession(req);
  if (!session) {
    res.status(401).json({ ok: false, error: 'Admin authentication required.' });
    return null;
  }
  return session;
}

export function verifyAdminCredentials(username, password) {
  const configuredUser = getAdminUsername();
  const configuredPass = getAdminPassword();
  return safeCompare(username, configuredUser) && safeCompare(password, configuredPass);
}

export function readLoginPayload(req) {
  const body = parseJsonBody(req);
  return {
    username: String(body.username || '').trim(),
    password: String(body.password || '')
  };
}
