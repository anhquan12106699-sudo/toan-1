
  // ===== Tiện ích PDF trên trang bài =====
  function driveFileIdFromUrl(url){
    if (!url) return '';
    var s = String(url);
    if (s.indexOf('data:') === 0 || s.indexOf('blob:') === 0) return ''; // dữ liệu từ Supabase, không phải link Drive
    if (/^https?:\/\/[^\/]*supabase\.co\//i.test(s)) return ''; // link file trong Supabase Storage, không phải Drive (tránh nhầm tên file dài thành mã Drive)
    // Link Cloudflare R2 / CDN / URL không phải Google: KHÔNG phải Drive (tránh nhầm hostname pub-xxxx.r2.dev hay tên file dài thành mã Drive)
    if (/^https?:\/\//i.test(s) && !/^https?:\/\/(drive|docs)\.google\.com\//i.test(s)) return '';
    var m = s.match(/\/d\/([-\w]{25,})/);
    if (m) return m[1];
    m = s.match(/[?&]id=([-\w]{25,})/);
    if (m) return m[1];
    if (/^[-\w]{25,}$/.test(s)) return s; // chuỗi chỉ gồm mã Drive
    return '';
  }
  function extractPdfsFromItem(it){
    var list = [];
    if (!it) return list;
    if (it.pdfs && it.pdfs.length) {
      for (var i = 0; i < it.pdfs.length; i++) {
        var p = it.pdfs[i];
        if (!p) continue;
        if (typeof p === 'string' && p.trim()) list.push({ name: '', url: p.trim() });
        else if (p.url) list.push({ name: p.name || '', url: String(p.url).trim() });
      }
    }
    if (!list.length && it.pdf && String(it.pdf).trim()) {
      list.push({ name: it.pdfName || '', url: String(it.pdf).trim() });
    }
    if (!list.length) {
      var blob = String(it.detail || '') + ' ' + String(it.content || '');
      var re = /data-pdf-url="([^"]+)"/gi;
      var names = [];
      var re2 = /data-pdf-name="([^"]+)"/gi;
      var m2;
      while ((m2 = re2.exec(blob)) !== null) names.push(m2[1]);
      var m, idx = 0;
      while ((m = re.exec(blob)) !== null) {
        list.push({ name: names[idx] || '', url: m[1] });
        idx++;
      }
      if (!list.length) {
        var m3 = blob.match(/https:\/\/drive\.google\.com\/file\/d\/([-\w]{25,})[^"'\s]*/i);
        if (m3) list.push({ name: '', url: m3[0].replace(/["']+$/, '') });
      }
    }
    return list;
  }
  function renderArticlePdfFrame(it){
    var box = document.getElementById('apPdfBox');
    var frameWrap = document.getElementById('apPdfFrameWrap');
    var frame = document.getElementById('apPdfFrame');
    var listEl = document.getElementById('apPdfFileList');
    var titleEl = document.getElementById('apPdfTitle');
    var subEl = document.getElementById('apPdfSub');
    if (!box) return;

    var pdfs = extractPdfsFromItem(it);
    if (!pdfs.length) {
      box.classList.remove('show');
      if (frame) { frame.removeAttribute('src'); frame.removeAttribute('data-pdf-id'); }
      if (listEl) listEl.innerHTML = '';
      return;
    }

    box.classList.add('show');
    if (titleEl) {
      titleEl.textContent = pdfs.length > 1
        ? ('Tài liệu đính kèm (' + pdfs.length + ' file)')
        : (pdfs[0].name || (it.title ? (String(it.title) + ' — PDF') : 'Tài liệu đính kèm'));
    }
    var isMobile = window.matchMedia && window.matchMedia('(max-width:900px)').matches;
    if (subEl) {
      subEl.textContent = isMobile
        ? 'Bấm Xem trên từng file để mở trên điện thoại'
        : (pdfs.length > 1 ? 'Chọn file để xem bên dưới' : 'Xem trực tiếp bên dưới · hoặc tải về');
    }

    function openInFrame(pdf){
      var fileId = driveFileIdFromUrl(pdf.url);
      var previewUrl = fileId
        ? ('https://drive.google.com/file/d/' + fileId + '/preview')
        : pdf.url;
      if (frame && !isMobile) {
        if (frame.getAttribute('data-pdf-id') !== (fileId || pdf.url)) {
          frame.setAttribute('data-pdf-id', fileId || pdf.url);
          frame.src = previewUrl;
        }
        if (frameWrap) frameWrap.style.display = 'block';
      } else if (frame) {
        frame.removeAttribute('src');
        if (frameWrap) frameWrap.style.display = 'none';
      }
    }

    if (listEl) {
      listEl.innerHTML = '';
      pdfs.forEach(function(pdf, idx){
        var fileId = driveFileIdFromUrl(pdf.url);
        var viewUrl = fileId
          ? ('https://drive.google.com/file/d/' + fileId + '/view?usp=drivesdk')
          : pdf.url;
        var downloadUrl = fileId
          ? ('https://drive.google.com/uc?export=download&id=' + fileId)
          : pdf.url;
        var row = document.createElement('div');
        row.className = 'ap-pdf-file-row' + (idx === 0 ? ' active' : '');
        row.innerHTML =
          '<div class="ap-pdf-icon">PDF</div>' +
          '<div class="name"></div>' +
          '<div class="ap-pdf-actions">' +
            '<button type="button" class="ap-pdf-open">Xem</button>' +
            '<a class="ap-pdf-btn-view" target="_blank" rel="noopener noreferrer">Mở tab</a>' +
            '<a class="ap-pdf-btn-dl" target="_blank" rel="noopener noreferrer">Tải về</a>' +
          '</div>';
        row.querySelector('.name').textContent = pdf.name || ('File PDF ' + (idx + 1));
        row.querySelector('.ap-pdf-btn-view').href = viewUrl;
        row.querySelector('.ap-pdf-btn-dl').href = downloadUrl;
        if (!fileId) row.querySelector('.ap-pdf-btn-dl').setAttribute('download', pdf.name || ('tai-lieu-' + (idx + 1) + '.pdf'));
        row.querySelector('.ap-pdf-open').addEventListener('click', function(){
          listEl.querySelectorAll('.ap-pdf-file-row').forEach(function(r){ r.classList.remove('active'); });
          row.classList.add('active');
          if (isMobile) {
            try {
              var w = window.open(viewUrl, '_blank');
              if (!w) location.href = viewUrl;
            } catch (e) { location.href = viewUrl; }
          } else {
            openInFrame(pdf);
          }
        });
        listEl.appendChild(row);
      });
    }

    // Mặc định mở file đầu trên desktop
    openInFrame(pdfs[0]);
  }

  // ===== Đọc PDF -> hiện thành bài viết ngay trên trang (pdf.js, tải khi cần) =====
  var PDFJS_BASE = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/legacy/build/';
  var __pdfjsPromise = null;
  function loadPdfJs(){
    if (!__pdfjsPromise) {
      __pdfjsPromise = import(PDFJS_BASE + 'pdf.min.mjs').then(function(lib){
        lib.GlobalWorkerOptions.workerSrc = PDFJS_BASE + 'pdf.worker.min.mjs';
        return lib;
      });
    }
    return __pdfjsPromise;
  }
  function escHtml(t){
    return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  function linkifyHtml(t){
    return escHtml(t).replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]”"'])/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
  }
  // Gom các mảnh chữ của 1 trang thành dòng, rồi gom dòng thành đoạn văn / tiêu đề / gạch đầu dòng
  function pdfPageToBlocks(items){
    var rows = [];
    items.forEach(function(it){
      if (!it.str && !it.hasEOL) return;
      var tr = it.transform || [1,0,0,1,0,0];
      var size = Math.abs(tr[3]) || it.height || 10;
      var x = tr[4], y = tr[5];
      var row = null;
      for (var i = rows.length - 1; i >= 0 && i >= rows.length - 6; i--) {
        if (Math.abs(rows[i].y - y) <= Math.max(2, rows[i].size * 0.45)) { row = rows[i]; break; }
      }
      if (!row) { row = { y: y, size: size, parts: [], minX: x, maxX: x + (it.width || 0) }; rows.push(row); }
      row.parts.push({ x: x, w: it.width || 0, str: it.str });
      row.size = Math.max(row.size, size);
      row.minX = Math.min(row.minX, x);
      row.maxX = Math.max(row.maxX, x + (it.width || 0));
    });
    rows.sort(function(a,b){ return b.y - a.y; });
    var lines = rows.map(function(r){
      r.parts.sort(function(a,b){ return a.x - b.x; });
      var txt = '', prevEnd = null;
      r.parts.forEach(function(p){
        if (prevEnd !== null && p.x - prevEnd > r.size * 0.18 && !/^\s/.test(p.str) && !/\s$/.test(txt)) txt += ' ';
        txt += p.str;
        prevEnd = p.x + p.w;
      });
      return { text: txt.replace(/\s+/g,' ').trim(), y: r.y, size: r.size, minX: r.minX, maxX: r.maxX };
    }).filter(function(l){ return l.text; });
    return lines;
  }
  function pdfLinesToHtml(allPages){
    // thống kê cỡ chữ & lề để nhận diện tiêu đề, đoạn văn
    var sizes = [], minXs = [], maxXs = [];
    allPages.forEach(function(lines){ lines.forEach(function(l){
      if (l.fig) return;
      sizes.push(l.size); minXs.push(l.minX); maxXs.push(l.maxX);
    }); });
    if (!sizes.length) sizes.push(10), minXs.push(0), maxXs.push(100);
    var med = function(a){ var b=a.slice().sort(function(x,y){return x-y;}); return b[Math.floor(b.length/2)]; };
    var bodySize = med(sizes);
    var leftMargin = Math.min.apply(null, minXs.length > 20 ? minXs.slice().sort(function(a,b){return a-b;}).slice(0, Math.ceil(minXs.length*0.1)) : minXs);
    var rightEdge = med(maxXs.slice().sort(function(a,b){return b-a;}).slice(0, Math.max(1, Math.ceil(maxXs.length*0.3))));
    var fullW = Math.max(1, rightEdge - leftMargin);

    var html = [], para = null;
    function flush(){
      if (!para) return;
      var t = para.text.trim();
      if (t) {
        if (para.kind === 'h') html.push('<h3 class="pdf-h">' + linkifyHtml(t) + '</h3>');
        else if (para.kind === 'li') html.push('<p class="pdf-li">' + linkifyHtml(t) + '</p>');
        else html.push('<p' + (para.center ? ' class="pdf-center"' : '') + '>' + linkifyHtml(t) + '</p>');
      }
      para = null;
    }
    allPages.forEach(function(lines, pi){
      // bỏ số trang đơn lẻ ở đầu/cuối trang
      var textOnly = lines.filter(function(l){ return !l.fig; });
      if (textOnly.length && /^\d{1,3}$/.test(textOnly[0].text)) lines = lines.filter(function(l){ return l !== textOnly[0]; });
      if (textOnly.length > 1 && /^\d{1,3}$/.test(textOnly[textOnly.length-1].text)) lines = lines.filter(function(l){ return l !== textOnly[textOnly.length-1]; });
      var prev = null;
      lines.forEach(function(l){
        if (l.fig) { flush(); html.push('<img class="pdf-fig" alt="Hình trong bài viết" src="' + l.fig + '">'); prev = null; return; }
        var isHeading = l.size >= bodySize * 1.18 && l.text.length < 140;
        var isBullet = /^([•\-–—*▪●○]|\d{1,2}[.)]|[a-z][.)])\s+/.test(l.text) && l.text.length > 2;
        var lineW = l.maxX - l.minX;
        var centered = Math.abs(((l.minX + l.maxX)/2) - (leftMargin + fullW/2)) < fullW*0.04 && l.minX - leftMargin > fullW*0.08;
        var gap = prev ? (prev.y - l.y) : 0;
        var bigGap = prev && gap > Math.max(prev.size, l.size) * 1.75;
        var indent = l.minX - leftMargin > bodySize * 1.2 && !centered;
        var prevShort = prev && (prev.maxX - leftMargin) < fullW * 0.82;
        var prevEnds = prev && /[.!?:;…”"»)]$/.test(prev.text);
        var newPara = !para || isHeading || para.kind === 'h' || isBullet || bigGap || (indent && prevEnds) || (prevShort && prevEnds) || centered !== !!(para && para.center);
        if (newPara) {
          flush();
          para = { text: l.text, kind: isHeading ? 'h' : (isBullet ? 'li' : 'p'), center: centered && !isHeading };
        } else {
          // ghép dòng; nối từ bị ngắt bằng dấu gạch nối cuối dòng
          var lastTok = para.text.split(' ').pop();
          if (/https?:|\//.test(lastTok)) para.text += l.text; // link bị ngắt dòng: nối liền, giữ nguyên dấu gạch
          else if (/[A-Za-zÀ-ỹ]-$/.test(para.text) && /^[a-zà-ỹ]/.test(l.text)) para.text = para.text.slice(0,-1) + l.text;
          else para.text += ' ' + l.text;
        }
        prev = l;
      });
      // cuối trang: nếu đoạn kết thúc bằng dấu câu thì tách đoạn, không thì cho nối sang trang sau
      if (para && /[.!?:;…”"»)]$/.test(para.text)) flush();
    });
    flush();
    return html.join('\n');
  }

  // Tìm vị trí các ảnh trên trang PDF, rồi vẽ lại CHỈ vùng ảnh đó ở độ phân giải bằng (hoặc hơn) ảnh gốc
  function pdfPageFigures(lib, page){
    var OPS = lib.OPS;
    return page.getOperatorList().then(function(opList){
      var ctm = [1,0,0,1,0,0], stack = [], boxes = [];
      function comp(a, m){
        return [a[0]*m[0]+a[2]*m[1], a[1]*m[0]+a[3]*m[1], a[0]*m[2]+a[2]*m[3], a[1]*m[2]+a[3]*m[3],
                a[0]*m[4]+a[2]*m[5]+a[4], a[1]*m[4]+a[3]*m[5]+a[5]];
      }
      function nativeWidth(fn, args){
        // độ rộng (pixel) thật của ảnh nhúng trong PDF, để chọn độ phân giải vẽ lại
        try {
          if (fn === OPS.paintInlineImageXObject && args && args[0]) return args[0].width || 0;
          var name = args && args[0];
          if (typeof name !== 'string') return 0;
          var store = name.indexOf('g_') === 0 ? page.commonObjs : page.objs;
          if (store.has(name)) { var o = store.get(name); return (o && o.width) || 0; }
        } catch (e) {}
        return 0;
      }
      for (var i = 0; i < opList.fnArray.length; i++) {
        var fn = opList.fnArray[i], args = opList.argsArray[i];
        if (fn === OPS.save) stack.push(ctm.slice());
        else if (fn === OPS.restore) { if (stack.length) ctm = stack.pop(); }
        else if (fn === OPS.transform) ctm = comp(ctm, args);
        else if (fn === OPS.paintFormXObjectBegin) { stack.push(ctm.slice()); if (args && args[0]) ctm = comp(ctm, args[0]); }
        else if (fn === OPS.paintFormXObjectEnd) { if (stack.length) ctm = stack.pop(); }
        else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject ||
                 fn === OPS.paintImageMaskXObject || fn === OPS.paintJpegXObject) {
          var pts = [[0,0],[1,0],[0,1],[1,1]].map(function(q){
            return [ctm[0]*q[0]+ctm[2]*q[1]+ctm[4], ctm[1]*q[0]+ctm[3]*q[1]+ctm[5]];
          });
          var xs = pts.map(function(q){return q[0];}), ys = pts.map(function(q){return q[1];});
          boxes.push({ b: [Math.min.apply(null,xs), Math.min.apply(null,ys), Math.max.apply(null,xs), Math.max.apply(null,ys)],
                       nw: nativeWidth(fn, args) });
        }
      }
      var view = page.view, pw = view[2]-view[0], ph = view[3]-view[1];
      boxes = boxes.filter(function(o){
        var w = o.b[2]-o.b[0], h = o.b[3]-o.b[1];
        if (w < 40 || h < 40) return false;                    // bỏ icon / đường kẻ nhỏ
        if (w*h > pw*ph*0.85) return false;                    // bỏ ảnh phủ kín trang (PDF quét)
        return true;
      });
      var chain = Promise.resolve(), out = [];
      boxes.forEach(function(o){
        chain = chain.then(function(){
          var w = o.b[2]-o.b[0], h = o.b[3]-o.b[1];
          // độ phân giải: ít nhất 3x, đủ để bằng ảnh gốc, tối đa 5x và 4096px cạnh dài
          var scale = Math.max(3, Math.min(5, o.nw ? (o.nw / w) * 1.05 : 3));
          scale = Math.min(scale, 4096 / Math.max(w, h));
          var viewport = page.getViewport({ scale: scale });
          var T = viewport.transform;
          function tp(px, py){ return [T[0]*px + T[2]*py + T[4], T[1]*px + T[3]*py + T[5]]; }
          var p1 = tp(o.b[0], o.b[1]), p2 = tp(o.b[2], o.b[3]);
          var x = Math.min(p1[0], p2[0]), y = Math.min(p1[1], p2[1]);
          var cw = Math.max(1, Math.round(Math.abs(p2[0]-p1[0]))), ch = Math.max(1, Math.round(Math.abs(p2[1]-p1[1])));
          var canvas = document.createElement('canvas'); canvas.width = cw; canvas.height = ch;
          var ctx = canvas.getContext('2d');
          ctx.fillStyle = '#fff'; ctx.fillRect(0,0,cw,ch);
          // chỉ vẽ vùng ảnh (dịch gốc toạ độ), không dựng cả trang -> nhẹ và nét
          return page.render({ canvasContext: ctx, viewport: viewport, transform: [1,0,0,1,-x,-y] }).promise.then(function(){
            var url = '';
            try { url = canvas.toDataURL('image/jpeg', 0.95); } catch(e) {}
            if (url) out.push({ fig: url, y: o.b[3], minX: o.b[0], maxX: o.b[2], size: 0, text: '' });
          });
        });
      });
      return chain.then(function(){ return out; });
    }).catch(function(e){ console.warn('[pdf] không tách được ảnh trang', e); return []; });
  }

  function extractPdfArticleHtml(url){
    return loadPdfJs().then(function(lib){
      return lib.getDocument({ url: url }).promise.then(function(pdf){
        var pages = [], chain = Promise.resolve();
        for (var n = 1; n <= pdf.numPages; n++) {
          (function(n){
            chain = chain.then(function(){
              return pdf.getPage(n).then(function(pg){
                return pg.getTextContent().then(function(tc){
                  var lines = pdfPageToBlocks(tc.items);
                  return pdfPageFigures(lib, pg).then(function(figs){
                    var all = lines.concat(figs);
                    all.sort(function(a,b){ return b.y - a.y; });
                    pages.push(all);
                  });
                });
              });
            });
          })(n);
        }
        return chain.then(function(){
          var charCount = pages.reduce(function(a,l){ return a + l.reduce(function(b,x){ return b + (x.text ? x.text.length : 0); }, 0); }, 0);
          var figCount = pages.reduce(function(a,l){ return a + l.filter(function(x){ return x.fig; }).length; }, 0);
          if (charCount < 40 && !figCount) throw new Error('no-text'); // PDF dạng ảnh quét -> dùng khung xem dự phòng
          return pdfLinesToHtml(pages);
        });
      });
    });
  }
  var LIB_SECTIONS = [
    { key:'slide',   label:'Slide bài giảng' },
    { key:'noidung', label:'Tài liệu ôn tập', alias:['yeucau'] } // gộp cả file/ghi chú cũ của mục "Yêu cầu"
  ];
  // Bài Thư viện có 2 mục -> hiện accordion. Trả về true nếu đã xử lý.
  function renderLibSections(it){
    var host = document.getElementById('apLibSections');
    if (!host) return false;
    host.innerHTML = '';
    if (!it || String(it.category || '').trim() !== 'Thư viện') return false;
    var files = (it.pdfs || []).filter(function(p){ return p && p.url; });
    var notes = it.sectionNotes || {};
    var tagged = files.some(function(p){ return p.section; }) || Object.keys(notes).length > 0;
    if (!tagged) return false; // bài cũ (chưa chia mục) -> dùng khung xem PDF như trước
    var isMobile = window.matchMedia && window.matchMedia('(max-width:900px)').matches;
    LIB_SECTIONS.forEach(function(sec, i){
      var keys = [sec.key].concat(sec.alias || []);
      var list = files.filter(function(p){ return keys.indexOf(p.section || 'noidung') !== -1; });
      var note = keys.map(function(k){ return notes[k] || ''; }).filter(Boolean).join('\n\n');
      var d = document.createElement('details');
      d.className = 'ls-item';
      var sum = document.createElement('summary');
      sum.innerHTML = '<span class="ls-chev" aria-hidden="true"></span><span></span>' +
        (list.length ? '<span class="ls-cnt">' + list.length + '</span>' : '');
      sum.children[1].textContent = sec.label;
      d.appendChild(sum);
      var body = document.createElement('div');
      body.className = 'ls-body';
      if (note) { var n = document.createElement('div'); n.className = 'ls-note'; n.textContent = note; body.appendChild(n); }
      if (!list.length && !note) { var e = document.createElement('div'); e.className = 'ls-empty'; e.textContent = 'Chưa có tài liệu trong mục này.'; body.appendChild(e); }
      list.forEach(function(p, idx){
        var nm = p.name || ('tai-lieu-' + (idx + 1) + '.pdf');
        var box = document.createElement('div'); box.className = 'ls-file';
        box.innerHTML =
          '<div class="ls-file-row"><div class="ls-file-ic">PDF</div><div class="ls-file-name"></div>' +
          '<button type="button" class="ls-btn ls-view">Xem</button>' +
          '<a class="ls-btn ls-dl">Tải về</a></div><iframe class="ls-frame" title="Xem PDF"></iframe>';
        box.querySelector('.ls-file-name').textContent = nm;
        var dl = box.querySelector('.ls-dl'); dl.href = p.url; dl.setAttribute('download', nm);
        box.querySelector('.ls-view').addEventListener('click', function(){
          if (isMobile) { var w = window.open(p.url, '_blank'); if (!w) location.href = p.url; return; }
          var fr = box.querySelector('.ls-frame');
          if (box.classList.toggle('open')) { if (!fr.getAttribute('src')) fr.src = p.url; }
        });
        body.appendChild(box);
      });
      d.appendChild(body);
      if (i === 0) d.open = true;
      host.appendChild(d);
    });
    return true;
  }
  function renderArticlePdf(it){
    if (renderLibSections(it)) {
      var pb = document.getElementById('apPdfBox');
      if (pb) { pb.classList.remove('show', 'as-article'); }
      return;
    }
    // Hiển thị PDF dạng file (danh sách file + khung xem trước + nút tải), không đọc thành chữ
    var box0 = document.getElementById('apPdfBox'), out0 = document.getElementById('apPdfRendered');
    if (box0) box0.classList.remove('as-article');
    if (out0) out0.innerHTML = '';
    return renderArticlePdfFrame(it);
  }
  function renderArticlePdfAsText(it){
    var box = document.getElementById('apPdfBox');
    var out = document.getElementById('apPdfRendered');
    if (!box || !out) return renderArticlePdfFrame(it);
    var pdfs = extractPdfsFromItem(it);
    if (!pdfs.length) {
      box.classList.remove('as-article');
      out.innerHTML = '';
      return renderArticlePdfFrame(it);
    }
    var token = String(Date.now()) + Math.random();
    box.setAttribute('data-render-token', token);
    box.classList.add('show', 'as-article');
    out.innerHTML = '<div class="pdf-status">Đang đọc nội dung bài viết…</div>';

    var results = [];
    var chain = Promise.resolve();
    pdfs.forEach(function(pdf, idx){
      chain = chain.then(function(){
        return extractPdfArticleHtml(pdf.url).then(function(h){ results[idx] = h; });
      });
    });
    chain.then(function(){
      if (box.getAttribute('data-render-token') !== token) return;
      var html = '<div class="pdf-doc">' + results.join('<hr style="border:0;border-top:1px solid var(--line);margin:2em 0">') + '</div>';
      var actions = '<div class="pdf-actions">';
      pdfs.forEach(function(pdf, idx){
        var fileId = driveFileIdFromUrl(pdf.url);
        var dl = fileId ? ('https://drive.google.com/uc?export=download&id=' + fileId) : pdf.url;
        var nm = pdf.name || ('tai-lieu-' + (idx + 1) + '.pdf');
        actions += '<a href="' + escHtml(dl) + '" target="_blank" rel="noopener noreferrer" download="' + escHtml(nm) + '">Tải file PDF gốc' + (pdfs.length > 1 ? ' (' + (idx+1) + ')' : '') + '</a>';
      });
      actions += '</div>';
      out.innerHTML = sanitizeHtml(html + actions);
    }).catch(function(err){
      if (box.getAttribute('data-render-token') !== token) return;
      console.warn('[pdf] Không dựng được bài từ PDF, dùng khung xem PDF:', err);
      box.classList.remove('as-article');
      out.innerHTML = '';
      renderArticlePdfFrame(it);
    });
  }

  // giữ hàm cũ nếu còn chỗ gọi (không dùng)
  function extractPdfUrlFromItem(it){
    var list = extractPdfsFromItem(it);
    return list.length ? list[0].url : '';
  }

  function extractWordFromItem(it){
    if (!it) return null;
    var url = (it.word && String(it.word).trim()) ? String(it.word).trim() : '';
    var gdoc = (it.gdoc && String(it.gdoc).trim()) ? String(it.gdoc).trim() : '';
    var gdocId = (it.gdocId && String(it.gdocId).trim()) ? String(it.gdocId).trim() : '';
    var name = it.wordName || '';
    if (!url && !gdoc) {
      var blob = String(it.detail || '');
      var m = blob.match(/data-word-url="([^"]+)"/i);
      if (m) url = m[1];
      var nm = blob.match(/data-word-name="([^"]+)"/i);
      if (nm) name = nm[1];
      var mg = blob.match(/data-gdoc-url="([^"]+)"/i);
      if (mg) gdoc = mg[1];
    }
    if (!url && !gdoc) return null;
    if (!gdocId && gdoc) {
      var m2 = String(gdoc).match(/\/d\/([-\w]{25,})/);
      if (m2) gdocId = m2[1];
    }
    return { url: url, gdoc: gdoc, gdocId: gdocId, name: name };
  }
  function extractWordsFromItem(it){
    var w = extractWordFromItem(it);
    return w ? [w] : [];
  }
  function renderArticleWordFrame(it){
    var box = document.getElementById('apWordBox');
    var frame = document.getElementById('apWordFrame');
    var frameWrap = document.getElementById('apWordFrameWrap');
    var renderedEl = document.getElementById('apWordRendered');
    var listEl = document.getElementById('apWordFileList');
    var titleEl = document.getElementById('apWordTitle');
    var subEl = document.getElementById('apWordSub');
    if (!box) return;

    var words = extractWordsFromItem(it);
    if (!words.length) {
      box.classList.remove('show');
      if (frame) { frame.removeAttribute('src'); frame.removeAttribute('data-word-id'); }
      if (renderedEl) { renderedEl.classList.remove('show'); renderedEl.innerHTML = ''; }
      if (listEl) listEl.innerHTML = '';
      return;
    }

    box.classList.add('show');
    if (titleEl) {
      titleEl.textContent = words.length > 1
        ? ('Tài liệu Word đính kèm (' + words.length + ' file)')
        : (words[0].name || (it.title ? (String(it.title) + ' — Word') : 'Tài liệu Word đính kèm'));
    }
    var isMobile = window.matchMedia && window.matchMedia('(max-width:900px)').matches;
    if (subEl) {
      subEl.textContent = isMobile
        ? 'Bấm Xem trên từng file để mở trên điện thoại'
        : (words.length > 1 ? 'Chọn file để xem bên dưới' : 'Xem trực tiếp bên dưới · hoặc tải về');
    }

    // Suy ra các đường link xem/tải cho 1 file Word
    function buildLinks(w){
      var fileId = driveFileIdFromUrl(w.url);
      var viewUrl = w.gdoc
        ? w.gdoc
        : (fileId ? ('https://drive.google.com/file/d/' + fileId + '/view?usp=drivesdk') : w.url);
      var downloadUrl = fileId
        ? ('https://drive.google.com/uc?export=download&id=' + fileId)
        : (w.url || viewUrl);
      // Ưu tiên Google Doc đã convert để xem trong iframe
      var previewUrl = '';
      if (w.gdocId) {
        previewUrl = 'https://docs.google.com/document/d/' + w.gdocId + '/preview';
      } else if (w.gdoc) {
        var gid = driveFileIdFromUrl(w.gdoc);
        previewUrl = gid
          ? ('https://docs.google.com/document/d/' + gid + '/preview')
          : w.gdoc;
      } else if (fileId) {
        // Office Online với link tải Drive (đôi khi chạy được với docx)
        var direct = 'https://drive.google.com/uc?export=download&id=' + fileId;
        previewUrl = 'https://view.officeapps.live.com/op/embed.aspx?src=' + encodeURIComponent(direct);
      } else if (/^https?:\/\//i.test(w.url || '')) {
        // File .docx công khai (vd Cloudflare R2): xem bằng Office Online với đúng URL gốc
        previewUrl = 'https://view.officeapps.live.com/op/embed.aspx?src=' + encodeURIComponent(w.url);
      } else {
        previewUrl = viewUrl;
      }
      var isRawUpload = !fileId && !w.gdocId && !w.gdoc && !/^https?:\/\//i.test(w.url || ''); // file Word tải thẳng lên Supabase (base64), không có link xem online
      return { fileId: fileId, viewUrl: viewUrl, downloadUrl: downloadUrl, previewUrl: previewUrl, isRawUpload: isRawUpload };
    }

    function openWord(w){
      var L = buildLinks(w);
      if (L.isRawUpload) {
        // Không có link công khai để dùng Google/Office Viewer -> tự chuyển .docx sang HTML bằng mammoth.js
        if (frame) { frame.removeAttribute('src'); }
        if (frameWrap) frameWrap.style.display = 'none';
        if (renderedEl) {
          renderedEl.classList.add('show');
          renderedEl.innerHTML = '<p style="color:#888;">Đang tải nội dung file Word…</p>';
          wordArrayBuffer(it, w).then(function(buf){
            return DocxView.convert(buf).then(function(res){
              DocxView.mount(renderedEl, res);
            }, function(err){
              console.warn('[word] Bộ chuyển đổi riêng lỗi, thử mammoth:', err);
              return loadMammoth().then(function(){ return mammoth.convertToHtml({ arrayBuffer: buf }); })
                .then(function(r){ renderedEl.innerHTML = sanitizeHtml(r.value) || uxWordFailHtml(); uxBindWordFail(renderedEl); });
            });
          }).catch(function(err){
            console.error('[word] Lỗi chuyển đổi Word:', err);
            renderedEl.innerHTML = uxWordFailHtml(); uxBindWordFail(renderedEl);
          });
        }
        return;
      }
      // Trường hợp có link Google Drive / Google Doc -> xem qua iframe, giống PDF
      if (renderedEl) { renderedEl.classList.remove('show'); renderedEl.innerHTML = ''; }
      if (frame && !isMobile) {
        var key = L.previewUrl;
        if (frame.getAttribute('data-word-id') !== key) {
          frame.setAttribute('data-word-id', key);
          frame.src = L.previewUrl;
        }
        if (frameWrap) frameWrap.style.display = 'block';
      } else if (frame) {
        frame.removeAttribute('src');
        if (frameWrap) frameWrap.style.display = 'none';
      }
    }

    if (listEl) {
      listEl.innerHTML = '';
      words.forEach(function(w, idx){
        var L = buildLinks(w);
        var row = document.createElement('div');
        row.className = 'ap-word-file-row' + (idx === 0 ? ' active' : '');
        row.innerHTML =
          '<div class="ap-word-file-icon">W</div>' +
          '<div class="name"></div>' +
          '<div class="ap-word-file-actions">' +
            '<button type="button" class="ap-word-open">Xem</button>' +
            (L.isRawUpload ? '' : '<a class="ap-word-btn-view" target="_blank" rel="noopener noreferrer">Mở tab</a>') +
            '<a class="ap-word-btn-dl">Tải file Word (.docx)</a>' +
          '</div>';
        row.querySelector('.name').textContent = w.name || (it.title ? (String(it.title) + ' — Word') : ('File Word ' + (idx + 1)));
        var viewLink = row.querySelector('.ap-word-btn-view');
        if (viewLink) viewLink.href = L.viewUrl;
        var dlLink = row.querySelector('.ap-word-btn-dl');
        var dlFileName = (w.name || (it.title ? (String(it.title) + '.docx') : 'tai-lieu.docx'));
        if (!/\.docx?$/i.test(dlFileName)) dlFileName += '.docx';
        if (L.isRawUpload) {
          // File Word gốc (base64 -> blob) đang nằm ngay trên trình duyệt:
          // ép trình duyệt LƯU FILE THẬT (.docx) thay vì chỉ mở/đọc dữ liệu.
          dlLink.href = 'javascript:void(0)';
          dlLink.addEventListener('click', function(ev){
            ev.preventDefault();
            var a = document.createElement('a');
            a.href = L.downloadUrl; // blob: URL chứa đúng bytes file .docx gốc
            a.download = dlFileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          });
        } else {
          dlLink.href = L.downloadUrl;
          dlLink.setAttribute('target', '_blank');
          dlLink.setAttribute('rel', 'noopener noreferrer');
          dlLink.setAttribute('download', dlFileName);
        }
        row.querySelector('.ap-word-open').addEventListener('click', function(){
          listEl.querySelectorAll('.ap-word-file-row').forEach(function(r){ r.classList.remove('active'); });
          row.classList.add('active');
          if (isMobile && !L.isRawUpload) {
            try {
              var win = window.open(L.viewUrl, '_blank');
              if (!win) location.href = L.viewUrl;
            } catch (e) { location.href = L.viewUrl; }
          } else {
            openWord(w);
          }
        });
        listEl.appendChild(row);
      });
    }

    // Mặc định mở file đầu
    openWord(words[0]);
  }

  // ===== Word -> hiện thành bài viết ngay trên trang (giống PDF) =====
  function wordArrayBuffer(it, w){
    if (it && it.wordRawBase64) {
      var raw = String(it.wordRawBase64), c = raw.indexOf(',');
      if (raw.indexOf('data:') === 0 && c !== -1) raw = raw.slice(c + 1);
      var bin = atob(raw), bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return Promise.resolve(bytes.buffer);
    }
    if (w && w.url) return fetch(w.url).then(function(r){ return r.arrayBuffer(); });
    return Promise.reject(new Error('no-word-data'));
  }
  function renderArticleWord(it){
    var box = document.getElementById('apWordBox');
    var out = document.getElementById('apWordArticle');
    var cat = String((it && it.category) || '').trim();
    var w = extractWordsFromItem(it)[0];
    var isRaw = w && !w.gdoc && !w.gdocId && !driveFileIdFromUrl(w.url); // gồm cả link R2 -> in thẳng nội dung lên trang
    // Mục "Thư viện" giữ dạng file để tải; các mục khác (Hội thảo - Tọa đàm, Tin tức...)
    // hiện THẲNG nội dung Word thành văn bản trên trang, không còn khung file Word.
    if (!box || !out || !w || !isRaw || cat === 'Thư viện') {
      if (box) box.classList.remove('as-article');
      if (out) out.innerHTML = '';
      return renderArticleWordFrame(it);
    }
    var token = String(Date.now()) + Math.random();
    box.setAttribute('data-render-token', token);
    box.classList.add('show', 'as-article');
    out.innerHTML = '<div class="pdf-status">Đang đọc nội dung bài viết…</div>';
    function stale(){ return box.getAttribute('data-render-token') !== token; }
    wordArrayBuffer(it, w).then(function(buf){
      return DocxView.convert(buf).catch(function(err){
        console.warn('[word] Bộ chuyển đổi riêng lỗi, thử mammoth:', err);
        return loadMammoth().then(function(){ return mammoth.convertToHtml({ arrayBuffer: buf }); })
          .then(function(r){ return { fallbackHtml: sanitizeHtml((r && r.value) || '') }; });
      });
    }).then(function(res){
      if (stale()) return;
      var card = document.createElement('div');
      card.className = 'dx-card';
      out.innerHTML = '';
      out.appendChild(card);
      if (res.fallbackHtml !== undefined) card.innerHTML = '<div class="dx-doc dx-fallback">' + res.fallbackHtml + '</div>';
      else DocxView.mount(card, res);
      if (!card.textContent.trim() && !card.querySelector('img')) throw new Error('empty');
    }).catch(function(err){
      if (stale()) return;
      console.warn('[word] Không dựng được bài từ Word, dùng khung xem:', err);
      box.classList.remove('as-article');
      out.innerHTML = '';
      renderArticleWordFrame(it);
    });
  }

  window.__renderArticleWord = renderArticleWord;

  window.__renderArticlePdf = renderArticlePdf;

