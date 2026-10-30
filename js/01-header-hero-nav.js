
  const REDUCED_MOTION = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // ---- Header scroll shrink ----
  const header = document.getElementById('siteHeader');
  const toTop = document.getElementById('toTop');

  // Đồng bộ chiều cao thật của header vào biến CSS, để menu trượt mobile
  // luôn bắt đầu ngay dưới header (không bị hở khoảng trắng phía trên).
  function syncMobileNavHeaderH(){
    document.documentElement.style.setProperty('--mnav-header-h', header.offsetHeight + 'px');
    // Header đã cố định (fixed): giữ khoảng đệm cố định = chiều cao header lúc chưa cuộn,
    // để nội dung không bị nhảy khi header thu gọn.
    if(window.scrollY <= 30){
      document.documentElement.style.setProperty('--hdr-space', header.offsetHeight + 'px');
    }
  }
  syncMobileNavHeaderH();
  if('ResizeObserver' in window){
    new ResizeObserver(syncMobileNavHeaderH).observe(header);
  } else {
    window.addEventListener('resize', syncMobileNavHeaderH);
  }

  window.addEventListener('scroll', () => {
    header.classList.toggle('scrolled', window.scrollY > 30);
    toTop.classList.toggle('show', window.scrollY > 500);
  });
  toTop.addEventListener('click', () => window.scrollTo({top:0, behavior:'smooth'}));

  // ---- Hero slider: ảnh nền toàn khung, chuyển ảnh mờ dần (crossfade) ----
  (function(){
    const slider = document.getElementById('heroSlider');
    const track = document.getElementById('heroSliderTrack');
    if(!slider || !track) return;
    const dotsWrap = document.getElementById('heroSliderDots');
    const prevBtn = document.getElementById('heroSliderPrev');
    const nextBtn = document.getElementById('heroSliderNext');
    const slides = Array.from(track.children);
    const count = slides.length;
    if(!count) return;

    let index = 0, autoplayTimer = null;

    slides.forEach((el, i) => {
      el.classList.toggle('is-active', i === 0);
      el.setAttribute('aria-hidden', i === 0 ? 'false' : 'true');
    });

    slides.forEach((_, i) => {
      const dot = document.createElement('button');
      dot.className = 'hero-slider-dot' + (i === 0 ? ' active' : '');
      dot.setAttribute('aria-label', 'Ảnh ' + (i + 1));
      dot.addEventListener('click', () => { show(i); resetAutoplay(); });
      dotsWrap.appendChild(dot);
    });
    const dots = dotsWrap.querySelectorAll('.hero-slider-dot');

    function show(i){
      index = (i + count) % count;
      slides.forEach((el, k) => {
        const on = k === index;
        el.classList.toggle('is-active', on);
        el.setAttribute('aria-hidden', on ? 'false' : 'true');
      });
      dots.forEach((d, k) => d.classList.toggle('active', k === index));
    }
    const next = () => show(index + 1);
    const prev = () => show(index - 1);

    prevBtn.addEventListener('click', () => { prev(); resetAutoplay(); });
    nextBtn.addEventListener('click', () => { next(); resetAutoplay(); });

    // vuốt trái/phải trên điện thoại
    let startX = 0, dragging = false;
    slider.addEventListener('pointerdown', (e) => { dragging = true; startX = e.clientX; });
    slider.addEventListener('pointerup', (e) => {
      if(!dragging) return;
      dragging = false;
      const dx = e.clientX - startX;
      if(dx > 40){ prev(); resetAutoplay(); }
      else if(dx < -40){ next(); resetAutoplay(); }
    });
    slider.addEventListener('pointerleave', () => { dragging = false; });

    function startAutoplay(){
      clearInterval(autoplayTimer);
      if (REDUCED_MOTION) return;
      autoplayTimer = setInterval(() => { if (!document.hidden) next(); }, 5500);
    }
    function resetAutoplay(){ startAutoplay(); }
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) clearInterval(autoplayTimer); else resetAutoplay();
    });
    startAutoplay();
  })();
  const burger = document.getElementById('burgerBtn');
  const navLinks = document.getElementById('navLinks');
  const navBackdrop = document.getElementById('navBackdrop');

  function openMobileNav(){
    if(typeof syncMobileNavHeaderH === 'function') syncMobileNavHeaderH();
    navLinks.classList.add('open');
    if(navBackdrop){
      navBackdrop.classList.add('is-visible');
      navBackdrop.setAttribute('aria-hidden', 'false');
    }
    document.body.style.overflow = 'hidden';
  }
  function closeMobileNav(){
    navLinks.classList.remove('open');
    // thu các dropdown đang mở
    document.querySelectorAll('.navlinks .has-dropdown.open').forEach(i => i.classList.remove('open'));
    if(navBackdrop){
      navBackdrop.classList.remove('is-visible');
      navBackdrop.setAttribute('aria-hidden', 'true');
    }
    document.body.style.overflow = '';
  }
  function toggleMobileNav(){
    if(navLinks.classList.contains('open')) closeMobileNav();
    else openMobileNav();
  }

  burger.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMobileNav();
  });

  // Bấm vào khoảng trống (lớp phủ) → đóng menu, trả về màn chính
  if(navBackdrop){
    navBackdrop.addEventListener('click', () => closeMobileNav());
  }

  // Bấm ra ngoài panel menu cũng đóng
  document.addEventListener('click', (e) => {
    if(!navLinks.classList.contains('open')) return;
    if(e.target.closest('#navLinks') || e.target.closest('#burgerBtn') || e.target.closest('#siteHeader .brand')) return;
    // nếu click vào backdrop đã xử lý ở trên
    if(e.target === navBackdrop) return;
    // click vùng nội dung phía dưới menu
    if(!e.target.closest('#siteHeader')) closeMobileNav();
  });

  // Chỉ đóng menu burger khi bấm link thường / mục con — KHÔNG đóng khi bấm mục cha (để xổ mục con)
  navLinks.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    if(a.classList.contains('nav-parent')) return;
    closeMobileNav();
  }));

  // ---- Nav arrows (cuộn thanh menu sang ngang) ----
  const navArrowLeft = document.getElementById('navArrowLeft');
  const navArrowRight = document.getElementById('navArrowRight');
  if(navArrowLeft && navArrowRight && navLinks){
    const scrollAmount = () => Math.max(navLinks.clientWidth * 0.6, 160);
    navArrowLeft.addEventListener('click', () => navLinks.scrollBy({left: -scrollAmount(), behavior:'smooth'}));
    navArrowRight.addEventListener('click', () => navLinks.scrollBy({left: scrollAmount(), behavior:'smooth'}));

    const updateNavArrows = () => {
      const max = navLinks.scrollWidth - navLinks.clientWidth;
      navArrowLeft.disabled = navLinks.scrollLeft <= 4;
      navArrowRight.disabled = navLinks.scrollLeft >= max - 4;
    };
    navLinks.addEventListener('scroll', updateNavArrows);
    window.addEventListener('resize', updateNavArrows);
    updateNavArrows();
  }

