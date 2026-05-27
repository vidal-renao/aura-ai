import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/dashboard')) {
    const sessionCookie = request.cookies.get('aura_session');
    if (!sessionCookie?.value) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // Redirigir /login → /dashboard/inventory si ya tiene sesión activa
  if (pathname === '/login') {
    const sessionCookie = request.cookies.get('aura_session');
    if (sessionCookie?.value) {
      return NextResponse.redirect(new URL('/dashboard/inventory', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/login'],
};
