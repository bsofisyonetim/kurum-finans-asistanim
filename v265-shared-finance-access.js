/* BS OFİS BÜTÇE V2.6.5 - İki yetkili hesap için ortak finans verisi */
(() => {
  if (window.__bsSharedFinanceAccessV265Loaded) return;
  window.__bsSharedFinanceAccessV265Loaded = true;

  const SHARED_OWNER_ID = '7864ed02-3092-44c1-bdd5-ceb3b32f4501';
  const ALLOWED_EMAILS = new Set([
    'syalciners@gmail.com',
    'basakatilla@gmail.com'
  ]);

  const normalizeEmail = value => String(value || '').trim().toLocaleLowerCase('tr-TR');
  const isAllowedEmail = value => ALLOWED_EMAILS.has(normalizeEmail(value));
  const currentEmail = () => normalizeEmail(session?.user?.email || '');

  window.bsFinanceSharedOwnerId = SHARED_OWNER_ID;
  window.bsFinanceAllowedEmails = [...ALLOWED_EMAILS];
  window.bsFinanceIsAllowedEmail = isAllowedEmail;

  function requireAuthorizedSession() {
    if (!session?.user) throw new Error('Oturum bulunamadı.');
    if (!isAllowedEmail(session.user.email)) {
      throw new Error('Bu hesap Kurum Finans Asistanı için yetkili değil.');
    }
  }

  cloudUpsertDebt = async function(d) {
    requireAuthorizedSession();
    return checkErr(
      await sb.from('borclar').upsert({
        id: d.id,
        user_id: SHARED_OWNER_ID,
        ad: d.name,
        tur: d.type,
        ilk_tutar: d.original,
        kalan_tutar: d.balance,
        faiz_orani: d.rate,
        aylik_odeme: d.minimum,
        vade_tarihi: d.dueDate || null,
        tekrar: d.frequency,
        notlar: d.notes,
        durum: d.status,
        ekleyen: d.addedBy || deviceName(),
        ozel_alanlar: d.custom || {},
        olusturma_zamani: d.createdAt,
        guncelleme_zamani: d.updatedAt
      }, { onConflict: 'id' }),
      'Borç'
    );
  };

  cloudUpsertExpense = async function(x) {
    requireAuthorizedSession();
    return checkErr(
      await sb.from('harcamalar').upsert({
        id: x.id,
        user_id: SHARED_OWNER_ID,
        tarih: x.date,
        kategori: x.category,
        aciklama: x.description,
        tutar: x.amount,
        odeme_yontemi: x.method,
        notlar: x.notes,
        ekleyen: x.addedBy || deviceName(),
        ozel_alanlar: x.custom || {},
        olusturma_zamani: x.createdAt,
        guncelleme_zamani: x.updatedAt
      }, { onConflict: 'id' }),
      'Harcama'
    );
  };

  cloudUpsertPayment = async function(p) {
    requireAuthorizedSession();
    return checkErr(
      await sb.from('odemeler').upsert({
        id: p.id,
        user_id: SHARED_OWNER_ID,
        borc_id: p.debtId,
        tarih: p.date,
        tutar: p.amount,
        notlar: p.notes,
        ekleyen: p.addedBy || deviceName(),
        ozel_alanlar: p.custom || {},
        olusturma_zamani: p.createdAt
      }, { onConflict: 'id' }),
      'Ödeme'
    );
  };

  cloudUpsertIncome = async function(i) {
    requireAuthorizedSession();
    return checkErr(
      await sb.from('gelirler').upsert({
        id: i.id,
        user_id: SHARED_OWNER_ID,
        gelir_sahibi: i.owner,
        gelir_turu: i.type,
        ogrenci_adi: i.type === 'Özel Ders' ? (i.student || null) : null,
        gelir_tarihi: i.date,
        tutar: i.amount,
        ekleyen: i.addedBy || deviceName(),
        kaynak: i.source || null,
        kaynak_kayit_id: i.sourceRecordId || null,
        kaynak_ogrenci_id: i.sourceStudentId || null,
        otomatik_aktarim: !!i.automatic,
        olusturma_zamani: i.createdAt,
        guncelleme_zamani: i.updatedAt
      }, { onConflict: 'id' }),
      'Gelir'
    );
  };

  cloudUpsertSettings = async function() {
    requireAuthorizedSession();
    return checkErr(
      await sb.from('ayarlar').upsert({
        user_id: SHARED_OWNER_ID,
        kurum_adi: state.budget.orgName,
        aylik_gelir: +state.budget.income || 0,
        sabit_gider: +state.budget.fixedExpenses || 0,
        rezerv: +state.budget.reserve || 0
      }, { onConflict: 'user_id' }),
      'Ayarlar'
    );
  };

  cloudUpsertAppConfig = async function() {
    requireAuthorizedSession();
    return checkErr(
      await sb.from('uygulama_ayarlari').upsert({
        user_id: SHARED_OWNER_ID,
        ayarlar: appConfig
      }, { onConflict: 'user_id' }),
      'Uygulama ayarları'
    );
  };

  pullCloud = async function() {
    if (!session || syncing) return;
    requireAuthorizedSession();

    syncing = true;
    renderCloud();

    try {
      const [de, ex, pa, inc, se, ac] = await Promise.all([
        sb.from('borclar').select('*').order('olusturma_zamani', { ascending: false }),
        sb.from('harcamalar').select('*').order('tarih', { ascending: false }),
        sb.from('odemeler').select('*').order('tarih', { ascending: false }),
        sb.from('gelirler').select('*').order('gelir_tarihi', { ascending: false }),
        sb.from('ayarlar').select('*').eq('user_id', SHARED_OWNER_ID).maybeSingle(),
        sb.from('uygulama_ayarlari').select('*').eq('user_id', SHARED_OWNER_ID).maybeSingle()
      ]);

      for (const [result, label] of [
        [de, 'Borçlar'],
        [ex, 'Harcamalar'],
        [pa, 'Ödemeler'],
        [inc, 'Gelirler'],
        [se, 'Ayarlar'],
        [ac, 'Uygulama ayarları']
      ]) {
        checkErr(result, label);
      }

      state.debts = (de.data || []).map(normalizeDebt);
      state.expenses = (ex.data || []).map(normalizeExpense);
      state.payments = (pa.data || []).map(normalizePayment);
      state.incomes = (inc.data || []).map(normalizeIncome);

      if (se.data) {
        state.budget = {
          orgName: se.data.kurum_adi || '',
          income: +se.data.aylik_gelir || 0,
          fixedExpenses: +se.data.sabit_gider || 0,
          reserve: +se.data.rezerv || 0
        };
      }

      if (ac.data?.ayarlar) {
        appConfig = mergeAppConfig(ac.data.ayarlar);
        saveAppConfig(false);
      }

      saveState(false);
      renderAll();
    } catch (error) {
      console.error(error);
      alert(`Bulut senkronizasyon hatası: ${error.message}`);
    } finally {
      syncing = false;
      renderCloud();
    }
  };
  pullCloud.__bsSharedFinanceAccessV265 = true;

  function installAuthGuards() {
    const emailInput = document.getElementById('authEmail');
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');

    if (loginBtn && !loginBtn.__bsSharedFinanceGuardV265) {
      const originalLogin = loginBtn.onclick;
      loginBtn.onclick = async function(event) {
        const email = emailInput?.value || '';
        if (!isAllowedEmail(email)) {
          if (typeof toast === 'function') toast('Bu uygulamada yalnız iki yetkili hesap giriş yapabilir.');
          return;
        }
        return typeof originalLogin === 'function' ? originalLogin.call(this, event) : undefined;
      };
      loginBtn.__bsSharedFinanceGuardV265 = true;
    }

    if (registerBtn && !registerBtn.__bsSharedFinanceGuardV265) {
      const originalRegister = registerBtn.onclick;
      registerBtn.onclick = async function(event) {
        const email = emailInput?.value || '';
        if (!isAllowedEmail(email)) {
          if (typeof toast === 'function') toast('Bu uygulamada yalnız iki yetkili hesap oluşturulabilir.');
          return;
        }
        return typeof originalRegister === 'function' ? originalRegister.call(this, event) : undefined;
      };
      registerBtn.__bsSharedFinanceGuardV265 = true;
    }
  }

  installAuthGuards();

  if (session?.user?.email && isAllowedEmail(currentEmail())) {
    setTimeout(() => {
      if (typeof pullCloud === 'function') {
        pullCloud().catch(error => console.warn(error));
      }
    }, 0);
  }
})();
