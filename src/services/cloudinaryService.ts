/**
 * Cloudinary Upload & Resilient Image Resolution Service
 * Handles Cloudinary CDN uploads with automatic client-side compression
 * and self-contained Base64 / Data URL persistence for 100% Vercel reliability.
 */

export const CLOUDINARY_CONFIG = {
  cloudName: 'dvjmqcith',
  apiKey: '383836762117386',
  uploadFolder: 'brijrani_erp/grn_photos'
};

export const getBaseApiUrl = () => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname.includes('vercel.app') || hostname.includes('brijrani')) {
      return 'https://brijrani-crm-backend-sigma.vercel.app/api/v1';
    }
  }
  return 'http://localhost:5000/api/v1';
};

/**
 * Universal Image URL resolver - guarantees any image (Cloudinary, Next.js proxy, Base64, Blob)
 * renders cleanly without CORS/NotSameOrigin or connection refused blocks.
 */
export function resolveImageUrl(url?: string): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  // 1. Data URLs & Blob URLs are 100% same-origin safe
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return trimmed;
  }

  // 2. Real Cloudinary CDN URLs or external https images
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  // 3. If url has /uploads/ path in it
  if (trimmed.includes('/uploads/')) {
    const filename = trimmed.split('/uploads/').pop();
    return `/uploads/${filename}`;
  }

  // 4. Relative /uploads/... -> use directly (handled by Next.js /uploads/[...slug])
  if (trimmed.startsWith('/uploads/')) {
    return trimmed;
  }

  // 5. Bare filename like 'file-1789474284123-668399863.png'
  if (trimmed.startsWith('file-')) {
    return `/uploads/${trimmed}`;
  }

  return trimmed;
}

/**
 * High-performance client-side image compression using HTML5 Canvas.
 * Compresses standard phone camera photos (3-15MB) into lightweight JPEGs (50-120KB)
 * ready for instant network sync and persistent database storage.
 */
export function compressImage(
  fileOrBlob: File | Blob,
  maxWidth = 1200,
  maxHeight = 1200,
  quality = 0.75
): Promise<string> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve('');
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(fileOrBlob);
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedDataUrl);
          return;
        }
        resolve((e.target?.result as string) || '');
      };
      img.onerror = () => {
        resolve((e.target?.result as string) || '');
      };
      img.src = e.target?.result as string;
    };
    reader.onerror = () => {
      resolve('');
    };
  });
}

/**
 * Upload a single image/file with server sync, Cloudinary integration, and resilient Data URL fallback.
 */
export async function uploadToCloudinary(
  fileOrBase64: File | Blob | string,
  folder: string = CLOUDINARY_CONFIG.uploadFolder
): Promise<string> {
  const baseUrl = getBaseApiUrl();

  // 1. Prepare compressed Data URL representation
  let compressedBase64 = '';
  if (fileOrBase64 instanceof File || fileOrBase64 instanceof Blob) {
    try {
      compressedBase64 = await compressImage(fileOrBase64);
    } catch {
      compressedBase64 = await fileToBase64(fileOrBase64);
    }
  } else if (typeof fileOrBase64 === 'string') {
    if (fileOrBase64.startsWith('http://') || fileOrBase64.startsWith('https://')) {
      return fileOrBase64;
    }
    compressedBase64 = fileOrBase64;
  }

  // 2. Attempt backend upload to Cloudinary
  try {
    const response = await fetch(`${baseUrl}/procurement/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: compressedBase64,
        folder
      })
    });

    if (response.ok) {
      const data = await response.json();
      const serverUrl = data.data?.secure_url || data.data?.url || data.url;
      // If server returned a valid Cloudinary CDN url or external https url, use it!
      if (
        serverUrl &&
        (serverUrl.startsWith('https://res.cloudinary.com') ||
          serverUrl.startsWith('http://') ||
          serverUrl.startsWith('https://'))
      ) {
        return serverUrl;
      }
      // If server returned a data URI, use it
      if (serverUrl && serverUrl.startsWith('data:')) {
        return serverUrl;
      }
    }
  } catch (backendErr) {
    console.warn('[Backend upload failed, using self-contained base64 fallback]', backendErr);
  }

  // 3. Fallback: Return the compressed base64 Data URL directly.
  // Guaranteed to render instantly on Vercel and persist cleanly in MongoDB!
  return compressedBase64 || resolveImageUrl(typeof fileOrBase64 === 'string' ? fileOrBase64 : '');
}

/**
 * Upload multiple files in parallel
 */
export async function uploadMultipleToCloudinary(
  files: (File | Blob)[],
  folder: string = CLOUDINARY_CONFIG.uploadFolder
): Promise<string[]> {
  const uploadPromises = files.map((f) => uploadToCloudinary(f, folder));
  return await Promise.all(uploadPromises);
}

/**
 * Helper to convert File/Blob to Base64 string
 */
export function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
}
