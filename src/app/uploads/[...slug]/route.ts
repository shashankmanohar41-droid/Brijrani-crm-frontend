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

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string[] }> }
) {
  try {
    const params = await context.params;
    const slug = params.slug || [];
    const filename = slug.join('/');

    if (!filename) {
      return new NextResponse('File not found', { status: 404 });
    }

    // 1. Try reading directly from Backend/uploads
    const backendUploads = path.join(process.cwd(), '../Backend/uploads', filename);

    if (fs.existsSync(/*turbopackIgnore: true*/ backendUploads)) {
      const ext = path.extname(backendUploads).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      const fileBuffer = await fs.promises.readFile(/*turbopackIgnore: true*/ backendUploads);

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

    // 2. Fallback to Express backend fetch
    const backendUrl = process.env.NEXT_PUBLIC_API_URL 
      ? process.env.NEXT_PUBLIC_API_URL.replace('/api/v1', '') 
      : 'http://localhost:5000';
    
    const remoteRes = await fetch(`${backendUrl}/uploads/${filename}`);
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

    return new NextResponse('File not found', { status: 404 });
  } catch (error: any) {
    console.error('Error serving upload:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
