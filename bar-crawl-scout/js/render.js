"use strict";
/* ===== BOARD (database + rankings + draft sheet in one) ===== */
let sortKey="win",posFilter="ALL",poolOnly=true,hideDrafted=false,q="",lastDisplay=[];
let board={drafted:[],views:[]};
try{const v=localStorage.getItem("hq_board_v3");if(v)board=JSON.parse(v);}catch(e){}
if(!Array.isArray(board.views))board.views=[];if(!Array.isArray(board.drafted))board.drafted=[];
try{const old=localStorage.getItem("hq_board_v2");if(old&&!board._mig){const o=JSON.parse(old);if(o){if(Array.isArray(o.drafted)&&!board.drafted.length)board.drafted=o.drafted;if(Array.isArray(o.order)&&o.order.length&&!board.views.length)board.views.push({id:"v"+Date.now(),name:"My board",order:o.order});}board._mig=true;}}catch(e){}
function saveBoard(){try{localStorage.setItem("hq_board_v3",JSON.stringify(board));}catch(e){}}
if(!board.tags||typeof board.tags!=="object")board.tags={};
let viewSort=null,openTag=null,tagFilter="";
const TAGS=[{k:"star",l:"Superstar",c:"#f4b23e"},{k:"target",l:"Target",c:"#4fb286"},{k:"sleeper",l:"Sleeper",c:"#5aa0e0"},{k:"value",l:"Value",c:"#a98fd6"},{k:"injury",l:"Injury Prone",c:"#e0613f"},{k:"avoid",l:"Avoid",c:"#9a3618"}];
function tagsOf(name){return board.tags[name]||[];}
function toggleTag(name,k){const cur=board.tags[name]||[];const i=cur.indexOf(k);if(i>=0)cur.splice(i,1);else cur.push(k);if(cur.length)board.tags[name]=cur;else delete board.tags[name];saveBoard();}
function tagBadges(name){return tagsOf(name).map(k=>{const t=TAGS.find(x=>x.k===k);return t?'<span class="ptag" style="background:'+t.c+'22;color:'+t.c+'">'+esc(t.l)+'</span>':"";}).join("");}
function tagPicker(name){const has=tagsOf(name);return '<tr class="tagrow"><td></td><td colspan="9"><div class="tagpick"><span class="tglbl">Tags:</span>'+TAGS.map(t=>{const on=has.indexOf(t.k)>=0;return '<span class="tg'+(on?' on':'')+'" data-act="tagtoggle" data-n="'+esc(name)+'" data-k="'+t.k+'"'+(on?' style="background:'+t.c+'22;color:'+t.c+';border-color:'+t.c+'"':'')+'>'+esc(t.l)+'</span>';}).join("")+'</div></td></tr>';}
const TAGTXT={yr2:["t-riser","Riser"],asc:["t-riser","Asc"],prime:["t-prime","Prime"],aging:["t-winnow","Win-now"],fading:["t-winnow","Fade 27"],rookie:["t-rookie","Rookie"]};
const RYAN="Ryan";
function isRyanPlayer(name){const o=ownerOf(name);return !!o&&o.owner===RYAN;}
const RYANBLOCK='Cannot use Ryan\'s players for analysis.';
function statusCell(name){
  const k=ownerOf(name);
  if(k){if(k.owner===RYAN)return '<span class="badge b-u">&#128274; CLASSIFIED</span>';if(k.conf==="U")return '<span class="badge b-pool">POOL</span><span class="badge b-u">WATCH '+esc(k.owner)+'</span>';const cls=k.conf==="VL"?"b-vl":"b-l",lbl=k.conf==="VL"?"VERY LIKELY":"LIKELY";return '<span class="badge '+cls+'">'+lbl+'</span> <span class="pmeta">'+esc(k.owner)+' · '+(yearsLeft(name)===1?"final":"2yr")+'</span>';}
  const ro=rosterOwner(name);if(ro&&ro!==RYAN)return '<span class="badge b-pool">POOL</span> <span class="pmeta">on '+esc(ro)+'</span>';
  return '<span class="badge b-pool">POOL</span>';}
