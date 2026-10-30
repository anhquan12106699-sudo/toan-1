/* ===== Trang Tuyển sinh: landing theo năm, số liệu, tin nổi bật, danh sách tin ===== */
(function(){
  // Cấu hình từng năm — sửa số liệu / thêm năm mới (ví dụ 2028) tại đây
  var YEARS = [
    { year:2025, tag:'Khóa đầu tiên', status:'Đã tuyển', layout:'first',
      note:'Năm đầu tiên ngành Toán kinh tế mở tuyển sinh.',
      quota:'50', score:'24,57', blocks:['A00','A01','D01','D07'] },
    { year:2026, tag:'Khóa thứ hai', status:'Mới nhất', layout:'now', showEmpty:true,
      note:'Mở rộng quy mô: chỉ tiêu gấp 3 lần năm đầu tiên.',
      quota:'150', score:'25,54', blocks:['A00','A01','D01','D07'],
      quotaDelta:'Gấp 3 lần năm 2025', scoreDelta:'Tăng 0,97 điểm so với 2025' },
    { year:2027, tag:'Khóa thứ ba', status:'Sắp tới', layout:'next',
      note:'Thông tin chỉ tiêu, phương thức xét tuyển sẽ được cập nhật khi có thông báo chính thức.',
      quota:null, score:null, blocks:null }
  ];
  var DEFAULT_YEAR = 2026, PAGE = 6;
  var cat = 'Tuyển sinh';
  var yearsEl = document.getElementById('tsYears'),
      panelsEl = document.getElementById('tsPanels'),
      statsEl = document.getElementById('tsStats'),
      yearMark = document.getElementById('tslYear'),
      heroYear = document.getElementById('tsHeroYear'),
      sectionEl = document.getElementById('tuyen-sinh'),
      dockEl = sectionEl && sectionEl.querySelector('.tsl-dock'),
      stickyEl = document.getElementById('tslSticky'),
      stickyYearsEl = document.getElementById('tslStickyYears'),
      stickyYearEl = document.getElementById('tslStickyYear'),
      stickyMetaEl = document.getElementById('tslStickyMeta'),
      progEl = document.getElementById('tslProg'),
      tlEls = sectionEl ? Array.prototype.slice.call(sectionEl.querySelectorAll('[data-tl-y]')) : [],
      revealEls = sectionEl ? Array.prototype.slice.call(sectionEl.querySelectorAll('.tsl-reveal')) : [];
  if (!yearsEl || !panelsEl || !statsEl) return;

  var esc = function(t){ return String(t==null?'':t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); };
  var tm = function(x){ var d=new Date(x.time); return isNaN(d.getTime())?0:d.getTime(); };
  var dstr = function(x){ var t=tm(x); if(!t) return ''; var d=new Date(t); return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear(); };
  var yearOf = function(x){
    var m = String(x.badge||'').match(/20\d\d/) || String(x.title||'').match(/20\d\d/);
    if (m) return +m[0];
    var t = tm(x); return t ? new Date(t).getFullYear() : 0;
  };
  var isFeat = function(x){ return /nổi bật/i.test(String(x.badge||'')); };
  var href = function(x){ return '?post=' + encodeURIComponent(String(x.id||x.time||'')); };

  var active = DEFAULT_YEAR;
  var cfgOf = function(y){ var c=null; YEARS.forEach(function(x){ if(x.year===y) c=x; }); return c || YEARS[0]; };

  // Biểu tượng (stroke SVG, kế thừa currentColor)
  var SV = function(p){ return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+p+'</svg>'; };
  var ICO = {
    quota:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    score:'<path d="M3 17.5 9 11l4 4 7.5-7.5"/><path d="M15.5 7.5h5v5"/>',
    blocks:'<rect x="3" y="3" width="7.5" height="7.5" rx="1.6"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6"/>',
    down:'<path d="M12 5v14"/><path d="m6 13 6 6 6-6"/>',
    arrow:'<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>'
  };

  // Số liệu của năm đang xem (nằm trong dock, dùng chung cho mọi năm)
  function renderStats(c){
    if (!c) return;
    var tile = function(ico, lbl, val, sub){
      return '<div class="tsl-stat">'+
        '<div class="tsl-stat-top"><span class="tsl-stat-ico">'+SV(ico)+'</span><span class="tsl-stat-lbl">'+lbl+'</span></div>'+
        val + (sub || '') +
      '</div>';
    };
    var quotaVal = c.quota==null
      ? '<div class="tsl-stat-val is-pending">Đang cập nhật</div>'
      : '<div class="tsl-stat-val">'+esc(c.quota)+'</div>';
    var quotaSub = c.quota==null
      ? '<div class="tsl-stat-sub is-muted">Theo thông báo chính thức</div>'
      : (c.quotaDelta?'<div class="tsl-stat-sub">'+esc(c.quotaDelta)+'</div>':'');
    var scoreVal = c.score==null
      ? '<div class="tsl-stat-val is-pending">Đang cập nhật</div>'
      : '<div class="tsl-stat-val">'+esc(c.score)+'</div>';
    var scoreSub = c.score==null
      ? '<div class="tsl-stat-sub is-muted">Theo thông báo chính thức</div>'
      : (c.scoreDelta?'<div class="tsl-stat-sub">'+esc(c.scoreDelta)+'</div>':'');
    var blocksVal = c.blocks
      ? '<div class="tsl-stat-val">'+c.blocks.length+'</div>'
      : '<div class="tsl-stat-val is-pending">Đang cập nhật</div>';
    var blocksSub = c.blocks
      ? '<div class="tsl-stat-blocks">'+c.blocks.map(function(b){ return '<span>'+esc(b)+'</span>'; }).join('')+'</div>'
      : '<div class="tsl-stat-sub is-muted">Theo thông báo chính thức</div>';
    statsEl.innerHTML = tile(ICO.quota, 'Chỉ tiêu', quotaVal, quotaSub) +
                        tile(ICO.score, 'Điểm chuẩn', scoreVal, scoreSub) +
                        tile(ICO.blocks, 'Tổ hợp xét tuyển', blocksVal, blocksSub);
    animateStats();
  }

  // Số liệu trong dock: đếm tăng dần mỗi khi mở trang / đổi năm
  function animateStats(){
    if (reduceMotion || !statsEl) return;
    statsEl.querySelectorAll('.tsl-stat-val').forEach(function(el){
      if (el.classList.contains('is-pending')) return;
      var raw = (el.textContent || '').trim();
      var m = raw.match(/^(\d+)(?:,(\d+))?$/);
      if (!m) return;
      var dec = m[2] ? m[2].length : 0;
      var target = parseFloat(raw.replace(',', '.'));
      if (!isFinite(target)) return;
      var dur = 750, t0 = 0;
      el.textContent = dec ? (0).toFixed(dec).replace('.', ',') : '0';
      function step(now){
        if (!t0) t0 = now;
        var p = Math.min((now - t0) / dur, 1);
        var v = target * (1 - Math.pow(1 - p, 3));
        el.textContent = dec ? v.toFixed(dec).replace('.', ',') : String(Math.round(v));
        if (p < 1) requestAnimationFrame(step);
        else el.textContent = raw;
      }
      requestAnimationFrame(step);
    });
  }

  // Tóm tắt một dòng cho thanh dính
  function metaText(c){
    if (!c) return '';
    var parts = [];
    if (c.quota != null) parts.push('<strong>'+esc(c.quota)+'</strong> chỉ tiêu');
    if (c.score != null) parts.push('<strong>'+esc(c.score)+'</strong> điểm chuẩn');
    if (!parts.length) return 'Chỉ tiêu &amp; điểm chuẩn: đang cập nhật';
    return parts.join(' · ');
  }

  // Khối nhận diện riêng của từng năm — mỗi năm một cách trình bày khác nhau
  ICO.clock = '<circle cx="12" cy="12" r="8.6"/><path d="M12 7.4V12l3.1 1.9"/>';

  function sigBlock(c){
    // Một kiểu trình bày chung cho mọi năm: nhãn · tiêu đề · mô tả · bốn con số
    var D = {
      2025:{ tag:'Khóa đầu tiên · 2025', title:'Năm đầu tiên ngành Toán kinh tế mở tuyển sinh',
             lead:'Khóa đầu tiên tuyển sinh với 50 chỉ tiêu, xét tuyển bằng bốn tổ hợp A00, A01, D01, D07. Điểm chuẩn của khóa là 24,57.',
             nums:['50','24,57','04','56'] },
      2026:{ tag:'Khóa thứ hai · 2026', title:'Khóa thứ hai: mở rộng quy mô',
             lead:'Đặt cạnh năm đầu tiên, chỉ tiêu tăng gấp ba lần và điểm chuẩn tăng 0,97 điểm — quy mô và mặt bằng đầu vào cùng đi lên.',
             nums:['150','25,54','04','163'] },
      2027:{ tag:'Sắp tới · 2027', title:'Lộ trình công bố thông tin',
             lead:'Thông tin tuyển sinh 2027 chưa được công bố. Các mục dưới đây sẽ được cập nhật ngay khi Học viện có thông báo chính thức, không công bố số liệu dự kiến.',
             nums:[null,null,null,null] }
    };
    var d = D[c.year];
    if (!d) return '<p class="ts-year-note"><strong>'+esc(c.tag||('Tuyển sinh '+c.year))+'</strong>'+(c.note?'<span>'+esc(c.note)+'</span>':'')+'</p>';
    var labels = ['Chỉ tiêu','Điểm chuẩn','Tổ hợp xét tuyển','Tân sinh viên nhập học'];
    var nums = d.nums.map(function(v,i){
      return '<div class="tsy-num"><strong'+(v==null?' class="is-pending"':'')+'>'+(v==null?'Đang cập nhật':esc(v))+'</strong><span>'+labels[i]+'</span></div>';
    }).join('');
    return '<section class="tsy tsy--uni" data-year="'+c.year+'" aria-label="Tóm tắt tuyển sinh '+c.year+'">'+
      '<div class="tsy-head">'+
        '<span class="tsy-tag">'+d.tag+'</span>'+
        '<h3 class="tsy-title">'+d.title+'</h3>'+
        '<p class="tsy-lead">'+d.lead+'</p>'+
      '</div>'+
      '<div class="tsy-nums">'+nums+'</div>'+
    '</section>';
  }

  function noneLine(c){
    return '<p class="ts-none" data-none hidden>Chưa có tin tuyển sinh '+c.year+' được đăng. '+
      '<a href="#tat-ca-tin" data-tab="tat-ca-tin">Xem tất cả tin tuyển sinh</a></p>';
  }

  function buildSticky(years){
    if (!stickyYearsEl) return;
    stickyYearsEl.innerHTML = years.map(function(c){
      return '<button type="button" class="tsl-sticky-yr'+(c.year===active?' active':'')+'" data-y="'+c.year+'" aria-pressed="'+(c.year===active)+'">'+c.year+'</button>';
    }).join('');
  }

  // Đồng bộ thanh dính + dấu mốc theo năm đang chọn
  function syncSticky(y){
    var c = cfgOf(y);
    if (stickyYearEl) stickyYearEl.textContent = y;
    if (stickyMetaEl) stickyMetaEl.innerHTML = metaText(c);
    if (stickyYearsEl) stickyYearsEl.querySelectorAll('.tsl-sticky-yr').forEach(function(b){
      var on = +b.dataset.y === y;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', on);
    });
    tlEls.forEach(function(card){
      var on = +card.dataset.tlY === y;
      card.classList.toggle('is-active', on);
      card.setAttribute('aria-pressed', on);
      var li = card.parentNode;
      if (li && li.classList) li.classList.toggle('is-active', on);
    });
  }

  function build(years){
    yearsEl.innerHTML = years.map(function(c){
      return '<button type="button" class="ts-year-btn'+(c.year===active?' active':'')+'" role="tab" data-y="'+c.year+'" aria-selected="'+(c.year===active)+'">'+
             c.year+(c.status?'<small>'+esc(c.status)+'</small>':'')+'</button>';
    }).join('');
    panelsEl.innerHTML = years.map(function(c){
      return '<div class="ts-panel'+(c.year===active?' active':'')+'" data-y="'+c.year+'" role="tabpanel" aria-label="Tuyển sinh '+c.year+'">'+
        sigBlock(c)+
        noneLine(c)+
        '<div class="ts-sec" data-feat id="ts-news-'+c.year+'"><div class="ts-sec-head"><h3>Tin nổi bật tuyển sinh '+c.year+'</h3>'+
          '<a class="ts-feat-more" href="#tat-ca-tin" data-tab="tat-ca-tin">Tất cả tin tuyển sinh'+SV(ICO.arrow)+'</a></div>'+
          '<div class="ts-feat-slot"><div class="ts-empty">Đang tải tin...</div></div></div>'+
        '<div class="ts-sec" data-list><div class="ts-sec-head"><h3>Tin tuyển sinh '+c.year+'</h3><span class="ts-count"></span></div><div class="ts-list-slot"></div></div>'+
      '</div>';
    }).join('');
    renderStats(cfgOf(active));
    buildSticky(years);
    syncSticky(active);
  }

  function show(y){
    active = y;
    yearsEl.querySelectorAll('.ts-year-btn').forEach(function(b){ var on=+b.dataset.y===y; b.classList.toggle('active',on); b.setAttribute('aria-selected',on); });
    panelsEl.querySelectorAll('.ts-panel').forEach(function(p){ p.classList.toggle('active', +p.dataset.y===y); });
    renderStats(cfgOf(y));
    syncSticky(y);
    if (yearMark) yearMark.textContent = y;
    if (heroYear) heroYear.textContent = y;
    var b = yearsEl.querySelector('.ts-year-btn.active');
    if (b && b.scrollIntoView) { try{ b.scrollIntoView({inline:'center',block:'nearest'}); }catch(e){} }
  }
  yearsEl.addEventListener('click', function(e){ var b=e.target.closest('.ts-year-btn'); if(b) show(+b.dataset.y); });
  if (stickyYearsEl) stickyYearsEl.addEventListener('click', function(e){
    var b = e.target.closest('.tsl-sticky-yr'); if(!b) return;
    show(+b.dataset.y);
  });

  // Dấu mốc: chọn năm rồi cuộn tới khu tin của năm đó
  if (sectionEl) sectionEl.addEventListener('click', function(e){
    var card = e.target.closest('[data-tl-y]'); if(!card) return;
    show(+card.dataset.tlY);
    var panel = panelsEl.querySelector('.ts-panel.active');
    scrollToEl(panel ? (panel.querySelector('.tsy') || panel.querySelector('.ts-year-note')) : panelsEl);
  });

  // ---- Cuộn: thanh dính, tiến trình, hiệu ứng xuất hiện ----
  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var stickyOn = false, hdrCache = 0;

  // Chiều cao header thật (header co lại khi cuộn) để thanh dính bám sát, không hở khe
  function hdrSpace(){
    var he = document.getElementById('siteHeader');
    if (he && he.offsetHeight) return he.offsetHeight;
    var v = getComputedStyle(document.documentElement).getPropertyValue('--hdr-space');
    var n = parseFloat(v);
    return isNaN(n) ? 72 : n;
  }

  function scrollToEl(el, behavior){
    if (!el) return;
    var y0 = window.pageYOffset || document.documentElement.scrollTop || 0;
    var top = el.getBoundingClientRect().top + y0 - hdrSpace() - (stickyOn ? 58 : 0) - 16;
    if (top < 0) top = 0;
    try { window.scrollTo({ top: top, behavior: behavior || (reduceMotion ? 'auto' : 'smooth') }); }
    catch(err){ window.scrollTo(0, top); }
  }

  function sectionVisible(){
    if (!sectionEl) return false;
    if (sectionEl.offsetParent === null) return false;
    return sectionEl.getBoundingClientRect().height > 0;
  }

  function revealCheck(){
    if (!revealEls.length || reduceMotion) return;
    if (!sectionVisible()) return;
    var vh = window.innerHeight || 800;
    revealEls.forEach(function(el){
      if (el.classList.contains('in')) return;
      if (el.getBoundingClientRect().top < vh * 0.92) el.classList.add('in');
    });
  }

  function onScroll(){
    if (!sectionEl) return;
    var secRect = sectionEl.getBoundingClientRect();
    var h = hdrSpace();
    var vh = window.innerHeight || 800;

    if (h !== hdrCache){
      hdrCache = h;
      if (stickyEl) stickyEl.style.top = h + 'px';
    }

    if (!sectionVisible()){
      if (stickyOn && stickyEl){ stickyOn = false; stickyEl.classList.remove('is-on'); stickyEl.setAttribute('aria-hidden','true'); }
      return;
    }
    var should = !!dockEl && dockEl.getBoundingClientRect().bottom < h + 4 && secRect.bottom > h + 140;
    if (stickyEl && should !== stickyOn){
      stickyOn = should;
      stickyEl.classList.toggle('is-on', should);
      stickyEl.setAttribute('aria-hidden', should ? 'false' : 'true');
    }
    if (progEl){
      var total = sectionEl.offsetHeight - vh;
      var p = total > 0 ? (-secRect.top) / total : 0;
      p = Math.max(0, Math.min(1, p));
      progEl.style.width = (p * 100).toFixed(1) + '%';
    }
    revealCheck();
  }

  var lastScrollRun = 0;
  function queueScroll(){
    var now = Date.now();
    if (now - lastScrollRun < 40) return;
    lastScrollRun = now;
    onScroll();
  }
  window.addEventListener('scroll', queueScroll, { passive:true });
  window.addEventListener('resize', queueScroll);
  if (window.MutationObserver){
    var mo = new MutationObserver(queueScroll);
    mo.observe(document.body, { attributes:true, attributeFilter:['class'] });
    mo.observe(document.documentElement, { attributes:true, attributeFilter:['class'] });
  }

  // Nút "Xem tin tuyển sinh <năm>": cuộn tới khu tin của năm đang xem
  if (sectionEl) sectionEl.addEventListener('click', function(e){
    var t = e.target.closest('[data-ts-scroll]'); if(!t) return;
    var panel = panelsEl.querySelector('.ts-panel.active'); if(!panel) return;
    var sec = panel.querySelector('[data-feat]');
    if (sec && !sec.offsetHeight) sec = panel.querySelector('.tsy');
    if (!sec) sec = panel;
    scrollToEl(sec);
    var h = sec.querySelector('h3');
    if (h){ h.setAttribute('tabindex','-1'); try{ h.focus({preventScroll:true}); }catch(err2){} }
  });

  // Ảnh hero: dùng lại ảnh thứ 2 của slider trang chủ (không nhân bản dữ liệu ảnh)
  (function heroPhoto(){
    if (!sectionEl) return;
    var pic = document.querySelector('#heroSliderTrack .hero-slide:nth-child(2) img') ||
              document.querySelector('#heroSliderTrack .hero-slide img');
    var src = pic && (pic.currentSrc || pic.getAttribute('src'));
    // Đặt trên section để cả hero và CTA cùng dùng chung một ảnh
    if (src) sectionEl.style.setProperty('--tsl-photo','url("'+src+'")');
  })();

  function emptyState(title, text, mode){
    var isErr = mode === 'error';
    var ico = isErr
      ? '<path d="M12 3.4 20.6 19H3.4z"/><path d="M12 9.4v4.2"/><path d="M12 16.5h.01"/>'
      : '<path d="M4 6.5h16"/><path d="M4 12h10.5"/><path d="M4 17.5h7"/>';
    var action = isErr
      ? '<button type="button" class="ts-empty-link" data-ts-retry><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11.5a8 8 0 1 1-2.34-5.66"/><path d="M20 4.5v6h-6"/></svg>Thử lại</button>'
      : '<a class="ts-empty-link" href="#tat-ca-tin" data-tab="tat-ca-tin">Xem tất cả tin tuyển sinh</a>';
    return '<div class="ts-empty'+(isErr?' is-error':'')+'"'+(isErr?' role="alert"':'')+'>'+
      '<div class="ts-empty-ico">'+SV(ico)+'</div>'+
      '<strong>'+title+'</strong><span class="ts-empty-txt">'+text+'</span>'+
      action+'</div>';
  }

  function fill(items){
    var all = (items||[]).filter(function(x){ return String(x.category||'').trim()===cat; }).sort(function(a,b){ return tm(b)-tm(a); });
    // Năm chưa cấu hình nhưng có tin => tự thêm tab năm đó
    var known = YEARS.map(function(c){return c.year;}), extra=false;
    all.forEach(function(x){ var y=yearOf(x); if(y && known.indexOf(y)<0){ known.push(y); YEARS.push({year:y,tag:'Tuyển sinh '+y,status:'',note:'',quota:null,score:null,blocks:null}); extra=true; } });
    if (extra){ YEARS.sort(function(a,b){return a.year-b.year;}); build(YEARS); }
    YEARS.forEach(function(c){
      var panel = panelsEl.querySelector('.ts-panel[data-y="'+c.year+'"]'); if(!panel) return;
      var list = all.filter(function(x){ return yearOf(x)===c.year; });
      var featSlot = panel.querySelector('.ts-feat-slot'), listSlot = panel.querySelector('.ts-list-slot'), cnt = panel.querySelector('.ts-count'),
          featSec = panel.querySelector('[data-feat]'), listSec = panel.querySelector('[data-list]'), noneEl = panel.querySelector('[data-none]');
      if (!list.length){
        if (c.showEmpty === true && featSlot){
          if (featSec) featSec.style.display = '';
          featSlot.innerHTML = emptyState('Chưa có tin tuyển sinh '+c.year, 'Tin sẽ xuất hiện tại đây khi được đăng với chuyên mục “Tuyển sinh”.');
          if (listSec) listSec.style.display='none';
          if (noneEl) noneEl.hidden = true;
        } else {
          if (featSec) featSec.style.display='none';
          if (listSec) listSec.style.display='none';
          if (noneEl) noneEl.hidden = false;
        }
        return;
      }
      if (featSec) featSec.style.display='';
      if (listSec) listSec.style.display='';
      if (noneEl) noneEl.hidden = true;
      // Nổi bật: ưu tiên bài gắn nhãn "Nổi bật", bù bằng bài mới nhất
      var featured = list.filter(isFeat).concat(list.filter(function(x){return !isFeat(x);})).slice(0,4);
      var main = featured[0], side = featured.slice(1);
      featSlot.innerHTML = '<div class="ts-feat-grid">'+
        '<a class="ts-feat-main" href="'+href(main)+'" data-id="'+esc(main.id)+'"><div class="ts-thumb"><span class="ts-badge">'+(isFeat(main)?'Nổi bật':'Mới nhất')+'</span></div>'+
        '<div class="ts-feat-body"><div class="ts-meta">'+dstr(main)+'</div><h4>'+esc(main.title)+'</h4><p>'+esc(main.content||'')+'</p></div></a>'+
        '<div class="ts-feat-list">'+side.map(function(x){ return '<a class="ts-feat-item" href="'+href(x)+'" data-id="'+esc(x.id)+'"><div class="ts-thumb"></div><div><div class="ts-meta">'+dstr(x)+'</div><h5>'+esc(x.title)+'</h5></div></a>'; }).join('')+'</div></div>';
      if (!side.length) featSlot.querySelector('.ts-feat-grid').classList.add('is-single');
      // Danh sách: phần còn lại, nút "Xem thêm"
      var rest = list.filter(function(x){ return featured.indexOf(x)<0; });
      cnt.textContent = list.length + ' bài';
      if (!rest.length){ listSlot.innerHTML=''; panel.querySelector('[data-list]').style.display='none'; return; }
      var shown = 0;
      listSlot.innerHTML = '<div class="ts-news-grid"></div><div class="ts-more"></div>';
      var grid = listSlot.querySelector('.ts-news-grid'), more = listSlot.querySelector('.ts-more');
      function next(){
        rest.slice(shown, shown+PAGE).forEach(function(x){
          var a=document.createElement('a'); a.className='news-card'; a.href=href(x); a.dataset.id=String(x.id||'');
          a.innerHTML='<div class="news-card-thumb"></div><div class="news-card-body"><div class="news-card-meta"><span>'+dstr(x)+'</span></div><h3>'+esc(x.title)+'</h3><p>'+esc(x.content||'')+'</p></div>';
          grid.appendChild(a);
        });
        shown = Math.min(rest.length, shown+PAGE);
        more.innerHTML = shown<rest.length ? '<button type="button">Xem thêm ('+(rest.length-shown)+')</button>' : '';
        if (window.__getNewsCovers) covers(grid);
      }
      more.addEventListener('click', function(e){ if(e.target.closest('button')) next(); });
      next();
    });
    if (window.__getNewsCovers) covers(panelsEl);
  }

  // Nạp ảnh bìa (tải sau cho nhẹ trang)
  function covers(root){
    if (typeof window.__getNewsCovers !== 'function') return;
    var els = Array.prototype.slice.call(root.querySelectorAll('[data-id]')).filter(function(a){ return a.dataset.id && !a.dataset.cov; });
    if (!els.length) return;
    els.forEach(function(a){ a.dataset.cov='1'; });
    window.__getNewsCovers(els.map(function(a){return a.dataset.id;})).then(function(map){
      els.forEach(function(a){
        var u = map[a.dataset.id]; if(!u) return;
        var th = a.querySelector('.ts-thumb,.news-card-thumb');
        if (th) th.style.backgroundImage = "url('"+u+"')";
      });
    });
  }

  function unavailable(title){
    YEARS.forEach(function(c){
      var panel = panelsEl.querySelector('.ts-panel[data-y="'+c.year+'"]'); if(!panel) return;
      var featSlot = panel.querySelector('.ts-feat-slot'),
          featSec = panel.querySelector('[data-feat]'), listSec = panel.querySelector('[data-list]'), noneEl = panel.querySelector('[data-none]');
      if (c.showEmpty === true && featSlot){
        if (featSec) featSec.style.display='';
        featSlot.innerHTML = emptyState(title, 'Kiểm tra kết nối mạng rồi thử lại, hoặc xem toàn bộ tin đã đăng của ngành.', 'error');
        var tsRetry = featSlot.querySelector('[data-ts-retry]');
        if (tsRetry) tsRetry.addEventListener('click', function(){ tsRetry.disabled = true; init(); });
        if (listSec) listSec.style.display='none';
        if (noneEl) noneEl.hidden = true;
      } else {
        if (featSec) featSec.style.display='none';
        if (listSec) listSec.style.display='none';
        if (noneEl) noneEl.hidden = false;
      }
    });
  }

  function init(){
    if (typeof window.__loadNewsFeed !== 'function'){
      unavailable('Chưa kết nối được máy chủ tin tức');
      return;
    }
    window.__loadNewsFeed().then(fill).catch(function(){
      unavailable('Không tải được tin tuyển sinh');
    });
  }

  build(YEARS);
  if (yearMark) yearMark.textContent = active;
  if (heroYear) heroYear.textContent = active;

  // Bật hiệu ứng xuất hiện (chỉ khi JS chạy được — nếu lỗi, nội dung vẫn hiện đầy đủ)
  document.documentElement.classList.add('tsl-js');

  // Đường nối dấu mốc vẽ dần khi cuộn tới
  (function timelineDraw(){
    if (!sectionEl) return;
    var line = sectionEl.querySelector('.tsl-tl');
    if (!line) return;
    if (reduceMotion || !('IntersectionObserver' in window)){ line.classList.add('is-in'); return; }
    var tlIO = new IntersectionObserver(function(entries){
      entries.forEach(function(en){ if (en.isIntersecting){ line.classList.add('is-in'); tlIO.disconnect(); } });
    }, {threshold:.2});
    tlIO.observe(line);
  })();

  queueScroll();
  window.addEventListener('load', queueScroll);
  // Dự phòng: sau khi tải xong, mọi khối đã vào khung nhìn đều hiện ra
  setTimeout(function(){
    if (!sectionVisible()) return;
    var vh = window.innerHeight || 800;
    revealEls.forEach(function(el){
      if (el.getBoundingClientRect().top < vh) el.classList.add('in');
    });
  }, 1400);

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
