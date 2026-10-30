/* ===== Trang Tuyển sinh: đếm ngược, đăng ký nhận thông báo, sub-nav dính ===== */
(function(){
  'use strict';
  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var motion = reduce ? 'auto' : 'smooth';

  /* ---- 3. Sub-nav dính: cuộn tới mục + đánh dấu mục đang xem ---- */
  var subnav = document.querySelector('#tuyen-sinh .tsl-subnav');
  var stickyEl = document.getElementById('tslSticky');
  if (subnav){
    var links = Array.prototype.slice.call(subnav.querySelectorAll('[data-ts-jump]'));
    var targets = links.map(function(a){ return document.getElementById(a.getAttribute('data-ts-jump')); });
    var hdrSpace = function(){
      var h = document.getElementById('siteHeader');
      return (h && h.offsetHeight) ? h.offsetHeight : 72;
    };
    var stickyH = function(){ return window.innerWidth <= 760 ? 52 : 58; };
    var belowDock = function(id){ return id === 'ts-tin-tuc' || id === 'ts-timeline'; };

    links.forEach(function(a, i){
      a.addEventListener('click', function(e){
        e.preventDefault();
        var id = a.getAttribute('data-ts-jump');
        var el = targets[i];
        if (!el) return;
        var top = 0;
        if (id !== 'ts-tong-quan'){
          var off = hdrSpace() + 16 + (belowDock(id) ? stickyH() : 0);
          top = el.getBoundingClientRect().top + (window.pageYOffset || document.documentElement.scrollTop) - off;
        }
        window.scrollTo({ top: Math.max(0, Math.round(top)), behavior: motion });
      });
    });

    var scroller = document.querySelector('#tslSticky .tsl-sticky-in');
    var revealActive = function(a){
      if (!scroller || !a) return;
      if (scroller.scrollWidth <= scroller.clientWidth + 1) return;
      var ar = a.getBoundingClientRect(), sr = scroller.getBoundingClientRect();
      if (ar.left < sr.left + 10) scroller.scrollLeft -= (sr.left + 10 - ar.left);
      else if (ar.right > sr.right - 10) scroller.scrollLeft += (ar.right - sr.right + 10);
    };

    var setActive = function(){
      var line = hdrSpace() + (stickyEl && stickyEl.classList.contains('is-on') ? stickyH() : 0) + 90;
      var idx = 0;
      targets.forEach(function(el, i){
        if (el && el.getBoundingClientRect().top <= line) idx = i;
      });
      links.forEach(function(a, i){
        if (i === idx){
          a.classList.add('is-active');
          a.setAttribute('aria-current', 'location');
        } else {
          a.classList.remove('is-active');
          a.removeAttribute('aria-current');
        }
        if (i === idx) revealActive(a);
      });
    };

    var queued = false;
    window.addEventListener('scroll', function(){
      if (queued) return;
      queued = true;
      requestAnimationFrame(function(){ queued = false; setActive(); });
    }, { passive: true });
    window.addEventListener('resize', setActive);
    setActive();
  }
})();
