"use client";

// Teacher page: reports sent to the surveillant (with processing status)
// + absences flagged as oriented towards the surveillant.

import { useState } from "react";
import { useI18n } from "@/lib/i18n-context";
import { useFetch, formatDate, formatDateShort } from "@/lib/hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { ReportPrintDialog, type PrintOrientation } from "@/components/report-print";
import { Loader2, Send, CheckCircle2, FileText, Eye, Printer } from "lucide-react";
import type { SessionUser } from "@/components/app-shell";

interface Orientation {
  id: string;
  title: string;
  content: string;
  source: string;
  status: string;
  createdAt: string;
  signature?: string | null;
  thresholdAtCreation: number | null;
  student: {
    firstName: string;
    lastName: string;
    codeMassar: string;
    classe: { code: string };
    groupe: { code: string } | null;
  };
  session?: { date: string; subject: string; subjectAr?: string | null } | null;
  unjustifiedAbsences?: number;
  threshold?: number;
}

export function TeacherOriented({ user }: { user: SessionUser }) {
  const { t, locale } = useI18n();
  const teacherId = user.teacherId;
  const { data: orientedData, loading } = useFetch<{ absences: any[] }>(`/api/absences?oriented=true`);
  const { data: reportsData, loading: loadingReports } = useFetch<{ orientations: Orientation[] }>(
    teacherId ? `/api/orientations?teacherId=${teacherId}&source=TEACHER` : null
  );

  const [viewTarget, setViewTarget] = useState<Orientation | null>(null);
  const [printTarget, setPrintTarget] = useState<PrintOrientation | null>(null);

  const orientedAbsences = (orientedData?.absences ?? []).filter(
    (a) => a.session.teacherId === teacherId
  );
  const reports = reportsData?.orientations ?? [];

  function toPrint(o: Orientation): PrintOrientation {
    return {
      id: o.id,
      title: o.title,
      content: o.content,
      source: o.source,
      status: o.status,
      createdAt: o.createdAt,
      signature: o.signature ?? null,
      thresholdAtCreation: o.thresholdAtCreation,
      unjustifiedAbsences: o.unjustifiedAbsences,
      threshold: o.threshold,
      student: o.student,
      teacher: null,
      session: o.session ?? null,
    };
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t.orientedStudents}</h2>
        <p className="text-sm text-muted-foreground">{t.orientedStudents} — {user.name}</p>
      </div>

      {/* ===== Mes rapports envoyés au surveillant ===== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-amber-500" />
            {t.myReports} ({reports.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead>{t.fullName}</TableHead>
                  <TableHead>{t.classe}</TableHead>
                  <TableHead>{t.date}</TableHead>
                  <TableHead>{t.status}</TableHead>
                  <TableHead className="text-end">{t.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingReports ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <Loader2 className="h-5 w-5 mx-auto animate-spin text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : reports.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      {t.noReportsYet}
                    </TableCell>
                  </TableRow>
                ) : (
                  reports.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-medium">
                        {o.student.lastName} {o.student.firstName}
                        <div className="text-xs text-muted-foreground font-normal truncate max-w-56">{o.title}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{o.student.classe?.code}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDateShort(o.createdAt, locale)}
                      </TableCell>
                      <TableCell>
                        {o.status === "RESOLVED" ? (
                          <Badge variant="default" className="bg-emerald-600">
                            <CheckCircle2 className="h-3 w-3 me-1" />
                            {t.processed}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-amber-600 border-amber-300">
                            {t.pending}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-end">
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setViewTarget(o)}>
                            <Eye className="h-3 w-3 me-1" />
                            {t.view}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => setPrintTarget(toPrint(o))}
                          >
                            <Printer className="h-3 w-3 me-1" />
                            {t.print}
                          </Button>
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

      {/* ===== Absences orientées ===== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-amber-500" />
            {t.orientedAbsences} ({orientedAbsences.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.fullName}</TableHead>
                  <TableHead>{t.codeMassar}</TableHead>
                  <TableHead>{t.classe}</TableHead>
                  <TableHead>{t.date}</TableHead>
                  <TableHead>{t.subject}</TableHead>
                  <TableHead>{t.status}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <Loader2 className="h-5 w-5 mx-auto animate-spin text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : orientedAbsences.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      {t.noData}
                    </TableCell>
                  </TableRow>
                ) : (
                  orientedAbsences.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">
                        {a.student.lastName} {a.student.firstName}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{a.student.codeMassar}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{a.student.classe?.code}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(a.session.date, locale)}
                      </TableCell>
                      <TableCell className="text-sm">{a.session.subject}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          <Badge variant={a.status === "ABSENT" ? "destructive" : "secondary"}>
                            {a.status === "ABSENT" ? t.absent : t.late}
                          </Badge>
                          <Badge variant={a.justified ? "default" : "outline"} className={a.justified ? "bg-emerald-600" : "text-amber-600"}>
                            {a.justified ? t.justified : t.pending}
                          </Badge>
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

      {/* View report dialog */}
      <Dialog open={!!viewTarget} onOpenChange={(v) => !v && setViewTarget(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{viewTarget?.title}</DialogTitle>
            <DialogDescription>
              {viewTarget && (
                <>
                  {viewTarget.student.lastName} {viewTarget.student.firstName} — {viewTarget.student.codeMassar}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{viewTarget?.content}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewTarget(null)}>{t.close}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Print dialog */}
      <ReportPrintDialog
        orientation={printTarget}
        open={!!printTarget}
        onOpenChange={(v) => !v && setPrintTarget(null)}
      />
    </div>
  );
}
