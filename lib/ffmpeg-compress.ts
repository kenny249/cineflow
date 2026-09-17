import { getFFmpeg } from "@/lib/ffmpeg-client";

export async function compressAudioForWhisper(
  file: File,
  onProgress?: (pct: number) => void
): Promise<File> {
  const ffmpeg = await getFFmpeg();
  const { fetchFile } = await import("@ffmpeg/util");

  const progressHandler = ({ progress }: { progress: number }) => {
    onProgress?.(Math.min(Math.round(progress * 100), 99));
  };

  ffmpeg.on("progress", progressHandler);

  try {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "mp3";
    const inputName = `input.${ext}`;
    const outputName = "output.mp3";

    await ffmpeg.writeFile(inputName, await fetchFile(file));

    // mono, 16 kHz, 32 kbps — well above speech intelligibility floor for Whisper;
    // guarantees ≥2× reduction even on already-compressed 64 kbps source files
    await ffmpeg.exec([
      "-i", inputName,
      "-ac", "1",
      "-ar", "16000",
      "-b:a", "32k",
      "-f", "mp3",
      outputName,
    ]);

    const raw = await ffmpeg.readFile(outputName) as Uint8Array;
    const data = new Uint8Array(raw);

    await ffmpeg.deleteFile(inputName).catch(() => {});
    await ffmpeg.deleteFile(outputName).catch(() => {});

    // Deliberately does NOT throw if the compressed result is still over
    // Whisper's 25MB limit — every caller already has its own fallback for
    // that (splitting into chunks). Throwing here made that fallback
    // unreachable: compression could only ever return under 24MB or throw,
    // so "still too big after compressing, so split it" could never fire.
    return new File(
      [data],
      file.name.replace(/\.[^.]+$/, "") + "_compressed.mp3",
      { type: "audio/mpeg" }
    );
  } finally {
    ffmpeg.off("progress", progressHandler);
  }
}
