import type { Metadata } from "next";
import Link from "next/link";
import { Film } from "lucide-react";
import { UpdatePasswordForm } from "./UpdatePasswordForm";

export const metadata: Metadata = { title: "Set New Password" };

export default function UpdatePasswordPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-12">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(212,168,83,0.14),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(212,168,83,0.06),transparent_35%)]" />

      <div className="relative z-10 w-full max-w-sm rounded-[2rem] border border-white/10 bg-card/95 p-8 shadow-[0_32px_120px_rgba(0,0,0,0.25)] backdrop-blur-xl">
        <div className="mb-7">
          <Link href="/" className="mb-5 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md border border-[#d4a853]/30 bg-[#d4a853]/10">
              <Film className="h-3.5 w-3.5 text-[#d4a853]" />
            </div>
            <p className="text-[0.65rem] font-bold tracking-[0.3em] text-[#d4a853] uppercase">CineFlow</p>
          </Link>
          <h2 className="text-xl font-bold text-foreground">Set new password</h2>
          <p className="text-sm text-muted-foreground mt-1">Choose a strong password for your account.</p>
        </div>

        <UpdatePasswordForm />
      </div>
    </div>
  );
}
