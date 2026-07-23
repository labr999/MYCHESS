/* 由單檔版產生「精簡版」HTML：移除內嵌 DATA，改為啟動時 fetch openings/*.json
   用法: node build_lean.js <來源HTML> <輸出HTML> */
const fs = require('fs');

const SRC = process.argv[2] || '象棋開局譜-25.html';
const DST = process.argv[3] || 'deploy/index.html';

let s = fs.readFileSync(SRC, 'utf8');
const before = s.length;

/* ---- A. 以空結構取代內嵌 DATA ---- */
const lines = s.split('\n');
let start=-1, end=-1;
for(let i=0;i<lines.length;i++){
  if(start<0 && /^const DATA = \{\s*$/.test(lines[i])){ start=i; continue; }
  if(start>=0 && /^\};\s*$/.test(lines[i])){ end=i; break; }
}
if(start<0 || end<0) throw new Error('找不到 DATA 區塊');
const dataLineCount = end-start+1;
lines.splice(start, dataLineCount,
  '/* 棋譜資料已外置於 openings/*.json，由 loadOpeningLibrary() 於啟動時載入 */',
  'const DATA = { "先手": {}, "後手": {} };');
s = lines.join('\n');

/* ---- B. 空選單防護 ---- */
const applyOld = `function applySelection(){
  if(recording) stopRecording();   // 記譜中選取分類：自動結束記譜，避免文字棋譜點了沒反應
  const v = categorySelect.value;
  const sep = v.lastIndexOf('||');`;
const applyNew = `function applySelection(){
  if(recording) stopRecording();   // 記譜中選取分類：自動結束記譜，避免文字棋譜點了沒反應
  const v = categorySelect.value;
  const sep = v.lastIndexOf('||');
  if(sep < 0) return;              // 棋庫尚未載入完成：暫不套用`;
if(!s.includes(applyOld)) throw new Error('找不到 applySelection 錨點');
s = s.replace(applyOld, applyNew);

/* ---- C. 啟動改為載入棋庫 ---- */
const bootOld = `/* ---------- 啟動 ---------- */
populateCategories();`;
const bootNew = `/* ---------- 啟動 ---------- */
/* 精簡版：棋譜由 openings/*.json 載入完成後才建立選單（見 loadOpeningLibrary） */`;
if(!s.includes(bootOld)) throw new Error('找不到啟動錨點');
s = s.replace(bootOld, bootNew);

/* ---- D. 置換外部棋庫載入器為完整棋庫載入器 ---- */
const loaderStart = s.indexOf('/* ==================== 外部 JSON 棋庫（選用） ====================');
const loaderEnd   = s.indexOf('/* ---------- 語音提示控制項 ---------- */');
if(loaderStart<0 || loaderEnd<0) throw new Error('找不到棋庫載入器區塊');

