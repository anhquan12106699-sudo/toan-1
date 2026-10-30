(function(){
  var root=document.getElementById('lich-su'); if(!root) return;
  var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion:reduce)').matches;
  /* đếm số ở khối KPI */
  var kb=[].slice.call(root.querySelectorAll('.lsx-kpi b')).filter(function(b){return +b.textContent<1000});
  var done=false;
  function count(){
    if(done) return; var r=root.querySelector('.lsx-intro').getBoundingClientRect();
    if(r.top>innerHeight*.9||r.bottom<0) return; done=true;
    kb.forEach(function(b){var to=+b.textContent,t0=null; if(reduce) return;
      (function step(t){t0=t0||t;var p=Math.min(1,(t-t0)/1100),e=1-Math.pow(1-p,3);b.textContent=Math.round(to*e);if(p<1)requestAnimationFrame(step);else b.textContent=to;})(performance.now());});
  }
  /* điểm sao cuối timeline */
  var end=document.getElementById('lsxEnd');
  function endCap(){ if(end) end.classList.toggle('on', end.getBoundingClientRect().top<innerHeight*.85); }
  function tick(){count();endCap();}
  addEventListener('scroll',tick,{passive:true});addEventListener('resize',tick);
  document.addEventListener('click',function(e){ if(e.target.closest('[data-tab],[data-scroll]')) setTimeout(tick,400); });
  tick();setTimeout(tick,400);
  /* video tư liệu: dán ID YouTube vào data-yt của nút .lsx-media */
  var btn=root.querySelector('.lsx-media'),m=document.getElementById('lsxModal'),f=m.querySelector('iframe');
  function close(){m.classList.remove('open');f.src='about:blank';}
  btn.addEventListener('click',function(){var id=(btn.getAttribute('data-yt')||'').trim(); if(!id) return;
    f.src='https://www.youtube.com/embed/'+encodeURIComponent(id)+'?autoplay=1&rel=0'; m.classList.add('open');});
  m.addEventListener('click',function(e){if(e.target===m||e.target.classList.contains('lsx-x'))close();});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&m.classList.contains('open'))close();});
})();