function draftable(){return PLAYERS.filter(p=>!isKept(p[1]));}
function viewById(id){return board.views.find(v=>v.id===id);}
function activeView(){return sortKey.indexOf("view:")===0?viewById(sortKey.slice(5)):null;}
function reconcileView(v){const names=PLAYERS.map(p=>p[1]);let ord=(v.order||[]).filter(n=>names.indexOf(n)>=0);PLAYERS.map(p=>({p,w:windowVal(p)})).sort((a,b)=>b.w-a.w).forEach(x=>{if(ord.indexOf(x.p[1])<0)ord.push(x.p[1]);});v.order=ord;return ord;}
function autoSorted(){const d=PLAYERS.filter(p=>{if(poolOnly&&!isAvailable(p[1]))return false;return true;});const dir={win:-1,r26:-1,r27:-1,p26:-1,p27:-1,adp:1}[sortKey]||-1;const val=p=>sortKey==="win"?windowVal(p):sortKey==="r26"?r26(p):sortKey==="r27"?r27(p):sortKey==="p26"?pts26(p):sortKey==="p27"?pts27(p):p[5];return d.slice().sort((a,b)=>{const va=val(a),vb=val(b);if(va<vb)return -1*dir;if(va>vb)return dir;return a[5]-b[5];});}
function renderBoard(){
  buildRosterOwn();
  let rows;const av=activeView();
  if(av){
    rows=reconcileView(av).map(n=>BYUNAME[n.toLowerCase()]).filter(Boolean);
    if(viewSort){const dir={r26:-1,r27:-1,p26:-1,p27:-1,adp:1,win:-1}[viewSort]||-1;const val=p=>viewSort==="win"?windowVal(p):viewSort==="r26"?r26(p):viewSort==="r27"?r27(p):viewSort==="p26"?pts26(p):viewSort==="p27"?pts27(p):p[5];rows=rows.slice().sort((a,b)=>{const va=val(a),vb=val(b);if(va<vb)return -1*dir;if(va>vb)return dir;return a[5]-b[5];});}
  }
  else rows=autoSorted();
  rows=rows.filter(p=>{if(poolOnly&&!isAvailable(p[1]))return false;if(posFilter==="FLEX"){if(["RB","WR","TE"].indexOf(p[2])<0)return false;}else if(posFilter!=="ALL"&&p[2]!==posFilter)return false;if(q&&p[1].toLowerCase().indexOf(q)<0)return false;if(tagFilter&&tagsOf(p[1]).indexOf(tagFilter)<0)return false;if(hideDrafted&&board.drafted.indexOf(p[1])>=0)return false;return true;});
  const canOrder=(!!av&&!viewSort&&!q);
  lastDisplay=rows.map(p=>p[1]);
  let prevW=null,html="";
  rows.forEach((p,i)=>{
    const dr=board.drafted.indexOf(p[1])>=0,w=windowVal(p),kept=!isAvailable(p[1]);
    let tier="";
    if(!av&&sortKey==="win"&&prevW!==null&&!dr&&(prevW-w)>=14)tier=" tierrow";
    if(!dr)prevW=w;
    const tag=TAGTXT[p[6]],tg=tag?'<span class="t-pill '+tag[0]+'">'+tag[1]+'</span>':"";
    const tm=p[3]==="FA"?"FA":p[3]+" · bye "+p[4];
    const arrows=canOrder?'<span class="ord"><button data-act="up" data-n="'+esc(p[1])+'" title="Move up">&#9650;</button><button data-act="top" data-n="'+esc(p[1])+'" title="Send to top">&#8673;</button><button data-act="dn" data-n="'+esc(p[1])+'" title="Move down">&#9660;</button></span>':"";
    const fin=isFinalYr(p[1])?'<span class="pmeta"> repl</span>':"";
    const actBtn=kept?'<span class="pmeta">kept</span>':'<button class="draftbtn '+(dr?'on':'')+'" data-act="draft" data-n="'+esc(p[1])+'">'+(dr?'✓ drafted':'draft')+'</button>';
    const tagBtn='<button class="tagbtn'+(tagsOf(p[1]).length?' has':'')+(openTag===p[1]?' open':'')+'" data-act="tag" data-n="'+esc(p[1])+'" title="Tag this player">&#9873;</button>';
    html+='<tr class="'+(dr?'drafted':'')+tier+(canOrder?' editing':'')+'"><td class="rk">'+arrows+'<span class="rknum">'+(i+1)+'</span></td>'+
      '<td><span class="pname">'+esc(p[1])+'</span> <span class="pmeta">'+p[2]+' · '+esc(tm)+'</span>'+tg+tagBadges(p[1])+'</td>'+
      '<td>'+statusCell(p[1])+'</td>'+
      '<td class="r26">'+r26(p)+'</td><td class="r27">'+r27(p)+fin+'</td>'+
      '<td class="pts">'+pts26(p)+'</td><td class="pts">'+(pts27(p)||"-")+'</td>'+
      '<td class="win">'+w+'</td><td class="adp">'+p[5]+'</td>'+
      '<td class="actcell">'+actBtn+' '+tagBtn+'</td></tr>';
    if(openTag===p[1])html+=tagPicker(p[1]);
  });
  $("#boardbody").innerHTML=html||'<tr><td colspan="10" class="pmeta" style="padding:18px">No players match.</td></tr>';
  if($("#editranks"))$("#editranks").hidden=!(av&&!canOrder);
  document.querySelectorAll("#boardtable th.sortable").forEach(th=>{const a=av?(viewSort?th.dataset.sort===viewSort:th.dataset.sort==="rank"):th.dataset.sort===sortKey;th.classList.toggle("activesort",a);});
}
$("#boardbody").addEventListener("click",e=>{const b=e.target.closest("button[data-act],[data-act]");if(!b)return;const n=b.dataset.n,act=b.dataset.act;
  if(act==="tag"){openTag=(openTag===n?null:n);renderBoard();return;}
  if(act==="tagtoggle"){toggleTag(n,b.dataset.k);renderBoard();return;}
  if(act==="draft"){const j=board.drafted.indexOf(n);if(j>=0)board.drafted.splice(j,1);else board.drafted.push(n);saveBoard();renderBoard();return;}
  const av=activeView();if(!av)return;const ord=av.order;const di=lastDisplay.indexOf(n);if(di<0)return;
  const moveBefore=tg=>{const i=ord.indexOf(n);if(i<0)return;ord.splice(i,1);let j=ord.indexOf(tg);if(j<0)j=0;ord.splice(j,0,n);};
  const moveAfter=tg=>{const i=ord.indexOf(n);if(i<0)return;ord.splice(i,1);let j=ord.indexOf(tg);if(j<0)j=ord.length-1;ord.splice(j+1,0,n);};
  if(act==="up"&&di>0)moveBefore(lastDisplay[di-1]);
  else if(act==="dn"&&di<lastDisplay.length-1)moveAfter(lastDisplay[di+1]);
  else if(act==="top"&&di>0)moveBefore(lastDisplay[0]);
  saveBoard();renderBoard();});
