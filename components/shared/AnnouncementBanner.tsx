"use client";

import { useState } from "react";
import { X, Info, AlertTriangle, CheckCircle } from "lucide-react";

type Props = {
  message: string;
  type: string;
};

const STYLES: Record<string, { bg: string; text: string; border: string; Icon: React.ElementType }> = {
  info:    { bg: "bg-blue-500/10",    text: "text-blue-300",   border: "border-blue-500/20",   Icon: Info },
  warning: { bg: "bg-amber-500/10",   text: "text-amber-300",  border: "border-amber-500/20",  Icon: AlertTriangle },
  success: { bg: "bg-emerald-500/10", text: "text-emerald-300",border: "border-emerald-500/20",Icon: CheckCircle },
};

export function AnnouncementBanner({ message, type }: Props) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const s = STYLES[type] ?? STYLES.info;

  return (
    <div className={`flex items-center gap-3 border-b ${s.border} ${s.bg} px-4 py-2.5`}>
      <s.Icon className={`h-4 w-4 shrink-0 ${s.text}`} />
      <p className={`flex-1 text-xs font-medium ${s.text}`}>{message}</p>
      <button onClick={() => setDismissed(true)} className={`${s.text} opacity-60 hover:opacity-100 transition-opacity`}>
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
