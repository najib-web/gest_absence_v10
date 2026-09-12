"use client";

// Profil de l'enseignant connecté : informations + signature manuscrite
// qui sera reprise sur ses rapports d'orientation (et export PDF).

import { useState } from "react";
import { useI18n } from "@/lib/i18n-context";
import { useFetch, apiPatch } from "@/lib/hooks";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SignaturePad } from "@/components/signature-pad";
import { UserPen, Loader2, Save, CheckCircle2, KeyRound } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface MyTeacher {
  id: string;
  firstName: string;
  lastName: string;
  firstNameAr: string | null;
  lastNameAr: string | null;
  phone: string | null;
  ppr: string | null;
  signature: string | null;
  matiere: string;
  matiereAr: string | null;
  user: { email: string };
}

export function TeacherProfile({ user }: { user: { name: string; email: string } }) {
  const { t } = useI18n();
  const { data, loading, refresh } = useFetch<{ teacher: MyTeacher }>("/api/teachers/me");
  const teacher = data?.teacher;

  const [signature, setSignature] = useState<string | null>(null);
  const [ppr, setPpr] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Synchronise les champs locaux quand les données arrivent
  if (teacher && !initialized) {
    setSignature(teacher.signature ?? null);
    setPpr(teacher.ppr ?? "");
    setPhone(teacher.phone ?? "");
    setInitialized(true);
  }

  // Dialog mot de passe
  const [pwdOpen, setPwdOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [pwdSaving, setPwdSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await apiPatch("/api/teachers/me", {
        signature,
        ppr: ppr ?? "",
        phone: phone ?? "",
      });
      toast.success(t.profileSaved);
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!teacher) return;
    setPwdSaving(true);
    try {
      // L'enseignant connaît son id via /api/auth/me ; on patche par email côté API users
      const me = await fetch("/api/auth/me").then((r) => r.json());
      await apiPatch(`/api/users/${me.user.id}`, { password: newPassword });
      toast.success(t.passwordUpdated);
      setPwdOpen(false);
      setNewPassword("");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPwdSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t.myProfileSignature}</h2>
        <p className="text-sm text-muted-foreground">{t.myProfileSignatureDesc}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Informations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPen className="h-5 w-5 text-primary" />
              {t.informations}
            </CardTitle>
            <CardDescription>{t.informationsDesc}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading || !teacher ? (
              <div className="py-8 text-center">
                <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">{t.fullName}</div>
                    <div className="font-medium">{teacher.lastName} {teacher.firstName}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">{t.subject}</div>
                    <div className="font-medium">{teacher.matiere}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">{t.email}</div>
                    <div className="font-medium font-mono text-xs mt-0.5">{teacher.user.email}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">{t.ppr}</div>
                    <Input
                      className="mt-1 h-8"
                      value={ppr ?? ""}
                      onChange={(e) => setPpr(e.target.value)}
                      placeholder="123456"
                    />
                  </div>
                  <div className="col-span-2">
                    <div className="text-xs text-muted-foreground">{t.phone}</div>
                    <Input
                      className="mt-1 h-8"
                      value={phone ?? ""}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="06 12 34 56 78"
                    />
                  </div>
                </div>
                <div>
                  <Button variant="outline" size="sm" onClick={() => setPwdOpen(true)}>
                    <KeyRound className="h-4 w-4 me-2" />
                    {t.changeMyPassword}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Signature */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PenIcon />
              {t.mySignature}
            </CardTitle>
            <CardDescription>{t.mySignatureDesc}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading || !teacher ? (
              <div className="py-8 text-center">
                <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
              </div>
            ) : (
              <>
                <SignaturePad value={signature} onChange={setSignature} />
                <Button onClick={save} disabled={saving} className="w-full sm:w-auto">
                  {saving ? (
                    <Loader2 className="h-4 w-4 me-2 animate-spin" />
                  ) : signature ? (
                    <CheckCircle2 className="h-4 w-4 me-2" />
                  ) : (
                    <Save className="h-4 w-4 me-2" />
                  )}
                  {t.saveSignature}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog : changer mon mot de passe */}
      <Dialog open={pwdOpen} onOpenChange={setPwdOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" />
              {t.changeMyPassword}
            </DialogTitle>
            <DialogDescription>{user.email}</DialogDescription>
          </DialogHeader>
          <form onSubmit={changePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="my-new-pwd">{t.newPassword}</Label>
              <Input
                id="my-new-pwd"
                type="password"
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPwdOpen(false)}>
                {t.cancel}
              </Button>
              <Button type="submit" disabled={pwdSaving || newPassword.length < 6}>
                {pwdSaving ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <KeyRound className="h-4 w-4 me-2" />}
                {t.save}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PenIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-amber-500">
      <path d="M12 19l7-7 3 3-7 7-3-3z" />
      <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
    </svg>
  );
}
