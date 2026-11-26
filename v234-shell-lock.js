/* BS OFİS BÜTÇE V2.6.1.2.2 - Uygulama kabuğu ölçüm + bulut kurtarma yükleyicisi
   Sabit header/nav stilleri v257-foundation.css içinde yüklenir. */
(() => {
  if(window.__bsV234ShellLockLoaded) return;
  window.__bsV234ShellLockLoaded = true;

  function measureBars(){
    const topbar = document.querySelector('.app-shell > .topbar');
    const bottom = document.querySelector('.app-shell > .bottom-nav');
    const root = document.documentElement;

    if(topbar){
      const height = Math.ceil(topbar.getBoundingClientRect().height);
      const value = `${Math.max(72,height + 14)}px`;
      if(root.style.getPropertyValue('--bs-shell-top-space') !== value){
        root.style.setProperty('--bs-shell-top-space',value);
      }
    }

    if(bottom){
      const height = Math.ceil(bottom.getBoundingClientRect().height);
      const value = `${Math.max(70,height + 12)}px`;
      if(root.style.getPropertyValue('--bs-shell-bottom-space') !== value){
        root.style.setProperty('--bs-shell-bottom-space',value);
      }
    }
  }

  let raf = 0;
  function scheduleMeasure(){
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      measureBars();
      raf = 0;
    });
  }

  function loadCloudBootstrap(){
    if(window.__bsCloudBootstrapV26122Loaded || document.querySelector('script[data-v26122-cloud-bootstrap]')) return;
    const script = document.createElement('script');
    script.src = './v26122-cloud-bootstrap.js?v=26122';
    script.dataset.v26122CloudBootstrap = '1';
    script.addEventListener('error',()=>console.error('V261.2.2 bulut başlangıç kurtarma modülü yüklenemedi.'),{once:true});
    document.body.appendChild(script);
  }

  measureBars();
  scheduleMeasure();
  loadCloudBootstrap();
  window.addEventListener('load',scheduleMeasure,{once:true});
  window.addEventListener('resize',scheduleMeasure,{passive:true});
  window.addEventListener('orientationchange',scheduleMeasure,{passive:true});
  if(typeof ResizeObserver === 'function'){
    const observer = new ResizeObserver(scheduleMeasure);
    const topbar = document.querySelector('.app-shell > .topbar');
    const bottom = document.querySelector('.app-shell > .bottom-nav');
    if(topbar) observer.observe(topbar);
    if(bottom) observer.observe(bottom);
  }

  if(document.fonts?.ready){
    document.fonts.ready.then(scheduleMeasure).catch(() => {});
  }
})();
