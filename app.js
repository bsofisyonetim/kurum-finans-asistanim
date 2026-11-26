const KEY='kurumFinansAsistanim.v1';
const CONFIG_KEY='kurumFinansAsistanim.cloud';
const DEVICE_KEY='kurumFinansAsistanim.deviceName';
const APP_CONFIG_KEY='kurumFinansAsistanim.appConfig.v12';

const defaultState={debts:[],expenses:[],payments:[],incomes:[],budget:{orgName:'',income:0,fixedExpenses:0,reserve:0},updatedAt:null};

const defaultAppConfig={
  schemaVersion:17,
  applicationName:'Borç ve Gelir Asistanım',
  menus:[
    {view:'dashboard',label:'Özet',icon:'⌂',visible:true,locked:false},
    {view:'debts',label:'Borçlar',icon:'▤',visible:true,locked:false},
    {view:'payments',label:'Ödemeler',icon:'✓₺',visible:true,locked:false},
    {view:'incomes',label:'Gelirler',icon:'＋₺',visible:true,locked:false},
    {view:'creditCards',label:'Kredi Kartları',icon:'▣',visible:true,locked:false},
    {view:'expenses',label:'Harcamalar',icon:'₺',visible:false,locked:false},
    {view:'settings',label:'Ayarlar',icon:'⚙',visible:true,locked:true}
  ],
  fields:{
    debts:{builtIns:[
      {id:'name',label:'Borç adı',visible:true,locked:true},
      {id:'type',label:'Tür',visible:true,locked:false},
      {id:'minimum',label:'Aylık / mevcut ödeme',visible:true,locked:false},
      {id:'dueDate',label:'Sıradaki ödeme tarihi',visible:true,locked:false},
      {id:'notes',label:'Not',visible:true,locked:false},
      {id:'original',label:'İlk borç',visible:false,locked:false},
      {id:'balance',label:'Kalan toplam borç',visible:false,locked:false},
      {id:'rate',label:'Faiz oranı',visible:false,locked:false},
      {id:'frequency',label:'Tekrar',visible:false,locked:false}
    ],custom:[
      {id:'debt_owner',label:'Borç sahibi',type:'select',options:['Süleyman','Başak'],required:true,visible:true},
      {id:'remaining_installments',label:'Kalan taksit',type:'number',options:[],required:false,visible:true},
      {id:'next_payment_after_current',label:'Sonraki aylardaki ödeme',type:'number',options:[],required:false,visible:false}
    ]},
    expenses:{builtIns:[
      {id:'date',label:'Tarih',visible:true,locked:true},
      {id:'category',label:'Kategori',visible:true,locked:false},
      {id:'description',label:'Açıklama',visible:true,locked:true},
      {id:'amount',label:'Tutar',visible:true,locked:true},
      {id:'method',label:'Ödeme yöntemi',visible:true,locked:false},
      {id:'notes',label:'Not',visible:true,locked:false}
    ],custom:[]},
    payments:{builtIns:[
      {id:'debtId',label:'Borç',visible:true,locked:true},
      {id:'date',label:'Tarih',visible:true,locked:true},
      {id:'amount',label:'Tutar',visible:true,locked:true},
      {id:'notes',label:'Not',visible:true,locked:false}
    ],custom:[]}
  },
  lists:{
    expenseCategories:['Kira','Personel','Öğretmen / Uzman Ödemesi','Vergi','Elektrik / Su / Doğalgaz','Telefon / İnternet','Malzeme','Yazılım / Abonelik','Ulaşım','Bakım / Onarım','Reklam','Yemek','Diğer'],
    paymentMethods:['Banka','Kredi Kartı','Nakit','Havale / EFT','Diğer'],
    incomeStudents:[]
  }
};

const fieldDefs={
  debts:{
    name:{type:'text',required:true,placeholder:'Örn. İşletme Kredi Kartı'},
    type:{type:'select',options:()=>['Kredi','Kredi Kartı','Kredi Kartı Yapılandırma','Elden Borç','KMH / Ek Hesap','Diğer']},
    original:{type:'number',min:0,step:'0.01'},
    balance:{type:'number',min:0,step:'0.01'},
    rate:{type:'number',min:0,step:'0.01'},
    minimum:{type:'number',min:0,step:'0.01'},
    dueDate:{type:'date'},
    frequency:{type:'select',options:()=>[
      {value:'monthly',label:'Aylık'},
      {value:'oneoff',label:'Tek sefer'}
    ]},
    notes:{type:'textarea'}
  },
  expenses:{
    date:{type:'date',required:true},
    category:{type:'select',options:()=>appConfig.lists.expenseCategories},
    description:{type:'text',required:true,placeholder:'Örn. Ağustos internet faturası'},
    amount:{type:'number',required:true,min:.01,step:'0.01'},
    method:{type:'select',options:()=>appConfig.lists.paymentMethods},
    notes:{type:'textarea'}
  },
  payments:{
    debtId:{
      type:'select',
      required:true,
      options:()=>activeDebts().map(d=>({
        value:d.id,
        label:`${d.name} — ${d.minimum>0?money(d.minimum):'Tutar girilecek'}`
      }))
    },
    date:{type:'date',required:true},
    amount:{type:'number',required:true,min:.01,step:'0.01'},
    notes:{type:'textarea'}
  }
};

let sb=null;
let session=null;
let deferredPrompt=null;
let syncing=false;
let activeView='dashboard';

const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];

function blurActiveFormControl(){
  const el=document.activeElement;
  if(el&&['INPUT','SELECT','TEXTAREA'].includes(el.tagName))el.blur();
}

const money=n=>new Intl.NumberFormat('tr-TR',{
  style:'currency',
  currency:'TRY',
  maximumFractionDigits:0
}).format(Number(n)||0);

const fmt=n=>new Intl.NumberFormat('tr-TR',{
  maximumFractionDigits:2
}).format(Number(n)||0);

const todayISO=()=>{
  const d=new Date();
  const z=d.getTimezoneOffset()*60000;
  return new Date(d-z).toISOString().slice(0,10);
};

const parseDate=s=>s?new Date(`${s}T12:00:00`):null;

