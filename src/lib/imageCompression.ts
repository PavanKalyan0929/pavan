export interface CompressedImageResult {
  file: File;
  width: number;
  height: number;
  originalSize: number;
  compressedSize: number;
  mimeType: string;
}

const ACCEPTED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function compressInstitutionalImage(
  inputFile: File,
  options?: {
    maxDimension?: number;
    quality?: number;
    preserveAlpha?: boolean;
  }
): Promise<CompressedImageResult> {
  if (!ACCEPTED_IMAGE_MIME.has(inputFile.type)) {
    throw new Error('Only JPEG, PNG, or WEBP photographs are supported.');
  }

  const maxDimension = options?.maxDimension ?? 1600;
  const quality = options?.quality ?? 0.82;

  const objectUrl = URL.createObjectURL(inputFile);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not decode selected image file.'));
      el.src = objectUrl;
    });

    const naturalW = img.naturalWidth || img.width || 1;
    const naturalH = img.naturalHeight || img.height || 1;
    const scale = Math.min(1, maxDimension / Math.max(naturalW, naturalH));
    const targetW = Math.max(1, Math.round(naturalW * scale));
    const targetH = Math.max(1, Math.round(naturalH * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas image compression is unavailable in this browser.');
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, targetW, targetH);

    const targetMime =
      inputFile.type === 'image/png' && options?.preserveAlpha
        ? 'image/webp'
        : 'image/webp';

    const toBlob = (mime: string, q?: number) =>
      new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, q));

    let blob = await toBlob(targetMime, quality);
    let finalMime = targetMime;

    if (!blob) {
      finalMime = inputFile.type === 'image/png' ? 'image/png' : 'image/jpeg';
      blob = await toBlob(finalMime, quality);
    }

    if (!blob) {
      return {
        file: inputFile,
        width: naturalW,
        height: naturalH,
        originalSize: inputFile.size,
        compressedSize: inputFile.size,
        mimeType: inputFile.type,
      };
    }

    // If original JPEG/WEBP was already smaller and already within maxDimension, keep whichever is smaller
    if (scale === 1 && inputFile.size <= blob.size) {
      return {
        file: inputFile,
        width: naturalW,
        height: naturalH,
        originalSize: inputFile.size,
        compressedSize: inputFile.size,
        mimeType: inputFile.type,
      };
    }

    const baseName = inputFile.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9._-]/g, '_');
    const ext = finalMime === 'image/webp' ? 'webp' : finalMime === 'image/png' ? 'png' : 'jpg';
    const compressedFile = new File([blob], `${baseName}.${ext}`, {
      type: finalMime,
      lastModified: Date.now(),
    });

    return {
      file: compressedFile,
      width: targetW,
      height: targetH,
      originalSize: inputFile.size,
      compressedSize: compressedFile.size,
      mimeType: finalMime,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
