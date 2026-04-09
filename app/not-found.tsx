import Link from "next/link";
import { Film } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background text-center px-6">
      <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#d4a853]/20 bg-[#d4a853]/10">
        <Film className="h-7 w-7 text-[#d4a853]" />
      </div>
      <h1 className="font-display text-5xl font-bold text-foreground">404</h1>
      <p className="mt-3 text-muted-foreground">This scene doesn&apos;t exist in the script.</p>
      <Button variant="gold" size="lg" asChild className="mt-8">
        <Link href="/dashboard">Back to dashboard</Link>
      </Button>
    </div>
  );
}
