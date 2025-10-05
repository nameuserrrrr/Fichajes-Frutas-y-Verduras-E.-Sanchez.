
/* Parte de Horas v6.8 — professional clean */
const STORAGE_KEY="parte_horas_v68";

function safeParse(raw, fb){ try{ return JSON.parse(raw); }catch{ return fb; } }
function loadState(){
  let raw=localStorage.getItem(STORAGE_KEY);
  if(!raw){
    const now=new Date();
    const users=(window.SEED_USERS||[]).map(u=>({...u,password:u.password||u.dni}));
    const state={users,data:{},view:{year:now.getFullYear(),month:now.getMonth()},currentUser:null};
    localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
    return state;
  }
  const s=safeParse(raw,null); if(!s){ localStorage.removeItem(STORAGE_KEY); return loadState(); }
  s.data=s.data||{}; s.view=s.view||{year:new Date().getFullYear(),month:new Date().getMonth()};
  return s;
}
function saveState(s,notify=true){ localStorage.setItem(STORAGE_KEY,JSON.stringify(s)); if(notify) document.dispatchEvent(new CustomEvent("state-updated")); }

function ymd(y,m,d){ return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`; }
function daysInMonth(y,m){ return new Date(y,m+1,0).getDate(); }
function isSunday(y,m,d){ return new Date(y,m,d).getDay()===0; }
function monthNameES(m){ return ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"][m]; }
function minutesFromHHMM(v){ if(!v||v==="—"||v==="Fiesta"||v==="Incapacitado/a") return null; const [h,mm]=v.split(":").map(Number); return h*60+mm; }
function hhmm(min){ if(min==null) return "00:00"; const h=Math.floor(min/60),m=min%60; return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`; }
function computeDailyTotal(ent1, salComida, ent2, sal){
  const codes=[ent1,salComida,ent2,sal];
  if(codes.includes("Fiesta")||codes.includes("Incapacitado/a")) return {minutes:0,fiesta:codes.includes("Fiesta"),incap:codes.includes("Incapacitado/a")};
  const m1=minutesFromHHMM(ent1), ml=minutesFromHHMM(salComida), m2=minutesFromHHMM(ent2), me=minutesFromHHMM(sal);
  if(m1==null||ml==null||m2==null||me==null) return {minutes:null,fiesta:false,incap:false};
  let first=ml-m1, second=me-m2; if(first<0||second<0) return {minutes:null,fiesta:false,incap:false}; return {minutes:first+second,fiesta:false,incap:false};
}
function hourOptions(){ const opts=["—","Fiesta","Incapacitado/a"]; const push=(h,m)=>opts.push(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`); for(let h=8; h<24; h++){ push(h,0); push(h,30);} opts.push("00:00"); return opts; }
const HOUR_OPTIONS=hourOptions();
function Select({value,onChange,disabled}){ const sel=document.createElement("select"); HOUR_OPTIONS.forEach(opt=>{ const o=document.createElement("option"); o.value=opt; o.textContent=opt; sel.appendChild(o); }); sel.value=value??"—"; if(disabled) sel.disabled=true; sel.addEventListener("change",e=>onChange(e.target.value)); return sel; }

function header(state,title,extraRight){
  const h=document.createElement("div"); h.className="header no-print";
  h.innerHTML=`<img src="${window.APP_LOGO||""}"/><h1>${title}</h1><span class="badge">${monthNameES(state.view.month)} ${state.view.year} — ${window.__APP_VERSION__||""}</span>
  <div class="right flex">${state.currentUser?`<span>${state.currentUser.name||state.currentUser.username}</span>`:""}${state.currentUser?'<button class="ghost" id="logout">Salir</button>':""}</div>`;
  h.querySelector("#logout")?.addEventListener("click",()=>{ delete state.currentUser; saveState(state); loginView(state); });
  if(extraRight) h.appendChild(extraRight);
  return h;
}

// Simple modal for Observaciones (user view)
function ensureModal(){
  let modal=document.getElementById("obsModal");
  if(modal) return modal;
  modal=document.createElement("div"); modal.id="obsModal";
  modal.style.position="fixed"; modal.style.inset="0"; modal.style.background="rgba(0,0,0,.45)";
  modal.style.display="none"; modal.style.alignItems="center"; modal.style.justifyContent="center"; modal.style.zIndex="9999";
  modal.innerHTML=`<div style="background:#fff;border-radius:12px;max-width:600px;width:90%;padding:16px;border:1px solid #e5e7eb">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <div id="obsTitle" style="font-weight:800"></div>
      <button id="obsClose" class="ghost">Cerrar</button>
    </div>
    <div id="obsBody" style="white-space:pre-wrap;line-height:1.4"></div>
  </div>`;
  document.body.appendChild(modal);
  modal.querySelector("#obsClose").addEventListener("click",()=>{ modal.style.display="none"; });
  modal.addEventListener("click",(e)=>{ if(e.target===modal) modal.style.display="none"; });
  return modal;
}
function showObsModal(title, body){
  const m=ensureModal();
  m.querySelector("#obsTitle").textContent=title||"Observación";
  m.querySelector("#obsBody").textContent=body||"Sin observaciones";
  m.style.display="flex";
}

function monthSwitcher(state,onChange){
  const wrap=document.createElement("div"); wrap.className="no-print";
  const prev=document.createElement("button"); prev.className="ghost"; prev.textContent="◀ Mes anterior";
  const next=document.createElement("button"); next.className="ghost"; next.textContent="Mes siguiente ▶";
  const today=document.createElement("button"); today.className="ghost"; today.textContent="Hoy";
  prev.onclick=()=>{ if(state.view.month===0){state.view.month=11;state.view.year--;} else state.view.month--; saveState(state); onChange(); };
  next.onclick=()=>{ if(state.view.month===11){state.view.month=0;state.view.year++;} else state.view.month++; saveState(state); onChange(); };
  today.onclick=()=>{ const n=new Date(); state.view.month=n.getMonth(); state.view.year=n.getFullYear(); saveState(state); onChange(); };
  wrap.append(prev,today,next);
  return wrap;
}

function ensureMonthData(state,username){
  const key=`y${state.view.year}m${state.view.month}`;
  state.data[key]=state.data[key]||{};
  state.data[key][username]=state.data[key][username]||{days:{}};
  saveState(state,false);
  return {monthKey:key,sheet:state.data[key][username]};
}

function timesheetTable(state,user,{showObservations=false, obsMode='admin'}={}){
  const {sheet}=ensureMonthData(state,user.username); const days=daysInMonth(state.view.year,state.view.month);
  const table=document.createElement("table"); const thead=document.createElement("thead");
  thead.innerHTML=`<tr><th>Día</th><th>Fecha</th><th>Entrada</th><th>Salida comida</th><th>Entrada</th><th>Salida</th><th>Total día</th>${showObservations?'<th>Obs.</th>':''}</tr>`;
  table.appendChild(thead);
  const tbody=document.createElement("tbody");
  for(let d=1; d<=days; d++){
    const date=new Date(state.view.year,state.view.month,d);
    const key=ymd(state.view.year,state.view.month,d);
    const row=sheet.days[key]||{};
    const tr=document.createElement("tr"); if(isSunday(state.view.year,state.view.month,d)) tr.classList.add("sunday");
    const tdDay=document.createElement("td"); tdDay.textContent=date.toLocaleDateString('es-ES',{weekday:'short'});
    const tdDate=document.createElement("td"); tdDate.textContent=date.toLocaleDateString('es-ES');
    const td1=document.createElement("td"), td2=document.createElement("td"), td3=document.createElement("td"), td4=document.createElement("td"), tdT=document.createElement("td");
    const update=()=>{
      const res=computeDailyTotal(row.ent1,row.salComida,row.ent2,row.sal);
      tr.classList.toggle("fiesta",!!res.fiesta); tr.classList.toggle("incap",!!res.incap);
      tdT.textContent=res.minutes==null?"—":hhmm(res.minutes);
      saveState(state);
    };
    td1.appendChild(Select({value:row.ent1,onChange:v=>{row.ent1=v; sheet.days[key]=row; update();}}));
    td2.appendChild(Select({value:row.salComida,onChange:v=>{row.salComida=v; sheet.days[key]=row; update();}}));
    td3.appendChild(Select({value:row.ent2,onChange:v=>{row.ent2=v; sheet.days[key]=row; update();}}));
    td4.appendChild(Select({value:row.sal,onChange:v=>{row.sal=v; sheet.days[key]=row; update();}}));
    const res=computeDailyTotal(row.ent1,row.salComida,row.ent2,row.sal);
    tdT.textContent=res.minutes==null?"—":hhmm(res.minutes);
    tr.classList.toggle("fiesta",!!res.fiesta); tr.classList.toggle("incap",!!res.incap);
    tr.append(tdDay,tdDate,td1,td2,td3,td4,tdT);
    
    if(showObservations){
      const tdObs=document.createElement("td");
      if(obsMode==='admin'){
        const inp=document.createElement("input"); inp.type="text"; inp.value=row.obs||"";
        inp.addEventListener("blur",()=>{ row.obs=inp.value; sheet.days[key]=row; saveState(state); });
        tdObs.appendChild(inp);
      }else{
        const btn=document.createElement("button"); btn.className="ghost"; btn.textContent="Ver";
        btn.addEventListener("click",()=>{
          const note=(row.obs||"Sin observaciones");
          showObsModal(`${date.toLocaleDateString('es-ES')} — Observación`, note);
        });
        tdObs.appendChild(btn);
      }
      tr.appendChild(tdObs);
    }
    
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  // Total mensual
  const {sheet: s2}=ensureMonthData(state,user.username);
  let min=0; for(const k in s2.days){ const r=computeDailyTotal(s2.days[k].ent1,s2.days[k].salComida,s2.days[k].ent2,s2.days[k].sal); if(r.minutes!=null) min+=r.minutes; }
  const tfoot=document.createElement("tfoot"); const trf=document.createElement("tr");
  trf.innerHTML=`<td colspan="${showObservations?7:6}" style="text-align:right">Total mensual</td><td>${hhmm(min)}</td>${showObservations?'<td></td>':''}`;
  tfoot.appendChild(trf); table.appendChild(tfoot);
  return table;
}

function totalMensual(state,user){
  const {sheet}=ensureMonthData(state,user.username);
  let min=0; for(const k in sheet.days){ const r=computeDailyTotal(sheet.days[k].ent1,sheet.days[k].salComida,sheet.days[k].ent2,sheet.days[k].sal); if(r.minutes!=null) min+=r.minutes; }
  return min;
}

function makeResumenTabla(state,users){
  const t=document.createElement("table"); t.innerHTML='<thead><tr><th>Persona</th><th>ETT</th><th>Total</th></tr></thead>';
  const tb=document.createElement("tbody");
  users.forEach(u=>{ const tr=document.createElement("tr"); tr.innerHTML=`<td style="text-align:left">${u.name}</td><td>${(u.ett||'').toUpperCase()}</td><td><b>${hhmm(totalMensual(state,u))}</b></td>`; tb.appendChild(tr); });
  t.appendChild(tb); return t;
}

function makeTriptychForPerson(state,user){
  const {sheet}=ensureMonthData(state,user.username); const days=daysInMonth(state.view.year,state.view.month);
  const box=document.createElement("div"); box.className="person-box"; const h=document.createElement("h4"); h.textContent=`${user.name} — Total: ${hhmm(totalMensual(state,user))}`;
  const grid=document.createElement("div"); grid.className="triptych-grid";
  const col=(start,end)=>{ const t=document.createElement("table"); t.innerHTML='<thead><tr><th>Día</th><th>Horas</th></tr></thead>'; const tb=document.createElement("tbody");
    for(let d=start; d<=Math.min(end,days); d++){ const key=ymd(state.view.year,state.view.month,d); const rd=sheet.days[key]||{}; const r=computeDailyTotal(rd.ent1,rd.salComida,rd.ent2,rd.sal);
      const tr=document.createElement("tr"); const tdD=document.createElement("td"); tdD.textContent=String(d); const tdH=document.createElement("td");
      const sun=isSunday(state.view.year,state.view.month,d);
      if(r?.fiesta){ tdH.textContent="F"; tdH.classList.add("fiesta"); }
      else if(r?.incap){ tdH.textContent="I"; tdH.classList.add("incap"); }
      else tdH.textContent=(r?.minutes==null)?"—":hhmm(r.minutes);
      if(sun) tdH.classList.add("is-sunday"); tr.append(tdD,tdH); tb.appendChild(tr);
    } t.appendChild(tb); return t; };
  grid.appendChild(col(1,10)); grid.appendChild(col(11,20)); grid.appendChild(col(21,31));
  box.appendChild(h); box.appendChild(grid); return box;
}

function renderETTPage(state, ettName){
  const ettKey=(ettName||"").toString().trim().toLowerCase();
  const users=state.users.filter(u=>u.role!=="admin" && (u.ett||"").toString().trim().toLowerCase()===ettKey);
  const page=document.createElement("div"); page.className="card ett-page";
  page.innerHTML=`<h2><img src="${window.APP_LOGO||""}" style="height:24px"> Partes Mensuales — ${monthNameES(state.view.month)} ${state.view.year} — ${(ettKey||"").toUpperCase()}</h2>`;
  const sum=document.createElement("div"); sum.className="summary"; sum.appendChild(makeResumenTabla(state,users)); page.appendChild(sum);
  users.forEach(u=>page.appendChild(makeTriptychForPerson(state,u)));
  const legend=document.createElement("div"); legend.className="legend"; legend.textContent="F = Fiesta | I = Incapacitado/a | Domingos en rojo";
  page.appendChild(legend);
  return page;
}

function loginView(state){
  const app=document.getElementById("app");
  app.innerHTML=`
  <div class="login">
    <div class="brand"><img src="${window.APP_LOGO||""}"><h1>Control de Horas — Frutas y Verduras E. Sánchez</h1></div>
    <div class="card">
      <h2>Ingreso <span class="version">${window.__APP_VERSION__||""}</span></h2>
      <div class="row">
        <div style="flex:1"><label>Usuario</label><input id="username" autocomplete="username"></div>
        <div style="flex:1"><label>Contraseña (DNI)</label><input id="password" type="password" autocomplete="current-password"></div>
      </div>
      <div class="row" style="margin-top:12px;gap:12px">
        <button id="btnLogin">Ingresar</button>
      </div>
    </div>
  </div>`;
  const doLogin=()=>{
    const u=document.getElementById("username").value.trim().toLowerCase();
    const p=document.getElementById("password").value.trim();
    const st=loadState();
    const user=(st.users||[]).find(x=>x.username.toLowerCase()===u);
    if(!user || (user.password??user.dni)!==p){ alert("Usuario o contraseña incorrectos."); return; }
    const n=new Date(); state.view={year:n.getFullYear(), month:n.getMonth()};
    state.currentUser=user; saveState(state); appView(state);
  };
  document.getElementById("btnLogin").onclick=doLogin;
  document.getElementById("username").addEventListener("keydown",e=>{ if(e.key==="Enter") doLogin(); });
  document.getElementById("password").addEventListener("keydown",e=>{ if(e.key==="Enter") doLogin(); });
}

function userView(state){
  const app=document.getElementById("app"); app.innerHTML="";
  const onMonth=()=>userView(state);
  app.appendChild(header(state,"Control de Horas — Frutas y Verduras E. Sánchez",monthSwitcher(state,onMonth)));
  const box=document.createElement("div"); box.className="container";
  const card=document.createElement("div"); card.className="card sheet";
  card.innerHTML=`<div class="flex" style="align-items:center;justify-content:space-between">
    <div>
      <div style="font-weight:800">${state.currentUser.name}</div>
      <div class="kicker">${state.currentUser.ett} • ${monthNameES(state.view.month)} ${state.view.year}</div>
    </div>
    <div class="right flex no-print">
      <button class="ghost" id="btnPrintSingle">Imprime aquí</button>
    </div>
  </div>`;
  card.appendChild(timesheetTable(state,state.currentUser,{showObservations:true, obsMode:'user'}));
  const logoPrint=document.createElement("div"); logoPrint.className="print-only";
  logoPrint.innerHTML=`<div style="display:flex;justify-content:center;margin-bottom:6px"><img src="${window.APP_LOGO||""}" style="height:28px"></div>`;
  card.insertBefore(logoPrint, card.firstChild);
  const leg=document.createElement("div"); leg.className="legend"; leg.textContent="F = Fiesta | I = Incapacitado/a | Domingos en rojo"; card.appendChild(leg);
  box.appendChild(card); app.appendChild(box);

  document.getElementById("btnPrintSingle").onclick=()=>{
    document.body.classList.add("print-individuals");
    document.body.classList.add("print-individuals-single");
    window.print();
    setTimeout(()=>{
      document.body.classList.remove("print-individuals-single");
      document.body.classList.remove("print-individuals");
    }, 600);
  };
}

function adminView(state){
  const app=document.getElementById("app"); app.innerHTML="";
  const re=()=>adminView(state);
  app.appendChild(header(state,"Panel de Gerencia",monthSwitcher(state,re)));
  const container=document.createElement("div"); container.className="container admin-layout";

  // Sidebar (only on Hojas)
  const side=document.createElement("div"); side.className="emp-list";
  const list=document.createElement("div"); side.appendChild(list);
  const usersNon=state.users.filter(u=>u.role!=="admin");
  let selectedUsername=usersNon[0]?.username||null;
  function renderList(){
    list.innerHTML=""; usersNon.forEach(u=>{
      const item=document.createElement("div"); item.className="emp-item"; item.innerHTML=`<span>${u.name}</span><span class="kicker">${u.ett}</span>`;
      if(u.username===selectedUsername) item.classList.add("active");
      item.onclick=()=>{ selectedUsername=u.username; renderList(); renderMain(); };
      list.appendChild(item);
    });
  }

  const main=document.createElement("div");
  const tabs=document.createElement("div"); tabs.className="tabs no-print";
  const t1=document.createElement("div"); t1.className="tab active"; t1.textContent="Hojas";
  const t2=document.createElement("div"); t2.className="tab"; t2.textContent="Partes (ETT)";
  const t3=document.createElement("div"); t3.className="tab"; t3.textContent="Configuración";
  const t4=document.createElement("div"); t4.className="tab"; t4.textContent="Observaciones";
  tabs.append(t1,t2,t3,t4); main.appendChild(tabs);
  const view=document.createElement("div"); main.appendChild(view);

  function applyLayoutForTab(){
    const isHojas=t1.classList.contains("active");
    side.style.display=isHojas?"block":"none";
    container.classList.toggle("full",!isHojas);
  }

  function renderMain(){
    applyLayoutForTab();
    if(t1.classList.contains("active")) mountHojas();
    else if(t2.classList.contains("active")) mountPartes();
    else if(t3.classList.contains("active")) mountConfig();
    else mountObservaciones();
  }

  function mountHojas(){
    view.innerHTML="";
    const top=document.createElement("div"); top.className="card no-print";
    const btn=document.createElement("button"); btn.className="print"; btn.textContent="Imprimir todo (individual)";
    top.appendChild(btn); view.appendChild(top);

    const u=state.users.find(x=>x.username===selectedUsername);
    if(u){
      const scard=document.createElement("div"); scard.className="card sheet screen-only";
      scard.innerHTML=`<h3>${u.name} — ${u.ett}</h3><div class="kicker">${monthNameES(state.view.month)} ${state.view.year}</div>`;
      scard.appendChild(timesheetTable(state,u,{showObservations:true}));
      const lg=document.createElement("div"); lg.className="legend"; lg.textContent="F = Fiesta | I = Incapacitado/a | Domingos en rojo"; scard.appendChild(lg);
      view.appendChild(scard);
    }
    const hidden=document.createElement("div"); hidden.className="no-print print-batch";
    usersNon.forEach(emp=>{
      const tmp=document.createElement("div"); tmp.className="card sheet print-only print-sheet";
      tmp.innerHTML=`<div class=\"print-only\" style=\"text-align:center; margin-bottom:6px\"><img src=\"${window.APP_LOGO||""}\" style=\"height:28px\"></div><h3>${emp.name} — ${emp.ett}</h3><div class=\"kicker\">${monthNameES(state.view.month)} ${state.view.year}</div>`;
      tmp.appendChild(timesheetTable(state,emp,{showObservations:false}));
      const lg=document.createElement("div"); lg.className="legend"; lg.textContent="F = Fiesta | I = Incapacitado/a | Domingos en rojo"; tmp.appendChild(lg);
      hidden.appendChild(tmp);
    });
    view.appendChild(hidden);
    btn.onclick=()=>{
      hidden.classList.remove("no-print");
      document.body.classList.add("print-individuals");
      window.print();
      setTimeout(()=>{
        hidden.classList.add("no-print");
        document.body.classList.remove("print-individuals");
      }, 600);
    };
  }

  function mountPartes(){
    view.innerHTML="";
    const card=document.createElement("div"); card.className="card partes";
    const controls=document.createElement("div"); controls.className="row no-print";
    const btn=document.createElement("button"); btn.className="print"; btn.textContent="Exportar o Imprimir";
    controls.append(btn); card.appendChild(controls);

    const adecco=renderETTPage(state,"adecco");
    const crit=renderETTPage(state,"crit"); crit.classList.add("page-break");
    card.appendChild(adecco); card.appendChild(crit);
    view.appendChild(card);
    btn.onclick=()=>window.print();
  }

  
  function mountObservaciones(){
    view.innerHTML="";
    const card=document.createElement("div"); card.className="card";
    // Controls: select persona (o "Todas")
    const controls=document.createElement("div"); controls.className="row";
    const selWrap=document.createElement("div"); selWrap.style.display="flex"; selWrap.style.gap="8px"; selWrap.style.alignItems="center";
    const lbl=document.createElement("label"); lbl.textContent="Persona:"; lbl.style.fontWeight="800";
    const sel=document.createElement("select"); const optAll=document.createElement("option"); optAll.value="__ALL__"; optAll.textContent="Todas"; sel.appendChild(optAll);
    const allUsers=state.users.filter(u=>u.role!=="admin");
    allUsers.forEach(u=>{ const o=document.createElement("option"); o.value=u.username; o.textContent=u.name; sel.appendChild(o); });
    selWrap.append(lbl,sel);
    controls.append(selWrap);
    card.appendChild(controls);

    const body=document.createElement("div"); body.style.marginTop="8px"; card.appendChild(body);

    function renderEditorFor(user){
      const wrap=document.createElement("div"); wrap.className="card"; wrap.style.marginTop="8px";
      const title=document.createElement("div"); title.style.display="flex"; title.style.justifyContent="space-between"; title.style.alignItems="center";
      title.innerHTML=`<div style="font-weight:800">${user.name} — ${user.ett}</div><div class="kicker">${monthNameES(state.view.month)} ${state.view.year}</div>`;
      wrap.appendChild(title);
      // Table: Día | Fecha | Observación
      const t=document.createElement("table");
      t.innerHTML='<thead><tr><th>Día</th><th>Fecha</th><th>Observación</th></tr></thead>';
      const tb=document.createElement("tbody");
      const days=daysInMonth(state.view.year,state.view.month);
      const {sheet}=ensureMonthData(state,user.username);
      for(let d=1; d<=days; d++){
        const key=ymd(state.view.year,state.view.month,d);
        const date=new Date(state.view.year,state.view.month,d);
        const row=sheet.days[key]||{};
        const tr=document.createElement("tr"); if(isSunday(state.view.year,state.view.month,d)) tr.classList.add("sunday");
        const tdD=document.createElement("td"); tdD.textContent=date.toLocaleDateString('es-ES',{weekday:'short'});
        const tdF=document.createElement("td"); tdF.textContent=date.toLocaleDateString('es-ES');
        const tdO=document.createElement("td");
        const inp=document.createElement("input"); inp.type="text"; inp.value=row.obs||""; inp.placeholder="Escribe una observación...";
        inp.addEventListener("blur",()=>{ row.obs=inp.value; sheet.days[key]=row; saveState(state); });
        tdO.appendChild(inp);
        tr.append(tdD,tdF,tdO); tb.appendChild(tr);
      }
      t.appendChild(tb); wrap.appendChild(t);
      return wrap;
    }

    function rerender(){
      body.innerHTML="";
      if(sel.value==="__ALL__"){
        allUsers.forEach(u=> body.appendChild(renderEditorFor(u)));
      }else{
        const u=allUsers.find(x=>x.username===sel.value);
        if(u) body.appendChild(renderEditorFor(u));
      }
    }
    sel.addEventListener("change",rerender);
    rerender();
    view.appendChild(card);
  }

