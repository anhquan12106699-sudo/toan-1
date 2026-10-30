/* Tự tạm dừng video CTĐT khi người dùng chuyển sang tab/trang khác */
(function(){
  function pauseHidden(){
    document.querySelectorAll('.ctdt-hero-visual.is-video iframe').forEach(function(f){
      if (f.offsetParent === null && f.contentWindow){
        try{ f.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}','*'); }catch(e){}
      }
    });
  }
  if (window.MutationObserver) new MutationObserver(pauseHidden).observe(document.body,{attributes:true,attributeFilter:['class']});
  window.addEventListener('hashchange',pauseHidden);
})();