const esc=s=>String(s??'').replace(
  /[&<>'"]/g,
  c=>({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    "'":'&#39;',
    '"':'&quot;'
  }[c])
);

const uid=()=>globalThis.crypto?.randomUUID?.()
  ||Date.now().toString(36)+Math.random().toString(36).slice(2);

const clone=v=>JSON.parse(JSON.stringify(v));

const deviceName=()=>localStorage.getItem(DEVICE_KEY)||'Bu telefon';

let state=loadState();
let appConfig=loadAppConfig();
let cloud=loadCloud();

function mergeAppConfig(raw={}){
  const base=clone(defaultAppConfig);
  const oldSchema=+(raw.schemaVersion||0);

  base.schemaVersion=17;

  if(raw.applicationName){
    base.applicationName=raw.applicationName;
  }

  if(Array.isArray(raw.menus)){
    const byView=new Map(raw.menus.map(x=>[x.view,x]));

    base.menus=base.menus.map(x=>({
      ...x,
      ...(byView.get(x.view)||{}),
      locked:x.view==='settings'
    }));

    const order=raw.menus.map(x=>x.view);

    base.menus.sort((a,b)=>{
      const ia=order.indexOf(a.view);
      const ib=order.indexOf(b.view);
      return (ia<0?999:ia)-(ib<0?999:ib);
    });

    if(!order.includes('incomes')){
      const income=base.menus.find(x=>x.view==='incomes');
      base.menus=base.menus.filter(x=>x.view!=='incomes');

      const di=base.menus.findIndex(x=>x.view==='debts');
      base.menus.splice(di+1,0,income);
    }
  }

  if(Array.isArray(raw.menus) && !raw.menus.some(m=>m.view==='creditCards')){
    const card=base.menus.find(m=>m.view==='creditCards');
    base.menus=base.menus.filter(m=>m.view!=='creditCards');
    base.menus.splice(base.menus.findIndex(m=>m.view==='incomes')+1,0,card);
  }

  if(oldSchema<14){
    const canonical=[
      'dashboard',
      'debts',
      'payments',
      'incomes',
      'creditCards',
      'expenses',
      'settings'
    ];

    const visibleByView={
      dashboard:true,
      debts:true,
      payments:true,
      incomes:true,
      creditCards:true,
      expenses:false,
      settings:true
    };

    base.menus.forEach(m=>{
      if(m.view in visibleByView){
        m.visible=visibleByView[m.view];
      }
      m.locked=m.view==='settings';
    });

    base.menus.sort(
      (a,b)=>canonical.indexOf(a.view)-canonical.indexOf(b.view)
    );
  }

  for(const module of ['debts','expenses','payments']){
    const r=raw.fields?.[module];
    if(!r)continue;

    if(Array.isArray(r.builtIns)){
      const map=new Map(r.builtIns.map(x=>[x.id,x]));

      base.fields[module].builtIns=
        base.fields[module].builtIns.map(x=>{
          const incoming=map.get(x.id)||{};

          if(module==='debts'&&oldSchema<13){
            return x;
          }

          return {
            ...x,
            ...incoming,
            locked:x.locked
          };
        });

      if(!(module==='debts'&&oldSchema<13)){
        const order=r.builtIns.map(x=>x.id);

        base.fields[module].builtIns.sort((a,b)=>{
          const ia=order.indexOf(a.id);
          const ib=order.indexOf(b.id);

          return (ia<0?999:ia)-(ib<0?999:ib);
        });
      }
    }

    if(Array.isArray(r.custom)){
      const custom=r.custom.map(x=>({
        id:x.id||uid(),
        label:x.label||'Özel Alan',
        type:x.type||'text',
        options:Array.isArray(x.options)?x.options:[],
        required:!!x.required,
        visible:x.visible!==false
      }));

      if(module==='debts'&&oldSchema<13){
        const known=new Set(custom.map(x=>x.id));

        for(const f of defaultAppConfig.fields.debts.custom){
          if(!known.has(f.id)){
            custom.push(clone(f));
          }
        }
      }

      base.fields[module].custom=custom;
    }
  }

  if(
    Array.isArray(raw.lists?.expenseCategories)
    &&raw.lists.expenseCategories.length
  ){
    base.lists.expenseCategories=raw.lists.expenseCategories;
  }

  if(
    Array.isArray(raw.lists?.paymentMethods)
    &&raw.lists.paymentMethods.length
  ){
    base.lists.paymentMethods=raw.lists.paymentMethods;
  }

  if(Array.isArray(raw.lists?.incomeStudents)){
    base.lists.incomeStudents=[
      ...new Set(
        raw.lists.incomeStudents
          .map(x=>String(x).trim())
          .filter(Boolean)
      )
    ];
  }

  return base;
}

function loadState(){
  try{
    return {
      ...clone(defaultState),
      ...JSON.parse(localStorage.getItem(KEY)||'{}')
    };
  }catch{
    return clone(defaultState);
  }
}

function loadAppConfig(){
  try{
    return mergeAppConfig(
      JSON.parse(localStorage.getItem(APP_CONFIG_KEY)||'{}')
    );
  }catch{
    return clone(defaultAppConfig);
  }
}

function loadCloud(){
  try{
    return JSON.parse(localStorage.getItem(CONFIG_KEY)||'{}');
  }catch{
    return {};
  }
}

function saveState(render=true){
  state.updatedAt=new Date().toISOString();
  localStorage.setItem(KEY,JSON.stringify(state));

  if(render){
    renderAll();
  }
}

function saveAppConfig(render=true){
  localStorage.setItem(APP_CONFIG_KEY,JSON.stringify(appConfig));

  if(render){
    renderAll();
  }
}

function toast(msg){
  const t=$('#toast');
  t.textContent=msg;
  t.classList.add('show');

  setTimeout(
    ()=>t.classList.remove('show'),
    2300
  );
}

function addMonths(date,n=1){
  const d=new Date(date);
  const day=d.getDate();

  d.setDate(1);
  d.setMonth(d.getMonth()+n);

  const last=new Date(
    d.getFullYear(),
    d.getMonth()+1,
    0
  ).getDate();

  d.setDate(Math.min(day,last));

  return d;
}

function normalizeDebt(d){
  return {
    id:d.id||uid(),
    name:d.name||d.ad||'',
    type:d.type||d.tur||'Diğer',
    original:+(d.original??d.ilk_tutar)||0,
    balance:+(d.balance??d.kalan_tutar)||0,
    rate:+(d.rate??d.faiz_orani)||0,
    minimum:+(d.minimum??d.aylik_odeme)||0,
    dueDate:d.dueDate??d.vade_tarihi??'',
    frequency:d.frequency||d.tekrar||'monthly',
    notes:d.notes??d.notlar??'',
    custom:d.custom??d.ozel_alanlar??{},
    status:
      d.status
      ||d.durum
      ||(
        (+(d.balance??d.kalan_tutar)||0)<=0
        ?'closed'
        :'active'
      ),
    addedBy:d.addedBy??d.ekleyen??'',
    createdAt:
      d.createdAt
      ??d.olusturma_zamani
      ??new Date().toISOString(),
    updatedAt:
      d.updatedAt
      ??d.guncelleme_zamani
      ??new Date().toISOString()
  };
}

function normalizeExpense(x){
  return {
    id:x.id||uid(),
    date:x.date||x.tarih||todayISO(),
    category:x.category||x.kategori||'Diğer',
    description:x.description||x.aciklama||'',
    amount:+(x.amount??x.tutar)||0,
    method:x.method||x.odeme_yontemi||'Banka',
    notes:x.notes??x.notlar??'',
    custom:x.custom??x.ozel_alanlar??{},
    addedBy:x.addedBy??x.ekleyen??'',
    createdAt:
      x.createdAt
      ??x.olusturma_zamani
      ??new Date().toISOString(),
    updatedAt:
      x.updatedAt
      ??x.guncelleme_zamani
      ??new Date().toISOString()
  };
}

function normalizePayment(p){
  return {
    id:p.id||uid(),
    debtId:p.debtId||p.borc_id,
    date:p.date||p.tarih||todayISO(),
    amount:+(p.amount??p.tutar)||0,
    notes:p.notes??p.notlar??'',
    custom:p.custom??p.ozel_alanlar??{},
    addedBy:p.addedBy??p.ekleyen??'',
    createdAt:
      p.createdAt
      ??p.olusturma_zamani
      ??new Date().toISOString()
  };
}

function normalizeIncome(i){
  return {
    id:i.id||uid(),
    owner:i.owner||i.gelir_sahibi||'Başak',
    type:i.type||i.gelir_turu||'Maaş',
    student:i.student??i.ogrenci_adi??'',
    date:i.date||i.gelir_tarihi||todayISO(),
    amount:+(i.amount??i.tutar)||0,
    addedBy:i.addedBy??i.ekleyen??'',
    source:i.source??i.kaynak??'',
    sourceRecordId:
      i.sourceRecordId
      ??i.kaynak_kayit_id
      ??'',
    sourceStudentId:
      i.sourceStudentId
      ??i.kaynak_ogrenci_id
      ??'',
    automatic:
      i.automatic
      ??i.otomatik_aktarim
      ??false,
    createdAt:
      i.createdAt
      ??i.olusturma_zamani
      ??new Date().toISOString(),
    updatedAt:
      i.updatedAt
      ??i.guncelleme_zamani
      ??new Date().toISOString()
  };
}

function activeDebts(){
  return state.debts
    .map(normalizeDebt)
    .filter(d=>d.status==='active');
}

function daysBetween(a,b){
  return Math.ceil((b-a)/86400000);
}

function dueItems(){
  const now=parseDate(todayISO());

  return activeDebts()
    .filter(d=>d.dueDate)
    .map(d=>{
      const date=parseDate(d.dueDate);

      return {
        ...d,
        date,
        days:daysBetween(now,date),
        amount:+d.minimum||0
      };
    })
    .sort((a,b)=>a.date-b.date);
}

function monthKey(s=todayISO()){
  return s.slice(0,7);
}

function currentMonthExpenses(){
  const m=monthKey();

  return state.expenses
    .map(normalizeExpense)
    .filter(x=>x.date?.startsWith(m));
}

function currentMonthPayments(){
  const m=monthKey();

  return state.payments
    .map(normalizePayment)
    .filter(x=>x.date?.startsWith(m));
}

function currentMonthIncomes(){
  const m=monthKey();

  return state.incomes
    .map(normalizeIncome)
    .filter(x=>x.date?.startsWith(m));
}

function previousMonthKey(){
  const d=parseDate(`${monthKey()}-01`);
  d.setMonth(d.getMonth()-1);

  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

function calcCapacity(){
  return Math.max(
    0,
    (+state.budget.income||0)
    -(+state.budget.fixedExpenses||0)
    -(+state.budget.reserve||0)
  );
}

function empty(text){
  return `<div class="empty">${esc(text)}</div>`;
}

function menuItem(view){
  return appConfig.menus.find(x=>x.view===view);
}

function fieldConfig(module,id){
  return appConfig.fields[module].builtIns.find(x=>x.id===id);
}

function fieldLabel(module,id){
  return fieldConfig(module,id)?.label||id;
}
function monthlyIncomeTotal(date=todayISO()){
  const m=monthKey(date);
  return state.incomes
    .map(normalizeIncome)
    .filter(x=>x.date?.startsWith(m))
    .reduce((s,x)=>s+x.amount,0);
}

function monthlyDebtLoad(){
  return activeDebts().reduce((s,d)=>s+(+d.minimum||0),0);
}

function populateIncomeMonths(){
  const select=$('#incomeMonth');
  const current=monthKey();

  const months=new Set([
    current,
    ...state.incomes
      .map(x=>normalizeIncome(x).date?.slice(0,7))
      .filter(Boolean)
  ]);

  const sorted=[...months].sort().reverse();
  const old=select.value||current;

  select.innerHTML=sorted.map(m=>{
    const [y,mo]=m.split('-');

    const label=new Date(+y,+mo-1,1)
      .toLocaleDateString('tr-TR',{
        month:'long',
        year:'numeric'
      });

    return `<option value="${m}">${label}</option>`;
  }).join('');

  select.value=sorted.includes(old)?old:current;
}

function incomeCard(x){
  const lesson=
    x.type==='Özel Ders'&&x.student
      ?` · ${x.student}`
      :'';

  const source=
    x.automatic||x.source
      ?` · BS Ofis`
      :'';

  return `
    <article class="list-card clickable" data-income="${esc(x.id)}">
      <div class="main">
        <strong>${esc(x.type)}${esc(lesson)}</strong>
        <small>
          ${esc(x.owner)} ·
          ${parseDate(x.date).toLocaleDateString('tr-TR')}
          ${source}
          ${x.addedBy&&!source?` · ${esc(x.addedBy)}`:''}
        </small>
      </div>

      <div class="amount">
        ${money(x.amount)}
      </div>
    </article>
  `;
}

function renderIncomes(){
  populateIncomeMonths();

  const month=$('#incomeMonth').value||monthKey();
  const owner=$('#incomeOwnerFilter').value||'all';
  const type=$('#incomeTypeFilter').value||'all';

  const monthList=state.incomes
    .map(normalizeIncome)
    .filter(x=>x.date?.startsWith(month));

  const list=monthList
    .filter(x=>
      (owner==='all'||x.owner===owner)
      &&
      (type==='all'||x.type===type)
    )
    .sort((a,b)=>
      `${b.date}${b.createdAt}`
        .localeCompare(`${a.date}${a.createdAt}`)
    );

  $('#incomeMonthlyTotal').textContent=
    money(
      monthList.reduce(
        (s,x)=>s+x.amount,
        0
      )
    );

  $('#incomeLessonTotal').textContent=
    money(
      monthList
        .filter(x=>x.type==='Özel Ders')
        .reduce((s,x)=>s+x.amount,0)
    );

  $('#incomeList').innerHTML=
    list.length
      ?list.map(incomeCard).join('')
      :empty('Bu filtrede gelir kaydı yok.');
}

function populateIncomeStudentSelect(selected=''){
  const sel=$('#incomeForm [name="student"]');
  const students=[
    ...(appConfig.lists.incomeStudents||[])
  ];

  if(selected&&!students.includes(selected)){
    students.push(selected);
  }

  sel.innerHTML=
    students.length
      ?`
        <option value="">Öğrenci seçin</option>
        ${students.map(
          x=>`<option value="${esc(x)}">${esc(x)}</option>`
        ).join('')}
      `
      :'<option value="">Önce Ayarlar’dan öğrenci ekleyin</option>';

  sel.value=selected||'';
}

function toggleIncomeStudent(){
  const special=
    $('#incomeForm [name="type"]').value==='Özel Ders';

  const wrap=$('#incomeStudentWrap');
  const sel=$('#incomeForm [name="student"]');

  wrap.classList.toggle('hidden',!special);
  sel.required=special;

  if(special){
    populateIncomeStudentSelect(sel.value);
  }
}

function openIncomeDialog(income={}){
  const f=$('#incomeForm');

  f.reset();

  f.querySelector('[name="id"]').value=
    income.id||'';

  const owner=
    income.owner
    ||(
      ['Başak','Süleyman'].includes(deviceName())
        ?deviceName()
        :'Başak'
    );

  f.querySelector('[name="owner"]').value=owner;
  f.querySelector('[name="type"]').value=income.type||'Maaş';
  f.querySelector('[name="date"]').value=income.date||todayISO();
  f.querySelector('[name="amount"]').value=income.amount||'';

  populateIncomeStudentSelect(income.student||'');

  $('#incomeDialogTitle').textContent=
    income.id
      ?'Geliri Düzenle'
      :'Yeni Gelir';

  toggleIncomeStudent();

  $('#deleteIncomeBtn')
    .classList
    .toggle('hidden',!income.id);

  $('#incomeDialog').showModal();
}

function dueCard(d){
  const badge=
    d.days<0
      ?`<span class="badge red">${Math.abs(d.days)} gün gecikti</span>`
      :d.days===0
        ?'<span class="badge orange">Bugün</span>'
        :`<span class="badge">${d.days} gün</span>`;

  const owner=d.custom?.debt_owner||'';

  return `
    <article class="list-card clickable" data-debt="${d.id}">
      <div class="main">
        <strong>${esc(d.name)}</strong>
        <small>
          ${d.date.toLocaleDateString('tr-TR')} ·
          ${badge}
          ${owner?` · ${esc(owner)}`:''}
        </small>
      </div>

      <div class="amount">
        ${d.amount>0?money(d.amount):'Tutar girilecek'}
        <small>${esc(d.type)}</small>
      </div>
    </article>
  `;
}

function debtCard(d){
  const owner=d.custom?.debt_owner||'';
  const rem=d.custom?.remaining_installments;

  const left=
    rem!==''&&rem!=null
      ?`${fmt(rem)} taksit`
      :'';

  return `
    <article class="list-card clickable" data-debt="${d.id}">
      <div class="main">
        <strong>${esc(d.name)}</strong>
        <small>
          ${owner?`${esc(owner)} · `:''}
          ${esc(d.type)}
          ${left?` · ${esc(left)}`:''}
          ${d.status==='closed'
            ?' · <span class="badge green">Kapandı</span>'
            :''
          }
        </small>
      </div>

      <div class="amount">
        ${d.minimum>0?money(d.minimum):'Tutar girilecek'}
        <small>
          ${
            d.dueDate
              ?parseDate(d.dueDate)
                .toLocaleDateString('tr-TR')
              :'Tarih girilmedi'
          }
        </small>
      </div>
    </article>
  `;
}

function expenseCard(x){
  return `
    <article class="list-card clickable" data-expense="${x.id}">
      <div class="main">
        <strong>${esc(x.description)}</strong>
        <small>
          ${parseDate(x.date).toLocaleDateString('tr-TR')} ·
          ${esc(x.category)}
          ${x.addedBy?` · ${esc(x.addedBy)}`:''}
        </small>
      </div>

      <div class="amount">
        ${money(x.amount)}
        <small>${esc(x.method)}</small>
      </div>
    </article>
  `;
}

function paymentCard(p){
  const d=state.debts
    .map(normalizeDebt)
    .find(x=>x.id===p.debtId);

  return `
    <article class="list-card clickable" data-payment="${p.id}">
      <div class="main">
        <strong>${esc(d?.name||'Silinmiş borç')}</strong>
        <small>
          ${parseDate(p.date).toLocaleDateString('tr-TR')}
          ${p.addedBy?` · ${esc(p.addedBy)}`:''}
        </small>
      </div>

      <div class="amount">
        ${money(p.amount)}
      </div>
    </article>
  `;
}

function renderDashboard(){
  const income=monthlyIncomeTotal();
  const debtLoad=monthlyDebtLoad();

  const paid=currentMonthPayments()
    .reduce((s,p)=>s+p.amount,0);

  const remaining=Math.max(
    0,
    debtLoad-paid
  );

  const due=dueItems();

  $('#totalDebt').textContent=money(income);
  $('#monthOut').textContent=money(debtLoad);
  $('#monthPaid').textContent=money(paid);
  $('#monthRemaining').textContent=money(remaining);

  $('#upcomingMini').innerHTML=
    due.length
      ?due.slice(0,3).map(dueCard).join('')
      :empty('Yaklaşan borç ödemesi yok.');

  const recent=[...state.payments]
    .map(normalizePayment)
    .sort((a,b)=>
      `${b.date}${b.createdAt}`
        .localeCompare(`${a.date}${a.createdAt}`)
    )
    .slice(0,3);

  $('#recentPayments').innerHTML=
    recent.length
      ?recent.map(paymentCard).join('')
      :empty('Henüz ödeme kaydı yok.');
}

function renderDebts(){
  const q=$('#debtSearch')
    .value
    .trim()
    .toLocaleLowerCase('tr-TR');

  const filter=$('#debtFilter').value;

  const owner=
    $('#debtOwnerFilter')?.value
    ||'all';

  const list=state.debts
    .map(normalizeDebt)
    .filter(d=>
      (
        filter==='all'
        ||(filter==='active'&&d.status==='active')
        ||(filter==='closed'&&d.status==='closed')
      )
      &&
      (
        owner==='all'
        ||d.custom?.debt_owner===owner
      )
      &&
      (
        !q
        ||`${d.name} ${d.type} ${d.notes} ${JSON.stringify(d.custom)}`
          .toLocaleLowerCase('tr-TR')
          .includes(q)
      )
    )
    .sort((a,b)=>
      a.status===b.status
        ?b.createdAt.localeCompare(a.createdAt)
        :a.status==='active'
          ?-1
          :1
    );

  $('#debtList').innerHTML=
    list.length
      ?list.map(debtCard).join('')
      :empty(
        filter==='active'
          ?'Aktif borç bulunmuyor.'
          :'Borç kaydı bulunmuyor.'
      );
}

function populateMonths(){
  const select=$('#expenseMonth');
  const current=monthKey();

  const months=new Set([
    current,
    ...state.expenses
      .map(x=>normalizeExpense(x).date.slice(0,7))
      .filter(Boolean)
  ]);

  const sorted=[...months].sort().reverse();
  const old=select.value||current;

  select.innerHTML=sorted.map(m=>{
    const [y,mo]=m.split('-');

    const label=new Date(+y,+mo-1,1)
      .toLocaleDateString('tr-TR',{
        month:'long',
        year:'numeric'
      });

    return `<option value="${m}">${label}</option>`;
  }).join('');

  select.value=sorted.includes(old)?old:current;
}

function renderExpenses(){
  populateMonths();

  const q=$('#expenseSearch')
    .value
    .trim()
    .toLocaleLowerCase('tr-TR');

  const m=$('#expenseMonth').value;

  const list=state.expenses
    .map(normalizeExpense)
    .filter(x=>
      x.date.startsWith(m)
      &&
      (
        !q
        ||`${x.description} ${x.category} ${x.method} ${x.notes} ${JSON.stringify(x.custom)}`
          .toLocaleLowerCase('tr-TR')
          .includes(q)
      )
    )
    .sort((a,b)=>
      `${b.date}${b.createdAt}`
        .localeCompare(`${a.date}${a.createdAt}`)
    );

  const total=list.reduce(
    (s,x)=>s+x.amount,
    0
  );

  $('#expenseList').innerHTML=`
    <div class="expense-total">
      <span>Seçili dönem toplamı</span>
      <strong>${money(total)}</strong>
    </div>

    ${
      list.length
        ?list.map(expenseCard).join('')
        :empty('Bu dönemde harcama yok.')
    }
  `;
}

function renderPayments(){
  const period=
    $('#paymentPeriodFilter')?.value
    ||'current';

  const current=monthKey();
  const previous=previousMonthKey();

  const list=[...state.payments]
    .map(normalizePayment)
    .filter(p=>
      period==='all'
      ||(
        period==='current'
        &&p.date?.startsWith(current)
      )
      ||(
        period==='previous'
        &&p.date?.startsWith(previous)
      )
    )
    .sort((a,b)=>
      `${b.date}${b.createdAt}`
        .localeCompare(`${a.date}${a.createdAt}`)
    );

  $('#paymentList').innerHTML=
    list.length
      ?list.map(paymentCard).join('')
      :empty(
        period==='current'
          ?'Bu ay henüz ödeme kaydı yok.'
          :period==='previous'
            ?'Geçen ay ödeme kaydı yok.'
            :'Henüz borç ödemesi yok.'
      );
}

function navIcon(view){
  const icons={
    dashboard:`
      <svg viewBox="0 0 24 24" width="21" height="21"
           fill="none" stroke="currentColor" stroke-width="1.8"
           stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 11.5 12 4l9 7.5"/>
        <path d="M5 10.5V20h14v-9.5"/>
        <path d="M9 20v-6h6v6"/>
      </svg>`,

    debts:`
      <svg viewBox="0 0 24 24" width="21" height="21"
           fill="none" stroke="currentColor" stroke-width="1.8"
           stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="5" width="18" height="14" rx="2"/>
        <path d="M3 9h18"/>
        <path d="M7 15h4"/>
      </svg>`,

    payments:`
      <svg viewBox="0 0 24 24" width="21" height="21"
           fill="none" stroke="currentColor" stroke-width="1.8"
           stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="9"/>
        <path d="m8 12 2.5 2.5L16 9"/>
      </svg>`,

    incomes:`
      <svg viewBox="0 0 24 24" width="21" height="21"
           fill="none" stroke="currentColor" stroke-width="1.8"
           stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="9"/>
        <path d="M12 8v8"/>
        <path d="M8 12h8"/>
      </svg>`,

    creditCards:`
      <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/><path d="M7 15h3"/>
      </svg>`,

    expenses:`
      <svg viewBox="0 0 24 24" width="21" height="21"
           fill="none" stroke="currentColor" stroke-width="1.8"
           stroke-linecap="round" stroke-linejoin="round">
        <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z"/>
        <path d="M9 8h6"/>
        <path d="M9 12h6"/>
      </svg>`
  };

  return icons[view]||'';
}
function renderBottomNav(){
  const visible=appConfig.menus.filter(
    x=>
      x.view!=='settings'
      &&(x.visible||x.locked)
  );

  $('#bottomNav').innerHTML=
    visible.map(x=>`
      <button
        class="nav-btn ${x.view===activeView?'active':''}"
        data-view="${x.view}"
      >
        <span>${navIcon(x.view)}</span>
        <small>${esc(x.label)}</small>
      </button>
    `).join('');

  if(
    activeView!=='settings'
    &&!visible.some(x=>x.view===activeView)
  ){
    activeView=visible[0]?.view||'dashboard';
  }

  $$('.view').forEach(
    v=>v.classList.toggle(
      'active',
      v.id===activeView
    )
  );

  $$('.nav-btn').forEach(
    b=>b.classList.toggle(
      'active',
      b.dataset.view===activeView
    )
  );

  $('#settingsShortcut')
    ?.classList
    .toggle(
      'active',
      activeView==='settings'
    );
}

function renderTitles(){
  document.title=
    appConfig.applicationName
    ||'Borç ve Gelir Asistanım';

  $('#appTitle').textContent=
    appConfig.applicationName
    ||'Borç ve Gelir Asistanım';

  $('#orgEyebrow').textContent=
    (
      state.budget.orgName
      ||'ORTAK FİNANS'
    ).toLocaleUpperCase('tr-TR');

  for(const [view,id] of [
    ['debts','debtsPageTitle'],
    ['incomes','incomesPageTitle'],
    ['creditCards','creditCardsPageTitle'],
    ['expenses','expensesPageTitle'],
    ['payments','paymentsPageTitle'],
    ['settings','settingsPageTitle']
  ]){
    const m=menuItem(view);

    if(m){
      $('#'+id).textContent=m.label;
    }
  }
}

function renderBudget(){
  const f=$('#budgetForm');

  f.orgName.value=
    state.budget.orgName||'';

  f.fixedExpenses.value=
    state.budget.fixedExpenses||'';

  f.reserve.value=
    state.budget.reserve||'';

  $('#deviceName').value=
    deviceName()==='Bu telefon'
      ?''
      :deviceName();

  $('#applicationName').value=
    appConfig.applicationName;

  $('#expenseCategories').value=
    appConfig.lists.expenseCategories.join('\n');

  $('#paymentMethods').value=
    appConfig.lists.paymentMethods.join('\n');

  $('#incomeStudents').value=
    (appConfig.lists.incomeStudents||[])
      .join('\n');
}

function renderMenuManager(){
  $('#menuManager').innerHTML=
    appConfig.menus.map((m,i)=>`
      <div class="config-row" data-menu-index="${i}">
        <div>
          ${
            m.view==='settings'
              ?'<span class="tiny" aria-label="Ayarlar sağ üstte">⚙ Sağ üstte</span>'
              :m.locked
                ?'<span class="tiny" aria-label="Zorunlu menü">🔒 Zorunlu</span>'
                :`
                  <button type="button" class="tiny" data-menu-toggle>
                    ${m.visible?'✓ Gösteriliyor':'Göster'}
                  </button>
                `
          }
        </div>

        <div class="field-meta">
          <input
            type="text"
            data-menu-label
            value="${esc(m.label)}"
            maxlength="18"
          >

          <small>
            ${
              m.view==='settings'
                ?'Alt menüde yer kaplamaz; sağ üstte sabittir'
                :m.locked
                  ?'Sistem için zorunlu; gizlenemez'
                  :(
                    m.visible
                      ?'Alt menüde görünür'
                      :'Alt menüde gizli'
                  )
            }
          </small>
        </div>

        <div class="drag-actions">
          ${
            m.view==='settings'
              ?''
              :`
                <button
                  type="button"
                  class="tiny"
                  data-menu-up
                  ${i===0?'disabled':''}
                >↑</button>

                <button
                  type="button"
                  class="tiny"
                  data-menu-down
                  ${i===appConfig.menus.length-1?'disabled':''}
                >↓</button>
              `
          }
        </div>
      </div>
    `).join('');
}

function renderFieldManager(){
  const module=$('#fieldModuleSelect').value;
  const cfg=appConfig.fields[module];

  $('#builtInFieldManager').innerHTML=
    cfg.builtIns.map((f,i)=>`
      <div class="config-row" data-built-index="${i}">
        <div>
          ${
            f.locked
              ?'<span class="tiny" aria-label="Zorunlu alan">🔒 Zorunlu</span>'
              :`
                <button
                  type="button"
                  class="tiny"
                  data-built-toggle
                >
                  ${f.visible?'✓ Gösteriliyor':'Göster'}
                </button>
              `
          }
        </div>

        <div class="field-meta">
          <input
            type="text"
            data-built-label
            value="${esc(f.label)}"
            maxlength="40"
          >

          <small>
            ${
              f.locked
                ?'Sistem için zorunlu; gizlenemez'
                :(
                  f.visible
                    ?'Standart alan · görünür'
                    :'Standart alan · gizli'
                )
            }
          </small>
        </div>

        <div class="drag-actions">
          <button
            type="button"
            class="tiny"
            data-built-up
            ${i===0?'disabled':''}
          >↑</button>

          <button
            type="button"
            class="tiny"
            data-built-down
            ${i===cfg.builtIns.length-1?'disabled':''}
          >↓</button>
        </div>
      </div>
    `).join('');

  $('#customFieldManager').innerHTML=
    cfg.custom.length
      ?cfg.custom.map((f,i)=>`
        <div class="config-row" data-custom-index="${i}">
          <button
            type="button"
            class="tiny"
            data-custom-toggle
          >
            ${f.visible!==false?'✓ Gösteriliyor':'Göster'}
          </button>

          <div class="field-meta">
            <strong>${esc(f.label)}</strong>
            <small>
              ${customTypeLabel(f.type)}
              ${f.required?' · zorunlu':''}
              ${f.visible===false?' · gizli':''}
            </small>
          </div>

          <div class="drag-actions">
            <button
              type="button"
              class="tiny"
              data-custom-edit
            >Düzenle</button>

            <button
              type="button"
              class="tiny"
              data-custom-delete
            >Sil</button>

            <button
              type="button"
              class="tiny"
              data-custom-up
              ${i===0?'disabled':''}
            >↑</button>

            <button
              type="button"
              class="tiny"
              data-custom-down
              ${i===cfg.custom.length-1?'disabled':''}
            >↓</button>
          </div>
        </div>
      `).join('')
      :empty('Henüz özel alan yok.');
}

function customTypeLabel(t){
  return ({
    text:'Metin',
    number:'Sayı / Tutar',
    date:'Tarih',
    select:'Seçim listesi',
    checkbox:'Evet / Hayır',
    textarea:'Uzun metin'
  })[t]||t;
}

function renderAll(){
  renderTitles();
  renderBottomNav();
  renderDashboard();
  renderDebts();
  renderIncomes();
  renderExpenses();
  renderPayments();
  renderBudget();
  renderMenuManager();
  renderFieldManager();
  renderCloud();
}

function openView(view){
  const m=menuItem(view);

  if(m&&!m.visible&&!m.locked){
    view='settings';
  }

  activeView=view;

  $$('.view').forEach(
    v=>v.classList.toggle(
      'active',
      v.id===view
    )
  );

  renderBottomNav();

  window.scrollTo({
    top:0,
    behavior:'smooth'
  });
}

function buildOptions(options,value){
  const arr=
    typeof options==='function'
      ?options()
      :options||[];

  return arr.map(o=>{
    const obj=
      typeof o==='string'
        ?{value:o,label:o}
        :o;

    return `
      <option
        value="${esc(obj.value)}"
        ${
          String(value??'')===String(obj.value)
            ?'selected'
            :''
        }
      >
        ${esc(obj.label)}
      </option>
    `;
  }).join('');
}

function inputHtml(name,label,def,value,required=false){
  const req=
    required||def.required
      ?'required'
      :'';

  if(def.type==='textarea'){
    return `
      <label>
        ${esc(label)}
        <textarea name="${name}" rows="2" ${req}>${esc(value??'')}</textarea>
      </label>
    `;
  }

  if(def.type==='select'){
    return `
      <label>
        ${esc(label)}
        <select name="${name}" ${req}>
          ${buildOptions(def.options,value)}
        </select>
      </label>
    `;
  }

  if(def.type==='checkbox'){
    return `
      <label class="check-row">
        <input
          type="checkbox"
          name="${name}"
          ${value?'checked':''}
        >
        ${esc(label)}
      </label>
    `;
  }

  const extra=
    def.type==='number'
      ?`inputmode="decimal" min="${def.min??0}" step="${def.step||'0.01'}"`
      :'';

  return `
    <label>
      ${esc(label)}
      <input
        name="${name}"
        type="${def.type||'text'}"
        value="${esc(value??'')}"
        ${
          def.placeholder
            ?`placeholder="${esc(def.placeholder)}"`
            :''
        }
        ${extra}
        ${req}
      >
    </label>
  `;
}

function customInputHtml(field,value){
  const def={
    type:field.type,
    required:field.required,
    options:()=>field.options||[]
  };

  return inputHtml(
    `custom__${field.id}`,
    field.label,
    def,
    value,
    field.required
  );
}

function buildRecordFields(module,record={}){
  const cfg=appConfig.fields[module];
  let html='';

  for(const f of cfg.builtIns){
    if(!f.visible&&!f.locked){
      continue;
    }

    const def=fieldDefs[module][f.id];
    let value=record[f.id];

    if(!record.id){
      if(f.id==='date'){
        value=todayISO();
      }

      if(f.id==='frequency'){
        value='monthly';
      }

      if(f.id==='category'){
        value=
          appConfig.lists.expenseCategories[0]
          ||'Diğer';
      }

      if(f.id==='method'){
        value=
          appConfig.lists.paymentMethods[0]
          ||'Banka';
      }
    }

    html+=inputHtml(
      f.id,
      f.label,
      def,
      value,
      !!f.locked
    );
  }

  for(const f of cfg.custom){
    if(f.visible===false){
      continue;
    }

    html+=customInputHtml(
      f,
      record.custom?.[f.id]
    );
  }

  return html;
}

function openRecordDialog(module,record=null){
  record=record||{};

  const form=$('#recordForm');

  form.reset();

  form.querySelector('[name="id"]').value=
    record.id||'';

  form.querySelector('[name="module"]').value=
    module;

  $('#recordDialogTitle').textContent=
    record.id
      ?'Kaydı Düzenle'
      :`Yeni ${menuItem(module)?.label||'Kayıt'}`;

  $('#recordFields').innerHTML=
    buildRecordFields(module,record);

  $('#recordDialog').showModal();
}

function parseCustomValues(fd,module,oldCustom={}){
  const out={...oldCustom};

  for(const f of appConfig.fields[module].custom){
    if(f.visible===false){
      continue;
    }

    const k=`custom__${f.id}`;

    if(f.type==='checkbox'){
      out[f.id]=fd[k]==='on';
      continue;
    }

    if(!(k in fd)){
      continue;
    }

    let v=fd[k];

    if(f.type==='number'){
      v=v===''?'':+v;
    }

    out[f.id]=v;
  }

  return out;
}

function formDefaults(module,old={}){
  if(module==='debts'){
    return {
      name:'',
      type:'Diğer',
      original:0,
      balance:0,
      rate:0,
      minimum:0,
      dueDate:'',
      frequency:'monthly',
      notes:'',
      ...old
    };
  }

  if(module==='expenses'){
    return {
      date:todayISO(),
      category:
        appConfig.lists.expenseCategories[0]
        ||'Diğer',
      description:'',
      amount:0,
      method:
        appConfig.lists.paymentMethods[0]
        ||'Banka',
      notes:'',
      ...old
    };
  }

  return {
    debtId:'',
    date:todayISO(),
    amount:0,
    notes:'',
    ...old
  };
}

function detailRows(module,record){
  const rows=[];

  for(const f of appConfig.fields[module].builtIns){
    if(!f.visible&&!f.locked){
      continue;
    }

    let v=record[f.id];

    if(f.id==='debtId'){
      v=
        state.debts
          .map(normalizeDebt)
          .find(d=>d.id===v)
          ?.name
        ||'Silinmiş borç';
    }

    if(['amount','balance','original','minimum'].includes(f.id)){
      v=money(v);
    }
    else if(f.id==='rate'){
      v=`%${fmt(v)}`;
    }
    else if(
      (f.id==='date'||f.id==='dueDate')
      &&v
    ){
      v=parseDate(v)
        .toLocaleDateString('tr-TR');
    }
    else if(f.id==='frequency'){
      v=
        v==='monthly'
          ?'Aylık'
          :'Tek sefer';
    }

    rows.push([
      f.label,
      v||'—'
    ]);
  }

  for(const f of appConfig.fields[module].custom){
    if(f.visible===false){
      continue;
    }

    let v=record.custom?.[f.id];

    if(f.type==='checkbox'){
      v=v?'Evet':'Hayır';
    }

    if(
      f.type==='number'
      &&v!==''
      &&v!=null
    ){
      v=fmt(v);
    }

    if(f.type==='date'&&v){
      v=parseDate(v)
        .toLocaleDateString('tr-TR');
    }

    rows.push([
      f.label,
      v||'—'
    ]);
  }

  return rows;
}

function showDetail(module,record){
  const rows=detailRows(module,record);
  const canEdit=module!=='payments';

  $('#detailContent').innerHTML=`
    <div class="dialog-head">
      <div>
        <p class="eyebrow">
          ${esc(menuItem(module)?.label||'KAYIT')}
        </p>

        <h3>
          ${
            esc(
              module==='debts'
                ?record.name
                :module==='expenses'
                  ?record.description
                  :'Ödeme'
            )
          }
        </h3>
      </div>

      <button
        type="button"
        class="icon-btn close-detail"
      >×</button>
    </div>

    <div class="detail-grid">
      ${
        rows.map(([k,v])=>`
          <div class="detail-row">
            <span>${esc(k)}</span>
            <strong>${esc(v)}</strong>
          </div>
        `).join('')
      }
    </div>

    <div class="detail-actions">
      ${
        module==='debts'
          ?`
            <button
              class="primary"
              data-pay="${record.id}"
            >
              Ödeme Yap
            </button>
          `
          :''
      }

      ${
        canEdit
          ?`
            <button
              class="secondary"
              data-edit-record="${module}"
              data-record-id="${record.id}"
            >
              Düzenle
            </button>
          `
          :''
      }

      ${
        module!=='payments'
          ?`
            <button
              class="danger-btn"
              data-delete-record="${module}"
              data-record-id="${record.id}"
            >
              Sil
            </button>
          `
          :''
      }
    </div>
  `;

  $('#detailDialog').showModal();
}

async function persistAppConfig(){
  saveAppConfig();

  if(session){
    try{
      await cloudUpsertAppConfig();
      toast('Uygulama ayarı kaydedildi.');
    }catch(e){
      alert(
        `Ayar buluta kaydedilemedi: ${e.message}`
      );
    }
  }else{
    toast('Ayar bu telefonda kaydedildi.');
  }
}

function swap(arr,a,b){
  if(b<0||b>=arr.length){
    return;
  }

  [arr[a],arr[b]]=[arr[b],arr[a]];
}

function renderCloud(){
  const configured=!!(
    cloud.url
    &&cloud.key
  );

  $('#cloudStepConfig')
    .classList
    .toggle(
      'hidden',
      configured
    );

  $('#cloudStepAuth')
    .classList
    .toggle(
      'hidden',
      !configured
    );

  $('#loggedOutAuth')
    .classList
    .toggle(
      'hidden',
      !!session
    );

  $('#loggedInAuth')
    .classList
    .toggle(
      'hidden',
      !session
    );

  $('#authBanner')
    .classList
    .toggle(
      'hidden',
      !!session
    );

  $('#logoutBtn')
    .classList
    .toggle(
      'hidden',
      !session
    );

  $('#syncBadge').textContent=
    session
      ?(syncing?'Senkron…':'Bulut')
      :(configured?'Giriş yok':'Yerel');

  $('#syncBadge').className=
    `status-badge ${session?'online':'offline'}`;

  $('#cloudSummary').textContent=
    session
      ?`Bağlı hesap: ${session.user.email}`
      :configured
        ?'Bulut ayarlı, kurum hesabına giriş yapılmadı.'
        :'Bulut bağlantısı yapılmadı.';

  if(session){
    $('#cloudUserEmail').textContent=
      session.user.email;
  }
}

async function initSupabase(){
  if(
    !cloud.url
    ||!cloud.key
    ||!window.supabase
  ){
    renderCloud();
    return;
  }

  try{
    sb=window.supabase.createClient(
      cloud.url,
      cloud.key
    );

    const {data}=
      await sb.auth.getSession();

    session=data.session;

    sb.auth.onAuthStateChange(
      (_e,s)=>{
        session=s;
        renderCloud();
      }
    );

    if(session){
      await pullCloud();
    }
  }catch(e){
    console.error(e);
    toast('Bulut bağlantısı başlatılamadı.');
  }

  renderCloud();
}

async function login(){
  if(!sb){
    return toast(
      'Önce bağlantı bilgilerini kaydedin.'
    );
  }

  const email=
    $('#authEmail').value.trim();

  const password=
    $('#authPassword').value;

  const {data,error}=
    await sb.auth.signInWithPassword({
      email,
      password
    });

  if(error){
    return alert(error.message);
  }

  session=data.session;

  $('#cloudDialog').close();

  toast('Kurum hesabına giriş yapıldı.');

  await pullCloud();
}

async function register(){
  if(!sb){
    return;
  }

  const email=
    $('#authEmail').value.trim();

  const password=
    $('#authPassword').value;

  if(password.length<6){
    return toast(
      'Şifre en az 6 karakter olmalı.'
    );
  }

  const {data,error}=
    await sb.auth.signUp({
      email,
      password
    });

  if(error){
    return alert(error.message);
  }

  session=data.session;

  if(session){
    toast('Kurum hesabı oluşturuldu.');
    await pushLocalToCloud();
  }else{
    alert(
      'Hesap oluşturuldu. '+
      'E-posta doğrulaması açıksa gelen bağlantıyı onaylayın, '+
      'sonra Giriş Yapın.'
    );
  }
}

async function logout(){
  if(sb){
    await sb.auth.signOut();
  }

  session=null;

  renderCloud();

  toast('Kurum hesabından çıkıldı.');
}

const checkErr=(r,label)=>{
  if(r.error){
    throw new Error(
      `${label}: ${r.error.message}`
    );
  }

  return r;
};

function applyPaymentPlan(raw,paymentDate){
  const d=normalizeDebt(raw);

  const custom={
    ...(raw.custom||raw.ozel_alanlar||{})
  };

  let rem=
    custom.remaining_installments;

  if(
    rem!==''
    &&rem!=null
    &&!Number.isNaN(+rem)
  ){
    rem=Math.max(
      0,
      +rem-1
    );

    custom.remaining_installments=rem;

    if(rem===0){
      raw.status='closed';
    }else{
      raw.status='active';
    }
  }else{
    raw.status='active';
  }

  const next=
    +custom.next_payment_after_current
    ||0;

  if(next>0){
    raw.minimum=next;
    delete custom.next_payment_after_current;
  }

  if(
    d.frequency==='monthly'
    &&d.dueDate
    &&parseDate(paymentDate)>=
      new Date(
        parseDate(d.dueDate).getTime()
        -7*86400000
      )
  ){
    raw.dueDate=
      addMonths(
        parseDate(d.dueDate),
        1
      )
      .toISOString()
      .slice(0,10);
  }

  raw.custom=custom;
  raw.updatedAt=new Date().toISOString();

  return raw;
}

async function cloudUpsertDebt(d){
  return checkErr(
    await sb.from('borclar').upsert({
      id:d.id,
      user_id:session.user.id,
      ad:d.name,
      tur:d.type,
      ilk_tutar:d.original,
      kalan_tutar:d.balance,
      faiz_orani:d.rate,
      aylik_odeme:d.minimum,
      vade_tarihi:d.dueDate||null,
      tekrar:d.frequency,
      notlar:d.notes,
      durum:d.status,
      ekleyen:d.addedBy||deviceName(),
      ozel_alanlar:d.custom||{},
      olusturma_zamani:d.createdAt,
      guncelleme_zamani:d.updatedAt
    },{
      onConflict:'id'
    }),
    'Borç'
  );
}

async function cloudUpsertExpense(x){
  return checkErr(
    await sb.from('harcamalar').upsert({
      id:x.id,
      user_id:session.user.id,
      tarih:x.date,
      kategori:x.category,
      aciklama:x.description,
      tutar:x.amount,
      odeme_yontemi:x.method,
      notlar:x.notes,
      ekleyen:x.addedBy||deviceName(),
      ozel_alanlar:x.custom||{},
      olusturma_zamani:x.createdAt,
      guncelleme_zamani:x.updatedAt
    },{
      onConflict:'id'
    }),
    'Harcama'
  );
}

async function cloudUpsertPayment(p){
  return checkErr(
    await sb.from('odemeler').upsert({
      id:p.id,
      user_id:session.user.id,
      borc_id:p.debtId,
      tarih:p.date,
      tutar:p.amount,
      notlar:p.notes,
      ekleyen:p.addedBy||deviceName(),
      ozel_alanlar:p.custom||{},
      olusturma_zamani:p.createdAt
    },{
      onConflict:'id'
    }),
    'Ödeme'
  );
}

async function cloudUpsertIncome(i){
  return checkErr(
    await sb.from('gelirler').upsert({
      id:i.id,
      user_id:session.user.id,
      gelir_sahibi:i.owner,
      gelir_turu:i.type,
      ogrenci_adi:
        i.type==='Özel Ders'
          ?(i.student||null)
          :null,
      gelir_tarihi:i.date,
      tutar:i.amount,
      ekleyen:i.addedBy||deviceName(),
      kaynak:i.source||null,
      kaynak_kayit_id:i.sourceRecordId||null,
      kaynak_ogrenci_id:i.sourceStudentId||null,
      otomatik_aktarim:!!i.automatic,
      olusturma_zamani:i.createdAt,
      guncelleme_zamani:i.updatedAt
    },{
      onConflict:'id'
    }),
    'Gelir'
  );
}

async function cloudUpsertSettings(){
  return checkErr(
    await sb.from('ayarlar').upsert({
      user_id:session.user.id,
      kurum_adi:state.budget.orgName,
      aylik_gelir:+state.budget.income||0,
      sabit_gider:+state.budget.fixedExpenses||0,
      rezerv:+state.budget.reserve||0
    },{
      onConflict:'user_id'
    }),
    'Ayarlar'
  );
}

async function cloudUpsertAppConfig(){
  return checkErr(
    await sb.from('uygulama_ayarlari').upsert({
      user_id:session.user.id,
      ayarlar:appConfig
    },{
      onConflict:'user_id'
    }),
    'Uygulama ayarları'
  );
}
async function deleteCloud(table,id){
  return checkErr(
    await sb.from(table).delete().eq('id',id),
    'Silme'
  );
}

async function pullCloud(){
  if(!session||syncing)return;

  syncing=true;
  renderCloud();

  try{
    const [de,ex,pa,inc,se,ac]=await Promise.all([
      sb.from('borclar')
        .select('*')
        .order('olusturma_zamani',{ascending:false}),

      sb.from('harcamalar')
        .select('*')
        .order('tarih',{ascending:false}),

      sb.from('odemeler')
        .select('*')
        .order('tarih',{ascending:false}),

      sb.from('gelirler')
        .select('*')
        .order('gelir_tarihi',{ascending:false}),

      sb.from('ayarlar')
        .select('*')
        .eq('user_id',session.user.id)
        .maybeSingle(),

      sb.from('uygulama_ayarlari')
        .select('*')
        .eq('user_id',session.user.id)
        .maybeSingle()
    ]);

    for(const [r,n] of [
      [de,'Borçlar'],
      [ex,'Harcamalar'],
      [pa,'Ödemeler'],
      [inc,'Gelirler'],
      [se,'Ayarlar']
    ]){
      checkErr(r,n);
    }

    if(
      ac.error
      &&ac.error.code!=='PGRST116'
    ){
      throw new Error(
        `V1.2 ayar tablosu: ${ac.error.message}`
      );
    }

    state.debts=
      (de.data||[]).map(normalizeDebt);

    state.expenses=
      (ex.data||[]).map(normalizeExpense);

    state.payments=
      (pa.data||[]).map(normalizePayment);

    state.incomes=
      (inc.data||[]).map(normalizeIncome);

    if(se.data){
      state.budget={
        orgName:se.data.kurum_adi||'',
        income:+se.data.aylik_gelir||0,
        fixedExpenses:+se.data.sabit_gider||0,
        reserve:+se.data.rezerv||0
      };
    }

    if(ac.data?.ayarlar){
      appConfig=
        mergeAppConfig(ac.data.ayarlar);

      saveAppConfig(false);
    }

    saveState(false);
    renderAll();

  }catch(e){
    console.error(e);

    alert(
      `Bulut senkronizasyon hatası: ${e.message}\n\n`+
      `V1.6 için önce v1.6_supabase_entegrasyon.sql `+
      `dosyasının Supabase SQL Editor'de bir kez `+
      `çalıştırıldığını kontrol edin.`
    );

  }finally{
    syncing=false;
    renderCloud();
  }
}

async function pushLocalToCloud(){
  if(!session||syncing)return;

  syncing=true;

  try{
    for(const d0 of state.debts){
      await cloudUpsertDebt(
        normalizeDebt(d0)
      );
    }

    for(const x0 of state.expenses){
      await cloudUpsertExpense(
        normalizeExpense(x0)
      );
    }

    for(const p0 of state.payments){
      await cloudUpsertPayment(
        normalizePayment(p0)
      );
    }

    for(const i0 of state.incomes){
      await cloudUpsertIncome(
        normalizeIncome(i0)
      );
    }

    await cloudUpsertSettings();
    await cloudUpsertAppConfig();

    syncing=false;

    await pullCloud();

    toast(
      'Yerel veri bulutla birleştirildi.'
    );

    if($('#cloudDialog')?.open){
      $('#cloudDialog').close();
    }

  }catch(e){
    console.error(e);

    alert(
      `Buluta gönderilemedi: ${e.message}`
    );

  }finally{
    syncing=false;
    renderCloud();
  }
}

async function saveDebtCloud(d){
  if(session){
    try{
      await cloudUpsertDebt(d);
      await pullCloud();
    }catch(e){
      alert(
        `Bulut kayıt hatası: ${e.message}`
      );
    }
  }
}

async function saveExpenseCloud(x){
  if(session){
    try{
      await cloudUpsertExpense(x);
      await pullCloud();
    }catch(e){
      alert(
        `Bulut kayıt hatası: ${e.message}`
      );
    }
  }
}

async function saveBudgetCloud(){
  if(session){
    try{
      await cloudUpsertSettings();
      await pullCloud();
    }catch(e){
      alert(
        `Bulut kayıt hatası: ${e.message}`
      );
    }
  }
}

async function payCloud(
  debtId,
  amount,
  date,
  notes,
  custom
){
  if(!session){
    return false;
  }

  const d0=state.debts.find(
    x=>normalizeDebt(x).id===debtId
  );

  if(!d0){
    return false;
  }

  const payment=normalizePayment({
    id:uid(),
    debtId,
    amount,
    date,
    notes:notes||'',
    custom:custom||{},
    addedBy:deviceName(),
    createdAt:new Date().toISOString()
  });

  await cloudUpsertPayment(payment);

  applyPaymentPlan(d0,date);

  await cloudUpsertDebt(
    normalizeDebt(d0)
  );

  await pullCloud();

  return true;
}

$('#bottomNav')
  .addEventListener('click',e=>{
    const b=e.target.closest('[data-view]');

    if(b){
      openView(b.dataset.view);
    }
  });

document.addEventListener('click',e=>{
  const b=e.target.closest('[data-open]');

  if(b){
    openView(b.dataset.open);
  }
});

$('#addDebtBtn').onclick=
  ()=>openRecordDialog('debts');

$('#addExpenseBtn').onclick=
  ()=>openRecordDialog('expenses');

$('#addPaymentBtn').onclick=
  ()=>openRecordDialog('payments');

$$('form').forEach(
  f=>f.addEventListener(
    'submit',
    blurActiveFormControl,
    {capture:true}
  )
);

$$('.close-dialog').forEach(
  b=>b.onclick=()=>{
    blurActiveFormControl();
    b.closest('dialog').close();
  }
);

$('#debtSearch').oninput=
  renderDebts;

$('#debtFilter').onchange=
  renderDebts;

$('#debtOwnerFilter').onchange=
  renderDebts;

$('#expenseSearch').oninput=
  renderExpenses;

$('#expenseMonth').onchange=
  renderExpenses;

$('#paymentPeriodFilter').onchange=
  renderPayments;

$$('dialog').forEach(
  d=>d.addEventListener(
    'close',
    blurActiveFormControl
  )
);

$('#recordForm').addEventListener(
  'submit',
  async e=>{
    e.preventDefault();

    const fd=
      Object.fromEntries(
        new FormData(e.target)
      );

    const module=fd.module;
    const id=fd.id||uid();

    if(module==='debts'){
      const old=
        state.debts
          .map(normalizeDebt)
          .find(x=>x.id===id);

      const base=
        formDefaults(
          module,
          old||{}
        );

      const custom=
        parseCustomValues(
          fd,
          module,
          old?.custom||{}
        );

      const d=normalizeDebt({
        ...base,
        ...fd,
        id,
        custom,

        original:
          fd.original!==undefined
            ?+fd.original
            :(old?.original||+fd.balance||0),

        balance:+fd.balance,

        rate:
          fd.rate!==undefined
            ?+fd.rate
            :(old?.rate||0),

        minimum:
          fd.minimum!==undefined
            ?+fd.minimum
            :(old?.minimum||0),

        status:
          old?.status||'active',

        addedBy:
          old?.addedBy||deviceName(),

        createdAt:
          old?.createdAt
          ||new Date().toISOString(),

        updatedAt:
          new Date().toISOString()
      });

      if(
        !fieldConfig('debts','original').visible
        &&!old
      ){
        d.original=0;
      }

      if(
        !fieldConfig('debts','balance').visible
        &&!old
      ){
        d.balance=0;
      }

      const i=
        state.debts.findIndex(
          x=>x.id===id
        );

      if(i>=0){
        state.debts[i]=d;
      }else{
        state.debts.push(d);
      }

      saveState();

      $('#recordDialog').close();

      toast(
        i>=0
          ?'Borç güncellendi.'
          :'Borç eklendi.'
      );

      await saveDebtCloud(d);
    }

    else if(module==='expenses'){
      const old=
        state.expenses
          .map(normalizeExpense)
          .find(x=>x.id===id);

      const base=
        formDefaults(
          module,
          old||{}
        );

      const custom=
        parseCustomValues(
          fd,
          module,
          old?.custom||{}
        );

      const x=normalizeExpense({
        ...base,
        ...fd,
        id,
        custom,
        amount:+fd.amount,

        addedBy:
          old?.addedBy||deviceName(),

        createdAt:
          old?.createdAt
          ||new Date().toISOString(),

        updatedAt:
          new Date().toISOString()
      });

      const i=
        state.expenses.findIndex(
          v=>v.id===id
        );

      if(i>=0){
        state.expenses[i]=x;
      }else{
        state.expenses.push(x);
      }

      saveState();

      $('#recordDialog').close();

      toast(
        i>=0
          ?'Harcama güncellendi.'
          :'Harcama eklendi.'
      );

      await saveExpenseCloud(x);
    }

    else if(module==='payments'){
      const amount=+fd.amount;

      const d=
        state.debts
          .map(normalizeDebt)
          .find(x=>x.id===fd.debtId);

      if(!d||amount<=0){
        return;
      }

      const custom=
        parseCustomValues(
          fd,
          module,
          {}
        );

      if(
        await payCloud(
          d.id,
          amount,
          fd.date,
          fd.notes,
          custom
        )
      ){
        e.target
          .closest('dialog')
          .close();

        toast(
          'Ödeme buluta kaydedildi.'
        );

        return;
      }

      state.payments.push(
        normalizePayment({
          id,
          debtId:d.id,
          amount,
          date:fd.date,
          notes:fd.notes||'',
          custom,
          addedBy:deviceName()
        })
      );

      const raw=
        state.debts.find(
          x=>x.id===d.id
        );

      applyPaymentPlan(
        raw,
        fd.date
      );

      saveState();

      $('#recordDialog').close();

      toast(
        raw.status==='closed'
          ?'Borç planı tamamlandı.'
          :'Ödeme kaydedildi.'
      );
    }
  }
);

$('#addIncomeBtn').onclick=
  ()=>openIncomeDialog();

$('#incomeForm [name="type"]')
  .onchange=
    toggleIncomeStudent;

$('#incomeOwnerFilter').onchange=
  renderIncomes;

$('#incomeTypeFilter').onchange=
  renderIncomes;

$('#incomeMonth').onchange=
  renderIncomes;

$('#incomeForm').addEventListener(
  'submit',
  async e=>{
    e.preventDefault();

    const fd=
      Object.fromEntries(
        new FormData(e.target)
      );

    if(
      fd.type==='Özel Ders'
      &&!fd.student
    ){
      return toast(
        'Özel ders için öğrenci seçin. '+
        'Öğrencileri Ayarlar’dan ekleyebilirsiniz.'
      );
    }

    const now=
      new Date().toISOString();

    const id=
      fd.id||uid();

    const old=
      state.incomes
        .map(normalizeIncome)
        .find(x=>x.id===id);

    const obj=
      normalizeIncome({
        id,
        owner:fd.owner,
        type:fd.type,

        student:
          fd.type==='Özel Ders'
            ?fd.student
            :'',

        date:fd.date,
        amount:+fd.amount||0,

        addedBy:
          old?.addedBy||deviceName(),

        source:
          old?.source||'',

        sourceRecordId:
          old?.sourceRecordId||'',

        sourceStudentId:
          old?.sourceStudentId||'',

        automatic:
          !!old?.automatic,

        createdAt:
          old?.createdAt||now,

        updatedAt:now
      });

    const i=
      state.incomes.findIndex(
        x=>normalizeIncome(x).id===id
      );

    if(i>=0){
      state.incomes[i]=obj;
    }else{
      state.incomes.push(obj);
    }

    $('#incomeDialog').close();

    saveState(false);

    if(session){
      try{
        await cloudUpsertIncome(obj);
        await pullCloud();

        toast(
          'Gelir kaydedildi.'
        );
      }catch(er){
        alert(
          `Gelir buluta kaydedilemedi: ${er.message}`
        );
      }
    }else{
      renderAll();

      toast(
        'Gelir bu telefonda kaydedildi.'
      );
    }
  }
);

$('#incomeList').addEventListener(
  'click',
  e=>{
    const row=
      e.target.closest('[data-income]');

    if(!row){
      return;
    }

    const income=
      state.incomes
        .map(normalizeIncome)
        .find(
          x=>x.id===row.dataset.income
        );

    if(income){
      openIncomeDialog(income);
    }
  }
);

$('#deleteIncomeBtn').onclick=
  async()=>{
    const id=
      $('#incomeForm [name="id"]').value;

    if(!id){
      return;
    }

    if(
      !confirm(
        'Bu gelir kaydı silinsin mi?'
      )
    ){
      return;
    }

    try{
      if(session){
        await deleteCloud(
          'gelirler',
          id
        );

        await pullCloud();
      }else{
        state.incomes=
          state.incomes.filter(
            x=>normalizeIncome(x).id!==id
          );

        saveState();
      }

      $('#incomeDialog').close();

      toast(
        'Gelir silindi.'
      );

    }catch(er){
      alert(er.message);
    }
  };

$('#budgetForm').addEventListener(
  'submit',
  async e=>{
    e.preventDefault();

    const fd=
      Object.fromEntries(
        new FormData(e.target)
      );

    state.budget={
      orgName:fd.orgName||'',
      income:+fd.income||0,
      fixedExpenses:+fd.fixedExpenses||0,
      reserve:+fd.reserve||0
    };

    saveState();

    toast(
      'Bütçe kaydedildi.'
    );

    await saveBudgetCloud();
  }
);

$('#saveDeviceName').onclick=()=>{
  const name=
    $('#deviceName')
      .value
      .trim();

  localStorage.setItem(
    DEVICE_KEY,
    name||'Bu telefon'
  );

  toast(
    'Telefon adı kaydedildi.'
  );
};

$('#saveApplicationName').onclick=
  async()=>{
    appConfig.applicationName=
      $('#applicationName')
        .value
        .trim()
      ||'Borç ve Gelir Asistanım';

    await persistAppConfig();
  };

$('#saveListsBtn').onclick=
  async()=>{
    const cats=
      $('#expenseCategories')
        .value
        .split('\n')
        .map(x=>x.trim())
        .filter(Boolean);

    const methods=
      $('#paymentMethods')
        .value
        .split('\n')
        .map(x=>x.trim())
        .filter(Boolean);

    if(
      !cats.length
      ||!methods.length
    ){
      return toast(
        'Listeler boş bırakılamaz.'
      );
    }

    appConfig.lists.expenseCategories=[
      ...new Set(cats)
    ];

    appConfig.lists.paymentMethods=[
      ...new Set(methods)
    ];

    await persistAppConfig();
  };

$('#saveIncomeStudentsBtn').onclick=
  async()=>{
    const students=
      $('#incomeStudents')
        .value
        .split('\n')
        .map(x=>x.trim())
        .filter(Boolean);

    appConfig.lists.incomeStudents=[
      ...new Set(students)
    ];

    await persistAppConfig();

    toast(
      'Öğrenci listesi kaydedildi.'
    );
  };

$('#menuManager').addEventListener(
  'change',
  async e=>{
    const row=
      e.target.closest(
        '[data-menu-index]'
      );

    if(
      !row
      ||!e.target.matches(
        '[data-menu-label]'
      )
    ){
      return;
    }

    const i=
      +row.dataset.menuIndex;

    const m=
      appConfig.menus[i];

    m.label=
      e.target.value.trim()
      ||defaultAppConfig.menus.find(
        x=>x.view===m.view
      )?.label
      ||m.view;

    await persistAppConfig();
  }
);

$('#menuManager').addEventListener(
  'click',
  async e=>{
    const row=
      e.target.closest(
        '[data-menu-index]'
      );

    if(!row){
      return;
    }

    const i=
      +row.dataset.menuIndex;

    const m=
      appConfig.menus[i];

    if(
      e.target.matches(
        '[data-menu-toggle]'
      )
      &&!m.locked
    ){
      m.visible=!m.visible;

      await persistAppConfig();
      return;
    }

    if(
      e.target.matches(
        '[data-menu-up]'
      )
    ){
      swap(
        appConfig.menus,
        i,
        i-1
      );
    }

    else if(
      e.target.matches(
        '[data-menu-down]'
      )
    ){
      swap(
        appConfig.menus,
        i,
        i+1
      );
    }

    else{
      return;
    }

    await persistAppConfig();
  }
);

$('#fieldModuleSelect').onchange=
  renderFieldManager;

$('#builtInFieldManager')
  .addEventListener(
    'change',
    async e=>{
      const row=
        e.target.closest(
          '[data-built-index]'
        );

      if(
        !row
        ||!e.target.matches(
          '[data-built-label]'
        )
      ){
        return;
      }

      const module=
        $('#fieldModuleSelect').value;

      const i=
        +row.dataset.builtIndex;

      const f=
        appConfig.fields[module]
          .builtIns[i];

      f.label=
        e.target.value.trim()
        ||defaultAppConfig
          .fields[module]
          .builtIns
          .find(
            x=>x.id===f.id
          )?.label
        ||f.id;

      await persistAppConfig();
    }
  );

$('#builtInFieldManager')
  .addEventListener(
    'click',
    async e=>{
      const row=
        e.target.closest(
          '[data-built-index]'
        );

      if(!row){
        return;
      }

      const module=
        $('#fieldModuleSelect').value;

      const i=
        +row.dataset.builtIndex;

      const arr=
        appConfig.fields[module]
          .builtIns;

      const f=arr[i];

      if(
        e.target.matches(
          '[data-built-toggle]'
        )
        &&!f.locked
      ){
        f.visible=!f.visible;

        await persistAppConfig();
        return;
      }

      if(
        e.target.matches(
          '[data-built-up]'
        )
      ){
        swap(
          arr,
          i,
          i-1
        );
      }

      else if(
        e.target.matches(
          '[data-built-down]'
        )
      ){
        swap(
          arr,
          i,
          i+1
        );
      }

      else{
        return;
      }

      await persistAppConfig();
    }
  );

$('#addCustomFieldBtn').onclick=()=>{
  const f=$('#customFieldForm');

  f.reset();

  f.querySelector(
    '[name="fieldId"]'
  ).value='';

  $('#customOptionsWrap')
    .classList
    .add('hidden');

  $('#customFieldDialog')
    .showModal();
};

$('#customFieldForm [name="type"]')
  .onchange=e=>
    $('#customOptionsWrap')
      .classList
      .toggle(
        'hidden',
        e.target.value!=='select'
      );

$('#customFieldForm').addEventListener(
  'submit',
  async e=>{
    e.preventDefault();

    const fd=
      Object.fromEntries(
        new FormData(e.target)
      );

    const module=
      $('#fieldModuleSelect').value;

    const arr=
      appConfig.fields[module].custom;

    const id=
      fd.fieldId||uid();

    const obj={
      id,
      label:fd.label.trim(),
      type:fd.type,
      required:fd.required==='on',
      visible:true,

      options:
        fd.type==='select'
          ?fd.options
            .split('\n')
            .map(x=>x.trim())
            .filter(Boolean)
          :[]
    };

    const i=
      arr.findIndex(
        x=>x.id===id
      );

    if(i>=0){
      obj.visible=
        arr[i].visible!==false;
    }

    if(i>=0){
      arr[i]=obj;
    }else{
      arr.push(obj);
    }

    $('#customFieldDialog')
      .close();

    await persistAppConfig();
  }
);

$('#customFieldManager').addEventListener(
  'click',
  async e=>{
    const row=
      e.target.closest(
        '[data-custom-index]'
      );

    if(!row){
      return;
    }

    const module=
      $('#fieldModuleSelect').value;

    const i=
      +row.dataset.customIndex;

    const arr=
      appConfig.fields[module].custom;

    const f=arr[i];

    if(
      e.target.matches(
        '[data-custom-toggle]'
      )
    ){
      f.visible=
        f.visible===false;

      await persistAppConfig();
      return;
    }

    if(
      e.target.matches(
        '[data-custom-edit]'
      )
    ){
      const form=
        $('#customFieldForm');

      form.querySelector(
        '[name="fieldId"]'
      ).value=f.id;

      form.querySelector(
        '[name="label"]'
      ).value=f.label;

      form.querySelector(
        '[name="type"]'
      ).value=f.type;

      form.querySelector(
        '[name="options"]'
      ).value=
        (f.options||[]).join('\n');

      form.querySelector(
        '[name="required"]'
      ).checked=!!f.required;

      $('#customOptionsWrap')
        .classList
        .toggle(
          'hidden',
          f.type!=='select'
        );

      $('#customFieldDialog')
        .showModal();

      return;
    }

    if(
      e.target.matches(
        '[data-custom-delete]'
      )
    ){
      if(
        !confirm(
          `“${f.label}” alanı formdan kaldırılsın mı? `+
          `Eski kayıtlardaki veri güvenlik için silinmez.`
        )
      ){
        return;
      }

      arr.splice(i,1);
    }

    else if(
      e.target.matches(
        '[data-custom-up]'
      )
    ){
      swap(
        arr,
        i,
        i-1
      );
    }

    else if(
      e.target.matches(
        '[data-custom-down]'
      )
    ){
      swap(
        arr,
        i,
        i+1
      );
    }

    else{
      return;
    }

    await persistAppConfig();
  }
);

document.addEventListener(
  'click',
  async e=>{
    if(
      e.target.closest(
        '.close-detail'
      )
    ){
      $('#detailDialog').close();
      return;
    }

    const debt=
      e.target.closest(
        '[data-debt]'
      );

    if(debt){
      const d=
        state.debts
          .map(normalizeDebt)
          .find(
            x=>x.id===debt.dataset.debt
          );

      if(d){
        showDetail(
          'debts',
          d
        );
      }

      return;
    }

    const expense=
      e.target.closest(
        '[data-expense]'
      );

    if(expense){
      const x=
        state.expenses
          .map(normalizeExpense)
          .find(
            v=>v.id===expense.dataset.expense
          );

      if(x){
        showDetail(
          'expenses',
          x
        );
      }

      return;
    }

    const payment=
      e.target.closest(
        '[data-payment]'
      );

    if(payment){
      const p=
        state.payments
          .map(normalizePayment)
          .find(
            v=>v.id===payment.dataset.payment
          );

      if(p){
        showDetail(
          'payments',
          p
        );
      }

      return;
    }

    const pay=
      e.target.closest('[data-pay]');

    if(pay){
      $('#detailDialog').close();

      openRecordDialog(
        'payments',
        {
          debtId:pay.dataset.pay,
          date:todayISO()
        }
      );

      return;
    }

    const edit=
      e.target.closest(
        '[data-edit-record]'
      );

    if(edit){
      const module=
        edit.dataset.editRecord;

      const id=
        edit.dataset.recordId;

      const record=
        module==='debts'
          ?state.debts
            .map(normalizeDebt)
            .find(x=>x.id===id)
          :state.expenses
            .map(normalizeExpense)
            .find(x=>x.id===id);

      $('#detailDialog').close();

      if(record){
        openRecordDialog(
          module,
          record
        );
      }

      return;
    }

    const del=
      e.target.closest(
        '[data-delete-record]'
      );

    if(del){
      const module=
        del.dataset.deleteRecord;

      const id=
        del.dataset.recordId;

      if(
        !confirm(
          'Bu kayıt silinsin mi?'
        )
      ){
        return;
      }

      try{
        if(session){
          const table={
            debts:'borclar',
            expenses:'harcamalar',
            payments:'odemeler'
          }[module];

          await deleteCloud(
            table,
            id
          );

          await pullCloud();
        }

        else if(module==='debts'){
          state.debts=
            state.debts.filter(
              x=>x.id!==id
            );

          state.payments=
            state.payments.filter(
              x=>
                normalizePayment(x)
                  .debtId!==id
            );

          saveState();
        }

        else if(module==='expenses'){
          state.expenses=
            state.expenses.filter(
              x=>x.id!==id
            );

          saveState();
        }

        else{
          state.payments=
            state.payments.filter(
              x=>x.id!==id
            );

          saveState();
        }

        $('#detailDialog').close();

        toast(
          'Kayıt silindi.'
        );

      }catch(er){
        alert(er.message);
      }
    }
  }
);

$('#exportBtn').onclick=()=>{
  const blob=new Blob(
    [
      JSON.stringify(
        {state,appConfig},
        null,
        2
      )
    ],
    {
      type:'application/json'
    }
  );

  const a=
    document.createElement('a');

  a.href=
    URL.createObjectURL(blob);

  a.download=
    `kurum-finans-yedek-${todayISO()}.json`;

  a.click();

  URL.revokeObjectURL(a.href);
};

$('#importInput').onchange=
  async e=>{
    const f=e.target.files[0];

    if(!f){
      return;
    }

    try{
      const data=
        JSON.parse(
          await f.text()
        );

      if(data.state){
        state={
          ...clone(defaultState),
          ...data.state
        };

        if(data.appConfig){
          appConfig=
            mergeAppConfig(
              data.appConfig
            );
        }
      }else{
        state={
          ...clone(defaultState),
          ...data
        };
      }

      saveState(false);
      saveAppConfig(false);
      renderAll();

      toast(
        'Yedek yüklendi.'
      );

      if(
        session
        &&confirm(
          'Yedek buluta da gönderilsin mi?'
        )
      ){
        await pushLocalToCloud();
      }

    }catch{
      alert(
        'Geçersiz yedek dosyası.'
      );
    }

    e.target.value='';
  };

$('#resetBtn').onclick=()=>{
  if(
    confirm(
      'Yalnız bu telefondaki yerel önbellek temizlenecek. '+
      'Buluttaki veriler silinmez. Devam?'
    )
  ){
    state=
      clone(defaultState);

    appConfig=
      clone(defaultAppConfig);

    saveState(false);
    saveAppConfig(false);
    renderAll();

    toast(
      'Yerel veri temizlendi.'
    );
  }
};

function openCloudDialog(){
  if(cloud.url){
    $('#supabaseUrl').value=
      cloud.url;
  }

  if(cloud.key){
    $('#supabaseKey').value=
      cloud.key;
  }

  renderCloud();

  $('#cloudDialog')
    .showModal();
}

$('#openCloudSetup').onclick=
  openCloudDialog;

$('#cloudSetupBtn').onclick=
  openCloudDialog;

$('#saveCloudConfig').onclick=
  async()=>{
    const url=
      $('#supabaseUrl')
        .value
        .trim()
        .replace(/\/$/,'');

    const key=
      $('#supabaseKey')
        .value
        .trim();

    if(
      !/^https:\/\/.+\.supabase\.co$/.test(url)
      ||key.length<20
    ){
      return toast(
        'Geçerli Supabase URL ve key girin.'
      );
    }

    cloud={url,key};

    localStorage.setItem(
      CONFIG_KEY,
      JSON.stringify(cloud)
    );

    sb=null;
    session=null;

    await initSupabase();

    renderCloud();

    toast(
      'Bulut bağlantısı kaydedildi.'
    );
  };

$('#loginBtn').onclick=
  login;

$('#registerBtn').onclick=
  register;

$('#logoutBtn').onclick=
  logout;

$('#cloudLogoutButton').onclick=
  logout;

$('#syncNowBtn').onclick=
  ()=>session
    ?pullCloud()
    :toast(
      'Önce kurum hesabına giriş yapın.'
    );

$('#cloudSyncButton').onclick=
  pushLocalToCloud;

window.addEventListener(
  'focus',
  ()=>{
    if(session){
      pullCloud();
    }
  }
);

document.addEventListener(
  'visibilitychange',
  ()=>{
    if(
      document.visibilityState==='visible'
      &&session
    ){
      pullCloud();
    }
  }
);

setInterval(
  ()=>{
    if(
      session
      &&document.visibilityState==='visible'
    ){
      pullCloud();
    }
  },
  20000
);

window.addEventListener(
  'beforeinstallprompt',
  e=>{
    e.preventDefault();

    deferredPrompt=e;

    $('#installBtn')
      .classList
      .remove('hidden');
  }
);

$('#installBtn').onclick=
  async()=>{
    if(!deferredPrompt){
      return;
    }

    deferredPrompt.prompt();

    await deferredPrompt.userChoice;

    deferredPrompt=null;

    $('#installBtn')
      .classList
      .add('hidden');
  };

if(
  location.search.includes('error_code=')
  ||location.hash.includes('error_code=')
){
  history.replaceState(
    {},
    document.title,
    location.pathname
  );
}

if('serviceWorker' in navigator){
  navigator.serviceWorker
    .register(
      './sw.js?v=284',
      {updateViaCache:'none'}
    )
    .then(reg=>reg.update())
    .catch(console.error);
}

renderAll();
initSupabase();
