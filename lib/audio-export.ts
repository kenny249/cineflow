// Cuts real soundbites out of the source audio at the timestamps resolved by
// transcript-align.ts, and packages them into a downloadable ZIP — individual
// clips in order, plus one combined file. Runs entirely in the browser via
// ffmpeg.wasm; the audio never leaves the device.
import { getFFmpeg } from "@/lib/ffmpeg-client";
import type { MarkerFile } from "@/lib/marker-export";

export interface ExportCut {
  index: number;
  label: string;
  start: number;
  end: number;
}

export interface ExportResult {
  blob: Blob;
  includedCount: number;
}

function slug(label: string): string {
  const s = label.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return s || "CLIP";
}

export async function exportCutsZip(
  file: File,
  cuts: ExportCut[],
  pad = 0.15,
  onProgress?: (pct: number) => void,
  markerFile?: MarkerFile
): Promise<ExportResult> {
  if (cuts.length === 0) throw new Error("No cuts with a resolved timestamp to export.");

  const ffmpeg = await getFFmpeg();
  const [{ fetchFile }, { default: JSZip }] = await Promise.all([
    import("@ffmpeg/util"),
    import("jszip"),
  ]);

  const ext = file.name.split(".").pop()?.toLowerCase() || "mp3";
  const inputName = `src.${ext}`;
  await ffmpeg.writeFile(inputName, await fetchFile(file));

  const zip = new JSZip();
  const clipsFolder = zip.folder("clips")!;
  const concatFiles: string[] = [];

  try {
    let done = 0;
    for (const cut of cuts) {
      const start = Math.max(0, cut.start - pad);
      const end = Math.max(start + 0.05, cut.end + pad);
      const outName = `clip_${cut.index}.wav`;

      await ffmpeg.exec([
        "-i", inputName,
        "-ss", start.toFixed(3),
        "-to", end.toFixed(3),
        "-ar", "44100",
        "-ac", "2",
        outName,
      ]);

      const data = (await ffmpeg.readFile(outName)) as Uint8Array;
      const fname = `${String(cut.index).padStart(2, "0")}_${slug(cut.label)}.wav`;
      clipsFolder.file(fname, data);
      concatFiles.push(outName);

      done++;
      onProgress?.(Math.round((done / cuts.length) * 80));
    }

    // Combine — all clips share the same format from the step above, so a
    // stream-copy concat is exact and fast.
    const listContent = concatFiles.map((n) => `file '${n}'`).join("\n");
    await ffmpeg.writeFile("concat_list.txt", listContent);
    await ffmpeg.exec([
      "-f", "concat", "-safe", "0",
      "-i", "concat_list.txt",
      "-c", "copy",
      "combined.wav",
    ]);
    const combined = (await ffmpeg.readFile("combined.wav")) as Uint8Array;
    zip.file("combined.wav", combined);

    if (markerFile) {
      zip.file(markerFile.filename, markerFile.content);
    }
    onProgress?.(92);
  } finally {
    // Best-effort cleanup of ffmpeg's virtual filesystem — never let a cleanup
    // failure mask (or crash past) a successful export.
    await ffmpeg.deleteFile(inputName).catch(() => {});
    await ffmpeg.deleteFile("concat_list.txt").catch(() => {});
    await ffmpeg.deleteFile("combined.wav").catch(() => {});
    for (const n of concatFiles) await ffmpeg.deleteFile(n).catch(() => {});
  }

  const blob = await zip.generateAsync({ type: "blob" });
  onProgress?.(100);
  return { blob, includedCount: cuts.length };
}
