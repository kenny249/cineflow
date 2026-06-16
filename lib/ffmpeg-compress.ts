import type { FFmpeg } from "@ffmpeg/ffmpeg";

const CORE_VERSION = "0.12.6";
const CORE_BASE = `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/umd`;

let instance: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;

async function getFFmpeg(): Promise<FFmpeg> {
  if (instance) return instance;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const { FFmpeg } = await import("@ffmpeg/ffmpeg");
    const { toBlobURL } = await import("@ffmpeg/util");

    const ffmpeg = new FFmpeg();
    await ffmpeg.load({
      coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, "application/wasm"),
    });

    instance = ffmpeg;
    return ffmpeg;
  })();

  return loadPromise;
}

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

    // mono, 16 kHz, 64 kbps — matches Whisper's native rate, dramatically smaller
    await ffmpeg.exec([
      "-i", inputName,
      "-ac", "1",
      "-ar", "16000",
      "-b:a", "64k",
      "-f", "mp3",
      outputName,
    ]);

    const raw = await ffmpeg.readFile(outputName) as Uint8Array;
    const data = new Uint8Array(raw);

    await ffmpeg.deleteFile(inputName).catch(() => {});
    await ffmpeg.deleteFile(outputName).catch(() => {});

    return new File(
      [data],
      file.name.replace(/\.[^.]+$/, "") + "_compressed.mp3",
      { type: "audio/mpeg" }
    );
  } finally {
    ffmpeg.off("progress", progressHandler);
  }
}
