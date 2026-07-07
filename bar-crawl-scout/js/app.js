"use strict";
/* ===== WIRING ===== */
function setFresh(){const ls=localStorage.getItem("hq_last_sync");$("#freshness").textContent="Bar Crawl Scout · ADP: FantasyPros 2026 half-PPR · "+(ls?("Sleeper synced "+ls):"Sleeper not yet synced");}
$("#modehint").textContent=MODEHINT[MODE];
document.querySelectorAll("#modeseg button").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll("#modeseg button").forEach(x=>x.classList.remove("on"));b.classList.add("on");MODE=b.dataset.m;$("#modehint").textContent=MODEHINT[MODE];renderBoard();renderPlan();fillTradeSelects();renderTrade();}));
$("#plist").innerHTML=PLAYERS.map(p=>'<option value="'+esc(p[1])+'">').join("");
document.querySelectorAll("nav.tabs button").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll("nav.tabs button").forEach(x=>x.classList.remove("on"));document.querySelectorAll(".tab").forEach(x=>x.classList.remove("on"));b.classList.add("on");$("#"+b.dataset.tab).classList.add("on");}));
function renderAll(){renderBoard();renderEditor();renderMgrs();renderPlan();}
renderSortOptions();updateViewBtns();fillTradeSelects();renderTrade();setFresh();renderAll();