function renderSortOptions(){let h='<optgroup label="Default rankings"><option value="win">WIN (overall, mode)</option><option value="r26">2026 value</option><option value="r27">2027 value</option><option value="p26">2026 points</option><option value="p27">2027 points</option><option value="adp">ADP</option></optgroup>';if(board.views.length)h+='<optgroup label="My draft boards">'+board.views.map(v=>'<option value="view:'+v.id+'">'+esc(v.name)+'</option>').join("")+'</optgroup>';h+='<optgroup label="———"><option value="__new">+ Build a new draft board</option></optgroup>';$("#sortsel").innerHTML=h;$("#sortsel").value=sortKey;}
function updateViewBtns(){const av=activeView();$("#renameview").hidden=!av;$("#deleteview").hidden=!av;$("#boardreset").hidden=!av;$("#viewhint").innerHTML=av?(viewSort?('Sorted by <b>'+esc(({r26:"2026 value",r27:"2027 value",p26:"2026 points",p27:"2027 points",adp:"ADP",win:"WIN"})[viewSort]||viewSort)+'</b> for a look - your ranking is untouched. Hit <b>Back to my ranking</b> (or the <b>#</b> header) to edit again.'):('Editing <b>'+esc(av.name)+'</b> - use the arrows on the left to rank, it saves as you go. Defaults to the draft pool; flick off <b>In pool only</b> to see everyone. Sort by any column for a look, then <b>Back to my ranking</b> to edit.')):(board.views.length?'Pick one of your saved boards in the dropdown, or build a new one.':'Tip: choose <b>+ Build a new draft board</b> in the dropdown to make your own rankable, savable draft sheet for the day.');}
function currentSeed(){const av=activeView();if(av)return av.order.slice();return PLAYERS.map(p=>({p,w:windowVal(p)})).sort((a,b)=>b.w-a.w).map(x=>x.p[1]);}
function newView(){const name=prompt("Name your draft board (e.g. My targets):","Draft board "+(board.views.length+1));if(!name||!name.trim()){renderSortOptions();return;}const v={id:"v"+Date.now(),name:name.trim().slice(0,40),order:currentSeed()};board.views.push(v);saveBoard();sortKey="view:"+v.id;viewSort=null;openTag=null;renderSortOptions();updateViewBtns();renderBoard();}
$("#sortsel").addEventListener("change",e=>{const val=e.target.value;if(val==="__new"){newView();return;}sortKey=val;viewSort=null;openTag=null;renderSortOptions();updateViewBtns();renderBoard();});
document.querySelectorAll("#boardtable th.sortable").forEach(th=>th.addEventListener("click",()=>{const av=activeView();const s=th.dataset.sort;if(av){viewSort=(s==="rank")?null:s;updateViewBtns();renderBoard();return;}if(s==="rank")return;sortKey=s;renderSortOptions();updateViewBtns();renderBoard();}));
$("#renameview").addEventListener("click",()=>{const av=activeView();if(!av)return;const n=prompt("Rename this board:",av.name);if(n&&n.trim()){av.name=n.trim().slice(0,40);saveBoard();renderSortOptions();updateViewBtns();}});
$("#deleteview").addEventListener("click",()=>{const av=activeView();if(!av)return;if(confirm('Delete the board "'+av.name+'"? Your drafted marks stay.')){board.views=board.views.filter(v=>v.id!==av.id);saveBoard();sortKey="win";renderSortOptions();updateViewBtns();renderBoard();}});
document.querySelectorAll("#poschips .chip").forEach(c=>c.addEventListener("click",()=>{document.querySelectorAll("#poschips .chip").forEach(x=>x.classList.remove("on"));c.classList.add("on");posFilter=c.dataset.pos;renderBoard();}));
$("#poolchip").addEventListener("click",()=>{poolOnly=!poolOnly;$("#poolchip").classList.toggle("on",poolOnly);renderBoard();});
$("#hidechip").addEventListener("click",()=>{hideDrafted=!hideDrafted;$("#hidechip").classList.toggle("on",hideDrafted);renderBoard();});
$("#psearch").addEventListener("input",e=>{q=e.target.value.toLowerCase().trim();renderBoard();});
$("#tagfilter").addEventListener("change",e=>{tagFilter=e.target.value;renderBoard();});
$("#editranks").addEventListener("click",()=>{viewSort=null;q="";$("#psearch").value="";tagFilter="";$("#tagfilter").value="";posFilter="ALL";document.querySelectorAll("#poschips .chip").forEach(c=>c.classList.toggle("on",c.dataset.pos==="ALL"));poolOnly=true;$("#poolchip").classList.add("on");$("#poolchip").dataset.on="1";updateViewBtns();renderBoard();});
$("#boardreset").addEventListener("click",()=>{const av=activeView();if(!av)return;if(confirm('Reset "'+av.name+'" back to the WIN order? Drafted marks and tags stay.')){av.order=PLAYERS.map(p=>({p,w:windowVal(p)})).sort((a,b)=>b.w-a.w).map(x=>x.p[1]);viewSort=null;saveBoard();renderBoard();}});

