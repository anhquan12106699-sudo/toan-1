  // ================================================================================
  // ===== ĐĂNG BÀI TỰ ĐỘNG TỪ SUPABASE (mục Thông báo / Tin ngành Toán kinh tế) =====
  // Dán CÙNG Project URL và anon key đã dùng ở trang đăng bài (dang-bai-supabase.html).
  // ================================================================================
  const SUPABASE_URL = "https://dawnjnljkferinamktiq.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhd25qbmxqa2ZlcmluYW1rdGlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0MjY5NjgsImV4cCI6MjEwNDAwMjk2OH0.gWZoU3nLm4otno3eUDj9N_iRNyEPipobOm5fkOlHYao";
  const SUPABASE_TABLE = "posts";
  const NEWS_FEED_URL = ""; // không dùng nữa, giữ lại để không vỡ code cũ tham chiếu biến này

  const __supabaseClient = (window.__sbCreate && SUPABASE_URL.indexOf('YOUR-PROJECT-REF') === -1)
    ? window.__sbCreate(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

  // Chuyển 1 dòng trong bảng posts thành object "item" cùng hình dạng mà code hiển thị bên dưới đang mong đợi
  // Chuyển chuỗi base64 thành Blob URL (blob:...) ngắn gọn, thay vì nhúng data:... rất dài
  // (data URI quá dài khiến một số trình duyệt/app trong ứng dụng không mở được link).
  function base64ToBlobUrl(base64, mime){
    try {
      if (!base64) return '';
      // Nếu chuỗi lưu dạng đầy đủ "data:...;base64,AAAA..." (do FileReader.readAsDataURL),
      // chỉ lấy phần base64 thuần sau dấu phẩy để atob() không bị lỗi.
      var comma = base64.indexOf(',');
      var pure = (base64.indexOf('data:') === 0 && comma !== -1) ? base64.slice(comma + 1) : base64;
      const byteChars = atob(pure);
      const byteLen = byteChars.length;
      const byteArray = new Uint8Array(byteLen); // typed array: nhẹ hơn nhiều so với new Array(...)
      for (let i = 0; i < byteLen; i++) byteArray[i] = byteChars.charCodeAt(i);
      var okMime = /^(image\/(png|jpe?g|gif|webp|avif)|application\/pdf|application\/(msword|vnd\.openxmlformats-officedocument\.[a-z.]+)|application\/octet-stream)$/i.test(String(mime || ''));
      const blob = new Blob([byteArray], { type: okMime ? mime : 'application/octet-stream' });
      return URL.createObjectURL(blob);
    } catch (e) {
      console.error('[base64ToBlobUrl] Lỗi giải mã file:', e);
      return '';
    }
  }

  function mapSupabaseRow(row){
    const image = row.image_url ? row.image_url : (row.image_base64
      ? base64ToBlobUrl(row.image_base64, row.image_type || 'image/jpeg')
      : '');
    const word = row.word_url ? row.word_url : (row.word_base64
      ? base64ToBlobUrl(row.word_base64, row.word_type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
      : '');
    let pdfs = [];
    if (Array.isArray(row.pdfs)) {
      pdfs = row.pdfs.filter(p => p && (p.base64 || p.url)).map(p => ({
        name: p.name || '',
        section: p.section || '',
        url: p.url ? p.url : base64ToBlobUrl(p.base64, p.type || 'application/pdf')
      }));
    }
    // Ghi chú chữ của các mục (Thư viện) được lưu cùng mảng pdfs dưới dạng kind:'note'
    const sectionNotes = {};
    if (Array.isArray(row.pdfs)) {
      row.pdfs.forEach(p => { if (p && p.kind === 'note' && p.section && p.text) sectionNotes[p.section] = String(p.text); });
    }
    return {
      id: String(row.id),
      time: row.created_at,
      category: row.category || '',
      title: row.title || '',
      badge: row.badge || '',
      content: row.content || '',
      detail: row.detail || '',
      docUrl: row.doc_url || '',
      image: image,
      word: word,
      wordRawBase64: row.word_base64 || '',
      wordName: row.word_name || '',
      pdfs: pdfs,
      sectionNotes: sectionNotes
    };
  }

  // Cache RAW dữ liệu từ Supabase (giữ base64 gốc) trong bộ nhớ của trang hiện tại.
  // Không dùng sessionStorage vì dữ liệu base64 (ảnh/Word/PDF) có thể rất lớn,
  // dễ vượt hạn mức sessionStorage; và Blob URL chỉ dùng được trong đúng phiên trang hiện tại.
  let __newsRawRows = null;
  let __newsFeedPromise = null;
  let __newsFeedItems = null;
  const __newsImages = {};
  // Danh sách chỉ lấy các cột NHẸ (không kèm file PDF/Word/ảnh base64) -> hiện ngay.
  // (Tuỳ chọn) Tên cột chứa LINK ảnh thu nhỏ (vd 'thumb_url' trên Supabase Storage). Để '' nếu chưa có cột này.
  // Khi có cột, thẻ tin dùng link trực tiếp -> không cần tải base64 ảnh bìa nữa.
  const NEWS_THUMB_COL = '';
  const NEWS_LIGHT_COLS = 'id,created_at,category,title,badge,content,doc_url,word_name' + (NEWS_THUMB_COL ? ',' + NEWS_THUMB_COL : '');
  const COVER_MAX_PX = 1200; // cạnh dài tối đa của ảnh bìa hiển thị trên thẻ

  // Giải mã base64 -> thu nhỏ còn <= COVER_MAX_PX (webp) -> giảm RAM và công vẽ ảnh khi có nhiều thẻ tin
  function makeCoverUrl(base64, mime){
    const full = base64ToBlobUrl(base64, mime);
    if (!full || !window.createImageBitmap || !HTMLCanvasElement.prototype.toBlob) return Promise.resolve(full);
    return fetch(full).then(r => r.blob()).then(b => createImageBitmap(b)).then(bm => {
      const sc = Math.min(1, COVER_MAX_PX / Math.max(bm.width, bm.height));
      if (sc >= 1) { if (bm.close) bm.close(); return full; }
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(bm.width * sc)); c.height = Math.max(1, Math.round(bm.height * sc));
      c.getContext('2d').drawImage(bm, 0, 0, c.width, c.height);
      if (bm.close) bm.close();
      return new Promise(res => c.toBlob(bl => {
        if (!bl) { res(full); return; }
        URL.revokeObjectURL(full);
        res(URL.createObjectURL(bl));
      }, 'image/webp', 0.88));
    }).catch(() => full);
  }

  function applyNewsImages(){
    Object.keys(__newsImages).forEach(function(id){
      var url = __newsImages[id];
      if (!url) return;
      var sel = 'a[href="?post=' + encodeURIComponent(id) + '"]';
      document.querySelectorAll(sel).forEach(function(a){
        if (a.dataset.imgSet) return;
        var th = a.querySelector('.news-card-thumb,.hn-marquee-thumb,.hn-featured-thumb,.hn-featured-item-thumb');
        if (th) {
          th.style.backgroundImage = "url('" + url + "')";
          th.style.backgroundSize = 'cover';
          th.style.backgroundPosition = 'center';
          a.dataset.imgSet = '1';
        } else if (a.classList.contains('notice-card')) {
          var body = a.querySelector('.notice-body');
          if (body) {
            var im = document.createElement('img');
            im.src = url; im.alt = ''; im.loading = 'lazy';
            im.style.cssText = 'margin-top:10px;border-radius:12px;max-width:100%;display:block;';
            body.appendChild(im);
          }
          a.dataset.imgSet = '1';
        }
      });
    });
  }
  window.__applyNewsImages = applyNewsImages;

  // Ảnh bìa tải nền: 1 luồng, nhóm nhỏ, bài mới trước, TẠM DỪNG khi đang đọc bài (nhường băng thông cho bài)
  function startNewsImageLoading(rows){
    var ids = rows.map(function(r){ return String(r.id); }).filter(function(id){ return !__newsImages[id]; });
    var batches = [];
    for (var i = 0; i < ids.length; i += 3) batches.push(ids.slice(i, i + 3));
    var next = 0;
    function worker(){
      if (next >= batches.length) return Promise.resolve();
      if (document.body.classList.contains('article-mode')) {
        // đang đọc bài -> chờ rồi kiểm tra lại, tiếp tục khi người dùng về trang chủ
        return new Promise(function(r){ setTimeout(r, 800); }).then(worker);
      }
      var batch = batches[next++];
      return __supabaseClient.from(SUPABASE_TABLE).select('id,image_url,image_base64,image_type').in('id', batch)
        .then(function(res){
          return Promise.all((res.data || []).map(function(r){
            if (r.image_url) { __newsImages[String(r.id)] = r.image_url; if (typeof out !== 'undefined') out[String(r.id)] = r.image_url; return null; }
            if (!r.image_base64) return null;
            return makeCoverUrl(r.image_base64, r.image_type || 'image/jpeg').then(function(u){ __newsImages[String(r.id)] = u; });
          }));
        })
        .then(applyNewsImages)
        .catch(function(e){ console.warn('[ảnh bìa] lỗi tải', e); })
        .then(worker);
    }
    worker();
  }

  function loadNewsFeed(force){
    if (!__supabaseClient) return Promise.resolve([]);
    if (!force && __newsFeedItems) return Promise.resolve(__newsFeedItems);
    if (!force && __newsFeedPromise) return __newsFeedPromise;
    const q = (cols) => __supabaseClient.from(SUPABASE_TABLE).select(cols)
      .order('created_at', { ascending: false }).limit(120);
    let earlyFeed = null;
    if (!force && !NEWS_THUMB_COL && window.__sbEarly && window.__sbEarly.feed) { earlyFeed = window.__sbEarly.feed; window.__sbEarly.feed = null; }
    __newsFeedPromise = (earlyFeed ? Promise.resolve(earlyFeed) : q(NEWS_LIGHT_COLS))
      .then(res => {
        if (!res.error) return { data: res.data, light: true };
        // Nếu tên cột khác dự kiến thì quay về cách cũ
        return q('*').then(r => { if (r.error) throw r.error; return { data: r.data, light: false }; });
      })
      .then(({ data, light }) => {
        __newsRawRows = Array.isArray(data) ? data : [];
        const items = __newsRawRows.map(mapSupabaseRow);
        __newsFeedItems = items;
        if (NEWS_THUMB_COL) __newsRawRows.forEach(function(r){ if (r[NEWS_THUMB_COL]) __newsImages[String(r.id)] = r[NEWS_THUMB_COL]; });
        if (light) setTimeout(function(){ applyNewsImages(); startNewsImageLoading(__newsRawRows); }, 0);
        return items;
      })
      .catch(err => {
        __newsFeedPromise = null;
        throw err;
      });
    return __newsFeedPromise;
  }
  // Mở bài: chỉ tải phần CHỮ của đúng bài đó (nhẹ) -> hiện ngay.
  // Không lấy image_base64 (trang bài không dùng ảnh bìa), word_base64 và pdfs (rất nặng).
  const ARTICLE_TEXT_COLS = 'id,created_at,category,title,badge,content,detail,doc_url,word_name,word_type';
  // Cache bài đã tải trong bộ nhớ (tối đa 20 bài) -> mở lại / mở sau khi rê chuột vào gần như tức thì
  const __articleCache = new Map();
  function loadArticleFull(postId){
    if (!__supabaseClient) return Promise.resolve([]);
    const key = String(postId);
    if (__articleCache.has(key)) return __articleCache.get(key);
    // Nếu trang được mở bằng ?post=... thì request đã được gửi từ <head> -> dùng lại, không gửi lần 2
    const eb = window.__sbEarly || {};
    let src = null;
    if (eb.article && key === String(new URLSearchParams(location.search).get('post'))) { src = eb.article; eb.article = null; }
    if (!src) src = __supabaseClient.from(SUPABASE_TABLE).select(ARTICLE_TEXT_COLS).eq('id', postId).limit(1);
    const p = Promise.resolve(src)
      .then(res => {
        if (res.error) throw res.error;
        if (res.data && res.data.length) return [mapSupabaseRow(res.data[0])];
        __articleCache.delete(key); // không tìm thấy -> không cache
        return loadNewsFeed();
      })
      .catch(() => { __articleCache.delete(key); return loadNewsFeed(); });
    __articleCache.set(key, p);
    if (__articleCache.size > 20) __articleCache.delete(__articleCache.keys().next().value);
    return p;
  }
  // Tải trước bài (chữ + file đính kèm) khi người dùng sắp bấm
  window.__prefetchArticle = function(postId){
    try {
      if (!postId || !__supabaseClient) return;
      loadArticleFull(postId).then(function(items){
        const it = Array.isArray(items) && items.find(function(x){ return String(x.id || '') === String(postId); });
        if (it && typeof loadArticleFiles === 'function') loadArticleFiles(it, postId).catch(function(){});
      }).catch(function(){});
    } catch (e) {}
  };
  // File đính kèm (Word/PDF) tải SAU, ở nền, sau khi chữ đã hiện. Gắn vào chính object `it`.
  const __articleFilesCache = {};
  function loadArticleFiles(it, postId){
    if (!__supabaseClient) return Promise.resolve(it);
    const key = String(postId);
    if (!__articleFilesCache[key]) {
      __articleFilesCache[key] = __supabaseClient.from(SUPABASE_TABLE)
        .select('word_url,word_base64,word_type,pdfs').eq('id', postId).limit(1)
        .then(res => (res && res.data && res.data[0]) || {})
        .catch(e => { console.warn('[file đính kèm] lỗi tải', e); delete __articleFilesCache[key]; return {}; });
    }
    return __articleFilesCache[key].then(row => {
      const m = mapSupabaseRow(Object.assign({}, row, { id: postId, word_name: it.wordName }));
      it.word = m.word;
      it.wordRawBase64 = m.wordRawBase64;
      it.pdfs = m.pdfs;
      it.sectionNotes = m.sectionNotes;
      return it;
    });
  }
  window.__loadArticleFiles = loadArticleFiles;
  window.__loadArticleFull = loadArticleFull;
  window.__loadNewsFeed = loadNewsFeed;
  // Lấy ảnh bìa cho vài bài (dùng cho cột "Tin cùng chuyên mục")
  window.__getNewsCovers = function(ids){
    const out = {};
    const need = (ids || []).map(String).filter(function(id){ if (__newsImages[id]) { out[id] = __newsImages[id]; return false; } return true; });
    if (!need.length || !__supabaseClient) return Promise.resolve(out);
    return __supabaseClient.from(SUPABASE_TABLE).select('id,image_url,image_base64,image_type').in('id', need)
      .then(function(res){
        return Promise.all((res.data || []).map(function(r){
          if (r.image_url) { __newsImages[String(r.id)] = r.image_url; if (typeof out !== 'undefined') out[String(r.id)] = r.image_url; return null; }
            if (!r.image_base64) return null;
          return makeCoverUrl(r.image_base64, r.image_type || 'image/jpeg').then(function(u){ __newsImages[String(r.id)] = u; out[String(r.id)] = u; });
        }));
      }).then(function(){ return out; }).catch(function(){ return out; });
  };

  (function initNewsFeed(){
    if (!__supabaseClient) {
      // Thư viện Supabase không tải được (mất mạng / bị chặn) -> báo lỗi thay vì để "Đang tải…" mãi
      if (SUPABASE_URL.indexOf('YOUR-PROJECT-REF') === -1) {
                ['hnLatestTrack','libGrid'].forEach(function(id){
          var el = document.getElementById(id); if (!el) return;
          var host = el;
          // "Tin mới nhất" là băng chuyền: thay cả khung cuộn để thẻ lỗi không bị cắt
          if (id === 'hnLatestTrack') {
            host = document.getElementById('hnLatestMarquee') || el.parentElement;
            host.style.maskImage = 'none';
            host.style.webkitMaskImage = 'none';
          }
          host.innerHTML = '<div class="load-error" role="alert">'+
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.4 20.6 19H3.4z"/><path d="M12 9.4v4.2"/><path d="M12 16.5h.01"/></svg>'+
            '<strong>Chưa kết nối được máy chủ tin tức</strong>'+
            '<span>Hãy kiểm tra kết nối mạng rồi thử lại. Trong lúc chờ, bạn vẫn xem được các tin đã đăng trước đó.</span>'+
            '<button type="button" class="retry-news">Thử lại</button></div>';
          var b = host.querySelector('.retry-news'); if (b) b.addEventListener('click', function(){ location.reload(); });
        });
      }
      return;
    }

    const escapeHtml = (str) => String(str || '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    const nl2br = (str) => escapeHtml(str).replace(/\n/g,'<br>');
    const fmtDate = (val) => {
      let d = null;
      if (val instanceof Date) {
        d = val;
      } else if (typeof val === 'number') {
        d = new Date(val);
      } else if (typeof val === 'string' && val.trim()) {
        d = new Date(val);
        if (isNaN(d.getTime())) {
          // thử định dạng kiểu Việt Nam: dd/mm/yyyy hoặc dd-mm-yyyy [hh:mm:ss]
          const m = val.trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
          if (m) d = new Date(+m[3], +m[2]-1, +m[1]);
        }
      }
      if (!d || isNaN(d.getTime())) return {day:'', mon:''};
      return { day: String(d.getDate()).padStart(2,'0'), mon: 'Th' + (d.getMonth()+1) + ' ' + d.getFullYear() };
    };

    loadNewsFeed()
      .then(items => {
        if (!Array.isArray(items) || !items.length) return;

        const thongBaoList = document.querySelector('#thong-bao .notice-list');
        const tinNganhGrid  = document.querySelector('#tin-nganh .news-grid');
        const hoiThaoGrid   = document.querySelector('#hoi-thao .news-grid');

        // Bài mới đăng luôn lên đầu, bài cũ xếp sau
        const __t = (x) => { const d = new Date(x.time); return isNaN(d.getTime()) ? 0 : d.getTime(); };
        items = items.slice().sort((a, b) => __t(b) - __t(a));

        items.forEach(it => {
          const cat = (it.category || '').trim();
          const chipLabel = ((it.badge || '').trim() || cat);
          const { day, mon } = fmtDate(it.time);
          const postId = String(it.id || it.time || '');

          if (cat === 'Thông báo' && thongBaoList) {
            const art = document.createElement('a');
            art.className = 'notice-card';
            art.href = '?post=' + encodeURIComponent(postId);
            art.innerHTML =
              '<div class="notice-date"><span class="day">' + day + '</span><span class="mon">' + mon + '</span></div>' +
              '<div class="notice-body">' +
                '<h3>' + escapeHtml(it.title) + '</h3>' +
                '<p>' + nl2br(it.content) + '</p>' +
                (it.image ? '<img src="' + it.image + '" alt="" style="margin-top:10px;border-radius:12px;max-width:100%;display:block;">' : '') +
              '</div>' +
              (it.badge ? '<span class="notice-tag">' + escapeHtml(it.badge) + '</span>' : '');
            thongBaoList.appendChild(art);
          }

          if (cat === 'Tin ngành Toán kinh tế' && tinNganhGrid) {
            const a = document.createElement('a');
            a.href = '?post=' + encodeURIComponent(postId);
            a.className = 'news-card';
            const thumbStyle = it.image
              ? "background-image:url('" + it.image + "');background-size:cover;background-position:center;"
              : '';
            a.innerHTML =
              '<div class="news-card-thumb" style="' + thumbStyle + '">' +
                (chipLabel ? '<span class="badge">' + escapeHtml(chipLabel) + '</span>' : '') +
              '</div>' +
              '<div class="news-card-body">' +
                '<div class="news-card-meta">' +
                  (day && mon ? '<span>' + day + ' ' + mon + '</span>' : '') +
                  (day && mon && chipLabel ? '<span class="dot"></span>' : '') +
                  (chipLabel ? '<span>' + escapeHtml(chipLabel) + '</span>' : '') +
                '</div>' +
                '<h3>' + escapeHtml(it.title) + '</h3>' +
                '<p>' + escapeHtml(it.content) + '</p>' +
              '</div>';
            tinNganhGrid.appendChild(a);
          }

          if (cat === 'Hội thảo - Tọa đàm' && hoiThaoGrid) {
            const a = document.createElement('a');
            a.href = '?post=' + encodeURIComponent(postId);
            a.className = 'news-card';
            const thumbStyle = it.image
              ? "background-image:url('" + it.image + "');background-size:cover;background-position:center;"
              : '';
            a.innerHTML =
              '<div class="news-card-thumb" style="' + thumbStyle + '">' +
                (chipLabel ? '<span class="badge">' + escapeHtml(chipLabel) + '</span>' : '') +
              '</div>' +
              '<div class="news-card-body">' +
                '<div class="news-card-meta">' +
                  (day && mon ? '<span>' + day + ' ' + mon + '</span>' : '') +
                  (day && mon && chipLabel ? '<span class="dot"></span>' : '') +
                  (chipLabel ? '<span>' + escapeHtml(chipLabel) + '</span>' : '') +
                '</div>' +
                '<h3>' + escapeHtml(it.title) + '</h3>' +
                '<p>' + escapeHtml(it.content) + '</p>' +
              '</div>';
            hoiThaoGrid.appendChild(a);
          }
        });

        // ===== Phân trang: tối đa 9 bài / trang, đánh số bên dưới =====
        const PER_PAGE = 9;
        function paginate(container){
          if (!container) return;
          const cards = Array.from(container.children).filter(c => !c.classList.contains('pg-bar'));
          const host = container.parentNode;
          let bar = host.querySelector(':scope > .pg-bar');
          if (bar) bar.remove();
          const pages = Math.ceil(cards.length / PER_PAGE);
          if (pages <= 1) { cards.forEach(c => c.style.display = ''); return; }
          bar = document.createElement('nav');
          bar.className = 'pg-bar'; bar.setAttribute('aria-label', 'Phân trang');
          container.after(bar);
          let cur = 1;
          function show(n, scroll){
            cur = Math.min(Math.max(n, 1), pages);
            cards.forEach((c, i) => { c.style.display = (i >= (cur-1)*PER_PAGE && i < cur*PER_PAGE) ? '' : 'none'; });
            let h = '<button type="button" class="pg-btn pg-prev" data-p="' + (cur-1) + '"' + (cur===1?' disabled':'') + ' aria-label="Trang trước">‹</button>';
            for (let i = 1; i <= pages; i++) {
              h += '<button type="button" class="pg-btn' + (i===cur?' active':'') + '" data-p="' + i + '"' + (i===cur?' aria-current="page"':'') + '>' + i + '</button>';
            }
            h += '<button type="button" class="pg-btn pg-next" data-p="' + (cur+1) + '"' + (cur===pages?' disabled':'') + ' aria-label="Trang sau">›</button>';
            bar.innerHTML = h;
            if (scroll) { try { host.scrollIntoView({ behavior:'smooth', block:'start' }); } catch(e){} }
          }
          bar.addEventListener('click', function(e){
            const b = e.target.closest('.pg-btn');
            if (!b || b.disabled) return;
            show(parseInt(b.getAttribute('data-p'), 10), true);
          });
          show(1, false);
        }
        // ===== Trang "Tất cả tin": mọi tin mới nhất trừ tài liệu Thư viện =====
        const allGrid = document.getElementById('allNewsGrid');
        if (allGrid) {
          const all = items.filter(it => String(it.category || '').trim() !== 'Thư viện');
          allGrid.innerHTML = '';
          if (!all.length) allGrid.innerHTML = '<div class="lib-empty">Chưa có tin nào.</div>';
          all.forEach(it => {
            const { day, mon } = fmtDate(it.time);
            const postId = String(it.id || it.time || '');
            const catLabel = String(it.category || '').trim();
            const chipLabel = ((it.badge || '').trim() || catLabel);
            const a = document.createElement('a');
            a.href = '?post=' + encodeURIComponent(postId);
            a.className = 'news-card';
            const thumbStyle = it.image
              ? "background-image:url('" + it.image + "');background-size:cover;background-position:center;" : '';
            a.innerHTML =
              '<div class="news-card-thumb" style="' + thumbStyle + '">' +
                (chipLabel ? '<span class="badge">' + escapeHtml(chipLabel) + '</span>' : '') +
              '</div>' +
              '<div class="news-card-body">' +
                '<div class="news-card-meta">' +
                  (day && mon ? '<span>' + day + ' ' + mon + '</span>' : '') +
                  (day && mon && chipLabel ? '<span class="dot"></span>' : '') +
                  (chipLabel ? '<span>' + escapeHtml(chipLabel) + '</span>' : '') +
                '</div>' +
                '<h3>' + escapeHtml(it.title) + '</h3>' +
                '<p>' + escapeHtml(it.content) + '</p>' +
              '</div>';
            allGrid.appendChild(a);
          });
          paginate(allGrid);
        }
        paginate(thongBaoList);
        paginate(tinNganhGrid);
        paginate(hoiThaoGrid);

        setTimeout(applyNewsImages, 0);
        // ===== Thư viện: tài liệu PDF =====
        (function fillLibrary(){
          const grid = document.getElementById('libGrid');
          if (!grid) return;
          const libs = items.filter(function(it){
            return String(it.category || '').trim() === 'Thư viện';
          });
          if (!libs.length) {
            grid.innerHTML = '<div class="lib-empty">Chưa có tài liệu.</div>';
            return;
          }
          grid.innerHTML = '';
          libs.forEach(function(it){
            const postId = String(it.id || it.time || '');
            const { day, mon } = fmtDate(it.time);
            const a = document.createElement('a');
            a.className = 'lib-card';
            a.href = '?post=' + encodeURIComponent(postId);
            const dateLabel = (day && mon) ? (day + ' ' + mon) : '';
            a.innerHTML =
              '<div class="lib-card-top">' +
                '<div class="lib-card-icon">' + ((it.word || it.wordName) && !(it.pdfs && it.pdfs.length) ? 'DOC' : 'PDF') + '</div>' +
                (it.badge ? '<span class="lib-badge">' + escapeHtml(it.badge) + '</span>' : '') +
              '</div>' +
              '<h3>' + escapeHtml(it.title || 'Tài liệu') + '</h3>' +
              '<p>' + escapeHtml(it.content || '') + '</p>' +
              '<div class="lib-card-meta">' +
                (dateLabel ? '<span>' + dateLabel + '</span>' : '') +
                (dateLabel ? '<span class="dot"></span>' : '') +
                '<span>' + ((it.word || it.wordName) && !(it.pdfs && it.pdfs.length) ? 'Xem / tải file Word' : 'Xem / tải PDF') + '</span>' +
              '</div>';
            grid.appendChild(a);
          });
        })();



        // ===== Tin mới nhất (trang chủ): TẤT CẢ tin — băng chuyền lướt ngang =====
        (function fillLatestMarquee(){
          const track = document.getElementById('hnLatestTrack');
          if (!track || !items.length) return;
          // Không đưa tài liệu Thư viện vào băng tin trang chủ
          items = items.filter(function(it){ return String(it.category||'').trim() !== 'Thư viện'; });
          if (!items.length) { track.innerHTML = ''; return; }

          const cardHtml = (it) => {
            const postId = String(it.id || it.time || '');
            const { day, mon } = fmtDate(it.time);
            const thumbStyle = it.image
              ? "background-image:url('" + String(it.image).replace(/'/g, "\\'") + "');"
              : '';
            const cat = escapeHtml(it.category || it.badge || '');
            const dateLabel = (day && mon) ? (day + ' ' + mon) : '';
            return (
              '<a class="hn-marquee-card" href="?post=' + encodeURIComponent(postId) + '">' +
                '<div class="hn-marquee-thumb" style="' + thumbStyle + '">' +
                  (it.badge ? '<span class="badge">' + escapeHtml(it.badge) + '</span>' : '') +
                '</div>' +
                '<div class="hn-marquee-body">' +
                  '<div class="hn-marquee-meta">' +
                    (dateLabel ? '<span>' + dateLabel + '</span>' : '') +
                    (dateLabel && cat ? '<span class="dot"></span>' : '') +
                    (cat ? '<span>' + cat + '</span>' : '') +
                  '</div>' +
                  '<h4>' + escapeHtml(it.title || '') + '</h4>' +
                  '<p>' + escapeHtml(it.content || '') + '</p>' +
                '</div>' +
              '</a>'
            );
          };

          // Nhân đôi danh sách để animation translateX(-50%) lặp liền mạch
          const once = items.map(cardHtml).join('');
          track.innerHTML = once + once;

          // Điều chỉnh tốc độ theo số lượng thẻ (ít tin → chậm hơn một chút)
          const n = Math.max(items.length, 1);
          const sec = Math.min(90, Math.max(28, n * 6));
          track.style.animationDuration = sec + 's';
        })();

        // Bỏ Thư viện khỏi tin nổi bật / tin mới nhất (chỉ hiện ở mục Thư viện)
        items = items.filter(function(it){ return String(it.category||'').trim() !== 'Thư viện'; });

        // ===== Tin nổi bật: luôn đẩy bài mới nhất lên đầu =====
        // items đã được Apps Script trả về theo thứ tự mới nhất trước (newest-first).
        if (items.length) {
          const featuredMain = document.querySelector('.hn-featured-main');
          const featuredItems = document.querySelectorAll('.hn-featured-item');

          const top = items[0];
          if (featuredMain && top) {
            const postId = String(top.id || top.time || '');
            const { day, mon } = fmtDate(top.time);
            featuredMain.href = '?post=' + encodeURIComponent(postId);
            featuredMain.removeAttribute('data-tab');
            featuredMain.removeAttribute('data-scroll');

            const thumb = featuredMain.querySelector('.hn-featured-thumb');
            if (thumb) {
              thumb.style.backgroundImage = top.image ? "url('" + top.image + "')" : '';
              thumb.style.backgroundSize = 'cover';
              thumb.style.backgroundPosition = 'center';
              const b = thumb.querySelector('.badge');
              if (b) b.textContent = top.badge || 'Nổi bật';
            }
            const meta = featuredMain.querySelector('.news-card-meta');
            if (meta) {
              let m = '';
              if (day && mon) m += '<span>' + day + ' ' + mon + '</span>';
              if (day && mon && top.category) m += '<span class="dot"></span>';
              if (top.category) m += '<span>' + escapeHtml(top.category) + '</span>';
              meta.innerHTML = m;
            }
            const h3 = featuredMain.querySelector('.hn-featured-body h3');
            if (h3) h3.textContent = top.title || '';
            const p = featuredMain.querySelector('.hn-featured-body p');
            if (p) p.textContent = top.content || '';
          }

          const rest = items.slice(1, 1 + featuredItems.length);
          featuredItems.forEach((el, i) => {
            const it = rest[i];
            if (!it) { el.style.display = 'none'; return; }
            el.style.display = '';
            const postId = String(it.id || it.time || '');
            const { day, mon } = fmtDate(it.time);
            el.href = '?post=' + encodeURIComponent(postId);
            el.removeAttribute('data-tab');
            el.removeAttribute('data-scroll');

            const thumb = el.querySelector('.hn-featured-item-thumb');
            if (thumb) {
              thumb.style.backgroundImage = it.image ? "url('" + it.image + "')" : '';
              thumb.style.backgroundSize = 'cover';
              thumb.style.backgroundPosition = 'center';
            }
            const meta = el.querySelector('.news-card-meta');
            if (meta) {
              let m = '';
              if (day && mon) m += '<span>' + day + ' ' + mon + '</span>';
              if (day && mon && it.category) m += '<span class="dot"></span>';
              if (it.category) m += '<span>' + escapeHtml(it.category) + '</span>';
              meta.innerHTML = m;
            }
            const h4 = el.querySelector('.hn-featured-item-body h4');
            if (h4) h4.textContent = it.title || '';
          });
        }
      })
      .catch(err => {
        console.error('[Supabase] Không tải được bài viết:', err);
        const msg = '<div class="load-error" role="alert">'+
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.4 20.6 19H3.4z"/><path d="M12 9.4v4.2"/><path d="M12 16.5h.01"/></svg>'+
          '<strong>'+(navigator.onLine === false ? 'Bạn đang không có kết nối mạng' : 'Không tải được dữ liệu tin tức')+'</strong>'+
          '<span>'+(navigator.onLine === false ? 'Kiểm tra Wi‑Fi/4G rồi thử lại để xem tin mới nhất.' : 'Máy chủ chưa phản hồi. Vui lòng thử lại sau ít phút.')+'</span>'+
          '<button type="button" class="retry-news">Thử lại</button></div>';
              ['hnLatestTrack','libGrid'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        let host = el;
        // "Tin mới nhất" là băng chuyền: thay cả khung cuộn để thẻ lỗi không bị cắt
        if (id === 'hnLatestTrack') {
          host = document.getElementById('hnLatestMarquee') || el.parentElement;
          host.style.maskImage = 'none';
          host.style.webkitMaskImage = 'none';
        }
        host.innerHTML = msg;
        const b = host.querySelector('.retry-news'); if (b) b.addEventListener('click', () => location.reload());
        });
      });
  })();

