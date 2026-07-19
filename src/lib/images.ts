/** Client-side image utilities: resizing, encoding, background removal. */

/** Downscale a photo to keep storage and AI payloads light. Returns a JPEG blob. */
export async function resizeToJpeg(input: Blob, maxSize = 1024): Promise<Blob> {
  const bitmap = await createImageBitmap(input);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  // White backdrop so transparent PNGs don't turn black in JPEG.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.85)
  );
  if (!blob) throw new Error("Could not process image");
  return blob;
}

/** Blob → base64 payload (no data: prefix) + mime type, for API calls. */
export async function blobToBase64(
  blob: Blob
): Promise<{ data: string; mimeType: string }> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
  const comma = dataUrl.indexOf(",");
  return {
    data: dataUrl.slice(comma + 1),
    mimeType: blob.type || "image/jpeg",
  };
}

export function base64ToBlob(data: string, mimeType: string): Blob {
  const bytes = atob(data);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mimeType });
}

/* ---------- Background removal (in a Web Worker, off the main thread) ---------- */

interface PendingJob {
  resolve: (blob: Blob | null) => void;
  onProgress?: (label: string) => void;
}

interface WorkerMsg {
  type: "progress" | "done";
  id: string;
  key?: string;
  current?: number;
  total?: number;
  ok?: boolean;
  blob?: Blob;
}

let bgWorker: Worker | null = null;
let workerBroken = false;
let jobSeq = 0;
const pendingJobs = new Map<string, PendingJob>();

function getBgWorker(): Worker | null {
  if (workerBroken) return null;
  if (bgWorker) return bgWorker;
  try {
    bgWorker = new Worker(new URL("./bg-worker.ts", import.meta.url), {
      type: "module",
    });
    bgWorker.onmessage = (e: MessageEvent<WorkerMsg>) => {
      const msg = e.data;
      const job = pendingJobs.get(msg.id);
      if (!job) return;
      if (msg.type === "progress") {
        if (job.onProgress) {
          if (msg.key?.startsWith("fetch") && msg.total) {
            const pct = Math.round(((msg.current ?? 0) / msg.total) * 100);
            job.onProgress(`Downloading AI model… ${pct}%`);
          } else {
            job.onProgress("Removing background…");
          }
        }
        return;
      }
      pendingJobs.delete(msg.id);
      job.resolve(msg.ok && msg.blob ? msg.blob : null);
    };
    bgWorker.onerror = () => {
      // Worker crashed — fail open: everyone keeps their original photo.
      for (const job of pendingJobs.values()) job.resolve(null);
      pendingJobs.clear();
      bgWorker?.terminate();
      bgWorker = null;
      workerBroken = true;
    };
    return bgWorker;
  } catch (err) {
    console.warn("Background removal worker unavailable:", err);
    workerBroken = true;
    return null;
  }
}

/**
 * Remove the background from a garment photo, fully in the browser
 * (free, no API). Runs in a Web Worker so the UI stays responsive; the
 * model downloads on first use and is cached after that. Returns null
 * on any failure/timeout so callers fall back to the original photo.
 */
export function tryRemoveBackground(
  blob: Blob,
  onProgress?: (label: string) => void
): Promise<Blob | null> {
  const worker = getBgWorker();
  if (!worker) return Promise.resolve(null);
  return new Promise((resolve) => {
    const id = `bg-${++jobSeq}`;
    const timer = setTimeout(() => {
      pendingJobs.delete(id);
      resolve(null); // took too long — keep the original photo
    }, 180_000);
    pendingJobs.set(id, {
      resolve: (result) => {
        clearTimeout(timer);
        resolve(result);
      },
      onProgress,
    });
    worker.postMessage({ id, blob });
  });
}
