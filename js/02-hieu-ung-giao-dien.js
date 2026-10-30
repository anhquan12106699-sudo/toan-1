  // ---- Scroll reveal ----
  const revealEls = document.querySelectorAll('.reveal');
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => { if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
  }, {threshold:.15});
  revealEls.forEach(el => io.observe(el));

  // ---- Hiệu ứng dải xanh + chữ: chạy lại mỗi lần tải / vào tab ----
  function replayGreenHead(el){
    if(!el) return;
    el.classList.remove('animating');
    // đảm bảo không bị ẩn bởi .reveal
    el.classList.add('in');
    // force reflow để animation restart
    void el.offsetWidth;
    el.classList.add('animating');
  }
  function replayVisibleGreenHeads(){
    const heads = document.querySelectorAll('.section-head-left, .sect:not(.sect-dark) > .container > .sect-head, .identity-wrap');
    heads.forEach(head => {
      const section = head.closest('section') || head.parentElement;
      if(!section) return;
      const style = window.getComputedStyle(section);
      if(style.display === 'none' || style.visibility === 'hidden') return;
      replayGreenHead(head);
    });
  }
  window.__replayGreenHeads = replayVisibleGreenHeads;
  // chạy khi DOM sẵn sàng / load
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', () => {
      requestAnimationFrame(() => setTimeout(replayVisibleGreenHeads, 40));
    });
  } else {
    requestAnimationFrame(() => setTimeout(replayVisibleGreenHeads, 40));
  }
  window.addEventListener('pageshow', (e) => {
    // bfcache / reload
    requestAnimationFrame(() => setTimeout(replayVisibleGreenHeads, 40));
  });

  // ---- Đếm số cuộn (hero stats) ----
  function animateCounter(el){
    const target = parseInt(el.getAttribute('data-target'), 10);
    const suffix = el.getAttribute('data-suffix') || '';
    const pad = parseInt(el.getAttribute('data-pad') || '0', 10);
    const duration = 1600;
    const start = performance.now();
    function tick(now){
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      const value = Math.round(target * eased);
      el.textContent = (pad ? String(value).padStart(pad,'0') : value) + suffix;
      if(progress < 1) requestAnimationFrame(tick);
      else el.textContent = (pad ? String(target).padStart(pad,'0') : target) + suffix;
    }
    requestAnimationFrame(tick);
  }
  const counters = document.querySelectorAll('.counter');
  const counterIO = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if(entry.isIntersecting){
        animateCounter(entry.target);
        counterIO.unobserve(entry.target);
      }
    });
  }, {threshold:.5});
  counters.forEach(c => counterIO.observe(c));

  // (Đã bỏ scroll-spy: menu đang chuyển theo tab và được tô màu bởi setActiveNav(); scroll-spy cũ gỡ hết active rồi chỉ sáng mục con nên làm mất màu mục cha)

  // ---- Slideshow áo ngành (tự động trượt mỗi 3 giây + mũi tên / vuốt) ----
  const uCarousel = document.getElementById('uniformCarousel');
  const uDotsWrap = document.getElementById('uniformDots');
  const uWrap = uCarousel && uCarousel.closest('.uniform-carousel-wrap');
  const uPrev = document.getElementById('uniformPrev');
  const uNext = document.getElementById('uniformNext');
  if(uCarousel && uDotsWrap){
    const uSlides = uCarousel.querySelectorAll('.uniform-slide');
    let uIndex = 0;
    let uTimer = null;

    uSlides.forEach((_, i) => {
      const dot = document.createElement('button');
      dot.className = 'uniform-dot' + (i === 0 ? ' active' : '');
      dot.setAttribute('aria-label', 'Ảnh ' + (i + 1));
      dot.addEventListener('click', () => { goToSlide(i); resetTimer(); });
      uDotsWrap.appendChild(dot);
    });
    const uDots = uDotsWrap.querySelectorAll('.uniform-dot');

    function goToSlide(i){
      uIndex = (i + uSlides.length) % uSlides.length;
      uCarousel.style.transform = 'translateX(-' + (uIndex * 100) + '%)';
      uDots.forEach((d, di) => d.classList.toggle('active', di === uIndex));
    }
    function nextSlide(){ goToSlide(uIndex + 1); }
    function prevSlide(){ goToSlide(uIndex - 1); }
    function resetTimer(){
      if(uTimer) clearInterval(uTimer);
      if (!REDUCED_MOTION) uTimer = setInterval(nextSlide, 3000);
    }
    if(uPrev) uPrev.addEventListener('click', () => { prevSlide(); resetTimer(); });
    if(uNext) uNext.addEventListener('click', () => { nextSlide(); resetTimer(); });

    let startX = 0, dragging = false;
    const threshold = 40;
    const swipeEl = uWrap || uCarousel;
    swipeEl.addEventListener('pointerdown', (e) => { dragging = true; startX = e.clientX; });
    swipeEl.addEventListener('pointerup', (e) => {
      if(!dragging) return;
      dragging = false;
      const dx = e.clientX - startX;
      if(dx > threshold){ prevSlide(); resetTimer(); }
      else if(dx < -threshold){ nextSlide(); resetTimer(); }
    });
    swipeEl.addEventListener('pointerleave', () => { dragging = false; });
    swipeEl.addEventListener('mouseenter', () => { if(uTimer) clearInterval(uTimer); });
    swipeEl.addEventListener('mouseleave', () => { resetTimer(); });

    resetTimer();
  }

  // ---- Accordion (chương trình đào tạo) ----
  document.querySelectorAll('.acc-head').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.parentElement;
      const panel = item.querySelector('.acc-panel');
      const wasOpen = item.classList.contains('open');
      // close siblings
      item.parentElement.querySelectorAll('.acc-item').forEach(i => {
        i.classList.remove('open');
        i.querySelector('.acc-panel').style.maxHeight = null;
      });
      if(!wasOpen){
        item.classList.add('open');
        panel.style.maxHeight = panel.scrollHeight + 'px';
      }
    });
  });
  // init open first accordion panel height
  window.addEventListener('load', () => {
    const openItem = document.querySelector('.acc-item.open .acc-panel');
    if(openItem) openItem.style.maxHeight = openItem.scrollHeight + 'px';
  });

  // ---- Nav dropdown: click thu/xổ (mũi tên to trên mobile) ----
  function setDropdownOpen(item, open){
    item.classList.toggle('open', !!open);
  }
  document.querySelectorAll('.navlinks .has-dropdown').forEach(item => {
    const parent = item.querySelector('.nav-parent');
    if(!parent) return;

    parent.addEventListener('click', (e) => {
      const isMobile = window.matchMedia('(max-width:1100px)').matches;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      const wasOpen = item.classList.contains('open');
      document.querySelectorAll('.navlinks .has-dropdown.open').forEach(i => {
        if(i !== item) setDropdownOpen(i, false);
      });
      setDropdownOpen(item, !wasOpen);
      if(isMobile) parent.dataset.skipTab = '1';
    }, true); // capture: chạy trước handler đóng burger / chuyển tab
  });
  document.addEventListener('click', (e) => {
    if(!e.target.closest('.navlinks')){
      document.querySelectorAll('.navlinks .has-dropdown.open').forEach(i => setDropdownOpen(i, false));
    }
  });
  // Desktop: chọn mục con thì đóng panel ngay (dù chuột còn đang đè lên), mở lại khi chuột rời rồi vào lại.
  // Dùng ủy quyền sự kiện ở document (capture) để không bị mất khi trang khác xử lý/chặn click.
  (function(){
    const nl = () => document.getElementById('navLinks');
    const closeAll = () => document.querySelectorAll('.navlinks .has-dropdown.open').forEach(i => setDropdownOpen(i, false));
    document.addEventListener('click', (e) => {
      const el = nl();
      if(el && e.target.closest && e.target.closest('#navLinks .dropdown a')){
        el.classList.add('nav-suppress');
        closeAll();
      }
    }, true);
    // Chuột ra khỏi vùng menu (kể cả panel) thì gỡ trạng thái ép đóng
    document.addEventListener('mousemove', (e) => {
      const el = nl();
      if(el && el.classList.contains('nav-suppress') && !e.target.closest('#navLinks')) el.classList.remove('nav-suppress');
    }, {passive:true});
    // Cuộn trang: đóng panel đang mở; nếu chuột vẫn đứng trên menu thì ép đóng cho tới khi chuột di chuyển ra
    window.addEventListener('scroll', () => {
      const el = nl(); if(!el) return;
      closeAll();
      if(el.querySelector('.has-dropdown:hover')) el.classList.add('nav-suppress');
    }, {passive:true});
  })();
  // Khi chọn mục con trên mobile thì đóng menu burger
  document.querySelectorAll('.navlinks .dropdown a').forEach(a => {
    a.addEventListener('click', () => {
      document.querySelectorAll('.navlinks .has-dropdown.open').forEach(i => setDropdownOpen(i, false));
      if(typeof closeMobileNav === 'function') closeMobileNav();
      else {
        const nav = document.getElementById('navLinks');
        if(nav) nav.classList.remove('open');
      }
    });
  });






  // ---- Giới thiệu: chuyển panel qua dropdown menu ----
  (function(){
    const panels = document.querySelectorAll('[data-intro-panel]');

    function activateIntroTab(id){
      if(!id) id = 'chung';
      panels.forEach(panel => {
        const on = panel.getAttribute('data-intro-panel') === id;
        panel.classList.toggle('intro-active', on);
      });
      // highlight item trong dropdown (KHÔNG đụng nav-parent trên thanh)
      document.querySelectorAll('.navlinks .has-dropdown .dropdown [data-scroll]').forEach(a => {
        if(!a.closest('.has-dropdown')) return;
        const parent = a.closest('.has-dropdown').querySelector('.nav-parent');
        if(!parent || parent.getAttribute('data-tab') !== 'gioi-thieu') return;
        const s = a.getAttribute('data-scroll');
        a.classList.toggle('active', s === id || (id === 'chung' && (s === 'chung' || s === 'gioi-thieu')));
      });
    }

    window.__activateIntroTab = activateIntroTab;

    const hash = (location.hash || '').replace(/^#/, '');
    if(hash === 'lich-su' || hash === 'nhan-dien'){
      activateIntroTab(hash);
    } else if(hash === 'gioi-thieu' || hash === 'chung'){
      activateIntroTab('chung');
    } else {
      activateIntroTab('chung');
    }
  })();

  // ---- Tin tức: chuyển panel qua dropdown (Thông báo / Tin ngành) ----
  (function(){
    const panels = document.querySelectorAll('[data-news-panel]');

    function activateNewsTab(id){
      if(!id) id = 'thong-bao';
      panels.forEach(panel => {
        panel.classList.toggle('active', panel.getAttribute('data-news-panel') === id);
      });
      // Đổi tiêu đề banner theo mục đang xem
      const NEWS_HEAD = {
        'thong-bao': { eyebrow: 'Tin tức', title: 'Thông báo', lead: 'Các thông báo chính thức từ ngành Toán Kinh tế – Học viện Tài chính.' },
        'tin-nganh': { eyebrow: 'Tin tức', title: 'Tin ngành Toán kinh tế', lead: 'Tin tức và hoạt động mới nhất của ngành Toán Kinh tế – Học viện Tài chính.' }
      };
      const hd = NEWS_HEAD[id] || NEWS_HEAD['thong-bao'];
      const e1 = document.getElementById('newsEyebrow'), e2 = document.getElementById('newsTitle'), e3 = document.getElementById('newsLead');
      if (e1) e1.textContent = hd.eyebrow;
      if (e2) e2.textContent = hd.title;
      if (e3) e3.textContent = hd.lead;
      // highlight dropdown items (chỉ trong .dropdown, không tô nav-parent)
      document.querySelectorAll('.navlinks .has-dropdown .dropdown a[data-tab="tin-tuc"][data-scroll]').forEach(a => {
        a.classList.toggle('active', a.getAttribute('data-scroll') === id);
      });
    }

    window.__activateNewsTab = activateNewsTab;

    const hash = (location.hash || '').replace(/^#/, '');
    if(hash === 'tin-nganh' || hash === 'thong-bao'){
      activateNewsTab(hash);
    } else {
      activateNewsTab('thong-bao');
    }
  })();

