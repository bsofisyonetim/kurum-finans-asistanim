// V287 — Tek otomatik yenileme akışı
const CACHE='bs-ofis-butce-v287-auto-refresh-20261127';
const ASSETS=[
  './?v=287',
  './index.html?v=287',
  './styles.css?v=219',
  './v247-design-system.css?v=247',
  './v283-ui-bundle.css?v=285',
  './app.js?v=287',
  './core-compat.js?v=287',
  './v265-shared-finance-access.js?v=287',
  './v258-education-income-sync.js?v=287',
  './v2584-income-themes.js?v=2584',
  './v2592-income-other-description.js?v=2592',
  './v2585-payment-owner-label.js?v=2586',
  './v2587-debt-owner-colors.js?v=2587',
  './v17-ui.js?v=218',
  './v175-ui.js?v=281',
  './v176-ui.js?v=218',
  './v177-ui.js?v=281',
  './v178-ui.js?v=284',
  './v2611-cash-flow-detail.js?v=2611',
  './v179-ui.js?v=281',
  './ui.js?v=281',
  './payment-plan.js?v=281',
  './payment-schedule.js?v=281',
  './exact-schedule.js?v=224',
  './debt-balance.js?v=236',
  './schedule-editor.js?v=232',
  './payment-editor-v240.js?v=240',
  './v2595-atomic-payment-create.js?v=2595',
  './v2597-debt-monthly-view.js?v=273',
  './v2598-debt-card-status.js?v=273',
  './v262-credit-card-statement.js?v=273',
  './v275-credit-cards-view.js?v=286',
  './v276-section-standard.js?v=286',
  './v230-mobile-dialog.js?v=2571',
  './v234-shell-lock.js?v=287',
  './v26122-cloud-bootstrap.js?v=287',
  './v241-payment-modal-scroll-lock.js?v=241',
  './v242-payment-save-ui.js?v=242',
  './v244-monthly-report.js?v=279',
  './v246-direct-pdf-report.js?v=2612',
  './manifest.webmanifest?v=257',
  './bs-budget-app-icon-v256.svg?v=257',
  './bs-budget-header-mark-v256.svg?v=257',
  './bs-budget-horizontal-logo-v256.svg?v=257',
  './bs-budget-horizontal-logo-v256-mono-dark.svg?v=257',
  './bs-budget-horizontal-logo-v256-mono-white.svg?v=257',
  './bs-budget-mark-v194.svg?v=195'
];

self.addEventListener('install',event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate',event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key.startsWith('bs-ofis-butce-') && key !== CACHE).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch',event => {
  const request=event.request;
  if(request.method !== 'GET' || new URL(request.url).origin !== location.origin) return;

  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    // HTML must never replace JS/CSS on offline misses.
    const isNavigation=request.mode === 'navigate';
    const url=new URL(request.url);
    const versioned=!isNavigation && url.searchParams.has('v') &&
      ASSETS.some(asset=>new URL(asset,self.location.href).href===request.url);
    if(versioned){
      const hit=await cache.match(request);
      if(hit) return hit;
    }
    try{
      const response=await fetch(request,{cache:'no-store'});
      if(response.ok){
        try{await cache.put(request,response.clone());}catch(_error){}
      }
      return response;
    }catch(_error){
      const hit=await cache.match(request);
      if(hit) return hit;
      if(isNavigation){
        const shell=await cache.match('./?v=287') || await cache.match('./index.html?v=287');
        if(shell) return shell;
      }
      return new Response('Çevrimdışı: dosya kullanılamıyor.',{
        status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}
      });
    }
  })());
});
