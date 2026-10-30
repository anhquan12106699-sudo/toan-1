  // ===== CTĐT accordion (đóng/mở độc lập) =====
  (function initCtdtAccordion(){
    function bind(root){
      root.querySelectorAll('[data-ctdt-acc]').forEach(acc => {
        acc.querySelectorAll('.ctdt-acc-btn').forEach(btn => {
          if (btn.dataset.bound) return;
          btn.dataset.bound = '1';
          btn.addEventListener('click', () => {
            const item = btn.closest('.ctdt-acc-item');
            if (!item) return;
            const open = item.classList.toggle('open');
            btn.setAttribute('aria-expanded', open ? 'true' : 'false');
          });
        });
      });
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => bind(document));
    } else {
      bind(document);
    }
  })();
