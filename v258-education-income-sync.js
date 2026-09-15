/* BS OFİS BÜTÇE V2.5.9.4 - Eğitim Supabase -> Finans gelir senkronu
   Kaynak: BS Eğitim Yönetimi Supabase tahsilatlar.
   01.08.2026 öncesi Finans'a aktarılmaz. Dağıtım ve yazma sunucu tarafında doğrulanır.
   V259.4: Eğitim kaynaklı otomatik gelirler istemci tarafından yeniden yazılamaz. */
(() => {
  if (window.__bsEducationIncomeSyncV258Loaded) return;
  window.__bsEducationIncomeSyncV258Loaded = true;

  const ENDPOINT = 'https://uspuewnaxqttaazeqmsd.supabase.co/functions/v1/finans-gelir-sync-v2';
  const EDUCATION_SOURCE = 'BS Eğitim Yönetimi / Supabase tahsilatlar';
  const MIN_INTERVAL_MS = 60 * 1000;
  let lastAttemptAt = 0;
  let inFlight = null;
  let lastControlToastAt = 0;

  function installAutomaticIncomeWriteGuard() {
    if (typeof cloudUpsertIncome !== 'function' || cloudUpsertIncome.__bsAutomaticIncomeWriteGuardV2594) return;

    const originalCloudUpsertIncome = cloudUpsertIncome;
    const guarded = async function (income) {
      const normalized = typeof normalizeIncome === 'function'
        ? normalizeIncome(income)
        : income;

      const serverOwned = normalized?.automatic === true
        || String(normalized?.source || '').trim() === EDUCATION_SOURCE;

      if (serverOwned) {
        return { skipped: 'education-income-server-owned' };
      }

      return originalCloudUpsertIncome.apply(this, arguments);
    };

    guarded.__bsAutomaticIncomeWriteGuardV2594 = true;
    cloudUpsertIncome = guarded;
  }

  async function syncEducationIncome({ force = false, mode = 'sync', paymentId = null } = {}) {
    if (!session?.access_token) {
      return { skipped: 'no-session' };
    }

    if (!cloud?.key) {
      return { skipped: 'no-finance-publishable-key' };
    }

    const now = Date.now();
    if (!force && mode === 'sync' && now - lastAttemptAt < MIN_INTERVAL_MS) {
      return { skipped: 'throttled' };
    }

    if (inFlight) return inFlight;
    lastAttemptAt = now;

    inFlight = (async () => {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'X-Finance-Publishable-Key': cloud.key,
        },
        body: JSON.stringify({ mode, paymentId }),
      });

      let data = null;
      try {
        data = await response.json();
      } catch (_error) {
        data = null;
      }

      if (!response.ok || !data?.basarili) {
        const message = data?.hata || `HTTP ${response.status}`;
        if (message === 'KONTROL_GEREKLI') {
          if (Date.now() - lastControlToastAt > 5 * 60 * 1000) {
            lastControlToastAt = Date.now();
            if (typeof toast === 'function') {
              toast('Özel ders gelirlerinde kontrol gereken kayıt var.');
            }
          }
        }
        throw new Error(`Eğitim gelir senkronu: ${message}`);
      }

      return data;
    })();

    try {
      return await inFlight;
    } finally {
      inFlight = null;
    }
  }

  installAutomaticIncomeWriteGuard();

  if (typeof pullCloud === 'function' && !pullCloud.__bsEducationIncomeSyncV258Wrapped) {
    const originalPullCloud = pullCloud;
    const wrapped = async function (...args) {
      try {
        await syncEducationIncome();
      } catch (error) {
        console.warn(error);
      }
      return originalPullCloud.apply(this, args);
    };
    wrapped.__bsEducationIncomeSyncV258Wrapped = true;
    pullCloud = wrapped;
  }

  const refreshWhenVisible = () => {
    if (document.visibilityState && document.visibilityState !== 'visible') return;
    if (!session?.access_token) return;
    if (Date.now() - lastAttemptAt < MIN_INTERVAL_MS) return;
    if (typeof pullCloud === 'function') {
      pullCloud().catch(error => console.warn(error));
    }
  };

  window.addEventListener('focus', refreshWhenVisible, { passive: true });
  document.addEventListener('visibilitychange', refreshWhenVisible, { passive: true });

  // Modül, Supabase oturumu hazırlanmışsa ilk senkronu hemen tamamlar.
  setTimeout(() => {
    if (session?.access_token && typeof pullCloud === 'function') {
      pullCloud().catch(error => console.warn(error));
    }
  }, 0);

  // Tanılama / kontrollü test için; normal kullanıcı akışı bu fonksiyonu doğrudan çağırmaz.
  window.bsEducationIncomeSyncV258 = syncEducationIncome;
})();