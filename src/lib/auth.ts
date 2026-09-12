import { db } from "@/lib/db";

// Simple cookie-based session. We store a signed user id.
// For demo purposes only — production should use NextAuth/JWT properly.

export const SESSION_COOKIE = "abs_session";
const SECRET = process.env.AUTH_SECRET || "demo-secret-change-me";

export type UserRole = "DIRECTEUR" | "SURVEILLANT" | "ENSEIGNANT";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  teacherId?: string;
}

// Sign a payload (base64 + simple hash, not crypto-secure but ok for demo)
async function sign(payload: SessionUser): Promise<string> {
  const data = JSON.stringify(payload);
  const b64 = Buffer.from(data).toString("base64url");
  const sig = await hash(b64 + SECRET);
  return `${b64}.${sig}`;
}

async function verify(token: string): Promise<SessionUser | null> {
  try {
    const [b64, sig] = token.split(".");
    if (!b64 || !sig) return null;
    const expected = await hash(b64 + SECRET);
    if (sig !== expected) return null;
    const data = Buffer.from(b64, "base64url").toString("utf8");
    return JSON.parse(data) as SessionUser;
  } catch {
    return null;
  }
}

async function hash(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Buffer.from(new Uint8Array(buf)).toString("hex");
}

export async function createSession(user: SessionUser): Promise<string> {
  return sign(user);
}

export async function getSession(token?: string): Promise<SessionUser | null> {
  if (!token) return null;
  return verify(token);
}

export async function authenticateUser(
  email: string,
  password: string
): Promise<SessionUser | null> {
  await ensureDefaultAccounts();
  const user = await db.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    include: { teacher: true },
  });
  if (!user) return null;
  // Demo: passwords are stored plain for seeded users (would use bcrypt in prod)
  if (user.password !== password) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as UserRole,
    teacherId: user.teacher?.id,
  };
}

let defaultAccountsEnsured = false;

// Crée les comptes de base (directeur, surveillant) s'ils n'existent pas.
// Idempotent — exécuté une seule fois par process.
export async function ensureDefaultAccounts(): Promise<void> {
  if (defaultAccountsEnsured) return;
  defaultAccountsEnsured = true;
  try {
    const directeur = await db.user.findUnique({ where: { email: "directeur@edu.ma" } });
    if (!directeur) {
      await db.user.create({
        data: {
          email: "directeur@edu.ma",
          name: "Le Directeur",
          password: "directeur123",
          role: "DIRECTEUR",
        },
      });
    }
    const surveillant = await db.user.findUnique({ where: { email: "surveillant@edu.ma" } });
    if (!surveillant) {
      await db.user.create({
        data: {
          email: "surveillant@edu.ma",
          name: "M. Karim Idrissi",
          password: "surveillant123",
          role: "SURVEILLANT",
        },
      });
    }
  } catch {
    // DB indisponible au boot : on retentera au prochain appel.
    defaultAccountsEnsured = false;
  }
}

// Helper used by API routes to get the current user from the request cookies
export async function getCurrentUser(request: Request): Promise<SessionUser | null> {
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
  if (!match) return null;
  return getSession(match[1]);
}