/* ===== KEEPERS EDITOR ===== */
function ylabel(name){return name?(yearsLeft(name)===1?'<span style="color:#e0613f">final yr</span>':'<span style="color:#4fb286">2 yr</span>'):"";}
function renderEditor(){
  $("#kedbody").innerHTML=TEAMS.map(t=>{
    if(t[0]===RYAN)return '<div class="ked"><div class="kt">'+esc(t[1])+' <span>@'+esc(t[0])+'</span></div><div class="out" style="margin-top:4px">&#128274; <b>CLASSIFIED.</b> Nice try. The commissioner\'s keepers are sealed. Go scout someone you can actually beat.</div></div>';
    const arr=KS[t[0]];
    const ks=[0,1,2].map(i=>{const s=arr[i]||["",""];return '<div class="kslot"><input list="plist" data-team="'+t[0]+'" data-slot="'+i+'" value="'+esc(s[0]||"")+'" placeholder="keeper '+(i+1)+'"><span class="cpill '+(s[1]||"L")+'" data-team="'+t[0]+'" data-slot="'+i+'">'+(s[1]||"L")+'</span><button class="kclr" data-team="'+t[0]+'" data-slot="'+i+'">&times;</button></div><div class="pmeta" style="margin:-1px 0 6px 2px">'+ylabel(s[0])+'</div>';}).join("");
    const u=arr[3]||["",""];
    const unl='<div class="ksub">Unlikely / watch (stays in pool)</div><div class="kslot unl"><input list="plist" data-team="'+t[0]+'" data-slot="3" value="'+esc(u[0]||"")+'" placeholder="could-be-kept"><span class="cpill U">U</span><button class="kclr" data-team="'+t[0]+'" data-slot="3">&times;</button></div>';
    return '<div class="ked"><div class="kt">'+esc(t[1])+' <span>@'+esc(t[0])+'</span></div>'+ks+unl+'</div>';
  }).join("");
}
function setSlot(team,slot,name){if(!KS[team])KS[team]=[["",""],["",""],["",""],["",""]];const conf=slot===3?"U":((KS[team][slot]&&KS[team][slot][1]&&KS[team][slot][1]!=="U")?KS[team][slot][1]:"L");KS[team][slot]=[name,conf];saveKS();renderAll();}
document.addEventListener("change",e=>{if(e.target.matches("#kedbody input[data-team]")){const t=e.target.dataset.team,s=+e.target.dataset.slot;let v=e.target.value.trim();const m=BYUNAME[v.toLowerCase()];if(m)v=m[1];e.target.value=v;setSlot(t,s,v);}});
document.addEventListener("click",e=>{
  if(e.target.matches("#kedbody .cpill.VL, #kedbody .cpill.L")){const t=e.target.dataset.team,s=+e.target.dataset.slot;if(s==null||!KS[t]||!KS[t][s]||!KS[t][s][0])return;const nc=(KS[t][s][1]==="L")?"VL":"L";KS[t][s][1]=nc;e.target.className="cpill "+nc;e.target.textContent=nc;saveKS();renderBoard();renderMgrs();renderPlan();fillTradeSelects();}
  if(e.target.matches("#kedbody .kclr")){const t=e.target.dataset.team,s=+e.target.dataset.slot;setSlot(t,s,"");renderEditor();}
});
$("#kreset").addEventListener("click",()=>{if(confirm("Reset all keepers to the audited projections?")){KS=JSON.parse(JSON.stringify(PROJ));for(const t of TEAMS){while(KS[t[0]].length<4)KS[t[0]].push(["",""]);}saveKS();renderEditor();renderAll();}});

