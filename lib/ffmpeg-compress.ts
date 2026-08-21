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

    if (data.byteLength >= 24 * 1024 * 1024) {
      throw new Error(
        `Compressed file is still ${(data.byteLength / (1024 * 1024)).toFixed(1)} MB — ` +
        `this recording may be too long to transcribe. Try trimming it to under 30 minutes.`
      );
    }

    return new File(
      [data],
      file.name.replace(/\.[^.]+$/, "") + "_compressed.mp3",
      { type: "audio/mpeg" }
    );
  } finally {
    ffmpeg.off("progress", progressHandler);
  }
}
