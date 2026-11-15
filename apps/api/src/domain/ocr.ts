import { copyFile, mkdtemp, rmdir, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { imageSize } from 'image-size';
import { createWorker, OEM, type Worker } from 'tesseract.js';
import { invalid } from '../platform/errors';

export function isImage(mime: string) { return mime === 'image/png' || mime === 'image/jpeg'; }

export function checkImage(bytes: Buffer, mime: string) {
  try {
    const image = imageSize(bytes);
    const type = mime === 'image/png' ? 'png' : 'jpg';
    if (image.type !== type || !image.width || !image.height ||
      image.width > 8000 || image.height > 8000 || image.width * image.height > 16_000_000) throw new Error('Image bounds');
  } catch {
    throw invalid('Use a matching PNG or JPEG within the 16 megapixel limit');
  }
}

async function untilAbort<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  return new Promise<T>((resolve,reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener('abort',abort,{ once:true });
    void operation.then(resolve,reject).finally(() => signal.removeEventListener('abort',abort));
  });
}

export async function readImageText(bytes: Buffer, mime: string, signal?: AbortSignal) {
  checkImage(bytes,mime);
  const deadline = AbortSignal.timeout(60_000);
  const cancellation = signal ? AbortSignal.any([deadline,signal]) : deadline;
  cancellation.throwIfAborted();
  const directory = await mkdtemp(join(tmpdir(),'akw-ocr-'));
  const english = join(directory,'eng.traineddata.gz');
  const chinese = join(directory,'chi_sim.traineddata.gz');
  let worker: Worker | undefined;
  try {
    await Promise.all([
      copyFile(require.resolve('@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz'),english),
      copyFile(require.resolve('@tesseract.js-data/chi_sim/4.0.0_best_int/chi_sim.traineddata.gz'),chinese),
    ]);
    cancellation.throwIfAborted();
    const initializing = createWorker(['eng','chi_sim'],OEM.LSTM_ONLY,{ langPath:directory,cacheMethod:'none',errorHandler:() => {} });
    try { worker = await untilAbort(initializing,cancellation); }
    catch (error) {
      void initializing.then(ready => ready.terminate()).catch(() => {});
      throw error;
    }
    const recognized = await untilAbort(worker.recognize(bytes),cancellation);
    return { text:recognized.data.text,confidence:Math.round(recognized.data.confidence) };
  } finally {
    await worker?.terminate();
    await Promise.allSettled([unlink(english),unlink(chinese)]);
    await rmdir(directory).catch(() => {});
  }
}
