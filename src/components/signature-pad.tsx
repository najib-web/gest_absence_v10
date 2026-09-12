"use client";

// Signature manuscrite sur canvas (souris + tactile).
// Le tracé est exporté en data URL PNG (fond transparent).

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Eraser, PenLine } from "lucide-react";
import { useI18n } from "@/lib/i18n-context";

export function SignaturePad({
  value,
  onChange,
  className,
}: {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  className?: string;
}) {
  const { t } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const [hasInk, setHasInk] = useState(!!value);

  // Charge une signature existante (édition) — aucun setState ici
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      img.src = value;
    }
  }, []);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    drawing.current = true;
    lastPos.current = pos(e);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !lastPos.current) return;
    const p = pos(e);
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastPos.current = p;
    if (!hasInk) setHasInk(true);
  }

  function end() {
    drawing.current = false;
    lastPos.current = null;
    // Notifie le parent avec l'image courante
    const canvas = canvasRef.current;
    if (canvas && hasInk) {
      onChange(canvas.toDataURL("image/png"));
    }
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
    onChange(null);
  }

  return (
    <div className={className}>
      <div className="relative rounded-md border-2 border-dashed border-muted-foreground/40 bg-white overflow-hidden">
        <canvas
          ref={canvasRef}
          width={480}
          height={160}
          className="w-full h-[140px] touch-none cursor-crosshair"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
        />
        {!hasInk && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-muted-foreground/60">
            <span className="flex items-center gap-2 text-sm">
              <PenLine className="h-4 w-4" />
              {t.signHere}
            </span>
          </div>
        )}
      </div>
      <div className="flex justify-end mt-2">
        <Button type="button" variant="outline" size="sm" onClick={clear} disabled={!hasInk}>
          <Eraser className="h-4 w-4 me-2" />
          {t.clearSignature}
        </Button>
      </div>
    </div>
  );
}
