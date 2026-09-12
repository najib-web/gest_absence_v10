"use client";

// Gestion des comptes — réservée au Directeur :
//  - liste de tous les comptes (directeur, surveillants, enseignants)
//  - création de comptes surveillants / enseignants
//  - réinitialisation de mot de passe de n'importe quel compte
//  - suppression d'un compte

import { useState } from "react";
import { useI18n } from "@/lib/i18n-context";
import { useFetch, apiPost, apiPatch, apiDelete } from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { UserCog, UserPlus, KeyRound, Trash2, Loader2, Shield, BookOpen, Landmark } from "lucide-react";
import { toast } from "sonner";

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
  teacher?: { id: string; matiere: string; ppr: string | null } | null;
}

export function AdminAccounts({ currentUser }: { currentUser: { id: string; email: string; name: string; role: string } }) {
  const { t } = useI18n();
  const { data, loading, refresh } = useFetch<{ users: UserRow[] }>("/api/users");
  const users = data?.users ?? [];

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    role: "SURVEILLANT",
    firstName: "",
    lastName: "",
    matiere: "",
    email: "",
    password: "",
  });

  const [pwdTarget, setPwdTarget] = useState<UserRow | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [pwdSaving, setPwdSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const roleLabel = (r: string) =>
    r === "DIRECTEUR" ? t.directeur : r === "SURVEILLANT" ? t.surveillant : t.enseignant;
  const roleIcon = (r: string) =>
    r === "DIRECTEUR" ? (
      <Landmark className="h-4 w-4 text-amber-600" />
    ) : r === "SURVEILLANT" ? (
      <Shield className="h-4 w-4 text-primary" />
    ) : (
      <BookOpen className="h-4 w-4 text-sky-700" />
    );

  async function createAccount(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      await apiPost("/api/users", {
        email: form.email,
        password: form.password,
        role: form.role,
        firstName: form.firstName || undefined,
        lastName: form.lastName || undefined,
        matiere: form.role === "ENSEIGNANT" ? form.matiere || undefined : undefined,
      });
      toast.success(t.accountCreated);
      setCreateOpen(false);
      setForm({ role: "SURVEILLANT", firstName: "", lastName: "", matiere: "", email: "", password: "" });
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function resetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!pwdTarget) return;
    setPwdSaving(true);
    try {
      await apiPatch(`/api/users/${pwdTarget.id}`, { password: newPassword });
      toast.success(t.passwordUpdated);
      setPwdTarget(null);
      setNewPassword("");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPwdSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiDelete(`/api/users/${deleteTarget.id}`);
      toast.success(t.accountDeleted);
      setDeleteTarget(null);
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5 text-primary" />
              {t.accountsManagement}
            </CardTitle>
            <CardDescription>{t.accountsManagementDesc}</CardDescription>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <UserPlus className="h-4 w-4 me-2" />
            {t.newAccount}
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.name}</TableHead>
                  <TableHead>{t.email}</TableHead>
                  <TableHead>{t.role}</TableHead>
                  <TableHead>{t.subject}</TableHead>
                  <TableHead className="text-end">{t.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      {t.noData}
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">
                        <span className="flex items-center gap-2">
                          {roleIcon(u.role)}
                          {u.name}
                          {u.id === currentUser.id && (
                            <Badge variant="outline" className="text-[10px]">
                              {t.you}
                            </Badge>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">{u.email}</TableCell>
                      <TableCell>
                        <Badge variant={u.role === "DIRECTEUR" ? "default" : "secondary"}>
                          {roleLabel(u.role)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {u.teacher?.matiere ?? "—"}
                      </TableCell>
                      <TableCell className="text-end">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            title={t.resetPassword}
                            onClick={() => {
                              setPwdTarget(u);
                              setNewPassword("");
                            }}
                          >
                            <KeyRound className="h-4 w-4" />
                          </Button>
                          {u.id !== currentUser.id && u.role !== "DIRECTEUR" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              title={t.delete}
                              className="text-destructive hover:text-destructive"
                              onClick={() => setDeleteTarget(u)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog : créer un compte */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-primary" />
              {t.newAccount}
            </DialogTitle>
            <DialogDescription>{t.newAccountDesc}</DialogDescription>
          </DialogHeader>
          <form onSubmit={createAccount} className="space-y-4">
            <div className="space-y-2">
              <Label>{t.role}</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SURVEILLANT">{t.surveillant}</SelectItem>
                  <SelectItem value="ENSEIGNANT">{t.enseignant}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.role === "ENSEIGNANT" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="acc-first">{t.firstName}</Label>
                  <Input
                    id="acc-first"
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="acc-last">{t.lastName}</Label>
                  <Input
                    id="acc-last"
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="acc-matiere">{t.subject}</Label>
                  <Input
                    id="acc-matiere"
                    value={form.matiere}
                    onChange={(e) => setForm({ ...form, matiere: e.target.value })}
                  />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="acc-email">{t.email}</Label>
              <Input
                id="acc-email"
                type="email"
                placeholder="prenom.nom@edu.ma"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="acc-password">{t.password}</Label>
              <Input
                id="acc-password"
                type="text"
                minLength={6}
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                {t.cancel}
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <UserPlus className="h-4 w-4 me-2" />}
                {t.create}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog : réinitialiser le mot de passe */}
      <Dialog open={!!pwdTarget} onOpenChange={(v) => !v && setPwdTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" />
              {t.resetPassword}
            </DialogTitle>
            <DialogDescription>
              {pwdTarget?.name} — {pwdTarget?.email}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={resetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-pwd">{t.newPassword}</Label>
              <Input
                id="new-pwd"
                type="text"
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPwdTarget(null)}>
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

      {/* AlertDialog : confirmer la suppression */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.deleteAccountConfirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.name} — {deleteTarget?.email}
              {deleteTarget?.role === "ENSEIGNANT" ? ` — ${t.deleteAccountTeacherWarn}` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
            >
              {deleting ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Trash2 className="h-4 w-4 me-2" />}
              {t.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
