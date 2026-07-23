# 建置工具

需要 Node.js 與 jsdom（`npm install jsdom`）。

| 腳本 | 用途 |
|---|---|
| `split_data.js` | 把單檔版 HTML 內嵌的 DATA 拆成 `openings/*.json` |
| `build_lean.js` | 由單檔版產生精簡版 `index.html`（改為 fetch 載入） |
| `build_single.js` | 由「精簡版 + openings/」重建離線單檔版 |

## 常用流程

**編輯棋譜後，重新產生離線單檔版：**

```bash
node tools/build_single.js index.html openings 象棋開局譜-單檔版.html
```

**若日後程式碼有更新（拿到新的單檔版）：**

```bash
node tools/split_data.js 新版單檔.html openings      # 重新拆出棋譜
node tools/build_lean.js 新版單檔.html index.html    # 重新產生精簡版
```
