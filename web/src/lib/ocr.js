// OCR côté navigateur via tesseract.js (chargé à la demande).
let workerPromise = null;

async function getWorker(onProgress) {
  const { createWorker } = await import('tesseract.js');
  if (!workerPromise) {
    workerPromise = createWorker('fra', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text' && onProgress) onProgress(m.progress);
      },
    });
  }
  return workerPromise;
}

export async function recognize(fileOrUrl, onProgress) {
  try {
    const worker = await getWorker(onProgress);
    const { data } = await worker.recognize(fileOrUrl);
    return (data.text || '').replace(/\n{3,}/g, '\n\n').trim();
  } catch (err) {
    console.error('OCR indisponible :', err);
    return '';
  }
}

export async function terminateOcr() {
  if (workerPromise) {
    const w = await workerPromise;
    await w.terminate();
    workerPromise = null;
  }
}
