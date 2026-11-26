import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const order=[
  "v248-dashboard-polish.css",
  "v249-debts-polish.css",
  "v2587-debt-owner-colors.css",
  "v250-payments-polish.css",
  "v2586-payment-owner-colors.css",
  "v251-incomes-polish.css",
  "v2581-income-owner-colors.css",
  "v2583-income-summary-stripes.css",
  "v2584-income-themes.css",
  "v2588-selectable-kpi-standard.css",
  "v257-foundation.css",
  "v2471-mobile-polish.css",
  "v2603-finance-typography.css",
  "v276-credit-cards.css"
];
const header="/* GENERATED: BS Finans V2.8.3. Kaynak sırası korunur. Yenilemek için: node tools/build-ui-bundle.mjs */\n";
const sections=order.map(p=>{
 let s=readFileSync(resolve(root,p),'utf8');
 if(p==='v2471-mobile-polish.css')s=s.replace(/^@import[^\n]*\n/gm,'');
 if(/@import\s|@charset\s/.test(s))throw Error('Beklenmeyen CSS import/charset: '+p);
 return '/* SOURCE: '+p+' */\n'+s.trim()+'\n';
});
writeFileSync(resolve(root,'v283-ui-bundle.css'),header+sections.join('\n'));
