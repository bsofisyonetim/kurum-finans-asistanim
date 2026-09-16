/* BS OFİS BÜTÇE V2.6.1.2.2 - Bulut başlangıç kurtarma
   Kayıtlı Supabase bağlantısını silmez/değiştirmez; yalnız istemci motoru yüklenmezse yeniden kurar. */
(() => {
  if(window.__bsCloudBootstrapV26122Loaded) return;
  window.__bsCloudBootstrapV26122Loaded = true;

  const SUPABASE_SRC = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
  let recoveryPromise = null;

  function hasConfig(){
    return !!(cloud?.url && cloud?.key);
  }

  function setTransientStatus(text){
    const badge = document.querySelector('#syncBadge');
    if(badge && !session){
      badge.textContent = text;
      badge.className = 'status-badge offline';
    }
  }

  function loadSupabaseLibrary(){
    if(window.supabase?.createClient) return Promise.resolve(true);

    return new Promise(resolve => {
      const old = document.querySelector('script[data-v26122-supabase-retry]');
      if(old) old.remove();

      const script = document.createElement('script');
      script.src = `${SUPABASE_SRC}?v=26122-${Date.now()}`;
      script.async = true;
      script.dataset.v26122SupabaseRetry = '1';

      let settled = false;
      const finish = ok => {
        if(settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(!!ok && !!window.supabase?.createClient);
      };

      script.addEventListener('load',() => finish(true),{once:true});
      script.addEventListener('error',() => finish(false),{once:true});
      const timer = setTimeout(() => finish(false),8000);
      document.head.appendChild(script);
    });
  }

  async function recoverCloud({silent=false}={}){
    if(recoveryPromise) return recoveryPromise;

    recoveryPromise = (async() => {
      if(!hasConfig()){
        renderCloud();
        return false;
      }

      if(sb){
        renderCloud();
        return true;
      }

      setTransientStatus('Bağlanıyor…');

      const libraryReady = await loadSupabaseLibrary();
      if(!libraryReady){
        setTransientStatus('Bağlantı hatası');
        if(!silent && typeof toast === 'function'){
          toast('Bulut motoru yüklenemedi. İnternet bağlantısını kontrol edin.');
        }
        return false;
      }

      try{
        sb = window.supabase.createClient(cloud.url,cloud.key);

        const {data,error} = await sb.auth.getSession();
        if(error) throw error;
        session = data?.session || null;

        if(!window.__bsCloudBootstrapV26122AuthBound){
          window.__bsCloudBootstrapV26122AuthBound = true;
          sb.auth.onAuthStateChange((_event,nextSession) => {
            session = nextSession;
            renderCloud();
          });
        }

        renderCloud();

        if(session && typeof pullCloud === 'function'){
          try{
            await pullCloud();
          }catch(error){
            console.error('V261.2.2 bulut veri çekme hatası:',error);
            if(!silent && typeof toast === 'function'){
              toast('Bulut bağlantısı kuruldu ancak veriler yenilenemedi.');
            }
          }
        }

        renderCloud();
        return true;
      }catch(error){
        console.error('V261.2.2 bulut başlangıç kurtarma hatası:',error);
        sb = null;
        session = null;
        renderCloud();
        setTransientStatus('Bağlantı hatası');
        if(!silent && typeof toast === 'function'){
          toast('Bulut bağlantısı başlatılamadı.');
        }
        return false;
      }
    })();

    try{
      return await recoveryPromise;
    }finally{
      recoveryPromise = null;
    }
  }

  function wrapAuthButton(buttonId){
    const button = document.getElementById(buttonId);
    if(!button || button.dataset.v26122CloudWrapped === '1') return;

    const original = button.onclick;
    if(typeof original !== 'function') return;

    button.dataset.v26122CloudWrapped = '1';
    button.onclick = async function(event){
      if(!sb){
        const ready = await recoverCloud({silent:false});
        if(!ready || !sb) return;
        if(session){
          const dialog = document.querySelector('#cloudDialog');
          if(dialog?.open) dialog.close();
          if(typeof toast === 'function') toast('Bulut bağlantısı yeniden kuruldu.');
          return;
        }
      }

      return original.call(this,event);
    };
  }

  function install(){
    wrapAuthButton('loginBtn');
    wrapAuthButton('registerBtn');

    if(hasConfig() && !sb){
      recoverCloud({silent:true});
    }
  }

  install();
  window.bsRecoverCloudV26122 = () => recoverCloud({silent:false});
})();
