const state={
  rows:[],filtered:[],charts:{},panelCharts:{},mapping:{},headers:[],
  liveTimer:null,lastPanelRows:[],
  selection:{product:null,category:null,location:null,month:null}
};
const months=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const weekdayNames=["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
const aliases={
 date:["fecha","date","fecha venta","fecha_venta","datetime"],
 product:["producto","product","nombre producto","nombre_producto","articulo","artículo"],
 category:["categoria","categoría","category","tipo","linea","línea","familia"],
 quantity:["cantidad","quantity","unidades","units","cantidad vendida","cantidad_vendida","qty"],
 amount:["venta","ventas","importe","monto","total","precio total","precio_total","amount","sales","valor venta","valor_venta","precio","price"],
 location:["ciudad","city","sede","sede ciudad","sede_ciudad","local","ubicacion","ubicación","location"]
};
function norm(v){return String(v??"").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");}
function parseNumber(v){
 if(v===null||v===undefined||v==="")return 0;
 if(typeof v==="number")return v;
 let s=String(v).trim().replace(/S\/|S\\|\$|\s/g,"");
 if(s.includes(",")&&s.includes(".")){
   if(s.lastIndexOf(",")>s.lastIndexOf("."))s=s.replace(/\./g,"").replace(",",".");
   else s=s.replace(/,/g,"");
 }else if(s.includes(",")){
   const p=s.split(",");
   s=p[p.length-1].length<=2?p.slice(0,-1).join("")+"."+p[p.length-1]:s.replace(/,/g,"");
 }
 return Number(s)||0;
}
function parseDate(v){
 const s=String(v??"").trim();
 if(!s)return null;
 let d=new Date(s);
 if(!isNaN(d))return d;
 const m=s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
 return m?new Date(+m[3],+m[2]-1,+m[1]):null;
}
function detect(headers,key){
 const ns=headers.map(h=>({raw:h,n:norm(h)}));
 for(const a of aliases[key]){const hit=ns.find(x=>x.n===norm(a));if(hit)return hit.raw}
 for(const a of aliases[key]){const hit=ns.find(x=>x.n.includes(norm(a))||norm(a).includes(x.n));if(hit)return hit.raw}
 return null;
}
function prepare(rows){
 const headers=Object.keys(rows[0]||{});
 const mapping={};
 Object.keys(aliases).forEach(k=>mapping[k]=detect(headers,k));
 state.mapping=mapping;state.headers=headers;
 const required=["date","product","category","quantity","amount","location"];
 if(required.some(k=>!mapping[k])){
   alert("No se pudieron detectar todas las columnas. Se necesitan: fecha, producto, categoría, cantidad, venta/importe y ciudad/sede.");
   return false;
 }
 const hasAmountColumn=mapping.amount&&norm(mapping.amount)!=="precio"&&norm(mapping.amount)!=="price";
 state.rows=rows.map(r=>{
   const qty=parseNumber(r[mapping.quantity]);
   const raw=parseNumber(r[mapping.amount]);
   const priceUnit = hasAmountColumn ? (qty? raw/qty : raw) : raw;
   const amount = hasAmountColumn ? raw : qty*raw;
   return {
   date:parseDate(r[mapping.date]),
   product:String(r[mapping.product]??"Sin producto").trim(),
   category:String(r[mapping.category]??"Sin categoría").trim(),
   quantity:qty,
   amount:amount,
   price: priceUnit,
   location:String(r[mapping.location]??"Sin sede").trim()
 } }).filter(r=>r.date&&!isNaN(r.date));
 return true;
}
function group(rows,key,metric){
 const m=new Map();
 rows.forEach(r=>m.set(r[key],(m.get(r[key])||0)+r[metric]));
 return [...m.entries()].map(([label,value])=>({label,value})).sort((a,b)=>b.value-a.value);
}
function groupAvg(rows,key,field){
 const m=new Map();
 rows.forEach(r=>{
   const cur=m.get(r[key])||{sum:0,count:0};
   cur.sum+=r[field];cur.count++;
   m.set(r[key],cur);
 });
 return [...m.entries()].map(([label,{sum,count}])=>({label,value:sum/count})).sort((a,b)=>b.value-a.value);
}
function money(v){return "S/ "+Number(v).toLocaleString("es-PE",{minimumFractionDigits:2,maximumFractionDigits:2})}
function num(v){return Number(v).toLocaleString("es-PE")}
function set(id,v){const el=document.getElementById(id); if(el) el.textContent=v}
function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function parseCsv(text){
 const records=[];let record=[],field="",quoted=false;
 for(let i=0;i<text.length;i++){
  const char=text[i],next=text[i+1];
  if(char==='"'&&quoted&&next==='"'){field+='"';i++;continue}
  if(char==='"'){quoted=!quoted;continue}
  if(char===','&&!quoted){record.push(field);field="";continue}
  if((char==='\n'||char==='\r')&&!quoted){
   if(char==='\r'&&next==='\n')i++;
   record.push(field);field="";
   if(record.some(value=>value.trim()!=="")){records.push(record)}
   record=[];continue;
  }
  field+=char;
 }
 if(field!==""||record.length){record.push(field);records.push(record)}
 const headers=(records.shift()||[]).map(header=>header.replace(/^\uFEFF/,""));
 return records.map(values=>headers.reduce((row,header,index)=>{row[header]=values[index]??"";return row},{}));
}
function destroyCharts(){Object.values(state.charts).forEach(c=>{try{c.destroy()}catch{}});state.charts={}}
function destroyPanelCharts(){Object.values(state.panelCharts).forEach(c=>{try{c.destroy()}catch{}});state.panelCharts={}}
function clearData(){
 state.rows=[];state.filtered=[];destroyCharts();destroyPanelCharts();
 state.selection={product:null,category:null,location:null,month:null};
 ["totalSales","transactions","productsSold","topProduct","topLocation","topProductShare","topLocationShare"].forEach(id=>set(id,["topProduct","topLocation","topProductShare","topLocationShare"].includes(id)?"—":id==="totalSales"?"S/ 0.00":"0"));
 const fs=document.getElementById("fileStatus"); if(fs) fs.textContent="Sin archivo cargado";
 const rc=document.getElementById("reportContent"); if(rc) rc.innerHTML='<p class="empty">Carga un CSV y genera un reporte con los filtros seleccionados.</p>';
 const fc=document.getElementById("filterCount"); if(fc) fc.textContent="0 registros filtrados";
 ["pTotalSales","pTransactions","pAvgSale","pQty","pAvgPrice","pCities"].forEach(id=>set(id,"—"));
 renderActiveChips();
}
function makeChart(id,type,labels,data,label,extra={}){
 const ctx=document.getElementById(id);
 if(!ctx) return null;
 if(state.charts[id]){try{state.charts[id].destroy()}catch{}}
 state.charts[id]=new Chart(ctx,{type,data:{labels,datasets:[{label,data,borderWidth:2,fill:type==="line",tension:.3,backgroundColor:["#2563EB","#7C3AED","#10B981","#F59E0B","#64748B","#EC4899","#06B6D4","#EF4444","#14B8A6"],borderColor:"#2563EB"}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:type==="doughnut"}},scales:type==="doughnut"||type==="pie"?{}:{y:{beginAtZero:true}},...extra}});
 return state.charts[id];
}
function makePanelChart(id,type,labels,data,label,extra={}){
 const ctx=document.getElementById(id);
 if(!ctx) return null;
 if(state.panelCharts[id]){try{state.panelCharts[id].destroy()}catch{}}
 state.panelCharts[id]=new Chart(ctx,{type,data:{labels,datasets:[{label,data,borderWidth:2,fill:type==="line",tension:.35,backgroundColor:["#2563EB","#7C3AED","#10B981","#F59E0B","#64748B","#EC4899","#06B6D4","#EF4444","#14B8A6","#A78BFA"],borderColor:"#2563EB"}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:type==="doughnut"||type==="pie"}},scales:(type==="doughnut"||type==="pie")?{}:{y:{beginAtZero:true}},...extra}});
 return state.panelCharts[id];
}
// ===== SELECCIÓN DE TABLAS =====
function toggleSelection(type,value){
 if(state.selection[type]===value) state.selection[type]=null;
 else state.selection[type]=value;
 // feedback visual rápido
 const toast=document.createElement('div');
 toast.textContent= state.selection[type] ? `Filtrado por ${type}: ${value}` : `Filtro ${type} eliminado`;
 toast.style.cssText='position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#0F172A;color:#fff;padding:8px 14px;border-radius:999px;font-size:12px;font-weight:700;z-index:999;box-shadow:0 8px 24px rgba(0,0,0,.2)';
 document.body.appendChild(toast);
 setTimeout(()=>toast.remove(),1800);
 update();
}
function bindTableSelection(){
 document.querySelectorAll('.data-table tbody tr.selectable').forEach(tr=>{
   tr.addEventListener('click',()=>{
     const type=tr.dataset.type;
     const value=tr.dataset.value;
     if(type && value) toggleSelection(type,value);
   });
 });
 // mini tables también
 document.querySelectorAll('.mini-table tbody tr.selectable').forEach(tr=>{
   tr.addEventListener('click',()=>{
     const type=tr.dataset.type;
     const value=tr.dataset.value;
     if(type && value) toggleSelection(type,value);
   });
 });
}
// ===== FILTROS =====
function populateFilters(){
 const years=[...new Set(state.rows.map(r=>r.date.getFullYear()))].sort();
 const locations=[...new Set(state.rows.map(r=>r.location))].sort();
 const categories=[...new Set(state.rows.map(r=>r.category))].sort();
 const products=[...new Set(state.rows.map(r=>r.product))].sort();
 const setHTML=(id,html)=>{const el=document.getElementById(id); if(el) el.innerHTML=html;};
 const yearOpts='<option value="all">Todos</option>'+years.map(y=>`<option>${y}</option>`).join("");
 const locOpts='<option value="all">Todas</option>'+locations.map(x=>`<option>${escapeHtml(x)}</option>`).join("");
 const catOpts='<option value="all">Todas</option>'+categories.map(x=>`<option>${escapeHtml(x)}</option>`).join("");
 const prodOpts='<option value="all">Todos</option>'+products.map(x=>`<option>${escapeHtml(x)}</option>`).join("");
 setHTML("yearFilter",yearOpts);
 setHTML("locationFilter",locOpts);
 setHTML("reportYearFilter",yearOpts);
 setHTML("reportLocationFilter",'<option value="all">Todos</option>'+locations.map(x=>`<option value="${escapeHtml(x)}">${escapeHtml(x)}</option>`).join(""));
 setHTML("fYear",yearOpts);
 setHTML("fCity",locOpts);
 setHTML("fCategory",catOpts);
 setHTML("fProduct",prodOpts);
 if(state.rows.length){
   const prices=state.rows.map(r=>r.price).filter(v=>v>0);
   const minP=Math.floor(Math.min(...prices));
   const maxP=Math.ceil(Math.max(...prices));
   const qtyMin=Math.min(...state.rows.map(r=>r.quantity));
   const qtyMax=Math.max(...state.rows.map(r=>r.quantity));
   const amtMax=Math.ceil(Math.max(...state.rows.map(r=>r.amount)));
   const setRange=(minId,maxId,min,max)=>{const a=document.getElementById(minId),b=document.getElementById(maxId); if(a){a.min=min;a.max=max;if(!a.dataset.touched) a.value=min;} if(b){b.min=min;b.max=max;if(!b.dataset.touched) b.value=max;}};
   setRange("fPriceMin","fPriceMax",Math.max(0,minP-10),maxP+10);
   const pMinN=document.getElementById("fPriceMinNum"), pMaxN=document.getElementById("fPriceMaxNum");
   if(pMinN) { pMinN.min=Math.max(0,minP-10); pMinN.max=maxP+10; if(!pMinN.dataset.touched) pMinN.value=document.getElementById("fPriceMin").value; }
   if(pMaxN) { pMaxN.min=Math.max(0,minP-10); pMaxN.max=maxP+10; if(!pMaxN.dataset.touched) pMaxN.value=document.getElementById("fPriceMax").value; }
   setRange("fQtyMin","fQtyMax",qtyMin,qtyMax);
   const qMinN=document.getElementById("fQtyMinNum"), qMaxN=document.getElementById("fQtyMaxNum");
   if(qMinN) {qMinN.min=qtyMin; qMinN.max=qtyMax; if(!qMinN.dataset.touched) qMinN.value=qtyMin;}
   if(qMaxN) {qMaxN.min=qtyMin; qMaxN.max=qtyMax; if(!qMaxN.dataset.touched) qMaxN.value=qtyMax;}
   setRange("fAmountMin","fAmountMax",0,amtMax);
   const aMinN=document.getElementById("fAmountMinNum"), aMaxN=document.getElementById("fAmountMaxNum");
   if(aMinN) {aMinN.min=0; aMinN.max=amtMax; if(!aMinN.dataset.touched) aMinN.value=0;}
   if(aMaxN) {aMaxN.min=0; aMaxN.max=amtMax; if(!aMaxN.dataset.touched) aMaxN.value=amtMax;}
   syncRangeLabels();
 }
 // fechas por defecto: min y max del dataset
 if(state.rows.length){
   const dates=state.rows.map(r=>r.date).sort((a,b)=>a-b);
   const minD=dates[0].toISOString().slice(0,10), maxD=dates[dates.length-1].toISOString().slice(0,10);
   const fromEl=document.getElementById("fDateFrom"), toEl=document.getElementById("fDateTo");
   if(fromEl && !fromEl.value) {fromEl.min=minD; fromEl.max=maxD; fromEl.placeholder=minD;}
   if(toEl && !toEl.value) {toEl.min=minD; toEl.max=maxD; toEl.placeholder=maxD;}
 }
}
function syncRangeLabels(){
 const pMin=document.getElementById("fPriceMin")?.value, pMax=document.getElementById("fPriceMax")?.value;
 const qMin=document.getElementById("fQtyMin")?.value, qMax=document.getElementById("fQtyMax")?.value;
 const aMin=document.getElementById("fAmountMin")?.value, aMax=document.getElementById("fAmountMax")?.value;
 const set=(id,val)=>{const e=document.getElementById(id); if(e) e.textContent=val};
 if(pMin!==undefined) set("fPriceLabel", `${num(pMin)} — ${num(pMax)}`);
 if(qMin!==undefined) set("fQtyLabel", `${qMin} — ${qMax}`);
 if(aMin!==undefined) set("fAmountLabel", `${num(aMin)} — ${num(aMax)}`);
}
function getPanelFilteredRows(){
 if(!state.rows.length) return [];
 let rows=[...state.rows];
 // globales legacy (yearFilter etc) - ya incluidos pero mantenemos por compat
 const gYear=document.getElementById("yearFilter")?.value;
 const gMonth=document.getElementById("monthFilter")?.value;
 const gLoc=document.getElementById("locationFilter")?.value;
 if(gYear&&gYear!=="all") rows=rows.filter(r=>String(r.date.getFullYear())===String(gYear));
 if(gMonth&&gMonth!=="all") rows=rows.filter(r=>String(r.date.getMonth()+1)===String(gMonth));
 if(gLoc&&gLoc!=="all") rows=rows.filter(r=>r.location===gLoc);
 // panel
 const fText=document.getElementById("fText")?.value.trim().toLowerCase();
 const fCat=document.getElementById("fCategory")?.value;
 const fCity=document.getElementById("fCity")?.value;
 const fProduct=document.getElementById("fProduct")?.value;
 const fMonth=document.getElementById("fMonth")?.value;
 const fYear=document.getElementById("fYear")?.value;
 const fQuarter=document.getElementById("fQuarter")?.value;
 const fWeekday=document.getElementById("fWeekday")?.value;
 const fDateFrom=document.getElementById("fDateFrom")?.value;
 const fDateTo=document.getElementById("fDateTo")?.value;
 const pMin=Number(document.getElementById("fPriceMin")?.value||0);
 const pMax=Number(document.getElementById("fPriceMax")?.value||999999);
 const qMin=Number(document.getElementById("fQtyMin")?.value||0);
 const qMax=Number(document.getElementById("fQtyMax")?.value||999999);
 const aMin=Number(document.getElementById("fAmountMin")?.value||0);
 const aMax=Number(document.getElementById("fAmountMax")?.value||9999999);
 if(fText) rows=rows.filter(r=> r.product.toLowerCase().includes(fText) || r.category.toLowerCase().includes(fText) || r.location.toLowerCase().includes(fText));
 if(fCat&&fCat!=="all") rows=rows.filter(r=>r.category===fCat);
 if(fCity&&fCity!=="all") rows=rows.filter(r=>r.location===fCity);
 if(fProduct&&fProduct!=="all") rows=rows.filter(r=>r.product===fProduct);
 if(fYear&&fYear!=="all") rows=rows.filter(r=>String(r.date.getFullYear())===String(fYear));
 if(fMonth&&fMonth!=="all") rows=rows.filter(r=>String(r.date.getMonth()+1)===String(fMonth));
 if(fQuarter&&fQuarter!=="all"){
   const q=Number(fQuarter);
   rows=rows.filter(r=>{
     const m=r.date.getMonth(); //0-11
     const rq=Math.floor(m/3)+1;
     return rq===q;
   });
 }
 if(fWeekday&&fWeekday!=="all") rows=rows.filter(r=>String(r.date.getDay())===String(fWeekday));
 if(fDateFrom) rows=rows.filter(r=> r.date >= new Date(fDateFrom+'T00:00:00'));
 if(fDateTo) rows=rows.filter(r=> r.date <= new Date(fDateTo+'T23:59:59'));
 rows=rows.filter(r=> r.price>=pMin && r.price<=pMax);
 rows=rows.filter(r=> r.quantity>=qMin && r.quantity<=qMax);
 rows=rows.filter(r=> r.amount>=aMin && r.amount<=aMax);
 // selección por tablas (clic)
 if(state.selection.product) rows=rows.filter(r=>r.product===state.selection.product);
 if(state.selection.category) rows=rows.filter(r=>r.category===state.selection.category);
 if(state.selection.location) rows=rows.filter(r=>r.location===state.selection.location);
 if(state.selection.month) rows=rows.filter(r=> months[r.date.getMonth()]===state.selection.month);
 return rows;
}
function renderActiveChips(){
 const cont=document.getElementById("activeChips");
 if(!cont) return;
 const chips=[];
 const add=(label,value,clearFn)=>{
   chips.push(`<span class="chip active">${label}: ${escapeHtml(value)} <i onclick="(${clearFn})()">×</i></span>`);
 };
 const fText=document.getElementById("fText")?.value.trim();
 if(fText) chips.push(`<span class="chip active">Búsqueda: ${escapeHtml(fText)} <i onclick="document.getElementById('fText').value='';schedulePanel()">×</i></span>`);
 const fCat=document.getElementById("fCategory")?.value;
 if(fCat&&fCat!=="all") chips.push(`<span class="chip active">Categoría: ${escapeHtml(fCat)} <i onclick="document.getElementById('fCategory').value='all';schedulePanel()">×</i></span>`);
 const fCity=document.getElementById("fCity")?.value;
 if(fCity&&fCity!=="all") chips.push(`<span class="chip active">Ciudad: ${escapeHtml(fCity)} <i onclick="document.getElementById('fCity').value='all';schedulePanel()">×</i></span>`);
 const fProd=document.getElementById("fProduct")?.value;
 if(fProd&&fProd!=="all") chips.push(`<span class="chip active">Producto: ${escapeHtml(fProd)} <i onclick="document.getElementById('fProduct').value='all';schedulePanel()">×</i></span>`);
 const fQ=document.getElementById("fQuarter")?.value;
 if(fQ&&fQ!=="all") chips.push(`<span class="chip active">Trimestre: Q${fQ} <i onclick="document.getElementById('fQuarter').value='all';schedulePanel()">×</i></span>`);
 const fW=document.getElementById("fWeekday")?.value;
 if(fW&&fW!=="all") chips.push(`<span class="chip active">Día: ${weekdayNames[Number(fW)]} <i onclick="document.getElementById('fWeekday').value='all';schedulePanel()">×</i></span>`);
 const fFrom=document.getElementById("fDateFrom")?.value;
 if(fFrom) chips.push(`<span class="chip active">Desde: ${fFrom} <i onclick="document.getElementById('fDateFrom').value='';schedulePanel()">×</i></span>`);
 const fTo=document.getElementById("fDateTo")?.value;
 if(fTo) chips.push(`<span class="chip active">Hasta: ${fTo} <i onclick="document.getElementById('fDateTo').value='';schedulePanel()">×</i></span>`);
 if(state.selection.product) chips.push(`<span class="chip active" style="background:#0F172A">Sel. Producto: ${escapeHtml(state.selection.product)} <i onclick="toggleSelection('product','${escapeHtml(state.selection.product)}')">×</i></span>`);
 if(state.selection.category) chips.push(`<span class="chip active" style="background:#0F172A">Sel. Categoría: ${escapeHtml(state.selection.category)} <i onclick="toggleSelection('category','${escapeHtml(state.selection.category)}')">×</i></span>`);
 if(state.selection.location) chips.push(`<span class="chip active" style="background:#0F172A">Sel. Ciudad: ${escapeHtml(state.selection.location)} <i onclick="toggleSelection('location','${escapeHtml(state.selection.location)}')">×</i></span>`);
 if(state.selection.month) chips.push(`<span class="chip active" style="background:#0F172A">Sel. Mes: ${escapeHtml(state.selection.month)} <i onclick="toggleSelection('month','${escapeHtml(state.selection.month)}')">×</i></span>`);
 cont.innerHTML=chips.join('') || '<span style="font-size:11px;color:#94A3B8">Sin filtros activos — prueba precio, fecha o clic en tablas</span>';
 // exponer global para onclick inline
 window.toggleSelection=toggleSelection;
 window.schedulePanel=schedulePanel;
}
function updatePanel(forceEmpty){
 const rows=getPanelFilteredRows();
 state.lastPanelRows=rows;
 const countEl=document.getElementById("filterCount");
 if(countEl) countEl.innerHTML=`<b>${num(rows.length)}</b> registros · ${state.rows.length? ((rows.length/state.rows.length)*100).toFixed(1):0}% del total`;
 const lastEl=document.getElementById("lastUpdate");
 if(lastEl) lastEl.textContent= new Date().toLocaleTimeString("es-PE");
 renderActiveChips();
 if(!rows.length){
   set("pTotalSales","S/ 0.00"); set("pTransactions","0"); set("pAvgSale","S/ 0.00"); set("pQty","0"); set("pAvgPrice","S/ 0.00"); set("pCities","0");
   const setDelta=(id,val)=>{const e=document.getElementById(id); if(e) e.textContent=val};
   setDelta("pTotalSalesDelta","—"); setDelta("pTransDelta","—"); setDelta("pAvgDelta","—"); setDelta("pQtyDelta","—"); setDelta("pPriceDelta","—");
   const kpiIns=document.getElementById("kpiInsight"); if(kpiIns) kpiIns.textContent="Sin datos para los filtros actuales. Ajusta precio, fecha, ciudad o limpia selección ●";
   destroyPanelCharts();
   const rt=document.getElementById("rankingTable"); if(rt) rt.innerHTML='<p class="empty" style="padding:12px">Sin datos filtrados.</p>';
   const gt=document.getElementById("geoTable"); if(gt) gt.innerHTML="";
   const ps=document.getElementById("priceStats"); if(ps) ps.innerHTML="";
   const pi=document.getElementById("panelInsights"); if(pi) pi.innerHTML='<p class="empty">Ajusta los filtros para ver insights.</p>';
   const trendBest=document.getElementById("trendBestMonth"); if(trendBest) trendBest.textContent="Mejor mes: —";
   const trendProj=document.getElementById("trendProjection"); if(trendProj) trendProj.textContent="Proyección: —";
   if(forceEmpty) return;
   return;
 }
 const total=rows.reduce((s,r)=>s+r.amount,0);
 const qty=rows.reduce((s,r)=>s+r.quantity,0);
 const avgSale= total/rows.length;
 const avgPrice= rows.reduce((s,r)=>s+r.price,0)/rows.length;
 const cities=new Set(rows.map(r=>r.location)).size;
 set("pTotalSales",money(total));
 set("pTransactions",num(rows.length));
 set("pAvgSale",money(avgSale));
 set("pQty",num(Math.round(qty)));
 set("pAvgPrice",money(avgPrice));
 set("pCities",String(cities));
 if(state.rows.length){
   const totalAll=state.rows.reduce((s,r)=>s+r.amount,0);
   const share=((total/totalAll)*100).toFixed(1);
   const deltaEl=document.getElementById("pTotalSalesDelta"); if(deltaEl) deltaEl.textContent=`${share}% del total`;
   const transShare=((rows.length/state.rows.length)*100).toFixed(1);
   const transEl=document.getElementById("pTransDelta"); if(transEl) transEl.textContent=`${transShare}% registros`;
   const avgAll= totalAll/state.rows.length;
   const avgDelta= ((avgSale-avgAll)/avgAll*100).toFixed(1);
   const avgEl=document.getElementById("pAvgDelta"); if(avgEl) avgEl.textContent=`${avgDelta>0?"+":""}${avgDelta}% vs histórico`;
   const qtyAll=state.rows.reduce((s,r)=>s+r.quantity,0);
   const qtyShare=((qty/qtyAll)*100).toFixed(1);
   const qtyEl=document.getElementById("pQtyDelta"); if(qtyEl) qtyEl.textContent=`${qtyShare}% unidades`;
   const priceAll= state.rows.reduce((s,r)=>s+r.price,0)/state.rows.length;
   const priceDelta=((avgPrice-priceAll)/priceAll*100).toFixed(1);
   const priceEl=document.getElementById("pPriceDelta"); if(priceEl) priceEl.textContent=`${priceDelta>0?"+":""}${priceDelta}% vs media`;
 }
 const topProd=group(rows,"product","quantity")[0];
 const topCat=group(rows,"category","amount")[0];
 const topCity=group(rows,"location","amount")[0];
 const kpiIns=document.getElementById("kpiInsight");
 if(kpiIns){
   if(topProd && topCat && topCity){
     kpiIns.innerHTML=`<b>${escapeHtml(topProd.label)}</b> lidera con ${num(topProd.value)} u. · <b>${escapeHtml(topCat.label)}</b> ${money(topCat.value)} · <b>${escapeHtml(topCity.label)}</b> top ${money(topCity.value)}. <span style="color:#059669">Filtros: S/ ${document.getElementById("fPriceMin").value}–${document.getElementById("fPriceMax").value} · ${document.getElementById("fDateFrom").value||'—'} → ${document.getElementById("fDateTo").value||'—'}</span> ${state.selection.product?`· <b style="color:#0F172A">Sel: ${escapeHtml(state.selection.product)}</b>`:''}`;
   }
 }
 const monthly=Array.from({length:12},(_,i)=>({label:months[i].slice(0,3),value:0}));
 rows.forEach(r=>monthly[r.date.getMonth()].value+=r.amount);
 makePanelChart("kpiSpark","line",monthly.map(x=>x.label),monthly.map(x=>x.value),"Ventas",{plugins:{legend:{display:false}},scales:{y:{display:false},x:{grid:{display:false}}}});
 const trendMode=document.getElementById("trendMode")?.value||"month";
 if(trendMode==="month"){
   makePanelChart("panelTrendChart","line",monthly.map(x=>x.label),monthly.map(x=>x.value),"Ventas (S/)",{plugins:{legend:{display:false}}});
 }else{
   const cats=group(rows,"category","amount");
   makePanelChart("panelTrendChart","bar",cats.map(x=>x.label),cats.map(x=>x.value),"Ventas por categoría",{plugins:{legend:{display:false}}});
 }
 const monthlyVals=monthly.map(x=>x.value);
 const maxIdx=monthlyVals.indexOf(Math.max(...monthlyVals));
 const bestMonth= monthlyVals[maxIdx]>0 ? months[maxIdx] : "—";
 const trendBest=document.getElementById("trendBestMonth"); if(trendBest) trendBest.textContent=`Mejor mes: ${bestMonth} (${money(monthlyVals[maxIdx]||0)})`;
 const observed=monthlyVals.filter(v=>v>0);
 let projection="—";
 if(observed.length>=2){
   const n=observed.length;
   const xMean=(n-1)/2, yMean=observed.reduce((a,b)=>a+b,0)/n;
   const numSlope=observed.reduce((s,val,i)=>s+(i-xMean)*(val-yMean),0);
   const den=observed.reduce((s,val,i)=>s+(i-xMean)**2,0);
   const slope= den? numSlope/den : 0;
   const next=Math.max(0, yMean + slope*(n - xMean));
   projection=money(next);
 }
 const trendProj=document.getElementById("trendProjection"); if(trendProj) trendProj.textContent=`Proyección próximo mes: ${projection}`;
 const fSort=document.getElementById("fSort")?.value||"mas_ventas";
 const fTopN=Number(document.getElementById("fTopN")?.value||10);
 const fRankMode=document.getElementById("fRankMode")?.value||"mas";
 let ranking=[];
 if(fSort==="mas_ventas"||fSort==="menos_ventas") ranking=group(rows,"product","amount");
 else if(fSort==="mas_unidades"||fSort==="menos_unidades") ranking=group(rows,"product","quantity");
 else if(fSort==="mayor_precio"||fSort==="menor_precio") ranking=groupAvg(rows,"product","price");
 else if(fSort==="az"){const m=new Map(); rows.forEach(r=>m.set(r.product,(m.get(r.product)||0)+r.amount)); ranking=[...m.entries()].map(([label,value])=>({label,value})).sort((a,b)=>a.label.localeCompare(b.label));}
 let sorted=[...ranking];
 if(fSort==="menos_ventas"||fSort==="menos_unidades"||fSort==="menor_precio") sorted.sort((a,b)=>a.value-b.value);
 else if(fSort==="mas_ventas"||fSort==="mas_unidades"||fSort==="mayor_precio") sorted.sort((a,b)=>b.value-a.value);
 if(fRankMode==="menos") sorted=[...sorted].reverse();
 sorted=sorted.slice(0,fTopN);
 const rankLabelMap={mas_ventas:"Ventas (S/)",menos_ventas:"Ventas (S/)",mas_unidades:"Unidades",menos_unidades:"Unidades",mayor_precio:"Precio prom.",menor_precio:"Precio prom.",az:"Ventas (S/)"};
 const subtitle=document.getElementById("rankingSubtitle");
 if(subtitle) subtitle.textContent=`${fRankMode==="mas"?"Más":"Menos"} · ${fTopN} · ${document.getElementById("fSort").selectedOptions[0].text}`;
 makePanelChart("panelRankingChart","bar",sorted.map(x=>x.label),sorted.map(x=>x.value),rankLabelMap[fSort]||"Valor",{indexAxis:"y",plugins:{legend:{display:false}}});
 const rankTable=document.getElementById("rankingTable");
 if(rankTable){
   const totalMetric= ranking.reduce((s,r)=>s+r.value,0);
   rankTable.innerHTML=`<table><thead><tr><th>#</th><th>Producto</th><th>${rankLabelMap[fSort]}</th><th>%</th></tr></thead><tbody>${sorted.map((r,i)=>`<tr class="selectable ${state.selection.product===r.label?'selected':''}" data-type="product" data-value="${escapeHtml(r.label)}"><td>${i+1}</td><td>${escapeHtml(r.label)} ${state.selection.product===r.label?'●':''}</td><td>${fSort.includes("precio")? money(r.value) : fSort.includes("unidades")? num(Math.round(r.value)) : money(r.value)}</td><td>${totalMetric? ((r.value/totalMetric)*100).toFixed(1):0}%</td></tr>`).join("")}</tbody></table>`;
 }
 const geoMode=document.getElementById("geoMode")?.value||"city";
 let geoData=[];
 if(geoMode==="city"){
   geoData=group(rows,"location","amount");
   makePanelChart("panelGeoChart","bar",geoData.map(x=>x.label),geoData.map(x=>x.value),"Ventas por ciudad",{plugins:{legend:{display:false}}});
 }else{
   geoData=group(rows,"category","amount");
   makePanelChart("panelGeoChart","doughnut",geoData.map(x=>x.label),geoData.map(x=>x.value),"Ventas",{});
 }
 const geoTable=document.getElementById("geoTable");
 if(geoTable){
   const totalGeo=geoData.reduce((s,r)=>s+r.value,0);
   const type= geoMode==="city"?"location":"category";
   geoTable.innerHTML=`<table><thead><tr><th>${geoMode==="city"?"Ciudad":"Categoría"}</th><th>Ventas</th><th>%</th></tr></thead><tbody>${geoData.slice(0,8).map(r=>`<tr class="selectable ${state.selection[type]===r.label?'selected':''}" data-type="${type}" data-value="${escapeHtml(r.label)}"><td>${escapeHtml(r.label)} ${state.selection[type]===r.label?'●':''}</td><td>${money(r.value)}</td><td>${((r.value/totalGeo)*100).toFixed(1)}%</td></tr>`).join("")}</tbody></table>`;
 }
 const buckets=[
   {label:"0-100",min:0,max:100},
   {label:"100-300",min:100,max:300},
   {label:"300-700",min:300,max:700},
   {label:"700-1500",min:700,max:1500},
   {label:"1500-3000",min:1500,max:3000},
   {label:"3000+",min:3000,max:999999},
 ];
 const hist=buckets.map(b=>({label:b.label,value:rows.filter(r=>r.price>=b.min && r.price < b.max).length}));
 makePanelChart("panelPriceChart","bar",hist.map(x=>x.label),hist.map(x=>x.value),"Tickets por rango de precio",{plugins:{legend:{display:false}}});
 const sample=rows.slice().sort(()=>0.5-Math.random()).slice(0,200);
 const scatterData=sample.map(r=>({x:r.price,y:r.quantity}));
 if(state.panelCharts["panelScatterChart"]) {try{state.panelCharts["panelScatterChart"].destroy()}catch{}}
 const ctxScatter=document.getElementById("panelScatterChart");
 if(ctxScatter){
   state.panelCharts["panelScatterChart"]=new Chart(ctxScatter,{type:"scatter",data:{datasets:[{label:"Precio vs Cantidad",data:scatterData,backgroundColor:"#2563EB",borderColor:"#2563EB"}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{title:{display:true,text:"Precio unitario (S/)"}},y:{title:{display:true,text:"Cantidad"}}}}});
 }
 const priceStats=document.getElementById("priceStats");
 if(priceStats){
   const prices=rows.map(r=>r.price);
   const minP=Math.min(...prices), maxP=Math.max(...prices), avg=prices.reduce((a,b)=>a+b,0)/prices.length;
   const median=[...prices].sort((a,b)=>a-b)[Math.floor(prices.length/2)];
   priceStats.innerHTML=`<div><small>Precio mínimo</small><b>${money(minP)}</b></div><div><small>Precio máximo</small><b>${money(maxP)}</b></div><div><small>Precio promedio</small><b>${money(avg)}</b></div><div><small>Mediana</small><b>${money(median)}</b></div>`;
 }
 const priceBadge=document.getElementById("priceBadge");
 if(priceBadge){
   const avgPriceBadge= rows.reduce((s,r)=>s+r.price,0)/rows.length;
   priceBadge.textContent= avgPriceBadge>1000? "Precio alto" : avgPriceBadge>300? "Precio medio":"Precio accesible";
 }
 const insights=document.getElementById("panelInsights");
 if(insights){
   const locShare=topCity? ((topCity.value/total)*100).toFixed(1):0;
   const cheapest=groupAvg(rows,"product","price").slice(-1)[0];
   const expensive=groupAvg(rows,"product","price")[0];
   const lowStock=group(rows,"product","quantity").slice(-1)[0];
   const cards=[
     {title:"💰 Oportunidad precio", desc: `Más económico: <b>${escapeHtml(cheapest?.label||"—")}</b> (${money(cheapest?.value||0)}). Premium: <b>${escapeHtml(expensive?.label||"—")}</b> (${money(expensive?.value||0)}). <br><em>Decisión:</em> paquetizar económico con premium.`},
     {title:"📍 Concentración geográfica", desc: `<b>${escapeHtml(topCity?.label||"—")}</b> concentra ${locShare}% (${money(topCity?.value||0)}).<br><em>Decisión:</em> replicar estrategia en ciudades < ${money(total/ new Set(rows.map(r=>r.location)).size)} promedio.`},
     {title:"📦 Riesgo quiebre", desc: `<b>${escapeHtml(topProd?.label||"—")}</b> top ${num(topProd?.value||0)} u. Menos: <b>${escapeHtml(lowStock?.label||"—")}</b> (${num(lowStock?.value||0)} u.).<br><em>Decisión:</em> +20% stock top, pack para low-stock.`},
     {title:"📈 Estacionalidad", desc: `Mejor mes <b>${bestMonth}</b> (${money(monthlyVals[maxIdx]||0)}). Proyección <b>${projection}</b>.<br><em>Decisión:</em> inventario +15% y campaña 2 semanas antes.`},
     {title:"💲 Sensibilidad precio", desc: `Rango frec.: <b>${hist.slice().sort((a,b)=>b.value-a.value)[0]?.label||"—"}</b> (${num(hist.slice().sort((a,b)=>b.value-a.value)[0]?.value||0)}). Prom <b>${money(avgPrice)}</b>.<br><em>Decisión:</em> >S/1500 cuotas; <S/100 push volumen.`},
     {title:"🧪 Estudio sólido", desc: `Recorte: <b>${num(rows.length)}</b> de ${num(state.rows.length)} (${((rows.length/state.rows.length)*100).toFixed(1)}%). Filtros: ${document.getElementById("fDateFrom").value||'—'}→${document.getElementById("fDateTo").value||'—'}, Q${document.getElementById("fQuarter").value}, ${weekdayNames[Number(document.getElementById("fWeekday").value)]||'todos'}.<br><em>Decisión:</em> usar para pricing y reposición.`},
   ];
   insights.innerHTML=cards.map(c=>`<article><h5>${c.title}</h5><p>${c.desc}</p></article>`).join("");
 }
 // bind mini table selections
 setTimeout(bindTableSelection,0);
}
let panelDebounce=null;
function schedulePanel(){ if(panelDebounce) clearTimeout(panelDebounce); panelDebounce=setTimeout(()=>{update();},140); renderActiveChips(); }
function bindRangeSync(){
 const pairs=[["fPriceMin","fPriceMinNum"],["fPriceMax","fPriceMaxNum"],["fQtyMin","fQtyMinNum"],["fQtyMax","fQtyMaxNum"],["fAmountMin","fAmountMinNum"],["fAmountMax","fAmountMaxNum"]];
 pairs.forEach(([range,numId])=>{
   const r=document.getElementById(range), n=document.getElementById(numId);
   if(!r||!n) return;
   r.addEventListener("input",()=>{r.dataset.touched="1"; n.dataset.touched="1"; n.value=r.value; syncRangeLabels(); schedulePanel();});
   n.addEventListener("input",()=>{n.dataset.touched="1"; r.dataset.touched="1"; r.value=n.value; syncRangeLabels(); schedulePanel();});
 });
 document.getElementById("fPriceMin")?.addEventListener("input",e=>{const max=document.getElementById("fPriceMax"); if(Number(e.target.value)>Number(max.value)) max.value=e.target.value; document.getElementById("fPriceMaxNum").value=max.value;});
 document.getElementById("fPriceMax")?.addEventListener("input",e=>{const min=document.getElementById("fPriceMin"); if(Number(e.target.value)<Number(min.value)) min.value=e.target.value; document.getElementById("fPriceMinNum").value=min.value;});
}
function initPanelEvents(){
 ["fText","fCategory","fCity","fProduct","fMonth","fYear","fQuarter","fWeekday","fSort","fTopN","fRankMode","fMetric","trendMode","geoMode","fDateFrom","fDateTo"].forEach(id=>{
   const el=document.getElementById(id);
   if(el) el.addEventListener(el.tagName==="INPUT"?"input":"change", schedulePanel);
 });
 document.getElementById("resetFilters")?.addEventListener("click",()=>{
   ["fText","fDateFrom","fDateTo"].forEach(id=>{const e=document.getElementById(id); if(e) e.value="";});
   ["fCategory","fCity","fProduct","fMonth","fYear","fQuarter","fWeekday"].forEach(id=>{const e=document.getElementById(id); if(e) e.value="all";});
   document.getElementById("fSort").value="mas_ventas";
   document.getElementById("fTopN").value="10";
   document.getElementById("fRankMode").value="mas";
   document.getElementById("fMetric").value="ventas";
   state.selection={product:null,category:null,location:null,month:null};
   // reset ranges
   document.querySelectorAll('[data-touched]').forEach(e=>delete e.dataset.touched);
   populateFilters();
   schedulePanel();
 });
 document.getElementById("exportPanelCSV")?.addEventListener("click",()=>{
   const rows=state.lastPanelRows;
   if(!rows.length){alert("No hay datos filtrados para exportar.");return;}
   const csv="Fecha,Producto,Categoria,Cantidad,PrecioUnitario,Ventas,Ciudad\n"+rows.map(r=>[r.date.toISOString().slice(0,10),r.product,r.category,r.quantity,r.price.toFixed(2),r.amount.toFixed(2),r.location].map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
   const blob=new Blob([csv],{type:"text/csv;charset=utf-8"}); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=`datastore_panel_${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url);
 });
 const liveToggle=document.getElementById("liveToggle");
 if(liveToggle){
   liveToggle.addEventListener("change",e=>{
     const on=e.target.checked;
     const dot=document.getElementById("liveDot"), lab=document.getElementById("liveLabel");
     if(on){
       dot.classList.add("on"); lab.textContent="Tiempo real: ON";
       state.liveTimer=setInterval(()=>{
         if(!state.rows.length) return;
         const sample=state.rows[Math.floor(Math.random()*state.rows.length)];
         const jitterPrice= sample.price * (0.9 + Math.random()*0.2);
         const jitterQty= Math.max(1, Math.round(sample.quantity * (0.7 + Math.random()*0.6)));
         const newRow={...sample, date:new Date(), quantity:jitterQty, price:jitterPrice, amount:jitterQty*jitterPrice};
         state.rows.unshift(newRow);
         if(state.rows.length>22000) state.rows.pop();
         update();
       },2500);
     }else{
       dot.classList.remove("on"); lab.textContent="Tiempo real: OFF";
       if(state.liveTimer) {clearInterval(state.liveTimer); state.liveTimer=null;}
     }
   });
 }
}
// ===== TABLAS Y UPDATE =====
function table(headers,rows,type){
 // type para selección: product, category, location, month
 const t= type||null;
 return `<div class="table-wrap"><table class="data-table"><thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map(r=>{
   const label=r[0];
   const isSelected = t && state.selection[t]===String(label);
   const cls = t ? `selectable ${isSelected?'selected':''}` : '';
   const dataAttr = t ? `data-type="${t}" data-value="${escapeHtml(label)}"` : '';
   return `<tr class="${cls}" ${dataAttr}>${r.map((x,i)=>`<td>${i===0 && t ? `${escapeHtml(x)} ${isSelected?'●':''}` : x}</td>`).join("")}</tr>`;
 }).join("")}</tbody></table></div>`;
}
function update(){
 // unificado: usa getPanelFilteredRows para total reactividad
 const rows=getPanelFilteredRows();
 state.filtered=rows;
 if(!state.rows.length){
   // aún no hay datos, solo actualizar panel vacío
   updatePanel(true);
   return;
 }
 if(!rows.length){
   // mostrar mensaje pero igual limpiar tablas
   const kpisEmpty=false;
   set("totalSales",money(0));set("transactions","0");set("productsSold","0");
   set("topProduct","—");set("topProductShare","—");
   set("topLocation","—");set("topLocationShare","—");
   destroyCharts();
   renderTables([],[],[],[]);
   renderAnalysis([],[],[],[]);
   updatePanel(true);
   // no alert molesto en flujo reactivo, solo si filtros globales muy restrictivos
   return;
 }
 const total=rows.reduce((s,r)=>s+r.amount,0), qty=rows.reduce((s,r)=>s+r.quantity,0);
 const products=group(rows,"product","quantity"),locs=group(rows,"location","amount");
 const cats=group(rows,"category","amount");
 set("totalSales",money(total));set("transactions",num(rows.length));set("productsSold",num(Math.round(qty)));
 set("topProduct",products[0]?.label||"—");set("topProductShare",products[0]?((products[0].value/qty)*100).toFixed(1)+"% de unidades":"—");
 set("topLocation",locs[0]?.label||"—");set("topLocationShare",locs[0]?((locs[0].value/total)*100).toFixed(1)+"% de ventas":"—");
 destroyCharts();
 const monthly=Array.from({length:12},(_,i)=>({label:months[i],value:0}));
 rows.forEach(r=>monthly[r.date.getMonth()].value+=r.amount);
 const top=products.slice(0,10), bottom=[...products].reverse().slice(0,10);
 const l=locs, cq=group(rows,"category","quantity");
 makeChart("monthlyChart","line",monthly.map(x=>x.label),monthly.map(x=>x.value),"Ventas (S/)");
 makeChart("categoryChart","bar",cats.map(x=>x.label),cats.map(x=>x.value),"Ventas (S/)");
 makeChart("topProductsChart","bar",top.map(x=>x.label),top.map(x=>x.value),"Unidades",{indexAxis:"y"});
 makeChart("bottomProductsChart","bar",bottom.map(x=>x.label),bottom.map(x=>x.value),"Unidades",{indexAxis:"y"});
 makeChart("locationChart","bar",l.map(x=>x.label),l.map(x=>x.value),"Ventas (S/)");
 makeChart("categoryQuantityChart","doughnut",cq.map(x=>x.label),cq.map(x=>x.value),"Unidades");
 makeChart("locationCompareChart","bar",l.map(x=>x.label),l.map(x=>x.value),"Ventas (S/)");
 makeChart("evolutionChart","line",monthly.map(x=>x.label),monthly.map(x=>x.value),"Ventas (S/)");
 renderTables(rows,cats,products,l);
 renderAnalysis(rows,products,cats,l);
 updatePanel();
}
function renderTables(rows,cat,products,locs){
 const total=rows.reduce((s,r)=>s+r.amount,0);
 const el1=document.getElementById("summaryTable"); if(el1) el1.innerHTML=table(["Indicador","Resultado"],[
 ["Total de ventas",money(total)],["Transacciones",num(rows.length)],
 ["Productos vendidos",num(Math.round(rows.reduce((s,r)=>s+r.quantity,0)))],
 ["Promedio de venta",money(rows.length? total/rows.length:0)]
 ]);
 const el2=document.getElementById("topFiveTable"); if(el2) el2.innerHTML=table(["Producto","Unidades","%"],products.slice(0,5).map(x=>[escapeHtml(x.label),num(x.value),((x.value/rows.reduce((s,r)=>s+r.quantity,0))*100).toFixed(1)+"%"]), "product");
 const el3=document.getElementById("periodTable"); if(el3) {
   const periodoData=months.map((m,i)=>[m,money(rows.filter(r=>r.date.getMonth()===i).reduce((s,r)=>s+r.amount,0))]);
   el3.innerHTML=table(["Mes","Ventas"],periodoData, "month");
 }
 const el4=document.getElementById("categoryTable"); if(el4) el4.innerHTML=table(["Categoría","Ventas"],cat.map(x=>[escapeHtml(x.label),money(x.value)]), "category");
 const el5=document.getElementById("productsTopTable"); if(el5) el5.innerHTML=table(["Producto","Unidades"],products.slice(0,15).map(x=>[escapeHtml(x.label),num(x.value)]), "product");
 const el6=document.getElementById("productsBottomTable"); if(el6) el6.innerHTML=table(["Producto","Unidades"],[...products].reverse().slice(0,15).map(x=>[escapeHtml(x.label),num(x.value)]), "product");
 const el7=document.getElementById("locationsTable"); if(el7) el7.innerHTML=table(["Sede / Ciudad","Ventas"],locs.map(x=>[escapeHtml(x.label),money(x.value)]), "location");
 setTimeout(bindTableSelection,0);
}
function renderAnalysis(rows,products,cat,locs){
 const total=rows.reduce((s,r)=>s+r.amount,0);
  const monthlyTotals = Array.from({length:12}, (_,i) =>
    rows.filter(r => r.date.getMonth() === i).reduce((s,r) => s + r.amount, 0)
  );
  const maxVenta = Math.max(...monthlyTotals);
  const bestMonthIndex = monthlyTotals.indexOf(maxVenta);
  const bestMonth = (maxVenta > 0) ? months[bestMonthIndex] : "Sin datos";
  const cards=[
   ["Producto con mayor demanda",`${products[0]?.label||"N/D"} concentra la mayor cantidad de unidades vendidas.`,`Es el producto con mayor demanda y presenta riesgo de desabastecimiento si no se controla su inventario.`,`Se recomienda revisar su stock y mantener seguimiento de la demanda.`],
   ["Categoría líder",`${cat[0]?.label||"N/D"} registra las mayores ventas monetarias (${money(cat[0]?.value||0)}).`,`La categoría concentra el mayor valor comercial y tiene un impacto importante en los ingresos.`,`Conviene priorizar inventario y acciones comerciales para esta categoría.`],
   ["Período de mayor venta",`${bestMonth} presenta el mayor nivel de ventas dentro de los datos filtrados.`,`El comportamiento observado permite anticipar períodos de alta demanda.`,`La empresa puede preparar inventario y campañas antes de los períodos de alta demanda.`],
   ["Sede líder",`${locs[0]?.label||"N/D"} concentra la mayor facturación (${money(locs[0]?.value||0)}).`,`La sede puede servir como referencia para comparar prácticas comerciales y operativas.`,`Analizar sus buenas prácticas y compararlas con sedes de menor rendimiento.`],
   ["Resultado general",`El conjunto analizado representa ${money(total)} en ventas.`,`Este valor resume el rendimiento del período seleccionado y permite establecer una línea base.`,`Utilizar este resultado como línea base para comparar períodos futuros.`]
  ];
 const el=document.getElementById("analysisCards"); if(el) el.innerHTML=cards.map((c,i)=>`<article class="insight"><h3>Análisis ${i+1}: ${c[0]}</h3><p><b>Resultado:</b> ${c[1]}</p><p><b>Interpretación:</b> ${c[2]}</p><p><b>Decisión propuesta:</b> ${c[3]}</p></article>`).join("");
}
function reportRows(){
 const year=document.getElementById("reportYearFilter").value;
 const month=document.getElementById("reportMonthFilter").value;
 const location=document.getElementById("reportLocationFilter").value;
 return state.rows.filter(row=>(year==="all"||row.date.getFullYear()==year)&&(month==="all"||row.date.getMonth()+1==month)&&(location==="all"||row.location===location));
}
function reportHtml(rows){
 const total=rows.reduce((sum,row)=>sum+row.amount,0),quantity=rows.reduce((sum,row)=>sum+row.quantity,0);
 const products=group(rows,"product","quantity"), categories=group(rows,"category","amount"), locations=group(rows,"location","amount");
 const monthly=Array.from({length:12},(_,index)=>({label:months[index],value:0}));rows.forEach(row=>monthly[row.date.getMonth()].value+=row.amount);
 const observed=monthly.filter(item=>item.value>0),xMean=(observed.length-1)/2,yMean=observed.reduce((sum,item)=>sum+item.value,0)/(observed.length||1);
 const slope=observed.reduce((sum,item,index)=>sum+(index-xMean)*(item.value-yMean),0)/(observed.reduce((sum,item,index)=>sum+(index-xMean)**2,0)||1);
 const nextMonths=[1,2,3].map(offset=>{const index=observed.length-1+offset;return {label:`Mes +${offset}`,value:Math.max(0,yMean+slope*(index-xMean))}});
 const cityRows=locations.map((city,index)=>[index+1,escapeHtml(city.label),money(city.value),`${((city.value/(total||1))*100).toFixed(1)}%`]);
 const projectionRows=nextMonths.map(item=>[item.label,money(item.value)]);
 return `<div class="report-header"><h2>📊 REPORTE - DATASTORE S.A.C.</h2><p><b>Fecha:</b> ${new Date().toLocaleString("es-PE")}</p><p><b>Registros:</b> ${num(rows.length)} · <b>Ventas:</b> ${money(total)}</p></div><div class="report-kpis"><div><b>Total ventas</b><strong>${money(total)}</strong></div><div><b>Transacciones</b><strong>${num(rows.length)}</strong></div><div><b>Productos</b><strong>${num(quantity)}</strong></div><div><b>Promedio</b><strong>${money(total/(rows.length||1))}</strong></div></div><h3>Principales resultados</h3>${table(["Indicador","Resultado"],[["Producto más vendido",escapeHtml(products[0]?.label||"N/D")],["Categoría líder",escapeHtml(categories[0]?.label||"N/D")],["Sede líder",escapeHtml(locations[0]?.label||"N/D")]])}<h3>Comparación de ciudades</h3>${table(["Puesto","Ciudad / sede","Ventas","Participación"],cityRows)}<h3>Proyección empresarial</h3><p>La proyección utiliza la tendencia lineal de las ventas mensuales observadas. Sirve como referencia para planificar inventario, metas comerciales y presupuesto; no reemplaza un pronóstico financiero.</p>${table(["Período proyectado","Ventas estimadas"],projectionRows)}<p><b>Interpretación:</b> ${escapeHtml(products[0]?.label||"El conjunto seleccionado")} concentra la mayor demanda y ${escapeHtml(locations[0]?.label||"la sede líder")} encabeza la facturación. Se recomienda priorizar stock, comparar el desempeño de todas las ciudades y preparar recursos según la tendencia proyectada.</p>`;
}
function generateReport(){
 const rows=reportRows(),container=document.getElementById("reportContent");
 if(!rows.length){container.innerHTML='<p class="empty">No hay datos para los filtros seleccionados.</p>';return}
 container.innerHTML=reportHtml(rows);
}
function downloadReportFile(name,content,type){const blob=new Blob([content],{type}),link=document.createElement("a");link.href=URL.createObjectURL(blob);link.download=name;link.click();URL.revokeObjectURL(link.href)}
const csvInput=document.getElementById("csvFile");
if(csvInput) csvInput.addEventListener("change",e=>{
 const file=e.target.files[0];if(!file)return;
 const reader=new FileReader();
 reader.onload=async()=>{try{const rows=parseCsv(reader.result);if(prepare(rows)){document.getElementById("fileStatus").textContent=file.name+" cargado ("+num(state.rows.length)+")";populateFilters();update();const form=new FormData();form.append("file",file);try{const response=await fetch("/api/upload",{method:"POST",body:form,credentials:"same-origin"});if(response.ok){const j=await response.json();console.log('Mongo sync',j);} }catch{}}}catch(error){alert("Error leyendo CSV: "+error.message)}};
 reader.onerror=()=>alert("Error leyendo CSV");
 reader.readAsText(file,"UTF-8");
});
document.getElementById("applyFilters")?.addEventListener("click",update);
document.querySelectorAll(".nav-item").forEach(btn=>btn.addEventListener("click",()=>{
 document.querySelectorAll(".nav-item").forEach(x=>x.classList.remove("active"));
 document.querySelectorAll(".section").forEach(x=>x.classList.remove("active-section"));
 btn.classList.add("active");document.getElementById(btn.dataset.section).classList.add("active-section");
}));
document.getElementById("generateReportBtn")?.addEventListener("click",generateReport);
document.getElementById("downloadReportCSV")?.addEventListener("click",()=>{
 const rows=reportRows();if(!rows.length){alert("Carga el CSV primero.");return}
 const csv="Fecha,Producto,Categoria,Cantidad,Ventas,Sede\n"+rows.map(row=>[row.date.toISOString().slice(0,10),row.product,row.category,row.quantity,row.amount,row.location].map(value=>`"${String(value).replace(/"/g,'""')}"`).join(",")).join("\n");
 downloadReportFile("reporte_datastore.csv",csv,"text/csv;charset=utf-8");
});
document.getElementById("downloadReportHTML")?.addEventListener("click",()=>{const rows=reportRows();if(rows.length)downloadReportFile("reporte_datastore.html",`<!doctype html><html lang="es"><body>${reportHtml(rows)}</body></html>` ,"text/html;charset=utf-8")});
document.getElementById("downloadReportPDF")?.addEventListener("click",()=>{if(reportRows().length){generateReport();window.print()}});
document.getElementById("demoLoadBtn")?.addEventListener("click",async()=>{
 try{
   let text=null;
   for(const path of ["ventas.csv","./ventas.csv","/ventas.csv","../ventas.csv","public/ventas.csv"]){
     try{const r=await fetch(path); if(r.ok){text=await r.text(); break;}}catch{}
   }
   if(!text) throw new Error("No se encontró ventas.csv - usa Cargar ventas.csv");
   const rows=parseCsv(text);
   if(prepare(rows)){
     document.getElementById("fileStatus").textContent=`demo cargado: ${num(state.rows.length)} registros`;
     populateFilters(); update();
   }
 }catch(e){
   alert("No se pudo cargar demo: "+e.message+" — usa 'Cargar ventas.csv'");
 }
});
const landingView=document.getElementById("landingView");
const loginView=document.getElementById("loginView");
const dashboardView=document.getElementById("dashboardView");
const loginMessage=document.getElementById("loginMessage");
function showView(view){
 landingView.hidden=view!==landingView;
 loginView.hidden=view!==loginView;
 dashboardView.hidden=view!==dashboardView;
 window.scrollTo({top:0,behavior:"smooth"});
}
document.querySelectorAll("[data-open-login]").forEach(button=>button.addEventListener("click",()=>{
 showView(loginView);document.getElementById("loginUser").focus();
}));
document.querySelector("[data-close-login]")?.addEventListener("click",()=>showView(landingView));
document.getElementById("loginForm")?.addEventListener("submit",async event=>{
 event.preventDefault();
 const user=document.getElementById("loginUser").value.trim();
 const password=document.getElementById("loginPassword").value;
 if(!user||!password){loginMessage.textContent="Completa tu usuario y contraseña.";return}
 loginMessage.textContent="Verificando acceso...";
 try{
  const response=await fetch("/login",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({username:user,password})});
  const result=await response.json();
  if(!response.ok){loginMessage.textContent=result.error||"No se pudo iniciar sesión.";return}
  document.getElementById("sessionUser").textContent=`● ${result.user} · En línea`;
  loginMessage.textContent="";showView(dashboardView);
  // intentar precargar datos desde Mongo si hay
  try{
    const r=await fetch("/api/data",{credentials:"same-origin"});
    if(r.ok){
      const j=await r.json();
      if(j.data && j.data.length){
        // convertir mongo docs a formato interno si backend ya tiene datos
        // pero por ahora seguimos con CSV local
      }
    }
  }catch{}
 }catch{loginMessage.textContent="No se pudo conectar con el backend (¿docker compose up?)."}
});
document.querySelectorAll("[data-demo-login]").forEach(button=>button.addEventListener("click",()=>{
 loginMessage.textContent="Tip: usa admin / Admin123* (seed Docker)";
}));
document.querySelector("[data-demo-register]")?.addEventListener("click",()=>{
 loginMessage.textContent="El registro se gestiona en el backend Docker: POST /register";
});
document.getElementById("logoutButton")?.addEventListener("click",async()=>{
 await fetch("/logout",{method:"POST",credentials:"same-origin"}).catch(()=>{});
 await fetch("/api/logout",{method:"POST",credentials:"same-origin"}).catch(()=>{});
 clearData();
 if(state.liveTimer){clearInterval(state.liveTimer);state.liveTimer=null;}
 const dot=document.getElementById("liveDot"); if(dot) dot.classList.remove("on");
 const lab=document.getElementById("liveLabel"); if(lab) lab.textContent="Tiempo real: OFF";
 const tog=document.getElementById("liveToggle"); if(tog) tog.checked=false;
 showView(landingView);
});
// auto-login check - sin bloquear si backend no responde (Docker)
fetch("/me",{credentials:"same-origin"}).then(async response=>{
 if(!response.ok) return;
 const result=await response.json();
 if(result.authenticated) {
   document.getElementById("sessionUser").textContent=`● ${result.user} · En línea`;
   showView(dashboardView);
 }
}).catch(()=>{});
fetch("/api/auth/me",{credentials:"same-origin"}).then(async r=>{
 if(r.ok){
   const j=await r.json();
   if(j.authenticated) {
     document.getElementById("sessionUser").textContent=`● ${j.user} · En línea`;
     showView(dashboardView);
   }
 }
}).catch(()=>{});
// init
bindRangeSync();
initPanelEvents();
["yearFilter","monthFilter","locationFilter"].forEach(id=>{
 const el=document.getElementById(id);
 if(el) el.addEventListener("change",schedulePanel);
});
// expose for chips inline
window.toggleSelection=toggleSelection;
window.schedulePanel=schedulePanel;
