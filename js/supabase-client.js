/* Client Supabase (PostgREST) tối giản, không cần tải thư viện supabase-js ~120KB từ CDN.
   Bắt đầu tải bài viết NGAY khi trình duyệt đọc tới đây, song song với việc tải/phân tích phần còn lại của trang. */
(function(){
  var SB_URL="https://dawnjnljkferinamktiq.supabase.co";
  var SB_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhd25qbmxqa2ZlcmluYW1rdGlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0MjY5NjgsImV4cCI6MjEwNDAwMjk2OH0.gWZoU3nLm4otno3eUDj9N_iRNyEPipobOm5fkOlHYao";
  var ARTICLE_COLS="id,created_at,category,title,badge,content,detail,doc_url,word_name,word_type";
  var FEED_COLS="id,created_at,category,title,badge,content,doc_url,word_name";
  function quote(v){ v=String(v); return /[,()"\s]/.test(v) ? '"'+v.replace(/"/g,'\\"')+'"' : v; }
  function create(url,key){
    function from(table){
      var cols="*", params=[], cache=null;
      function run(){
        if(!cache){
          var qs="select="+encodeURIComponent(cols);
          params.forEach(function(p){ qs+="&"+encodeURIComponent(p[0])+"="+encodeURIComponent(p[1]); });
          cache=fetch(url+"/rest/v1/"+table+"?"+qs,{headers:{apikey:key,Authorization:"Bearer "+key}})
            .then(function(r){
              return r.json().catch(function(){return null;}).then(function(j){
                return r.ok ? {data:j,error:null} : {data:null,error:j||{message:"HTTP "+r.status}};
              });
            })
            .catch(function(e){ return {data:null,error:e}; });
        }
        return cache;
      }
      var b={
        select:function(c){ cols=c||"*"; return b; },
        eq:function(c,v){ params.push([c,"eq."+v]); return b; },
        in:function(c,arr){ params.push([c,"in.("+arr.map(quote).join(",")+")"]); return b; },
        order:function(c,o){ params.push(["order",c+((o&&o.ascending===false)?".desc":".asc")]); return b; },
        limit:function(n){ params.push(["limit",String(n)]); return b; },
        then:function(a,r){ return run().then(a,r); },
        "catch":function(r){ return run().catch(r); }
      };
      return b;
    }
    return {from:from};
  }
  window.__sbCreate=create;
  var early=window.__sbEarly={article:null,feed:null};
  var client=create(SB_URL,SB_KEY);
  var pid=new URLSearchParams(location.search).get("post");
  function feedQuery(){ return client.from("posts").select(FEED_COLS).order("created_at",{ascending:false}).limit(120); }
  if(pid){
    early.article=Promise.resolve(client.from("posts").select(ARTICLE_COLS).eq("id",pid).limit(1));
    // danh sách tin cùng chuyên mục chỉ bắt đầu tải sau khi bài đã về (nhường băng thông cho bài)
    early.feed=early.article.then(feedQuery,feedQuery);
  } else { early.feed=Promise.resolve(feedQuery()); }
  // DOMPurify: báo khi đã sẵn sàng để không hiển thị bài khi chưa lọc HTML
  window.__purifyP=new Promise(function(r){ window.__purifyDone=r; setTimeout(r,4000); });
})();
