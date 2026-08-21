const state={rows:[],filtered:[],charts:{},mapping:{},headers:[]};
const months=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

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
 state.rows=rows.map(r=>({
   date:parseDate(r[mapping.date]),
   product:String(r[mapping.product]??"Sin producto"),
   category:String(r[mapping.category]??"Sin categoría"),
   quantity:parseNumber(r[mapping.quantity]),
   amount:hasAmountColumn?parseNumber(r[mapping.amount]):parseNumber(r[mapping.quantity])*parseNumber(r[mapping.amount]),
   location:String(r[mapping.location]??"Sin sede")
 })).filter(r=>r.date&&!isNaN(r.date));
 return true;
}
function group(rows,key,metric){
 const m=new Map();
 rows.forEach(r=>m.set(r[key],(m.get(r[key])||0)+r[metric]));
 return [...m.entries()].map(([label,value])=>({label,value})).sort((a,b)=>b.value-a.value);
}
function money(v){return "S/ "+Number(v).toLocaleString("es-PE",{minimumFractionDigits:2,maximumFractionDigits:2})}
function num(v){return Number(v).toLocaleString("es-PE")}
function set(id,v){document.getElementById(id).textContent=v}

function filteredRows(){
 let rows=[...state.rows];
 const y=document.getElementById("yearFilter").value;
 const m=document.getElementById("monthFilter").value;
 const l=document.getElementById("locationFilter").value;
 if(y!=="all")rows=rows.filter(r=>r.date.getFullYear()==y);
 if(m!=="all")rows=rows.filter(r=>r.date.getMonth()+1==m);
 if(l!=="all")rows=rows.filter(r=>r.location===l);
 return rows;
}
function populateFilters(){
 const years=[...new Set(state.rows.map(r=>r.date.getFullYear()))].sort();
 const locations=[...new Set(state.rows.map(r=>r.location))].sort();
 document.getElementById("yearFilter").innerHTML='<option value="all">Todos</option>'+years.map(y=>`<option>${y}</option>`).join("");
 document.getElementById("locationFilter").innerHTML='<option value="all">Todos</option>'+locations.map(x=>`<option>${escapeHtml(x)}</option>`).join("");
 document.getElementById("reportYearFilter").innerHTML='<option value="all">Todos</option>'+years.map(y=>`<option>${y}</option>`).join("");
 document.getElementById("reportLocationFilter").innerHTML='<option value="all">Todos</option>'+locations.map(x=>`<option value="${escapeHtml(x)}">${escapeHtml(x)}</option>`).join("");
}
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
function destroyCharts(){Object.values(state.charts).forEach(c=>c.destroy());state.charts={}}
function clearData(){
 state.rows=[];state.filtered=[];destroyCharts();
 ["totalSales","transactions","productsSold","topProduct","topLocation","topProductShare","topLocationShare"].forEach(id=>set(id,["topProduct","topLocation","topProductShare","topLocationShare"].includes(id)?"—":id==="totalSales"?"S/ 0.00":"0"));
 document.getElementById("fileStatus").textContent="Sin archivo cargado";
 document.getElementById("reportContent").innerHTML='<p class="empty">Carga un CSV y genera un reporte con los filtros seleccionados.</p>';
}
function makeChart(id,type,labels,data,label,extra={}){
 const ctx=document.getElementById(id);
 if(!ctx)return;
 state.charts[id]=new Chart(ctx,{type,data:{labels,datasets:[{label,data,borderWidth:2,fill:type==="line",tension:.3,backgroundColor:["#1769ff","#6c4cff","#19a974","#f59e0b","#8b95a8","#e65f8a","#00a8cc"],borderColor:"#1769ff"}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:type==="doughnut"}},scales:type==="doughnut"?{}:{y:{beginAtZero:true}},...extra}});
}
function update(){
 state.filtered=filteredRows();const rows=state.filtered;if(!rows.length){alert("No hay datos para los filtros seleccionados.");return}
 const total=rows.reduce((s,r)=>s+r.amount,0), qty=rows.reduce((s,r)=>s+r.quantity,0);
 const products=group(rows,"product","quantity"),locs=group(rows,"location","amount");
 set("totalSales",money(total));set("transactions",num(rows.length));set("productsSold",num(Math.round(qty)));
 set("topProduct",products[0]?.label||"—");set("topProductShare",products[0]?((products[0].value/qty)*100).toFixed(1)+"% de unidades":"—");
 set("topLocation",locs[0]?.label||"—");set("topLocationShare",locs[0]?((locs[0].value/total)*100).toFixed(1)+"% de ventas":"—");
 destroyCharts();

 const monthly=Array.from({length:12},(_,i)=>({label:months[i],value:0}));
 rows.forEach(r=>monthly[r.date.getMonth()].value+=r.amount);
 const cat=group(rows,"category","amount"), top=products.slice(0,10), bottom=[...products].reverse().slice(0,10);
 const l=locs, cq=group(rows,"category","quantity");

 makeChart("monthlyChart","line",monthly.map(x=>x.label),monthly.map(x=>x.value),"Ventas (S/)");
 makeChart("categoryChart","bar",cat.map(x=>x.label),cat.map(x=>x.value),"Ventas (S/)");
 makeChart("topProductsChart","bar",top.map(x=>x.label),top.map(x=>x.value),"Unidades",{indexAxis:"y"});
 makeChart("bottomProductsChart","bar",bottom.map(x=>x.label),bottom.map(x=>x.value),"Unidades",{indexAxis:"y"});
 makeChart("locationChart","bar",l.map(x=>x.label),l.map(x=>x.value),"Ventas (S/)");
 makeChart("categoryQuantityChart","doughnut",cq.map(x=>x.label),cq.map(x=>x.value),"Unidades");
 makeChart("locationCompareChart","bar",l.map(x=>x.label),l.map(x=>x.value),"Ventas (S/)");
 makeChart("evolutionChart","line",monthly.map(x=>x.label),monthly.map(x=>x.value),"Ventas (S/)");

 renderTables(rows,cat,products,l);
 renderAnalysis(rows,products,cat,l);
}
function table(headers,rows){
 return `<div class="table-wrap"><table class="data-table"><thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(x=>`<td>${x}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}
