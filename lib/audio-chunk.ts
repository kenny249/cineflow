// Makes arbitrarily long recordings transcribable despite Whisper's hard
// 25MB-per-request limit — split into chunks safely under that limit,
// transcribe each, and the caller stitches the results back into one
// seamless transcript. Nothing here is visible to the person uploading;
// they just see one file and one progress bar.
import { getFFmpeg } from "@/lib/ffmpeg-client";

// Read duration via the browser's native audio decoder — no ffmpeg probing
// needed, works for every format this tool already accepts.
export function getAudioDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    const url = URL.createObjectURL(file);
    const cleanup = () => URL.revokeObjectURL(url);
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      const duration = audio.duration;
      cleanup();
      if (!Number.isFinite(duration) || duration <= 0) {
        reject(new Error("Could not read this file's duration."));
        return;
      }
      resolve(duration);
    };
    audio.onerror = () => {
      cleanup();
      reject(new Error("Could not read this file's duration."));
    };
    audio.src = url;
  });
}

// Conservative target well under Whisper's 25MB cap, sized for the
// compressed 32kbps output this tool already produces (~4KB/s, so ~80 min
// lands around 19MB) — generous margin for container/encoding overhead.
export const CHUNK_SECONDS = 80 * 60;

export interface AudioChunk {
  file: File;
  index: number;
}

export async function splitAudioIntoChunks(
  file: File,
  chunkSeconds: number = CHUNK_SECONDS,
  onProgress?: (pct: number) => void
): Promise<AudioChunk[]> {
  const ffmpeg = await getFFmpeg();
  const { fetchFile } = await import("@ffmpeg/util");

  const ext = file.name.split(".").pop()?.toLowerCase() || "mp3";
  const inputName = `chunkin.${ext}`;
  const outPattern = `chunkout_%03d.${ext}`;

  await ffmpeg.writeFile(inputName, await fetchFile(file));
  onProgress?.(20);

  // Stream-copy segmenting — no re-encode, since the input is already
  // compressed by this point. Fast even for multi-hour files.
  await ffmpeg.exec([
    "-i", inputName,
    "-f", "segment",
    "-segment_time", String(chunkSeconds),
    "-c", "copy",
    "-reset_timestamps", "1",
    outPattern,
  ]);
  onProgress?.(70);

  const entries = await ffmpeg.listDir(".");
  const chunkNames = entries
    .filter((e) => !e.isDir && e.name.startsWith("chunkout_") && e.name.endsWith(`.${ext}`))
    .map((e) => e.name)
    .sort();

  if (chunkNames.length === 0) {
    throw new Error("Splitting this file didn't produce any usable pieces.");
  }

  const chunks: AudioChunk[] = [];
  for (let i = 0; i < chunkNames.length; i++) {
    const data = (await ffmpeg.readFile(chunkNames[i])) as Uint8Array;
    // Copy into a plain ArrayBuffer-backed view — ffmpeg.wasm's typed array
    // can be backed by a SharedArrayBuffer, which File()/Blob() reject.
    const bytes = new Uint8Array(data);
    chunks.push({
      file: new File([bytes], `${file.name.replace(/\.[^.]+$/, "")}-part${i + 1}.${ext}`, { type: file.type || "audio/mpeg" }),
      index: i,
    });
    onProgress?.(70 + Math.round(((i + 1) / chunkNames.length) * 30));
  }

  // Best-effort cleanup — never let it mask a successful split.
  await ffmpeg.deleteFile(inputName).catch(() => {});
  for (const name of chunkNames) await ffmpeg.deleteFile(name).catch(() => {});

  return chunks;
}
