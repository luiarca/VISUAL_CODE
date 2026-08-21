const SESSION_DURATION = 60 * 60 * 24 * 7;
const PBKDF2_ITERATIONS = 100000;
const SESSION_COOKIE = "__Host-session";

function json(data, status = 200, headers = {}) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

function randomBytes(length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function toBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function derivePasswordHash(password, salt) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" }, key, 256);
  return new Uint8Array(bits);
}

function equalBytes(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index++) difference |= left[index] ^ right[index];
  return difference === 0;
}

async function encodePassword(password) {
  const salt = randomBytes(16);
  const hash = await derivePasswordHash(password, salt);
  return `pbkdf2-sha256$${PBKDF2_ITERATIONS}$${toBase64Url(salt)}$${toBase64Url(hash)}`;
}

async function verifyPassword(password, encoded) {
  const [algorithm, iterations, saltText, hashText] = String(encoded).split("$");
  if (algorithm !== "pbkdf2-sha256" || Number(iterations) !== PBKDF2_ITERATIONS || !saltText || !hashText) return false;
  const candidate = await derivePasswordHash(password, fromBase64Url(saltText));
  return equalBytes(candidate, fromBase64Url(hashText));
}

function cookieHeader(token, maxAge = SESSION_DURATION) {
  return `${SESSION_COOKIE}=${token}; HttpOnly; Secure; Path=/; Max-Age=${maxAge}; SameSite=Strict`;
}

function readSessionToken(request) {
  const cookies = request.headers.get("Cookie") || "";
  return cookies.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`))?.[1] || null;
}

async function parseJson(request) {
  try { return await request.json(); } catch { return null; }
}

async function createSession(env, userId) {
  const token = toBase64Url(randomBytes(32));
  await env.SESSIONS.put(token, JSON.stringify({ userId }), { expirationTtl: SESSION_DURATION });
  return token;
}

async function currentUser(request, env) {
  const token = readSessionToken(request);
  if (!token) return null;
  const session = await env.SESSIONS.get(token, "json");
  if (!session?.userId) return null;
  return env.datastore_db.prepare("SELECT id, username FROM users WHERE id = ?").bind(session.userId).first();
}

async function handleApi(request, env, path) {
  if (path === "/register" && request.method === "POST") {
    const body = await parseJson(request);
    const username = String(body?.username || "").trim().toLowerCase();
    const password = String(body?.password || "");
    if (!/^[a-z0-9._-]{3,50}$/.test(username) || password.length < 8 || password.length > 200) {
      return json({ error: "Usuario inválido o contraseña de 8 a 200 caracteres" }, 400);
    }
    try {
      await env.datastore_db.prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)").bind(username, await encodePassword(password)).run();
      return json({ success: true }, 201);
    } catch { return json({ error: "El usuario ya existe" }, 409); }
  }

  if (path === "/login" && request.method === "POST") {
    const body = await parseJson(request);
    const username = String(body?.username || "").trim().toLowerCase();
    const password = String(body?.password || "");
    const user = await env.datastore_db.prepare("SELECT id, username, password_hash FROM users WHERE username = ?").bind(username).first();
    if (!user || !(await verifyPassword(password, user.password_hash))) return json({ error: "Credenciales inválidas" }, 401);
    const token = await createSession(env, user.id);
    return json({ success: true, user: user.username }, 200, { "Set-Cookie": cookieHeader(token) });
  }

  if (path === "/me" && request.method === "GET") {
    const user = await currentUser(request, env);
    return user ? json({ authenticated: true, user: user.username }) : json({ authenticated: false }, 401);
  }

  if (path === "/logout" && request.method === "POST") {
    const token = readSessionToken(request);
    if (token) await env.SESSIONS.delete(token);
    return json({ success: true }, 200, { "Set-Cookie": cookieHeader("", 0) });
  }
  return null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (["/register", "/login", "/me", "/logout"].includes(url.pathname)) {
      return (await handleApi(request, env, url.pathname)) || json({ error: "Método no permitido" }, 405);
    }
    return env.ASSETS.fetch(request);
  },
};