/* ===== MANAGERS ===== */
function nbar(v){const col=v>=7?"#9a3618":v>=4?"#b6791f":"#2f7d57";return '<span class="nbar"><i style="width:'+(v*10)+'%;background:'+col+'"></i></span> '+v;}
function renderMgrs(){
  $("#mgrbody").innerHTML=MGRS.map(m=>{
    const tm=TEAMS.find(t=>t[0]===m.h),tName=tm?tm[1]:m.h;
    if(m.h===RYAN)return '<div class="mgr"><div class="h"><div><div class="tm">'+esc(tName)+'</div><div class="wh">@'+esc(m.h)+'</div></div><div class="rec">'+m.rec+'<small>'+esc(m.pf)+'</small></div></div><div class="mtags"><span class="mtag">&#128274; Redacted</span><span class="mtag">Commissioner</span></div><div class="mrow tend"><b>Dossier:</b> CLASSIFIED. This file was redacted by the commissioner. All we can confirm: he went '+m.rec+', he absolutely did not leave 200-plus points on his bench, and he is definitely not reading your trade offers right now.</div><div class="mrow"><b>Current roster:</b> <span class="pmeta">CLASSIFIED here (it is public on Sleeper if you really must look)</span></div><div class="mrow"><b>Projected keepers:</b> &#9608;&#9608;&#9608;&#9608;&#9608;, &#9608;&#9608;&#9608;&#9608;, &#9608;&#9608;&#9608;&#9608;&#9608;&#9608;</div><div class="mrow">Tip: if you have to ask what he is keeping, you have already lost the trade.</div></div>';
    const tags=m.tags.map(t=>'<span class="mtag">'+esc(t)+'</span>').join("");
    const all=KS[m.h]||[];const ks=[0,1,2].map(i=>all[i]).filter(s=>s&&s[0]);
    const u=all[3]&&all[3][0]?all[3][0]:null;
    const keeps=ks.length?ks.map(s=>'<span class="keep">'+esc(s[0])+' <span class="'+(yearsLeft(s[0])===1?"y1":"y2")+'">'+(yearsLeft(s[0])===1?"1yr":"2yr")+'</span> '+s[1]+'</span>').join(""):'<span style="color:#8a7f5e">none set</span>';
    const c=CAPITAL[m.h]||[0,0,0],ct=chestTag(m.h);
    const cap='<div class="capline"><span class="capchip">2026 picks: <b>'+c[0]+'</b> 1st · <b>'+c[1]+'</b> 2nd · <b>'+c[2]+'</b> 3rd</span><span class="chesttag ct-'+ct+'">'+ct+'</span></div>';
    const nd=needScores(m.h);
    const needs='<div class="needgrid"><span class="needpill">RB '+nbar(nd.RB)+'</span><span class="needpill">WR '+nbar(nd.WR)+'</span><span class="needpill">TE '+nbar(nd.TE)+'</span><span class="needpill">QB '+nbar(nd.QB)+'</span></div>';
    const DH=draftData(),db=DH&&DH.byManager?DH.byManager[m.h]:null;
    let likes;
    if(db){
      const pos=db.pos||{};const order=Object.keys(pos).sort((a,c)=>pos[c]-pos[a]);
      const posStr=order.length?order.map(k=>k+" "+pos[k]).join(" · "):"no picks found";
      const rep=(db.repeat||[]);
      const repStr=rep.length?rep.map(esc).join(", "):'<span class="pmeta">none - no player drafted in both years</span>';
      likes='<div class="mrow"><b>Drafted both 24 and 25 (true affinity):</b> '+repStr+'</div>'+
            '<div class="mrow" style="border-top:none;padding-top:4px"><b>Real draft mix (24-25):</b> <span class="pmeta">'+posStr+'</span></div>';
    } else {
      likes='<div class="mrow"><b>Draft history:</b> <span class="pmeta">tap Sync in a browser to load real 2024 and 2025 picks</span></div>';
    }
    const RD=rosterData(),rd=RD&&RD.byHandle?RD.byHandle[m.h]:null;
    let rosterBlock;
    if(rd&&rd.players&&rd.players.length){
      const ord={QB:0,RB:1,WR:2,TE:3,K:4,DEF:5,DL:6,DE:6,DT:6,NT:6,LB:7,OLB:7,ILB:7,MLB:7,DB:8,CB:8,S:8,SS:8,FS:8,SAF:8},byPos={};
      rd.players.forEach(pl=>{(byPos[pl.p||"-"]=byPos[pl.p||"-"]||[]).push(pl);});
      const keys=Object.keys(byPos).sort((a,b)=>(ord[a]==null?9:ord[a])-(ord[b]==null?9:ord[b]));
      const lines=keys.map(k=>'<div class="rosrow"><span class="rospos">'+esc(k)+'</span> '+byPos[k].map(pl=>'<span class="rosp'+(pl.s?" st":"")+'">'+esc(pl.n)+'</span>').join(", ")+'</div>').join("");
      rosterBlock='<div class="mrow"><b>Current roster (live, '+rd.players.length+' players):</b><div class="roster">'+lines+'</div><span class="pmeta">Bold = starter. As of last sync.</span></div>';
    } else if(rd){
      rosterBlock='<div class="mrow"><b>Current roster:</b> <span class="pmeta">no players rostered yet (synced - rosters fill in after the draft)</span></div>';
    } else {
      rosterBlock='<div class="mrow"><b>Current roster:</b> <span class="pmeta">tap Sync (button up top) to load live rosters from Sleeper</span></div>';
    }
    const uline=u?'<div class="mrow" style="border-top:none;padding-top:4px"><b>Watch:</b> <span class="keep">'+esc(u)+' unlikely</span></div>':"";
    return '<div class="mgr"><div class="h"><div><div class="tm">'+esc(tName)+'</div><div class="wh">@'+esc(m.h)+'</div></div><div class="rec">'+m.rec+'<small>'+esc(m.pf)+'</small></div></div>'+
      '<div class="mtags">'+tags+'</div>'+rosterBlock+'<div class="mrow tend"><b>Drafts:</b> '+esc(m.tend)+'</div>'+cap+
      '<div class="mrow"><b>Needs after keepers:</b>'+needs+'</div><div class="mrow"><b>Projected keepers:</b><br>'+keeps+'</div>'+uline+likes+
      '<div class="mrow">'+esc(m.note)+'</div></div>';
  }).join("");
}

