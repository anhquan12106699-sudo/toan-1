  // ===== Trang bài viết (khi mở ở tab mới dạng ?post=..., vẫn cùng 1 file html) =====
  (function initArticlePage(){
    const params = new URLSearchParams(location.search);
    const postId = params.get('post');
    if (!postId) return; // không có ?post= thì hiển thị trang chủ như bình thường

    document.body.classList.add('article-mode');
    const homeHref = location.pathname.split('?')[0] || './';
    document.getElementById('apBack').href = homeHref;
    document.getElementById('apSectionBack').href = homeHref + '#tin-tuc';
    // Xóa sạch active trên thanh menu ngay (tránh Trang chủ + Giới thiệu + Tin tức cùng sáng)
    document.querySelectorAll('.navlinks a, .navlinks .nav-parent').forEach(el => el.classList.remove('active'));
    document.getElementById('apState').style.display = 'block';
    document.getElementById('apState').innerHTML = window.__apSkeletonHtml();
    // Hiện khung nội dung sớm (tránh trắng trang)
    document.getElementById('apContent').style.display = 'block';

    const escapeHtml = (str) => String(str || '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

    const feedLoader = (typeof window.__loadNewsFeed === 'function')
      ? window.__loadArticleFull(postId)
      : fetch(NEWS_FEED_URL).then(r => r.json());

    feedLoader
      .then(items => (window.__purifyP || Promise.resolve()).then(() => items))
      .then(items => {
        if (!Array.isArray(items)) throw new Error('bad data');
        const it = items.find(x => String(x.id || x.time || '') === postId);
        if (!it) throw new Error('not found');

        if (typeof window.__seoPost === 'function') window.__seoPost(it, postId); else document.title = (it.title || 'Bài viết') + ' — Ngành Toán Kinh Tế';
        document.getElementById('apCategory').textContent = it.category || '';
        document.getElementById('apSectionBack').textContent = it.category || 'Quay lại';
        if (typeof window.__renderRelated === 'function') window.__renderRelated(items, it, postId);

        const postCat = (it.category || '').trim();
        let backHash = 'thong-bao', tabGroup = 'tin-tuc', subId = 'thong-bao';
        if (postCat === 'Tin ngành Toán kinh tế') {
          backHash = 'tin-nganh'; tabGroup = 'tin-tuc'; subId = 'tin-nganh';
        } else if (postCat === 'Tuyển sinh') {
          backHash = 'tuyen-sinh'; tabGroup = 'tuyen-sinh'; subId = undefined;
        } else if (postCat === 'Hội thảo - Tọa đàm') {
          backHash = 'hoi-thao'; tabGroup = 'hoi-thao'; subId = undefined;
        } else if (postCat === 'Thư viện') {
          backHash = 'thu-vien'; tabGroup = 'thu-vien'; subId = undefined;
        }
        const homePath = location.pathname.split('?')[0] || './';
        document.getElementById('apBack').href = homePath; // Trang chủ
        document.getElementById('apSectionBack').href = homePath + '#' + backHash; // Quay lại mục
        if (typeof window.__switchTab === 'function') window.__switchTab(tabGroup, subId, { keepArticle: true });
        // Khóa nav đúng 1 lần nữa sau khi DOM ổn định (chống scroll-spy / race)
        requestAnimationFrame(() => {
          if (typeof window.__switchTab === 'function') {
            window.__switchTab(tabGroup, subId, { keepArticle: true });
          }
        });

        let d = null;
        const val = it.time;
        if (val instanceof Date) d = val;
        else if (typeof val === 'number') d = new Date(val);
        else if (typeof val === 'string' && val.trim()){
          d = new Date(val);
          if (isNaN(d.getTime())){
            const m = val.trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
            if (m) d = new Date(+m[3], +m[2]-1, +m[1]);
          }
        }
        const dateStr = (d && !isNaN(d.getTime()))
          ? String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0') + '/' + d.getFullYear()
          : '';

        let metaHtml = '';
        if (dateStr) metaHtml += '<span class="ap-date">Ngày phát hành: ' + dateStr + '</span>';
        if (it.badge){
          if (dateStr) metaHtml += '<span class="dot"></span>';
          metaHtml += '<span class="badge">' + escapeHtml(it.badge) + '</span>';
        }
        document.getElementById('apMeta').innerHTML = metaHtml;

        document.getElementById('apTitle').textContent = it.title || '';
        (function(){
          const sm = document.getElementById('apSummary'); if (!sm) return;
          const clean = (h) => String(h || '').replace(/<div class="tkt-(?:pdf|word)-embed"[^>]*>[\s\S]*?<\/div>/gi,'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
          const sum = String(it.content || '').trim();
          const hasBody = !!clean(it.detail) || !!(it.word || it.wordName || it.gdoc || it.gdocId || it.pdf);
          // Chỉ hiện tóm tắt khi bài còn nội dung khác bên dưới (tránh lặp lại)
          if (sum && hasBody && clean(sum) !== clean(it.detail)) { sm.textContent = sum; sm.style.display = 'block'; }
          else { sm.textContent = ''; sm.style.display = 'none'; }
        })();

        // Ảnh chỉ dùng thẻ tin ngoài — không gắn vào trang bài
        const img = document.getElementById('apImg');
        if (img) { img.removeAttribute('src'); img.style.display = 'none'; }
        // Word + nội dung gõ tay chạy song song
        var hasWord = !!(it.word || it.wordName || it.gdoc || it.gdocId ||
          (it.detail && /data-word-url=/i.test(String(it.detail))));
        // Chữ hiện trước; Word/PDF tải nền rồi mới hiển thị
        (function(){ var __pid = postId;
          window.__loadArticleFiles(it, __pid).then(function(){
            if (new URLSearchParams(location.search).get('post') !== String(__pid)) return; // đã chuyển sang bài khác
            if (typeof window.__renderArticleWord === 'function') window.__renderArticleWord(it);
            if (typeof window.__renderArticlePdf === 'function') window.__renderArticlePdf(it);
          });
        })();

        // Nội dung chữ: lấy detail (gỡ marker PDF/Word), không dùng bản convert Word
        let fullText = (it.detail && String(it.detail).trim()) ? String(it.detail) : '';
        fullText = fullText.replace(/<div class="tkt-pdf-embed"[^>]*>[\s\S]*?<\/div>/gi, '');
        fullText = fullText.replace(/<div class="tkt-word-embed"[^>]*>[\s\S]*?<\/div>/gi, '');
        fullText = fullText.replace(/<p[^>]*>\s*<em>Đã đính kèm file Word[\s\S]*?<\/em>\s*<\/p>/gi, '');
        fullText = fullText.replace(/<p[^>]*>\s*<em>Nội dung Word đã được đính kèm[\s\S]*?<\/em>\s*<\/p>/gi, '');
        fullText = fullText.trim();
        // Chỉ fallback tóm tắt khi không có Word và không có detail
        if (!fullText && !hasWord) {
          fullText = it.content || '';
        }
        // Nếu nội dung là HTML (từ Google Doc, có chứa thẻ <p>, <span>...) thì hiển thị bằng innerHTML
        // để giữ định dạng (in đậm, xuống dòng...). Nếu là text thường (gõ tay) thì vẫn giữ textContent
        // để an toàn (tránh lỗi nếu người dùng gõ ký tự < > trong bài).
        const looksLikeHtml = /<\/?(p|span|div|br|b|strong|i|em|ul|ol|li|a|img|h[1-6]|table|tr|td|th)[\s>]/i.test(fullText);
        const apBodyEl = document.getElementById('apBody');
        if (looksLikeHtml) {
          apBodyEl.classList.remove('ap-plain');
          apBodyEl.classList.add('ap-html');
          apBodyEl.innerHTML = sanitizeHtml(fullText);
          // Chuẩn hoá ảnh Docs: bỏ width/height cố định để CSS max-width:100% hoạt động
          apBodyEl.querySelectorAll('img').forEach(im => {
            im.removeAttribute('width');
            im.removeAttribute('height');
            if (im.style) {
              im.style.width = '';
              im.style.height = '';
              im.style.maxWidth = '100%';
            }
          });
        } else {
          apBodyEl.classList.remove('ap-html');
          apBodyEl.classList.add('ap-plain');
          apBodyEl.textContent = fullText;
        }

        document.getElementById('apState').style.display = 'none';
        document.getElementById('apContent').style.display = 'block';
      })
      .catch((err) => { uxShowArticleError(err); });

    // Nút Trang chủ / Quay lại: thoát article-mode ngay, không kẹt lại bài viết
    function exitArticleTo(href){
      document.body.classList.remove('article-mode');
      const apState = document.getElementById('apState');
      const apContent = document.getElementById('apContent');
      if (apState) apState.style.display = 'none';
      if (apContent) apContent.style.display = 'none';
      // Điều hướng sạch (bỏ ?post=) — ưu tiên không reload full file
      if (href) {
        try {
          const u = new URL(href, location.href);
          if (u.origin === location.origin) {
            if (history.pushState) {
              history.pushState({}, '', u.pathname + u.search + u.hash);
              // Chuyển tab theo hash nếu có
              const hash = (u.hash || '').replace(/^#/, '');
              if (hash && typeof window.__switchTab === 'function') {
                const map = {
                  'gioi-thieu':'gioi-thieu','lich-su':'gioi-thieu','nhan-dien':'gioi-thieu','chung':'gioi-thieu',
                  'tuyen-sinh':'tuyen-sinh','tin-tuc':'tin-tuc','hoi-thao':'hoi-thao','thu-vien':'thu-vien',
                  'ctdt-toan-tc':'ctdt-toan-tc','ctdt-thong-ke':'ctdt-thong-ke','ctdt':'ctdt-toan-tc',
                  'thong-bao':'tin-tuc','tin-nganh':'tin-tuc','tat-ca-tin':'tat-ca-tin','hero':'trang-chu','trang-chu':'trang-chu'
                };
                const tab = map[hash] || (['trang-chu','gioi-thieu','tin-tuc','tat-ca-tin','tuyen-sinh','hoi-thao','thu-vien','ctdt-toan-tc','ctdt-thong-ke'].includes(hash) ? hash : 'trang-chu');
                window.__switchTab(tab, map[hash] ? hash : null);
              } else if (typeof window.__switchTab === 'function') {
                window.__switchTab('trang-chu', null);
              }
              window.scrollTo({ top: 0, behavior: 'auto' });
              return;
            }
          }
        } catch (e) {}
        location.href = href;
      }
    }
    const btnHome = document.getElementById('apBack');
    const btnSec = document.getElementById('apSectionBack');
    if (btnHome) {
      btnHome.addEventListener('click', (e) => {
        e.preventDefault();
        const href = btnHome.getAttribute('href') || (location.pathname.split('?')[0] || './');
        exitArticleTo(href);
      });
    }
    if (btnSec) {
      btnSec.addEventListener('click', (e) => {
        e.preventDefault();
        if (history.state && history.state.fromApp) { history.back(); return; }
        const href = btnSec.getAttribute('href') || (location.pathname.split('?')[0] || './');
        exitArticleTo(href);
      });
    }
  })();

  // ===== Mở bài không reload trang (tránh load lại file HTML ~4MB) =====
  (function spaArticleOpen(){
    function openPost(postId){
      if (!postId) return;
      const url = (location.pathname.split('?')[0] || './') + '?post=' + encodeURIComponent(postId);
      // Lưu lại trang đang xem (tab + vị trí cuộn) để nút Quay lại trả về đúng chỗ cũ
      try {
        if (!document.body.classList.contains('article-mode')) {
          const prev = window.__captureView();
          if (history.replaceState) history.replaceState(prev, '', location.href);
        }
      } catch (e) {}
      // Đổi URL không reload
      if (history.pushState) history.pushState({ post: postId, fromApp: true }, '', url);
      // Kích hoạt lại logic trang bài bằng cách reload nhẹ chỉ phần article
      // (tái sử dụng cache — gần như tức thì)
      document.body.classList.add('article-mode');
      document.querySelectorAll('#navLinks a').forEach(el => el.classList.remove('active'));
      const apState = document.getElementById('apState');
      const apContent = document.getElementById('apContent');
      if (apState) { apState.style.display = 'block'; apState.innerHTML = window.__apSkeletonHtml(); }
      if (apContent) apContent.style.display = 'block';

      const escapeHtml = (str) => String(str || '')
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

      const loader = (typeof window.__loadArticleFull === 'function')
        ? window.__loadArticleFull(postId)
        : fetch(NEWS_FEED_URL).then(r => r.json());

      loader.then(items => (window.__purifyP || Promise.resolve()).then(() => items)).then(items => {
        if (!Array.isArray(items)) throw new Error('bad data');
        const it = items.find(x => String(x.id || x.time || '') === String(postId));
        if (!it) throw new Error('not found');

        if (typeof window.__seoPost === 'function') window.__seoPost(it, postId); else document.title = (it.title || 'Bài viết') + ' — Ngành Toán Kinh Tế';
        document.getElementById('apCategory').textContent = it.category || '';
        document.getElementById('apSectionBack').textContent = it.category || 'Quay lại';
        if (typeof window.__renderRelated === 'function') window.__renderRelated(items, it, postId);

        const postCat = (it.category || '').trim();
        let backHash = 'thong-bao', tabGroup = 'tin-tuc', subId = 'thong-bao';
        if (postCat === 'Tin ngành Toán kinh tế') {
          backHash = 'tin-nganh'; tabGroup = 'tin-tuc'; subId = 'tin-nganh';
        } else if (postCat === 'Tuyển sinh') {
          backHash = 'tuyen-sinh'; tabGroup = 'tuyen-sinh'; subId = undefined;
        } else if (postCat === 'Hội thảo - Tọa đàm') {
          backHash = 'hoi-thao'; tabGroup = 'hoi-thao'; subId = undefined;
        } else if (postCat === 'Thư viện') {
          backHash = 'thu-vien'; tabGroup = 'thu-vien'; subId = undefined;
        }
        const homePath = location.pathname.split('?')[0] || './';
        document.getElementById('apBack').href = homePath;
        document.getElementById('apSectionBack').href = homePath + '#' + backHash;
        if (typeof window.__switchTab === 'function') {
          window.__switchTab(tabGroup, subId, { keepArticle: true });
        }

        let d = null;
        const val = it.time;
        if (val instanceof Date) d = val;
        else if (typeof val === 'number') d = new Date(val);
        else if (typeof val === 'string' && val.trim()){
          d = new Date(val);
          if (isNaN(d.getTime())){
            const m = val.trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
            if (m) d = new Date(+m[3], +m[2]-1, +m[1]);
          }
        }
        const dateStr = (d && !isNaN(d.getTime()))
          ? String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0') + '/' + d.getFullYear()
          : '';

        let metaHtml = '';
        if (dateStr) metaHtml += '<span class="ap-date">Ngày phát hành: ' + dateStr + '</span>';
        if (it.badge){
          if (dateStr) metaHtml += '<span class="dot"></span>';
          metaHtml += '<span class="badge">' + escapeHtml(it.badge) + '</span>';
        }
        document.getElementById('apMeta').innerHTML = metaHtml;
        document.getElementById('apTitle').textContent = it.title || '';
        (function(){
          const sm = document.getElementById('apSummary'); if (!sm) return;
          const clean = (h) => String(h || '').replace(/<div class="tkt-(?:pdf|word)-embed"[^>]*>[\s\S]*?<\/div>/gi,'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
          const sum = String(it.content || '').trim();
          const hasBody = !!clean(it.detail) || !!(it.word || it.wordName || it.gdoc || it.gdocId || it.pdf);
          // Chỉ hiện tóm tắt khi bài còn nội dung khác bên dưới (tránh lặp lại)
          if (sum && hasBody && clean(sum) !== clean(it.detail)) { sm.textContent = sum; sm.style.display = 'block'; }
          else { sm.textContent = ''; sm.style.display = 'none'; }
        })();

        // Ảnh chỉ dùng thẻ tin ngoài — không gắn vào trang bài
        const img = document.getElementById('apImg');
        if (img) { img.removeAttribute('src'); img.style.display = 'none'; }
        // Word + nội dung gõ tay chạy song song
        var hasWord = !!(it.word || it.wordName || it.gdoc || it.gdocId ||
          (it.detail && /data-word-url=/i.test(String(it.detail))));
        // Chữ hiện trước; Word/PDF tải nền rồi mới hiển thị
        (function(){ var __pid = postId;
          window.__loadArticleFiles(it, __pid).then(function(){
            if (new URLSearchParams(location.search).get('post') !== String(__pid)) return; // đã chuyển sang bài khác
            if (typeof window.__renderArticleWord === 'function') window.__renderArticleWord(it);
            if (typeof window.__renderArticlePdf === 'function') window.__renderArticlePdf(it);
          });
        })();

        // Nội dung chữ: lấy detail (gỡ marker PDF/Word), không dùng bản convert Word
        let fullText = (it.detail && String(it.detail).trim()) ? String(it.detail) : '';
        fullText = fullText.replace(/<div class="tkt-pdf-embed"[^>]*>[\s\S]*?<\/div>/gi, '');
        fullText = fullText.replace(/<div class="tkt-word-embed"[^>]*>[\s\S]*?<\/div>/gi, '');
        fullText = fullText.replace(/<p[^>]*>\s*<em>Đã đính kèm file Word[\s\S]*?<\/em>\s*<\/p>/gi, '');
        fullText = fullText.replace(/<p[^>]*>\s*<em>Nội dung Word đã được đính kèm[\s\S]*?<\/em>\s*<\/p>/gi, '');
        fullText = fullText.trim();
        // Chỉ fallback tóm tắt khi không có Word và không có detail
        if (!fullText && !hasWord) {
          fullText = it.content || '';
        }
        const looksLikeHtml = /<\/?(p|span|div|br|b|strong|i|em|ul|ol|li|a|img|h[1-6]|table|tr|td|th)[\s>]/i.test(fullText);
        const apBodyEl = document.getElementById('apBody');
        if (looksLikeHtml) {
          apBodyEl.classList.remove('ap-plain');
          apBodyEl.classList.add('ap-html');
          apBodyEl.innerHTML = sanitizeHtml(fullText);
          apBodyEl.querySelectorAll('img').forEach(im => {
            im.removeAttribute('width');
            im.removeAttribute('height');
            if (im.style) { im.style.width = ''; im.style.height = ''; im.style.maxWidth = '100%'; }
          });
        } else {
          apBodyEl.classList.remove('ap-html');
          apBodyEl.classList.add('ap-plain');
          apBodyEl.textContent = fullText;
        }

        if (apState) apState.style.display = 'none';
        if (apContent) apContent.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
      }).catch((err) => { uxShowArticleError(err); });
    }

    // Tải trước bài khi rê chuột (sau 120ms) hoặc chạm vào thẻ tin
    (function prefetchOnIntent(){
      var timer = null, lastId = '';
      function idOf(target){
        var a = target && target.closest && target.closest('a[href*="?post="]');
        if (!a) return '';
        try { var u = new URL(a.href, location.href); return u.origin === location.origin ? (u.searchParams.get('post') || '') : ''; } catch (e) { return ''; }
      }
      function fire(id){ if (id && id !== lastId && typeof window.__prefetchArticle === 'function') { lastId = id; window.__prefetchArticle(id); } }
      document.addEventListener('mouseover', function(e){
        var id = idOf(e.target); if (!id) return;
        clearTimeout(timer); timer = setTimeout(function(){ fire(id); }, 120);
      }, { passive: true });
      document.addEventListener('mouseout', function(){ clearTimeout(timer); }, { passive: true });
      document.addEventListener('touchstart', function(e){ fire(idOf(e.target)); }, { passive: true });
    })();

    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href*="?post="]');
      if (!a) return;
      // Chỉ bắt link nội bộ
      try {
        const u = new URL(a.href, location.href);
        if (u.origin !== location.origin) return;
        const pid = u.searchParams.get('post');
        if (!pid) return;
        e.preventDefault();
        e.stopPropagation();
        openPost(pid);
      } catch (err) {}
    }, true);

    window.addEventListener('popstate', (ev) => {
      const pid = new URLSearchParams(location.search).get('post');
      if (pid) { openPost(pid); return; }
      // Chặn hashchange (bắn ngay sau popstate) làm nhảy sang mục lưu trữ
      window.__restoringView = true;
      setTimeout(() => { window.__restoringView = false; }, 400);
      document.body.classList.remove('article-mode');
      const apState = document.getElementById('apState');
      const apContent = document.getElementById('apContent');
      if (apState) apState.style.display = 'none';
      if (apContent) apContent.style.display = 'none';
      const st = ev.state;
      if (st && st.view && typeof window.__switchTab === 'function') {
        window.__switchTab(st.tab, st.hash || null, { noScroll: true });
        requestAnimationFrame(() => window.scrollTo({ top: st.scrollY || 0, behavior: 'auto' }));
      } else if (typeof window.__switchTab === 'function') {
        // Không có trạng thái lưu (vd. mở thẳng link bài): về mục theo hash
        window.__restoringView = false;
        if (typeof window.__initFromHash === 'function') window.__initFromHash();
        window.scrollTo({ top: 0, behavior: 'auto' });
      }
    });

    window.__openPost = openPost;
  })();


