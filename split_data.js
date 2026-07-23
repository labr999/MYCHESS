/* 將單檔版 HTML 內的 DATA 拆分為 openings/*.json（每個開局一個檔案）
   用法: node split_data.js <來源HTML> <輸出目錄> */
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const SRC = process.argv[2] || '象棋開局譜-25.html';
const OUT = process.argv[3] || 'deploy/openings';

/* 分類名 → ASCII 檔名（避免中文網址編碼問題） */
const SLUG = {
  '中炮對列手砲':'lieshoupao','中砲對半途列砲':'bantu-liepao','中砲對順手砲':'shunshoupao',
  '中砲對單提馬':'dantima','中砲對鴛鴦砲':'yuanyangpao','中砲對反宮馬':'fangongma',
  '先手反宮馬（士角砲開局）':'xian-fangongma','中砲對三步虎':'sanbuhu','中砲五七炮進三兵':'wuqipao-sanbing',
  '中砲對巡河砲':'xunhepao','仙人指路（先手起手式）':'xianrenzhilu','先手仙人指路對卒底炮':'xianrenzhilu-zudipao',
  '中砲對飛象局':'feixiangju','中砲對屏風馬':'pingfengma','中砲對仙人指路':'zhongpao-xianrenzhilu',
  '左砲封車':'zuopaofengche',
  '後手中炮對過河車棄馬局':'h-guohecha-qima','後手中炮對巡河車':'h-xunhecha','後手中炮對起馬局':'h-qimaju',
  '後手中炮對飛象局':'h-feixiangju','後手中炮對仙人指路':'h-xianrenzhilu','後手中炮對三步虎':'h-sanbuhu',
  '後手中炮對敢死砲':'h-gansipao','後手巡河砲':'h-xunhepao','後手中砲對屏風馬':'h-pingfengma',
  '後手對五六砲':'h-wuliupao','後手對中砲直橫車':'h-zhihengche','後手中砲破盤頭馬':'h-pantouma',
  '後手中砲對過宮砲':'h-guogongpao','後手對士角砲':'h-shijiaopao','後手反宮馬':'h-fangongma',
  '後手對中炮牛頭滾':'h-niutougun','後手左砲封車':'h-zuopaofengche'
};

const dom = new JSDOM(fs.readFileSync(SRC,'utf8'), {
  runScripts:'dangerously', url:'https://localhost/',
  beforeParse(w){ w.fetch=()=>Promise.reject(new Error('offline')); }
});

setTimeout(()=>{
  const w = dom.window;
  const raw = w.eval(`(()=>{
    const out=[];
    for(const side in DATA){
      for(const cat in DATA[side]){
        const e=DATA[side][cat];
        out.push({ side, category:cat, intro:e.intro||'',
          lines:e.lines.map(l=>{
            const o={ name:l.name };
            if(l.desc) o.desc=l.desc;
            if(l.moves && l.moves.length) o.tokens=l.moves.map(m=>m.notation);
            if(l.playlistId) o.playlistId=l.playlistId;
            if(l.videoUrl) o.videoUrl=l.videoUrl;
            return o;
          })});
      }
    }
    return JSON.stringify(out);
  })()`);
  const cats = JSON.parse(raw);

  fs.mkdirSync(OUT, {recursive:true});
  const index=[];
  let nLines=0, nTokens=0, unslugged=[];

  cats.forEach((c,i)=>{
    const slug = SLUG[c.category];
    if(!slug){ unslugged.push(c.category); }
    const prefix = c.side==='先手' ? 'x' : 'h';
    const fname = String(i+1).padStart(2,'0')+'-'+(slug || (prefix+'-cat'+i))+'.json';
    fs.writeFileSync(path.join(OUT,fname), JSON.stringify(c,null,2)+'\n', 'utf8');
    index.push(fname);
    nLines += c.lines.length;
    c.lines.forEach(l=>{ if(l.tokens) nTokens += l.tokens.length; });
  });

  fs.writeFileSync(path.join(OUT,'index.json'), JSON.stringify(index,null,2)+'\n', 'utf8');

  console.log('已輸出 '+cats.length+' 個開局檔至 '+OUT);
  console.log('  條目數 '+nLines+'，著法總數 '+nTokens);
  if(unslugged.length) console.log('  ⚠ 未定義 slug（改用預設命名）:', unslugged.join('、'));
  process.exit(0);
}, 1200);
