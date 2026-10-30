  // ---- Tab navigation: chuyển tab khi click menu ----
  (function(){
    const VALID = ['trang-chu','gioi-thieu','tin-tuc','tuyen-sinh','hoi-thao','thu-vien','ctdt-toan-tc','ctdt-thong-ke','tat-ca-tin'];

    function setActiveNav(tab){
      // Gỡ hết active trên toàn bộ link trong nav
      document.querySelectorAll('#navLinks a').forEach(el => el.classList.remove('active'));
      // Chỉ gắn active cho đúng 1 mục cấp 1 trên thanh
      document.querySelectorAll('#navLinks > a.nav-item[data-tab]').forEach(a => {
        if (a.getAttribute('data-tab') === tab) a.classList.add('active');
      });
      document.querySelectorAll('#navLinks > .has-dropdown > .nav-parent[data-tab]').forEach(parent => {
        const pTab = parent.getAttribute('data-tab');
        if (pTab === tab) parent.classList.add('active');
        else if ((tab === 'ctdt-toan-tc' || tab === 'ctdt-thong-ke') && (pTab === 'ctdt-toan-tc' || pTab === 'ctdt-thong-ke')) {
          parent.classList.add('active');
        }
      });
      document.querySelectorAll('#navLinks .dropdown a[data-tab]').forEach(a => {
        if (a.getAttribute('data-tab') === tab) a.classList.add('active');
      });
    }

    // ===== SEO động: tiêu đề / mô tả / og / canonical theo trang & bài =====
    const SITE = 'Ngành Toán Kinh Tế - Học viện Tài chính';
    const SEO0 = {
      desc: (document.querySelector('meta[name="description"]') || {}).content || '',
      ogDesc: (document.querySelector('meta[property="og:description"]') || {}).content || '',
      img: (document.getElementById('seoOgImage') || {}).content || ''
    };
    const TAB_TITLE = {
      'gioi-thieu':'Giới thiệu','tin-tuc':'Tin tức','tuyen-sinh':'Tuyển sinh','hoi-thao':'Hội thảo - Tọa đàm',
      'thu-vien':'Thư viện','tat-ca-tin':'Tất cả tin',
      'ctdt-toan-tc':'CTĐT Toán tài chính','ctdt-thong-ke':'CTĐT Thống kê ứng dụng trong tài chính'
    };
    function setMeta(sel, attr, val){ const e = document.querySelector(sel); if (e) e.setAttribute(attr, val); }
    function setSeo(o){
      const url = o.url || (location.origin + location.pathname);
      document.title = o.title;
      setMeta('meta[name="description"]','content',o.desc);
      setMeta('meta[property="og:title"]','content',o.title);
      setMeta('meta[property="og:description"]','content',o.desc);
      setMeta('meta[property="og:type"]','content',o.type || 'website');
      setMeta('meta[name="twitter:title"]','content',o.title);
      setMeta('meta[name="twitter:description"]','content',o.desc);
      setMeta('#seoOgUrl','content',url);
      setMeta('#seoCanonical','href',url);
      setMeta('#seoOgImage','content',o.img || SEO0.img);
      setMeta('#seoTwImage','content',o.img || SEO0.img);
      let ld = document.getElementById('seoArticleLd');
      if (o.ld) {
        if (!ld) { ld = document.createElement('script'); ld.type = 'application/ld+json'; ld.id = 'seoArticleLd'; document.head.appendChild(ld); }
        ld.textContent = JSON.stringify(o.ld);
      } else if (ld) ld.remove();
    }
    window.__seoPage = function(tab){
      const t = TAB_TITLE[tab];
      setSeo({ title: t ? t + ' — ' + SITE : SITE, desc: SEO0.desc });
    };
    window.__seoPost = function(it, postId){
      const plain = (h) => String(h || '').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();
      let desc = plain(it.content) || plain(it.detail);
      if (desc.length > 160) desc = desc.slice(0,157).replace(/\s+\S*$/,'') + '…';
      desc = desc || SEO0.desc;
      const title = (it.title || 'Bài viết') + ' — ' + SITE;
      const url = location.origin + location.pathname + '?post=' + encodeURIComponent(postId);
      const img = (typeof it.image === 'string' && /^https?:\/\//i.test(it.image)) ? it.image : '';
      const d = new Date(it.time);
      const ld = { '@context':'https://schema.org','@type':'Article','headline': it.title || '',
        'description': desc, 'inLanguage':'vi', 'mainEntityOfPage': url,
        'author': { '@type':'Organization','name': SITE }, 'publisher': { '@type':'Organization','name': SITE } };
      if (!isNaN(d.getTime())) ld.datePublished = d.toISOString();
      if (img) ld.image = img;
      setSeo({ title, desc, url, img, type:'article', ld });
    };

    // ===== Cột "Tin cùng chuyên mục" + nút chia sẻ =====
    window.__renderRelated = function(items, it, postId){
      const box = document.getElementById('apRelated'), aside = document.getElementById('apAside');
      if (!box || !aside) return;
      // Bài thuộc "Thư viện": không hiện tin cùng chuyên mục, để rộng chỗ cho phần xem tài liệu
      const layout = document.getElementById('apLayout');
      const isLib = String(it.category || '').trim() === 'Thư viện';
      if (layout) layout.classList.toggle('ap-lib', isLib);
      if (isLib) { aside.style.display = 'none'; box.innerHTML = ''; return; }
      const esc = (t) => String(t == null ? '' : t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
      const base = location.pathname.split('?')[0] || './';
      const ts = (x) => { const d = new Date(x.time); return isNaN(d.getTime()) ? 0 : d.getTime(); };
      const cat = String(it.category || '').trim();
      // Trạng thái có thiết kế: icon + câu gợi ý (+ nút thử lại khi lỗi)
      const icoList = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6.5h16"/><path d="M4 12h10.5"/><path d="M4 17.5h7"/></svg>';
      const icoWarn = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.4 20.6 19H3.4z"/><path d="M12 9.4v4.2"/><path d="M12 16.5h.01"/></svg>';
      const relEmpty = function(ico, title, text, isErr){
        return '<div class="ap-rel-empty is-state'+(isErr?' is-error':'')+'"'+(isErr?' role="alert"':'')+'>'+ico+
          '<strong>'+title+'</strong><span class="ap-rel-empty-txt">'+text+'</span>'+
          (isErr?'<button type="button" class="ap-rel-retry">Thử lại</button>':'')+'</div>';
      };
      aside.style.display = 'block';
      box.innerHTML = '<div class="ap-rel-empty">Đang tải tin cùng chuyên mục…</div>';
      // Trang bài chỉ tải 1 bài => phải lấy danh sách đầy đủ để tìm tin cùng chuyên mục
      const src = (typeof window.__loadNewsFeed === 'function') ? window.__loadNewsFeed() : Promise.resolve(items || []);
      src.then(function(all){
        const rel = (all || []).filter(x => String(x.category || '').trim() === cat && String(x.id || x.time || '') !== String(postId))
          .sort((a, b) => ts(b) - ts(a)).slice(0, 5);
        if (!rel.length) {
          box.innerHTML = relEmpty(icoList, 'Chưa có bài khác trong chuyên mục', 'Các bài viết mới cùng chuyên mục sẽ xuất hiện tại đây.', false);
          return;
        }
        box.innerHTML = rel.map(x => {
          const id = String(x.id || x.time || '');
          const d = ts(x) ? new Date(ts(x)) : null;
          const ds = d ? String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0') + '/' + d.getFullYear() : '';
          return '<a class="ap-rel" href="' + esc(base + '?post=' + encodeURIComponent(id)) + '" data-relid="' + esc(id) + '">' +
                 '<div class="ap-rel-img">' + esc(x.category || '') + '</div>' +
                 '<div class="ap-rel-body"><div class="ap-rel-t">' + esc(x.title || '') + '</div>' + (ds ? '<div class="ap-rel-d">' + ds + '</div>' : '') + '</div></a>';
        }).join('');
        // Nạp ảnh bìa sau cho nhẹ
        if (typeof window.__getNewsCovers === 'function') {
          window.__getNewsCovers(rel.map(x => String(x.id || x.time || ''))).then(function(map){
            box.querySelectorAll('a.ap-rel').forEach(function(a){
              const u = map[a.getAttribute('data-relid')];
              const slot = a.querySelector('.ap-rel-img');
              if (u && slot) { const im = document.createElement('img'); im.className = 'ap-rel-img'; im.alt = ''; im.loading = 'lazy'; im.src = u; slot.replaceWith(im); }
            });
          });
        }
      }).catch(function(){
        box.innerHTML = relEmpty(icoWarn, 'Không tải được tin cùng chuyên mục', 'Hãy kiểm tra kết nối mạng rồi thử lại, hoặc xem toàn bộ tin ở mục Tin tức.', true);
        const rb = box.querySelector('.ap-rel-retry');
        if (rb) rb.addEventListener('click', function(){
          rb.disabled = true;
          window.__renderRelated(items, it, postId);
        });
      });
    };

    window.__captureView = function(){
      const m = document.body.className.match(/(?:^|\s)tab-([\w-]+)/);
      return { view: true, tab: m ? m[1] : 'trang-chu',
               hash: (location.hash || '').replace(/^#/, ''), scrollY: window.scrollY || 0 };
    };

    function switchTab(tab, scrollId, opts){
      if(!VALID.includes(tab)) return;
      opts = opts || {};
      // chụp trạng thái TRƯỚC khi đổi tab (để Back quay về đúng trang cũ)
      const prevView = opts.push ? window.__captureView() : null;
      // Thoát chế độ xem bài viết khi user chuyển mục menu
      // (không thoát khi init trang bài gọi switchTab với keepArticle:true)
      const stayArticle = !!opts.keepArticle;
      if (document.body.classList.contains('article-mode') && !stayArticle) {
        document.body.classList.remove('article-mode');
        const apState = document.getElementById('apState');
        const apContent = document.getElementById('apContent');
        if (apState) apState.style.display = 'none';
        if (apContent) apContent.style.display = 'none';
        // Xóa ?post=... khỏi URL, giữ hash mục đích
        try {
          const cleanPath = location.pathname.split('?')[0] || location.pathname;
          const hash = '#' + (scrollId || tab);
          if (history.replaceState) history.replaceState(null, '', cleanPath + hash);
        } catch (e) {}
      }
      const keepArtClass = stayArticle || (document.body.classList.contains('article-mode') && stayArticle);
      // Khi đang xem bài (keepArticle): chỉ gắn active nav, KHÔNG scroll / không đổi hash (tránh nhảy loạn)
      if (stayArticle) {
        document.body.classList.add('article-mode');
        // giữ article-mode + tab class
        document.body.className = document.body.className
          .split(/\s+/)
          .filter(c => c && !c.startsWith('tab-') && c !== 'article-mode')
          .concat(['tab-' + tab, 'article-mode'])
          .join(' ');
        setActiveNav(tab);
        return; // dừng tại đây — không scrollIntoView, không replaceState
      }
      document.body.className = document.body.className
        .split(/\s+/)
        .filter(c => c && !c.startsWith('tab-') && c !== 'article-mode')
        .concat(['tab-' + tab])
        .join(' ');
      setActiveNav(tab);
      // close mobile menu & dropdowns
      if(typeof closeMobileNav === 'function') closeMobileNav();
      else {
        const nav = document.getElementById('navLinks');
        if(nav) nav.classList.remove('open');
        document.querySelectorAll('.navlinks .has-dropdown.open').forEach(i => i.classList.remove('open'));
      }

      // Replay hiệu ứng dải xanh khi vào lại tab
      requestAnimationFrame(() => {
        setTimeout(() => {
          if(typeof window.__replayGreenHeads === 'function') window.__replayGreenHeads();
        }, 30);
      });

      // intro sub-tab
      if(tab === 'gioi-thieu'){
        const introId = (scrollId === 'lich-su' || scrollId === 'nhan-dien') ? scrollId
          : (scrollId === 'gioi-thieu' || scrollId === 'chung' || !scrollId) ? 'chung' : 'chung';
        if(typeof window.__activateIntroTab === 'function'){
          window.__activateIntroTab(introId);
        }
      }
      // news sub-tab
      if(tab === 'tin-tuc'){
        const newsId = (scrollId === 'tin-nganh') ? 'tin-nganh' : 'thong-bao';
        if(typeof window.__activateNewsTab === 'function'){
          window.__activateNewsTab(newsId);
        }
      }

      if (!stayArticle) window.__seoPage(tab);
      // Khôi phục khi bấm Back: không cuộn, không đổi hash
      if (opts.noScroll) return;

      // scroll
      requestAnimationFrame(() => {
        if(tab === 'gioi-thieu'){
          // map scrollId -> section element
          const mapId = {chung:'gioi-thieu', 'gioi-thieu':'gioi-thieu', 'lich-su':'lich-su', 'nhan-dien':'nhan-dien'};
          const sid = mapId[scrollId] || 'gioi-thieu';
          const el = document.getElementById(sid);
          if(el){ el.scrollIntoView({behavior:'smooth', block:'start'}); return; }
          window.scrollTo({top:0, behavior:'smooth'}); return;
        }
        if(tab === 'tin-tuc'){
          const sec = document.getElementById('tin-tuc');
          if(sec){ sec.scrollIntoView({behavior:'smooth', block:'start'}); return; }
        }
        if(tab === 'trang-chu'){
          if(scrollId){
            const el = document.getElementById(scrollId);
            if(el){ el.scrollIntoView({behavior:'smooth', block:'start'}); return; }
          }
          window.scrollTo({top:0, behavior:'smooth'}); return;
        }
        if(scrollId){
          const el = document.getElementById(scrollId);
          if(el){ el.scrollIntoView({behavior:'smooth', block:'start'}); return; }
        }
        window.scrollTo({top:0, behavior:'smooth'});
      });

      // update hash without jump
      const newHash = '#' + (scrollId || tab);
      if (opts.push && history.pushState && location.hash !== newHash) {
        // lưu vị trí hiện tại vào mục lịch sử cũ rồi thêm mục mới -> nút Back dùng được
        try { history.replaceState(prevView, '', location.href); } catch(e){}
        history.pushState(null, '', newHash);
      } else if(history.replaceState){
        history.replaceState(null, '', newHash);
      }
    }

    // ---- Nút "Khám phá ngành học": xổ/ẩn danh sách chuyên ngành ----
    (function(){
      const btn = document.getElementById('heroExploreBtn');
      const panel = document.getElementById('heroSub');
      if(!btn || !panel) return;
      function setOpen(open){
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        panel.hidden = !open;
      }
      btn.addEventListener('click', function(e){
        e.stopPropagation();
        setOpen(btn.getAttribute('aria-expanded') !== 'true');
      });
      document.addEventListener('click', function(e){
        if(panel.hidden) return;
        if(!panel.contains(e.target) && !btn.contains(e.target)) setOpen(false);
      });
      document.addEventListener('keydown', function(e){
        if(e.key === 'Escape' && !panel.hidden){ setOpen(false); btn.focus(); }
      });
      panel.querySelectorAll('a').forEach(function(a){ a.addEventListener('click', function(){ setOpen(false); }); });
    })();

    // Click handlers: chỉ gắn vào thẻ <a data-tab> (tránh bubble từ wrapper div)
    document.querySelectorAll('a[data-tab]').forEach(el => {
      el.addEventListener('click', (e) => {
        if(el.dataset.skipTab === '1'){
          delete el.dataset.skipTab;
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        // Mobile: mục cha có dropdown chỉ xổ, không chuyển tab
        if(el.classList.contains('nav-parent') && window.matchMedia('(max-width:1100px)').matches){
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        const tab = el.getAttribute('data-tab');
        if(!tab || !VALID.includes(tab)) return;
        e.preventDefault();
        e.stopPropagation();
        const scrollId = el.getAttribute('data-scroll') || null;
        switchTab(tab, scrollId, { push: true });
      });
    });

    // Footer links that point to sections
    document.querySelectorAll('footer a[href^="#"]').forEach(a => {
      a.addEventListener('click', (e) => {
        const id = (a.getAttribute('href') || '').slice(1);
        if(!id) return;
        // map section id -> tab
        const map = {
          'gioi-thieu':'gioi-thieu','lich-su':'gioi-thieu','nhan-dien':'gioi-thieu','chung':'gioi-thieu',
          'phat-trien':'trang-chu','dao-tao':'trang-chu','ao-nganh':'trang-chu',
          'tuyen-sinh':'tuyen-sinh','tin-tuc':'tin-tuc','hoi-thao':'hoi-thao','thu-vien':'thu-vien',
          'ctdt-toan-tc':'ctdt-toan-tc','ctdt-thong-ke':'ctdt-thong-ke','ctdt':'ctdt-toan-tc',
          'thong-bao':'tin-tuc','tin-nganh':'tin-tuc','tat-ca-tin':'tat-ca-tin','hero':'trang-chu','trang-chu':'trang-chu'
        };
        const tab = map[id] || 'trang-chu';
        e.preventDefault();
        switchTab(tab, id, { push: true });
      });
    });

    // On load: respect hash
    function initFromHash(){
      if (window.__restoringView) return; // đang quay lại từ bài viết -> không nhảy tab
      // Đang xem bài viết (?post=...) → không nhảy tab theo hash
      if (new URLSearchParams(location.search).get('post') || document.body.classList.contains('article-mode')) {
        return;
      }
      const hash = (location.hash || '').replace(/^#/, '');
      if(!hash){ switchTab('trang-chu', null, { noScroll: true }); return; }
      const map = {
        'gioi-thieu':'gioi-thieu','lich-su':'gioi-thieu','nhan-dien':'gioi-thieu','chung':'gioi-thieu',
        'phat-trien':'trang-chu','dao-tao':'trang-chu','ao-nganh':'trang-chu',
        'tuyen-sinh':'tuyen-sinh','tin-tuc':'tin-tuc','hoi-thao':'hoi-thao','thu-vien':'thu-vien',
        'ctdt-toan-tc':'ctdt-toan-tc','ctdt-thong-ke':'ctdt-thong-ke','ctdt':'ctdt-toan-tc',
        'thong-bao':'tin-tuc','tin-nganh':'tin-tuc','tat-ca-tin':'tat-ca-tin','hero':'trang-chu','trang-chu':'trang-chu'
      };
      const tab = map[hash] || (VALID.includes(hash) ? hash : 'trang-chu');
      switchTab(tab, map[hash] ? hash : null);
    }
    // Chỉ init hash khi KHÔNG phải trang bài viết
    if (!new URLSearchParams(location.search).get('post')) {
      initFromHash();
    }
    window.addEventListener('hashchange', initFromHash);
    window.__initFromHash = initFromHash;

    // expose for debug
    window.__switchTab = switchTab;
  })();

