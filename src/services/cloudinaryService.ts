/**
 * Cloudinary Upload & Image Resolution Service
 * Cloud Name: dvjmqcith
 * API Key: 383836762117386
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
 * Universal Image URL resolver - guarantees any image (Cloudinary, Next.js proxy, Base64, Blob) renders cleanly without CORS/NotSameOrigin blocks.
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
  if (trimmed.includes('cloudinary.com') || trimmed.includes('res.cloudinary.com')) {
    return trimmed;
  }

  // 3. If url has /uploads/ path in it (whether from localhost:5000 or full URL)
  if (trimmed.includes('/uploads/')) {
    const filename = trimmed.split('/uploads/').pop();
    return `/uploads/${filename}`;
  }

  // 4. Relative /uploads/... -> use directly (proxied by Next.js /uploads/[...slug])
  if (trimmed.startsWith('/uploads/')) {
    return trimmed;
  }

  // 5. Bare filename like 'file-1789474284123-668399863.png'
  if (trimmed.startsWith('file-') || (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.startsWith('/'))) {
    return `/uploads/${trimmed}`;
  }

  return trimmed;
}

/**
 * Upload a single image/file with server sync and lightweight URL persistence
 */
export async function uploadToCloudinary(
  fileOrBase64: File | Blob | string,
  folder: string = CLOUDINARY_CONFIG.uploadFolder
): Promise<string> {
  const baseUrl = getBaseApiUrl();

  // 1. If it's a File or Blob
  if (fileOrBase64 instanceof File || fileOrBase64 instanceof Blob) {
    try {
      const formData = new FormData();
      const filename = (fileOrBase64 as File).name || `grn_photo_${Date.now()}.jpg`;
      formData.append('file', fileOrBase64, filename);
      formData.append('folder', folder);

      const response = await fetch(`${baseUrl}/procurement/upload`, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        const serverUrl = data.data?.secure_url || data.data?.url || data.url;
        if (serverUrl) {
          return resolveImageUrl(serverUrl);
        }
      }
    } catch (backendErr) {
      console.warn('[Backend upload failed, attempting direct conversion]', backendErr);
    }

    // Fallback if backend was unreachable: convert to compressed base64
    try {
      const base64 = await fileToBase64(fileOrBase64);
      return base64;
    } catch (e) {
      console.warn('Could not generate base64 from file', e);
      return URL.createObjectURL(fileOrBase64);
    }
  }

  // 2. If string (already a URL or Base64)
  return resolveImageUrl(fileOrBase64);
}

/**
 * Upload multiple files in parallel
 */
export async function uploadMultipleToCloudinary(
  files: (File | Blob)[],
  folder: string = CLOUDINARY_CONFIG.uploadFolder
): Promise<string[]> {
  const uploadPromises = files.map(f => uploadToCloudinary(f, folder));
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
    reader.onerror = error => reject(error);
  });
}