/* ===== TRADE BUILDER (consolidation-aware) ===== */
let give=[],get=[];
function poolValsSorted(){return draftable().map(p=>windowVal(p)).sort((a,b)=>b-a);}
function pickValue(season,round){const pv=poolValsSorted();const slot=(round-1)*10+4;let base=pv[Math.min(slot,pv.length-1)]||0;if(String(season)==="2027")base=Math.round(base*0.6);return Math.round(base);}
function fillTradeSelects(){
  const popts='<option value="">- player -</option>'+PLAYERS.slice().sort((a,b)=>windowVal(b)-windowVal(a)).map(p=>'<option value="'+esc(p[1])+'">'+esc(p[1])+' ('+p[2]+', '+windowVal(p)+')</option>').join("");
  $("#gp").innerHTML=popts;$("#tp").innerHTML=popts;
  let kopts='<option value="">- pick -</option>';for(const yr of["2026","2027"])for(const rd in PICKVAL[yr])kopts+='<option value="'+yr+':'+rd+'">'+yr+' R'+rd+' (~'+pickValue(yr,+rd)+')</option>';
  $("#gk").innerHTML=kopts;$("#tk").innerHTML=kopts;
}
function assetVal(a){if(a.kind==="p"){const p=BYUNAME[a.key.toLowerCase()];return p?windowVal(p):0;}const sp=a.key.split(":");return pickValue(sp[0],+sp[1]);}
function assetLabel(a){if(a.kind==="p")return a.key;const sp=a.key.split(":");return sp[0]+" R"+sp[1];}
function assetPos(a){if(a.kind==="p"){const p=BYUNAME[a.key.toLowerCase()];return p?p[2]:"";}return "PICK";}
function prem(v){return v>=180?1.18:v>=150?1.12:v>=120?1.06:1.0;}
function sideEval(arr){const vals=arr.map(assetVal).sort((a,b)=>b-a);if(!vals.length)return{raw:0,eff:0,top:0,count:0};let eff=vals[0]*prem(vals[0]);for(let i=1;i<vals.length;i++)eff+=vals[i]*0.45;return{raw:vals.reduce((s,v)=>s+v,0),eff:Math.round(eff),top:vals[0],count:vals.length};}
function renderTrade(){
  const draw=(arr,el)=>{$(el).innerHTML=arr.map((a,i)=>'<span class="asset"><b>'+assetVal(a)+'</b> '+esc(assetLabel(a))+' <span data-rm="'+i+'" data-side="'+(el==="#givelist"?"give":"get")+'">×</span></span>').join("");};
  draw(give,"#givelist");draw(get,"#getlist");
  const G=sideEval(give),T=sideEval(get);
  $("#givetot").innerHTML=give.length?'raw '+G.raw+' · effective <b>'+G.eff+'</b>':"";
  $("#gettot").innerHTML=get.length?'raw '+T.raw+' · effective <b>'+T.eff+'</b>':"";
  return{G,T};
}
document.querySelectorAll("#trade .add").forEach(b=>b.addEventListener("click",()=>{const side=b.dataset.side,kind=b.dataset.kind;const sel=$(side==="give"?(kind==="p"?"#gp":"#gk"):(kind==="p"?"#tp":"#tk"));if(!sel.value)return;(side==="give"?give:get).push({kind,key:sel.value});sel.value="";renderTrade();}));
$("#givelist").addEventListener("click",e=>{if(e.target.dataset.rm!=null){give.splice(+e.target.dataset.rm,1);renderTrade();}});
$("#getlist").addEventListener("click",e=>{if(e.target.dataset.rm!=null){get.splice(+e.target.dataset.rm,1);renderTrade();}});
$("#tgo").addEventListener("click",()=>{
  const ryanHit=[...give,...get].some(a=>a.kind==="p"&&isRyanPlayer(a.key));
  if(ryanHit){$("#tout").innerHTML='<div class="out"><div class="big bd">Access denied</div>'+RYANBLOCK+' &#128274; The commissioner does not negotiate through your little calculator. Build a deal that does not touch his roster.</div>';return;}
  const {G,T}=renderTrade();if(!give.length&&!get.length){$("#tout").innerHTML='<div class="out">Add assets to each side.</div>';return;}
  const diff=T.eff-G.eff;let head,cls;
  if(Math.abs(diff)<=8){head="Fair deal";cls="";}
  else if(diff>0){head="You win this by "+diff;cls="gd";}
  else{head="You lose this by "+Math.abs(diff);cls="bd";}
  // swing piece
  const all=[...give.map(a=>({a,side:"give"})),...get.map(a=>({a,side:"get"}))];
  let swing=all[0];all.forEach(x=>{if(assetVal(x.a)>assetVal(swing.a))swing=x;});
  const lines=[];
  lines.push('<b>Why:</b> this is not 50 + 50 = 100. Each side is scored as the best asset at full value plus a scarcity premium, with every extra piece worth only 45% (you start a fixed lineup, so depth is replaceable).');
  if(swing)lines.push('The swing piece is <span class="wk">'+esc(assetLabel(swing.a))+'</span> (value '+assetVal(swing.a)+'), the most valuable single asset in the deal. Whoever ends with the best player usually wins the trade.');
  if(get.length&&give.length){
    if(T.top>G.top&&get.length<=give.length)lines.push('<span class="gd">You consolidate up</span> into a bigger single asset ('+T.top+' vs '+G.top+'). Good player plus good pick for one great player is a win, because one stud beats two mediums in a starting lineup.');
    else if(G.top>T.top&&give.length<get.length)lines.push('<span class="bd">You de-consolidate</span>, turning your best asset ('+G.top+') into several smaller ones ('+T.top+' top). Only do this if you are deep and desperate for bodies.');
  }
  lines.push('Window mode <b>'+MODE+'</b>: '+(MODE==="winnow"?"final-year studs are valued for 2026 only, so buying a one-year stud for a push is cheaper here than it looks.":MODE==="balanced"?"two-year control is rewarded equally across both seasons.":"future picks and young players are weighted up."));
  $("#tout").innerHTML='<div class="out"><div class="big '+cls+'">'+head+'</div>You give effective <b>'+G.eff+'</b> ('+give.length+' assets), you get effective <b>'+T.eff+'</b> ('+get.length+' assets).<br><br>'+lines.map(l=>"• "+l).join("<br><br>")+'</div>';
});

