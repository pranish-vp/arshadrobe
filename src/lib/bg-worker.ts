/**
 * Web Worker for background removal — keeps the heavy WASM/GPU inference
 * off the main thread so the UI never freezes.
 */
import { removeBackground } from "@imgly/background-removal";

type Job = { id: string; blob: Blob };

const post = (msg: unknown) => (self as unknown as Worker).postMessage(msg);

self.onmessage = async (e: MessageEvent<Job>) => {
  const { id, blob } = e.data;
  const progress = (key: string, current: number, total: number) =>
    post({ type: "progress", id, key, current, total });
  try {
    let result: Blob;
    try {
      // WebGPU when available (fast), otherwise CPU with the small model.
      result = await removeBackground(blob, { device: "gpu", progress });
    } catch {
      result = await removeBackground(blob, {
        device: "cpu",
        model: "isnet_quint8",
        progress,
      });
    }
    post({ type: "done", id, ok: true, blob: result });
  } catch (err) {
    post({ type: "done", id, ok: false, error: String(err) });
  }
};
