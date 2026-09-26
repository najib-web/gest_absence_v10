"use client";

// Gestion des comptes (Directeur) : création, modification et suppression
// des comptes Surveillants de l'établissement. Le compte Directeur lui-même
// peut être renommé / sécurisé mais jamais supprimé.

import { useState } from "react";
import { useI18n } from "@/lib/i18n-context";
import { useFetch, apiPost, apiPatch, formatDate } from "@/lib/hooks";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2,
  UserCog,
  Plus,
  Pencil,
  Trash2,
  Shield,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";

interface Account {
  id: string;
  email: string;
  name: string;
  role: "DIRECTEUR" | "SURVEILLANT";
  createdAt: string;
  updatedAt: string;
}

const MIN_PWD = 4;

export function DirectorAccounts() {
  const { t, locale } = useI18n();
  const { data, loading, refresh } = useFetch<{ accounts: Account[] }>("/api/director/accounts");

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Account | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null);

  const accounts = data?.accounts ?? [];
  const surveillants = accounts.filter((a) => a.role === "SURVEILLANT");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <UserCog className="h-6 w-6 text-primary" />
            {t.accounts}
          </h2>
          <p className="text-sm text-muted-foreground">{t.accountsDesc}</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 me-2" />
          {t.newAccount}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-amber-500" />
            {t.surveillant} ({surveillants.length})
          </CardTitle>
          <CardDescription>{t.accountsDesc}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.accountName}</TableHead>
                  <TableHead>{t.accountEmail}</TableHead>
                  <TableHead>{t.accountRole}</TableHead>
                  <TableHead>{t.date}</TableHead>
                  <TableHead className="text-end">{t.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <Loader2 className="h-5 w-5 mx-auto animate-spin text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : accounts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      {t.noAccounts}
                    </TableCell>
                  </TableRow>
                ) : (
                  accounts.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.name}</TableCell>
                      <TableCell className="font-mono text-xs">{a.email}</TableCell>
                      <TableCell>
                        <Badge variant={a.role === "DIRECTEUR" ? "default" : "secondary"}>
                          {a.role === "DIRECTEUR" ? t.directeur : t.surveillant}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(a.createdAt, locale)}
                      </TableCell>
                      <TableCell className="text-end">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            title={t.editAccount}
                            onClick={() => setEditTarget(a)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {a.role === "SURVEILLANT" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                              title={t.deleteAccount}
                              onClick={() => setDeleteTarget(a)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
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

      <CreateAccountDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false);
          refresh();
        }}
      />

      <EditAccountDialog
        target={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={() => {
          setEditTarget(null);
          refresh();
        }}
      />

      <DeleteAccountDialog
        target={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={() => {
          setDeleteTarget(null);
          refresh();
        }}
      />
    </div>
  );
}

function CreateAccountDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [saving, setSaving] = useState(false);

  const valid =
    name.trim().length > 0 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) &&
    password.length >= MIN_PWD;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiPost("/api/director/accounts", {
        name: name.trim(),
        email: email.trim(),
        password,
      });
      toast.success(t.accountCreated);
      setName("");
      setEmail("");
      setPassword("");
      setShowPwd(false);
      onCreated();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-amber-600" />
            {t.newAccount}
          </DialogTitle>
          <DialogDescription>{t.accountsDesc}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="acc-name">{t.accountName}</Label>
            <Input
              id="acc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="M. Alami"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="acc-email">{t.accountEmail}</Label>
            <Input
              id="acc-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="surveillant2@edu.ma"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="acc-pwd">{t.accountPassword}</Label>
            <div className="relative">
              <Input
                id="acc-pwd"
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pe-9"
                minLength={MIN_PWD}
                required
              />
              <button
                type="button"
                className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPwd((v) => !v)}
                tabIndex={-1}
              >
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">{t.passwordTooShort}</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t.cancel}
            </Button>
            <Button type="submit" disabled={!valid || saving}>
              {saving ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Plus className="h-4 w-4 me-2" />}
              {t.createAccount}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditAccountDialog({
  target,
  onClose,
  onSaved,
}: {
  target: Account | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [initializedFor, setInitializedFor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // (Re)charge les valeurs à chaque ouverture du dialogue
  if (target && initializedFor !== target.id) {
    setInitializedFor(target.id);
    setName(target.name);
    setEmail(target.email);
    setPassword("");
  }

  const pwdOk = password.length === 0 || password.length >= MIN_PWD;
  const changed =
    !!target &&
    (name.trim() !== target.name || email.trim() !== target.email || password.length > 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!target) return;
    setSaving(true);
    try {
      await apiPatch(`/api/director/accounts/${target.id}`, {
        name: name.trim(),
        email: email.trim(),
        ...(password.length > 0 ? { password } : {}),
      });
      toast.success(t.accountUpdated);
      setPassword("");
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!target} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-primary" />
            {t.editAccount}
            {target && target.role === "DIRECTEUR" ? ` — ${t.directeur}` : ""}
          </DialogTitle>
          <DialogDescription>
            {target?.name} · <span className="font-mono">{target?.email}</span>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">{t.accountName}</Label>
            <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-email">{t.accountEmail}</Label>
            <Input
              id="edit-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-pwd">{t.newPasswordOptional}</Label>
            <div className="relative">
              <Input
                id="edit-pwd"
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pe-9"
                autoComplete="new-password"
              />
              <button
                type="button"
                className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPwd((v) => !v)}
                tabIndex={-1}
              >
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {password.length > 0 && password.length < MIN_PWD && (
              <p className="text-xs text-destructive">{t.passwordTooShort}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t.cancel}
            </Button>
            <Button type="submit" disabled={!changed || !pwdOk || saving}>
              {saving ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : null}
              {t.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteAccountDialog({
  target,
  onClose,
  onDeleted,
}: {
  target: Account | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { t } = useI18n();
  const [deleting, setDeleting] = useState(false);

  async function confirmDelete() {
    if (!target) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/director/accounts/${target.id}`, { method: "DELETE" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || "Erreur");
      }
      toast.success(t.accountDeleted);
      onDeleted();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={!!target} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-4 w-4" />
            {t.deleteAccount}
          </DialogTitle>
          <DialogDescription>
            {target?.name} · <span className="font-mono">{target?.email}</span>
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{t.deleteAccountConfirm}</p>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t.cancel}
          </Button>
          <Button type="button" variant="destructive" onClick={confirmDelete} disabled={deleting}>
            {deleting ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Trash2 className="h-4 w-4 me-2" />}
            {t.delete}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