/* ===== FAAB & INTEREST ===== */
$("#fgo").addEventListener("click",()=>{
  const raw=$("#fnm").value.trim();if(!raw){$("#fnm").focus();return;}
  const p=BYUNAME[raw.toLowerCase()];const pos=p?p[2]:"RB",stage=p?(p[6]||"prime"):"prime",nm=p?p[1]:raw;
  if(isRyanPlayer(nm)){$("#fout").innerHTML='<div class="out"><div class="big bd">Access denied</div>'+RYANBLOCK+' &#128274; That one is on the commissioner\'s roster. He is not putting him on waivers, so stop dreaming.</div>';return;}
  const list=TEAMS.map(t=>t[0]).filter(h=>h!=="Ryan").map(h=>{
    const need=(needScores(h)[pos]||0)/10*2.5;const lean=((LEAN[h]||{})[pos]||0);
    const stageFit=REBUILD.has(h)?(["rookie","yr2","asc"].indexOf(stage)>=0?1:(["aging","fading"].indexOf(stage)>=0?-1.5:0)):(CONTEND.has(h)?(["prime","aging","asc"].indexOf(stage)>=0?1:0):0);
    const drafted=draftedByName(nm).some(e=>e[0]===h)?1.5:0;
    return {h,s:aggrOf(h)+need+lean+stageFit+drafted,drafted:drafted>0};
  }).sort((a,b)=>b.s-a.s);
  const lvl=s=>s>=5.5?["SEVERE","#e0613f"]:s>=4?["HIGH","#f4b23e"]:s>=2.5?["MED","#5aa0e0"]:["LOW","#4fb286"];
  const rows=list.map(x=>{const L=lvl(x.s),w=Math.max(6,Math.min(100,x.s/8*100));return '<div class="threat"><span style="min-width:170px">'+esc(TEAMSHORT[x.h])+(x.drafted?' <span style="color:var(--accent)">★</span>':'')+'</span><span class="tmeter"><i style="width:'+w+'%;background:'+L[1]+'"></i></span><span class="tlbl" style="color:'+L[1]+'">'+L[0]+'</span></div>';}).join("");
  const tal=faabTalent(p);
  const demand=list[0]?list[0].s:0;const contested=demand>=4.5||list.filter(x=>x.s>=4).length>=2;
  let lo=makeOdd(tal*0.55),hi=makeOdd(tal*(contested?0.98:0.78));if(hi>99)hi=99;if(lo>hi)lo=hi;
  const tg=tal>=85?["LEAGUE-WINNER","pay up, this is a roster-changer"]:tal>=62?["STRONG STARTER","a real add, bid like it"]:tal>=42?["USEFUL PIECE","moderate bid, do not overspend"]:["DEPTH","keep it cheap, save budget for later"];
  const fans=draftedByName(nm).map(e=>TEAMSHORT[e[0]]+" ("+e[1]+")");
  const unk=p?"":'<br><br><span class="bd">Note:</span> '+esc(nm)+' is not in the top-200 value board, so the talent number is a rough default. Trust the competition and need read below more than the bid here, and treat it as a depth add.';
  const top2=list.slice(0,2).map(x=>esc(TEAMSHORT[x.h])).join(" and ");
  const aggLine=FAAB_SYNCED?("Synced spending over "+FAAB_WEEKS+" weeks: "+list.slice(0,3).map(x=>esc(TEAMSHORT[x.h])+" median $"+((FAAB_SYNCED[x.h]&&FAAB_SYNCED[x.h].median)||0)+(FAAB_SYNCED[x.h]?", max $"+FAAB_SYNCED[x.h].max:"")).join("; ")+"."):"Aggression from a week-1 sample. Tap Sync in a browser for real medians.";
  $("#fout").innerHTML='<div class="out"><div class="big">'+esc(nm)+' · '+pos+' · '+stage+'</div><b>'+tg[0]+'</b> ('+tal+'/100 talent). Suggested bid: <span class="wk">$'+lo+' to $'+hi+'</span> of $100, '+tg[1]+'.'+unk+'<br>'+(contested?'Contested: '+top2+' also want him, so bid near the top ($'+hi+') to be safe.':'Lightly contested, the low end likely wins.')+(fans.length?'<br><br><b>Has drafted him before:</b> '+fans.join(", ")+'.':'')+'<br><br>Threat order (★ = drafted him before):<div style="margin-top:9px">'+rows+'</div><div style="margin-top:9px;color:var(--muted)">Bid is driven by player value first (talent to percent of budget: a league-winner commands 80 to 100%, a useful starter 35 to 55%, depth 5 to 15%, per FAAB guides), then nudged by competition and need. Odd numbers win the dollar tiebreak. '+aggLine+'</div></div>';
});

