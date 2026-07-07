"use strict";
/* ===== SYNC + BACKUP ===== */
async function jget(u){const r=await fetch(u);if(!r.ok)throw new Error(u+" -> "+r.status);return r.json();}
async function runSync(out){out.innerHTML='<div class="out">Syncing from Sleeper... pulling the league, drafts and 17 weeks of transactions, this takes a few seconds.</div>';
  try{const league=await jget("https://api.sleeper.app/v1/league/"+LG2026);const users=await jget("https://api.sleeper.app/v1/league/"+LG2026+"/users");const rosters=await jget("https://api.sleeper.app/v1/league/"+LG2026+"/rosters");const tp=await jget("https://api.sleeper.app/v1/league/"+LG2026+"/traded_picks");
    let rid2name=Object.assign({},ROSTER2025);
    try{const u25=await jget("https://api.sleeper.app/v1/league/"+LG2025+"/users");const r25=await jget("https://api.sleeper.app/v1/league/"+LG2025+"/rosters");
      if(Array.isArray(r25)&&r25.length){const byId={};u25.forEach(u=>byId[u.user_id]=(u.display_name||u.user_id));const norm=dn=>{const l=String(dn).toLowerCase();if(l.indexOf("wither")>=0)return "Ryan";const hit=TEAMS.find(t=>t[0].toLowerCase()===l);return hit?hit[0]:dn;};const m={};r25.forEach(r=>{m[r.roster_id]=norm(byId[r.owner_id]||"");});rid2name=m;}}catch(e){}
    const weeks=[];for(let w=1;w<=17;w++){try{weeks.push(await jget("https://api.sleeper.app/v1/league/"+LG2025+"/transactions/"+w));}catch(e){}}
    const fa=computeFaab(weeks,rid2name);const nbids=Object.values(fa).reduce((s,x)=>s+x.count,0);
    FAAB_SYNCED=fa;FAAB_WEEKS=weeks.length;
    const ts=new Date().toLocaleString();
    try{localStorage.setItem("hq_faab_v1",JSON.stringify({byManager:fa,weeks:weeks.length,ts}));localStorage.setItem("hq_last_sync",ts);}catch(e){}
    setFresh();if($("#faabnote"))$("#faabnote").textContent="FAAB: "+weeks.length+" weeks synced ("+nbids+" bids)";
    // shared user_id -> handle map
    const cleanh=x=>String(x||"").toLowerCase().replace(/[^a-z0-9]/g,"");
    const norm=dn=>{const l=cleanh(dn);if(l.indexOf("wither")>=0)return "Ryan";const hit=TEAMS.find(t=>cleanh(t[0])===l);return hit?hit[0]:dn;};
    const umap={};users.forEach(u=>umap[u.user_id]=norm(u.display_name||u.user_id));
    // ===== LIVE ROSTERS: pull Sleeper player dictionary (cached 24h) then map each roster to its manager =====
    let rosterSummary="";
    try{
      out.innerHTML='<div class="out">Syncing... loading live rosters and the Sleeper player list (large first time, cached after).</div>';
      let fresh=false;try{const pm=localStorage.getItem("hq_players_v2");if(pm){const o=JSON.parse(pm);if(o&&o.map&&(Date.now()-(o.t||0)<86400000)){PLAYERMAP=o.map;fresh=true;}}}catch(e){}
      if(!PLAYERMAP||!fresh){const all=await jget("https://api.sleeper.app/v1/players/nfl");const map={};for(const id in all){const v=all[id];if(!v)continue;const nm=v.full_name||((v.first_name||"")+" "+(v.last_name||"")).trim()||v.last_name||"";if(!nm)continue;map[id]=[nm,v.position||"",v.team||"FA"];}PLAYERMAP=map;try{localStorage.setItem("hq_players_v2",JSON.stringify({t:Date.now(),map}));}catch(e){}}
      const byHandle={};let totalP=0;const unmatched=[];
      if(Array.isArray(rosters)){rosters.forEach(r=>{const handle=umap[r.owner_id];if(!handle||!TEAMS.some(t=>t[0]===handle)){if(handle&&unmatched.indexOf(handle)<0)unmatched.push(handle);return;}const ids=r.players||[],starters=new Set(r.starters||[]);const players=ids.map(id=>{const e=PLAYERMAP[id];return e?{n:e[0],p:e[1],t:e[2],s:starters.has(id)}:{n:String(id),p:"",t:"",s:starters.has(id)};});byHandle[handle]={players,count:ids.length};totalP+=ids.length;});}
      try{localStorage.setItem("hq_rosters_v2",JSON.stringify({t:ts,byHandle}));}catch(e){}
      renderMgrs();renderBoard();
      const u2name={};(users||[]).forEach(u=>u2name[u.user_id]=u.display_name||String(u.user_id));
      const mapRows=(Array.isArray(rosters)?rosters:[]).slice().sort((a,b)=>a.roster_id-b.roster_id).map(r=>{const dn=u2name[r.owner_id]||("owner "+r.owner_id);const h=umap[r.owner_id];const matched=h&&TEAMS.some(t=>t[0]===h);const cnt=(r.players||[]).length;return 'roster '+r.roster_id+': Sleeper "'+esc(dn)+'" &rarr; '+(matched?'<b>'+esc(h)+'</b>':'<span class="bd">UNMATCHED ('+esc(h||"?")+')</span>')+' &middot; '+cnt+' players';}).join('<br>');
      rosterSummary='<br>Live rosters: <span class="wk">'+Object.keys(byHandle).length+'/'+TEAMS.length+' teams matched, '+totalP+' rostered players</span>'+(unmatched.length?' <span class="bd">- could not match: '+unmatched.map(esc).join(", ")+' (tell Ryan these Sleeper names)</span>':' - all teams matched.')+'<div class="pmeta" style="margin-top:8px;font-size:12px;line-height:1.7;border-top:1px solid var(--line);padding-top:6px">TEAM MAPPING (verify each Sleeper name maps to the right manager):<br>'+mapRows+'</div>';
    }catch(e){rosterSummary='<br><span class="pmeta">Roster pull failed (rest still synced): '+esc(String(e.message||e))+'</span>';}
    // ===== REAL DRAFT HISTORY (2024 + 2025) -> affinity, repeat picks, position mix =====
    let draftSummary="";
    try{
      const draftedBy={},byManager={};
      async function pullDraft(lgid,season){
        try{const su=await jget("https://api.sleeper.app/v1/league/"+lgid+"/users");su.forEach(u=>{if(!umap[u.user_id])umap[u.user_id]=norm(u.display_name||u.user_id);});}catch(e){}
        const drafts=await jget("https://api.sleeper.app/v1/league/"+lgid+"/drafts");
        if(!Array.isArray(drafts)||!drafts.length)return 0;
        const picks=await jget("https://api.sleeper.app/v1/draft/"+drafts[0].draft_id+"/picks");
        if(!Array.isArray(picks))return 0;let n=0;
        picks.forEach(pk=>{const meta=pk.metadata||{};const nm=((meta.first_name||"")+" "+(meta.last_name||"")).trim();if(!nm)return;
          const handle=umap[pk.picked_by];if(!handle||!TEAMS.some(t=>t[0]===handle))return;
          const b=byManager[handle]||(byManager[handle]={p24:[],p25:[],repeat:[],pos:{}});
          (season===2024?b.p24:b.p25).push(nm);const ps=meta.position||"";if(ps)b.pos[ps]=(b.pos[ps]||0)+1;
          (draftedBy[nm]=draftedBy[nm]||[]).push([handle,season]);n++;});
        return n;
      }
      const n24=await pullDraft(LG2024,2024),n25=await pullDraft(LG2025,2025);
      for(const h in byManager){const b=byManager[h];const s=new Set(b.p24);b.repeat=b.p25.filter(x=>s.has(x)).filter((x,i,a)=>a.indexOf(x)===i);}
      localStorage.setItem("hq_draft_v1",JSON.stringify({draftedBy,byManager,ts}));
      renderMgrs();
      const reps=Object.keys(byManager).reduce((s,h)=>s+(byManager[h].repeat?byManager[h].repeat.length:0),0);
      draftSummary='<br>Drafts: <span class="wk">'+n24+' picks 2024, '+n25+' picks 2025, '+reps+' repeat-pick affinities</span> - dossiers now show real history.';
    }catch(e){draftSummary='<br><span class="pmeta">Draft history pull failed (FAAB still synced): '+esc(String(e.message||e))+'</span>';}
    const top=Object.keys(fa).map(h=>({h,m:fa[h].median,mx:fa[h].max,sp:fa[h].spent,c:fa[h].count})).sort((a,b)=>b.sp-a.sp).slice(0,5);
    const rows=top.map(x=>(TEAMSHORT[x.h]||x.h)+": median $"+x.m+", max $"+x.mx+", spent $"+x.sp+" over "+x.c+" bids").join("<br>");
    out.innerHTML='<div class="out"><div class="big">Synced</div>League: '+esc(league.name)+'<br>Users '+users.length+' · Rosters '+rosters.length+' · Traded picks '+tp.length+'<br>FAAB: <span class="wk">'+weeks.length+' weeks, '+nbids+' bids</span>'+rosterSummary+draftSummary+'<br>Last synced: <span class="wk">'+esc(ts)+'</span><br><br><b>Top FAAB spenders (real medians now live in the FAAB tab):</b><br>'+(rows||"no waiver bids found")+'</div>';
  }catch(err){out.innerHTML='<div class="out"><span class="bd">Could not reach Sleeper.</span><br>'+esc(String(err.message||err))+'<br><br>If you are in the in-app preview the network is blocked. Open this HTML in Chrome or Safari and tap Sync. Everything else works offline.</div>';}
}
$("#syncbtn").addEventListener("click",()=>runSync($("#syncout")));
if($("#mgrsyncbtn"))$("#mgrsyncbtn").addEventListener("click",()=>runSync($("#mgrsyncout")));
$("#expbtn").addEventListener("click",()=>{const data={keepers:KS,board:board,exported:new Date().toISOString()};const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="bar-crawl-hq-backup.json";a.click();$("#backout").textContent="Exported.";});
$("#impbtn").addEventListener("click",()=>{const inp=document.createElement("input");inp.type="file";inp.accept="application/json";inp.onchange=()=>{const f=inp.files[0];if(!f)return;const rd=new FileReader();rd.onload=()=>{try{const d=JSON.parse(rd.result);if(d.keepers){KS=d.keepers;for(const t of TEAMS){if(!KS[t[0]])KS[t[0]]=[];while(KS[t[0]].length<4)KS[t[0]].push(["",""]);}saveKS();}if(d.board){board=d.board;saveBoard();}renderAll();$("#backout").textContent="Imported.";}catch(e){$("#backout").textContent="Import failed: "+e.message;}};rd.readAsText(f);};inp.click();});