function renderTables(rows,cat,products,locs){
 const total=rows.reduce((s,r)=>s+r.amount,0);
 document.getElementById("summaryTable").innerHTML=table(["Indicador","Resultado"],[
 ["Total de ventas",money(total)],["Transacciones",num(rows.length)],
 ["Productos vendidos",num(Math.round(rows.reduce((s,r)=>s+r.quantity,0)))],
 ["Promedio de venta",money(total/rows.length)]
 ]);
 document.getElementById("topFiveTable").innerHTML=table(["Producto","Unidades","%"],products.slice(0,5).map(x=>[escapeHtml(x.label),num(x.value),((x.value/rows.reduce((s,r)=>s+r.quantity,0))*100).toFixed(1)+"%"]));
 document.getElementById("periodTable").innerHTML=table(["Mes","Ventas"],months.map((m,i)=>[m,money(rows.filter(r=>r.date.getMonth()===i).reduce((s,r)=>s+r.amount,0))]));
 document.getElementById("categoryTable").innerHTML=table(["Categoría","Ventas"],cat.map(x=>[escapeHtml(x.label),money(x.value)]));
 document.getElementById("productsTopTable").innerHTML=table(["Producto","Unidades"],products.slice(0,15).map(x=>[escapeHtml(x.label),num(x.value)]));
 document.getElementById("productsBottomTable").innerHTML=table(["Producto","Unidades"],[...products].reverse().slice(0,15).map(x=>[escapeHtml(x.label),num(x.value)]));
 document.getElementById("locationsTable").innerHTML=table(["Sede / Ciudad","Ventas"],locs.map(x=>[escapeHtml(x.label),money(x.value)]));
}
function renderAnalysis(rows,products,cat,locs){
 const total=rows.reduce((s,r)=>s+r.amount,0);
  const monthlyTotals = Array.from({length:12}, (_,i) =>
    rows.filter(r => r.date.getMonth() === i).reduce((s,r) => s + r.amount, 0)
  );
  const maxVenta = Math.max(...monthlyTotals);
  const bestMonthIndex = monthlyTotals.indexOf(maxVenta);
  const bestMonth = (maxVenta > 0) ? months[bestMonthIndex] : "Sin datos en el período";
  
 const cards=[
  ["Producto con mayor demanda",`${products[0]?.label||"N/D"} concentra la mayor cantidad de unidades vendidas.`,`Es el producto con mayor demanda y presenta riesgo de desabastecimiento si no se controla su inventario.`,`Se recomienda revisar su stock y mantener seguimiento de la demanda.`],
  ["Categoría líder",`${cat[0]?.label||"N/D"} registra las mayores ventas monetarias (${money(cat[0]?.value||0)}).`,`La categoría concentra el mayor valor comercial y tiene un impacto importante en los ingresos.`,`Conviene priorizar inventario y acciones comerciales para esta categoría.`],
  ["Período de mayor venta",`${bestMonth} presenta el mayor nivel de ventas dentro de los datos filtrados.`,`El comportamiento observado permite anticipar períodos de alta demanda.`,`La empresa puede preparar inventario y campañas antes de los períodos de alta demanda.`],
  ["Sede líder",`${locs[0]?.label||"N/D"} concentra la mayor facturación (${money(locs[0]?.value||0)}).`,`La sede puede servir como referencia para comparar prácticas comerciales y operativas.`,`Analizar sus buenas prácticas y compararlas con sedes de menor rendimiento.`],
  ["Resultado general",`El conjunto analizado representa ${money(total)} en ventas.`,`Este valor resume el rendimiento del período seleccionado y permite establecer una línea base.`,`Utilizar este resultado como línea base para comparar períodos futuros.`]
 ];
 document.getElementById("analysisCards").innerHTML=cards.map((c,i)=>`<article class="insight"><h3>Análisis ${i+1}: ${c[0]}</h3><p><b>Resultado:</b> ${c[1]}</p><p><b>Interpretación:</b> ${c[2]}</p><p><b>Decisión propuesta:</b> ${c[3]}</p></article>`).join("");
}
document.getElementById("csvFile").addEventListener("change",e=>{
 const file=e.target.files[0];if(!file)return;
 const reader=new FileReader();
 reader.onload=async()=>{try{const rows=parseCsv(reader.result);if(prepare(rows)){document.getElementById("fileStatus").textContent=file.name+" cargado";populateFilters();update();const form=new FormData();form.append("file",file);const response=await fetch("/api/upload",{method:"POST",body:form,credentials:"same-origin"});if(!response.ok)console.error("No se pudo guardar el CSV en D1");}}catch(error){alert("Error leyendo CSV: "+error.message)}};
 reader.onerror=()=>alert("Error leyendo CSV");
 reader.readAsText(file,"UTF-8");
});
document.getElementById("applyFilters").addEventListener("click",update);
document.querySelectorAll(".nav-item").forEach(btn=>btn.addEventListener("click",()=>{
 document.querySelectorAll(".nav-item").forEach(x=>x.classList.remove("active"));
 document.querySelectorAll(".section").forEach(x=>x.classList.remove("active-section"));
 btn.classList.add("active");document.getElementById(btn.dataset.section).classList.add("active-section");
}));
function reportRows(){
 const year=document.getElementById("reportYearFilter").value;
 const month=document.getElementById("reportMonthFilter").value;
 const location=document.getElementById("reportLocationFilter").value;
 return state.rows.filter(row=>(year==="all"||row.date.getFullYear()==year)&&(month==="all"||row.date.getMonth()+1==month)&&(location==="all"||row.location===location));
}
function reportHtml(rows){
 const total=rows.reduce((sum,row)=>sum+row.amount,0),quantity=rows.reduce((sum,row)=>sum+row.quantity,0);
 const products=group(rows,"product","quantity"), categories=group(rows,"category","amount"), locations=group(rows,"location","amount");
 return `<div class="report-header"><h2>📊 REPORTE - DATASTORE S.A.C.</h2><p><b>Fecha:</b> ${new Date().toLocaleString("es-PE")}</p><p><b>Registros:</b> ${num(rows.length)} · <b>Ventas:</b> ${money(total)}</p></div><div class="report-kpis"><div><b>Total ventas</b><strong>${money(total)}</strong></div><div><b>Transacciones</b><strong>${num(rows.length)}</strong></div><div><b>Productos</b><strong>${num(quantity)}</strong></div><div><b>Promedio</b><strong>${money(total/(rows.length||1))}</strong></div></div><h3>Principales resultados</h3>${table(["Indicador","Resultado"],[["Producto más vendido",escapeHtml(products[0]?.label||"N/D")],["Categoría líder",escapeHtml(categories[0]?.label||"N/D")],["Sede líder",escapeHtml(locations[0]?.label||"N/D")]])}<p><b>Interpretación:</b> ${escapeHtml(products[0]?.label||"El conjunto seleccionado")} concentra la mayor demanda. Se recomienda priorizar stock y revisar la estrategia comercial de las categorías y sedes líderes.</p>`;
}
function generateReport(){
 const rows=reportRows(),container=document.getElementById("reportContent");
 if(!rows.length){container.innerHTML='<p class="empty">No hay datos para los filtros seleccionados.</p>';return}
 container.innerHTML=reportHtml(rows);
}
function downloadReportFile(name,content,type){const blob=new Blob([content],{type}),link=document.createElement("a");link.href=URL.createObjectURL(blob);link.download=name;link.click();URL.revokeObjectURL(link.href)}
document.getElementById("generateReportBtn").addEventListener("click",generateReport);
document.getElementById("downloadReportCSV").addEventListener("click",()=>{
 const rows=reportRows();if(!rows.length){alert("Carga el CSV primero.");return}
 const csv="Fecha,Producto,Categoria,Cantidad,Ventas,Sede\n"+rows.map(row=>[row.date.toISOString().slice(0,10),row.product,row.category,row.quantity,row.amount,row.location].map(value=>`"${String(value).replace(/"/g,'""')}"`).join(",")).join("\n");
 downloadReportFile("reporte_datastore.csv",csv,"text/csv;charset=utf-8");
});
document.getElementById("downloadReportHTML").addEventListener("click",()=>{const rows=reportRows();if(rows.length)downloadReportFile("reporte_datastore.html",`<!doctype html><html lang="es"><body>${reportHtml(rows)}</body></html>` ,"text/html;charset=utf-8")});
document.getElementById("downloadReportPDF").addEventListener("click",()=>{if(reportRows().length){generateReport();window.print()}});

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
document.querySelector("[data-close-login]").addEventListener("click",()=>showView(landingView));
document.getElementById("loginForm").addEventListener("submit",async event=>{
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
 }catch{loginMessage.textContent="No se pudo conectar con el servicio de autenticación."}
});
document.querySelectorAll("[data-demo-login]").forEach(button=>button.addEventListener("click",()=>{
 loginMessage.textContent="Usa las credenciales creadas en D1 para ingresar.";
}));
document.querySelector("[data-demo-register]").addEventListener("click",()=>{
 loginMessage.textContent="El registro se gestiona mediante el servicio seguro de DATASTORE.";
});
document.getElementById("logoutButton").addEventListener("click",async()=>{
 await fetch("/logout",{method:"POST",credentials:"same-origin"});
 clearData();
 showView(landingView);
});
fetch("/me",{credentials:"same-origin"}).then(async response=>{
 if(!response.ok)return;
 const result=await response.json();
 document.getElementById("sessionUser").textContent=`● ${result.user} · En línea`;
 showView(dashboardView);
}).catch(()=>{});
