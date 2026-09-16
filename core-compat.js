/* BS OFİS BÜTÇE V2.6.9 - Merkezi uyumluluk ve başlangıç katmanı */
(() => {
  if(window.__bsCoreCompatLoaded) return;
  window.__bsCoreCompatLoaded = true;

  const LEGACY_APP_NAME = 'Borç ve Gelir Asistanım';
  const CURRENT_APP_NAME = 'BS Ofis Bütçe';
  const SCHEMA_VERSION = 16;

  function currentAppName(){
    const value = typeof appConfig === 'object' && appConfig
      ? String(appConfig.applicationName || '').trim()
      : '';
    return value || CURRENT_APP_NAME;
  }

  function currentOrgName(){
    return typeof state === 'object' && state?.budget
      ? String(state.budget.orgName || '').trim()
      : '';
  }

  function migrateConfig(){
    let changed = false;

    if(typeof defaultAppConfig === 'object' && defaultAppConfig){
      defaultAppConfig.schemaVersion = SCHEMA_VERSION;
      if(!defaultAppConfig.applicationName || defaultAppConfig.applicationName === LEGACY_APP_NAME){
        defaultAppConfig.applicationName = CURRENT_APP_NAME;
      }
    }

    if(typeof mergeAppConfig === 'function' && !mergeAppConfig.__bsV257Wrapped){
      const original = mergeAppConfig;
      const wrapped = function(raw={}){
        const cfg = original(raw);
        cfg.schemaVersion = SCHEMA_VERSION;
        if(!cfg.applicationName || cfg.applicationName === LEGACY_APP_NAME){
          cfg.applicationName = CURRENT_APP_NAME;
        }
        return cfg;
      };
      wrapped.__bsV257Wrapped = true;
      mergeAppConfig = wrapped;
    }

    if(typeof appConfig === 'object' && appConfig){
      if(appConfig.schemaVersion !== SCHEMA_VERSION){
        appConfig.schemaVersion = SCHEMA_VERSION;
        changed = true;
      }
      if(!appConfig.applicationName || appConfig.applicationName === LEGACY_APP_NAME){
        appConfig.applicationName = CURRENT_APP_NAME;
        changed = true;
      }
    }

    if(changed && typeof saveAppConfig === 'function'){
      saveAppConfig(false);
    }
  }

  function installViewStateGuard(){
    if(typeof renderBottomNav === 'function' && !renderBottomNav.__bsV257ViewGuard){
      const original = renderBottomNav;
      const wrapped = function(){
        const before = activeView;
        const target = document.getElementById(before);
        const validBefore = !!target?.classList?.contains('view');

        original();

        if(validBefore && before && activeView !== before){
          activeView = before;
          document.querySelectorAll('.view').forEach(view => {
            view.classList.toggle('active',view.id === before);
          });
          document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active',btn.dataset.view === before);
          });
          document.querySelector('#settingsShortcut')?.classList.toggle('active',before === 'settings');
        }
      };
      wrapped.__bsV257ViewGuard = true;
      renderBottomNav = wrapped;
    }

    if(typeof openView === 'function' && !openView.__bsV257HiddenView){
      const original = openView;
      const wrapped = function(view){
        const target = document.getElementById(view);
        const item = typeof menuItem === 'function' ? menuItem(view) : null;
        const hiddenValidView = !!(
          target?.classList?.contains('view') &&
          item &&
          !item.visible &&
          !item.locked
        );

        if(!hiddenValidView){
          return original(view);
        }

        activeView = view;
        document.querySelectorAll('.view').forEach(node => {
          node.classList.toggle('active',node.id === view);
        });
        renderBottomNav();
        window.scrollTo({top:0,behavior:'smooth'});
      };
      wrapped.__bsV257HiddenView = true;
      openView = wrapped;
    }
  }

  function installTitleRenderer(){
    if(typeof renderTitles !== 'function' || renderTitles.__bsV257Title) return;

    const original = renderTitles;
    const wrapped = function(){
      try{
        original();
      }catch(_error){
        // Eksik opsiyonel başlık hedefi tüm render akışını durdurmamalı.
      }

      const name = currentAppName();
      const orgName = currentOrgName();
      document.title = name;

      const appTitle = document.getElementById('appTitle');
      if(appTitle) appTitle.textContent = name;

      const eyebrow = document.getElementById('orgEyebrow');
      if(eyebrow){
        eyebrow.textContent = orgName
          ? orgName.toLocaleUpperCase('tr-TR')
          : '';
      }
    };

    wrapped.__bsV257Title = true;
    renderTitles = wrapped;
  }

  function installApplicationNameSaveFlow(){
    const button = document.getElementById('saveApplicationName');
    if(!button || button.__bsV257TitleSave) return;

    const original = button.onclick;
    button.onclick = async function(event){
      if(typeof original === 'function'){
        await original.call(this,event);
      }

      if(typeof renderTitles === 'function') renderTitles();
      if(typeof openView === 'function') openView('dashboard');

      window.scrollTo({top:0,behavior:'smooth'});
    };

    button.__bsV257TitleSave = true;
  }

  function installBrandAssets(){
    const iconHref = './bs-budget-app-icon-v256.svg?v=257';
    const headerHref = './bs-budget-header-mark-v256.svg?v=257';

    const mark = document.querySelector('.bs-brand-mark');
    if(mark){
      mark.src = headerHref;
      mark.alt = 'BS Ofis';
      mark.width = 44;
      mark.height = 44;
    }

    [
      ['icon','image/svg+xml'],
      ['apple-touch-icon','image/svg+xml'],
      ['apple-touch-icon-precomposed','image/svg+xml']
    ].forEach(([rel,type]) => {
      let link = document.querySelector(`link[rel="${rel}"]`);
      if(!link){
        link = document.createElement('link');
        link.rel = rel;
        document.head.appendChild(link);
      }
      link.href = iconHref;
      link.type = type;
    });

    const manifest = document.querySelector('link[rel="manifest"]');
    if(manifest) manifest.href = './manifest.webmanifest?v=257';
  }

  function installManualSpecialLessonGuard(){
    const form = document.getElementById('incomeForm');
    const typeSelect = form?.querySelector('[name="type"]');

    const specialOption = typeSelect?.querySelector('option[value="Özel Ders"]');
    if(specialOption) specialOption.remove();
    if(typeSelect && typeSelect.value === 'Özel Ders') typeSelect.value = 'Maaş';

    const studentWrap = document.getElementById('incomeStudentWrap');
    if(studentWrap){
      studentWrap.classList.add('hidden');
      studentWrap.setAttribute('aria-hidden','true');
    }

    // Eski öğrenci listesi ayarı veri uyumluluğu için korunur, kullanıcı arayüzünden kaldırılır.
    const legacyIncomeSettings = document.getElementById('incomeStudents')?.closest('.panel');
    if(legacyIncomeSettings){
      legacyIncomeSettings.classList.add('hidden');
      legacyIncomeSettings.setAttribute('aria-hidden','true');
    }

    if(form && !form.__bsV2591ManualLessonGuard){
      form.addEventListener('submit',event => {
        const type = form.querySelector('[name="type"]')?.value || '';
        if(type !== 'Özel Ders') return;

        event.preventDefault();
        event.stopImmediatePropagation();
        if(typeof toast === 'function'){
          toast('Özel ders gelirleri Eğitim Yönetimi’nden otomatik aktarılır.');
        }
      },true);
      form.__bsV2591ManualLessonGuard = true;
    }
  }

  function loadScript(src,marker){
    return new Promise((resolve,reject) => {
      if(marker && window[marker]) return resolve();

      const selector = `script[data-bs-v257-src="${src}"]`;
      const existing = document.querySelector(selector);
      if(existing){
        if(existing.dataset.loaded === '1') return resolve();
        existing.addEventListener('load',resolve,{once:true});
        existing.addEventListener('error',reject,{once:true});
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.dataset.bsV257Src = src;
      script.addEventListener('load',() => {
        script.dataset.loaded = '1';
        resolve();
      },{once:true});
      script.addEventListener('error',() => reject(new Error(`${src} yüklenemedi`)),{once:true});
      document.body.appendChild(script);
    });
  }

  async function loadOptionalModules(){
    const modules = [
      ['./v258-education-income-sync.js?v=258','__bsEducationIncomeSyncV258Loaded'],
      ['./v2584-income-themes.js?v=2584','__bsIncomeThemesV2584Loaded'],
      ['./v2592-income-other-description.js?v=2592','__bsIncomeOtherDescriptionV2592Loaded'],
      ['./v2585-payment-owner-label.js?v=2586','__bsPaymentOwnerLabelV2586Loaded'],
      ['./v2587-debt-owner-colors.js?v=2587','__bsDebtOwnerColorsV2587Loaded'],
      ['./v230-mobile-dialog.js?v=2571','__bsV235MobileDialogLoaded'],
      ['./v234-shell-lock.js?v=257','__bsV234ShellLockLoaded'],
      ['./payment-editor-v240.js?v=240','__bsPaymentEditorV240Loaded'],
      ['./v2595-atomic-payment-create.js?v=2595','__bsAtomicPaymentCreateV2595Loaded'],
      ['./v2597-debt-monthly-view.js?v=269','__bsDebtMonthlyViewV2597Loaded'],
      ['./v2598-debt-card-status.js?v=269','__bsDebtCardStatusV2598Loaded'],
      ['./v262-credit-card-statement.js?v=269','__bsDebtPaymentStructureV263Loaded'],
      ['./v241-payment-modal-scroll-lock.js?v=241','__bsV241PaymentModalScrollLockLoaded'],
      ['./v242-payment-save-ui.js?v=242','__bsV242PaymentSaveUiLoaded'],
      ['./v244-monthly-report.js?v=244','__bsMonthlyReportV244Loaded'],
      ['./v246-direct-pdf-report.js?v=246','__bsDirectPdfReportV246Loaded']
    ];

    for(const [src,marker] of modules){
      try{
        await loadScript(src,marker);
      }catch(error){
        console.error('V2.6.9 opsiyonel modül yükleme hatası:',error);
      }
    }
  }

  migrateConfig();
  installViewStateGuard();
  installTitleRenderer();
  installApplicationNameSaveFlow();
  installBrandAssets();
  installManualSpecialLessonGuard();

  if(typeof renderTitles === 'function') renderTitles();

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded',loadOptionalModules,{once:true});
  }else{
    loadOptionalModules();
  }
})();