const newLoader = `/* ==================== 棋譜庫載入（openings/*.json） ====================
   index.json 列出所有棋譜檔。支援兩種格式：
   (1) 開局檔 { "side","category","intro","lines":[{name,desc,tokens|playlistId|videoUrl}] }
   (2) 對局集 { "games":[{side,category,name,tokens}] }
   載入完成後才建立分類選單。                                              */
function ensureCategoryIntro(side, cat, intro){
  const e = ensureCategory(side, cat, intro);
  if(intro) e.intro = intro;          // 覆寫 ensureCategory 的預設說明
  return e;
}
function addLibraryLine(side, cat, line){
  const e = ensureCategory(side, cat);
  if(Array.isArray(line.tokens) && line.tokens.length){
    let moves;
    try{ moves = buildMovesFromNotation(line.tokens); }
    catch(err){ return {ok:false, err:(line.name||'')+'：'+err.message}; }
    e.lines.push({name:line.name, desc:line.desc||'', moves});
  } else {
    const o = {name:line.name, desc:line.desc||'', moves:[]};
    if(line.playlistId) o.playlistId = line.playlistId;
    if(line.videoUrl)   o.videoUrl   = line.videoUrl;
    e.lines.push(o);
  }
  return {ok:true};
}

async function loadOpeningLibrary(){
  const note = document.getElementById('extLibNote');
  const show = (txt, bad)=>{
    if(!note) return;
    note.style.display='block';
    note.textContent = txt;
    if(bad){
      note.style.background='rgba(160,60,40,.18)';
      note.style.borderColor='rgba(224,110,90,.45)';
      note.style.color='#FFC0B0';
    }
  };
  try{
    let files, getFile;
    if(window.__EMBEDDED_OPENINGS){          // 離線單檔版：棋庫已內嵌
      const emb = window.__EMBEDDED_OPENINGS;
      files = Object.keys(emb).filter(k=>k!=='index.json');
      getFile = async (f)=> emb[f];
    } else {
      if(location.protocol==='file:'){
        show('⚠ 精簡版需以 http(s) 開啟才能載入 openings/ 棋庫。若要離線使用，請改用單檔版。', true);
        return;
      }
      const idxResp = await fetch('openings/index.json', {cache:'no-store'});
      if(!idxResp.ok) throw new Error('找不到 openings/index.json');
      files = await idxResp.json();
      if(!Array.isArray(files) || !files.length) throw new Error('index.json 是空的');
      getFile = async (f)=>{
        const r = await fetch('openings/'+f, {cache:'no-store'});
        if(!r.ok) throw new Error('HTTP '+r.status);
        return await r.json();
      };
    }

    const results = await Promise.all(files.map(async f=>{
      try{ return {file:f, data: await getFile(f)}; }
      catch(e){ return {file:f, err:e.message}; }
    }));

    let nCat=0, nLine=0; const problems=[];
    for(const res of results){
      if(res.err){ problems.push(res.file+'（'+res.err+'）'); continue; }
      const d = res.data;
      if(d && d.category && Array.isArray(d.lines)){          // 開局檔
        ensureCategoryIntro(d.side||'先手', d.category, d.intro);
        nCat++;
        for(const ln of d.lines){
          const r = addLibraryLine(d.side||'先手', d.category, ln);
          if(r.ok) nLine++; else problems.push(res.file+' → '+r.err);
        }
      } else {                                                 // 對局集
        const games = Array.isArray(d) ? d : (d && d.games) || [];
        for(const g of games){
          if(!g || !g.side || !g.category || !Array.isArray(g.tokens)){ problems.push(res.file+'：格式不符'); continue; }
          const r = addImportedGame(g.side, g.category, g.name || '外部棋譜', g.tokens, false);
          if(r.ok) nLine++; else problems.push(res.file+' → '+r.err);
        }
      }
    }

    if(nLine===0) throw new Error('沒有成功載入任何棋譜');

    populateCategories();
    if(typeof refreshImportCategoryOptions==='function') refreshImportCategoryOptions();
    show('📚 已載入 '+nCat+' 個開局、'+nLine+' 個條目'+(problems.length ? '（'+problems.length+' 項有問題）' : ''));
    if(problems.length) console.warn('棋庫載入問題：', problems);
  }catch(e){
    show('⚠ 棋譜庫載入失敗：'+e.message+'　請確認 openings/ 資料夾已一併上傳。', true);
    console.error('loadOpeningLibrary:', e);
  }
}

`;
s = s.slice(0, loaderStart) + newLoader + s.slice(loaderEnd);

/* ---- E. 啟動呼叫改為 loadOpeningLibrary ---- */
const callOld = `/* 啟動時嘗試載入外部 JSON 棋庫（部署後放 openings/ 資料夾即可，無則略過） */
loadExternalOpenings();`;
const callNew = `/* 啟動：載入 openings/*.json 棋譜庫，完成後才建立選單 */
loadOpeningLibrary();`;
if(!s.includes(callOld)) throw new Error('找不到啟動呼叫錨點');
s = s.replace(callOld, callNew);

/* ---- F. restoreImports 需等棋庫載入後才重建選單（原本就會呼叫 populateCategories，維持即可） ---- */

fs.writeFileSync(DST, s, 'utf8');
console.log('精簡版已輸出：'+DST);
console.log('  原始 '+before.toLocaleString()+' 位元組 → '+s.length.toLocaleString()+' 位元組（移除 '+dataLineCount+' 行 DATA）');
console.log('  縮減 '+(100-Math.round(s.length/before*100))+'%');
