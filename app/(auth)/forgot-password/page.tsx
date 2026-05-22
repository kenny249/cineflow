import type { Metadata } from "next";
import Link from "next/link";
import { Film } from "lucide-react";
import { ForgotPasswordForm } from "./ForgotPasswordForm";
import { PageParticles } from "../login/PageParticles";

export const metadata: Metadata = { title: "Reset Password" };

export default function ForgotPasswordPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-12">
      <PageParticles />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(212,168,83,0.14),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(212,168,83,0.06),transparent_35%)]" />
      <div className="absolute left-0 top-0 h-48 w-48 rounded-full bg-[#d4a853]/10 blur-3xl" />
      <div className="absolute right-0 bottom-0 h-72 w-72 rounded-full bg-[#d4a853]/8 blur-3xl" />

      <div className="animate-card-rise relative z-10 w-full max-w-sm rounded-[2rem] border border-white/10 bg-card/95 p-8 shadow-[0_32px_120px_rgba(0,0,0,0.25)] backdrop-blur-xl">
        <div className="mb-7">
          <Link href="/" className="mb-5 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md border border-[#d4a853]/30 bg-[#d4a853]/10">
              <Film className="h-3.5 w-3.5 text-[#d4a853]" />
            </div>
            <p className="text-[0.65rem] font-bold tracking-[0.3em] text-[#d4a853] uppercase">CineFlow</p>
          </Link>
          <h2 className="text-xl font-bold text-foreground">Reset your password</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Enter your email and we&apos;ll send you a reset link.
          </p>
        </div>

        <ForgotPasswordForm />
      </div>
    </div>
  );
}
