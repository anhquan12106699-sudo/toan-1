  // ================================================================================
  // ===== DocxView: chuyển file Word (.docx) -> văn bản HTML ngay trên trang =====
  // Tự viết, KHÔNG cần thư viện ngoài / CDN. Giữ nguyên: căn lề, thụt lề (trái/phải/dòng đầu/
  // treo), khoảng cách đoạn, giãn dòng, tab, xuống dòng, danh sách đánh số/gạch đầu dòng,
  // bảng (gộp ô, viền, nền), ảnh, in đậm/nghiêng/gạch chân/màu/cỡ chữ, liên kết.
  // ================================================================================
  var DocxView = (function(){
    'use strict';
    var NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
    var NS_W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
    var S = null; // trạng thái của lần chuyển đổi hiện tại

    // ---------- tiện ích XML ----------
    function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
    function kids(el){ var r = []; if (!el) return r; for (var c = el.firstElementChild; c; c = c.nextElementSibling) r.push(c); return r; }
    function first(el, n){ if (!el) return null; for (var c = el.firstElementChild; c; c = c.nextElementSibling) if (c.localName === n) return c; return null; }
    function attr(e, n){ if (!e) return null; var v = e.getAttributeNS(NS_W, n); if (v === null) v = e.getAttribute('w:' + n); return v; }
    function rattr(e, n){ if (!e) return ''; return e.getAttributeNS(NS_R, n) || e.getAttribute('r:' + n) || ''; }
    function wv(el, n){ var e = first(el, n); return e ? attr(e, 'val') : null; }
    function num(v){ var n = parseInt(v, 10); return isNaN(n) ? undefined : n; }
    function isOn(v){ return !(v === '0' || v === 'false' || v === 'off'); }
    function isHex(v){ return /^[0-9a-fA-F]{6}$/.test(v || ''); }
    function safeHref(h){ return /^(https?:|mailto:|tel:)/i.test(String(h || '').trim()); }
    function fmt(n){ return (Math.round(n * 1000) / 1000).toString(); }
    // độ dài (twips) -> calc theo cỡ chữ gốc của tài liệu, tự co lại trên màn hình nhỏ (--k)
    function L(tw){ return 'calc(var(--u)*' + fmt(tw / 20 / S.basePt) + '*var(--k))'; }
    // tên font trong file Word -> font-family CSS (giữ đúng font gốc + font dự phòng cùng loại)
    function cssFont(name){
      var n = String(name || '').replace(/["'\\<>;{}]/g, '').trim();
      if (!n) return '';
      var alias = { '.vntime': 'Times New Roman', '.vntimeh': 'Times New Roman', '.vntimeu': 'Times New Roman', '.vnarial': 'Arial', '.vnarialh': 'Arial', '.vnhelve': 'Arial', '.vnhelveh': 'Arial', '.vncourier': 'Courier New' };
      var key = n.toLowerCase();
      if (alias[key]) n = alias[key];
      var generic = 'sans-serif';
      if (/times|cambria|georgia|garamond|palatino|book|minion|constantia|serif/i.test(n)) generic = 'serif';
      else if (/courier|consol|mono/i.test(n)) generic = 'monospace';
      return "'" + n + "'," + generic;
    }

    // ---------- đọc file ZIP (.docx) bằng DecompressionStream có sẵn của trình duyệt ----------
    function inflateRaw(data){
      var ds = new DecompressionStream('deflate-raw');
      return new Response(new Blob([data]).stream().pipeThrough(ds)).arrayBuffer().then(function(b){ return new Uint8Array(b); });
    }
    function readZip(buf){
      if (typeof DecompressionStream === 'undefined') return Promise.reject(new Error('no-DecompressionStream'));
      var u8 = new Uint8Array(buf), dv = new DataView(buf), eocd = -1, i;
      for (i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) {
        if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
      }
      if (eocd < 0) return Promise.reject(new Error('not-a-zip'));
      var count = dv.getUint16(eocd + 10, true), p = dv.getUint32(eocd + 16, true);
      var files = {}, dec = new TextDecoder('utf-8');
      for (var n = 0; n < count; n++) {
        if (dv.getUint32(p, true) !== 0x02014b50) break;
        var method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
        var nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true);
        var lho = dv.getUint32(p + 42, true);
        files[dec.decode(u8.subarray(p + 46, p + 46 + nl))] = { method: method, csize: csize, lho: lho };
        p += 46 + nl + el + cl;
      }
      function bytes(name){
        var f = files[name]; if (!f) return Promise.resolve(null);
        var lp = f.lho, start = lp + 30 + dv.getUint16(lp + 26, true) + dv.getUint16(lp + 28, true);
        var data = u8.subarray(start, start + f.csize);
        if (f.method === 0) return Promise.resolve(data);
        if (f.method === 8) return inflateRaw(data);
        return Promise.reject(new Error('zip-method-' + f.method));
      }
      return Promise.resolve({
        names: function(){ return Object.keys(files); },
        bytes: bytes,
        text: function(name){ return bytes(name).then(function(b){ return b ? dec.decode(b) : null; }); }
      });
    }

    // ---------- đọc thuộc tính đoạn / ký tự / bảng ----------
    function bside(el, s){
      if (!el) return null;
      return first(el, s) || (s === 'left' ? first(el, 'start') : (s === 'right' ? first(el, 'end') : null));
    }
    function parseBorder(e){
      if (!e) return undefined;
      return { val: attr(e, 'val'), sz: num(attr(e, 'sz')) || 4, color: attr(e, 'color') || 'auto' };
    }
    function borderCss(b){
      if (!b || !b.val || b.val === 'nil' || b.val === 'none') return 'none';
      var px = Math.min(6, Math.max(1, Math.round((b.sz || 4) / 6))), st = 'solid';
      if (/double/i.test(b.val)) { st = 'double'; px = Math.max(3, px); }
      else if (/dash/i.test(b.val)) st = 'dashed';
      else if (/dot/i.test(b.val)) st = 'dotted';
      return px + 'px ' + st + ' ' + (isHex(b.color) ? '#' + b.color : '#000');
    }
    function parsePPr(el){
      var o = {}; if (!el) return o; var v;
      if ((v = wv(el, 'pStyle')) !== null) o.styleId = v;
      if ((v = wv(el, 'jc')) !== null) o.jc = v;
      var ind = first(el, 'ind');
      if (ind) {
        var l = num(attr(ind, 'left')); if (l === undefined) l = num(attr(ind, 'start')); if (l !== undefined) o.left = l;
        var r = num(attr(ind, 'right')); if (r === undefined) r = num(attr(ind, 'end')); if (r !== undefined) o.right = r;
        var fl = num(attr(ind, 'firstLine')), hg = num(attr(ind, 'hanging'));
        if (hg !== undefined) o.first = -hg; else if (fl !== undefined) o.first = fl;
      }
      var sp = first(el, 'spacing');
      if (sp) {
        var b = num(attr(sp, 'before')), a = num(attr(sp, 'after')), ln = num(attr(sp, 'line'));
        if (attr(sp, 'beforeAutospacing') === '1') b = 280;
        if (attr(sp, 'afterAutospacing') === '1') a = 280;
        if (b !== undefined) o.before = b; if (a !== undefined) o.after = a;
        if (ln !== undefined) { o.line = ln; o.lineRule = attr(sp, 'lineRule') || 'auto'; }
      }
      var cs = first(el, 'contextualSpacing'); if (cs) o.contextual = isOn(attr(cs, 'val') === null ? '1' : attr(cs, 'val'));
      var np = first(el, 'numPr');
      if (np) { var ni = wv(np, 'numId'); if (ni !== null) o.numId = ni; var il = wv(np, 'ilvl'); if (il !== null) o.ilvl = parseInt(il, 10) || 0; }
      var tb = first(el, 'tabs');
      if (tb) {
        o.tabs = [];
        kids(tb).forEach(function(t){
          if (t.localName === 'tab') o.tabs.push({ pos: num(attr(t, 'pos')), val: attr(t, 'val') || 'left', leader: attr(t, 'leader') || 'none' });
        });
      }
      var sh = first(el, 'shd'); if (sh) { var f = attr(sh, 'fill'); if (isHex(f)) o.shd = f; }
      var bd = first(el, 'pBdr');
      if (bd) { o.bdr = {}; ['top', 'left', 'bottom', 'right'].forEach(function(s){ var x = parseBorder(bside(bd, s)); if (x) o.bdr[s] = x; }); }
      var mr = first(el, 'rPr'); if (mr) o.markR = parseRPr(mr);
      return o;
    }
    function parseRPr(el){
      var o = {}; if (!el) return o; var v;
      if ((v = wv(el, 'rStyle')) !== null) o.rStyle = v;
      ['b', 'i', 'strike', 'dstrike', 'caps', 'smallCaps', 'vanish'].forEach(function(n){
        var e = first(el, n); if (e) { var x = attr(e, 'val'); o[n] = (x === null) ? true : isOn(x); }
      });
      // Word chỉ gạch chân khi w:u có w:val; thiếu w:val thì Word bỏ qua (đã đối chiếu Font.Underline qua Word)
      var u = first(el, 'u');
      if (u) {
        var uv = (attr(u, 'val') || '').toLowerCase();
        if (uv) o.u = /^(none|nil|0|false)$/.test(uv) ? 'none' : uv;
      }
      var rf = first(el, 'rFonts');
      if (rf) {
        var fn = attr(rf, 'ascii') || attr(rf, 'hAnsi') || attr(rf, 'cs') || attr(rf, 'eastAsia');
        if (fn) o.font = fn;
      }
      if ((v = wv(el, 'color')) !== null) o.color = v;
      if ((v = num(wv(el, 'sz'))) !== undefined) o.sz = v;
      if ((v = wv(el, 'highlight')) !== null) o.hl = v;
      if ((v = wv(el, 'vertAlign')) !== null) o.va = v;
      var sh = first(el, 'shd'); if (sh) { var f = attr(sh, 'fill'); if (isHex(f)) o.shd = f; }
      return o;
    }
    function parseTblPr(el){
      var o = {}; if (!el) return o; var v;
      if ((v = wv(el, 'tblStyle')) !== null) o.styleId = v;
      if ((v = wv(el, 'jc')) !== null) o.jc = v;
      var w = first(el, 'tblW'); if (w) o.w = { type: attr(w, 'type') || 'auto', w: num(attr(w, 'w')) || 0 };
      var ind = first(el, 'tblInd'); if (ind) o.ind = num(attr(ind, 'w'));
      var bd = first(el, 'tblBorders');
      if (bd) { o.bdr = {}; ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].forEach(function(s){ var x = parseBorder(bside(bd, s)); if (x) o.bdr[s] = x; }); }
      var lk = first(el, 'tblLook');
      if (lk) {
        var vh = attr(lk, 'val'), mk = vh ? parseInt(vh, 16) : null;
        var fl = function(n, bit){ var a = attr(lk, n); if (a !== null) return isOn(a); return mk !== null ? !!(mk & bit) : undefined; };
        o.look = { firstRow: fl('firstRow', 0x20), lastRow: fl('lastRow', 0x40), firstCol: fl('firstColumn', 0x80), lastCol: fl('lastColumn', 0x100), noHBand: fl('noHBand', 0x200), noVBand: fl('noVBand', 0x400) };
      }
      var cm = first(el, 'tblCellMar');
      if (cm) { o.mar = {}; ['top', 'left', 'bottom', 'right'].forEach(function(s){ var e = first(cm, s); if (e) o.mar[s] = num(attr(e, 'w')); }); }
      return o;
    }
    function parseTcPr(tcPr){
      var o = { span: 1, vm: null, bdr: {}, mar: {} };
      if (!tcPr) return o;
      var gs = first(tcPr, 'gridSpan'); if (gs) o.span = num(attr(gs, 'val')) || 1;
      var vme = first(tcPr, 'vMerge'); if (vme) o.vm = (attr(vme, 'val') === 'restart') ? 'restart' : 'continue';
      var sh = first(tcPr, 'shd'); if (sh && isHex(attr(sh, 'fill'))) o.shd = attr(sh, 'fill');
      var va = wv(tcPr, 'vAlign'); if (va) o.va = va;
      var tb = first(tcPr, 'tcBorders');
      if (tb) ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].forEach(function(s){ var x = parseBorder(bside(tb, s)); if (x) o.bdr[s] = x; });
      var tm = first(tcPr, 'tcMar');
      if (tm) ['top', 'left', 'bottom', 'right'].forEach(function(s){ var e = bside(tm, s); if (e) o.mar[s] = num(attr(e, 'w')); });
      return o;
    }
    function assignDef(t, s){ for (var k in s) if (s[k] !== undefined) t[k] = s[k]; return t; }
    function mergeP(t, s){
      for (var k in s) {
        if (s[k] === undefined) continue;
        if (k === 'tabs') t.tabs = (t.tabs || []).concat(s.tabs);
        else if (k === 'bdr') t.bdr = assignDef(assignDef({}, t.bdr || {}), s.bdr);
        else t[k] = s[k];
      }
      return t;
    }
    function mergeT(t, s){
      if (!s) return t;
      for (var k in s) {
        if (s[k] === undefined) continue;
        if (k === 'bdr' || k === 'mar') t[k] = assignDef(assignDef({}, t[k] || {}), s[k]); else t[k] = s[k];
      }
      return t;
    }

    // ---------- styles ----------
    function parseStyles(doc){
      S.styles = {}; S.defP = {}; S.defR = {}; S.defParaId = null; S.defTblId = null;
      if (!doc) return;
      var root = doc.documentElement, dd = first(root, 'docDefaults');
      if (dd) {
        var ppd = first(dd, 'pPrDefault'), rpd = first(dd, 'rPrDefault');
        if (ppd) S.defP = parsePPr(first(ppd, 'pPr'));
        if (rpd) S.defR = parseRPr(first(rpd, 'rPr'));
      }
      kids(root).forEach(function(s){
        if (s.localName !== 'style') return;
        var id = attr(s, 'styleId');
        var st = { id: id, type: attr(s, 'type'), basedOn: wv(s, 'basedOn'), p: parsePPr(first(s, 'pPr')), r: parseRPr(first(s, 'rPr')), tbl: parseTblPr(first(s, 'tblPr')), cond: {} };
        kids(s).forEach(function(x){
          if (x.localName !== 'tblStylePr') return;
          var tc = parseTcPr(first(x, 'tcPr'));
          st.cond[attr(x, 'type')] = { tbl: parseTblPr(first(x, 'tblPr')), bdr: tc.bdr, shd: tc.shd, r: parseRPr(first(x, 'rPr')), p: parsePPr(first(x, 'pPr')) };
        });
        S.styles[id] = st;
        if (attr(s, 'default') === '1') { if (st.type === 'paragraph') S.defParaId = id; if (st.type === 'table') S.defTblId = id; }
      });
    }
    function chainOf(id){
      var out = [], seen = {};
      while (id && S.styles[id] && !seen[id]) { seen[id] = 1; out.unshift(S.styles[id]); id = S.styles[id].basedOn; }
      return out;
    }
    function sameAsDefault(p){
      var o = {};
      for (var k in p) {
        if (k === 'tabs' || k === 'bdr' || k === 'markR') { o[k] = p[k]; continue; }
        if (S.defP[k] !== p[k]) o[k] = p[k];
      }
      return o;
    }
    function resolveP(styleId, direct, ctx){
      var o = {}; mergeP(o, S.defP);
      if (ctx.tblStyle) chainOf(ctx.tblStyle).forEach(function(st){ mergeP(o, st.p); });
      if (ctx.condP) mergeP(o, ctx.condP);
      chainOf(styleId).forEach(function(st){
        var p = st.p;
        if (ctx.tblStyle && st.id === S.defParaId) p = sameAsDefault(p);
        mergeP(o, p);
      });
      var numId = direct.numId !== undefined ? direct.numId : o.numId;
      var ilvl = direct.ilvl !== undefined ? direct.ilvl : (o.ilvl || 0);
      if (numId && numId !== '0') {
        var lv = getLvl(numId, ilvl);
        if (lv && lv.p) ['left', 'right', 'first'].forEach(function(k){ if (lv.p[k] !== undefined) o[k] = lv.p[k]; });
      }
      var d = assignDef({}, direct); delete d.numId; delete d.ilvl; delete d.styleId; delete d.markR;
      if (direct.tabs) d.tabs = direct.tabs; if (direct.bdr) d.bdr = direct.bdr;
      mergeP(o, d);
      o.numId = numId; o.ilvl = ilvl;
      return o;
    }
    function resolveR(styleId, rStyleId, direct, ctx){
      var o = assignDef({}, S.defR);
      if (ctx && ctx.tblStyle) chainOf(ctx.tblStyle).forEach(function(st){ assignDef(o, st.r); });
      if (ctx && ctx.condR) assignDef(o, ctx.condR);
      chainOf(styleId).forEach(function(st){
        var r = st.r;
        if (ctx && ctx.tblStyle && st.id === S.defParaId) { var t = {}; for (var k in r) if (S.defR[k] !== r[k]) t[k] = r[k]; r = t; }
        assignDef(o, r);
      });
      if (rStyleId) chainOf(rStyleId).forEach(function(st){ assignDef(o, st.r); });
      assignDef(o, direct || {});
      return o;
    }

    // ---------- danh sách (numbering) ----------
    function parseLvl(l){
      var st = num(wv(l, 'start')); var rf = first(first(l, 'rPr'), 'rFonts');
      return {
        start: st === undefined ? 1 : st, fmt: wv(l, 'numFmt') || 'decimal', text: wv(l, 'lvlText') || '',
        suff: wv(l, 'suff') || 'tab', p: parsePPr(first(l, 'pPr')), r: parseRPr(first(l, 'rPr')), lgl: !!first(l, 'isLgl')
      };
    }
    function parseNumbering(doc){
      S.abs = {}; S.nums = {}; S.cnt = {}; S.seenNum = {};
      if (!doc) return;
      kids(doc.documentElement).forEach(function(e){
        if (e.localName === 'abstractNum') {
          var a = { lvls: {} };
          kids(e).forEach(function(l){ if (l.localName === 'lvl') a.lvls[attr(l, 'ilvl')] = parseLvl(l); });
          S.abs[attr(e, 'abstractNumId')] = a;
        } else if (e.localName === 'num') {
          var n = { abs: wv(e, 'abstractNumId'), over: {} };
          kids(e).forEach(function(o){
            if (o.localName !== 'lvlOverride') return;
            var so = first(o, 'startOverride'), lv = first(o, 'lvl');
            n.over[attr(o, 'ilvl')] = { start: so ? num(attr(so, 'val')) : undefined, lvl: lv ? parseLvl(lv) : null };
          });
          S.nums[attr(e, 'numId')] = n;
        }
      });
    }
    function getLvl(numId, ilvl){
      var n = S.nums[numId]; if (!n) return null;
      var ov = n.over[String(ilvl)]; if (ov && ov.lvl) return ov.lvl;
      var a = S.abs[n.abs]; return a ? (a.lvls[String(ilvl)] || null) : null;
    }
    function roman(n, up){
      var m = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']], s = '';
      for (var i = 0; i < m.length; i++) while (n >= m[i][0]) { s += m[i][1]; n -= m[i][0]; }
      return up ? s.toUpperCase() : s;
    }
    function fmtNum(n, f){
      var s, k;
      switch (f) {
        case 'decimalZero': return n < 10 ? '0' + n : String(n);
        case 'lowerLetter': case 'upperLetter':
          s = String.fromCharCode(97 + (n - 1) % 26); for (k = 0; k < Math.floor((n - 1) / 26); k++) s += s.charAt(0);
          return f === 'upperLetter' ? s.toUpperCase() : s;
        case 'lowerRoman': return roman(n, false);
        case 'upperRoman': return roman(n, true);
        case 'none': return '';
        default: return String(n);
      }
    }
    function bulletChar(t){
      if (!t) return '\u2022';
      var c = t.charCodeAt(0);
      if (c === 0xF0B7) return '\u2022';
      if (c === 0xF0A7) return '\u25AA';
      if (c === 0xF0D8) return '\u27A2';
      if (c === 0xF0FC) return '\u2713';
      if (c === 0xF076) return '\u2756';
      if (c >= 0xF000 && c <= 0xF0FF) return '\u2022';
      if (t === 'o') return '\u25E6';
      return t;
    }
    function nextLabel(numId, ilvl){
      var n = S.nums[numId]; if (!n) return null;
      var lvl = getLvl(numId, ilvl); if (!lvl) return null;
      var cnt = S.cnt[n.abs] || (S.cnt[n.abs] = {});
      if (!S.seenNum[numId]) {
        S.seenNum[numId] = true;
        for (var il in n.over) if (n.over[il].start !== undefined) cnt[il] = n.over[il].start - 1;
      }
      var key = String(ilvl);
      if (cnt[key] === undefined) cnt[key] = lvl.start - 1;
      cnt[key]++;
      Object.keys(cnt).forEach(function(k){ if (parseInt(k, 10) > ilvl) delete cnt[k]; });
      if (lvl.fmt === 'bullet') return { text: bulletChar(lvl.text), lvl: lvl };
      var text = lvl.text.replace(/%(\d)/g, function(m, d){
        var li = parseInt(d, 10) - 1, cl = getLvl(numId, li), c = cnt[String(li)];
        if (c === undefined) c = cl ? cl.start : 1;
        return fmtNum(c, (lvl.lgl && li !== ilvl) ? 'decimal' : (cl ? cl.fmt : 'decimal'));
      });
      return { text: text, lvl: lvl };
    }

    // ---------- chạy chữ (run) ----------
    var HL = { yellow: '#ffff00', green: '#00ff00', cyan: '#00ffff', magenta: '#ff00ff', blue: '#0000ff', red: '#ff0000', darkBlue: '#000080', darkCyan: '#008080', darkGreen: '#008000', darkMagenta: '#800080', darkRed: '#800000', darkYellow: '#808000', darkGray: '#808080', lightGray: '#c0c0c0', black: '#000000', white: '#ffffff' };
    function runCss(rp, P){
      var css = [];
      if (rp.font) { var ff = cssFont(rp.font); if (ff) css.push('font-family:' + ff); }
      if (rp.b) css.push('font-weight:700');
      if (rp.i) css.push('font-style:italic');
      var dec = [];
      if (rp.u && !/^(none|nil|0|false)$/i.test(rp.u)) dec.push('underline');
      if (rp.strike || rp.dstrike) dec.push('line-through');
      if (dec.length) { css.push('text-decoration:' + dec.join(' ')); if (rp.u && /double/i.test(rp.u)) css.push('text-decoration-style:double'); }
      if (rp.color && isHex(rp.color) && !/^000000$/.test(rp.color)) css.push('color:#' + rp.color);
      var bg = rp.hl && HL[rp.hl] ? HL[rp.hl] : (rp.shd ? '#' + rp.shd : '');
      if (bg) css.push('background-color:' + bg);
      if (rp.caps) css.push('text-transform:uppercase');
      if (rp.smallCaps) css.push('font-variant:small-caps');
      if (rp.va === 'superscript' || rp.va === 'subscript') {
        css.push('vertical-align:' + (rp.va === 'superscript' ? 'super' : 'sub')); css.push('font-size:.75em');
      } else if (rp.sz && P.sz && rp.sz !== P.sz) css.push('font-size:' + fmt(rp.sz / P.sz) + 'em');
      return css.join(';');
    }
    function symChar(c){
      var ch = (attr(c, 'char') || '').toUpperCase(), code = parseInt(ch, 16);
      if (isNaN(code)) return '';
      if (code >= 0xF000) { var m = { 0xF0B7: '\u2022', 0xF0A7: '\u25AA', 0xF0D8: '\u27A2', 0xF0FC: '\u2713' }; return m[code] || '\u2022'; }
      return esc(String.fromCharCode(code));
    }
    function tabSpan(){ return '<span class="dx-tab"></span>'; }
    function mediaUrl(relId){
      var r = S.rels[relId]; if (!r) return '';
      var t = r.target.replace(/^\//, ''); if (!/^word\//i.test(t)) t = 'word/' + t;
      t = t.replace(/[^\/]+\/\.\.\//g, '');
      return S.media[t] || '';
    }
    // vị trí ngang của ảnh neo (floating) trong Word: left / center / right
    function anchorAlign(inl){
      var ph = first(inl, 'positionH'); if (!ph) return '';
      var al = first(ph, 'align');
      if (al) {
        var a = al.textContent.trim();
        if (a === 'left' || a === 'inside') return 'left';
        if (a === 'right' || a === 'outside') return 'right';
        if (a === 'center') return 'center';
      }
      var po = first(ph, 'posOffset');
      if (po) {
        var off = (parseInt(po.textContent, 10) || 0) / 635;
        if ((ph.getAttribute('relativeFrom') || '') === 'page') off -= S.marL;
        var ext = first(inl, 'extent'), w = ext ? (parseInt(ext.getAttribute('cx'), 10) || 0) / 635 : 0;
        var ratio = (off + w / 2) / S.textW;
        if (ratio > 0.4 && ratio < 0.6) return 'center';
        return ratio < 0.5 ? 'left' : 'right';
      }
      return '';
    }
    function drawingHtml(d, ctx, P){
      var inl = first(d, 'inline') || first(d, 'anchor'); if (!inl) return '';
      var anchor = inl.localName === 'anchor';
      var tx = inl.getElementsByTagNameNS('*', 'txbxContent')[0];
      if (tx) return '<div class="dx-tb">' + blocks(tx, { inTable: false, tblStyle: null }) + '</div>';
      var blip = inl.getElementsByTagNameNS('*', 'blip')[0]; if (!blip) return '';
      if (anchor && inl.getAttribute('behindDoc') === '1') return '';
      var url = mediaUrl(rattr(blip, 'embed')); if (!url) return '';
      var ext = first(inl, 'extent'), wTw = ext ? (parseInt(ext.getAttribute('cx'), 10) || 0) / 635 : 0;
      var dp = first(inl, 'docPr'), alt = dp ? (dp.getAttribute('descr') || '') : '';
      var css = ['max-width:100%', 'height:auto']; if (wTw > 0) css.unshift('width:' + L(wTw));
      if (anchor && !(P && P.imgOnly)) {
        var wrap = kids(inl).filter(function(x){ return /^wrap/.test(x.localName); })[0], wn = wrap ? wrap.localName : '';
        var al = 'center'; // luôn căn giữa ảnh
        if (true) {
          css.push('display:block', 'margin:.4em ' + (al === 'left' ? 'auto .4em .4em 0' : (al === 'right' ? '.4em 0 .4em auto' : 'auto')));
          if (al === 'left') css[css.length - 1] = 'margin:.4em auto .4em 0';
          else if (al === 'right') css[css.length - 1] = 'margin:.4em 0 .4em auto';
        } else if ((wn === 'wrapSquare' || wn === 'wrapTight' || wn === 'wrapThrough') && (al === 'left' || al === 'right'))
          css.push('float:' + al, 'margin:.2em ' + (al === 'left' ? '.8em .4em 0' : '0 .4em .8em'));
      }
      return '<img src="' + esc(url) + '" alt="' + esc(alt) + '" style="' + css.join(';') + '">';
    }
    function pictHtml(pc, ctx, P){
      var tx = pc.getElementsByTagNameNS('*', 'txbxContent')[0];
      if (tx) return '<div class="dx-tb">' + blocks(tx, { inTable: false, tblStyle: null }) + '</div>';
      var im = pc.getElementsByTagNameNS('*', 'imagedata')[0]; if (!im) return '';
      var url = mediaUrl(rattr(im, 'id')); if (!url) return '';
      var sh = im.parentNode, style = sh && sh.getAttribute ? (sh.getAttribute('style') || '') : '';
      var m = /width:\s*([\d.]+)pt/i.exec(style), css = ['max-width:100%', 'height:auto'];
      if (m) css.unshift('width:' + L(Math.round(parseFloat(m[1]) * 20)));
      return '<img src="' + esc(url) + '" alt="" style="' + css.join(';') + '">';
    }
    function altHtml(ac, ctx, P){
      var ch = first(ac, 'Choice') || first(ac, 'Fallback'), out = '';
      kids(ch).forEach(function(c){
        if (c.localName === 'drawing') out += drawingHtml(c, ctx, P);
        else if (c.localName === 'pict') out += pictHtml(c, ctx, P);
      });
      return out;
    }
    function runHtml(r, ctx, P, st){
      var direct = parseRPr(first(r, 'rPr'));
      var rp = resolveR(P.styleId, direct.rStyle, direct, ctx);
      var inner = '', lopen = '', lclose = '';
      kids(r).forEach(function(c){
        var nm = c.localName, top = st.fld[st.fld.length - 1];
        if (nm === 'fldChar') {
          var t = attr(c, 'fldCharType');
          if (t === 'begin') st.fld.push({ instr: '', phase: 0 });
          else if (t === 'separate' && top) {
            top.phase = 1;
            var m = /^\s*HYPERLINK\s+"([^"]+)"/i.exec(top.instr);
            if (m && safeHref(m[1])) { top.link = true; lopen += '<a href="' + esc(m[1]) + '" target="_blank" rel="noopener noreferrer">'; }
          } else if (t === 'end') { var f = st.fld.pop(); if (f && f.link) lclose += '</a>'; }
          return;
        }
        if (nm === 'instrText') { if (top) top.instr += c.textContent; return; }
        if (top && top.phase === 0) return;
        if (nm === 't') inner += esc(c.textContent);
        else if (nm === 'tab') inner += tabSpan();
        else if (nm === 'br') { var ty = attr(c, 'type'); if (ty !== 'page' && ty !== 'column') inner += '<br>'; }
        else if (nm === 'cr') inner += '<br>';
        else if (nm === 'noBreakHyphen') inner += '&#8209;';
        else if (nm === 'sym') inner += symChar(c);
        else if (nm === 'drawing') inner += drawingHtml(c, ctx, P);
        else if (nm === 'pict') inner += pictHtml(c, ctx, P);
        else if (nm === 'AlternateContent') inner += altHtml(c, ctx, P);
      });
      if (rp.vanish) return lopen + lclose;
      var css = runCss(rp, P);
      return lopen + ((css && inner) ? '<span style="' + css + '">' + inner + '</span>' : inner) + lclose;
    }
    function inlineHtml(parent, ctx, P, st){
      var out = '';
      kids(parent).forEach(function(e){
        switch (e.localName) {
          case 'r': out += runHtml(e, ctx, P, st); break;
          case 'hyperlink':
            var rel = S.rels[rattr(e, 'id')], inner = inlineHtml(e, ctx, P, st);
            out += (rel && rel.ext && safeHref(rel.target)) ? '<a href="' + esc(rel.target) + '" target="_blank" rel="noopener noreferrer">' + inner + '</a>' : inner;
            break;
          case 'ins': case 'smartTag': case 'customXml': case 'fldSimple': case 'moveTo': out += inlineHtml(e, ctx, P, st); break;
          case 'sdt': var c = first(e, 'sdtContent'); if (c) out += inlineHtml(c, ctx, P, st); break;
          case 'AlternateContent': out += altHtml(e, ctx, P); break;
        }
      });
      return out;
    }

    // ---------- đoạn văn ----------
    function paraItem(p, ctx){
      var direct = parsePPr(first(p, 'pPr'));
      var styleId = direct.styleId || S.defParaId;
      var props = resolveP(styleId, direct, ctx);
      var baseR = resolveR(styleId, null, {}, ctx);
      var sz = baseR.sz || S.baseHalf;
      var P = { styleId: styleId, sz: sz, font: baseR.font || S.baseFont || '' };
      // đoạn chỉ chứa ảnh (không chữ): xác định ảnh nằm trái / giữa / phải
      var imgOnly = false, imgAlign = '';
      var txt = Array.prototype.map.call(p.getElementsByTagNameNS(NS_W, 't'), function(n){ return n.textContent; }).join('').trim();
      if (!txt && p.getElementsByTagNameNS('*', 'blip').length && !p.getElementsByTagNameNS('*', 'txbxContent').length) {
        imgOnly = true; P.imgOnly = true;
        var an = p.getElementsByTagNameNS('*', 'anchor');
        for (var ai = 0; ai < an.length; ai++) {
          if (an[ai].getAttribute('behindDoc') === '1' || !an[ai].getElementsByTagNameNS('*', 'blip').length) continue;
          imgAlign = anchorAlign(an[ai]); break;
        }
      }
      var label = '';
      if (props.numId && props.numId !== '0') {
        var nl = nextLabel(props.numId, props.ilvl || 0);
        if (nl) {
          var mr = resolveR(styleId, null, direct.markR || {}, ctx); assignDef(mr, nl.lvl.r);
          var css = runCss(mr, P);
          label = '<span class="dx-num"' + (css ? ' style="' + css + '"' : '') + '>' + esc(nl.text) + '</span>';
          label += nl.lvl.suff === 'tab' ? tabSpan() : (nl.lvl.suff === 'space' ? ' ' : '');
        }
      }
      var inner = label + inlineHtml(p, ctx, P, { fld: [] });
      return { p: true, props: props, styleId: styleId, sz: sz, font: P.font, inner: inner, imgOnly: imgOnly && !label, imgAlign: imgAlign };
    }
    function paraHtml(it, prev, next){
      var pr = it.props, css = [], before = pr.before || 0, after = pr.after || 0;
      if (it.font && it.font !== S.baseFont) { var ff = cssFont(it.font); if (ff) css.push('font-family:' + ff); }
      if (pr.contextual) {
        if (next && next.p && next.styleId === it.styleId) after = 0;
        if (prev && prev.p && prev.styleId === it.styleId) before = 0;
      }
      var jc = pr.jc, noIndent = false;
      if (it.imgOnly) {
        var eff = 'center'; // luôn căn giữa ảnh
        jc = eff;
        // ảnh nằm giữa: bỏ thụt lề của đoạn để ảnh thật sự ở chính giữa như trong Word
        if (eff === 'center') noIndent = true;
      }
      if (jc === 'center') css.push('text-align:center');
      else if (jc === 'right' || jc === 'end') css.push('text-align:right');
      else if (jc === 'both' || jc === 'distribute' || jc === 'thaiDistribute') css.push('text-align:justify');
      if (!noIndent) {
        if (pr.left) css.push('margin-left:' + L(pr.left));
        if (pr.right) css.push('margin-right:' + L(pr.right));
        if (pr.first) css.push('text-indent:' + L(pr.first));
      }
      if (before) css.push('margin-top:' + L(before));
      if (after) css.push('margin-bottom:' + L(after));
      if (pr.line) {
        if (pr.lineRule === 'exact' || pr.lineRule === 'atLeast')
          css.push('line-height:' + fmt(Math.max(pr.lineRule === 'atLeast' ? 1.2 : 0.8, (pr.line / 20) / (it.sz / 2))));
        else css.push('line-height:' + fmt(pr.line / 240 * 1.15));
      }
      if (it.sz !== S.baseHalf) css.push('font-size:calc(var(--u)*' + fmt(it.sz / S.baseHalf) + ')');
      if (pr.shd) css.push('background-color:#' + pr.shd);
      if (pr.bdr) ['top', 'left', 'bottom', 'right'].forEach(function(s){
        if (pr.bdr[s]) { var bc = borderCss(pr.bdr[s]); css.push('border-' + s + ':' + bc); if (bc !== 'none') css.push('padding-' + s + ':.2em'); }
      });
      // tab stops (twips) cho bộ căn tab chạy sau khi dựng
      var stops = [];
      (pr.tabs || []).forEach(function(t){
        if (t.val === 'clear') { stops = stops.filter(function(x){ return x.pos !== t.pos; }); }
        else if (t.pos !== undefined) stops.push(t);
      });
      if (pr.first < 0 && pr.left > 0 && !stops.some(function(x){ return x.pos === pr.left; })) stops.push({ pos: pr.left, val: 'left', leader: 'none' });
      stops.sort(function(a, b){ return a.pos - b.pos; });
      var tabAttr = stops.length ? ' data-dxt="' + stops.map(function(t){ return t.pos + ':' + t.val + ':' + t.leader; }).join(',') + '"' : '';
      var inner = it.inner;
      if (!inner) inner = '<br>';
      else if (/<br>$/.test(inner)) inner += '\u200b';
      return '<div class="dx-p"' + tabAttr + (css.length ? ' style="' + css.join(';') + '"' : '') + '>' + inner + '</div>';
    }

    // ---------- bảng ----------
    function tableHtml(tbl, ctx){
      var direct = parseTblPr(first(tbl, 'tblPr')), sid = direct.styleId || S.defTblId;
      // định dạng theo vùng của kiểu bảng (hàng đầu, cột đầu, dòng kẻ sọc, toàn bảng...)
      var cond = {};
      chainOf(sid).forEach(function(st){
        for (var ty in st.cond) {
          var c = st.cond[ty], t = cond[ty] || (cond[ty] = { tbl: {}, bdr: {}, shd: undefined, r: {}, p: {} });
          mergeT(t.tbl, c.tbl); assignDef(t.bdr, c.bdr); if (c.shd) t.shd = c.shd; assignDef(t.r, c.r); mergeP(t.p, c.p);
        }
      });
      var tp = {};
      chainOf(sid).forEach(function(st){ mergeT(tp, st.tbl); });
      if (cond.wholeTable) mergeT(tp, cond.wholeTable.tbl);
      mergeT(tp, direct);
      var bdr = tp.bdr || {}, mar = tp.mar || {};
      var look = tp.look || { firstRow: true, firstCol: true, noVBand: true };
      var grid = []; var tg = first(tbl, 'tblGrid');
      if (tg) kids(tg).forEach(function(g){ if (g.localName === 'gridCol') grid.push(num(attr(g, 'w')) || 0); });
      var trs = kids(tbl).filter(function(x){ return x.localName === 'tr'; });
      var nrows = trs.length, ncols = grid.length;
      if (!ncols) trs.forEach(function(tr){
        var n = 0; kids(tr).forEach(function(tc){ if (tc.localName === 'tc') n += (parseTcPr(first(tc, 'tcPr')).span || 1); });
        ncols = Math.max(ncols, n);
      });
      ncols = ncols || 1;
      // vị trí viền: mép ngoài dùng top/bottom/left/right, bên trong dùng insideH/insideV
      function pick(b, ri, col, span, rowspan){
        return {
          top: ri === 0 ? b.top : b.insideH,
          bottom: (ri + (rowspan || 1) >= nrows) ? b.bottom : b.insideH,
          left: col === 0 ? b.left : b.insideV,
          right: (col + span >= ncols) ? b.right : b.insideV
        };
      }
      function condFor(ri, col, span){
        var types = ['wholeTable'];
        var fr = look.firstRow && ri === 0, lr = look.lastRow && ri === nrows - 1;
        var fc = look.firstCol && col === 0, lc = look.lastCol && col + span >= ncols;
        if (!look.noHBand && !fr && !lr) types.push(((ri - (look.firstRow ? 1 : 0)) % 2 === 0) ? 'band1Horz' : 'band2Horz');
        if (!look.noVBand && !fc && !lc) types.push(((col - (look.firstCol ? 1 : 0)) % 2 === 0) ? 'band1Vert' : 'band2Vert');
        if (fc) types.push('firstCol'); if (lc) types.push('lastCol'); if (fr) types.push('firstRow'); if (lr) types.push('lastRow');
        var out = { bdr: {}, r: {}, p: {}, shd: undefined };
        types.forEach(function(ty){
          var c = cond[ty]; if (!c) return;
          var sd = pick(c.bdr, ri, col, span, 1);
          ['top', 'left', 'bottom', 'right'].forEach(function(k){ if (sd[k]) out.bdr[k] = sd[k]; });
          if (c.shd) out.shd = c.shd; assignDef(out.r, c.r); mergeP(out.p, c.p);
        });
        return out;
      }
      var pend = {}, rows = [];
      trs.forEach(function(tr, ri){
        var row = [], col = 0, trPr = first(tr, 'trPr'), gb = trPr ? (num(wv(trPr, 'gridBefore')) || 0) : 0;
        col += gb;
        kids(tr).forEach(function(tc){
          if (tc.localName !== 'tc') return;
          var tpr = parseTcPr(first(tc, 'tcPr')), cell = { col: col, bdr: tpr.bdr, mar: tpr.mar, shd: tpr.shd, va: tpr.va, span: tpr.span, rowspan: 1 };
          if (tpr.vm === 'continue' && pend[col]) { pend[col].rowspan++; cell.skip = true; }
          else if (tpr.vm === 'restart') pend[col] = cell; else delete pend[col];
          if (!cell.skip) {
            cell.cond = condFor(ri, col, cell.span);
            // nội dung dựng ngay để đánh số danh sách đúng thứ tự tài liệu
            cell.html = blocks(tc, { inTable: true, tblStyle: sid, condR: cell.cond.r, condP: cell.cond.p });
          }
          row.push(cell); col += cell.span;
        });
        rows.push({ cells: row, gb: gb });
      });
      var total = grid.reduce(function(a, b){ return a + b; }, 0);
      var out = '';
      rows.forEach(function(rw, ri){
        out += '<tr>';
        if (rw.gb) out += '<td colspan="' + rw.gb + '"></td>';
        rw.cells.forEach(function(c){
          if (c.skip) return;
          var css = [], tb = pick(bdr, ri, c.col, c.span, c.rowspan);
          ['top', 'right', 'bottom', 'left'].forEach(function(s){
            var b = c.bdr[s] || c.cond.bdr[s] || tb[s];
            if (b) css.push('border-' + s + ':' + borderCss(b));
          });
          ['top', 'right', 'bottom', 'left'].forEach(function(s){
            var v = c.mar[s] !== undefined ? c.mar[s] : (mar[s] !== undefined ? mar[s] : ((s === 'left' || s === 'right') ? 108 : 0));
            css.push('padding-' + s + ':' + L(v));
          });
          var fill = c.shd || c.cond.shd; if (fill) css.push('background-color:#' + fill);
          if (c.va === 'center') css.push('vertical-align:middle'); else if (c.va === 'bottom') css.push('vertical-align:bottom');
          out += '<td' + (c.span > 1 ? ' colspan="' + c.span + '"' : '') + (c.rowspan > 1 ? ' rowspan="' + c.rowspan + '"' : '') + ' style="' + css.join(';') + '">' + (c.html || '<div class="dx-p"><br></div>') + '</td>';
        });
        out += '</tr>';
      });
      var tcss = [], wtw = tp.w;
      if (total) {
        var wtw2 = (wtw && wtw.type === 'dxa' && wtw.w) ? wtw.w : total;
        if (wtw && wtw.type === 'pct' && wtw.w) tcss.push('width:' + fmt(wtw.w / 50) + '%');
        else tcss.push('width:min(' + L(wtw2) + ',100%)');
      }
      if (tp.jc === 'center') tcss.push('margin-left:auto', 'margin-right:auto');
      else if (tp.jc === 'right' || tp.jc === 'end') tcss.push('margin-left:auto');
      else if (tp.ind) tcss.push('margin-left:' + L(tp.ind));
      var cols = '';
      if (total) { cols = '<colgroup>'; grid.forEach(function(g){ cols += '<col style="width:' + fmt(g / total * 100) + '%">'; }); cols += '</colgroup>'; }
      return '<table class="dx-t"' + (tcss.length ? ' style="' + tcss.join(';') + '"' : '') + '>' + cols + '<tbody>' + out + '</tbody></table>';
    }

    // ---------- khối (đoạn + bảng) ----------
    function collect(parent, ctx, items){
      kids(parent).forEach(function(e){
        switch (e.localName) {
          case 'p': items.push(paraItem(e, ctx)); break;
          case 'tbl': items.push({ html: tableHtml(e, ctx) }); break;
          case 'sdt': var c = first(e, 'sdtContent'); if (c) collect(c, ctx, items); break;
          case 'ins': case 'customXml': case 'smartTag': collect(e, ctx, items); break;
        }
      });
    }
    function blocks(parent, ctx){
      var items = []; collect(parent, ctx, items);
      return items.map(function(it, i){ return it.p ? paraHtml(it, items[i - 1], items[i + 1]) : it.html; }).join('');
    }

    // ---------- chuyển đổi ----------
    function convert(buf){
      return readZip(buf).then(function(zip){
        var names = ['word/document.xml', 'word/styles.xml', 'word/numbering.xml', 'word/_rels/document.xml.rels', 'word/settings.xml'];
        return Promise.all(names.map(function(n){ return zip.text(n); })).then(function(tx){
          var media = zip.names().filter(function(n){ return /^word\/media\//i.test(n); });
          return Promise.all(media.map(function(n){ return zip.bytes(n); })).then(function(arr){
            var parser = new DOMParser();
            function px(t){ if (!t) return null; var d = parser.parseFromString(t, 'application/xml'); return d.getElementsByTagName('parsererror').length ? null : d; }
            var docX = px(tx[0]); if (!docX) throw new Error('no-document-xml');
            S = { media: {}, rels: {} };
            var MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp', svg: 'image/svg+xml' };
            media.forEach(function(n, i){
              var ext = (n.split('.').pop() || '').toLowerCase();
              if (arr[i] && MIME[ext]) S.media[n] = URL.createObjectURL(new Blob([arr[i]], { type: MIME[ext] }));
            });
            var relX = px(tx[3]);
            if (relX) kids(relX.documentElement).forEach(function(r){
              S.rels[r.getAttribute('Id')] = { target: r.getAttribute('Target') || '', ext: r.getAttribute('TargetMode') === 'External' };
            });
            parseStyles(px(tx[1])); parseNumbering(px(tx[2]));
            var setX = px(tx[4]), dt = setX ? first(setX.documentElement, 'defaultTabStop') : null;
            S.defTab = dt ? (num(attr(dt, 'val')) || 720) : 720;
            var baseR = resolveR(S.defParaId, null, {}, {});
            S.baseHalf = baseR.sz || 22;
            S.baseFont = baseR.font || S.defR.font || '';
            S.basePt = S.baseHalf / 2;
            var body = first(docX.documentElement, 'body');
            var sp = first(body, 'sectPr'), pg = sp ? first(sp, 'pgSz') : null, pm = sp ? first(sp, 'pgMar') : null;
            S.marL = pm ? (num(attr(pm, 'left')) || 1440) : 1440;
            S.textW = (pg ? (num(attr(pg, 'w')) || 11906) : 11906) - S.marL - (pm ? (num(attr(pm, 'right')) || 1440) : 1440);
            if (!(S.textW > 0)) S.textW = 9026;
            var html = blocks(body, { inTable: false, tblStyle: null });
            return { html: html, basePt: S.basePt, defTab: S.defTab, emw: S.textW / 20 / S.basePt, font: S.baseFont };
          });
        });
      });
    }

    // ---------- căn tab sau khi dựng (cần đo vị trí thật trên trang) ----------
    function layoutTabs(root){
      if (!root || !root.clientWidth) return;
      var cs = getComputedStyle(root), u = parseFloat(cs.fontSize) || 16;
      var basePt = parseFloat(root.getAttribute('data-basept')) || 11, defTw = parseFloat(root.getAttribute('data-deftab')) || 720;
      function T(tw){ return tw / 20 / basePt * u; }
      var tabs = root.querySelectorAll('.dx-tab'), i;
      for (i = 0; i < tabs.length; i++) { tabs[i].style.width = '0px'; tabs[i].style.borderBottom = ''; }
      for (i = 0; i < tabs.length; i++) {
        var tb = tabs[i], p = tb.closest('.dx-p'); if (!p) continue;
        var anc = (p.parentElement && p.parentElement.closest('td,.dx-tb,.dx-doc')) || root, acs = getComputedStyle(anc);
        var origin = anc.getBoundingClientRect().left + (parseFloat(acs.paddingLeft) || 0);
        var x = tb.getBoundingClientRect().left - origin;
        var stops = [], sa = p.getAttribute('data-dxt');
        if (sa) sa.split(',').forEach(function(s){ var a = s.split(':'); stops.push({ x: T(parseFloat(a[0])), val: a[1], leader: a[2] }); });
        var stop = null, j;
        for (j = 0; j < stops.length; j++) if (stops[j].x > x + 1) { stop = stops[j]; break; }
        var w;
        if (stop) {
          w = stop.x - x;
          if (stop.val === 'right' || stop.val === 'center' || stop.val === 'end' || stop.val === 'decimal') {
            var rg = document.createRange(); rg.setStartAfter(tb);
            var nx = tabs[i + 1];
            if (nx && nx.closest('.dx-p') === p) rg.setEndBefore(nx); else if (p.lastChild) rg.setEndAfter(p.lastChild);
            var sw = rg.getBoundingClientRect().width || 0;
            w = (stop.val === 'center') ? stop.x - x - sw / 2 : stop.x - x - sw;
          }
          if (stop.leader && stop.leader !== 'none') tb.style.borderBottom = '1px ' + (stop.leader === 'hyphen' ? 'dashed' : (stop.leader === 'underscore' ? 'solid' : 'dotted')) + ' currentColor';
        } else {
          var d = T(defTw); w = (Math.floor((x + 1) / d) + 1) * d - x;
        }
        tb.style.width = Math.max(0, w) + 'px';
      }
    }
    function mount(container, res){
      var st = '';
      if (res.font) { var ff = cssFont(res.font); if (ff) st += 'font-family:' + ff + ';'; }
      container.innerHTML = '<div class="dx-doc"' + (st ? ' style="' + st + '"' : '') +
        ' data-basept="' + res.basePt + '" data-deftab="' + res.defTab + '" data-emw="' + fmt(res.emw || 0) + '">' + res.html + '</div>';
      var root = container.firstChild;
      layoutTabs(root);
      var raf = 0;
      function again(){ if (raf) cancelAnimationFrame(raf); raf = requestAnimationFrame(function(){ raf = 0; layoutTabs(root); }); }
      if (window.ResizeObserver) new ResizeObserver(function(){ again(); }).observe(container);
      else window.addEventListener('resize', again);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(again);
      return root;
    }
    return { convert: convert, mount: mount, layoutTabs: layoutTabs };
  })();
  window.DocxView = DocxView;


