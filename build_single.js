/* 由「精簡版 + openings/」產生離線單檔版 HTML
   用法: node build_single.js [精簡版HTML] [openings目錄] [輸出HTML] */
const fs = require('fs');
const path = require('path');

const LEAN = process.argv[2] || 'deploy/index.html';
const DIR  = process.argv[3] || 'deploy/openings';
const OUT  = process.argv[4] || '象棋開局譜-單檔版.html';

const index = JSON.parse(fs.readFileSync(path.join(DIR,'index.json'),'utf8'));
const bundle = {};
let cats=0, lines=0;
for(const f of index){
  const d = JSON.parse(fs.readFileSync(path.join(DIR,f),'utf8'));
  bundle[f] = d;
  if(d.category){ cats++; lines += (d.lines||[]).length; }
  else lines += ((d.games)||[]).length;
}

let html = fs.readFileSync(LEAN,'utf8');
const anchor = '<script src="coi-serviceworker.js"';
if(!html.includes(anchor)) throw new Error('找不到注入錨點');

/* JSON 內含中文，需避免 </script> 提前結束 */
const json = JSON.stringify(bundle).replace(/<\//g,'<\\/');
const inject = '<script>window.__EMBEDDED_OPENINGS = '+json+';</script>\n';
html = html.replace(anchor, inject + anchor);

fs.writeFileSync(OUT, html, 'utf8');
console.log('離線單檔版已輸出：'+OUT);
console.log('  內嵌 '+cats+' 個開局、'+lines+' 個條目');
console.log('  檔案大小 '+(html.length/1024).toFixed(0)+' KB');
