import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
};

const FALLBACK_PLACEHOLDER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300" fill="#f8fafc">
  <rect width="400" height="300" rx="12" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="2"/>
  <circle cx="200" cy="115" r="32" fill="#e2e8f0"/>
  <path d="M120 220 L170 155 L210 195 L255 140 L310 220 Z" fill="#cbd5e1"/>
  <text x="200" y="260" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="600" fill="#64748b">Gate Photo Attachment</text>
</svg>`;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string[] }> }
) {
  try {
    const params = await context.params;
    const slug = params.slug || [];
    const filename = slug.join('/');

    if (!filename) {
      return new NextResponse(FALLBACK_PLACEHOLDER_SVG, {
        status: 200,
        headers: { 'Content-Type': 'image/svg+xml' }
      });
    }

    // 1. Try reading directly from Backend/uploads (if local dev)
    try {
      const backendUploads = path.join(process.cwd(), '../Backend/uploads', filename);
      if (fs.existsSync(backendUploads)) {
        const ext = path.extname(backendUploads).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        const fileBuffer = await fs.promises.readFile(backendUploads);

        return new NextResponse(fileBuffer, {
          status: 200,
          headers: {
            'Content-Type': contentType,
            'Content-Length': fileBuffer.length.toString(),
            'Cache-Control': 'public, max-age=86400, immutable',
            'Access-Control-Allow-Origin': '*',
            'Cross-Origin-Resource-Policy': 'cross-origin',
            'Cross-Origin-Embedder-Policy': 'unsafe-none',
          },
        });
      }
    } catch {
      // Local file read ignored
    }

    // 2. Fallback to Express backend fetch if backend URL is configured
    try {
      const backendUrl = process.env.NEXT_PUBLIC_API_URL 
        ? process.env.NEXT_PUBLIC_API_URL.replace('/api/v1', '') 
        : '';
      
      if (backendUrl && !backendUrl.includes('localhost')) {
        const remoteRes = await fetch(`${backendUrl}/uploads/${filename}`, { next: { revalidate: 3600 } });
        if (remoteRes.ok) {
          const buffer = await remoteRes.arrayBuffer();
          const contentType = remoteRes.headers.get('content-type') || 'image/png';

          return new NextResponse(buffer, {
            status: 200,
            headers: {
              'Content-Type': contentType,
              'Cache-Control': 'public, max-age=86400',
              'Access-Control-Allow-Origin': '*',
              'Cross-Origin-Resource-Policy': 'cross-origin',
              'Cross-Origin-Embedder-Policy': 'unsafe-none',
            },
          });
        }
      }
    } catch {
      // Backend proxy fetch failed
    }

    // 3. Fallback: Return standard clean placeholder SVG
    return new NextResponse(FALLBACK_PLACEHOLDER_SVG, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error: any) {
    console.error('Error serving upload:', error);
    return new NextResponse(FALLBACK_PLACEHOLDER_SVG, {
      status: 200,
      headers: { 'Content-Type': 'image/svg+xml' }
    });
  }
}
