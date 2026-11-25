export const MAX_VIDEO_BYTES = 20 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
export const MAX_FILES_PER_POST = 15;

const IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif'
]);

const VIDEO_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime'
]);

const IMAGE_EXT_RE = /\.(jpe?g|png|webp|gif|avif)$/i;
const VIDEO_EXT_RE = /\.(mp4|webm|mov)$/i;

export function isImageFile(file: File): boolean {
  return IMAGE_TYPES.has(file.type) || (!file.type && IMAGE_EXT_RE.test(file.name));
}

export function isVideoFile(file: File): boolean {
  return VIDEO_TYPES.has(file.type) || (!file.type && VIDEO_EXT_RE.test(file.name));
}

export function validateHeroImageFile(file: File): string | null {
  if (!isImageFile(file)) {
    return 'Ảnh bìa chỉ hỗ trợ tệp hình ảnh (JPG/PNG/WebP), không hỗ trợ video.';
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return 'Ảnh bìa vượt quá giới hạn 15MB.';
  }
  return null;
}

export function validateMediaFiles(files: File[]): { valid: File[]; errors: string[] } {
  const valid: File[] = [];
  const errors: string[] = [];

  for (const file of files) {
    if (isVideoFile(file)) {
      if (file.size > MAX_VIDEO_BYTES) {
        errors.push(`Video "${file.name}" vượt quá giới hạn 20MB (vui lòng cắt ngắn hơn).`);
        continue;
      }
      valid.push(file);
    } else if (isImageFile(file)) {
      if (file.size > MAX_IMAGE_BYTES) {
        errors.push(`Ảnh "${file.name}" vượt quá giới hạn 15MB.`);
        continue;
      }
      valid.push(file);
    } else {
      errors.push(`Tệp "${file.name}" có định dạng không hỗ trợ (chỉ nhận ảnh JPG/PNG/WebP và video MP4/WebM/MOV).`);
    }
  }

  if (valid.length > MAX_FILES_PER_POST) {
    errors.push(`Mỗi bài chỉ đăng tối đa ${MAX_FILES_PER_POST} ảnh/video cùng lúc.`);
    return { valid: valid.slice(0, MAX_FILES_PER_POST), errors };
  }

  return { valid, errors };
}

export async function compressImageFile(
  file: File,
  maxDim = 1600,
  quality = 0.82
): Promise<{ blob: Blob; ext: string }> {
  const fallbackExt = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : 'jpg';
  if (file.type === 'image/gif' || typeof document === 'undefined' || typeof URL.createObjectURL !== 'function') {
    return { blob: file, ext: fallbackExt };
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Không thể đọc dữ liệu ảnh.'));
      el.src = objectUrl;
    });

    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return { blob: file, ext: fallbackExt };
    }
    ctx.drawImage(img, 0, 0, width, height);

    const webpBlob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/webp', quality)
    );
    if (webpBlob && webpBlob.type === 'image/webp') {
      return { blob: webpBlob, ext: 'webp' };
    }

    const jpegBlob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', quality)
    );
    return { blob: jpegBlob || file, ext: 'jpg' };
  } catch {
    return { blob: file, ext: fallbackExt };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function readBlobBytes(blob: Blob): Promise<Uint8Array> {
  if (typeof blob.arrayBuffer === 'function') {
    return new Uint8Array(await blob.arrayBuffer());
  }
  const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new Error('Không thể đọc dữ liệu tệp.'));
    reader.readAsArrayBuffer(blob);
  });
  return new Uint8Array(buffer);
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = await readBlobBytes(blob);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  const base64 = await blobToBase64(blob);
  const mime = blob.type || 'application/octet-stream';
  return `data:${mime};base64,${base64}`;
}
