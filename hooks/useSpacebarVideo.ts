import { useEffect, RefObject } from "react";

/**
 * Binds spacebar to play/pause a <video> element via its ref.
 * Skips when focus is inside an input, textarea, select, or contenteditable.
 */
export function useSpacebarVideo(videoRef: RefObject<HTMLVideoElement | null>) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== " " && e.code !== "Space") return;

      const target = e.target as HTMLElement;
      const tag = target?.tagName?.toLowerCase();
      if (
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        tag === "button" ||
        target?.isContentEditable
      ) return;

      const video = videoRef.current;
      if (!video) return;

      e.preventDefault();
      if (video.paused) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [videoRef]);
}
