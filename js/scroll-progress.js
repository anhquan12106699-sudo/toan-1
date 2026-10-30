(function(){
  var root=document.getElementById('lich-su'); if(!root) return;
  var tl=document.getElementById('lsxTl'), fill=document.getElementById('lsxFill'),
      items=[].slice.call(root.querySelectorAll('.lsx-item')), ticking=false;
  function update(){
    ticking=false;
    var r=tl.getBoundingClientRect(), vh=window.innerHeight, mark=vh*.6;
    var p=Math.max(0,Math.min(1,(mark-r.top)/r.height));
    fill.style.height=(p*100)+'%';
    items.forEach(function(it){
      var n=it.querySelector('.lsx-node').getBoundingClientRect();
      it.classList.toggle('on', n.top+n.height/2 < vh*.78);
    });
  }
  function req(){ if(!ticking){ ticking=true; requestAnimationFrame(update); } }
  window.addEventListener('scroll',req,{passive:true});
  window.addEventListener('resize',req);
  document.addEventListener('click',function(e){ if(e.target.closest('[data-tab],[data-scroll]')) setTimeout(req,350); });
  update(); setTimeout(update,300);
})();
