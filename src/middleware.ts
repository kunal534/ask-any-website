import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Block service worker and meta files from being treated as URLs
  if (pathname === '/sw.js' || 
      pathname === '/favicon.ico' || 
      pathname === '/robots.txt' ||
      pathname === '/manifest.json') {
    return NextResponse.next();
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: '/:path*',
};
