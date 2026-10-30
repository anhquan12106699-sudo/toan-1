  // ===== Thông báo lỗi thân thiện (mạng / không tìm thấy) =====
  function uxIsOffline(err){
    return (typeof navigator !== 'undefined' && navigator.onLine === false) || !(err && err.message === 'not found');
  }
  // Khung chờ (skeleton) thay cho dòng chữ "Đang tải bài viết..."
  window.__apSkeletonHtml = function(){
    return '<div class="ap-skel" role="status" aria-busy="true" aria-label="Đang tải bài viết">' +
      '<i style="width:28%"></i><i class="t"></i><i class="t" style="width:72%"></i>' +
      '<i style="margin-top:20px"></i><i></i><i style="width:90%"></i><i></i><i style="width:60%"></i></div>';
  };
  function uxShowArticleError(err){
    var el = document.getElementById('apState'); if (!el) return;
    el.style.display = 'block';
    var ico = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.4 20.6 19H3.4z"/><path d="M12 9.4v4.2"/><path d="M12 16.5h.01"/></svg>';
    if (err && err.message === 'not found') {
      el.innerHTML = '<div class="ap-err" role="alert">'+
        '<div class="ap-err-ico">'+ico+'</div>'+
        '<strong>Không tìm thấy bài viết này</strong>'+
        '<p>Bài viết có thể đã bị gỡ hoặc đường liên kết không đúng.</p>'+
        '<div class="ap-err-actions"><a href="./">← Về trang chủ</a></div></div>';
      return;
    }
    var off = (typeof navigator !== 'undefined' && navigator.onLine === false);
    el.innerHTML = '<div class="ap-err" role="alert">'+
      '<div class="ap-err-ico">'+ico+'</div>'+
      '<strong>'+(off ? 'Bạn đang không có kết nối mạng' : 'Không tải được bài viết lúc này')+'</strong>'+
      '<p>'+(off ? 'Hãy kiểm tra Wi‑Fi/4G rồi thử lại để đọc bài.' : 'Máy chủ chưa phản hồi. Vui lòng thử lại sau ít phút.')+'</p>'+
      '<div class="ap-err-actions"><button type="button" id="apRetryBtn">Thử lại</button><a href="./">← Về trang chủ</a></div></div>';
    var b = document.getElementById('apRetryBtn'); if (b) b.addEventListener('click', function(){ location.reload(); });
  }

  function uxWordFailHtml(){
    return '<div class="ux-notice">Không xem trước được nội dung file Word này (có thể do định dạng phức tạp hoặc mạng chậm). ' +
      'Bạn vẫn có thể tải file gốc về máy để đọc đầy đủ.<br>' +
      '<button type="button" class="ux-btn" data-ux="dl">Tải file Word về</button></div>';
  }
  function uxBindWordFail(el){
    var b = el && el.querySelector('[data-ux="dl"]'); if (!b) return;
    b.addEventListener('click', function(){
      var a = document.querySelector('.ap-word-btn-dl'); if (a) a.click();
    });
  }

  // ===== Lọc HTML không tin cậy (chống XSS) =====
  function sanitizeHtml(h){
    if (window.DOMPurify) return window.DOMPurify.sanitize(String(h||''), {ADD_ATTR:['target']});
    return String(h||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  var __mammothPromise = null;
  function loadMammoth(){
    if (window.mammoth) return Promise.resolve(window.mammoth);
    if (!__mammothPromise) __mammothPromise = new Promise(function(res, rej){
      var sc = document.createElement('script');
      sc.src = 'https://cdn.jsdelivr.net/npm/mammoth/mammoth.browser.min.js';
      sc.onload = function(){ res(window.mammoth); };
      sc.onerror = function(){ __mammothPromise = null; rej(new Error('mammoth')); };
      document.head.appendChild(sc);
    });
    return __mammothPromise;
  }

