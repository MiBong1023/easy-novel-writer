const CACHE = 'novel-v2'
const STATIC_CACHE = 'novel-static-v2'

const PRECACHE = ['/', '/index.html']

// 정적 자산 패턴 (JS/CSS/폰트/이미지)
function isStaticAsset(url) {
  return /\.(js|css|woff2?|ttf|otf|png|jpg|jpeg|svg|ico|webp)(\?.*)?$/.test(url.pathname)
}

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE && k !== STATIC_CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return
  const url = new URL(e.request.url)

  // API 요청은 캐시 없이 네트워크만 사용
  if (url.pathname.startsWith('/api/')) return

  // Firebase / Firestore 요청은 캐시 제외
  if (url.hostname.includes('firestore.googleapis.com') ||
      url.hostname.includes('firebase') ||
      url.hostname.includes('googleapis.com')) return

  // 정적 자산: cache-first (빌드 해시가 있어 버전이 변경되면 URL도 변경됨)
  if (isStaticAsset(url)) {
    e.respondWith(
      caches.open(STATIC_CACHE).then(async c => {
        const cached = await c.match(e.request)
        if (cached) return cached
        const res = await fetch(e.request)
        if (res.ok) c.put(e.request, res.clone())
        return res
      })
    )
    return
  }

  // HTML 및 나머지: network-first, 오프라인 시 캐시 폴백
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) {
          caches.open(CACHE).then(c => c.put(e.request, res.clone()))
        }
        return res
      })
      .catch(async () => {
        const cached = await caches.match(e.request)
        if (cached) return cached
        // 오프라인 HTML 폴백
        return caches.match('/index.html')
      })
  )
})
