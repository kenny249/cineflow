import { FileX } from "lucide-react";

export default function QuoteNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#070707] px-6">
      <div className="text-center max-w-sm">
        <div className="mb-5 mx-auto h-14 w-14 rounded-2xl bg-zinc-900 border border-white/[0.06] flex items-center justify-center">
          <FileX className="h-6 w-6 text-zinc-600" />
        </div>
        <h1 className="text-xl font-bold text-white mb-2">Quote not found</h1>
        <p className="text-sm text-zinc-500 leading-relaxed">
          This proposal link is no longer active or may have expired. Contact your production team for an updated link.
        </p>
      </div>
    </div>
  );
}
