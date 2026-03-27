import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const APP_HOST = 'app.yumoyumo.com'
const APP_PUBLIC_PATHS = new Set(['/manifest.webmanifest', '/offline'])

function getNormalizedHost(request: NextRequest): string {
  const raw =
    request.headers.get('x-forwarded-host') ??
    request.headers.get('host') ??
    request.nextUrl.host
  return raw.split(':')[0].toLowerCase().replace(/\.$/, '')
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const host = getNormalizedHost(request)

  const isAppHost = host === APP_HOST
  const isLandingHost =
    host === 'yumoyumo.com' || host === 'www.yumoyumo.com' || host.endsWith('.yumoyumo.com')

  // --- CRITICAL: /app/* on any non-app host must redirect to app subdomain (no landing should ever serve /app) ---
  const isLocalhost = host === 'localhost' || host.endsWith('.localhost')
  if (pathname.startsWith('/app') && !isAppHost && !isLocalhost) {
    const url = new URL(pathname + request.nextUrl.search, `https://${APP_HOST}`)
    return NextResponse.redirect(url, 302)
  }

  // --- App subdomain (app.yumoyumo.com): only /app/* and /api/* ---
  if (isAppHost) {
    // Allow API
    if (pathname.startsWith('/api')) {
      return NextResponse.next()
    }
    if (APP_PUBLIC_PATHS.has(pathname)) {
      return NextResponse.next()
    }
    // App root -> login
    if (pathname === '/') {
      return NextResponse.redirect(new URL('/app/login', request.url))
    }
    // Auth: /app/* (except login) requires app_session cookie
    if (pathname.startsWith('/app')) {
      if (pathname === '/app/login') {
        return NextResponse.next()
      }
      const session = request.cookies.get('app_session')?.value
      if (!session || !session.trim()) {
        return NextResponse.redirect(new URL('/app/login', request.url))
      }
      return NextResponse.next()
    }
    // On app subdomain, block non-app routes (e.g. /faq)
    return new NextResponse(null, { status: 404, statusText: 'Not Found' })
  }

  // --- Landing domain (yumoyumo.com): show landing (/app already redirected above) ---
  if (isLandingHost) {
    // Allow API on landing too (same backend)
    if (pathname.startsWith('/api')) {
      return NextResponse.next()
    }
    // Allow landing routes only: /, /faq, /funpaper, /privacy, /support, /terms
    const landingPaths = ['/', '/faq', '/funpaper', '/privacy', '/support', '/terms']
    if (landingPaths.some((p) => pathname === p || (p !== '/' && pathname.startsWith(p + '/')))) {
      const res = NextResponse.next()
      // Prevent edge/CDN from serving stale landing; always serve latest deployment
      res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
      res.headers.set('CDN-Cache-Control', 'no-store')
      res.headers.set('Vercel-CDN-Cache-Control', 'no-store')
      return res
    }
    return new NextResponse(null, { status: 404, statusText: 'Not Found' })
  }

  // --- Vercel preview / other hosts: behave like before (app-only) when on Vercel ---
  const isVercel = process.env.VERCEL === '1'
  if (isVercel) {
    if (pathname.startsWith('/api')) return NextResponse.next()
    if (pathname.startsWith('/app')) {
      if (pathname === '/app/login') return NextResponse.next()
      const session = request.cookies.get('app_session')?.value
      if (!session || !session.trim()) {
        return NextResponse.redirect(new URL('/app/login', request.url))
      }
      return NextResponse.next()
    }
    if (pathname === '/') {
      return NextResponse.redirect(new URL('/app/login', request.url))
    }
    return new NextResponse(null, { status: 404, statusText: 'Not Found' })
  }

  // Local or unknown host: allow all
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)',
  ],
}