/* ===== INTEL ===== */
function renderPlan(){
  const pool=PLAYERS.filter(p=>isAvailable(p[1]));
  const byval=pool.map(p=>({p,w:windowVal(p)})).sort((a,b)=>b.w-a.w).slice(0,16);
  const chest=TEAMS.filter(t=>t[0]!==RYAN).map(t=>({h:t[0],w:warchest(t[0]),tag:chestTag(t[0])})).sort((a,b)=>b.w-a.w);
  let h='<div class="note">League intel: who owns the early picks, who is loaded, the best players left in the pool, and how each manager drafts. Re-sorts with window mode (<b>'+MODE+'</b>). One file stays sealed, do not bother looking.</div>';
  h+='<h3 class="sec">2026 first round (real owners)</h3>';
  h+=FIRSTROUND.map((f,i)=>'<div class="pickrow">1.'+(i+1<10?"0"+(i+1):"10")+' <b>'+(f[0]===RYAN?"&#128274; Classified":esc(TEAMSHORT[f[0]]))+'</b>'+(f[1]&&f[0]!==RYAN?' <span style="color:var(--chalk)">('+f[1]+')</span>':'')+'</div>').join("");
  h+='<h3 class="sec">War chest ranking</h3>';
  h+=chest.map((c,i)=>'<div class="pickrow"><b>'+(i+1)+'.</b> '+esc(TEAMSHORT[c.h])+' <span class="chesttag ct-'+c.tag+'">'+c.tag+'</span> <span style="color:var(--muted)">score '+c.w+'</span></div>').join("");
  h+='<h3 class="sec">Best available now (WIN, '+MODE+')</h3>';
  h+=byval.map((x,i)=>'<div class="pickrow"><b>'+(i+1)+'.</b> '+esc(x.p[1])+' <span style="color:var(--chalk)">'+x.p[2]+'</span> · win '+x.w+' · ADP '+x.p[5]+'</div>').join("");
  h+='<h3 class="sec">How the room drafts</h3><p class="plan"><b>jduddy</b> clears the RB tier fast. <b>jpdonners and JohnnyDuff</b> lean on quarterbacks. <b>joshleota and Winz</b> are win-now contenders who spend on premium names. <b>Imy and Shayden</b> are loaded rebuilders sitting on the most capital. <b>ATorelli</b> is a balanced accumulator and a known bluffer on his stated keepers. Tap <b>Sync</b> in a browser to load each manager\'s real 2024 and 2025 draft mix. Full dossiers in the Managers tab.</p>';
  $("#planbody").innerHTML=h;
}
