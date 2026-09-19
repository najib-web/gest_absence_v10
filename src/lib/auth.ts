import { db } from "@/lib/db";

// Simple cookie-based session. We store a signed user id.
// For demo purposes only — production should use NextAuth/JWT properly.

export const SESSION_COOKIE = "abs_session";
const SECRET = process.env.AUTH_SECRET || "demo-secret-change-me";

export type UserRole = "SUPERADMIN" | "DIRECTEUR" | "SURVEILLANT" | "ENSEIGNANT";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  teacherId?: string;
  etablissementId?: string;
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
    etablissementId: user.etablissementId ?? undefined,
  };
}

// Rôles autorisés à gérer les données de l'établissement :
// tout ce que le Surveillant peut faire, le Directeur peut aussi le faire.
export function isStaff(role: string): boolean {
  return role === "SURVEILLANT" || role === "DIRECTEUR";
}

// Admin backend (administration centrale) : crée les établissements + directeurs.
export function isSuperAdmin(role: string): boolean {
  return role === "SUPERADMIN";
}

// Crée l'établissement par défaut si la base n'en contient aucun
// (premier démarrage, ou après un vidage total).
export async function ensureDefaultEtablissement(): Promise<{ id: string }> {
  const existing = await db.etablissement.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (existing) return existing;
  const created = await db.etablissement.create({
    data: {
      code: "ETAB-001",
      nameFr: "Établissement Scolaire",
      nameAr: "المؤسسة التعليمية",
      arefFr: "Académie Régionale d'Éducation et de Formation",
      arefAr: "الأكاديمية الجهوية للتربية والتكوين",
      dpFr: "Direction Provinciale",
      dpAr: "المديرية الإقليمية",
    },
    select: { id: true },
  });
  return created;
}

let defaultAccountsEnsured = false;

// Crée les comptes de base (admin backend, directeur, surveillant) s'ils
// n'existent pas, et rattache directeur/surveillant à l'établissement par défaut.
// Idempotent — exécuté une seule fois par process.
export async function ensureDefaultAccounts(): Promise<void> {
  if (defaultAccountsEnsured) return;
  defaultAccountsEnsured = true;
  try {
    const admin = await db.user.findUnique({ where: { email: "admin@edu.ma" } });
    if (!admin) {
      await db.user.create({
        data: {
          email: "admin@edu.ma",
          name: "Administration Centrale",
          password: "admin123",
          role: "SUPERADMIN",
        },
      });
    }
    // Établissement par défaut : garantit l'héritage AREF/DP des comptes de base
    const etab = await ensureDefaultEtablissement();
    const directeur = await db.user.findUnique({ where: { email: "directeur@edu.ma" } });
    if (!directeur) {
      await db.user.create({
        data: {
          email: "directeur@edu.ma",
          name: "Le Directeur",
          password: "directeur123",
          role: "DIRECTEUR",
          etablissementId: etab.id,
        },
      });
    } else if (!directeur.etablissementId) {
      await db.user.update({
        where: { id: directeur.id },
        data: { etablissementId: etab.id },
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
          etablissementId: etab.id,
        },
      });
    } else if (!surveillant.etablissementId) {
      await db.user.update({
        where: { id: surveillant.id },
        data: { etablissementId: etab.id },
      });
    }
  } catch {
    // DB indisponible au boot : on retentera au prochain appel.
    defaultAccountsEnsured = false;
  }
}

// Ré-arme le garde-fou d'ensureDefaultAccounts — appelé après un vidage total
// de la base afin que les comptes par défaut soient recréés au prochain login.
export function resetDefaultAccountsFlag(): void {
  defaultAccountsEnsured = false;
}

// Helper used by API routes to get the current user from the request cookies
export async function getCurrentUser(request: Request): Promise<SessionUser | null> {
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
  if (!match) return null;
  return getSession(match[1]);
}

// Établissement de rattachement de l'utilisateur courant.
// Les sessions antérieures (cookies signés avant l'ajout du champ) sont
// rattrapées par une lecture en base.
export async function resolveEtablissementId(user: SessionUser): Promise<string | null> {
  if (user.etablissementId) return user.etablissementId;
  if (user.role === "SUPERADMIN") return null;
  try {
    const row = await db.user.findUnique({
      where: { id: user.id },
      select: { etablissementId: true },
    });
    return row?.etablissementId ?? null;
  } catch {
    return null;
  }
}