function mountConfig(){
    view.innerHTML="";
    const card=document.createElement("div"); card.className="card";
    card.innerHTML=`<div class="flex"><div style="font-weight:800">Configuración de usuarios</div>
      <div class="right"><button class="ghost" id="btnAdd">Añadir persona</button></div></div>
      <table id="tblUsers"><thead><tr><th>Nombre</th><th>Usuario</th><th>DNI / Contraseña</th><th>ETT</th><th>Rol</th><th class="no-print">Acciones</th></tr></thead><tbody></tbody></table>
      <div class="kicker">* Cambia el rol entre "user" y "admin". No dejes el sistema sin administradores.</div>`;
    const tbody=card.querySelector("tbody");
    function render(){
      tbody.innerHTML="";
      state.users.forEach((u,idx)=>{
        const tr=document.createElement("tr");
        tr.innerHTML=`
          <td contenteditable="true">${u.name}</td>
          <td contenteditable="true">${u.username}</td>
          <td contenteditable="true">${u.password||u.dni||""}</td>
          <td contenteditable="true">${u.ett||""}</td>
          <td></td>
          <td class="no-print">${u.username==='gerencia'?'':'<button class="danger btnDel">Eliminar</button>'}</td>`;
        const tdRole=tr.querySelectorAll("td")[4];
        const sel=document.createElement("select");
        ["user","admin"].forEach(r=>{ const o=document.createElement("option"); o.value=r; o.textContent=r; if(u.role===r) o.selected=true; sel.appendChild(o); });
        tdRole.appendChild(sel);
        const save=()=>{
          const tds=tr.querySelectorAll("td");
          state.users[idx]={ name:tds[0].innerText.trim(), username:tds[1].innerText.trim(), password:tds[2].innerText.trim(), dni:tds[2].innerText.trim(), ett:tds[3].innerText.trim(), role:sel.value };
          saveState(state);
        };
        tr.querySelectorAll("td[contenteditable]").forEach(c=>c.addEventListener("blur",save));
        sel.addEventListener("change",save);
        tr.querySelector(".btnDel")?.addEventListener("click",()=>{ if(!confirm("¿Eliminar este usuario?")) return; state.users.splice(idx,1); saveState(state); render(); });
        tbody.appendChild(tr);
      });
    }
    render();
    card.querySelector("#btnAdd").addEventListener("click",()=>{ state.users.push({name:"Nuevo/a",username:`user${Date.now()%1000}`,dni:"",password:"",ett:"",role:"user"}); saveState(state); render(); });
    view.appendChild(card);
  }

  renderList(); renderMain();
  t1.onclick=()=>{ t1.classList.add("active"); t2.classList.remove("active"); t3.classList.remove("active"); t4.classList.remove("active"); renderMain(); };
  t2.onclick=()=>{ t2.classList.add("active"); t1.classList.remove("active"); t3.classList.remove("active"); t4.classList.remove("active"); renderMain(); };
  t3.onclick=()=>{ t3.classList.add("active"); t1.classList.remove("active"); t2.classList.remove("active"); t4.classList.remove("active"); renderMain(); };
  const onT4=()=>{ t4.classList.add("active"); t1.classList.remove("active"); t2.classList.remove("active"); t3.classList.remove("active"); renderMain(); };
  t4.onclick=onT4;

  container.appendChild(side); container.appendChild(main); app.appendChild(container);

  document.addEventListener("state-updated",()=>{ renderList(); renderMain(); });
  window.addEventListener("storage",(e)=>{ if(e.key===STORAGE_KEY){ const nv=safeParse(e.newValue,null); if(nv){ Object.assign(state,nv); renderList(); renderMain(); } } });
}

function appView(state){
  if(!state.currentUser){ loginView(state); return; }
  const n=new Date(); state.view={year:n.getFullYear(),month:n.getMonth()}; saveState(state,false);
  if(state.currentUser.role==="admin") adminView(state); else userView(state);
}

const state=loadState();
if(state.currentUser){ appView(state); } else { loginView(state); }
