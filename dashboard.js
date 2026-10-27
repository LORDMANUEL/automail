const API=globalThis.messenger||globalThis.browser;
const $=id=>document.getElementById(id);
const state={nativeShown:60,jobs:[],people:[],templates:[],settings:{},identities:[],contacts:[],month:new Date(new Date().getFullYear(),new Date().getMonth(),1),selectedDay:"",page:"inicio",templateId:"",refreshing:false,lists:[],contactGroups:[],selectedContactIds:new Set(),manualPhotoId:null,contactPhotos:{}};
const pad=n=>String(n).padStart(2,"0");
const localDay=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const isoTime=d=>`${localDay(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const humanDate=t=>new Date(t).toLocaleString("es-HN",{dateStyle:"medium",timeStyle:"short"});
const fmtMonth=d=>d.toLocaleDateString("es-HN",{month:"long",year:"numeric"});
const safeString=s=>String(s??"");
const esc=s=>safeString(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
const validEmail=s=>/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(s);
const norm=s=>safeString(s).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
const create=(tag,cls,txt)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=txt;return e;};
async function call(type,data={}){return API.runtime.sendMessage({type,...data});}
function toast(message,kind="ok",subtitle=""){const t=create("div","toast "+(kind==="error"?"error":kind==="sending"?"sending":""));const ico=create("span",null,kind==="error"?"!":kind==="sending"?"➤":"✓");const wrap=create("div");wrap.append(create("b",null,message));if(subtitle)wrap.append(create("small",null,subtitle));t.append(ico,wrap);$("toastLayer").prepend(t);setTimeout(()=>t.remove(),6200);}
function nav(page){state.page=page;for(const item of document.querySelectorAll(".navitem"))item.classList.toggle("active",item.dataset.nav===page);for(const p of document.querySelectorAll(".page"))p.classList.toggle("active",p.dataset.page===page);$("topTitle").textContent=({inicio:"Inicio",calendario:"Calendario",redactar:"Redactar y programar",plantillas:"Plantillas HTML",personas:"Contactos y cumpleaños",configuracion:"Configuración"})[page]||page;if(page==="redactar"){renderSelectedContactCard();previewCompose();}if(page==="plantillas")previewTemplate();if(page==="personas"){renderNativeBirthdays();}}
function initNav(){for(const el of document.querySelectorAll("[data-nav]"))el.onclick=()=>nav(el.dataset.nav);for(const el of document.querySelectorAll("[data-goto]"))el.onclick=()=>nav(el.dataset.goto);$("quickCompose").onclick=()=>nav("redactar");}
function chooseTheme(mode){document.body.dataset.theme=mode;$("themeToggle").textContent=mode==="dark"?"☀":"☾";try{localStorage.setItem("cc_theme",mode);}catch(_){/*contexto de prueba*/}}
function initTheme(){let initial="auto";try{initial=localStorage.getItem("cc_theme")||"auto";}catch(_){}chooseTheme(initial);$("themeToggle").onclick=()=>chooseTheme(document.body.dataset.theme==="dark"?"light":"dark");}
async function refresh(notify=false){if(state.refreshing)return;state.refreshing=true;try{const data=await call("state");Object.assign(state,data);renderAll();if(notify)toast("Datos actualizados");}catch(e){toast("No se pudo actualizar el panel","error",e.message);}finally{state.refreshing=false;}}
function agendaPeople(){return state.contacts.filter(c=>c.birthday);}
function renderAll(){populateNativeAgendaFilter();renderStats();renderCalendar("miniCalendar",false);renderCalendar("bigCalendar",true);renderUpcoming();renderJobs();renderTemplates();renderPeople();renderNativeBirthdays();renderGroups();renderFooter();renderConfigOptions();}
function renderStats(){const c=s=>state.jobs.filter(j=>j.status===s).length;$("statPending").textContent=c("pending");$("statSent").textContent=c("sent");$("statReview").textContent=c("review");$("statPeople").textContent=agendaPeople().length;}
function datesForMonth(){const start=new Date(state.month.getFullYear(),state.month.getMonth(),1),offset=(start.getDay()+6)%7;return Array.from({length:42},(_,n)=>new Date(start.getFullYear(),start.getMonth(),n+1-offset));}
function renderCalendar(id,big){const parent=$(id);parent.replaceChildren();if(big)$("bigMonth").textContent=fmtMonth(state.month);else{const top=create("div","calendar-top");top.append(create("b",null,fmtMonth(state.month)));const b=create("button",null,"Ver calendario ↗");b.onclick=()=>nav("calendario");top.append(b);parent.append(top);const weekdays=create("div","weekdays");for(const wd of ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"])weekdays.append(create("span",null,wd));parent.append(weekdays);}
 const grid=create("div","days");const today=localDay(new Date());for(const d of datesForMonth()){
  const key=localDay(d),birthday=agendaPeople().some(p=>p.birthday?.slice(5)===key.slice(5)),relevant=state.jobs.filter(j=>localDay(new Date(j.at))===key&&j.status!=="cancelled"),pending=relevant.some(j=>j.status==="pending"),sent=relevant.some(j=>j.status==="sent");
  const btn=create("button","day"+(d.getMonth()!==state.month.getMonth()?" other":"")+(key===today?" today":"")+(key===state.selectedDay?" selected":""));btn.type="button";btn.title=[key,birthday?"Cumpleaños":"",relevant.length?`${relevant.length} correos`:"",birthday?agendaPeople().filter(p=>p.birthday?.slice(5)===key.slice(5)).map(p=>p.name).join(", "):""].filter(Boolean).join(" · ");btn.append(create("b",null,String(d.getDate())));const dots=create("div","dots");if(pending)dots.append(create("i","blue-dot"));if(birthday)dots.append(create("i","gold-dot"));if(sent)dots.append(create("i","green-dot"));btn.append(dots);btn.onclick=()=>{state.selectedDay=key;state.month=new Date(d.getFullYear(),d.getMonth(),1);renderCalendar("miniCalendar",false);renderCalendar("bigCalendar",true);renderJobs();if(!big)nav("calendario");};grid.append(btn);
 }parent.append(grid);
}
function nextBirthday(p){if(!p.birthday)return null;const [,,m,day]=p.birthday.match(/^(\d{4})-(\d{2})-(\d{2})$/)||[];if(!m)return null;const now=new Date();let date=new Date(now.getFullYear(),Number(m)-1,Number(day),12);for(let i=0;i<9;i++){const candidate=new Date(now.getFullYear()+i,Number(m)-1,Number(day),12);if(candidate.getMonth()===Number(m)-1&&localDay(candidate)>=localDay(now))return candidate;}return null;}
async function avatar(id,person){const a=create("div","avatar");a.textContent=(person.name||"?").split(/\s+/).slice(0,2).map(x=>x[0]).join("").toUpperCase();if(id){const data=await PhotoDB.get(id);if(data){const img=create("img");img.src=data;img.alt="";a.replaceChildren(img);}}return a;}
function renderUpcoming(){const parent=$("upcoming");parent.replaceChildren();const upcoming=agendaPeople().map(p=>({...p,next:nextBirthday(p)})).filter(p=>p.next).sort((a,b)=>a.next-b.next).slice(0,8);if(!upcoming.length)parent.append(create("p","muted","Agrega la fecha de cumpleaños en la vCard del contacto de Thunderbird."));for(const p of upcoming){const row=create("div","upcoming-person"),txt=create("div","person-text");txt.append(create("b",null,p.name),create("small",null,`${p.position||"Colaborador"} · ${p.branch||"Sin sucursal"}`));row.append(create("div","avatar",p.name.split(" ").map(x=>x[0]).slice(0,2).join("")),txt,create("span","date-chip",`${pad(p.next.getDate())}/${pad(p.next.getMonth()+1)}`));parent.append(row);contactPhotoFor(p).then(id=>avatar(id,p)).then(a=>{if(row.isConnected)row.replaceChild(a,row.firstChild);}).catch(console.warn);}}
function badge(status){return {pending:"Programado",sending:"Enviando",sent:"Enviado",review:"Revisar",cancelled:"Cancelado"}[status]||status;}
function jobRow(job){const row=create("div","job-row"),icon=create("div","stat-icon "+(job.status==="sent"?"green":"blue"),job.template?.includes("birthday")?"🎁":"✉"),copy=create("div","job-copy");const person=state.people.find(p=>p.id===job.personId);const displayName=job.personName||person?.name||"Destinatario";const displaySubject=(job.resolvedSubject||job.subject||"(Sin asunto)").replace(/\{\{\s*nombre\s*\}\}/gi,displayName).replace(/\{\{\s*empresa\s*\}\}/gi,state.settings.company||"Empresa");copy.append(create("b",null,displaySubject),create("small",null,`${job.mode==="broadcast"?`Comunicado CCO (${job.bcc?.length||0} personas)`:job.to} · ${humanDate(job.at)}`));const chip=create("span","status-pill "+job.status,badge(job.status));
 const totals={to:job.mode==="broadcast"?1:job.to?1:0,cc:job.cc?.length||0,bcc:job.bcc?.length||0};
 const count=totals.to+totals.cc+totals.bcc;
 copy.append(create("small","recipient-count",`${count} destinatario(s) preparados · Para ${totals.to} / CC ${totals.cc} / CCO ${totals.bcc}`));
 const inspect=create("button","tiny-btn","Ver participantes");inspect.type="button";
 inspect.onclick=()=>showRecipientsForJob(job);
 row.append(icon,copy,chip,inspect);if(["pending","sent","review","cancelled"].includes(job.status)){const actions=create("div","job-actions");if(job.status==="pending"){const cancel=create("button","tiny-btn","Cancelar");cancel.onclick=async()=>{if(confirm("¿Cancelar este envío?")){try{await call("cancel",{id:job.id});await refresh();toast("Envío cancelado");}catch(e){toast(e.message,"error");}}};actions.append(cancel);}else{const del=create("button","tiny-btn","×");del.title="Eliminar registro";del.onclick=async()=>{if(confirm("¿Eliminar registro? No modifica el correo ya enviado.")){await call("delete",{id:job.id});await refresh();}};actions.append(del);}row.append(actions);}if(job.error){row.title=job.error;chip.title=job.error;}return row;}
function renderJobs(){const recent=$("upcomingJobs"),all=$("allJobs");recent.replaceChildren();all.replaceChildren();const next=state.jobs.filter(j=>j.status==="pending").sort((a,b)=>a.at-b.at).slice(0,4);if(!next.length)recent.append(create("p","muted","No hay correos pendientes."));next.forEach(j=>recent.append(jobRow(j)));const filter=$("jobFilter").value;$("selectedDateLabel").textContent=state.selectedDay||"todas las fechas";const list=state.jobs.filter(j=>(!state.selectedDay||localDay(new Date(j.at))===state.selectedDay)&&(filter==="all"||j.status===filter)).sort((a,b)=>b.at-a.at).slice(0,150);if(!list.length)all.append(create("p","muted","No hay mensajes para este filtro."));list.forEach(j=>all.append(jobRow(j)));renderSelectedBirthdays();}
function renderSelectedBirthdays(){
 const wrap=$("selectedBirthdays");wrap.replaceChildren();
 const date=state.selectedDay||localDay(new Date()),match=agendaPeople().filter(p=>p.birthday?.slice(5)===date.slice(5));
 const h=create("div","birthday-day-heading");h.append(create("b",null,`🎂 Cumpleaños del ${date}: ${match.length}`));
 if(match.length&&date>=localDay(new Date())){const send=create("button","ghost small","Programar todos los cumpleaños");send.onclick=async()=>{if(!confirm(`¿Crear ${match.length} envío(s) PERSONALIZADOS para los cumpleaños del ${date}? No se programarán duplicados del mismo año.`))return;try{const result=await call("scheduleBirthdaysForDate",{date});await refresh();toast(`${result.count} cumpleaños programados`,"ok","Cada empleado tendrá su propia tarjeta y correo.");}catch(e){toast(e.message,"error");}};h.append(send);}wrap.append(h);
 if(!match.length){wrap.append(create("p","muted","No hay cumpleaños registrados para esta fecha."));return;}
 for(const p of match){const r=create("div","birthday-line");r.append(create("span",null,"🎁"),create("b",null,p.name),create("small",null,`${p.code||"Sin código"} · ${p.position||"Sin puesto"} · ${p.email}`));wrap.append(r);}
}
function renderTemplates(){const tlist=$("templateList"),featured=$("featuredTemplates");tlist.replaceChildren();featured.replaceChildren();for(const t of state.templates){const item=create("button","stack-item"+(t.id===state.templateId?" selected":""));item.append(create("b",null,`${t.category==="birthday"?"🎉":"📣"} ${t.name}`),create("small",null,t.subject));item.onclick=()=>loadTemplate(t.id);tlist.append(item);if(featured.childElementCount<4){const tile=create("button","template-tile");tile.append(create("span","tile-icon",t.category==="birthday"?"🎉":"📣"),create("b",null,t.name),create("small",null,"Personalizable con código HTML"));tile.onclick=()=>{chooseComposeTemplate(t.id);nav("redactar");};featured.append(tile);}}if(!state.templateId&&state.templates.length)loadTemplate(state.templates[0].id);populateSelects();}
function populateSelects(){const choices=[["composeTemplate",state.templates,"id","name"],["settingsTemplate",state.templates,"id","name"],["personTemplate",state.templates,"id","name"]];for(const [id,list,key,label] of choices){const el=$(id),previous=el.value;el.replaceChildren();for(const data of list){const opt=create("option",null,data[label]);opt.value=data[key];el.append(opt);}el.value=[...el.options].some(o=>o.value===previous)?previous:(id==="settingsTemplate"?state.settings.defaultTemplateId||"builtin-birthday":"builtin-birthday");}const peopleSel=$("composePerson"),previous=peopleSel.value;peopleSel.replaceChildren(new Option("Sin empleado / destinatarios manuales",""));for(const p of state.people){peopleSel.append(new Option(`${p.code?`${p.code} · `:""}${p.name} (${p.email})`,p.id));}peopleSel.value=previous;
 const lists=$("composeRecipientList"),prevList=lists.value;lists.replaceChildren(new Option("Seleccionar lista de empleados", ""));for(const l of state.lists||[])lists.append(new Option(`${l.name} · ${l.memberIds.length} empleados`,l.id));lists.value=prevList;
 populateNativeSelectors();const accounts=[["composeIdentity",false],["settingsIdentity",true],["personIdentity",true]];for(const [id,allowBlank] of accounts){const el=$(id),v=el.value;el.replaceChildren();if(allowBlank)el.append(new Option("Cuenta predeterminada / seleccionar", ""));for(const i of state.identities)el.append(new Option(`${i.name} <${i.email}>`,i.id));el.value=[...el.options].some(o=>o.value===v)?v:(allowBlank?"":state.settings.defaultIdentityId||state.identities[0]?.id||"");}}
function loadTemplate(id){const t=state.templates.find(x=>x.id===id);if(!t)return;state.templateId=id;$("templateId").value=t.id;$("templateName").value=t.name;$("templateCategory").value=t.category;$("templateSubject").value=t.subject;$("templateHtml").value=t.html;$("templateCss").value=t.css||"";$("templateAnimated").checked=t.emailAnimation!==false;for(const el of document.querySelectorAll(".stack-item"))el.classList.toggle("selected",el.textContent.includes(t.name));previewTemplate();}
function chooseComposeTemplate(id){const t=state.templates.find(x=>x.id===id)||state.templates[0];if(!t)return;$("composeTemplate").value=t.id;$("composeSubject").value=t.subject;$("composeHtml").value=t.html;$("composeCss").value=t.css||"";$("composeAnimated").checked=t.emailAnimation!==false;previewCompose();}
function previewFrame(frameId,html,css="",animated=true,alreadySanitized=false){
  let content="";
  try {
    // El HTML ya saneado puede incluir un JPG Base64 > 140 KB. No volver a
    // someter esa imagen generada al límite del texto fuente del editor.
    const safe=alreadySanitized?html:CCEmailCSS.compile(html,css,{progressive:false});
    const style=animated?CCEmailCSS.previewCSS("",css):"";
    content=`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:"><style>body{margin:0;padding:15px;background:#fff;font-family:Arial,sans-serif}@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}}${style}</style></head><body>${safe}</body></html>`;
  }catch(e){content=`<!doctype html><html><body style="font:14px Arial;color:#b42332">Error HTML/CSS: ${esc(e.message)}</body></html>`;}
  $(frameId).srcdoc=content;
}
async function materialize(html,p){const s=state.settings||{};
  const checked=u=>{if(!u)return null;if(typeof u!=="string"||u.length>5_000_000||!/^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(u))throw Error("La fotografía no es válida o es demasiado grande (máximo 3.75 MB).");return u;};
  const data=checked((p?.photoId||state.manualPhotoId)?await PhotoDB.get(p?.photoId||state.manualPhotoId):null);
  const logo=checked(s.logoAssetId?await PhotoDB.get(s.logoAssetId):null);const image=data?`<img src="${data}" alt="Foto del empleado" width="200" style="width:200px;height:200px;object-fit:cover;border:6px solid #fff;border-radius:18px">`:`<div style="display:inline-block;padding:54px;background:white;border-radius:15px;color:#8191ab">Fotografía</div>`;const logoHTML=logo?`<img src="${logo}" width="160" style="max-width:160px">`:esc(s.company||"Tu empresa");const expandedMessage=($("composeMessageText").value||"").replace(/\{\{nombre\}\}/gi,p?.name||"Nombre del colaborador").replace(/\{\{empresa\}\}/gi,s.company||"Tu empresa");
  const v={mensaje:esc(expandedMessage).replace(/\r?\n/g,"<br>"),nombre:esc(p?.name||"Nombre del colaborador"),nombre_pila:esc(p?.name?.split(" ")[0]||"Nombre"),puesto:esc(p?.position||"Puesto"),sucursal:esc(p?.branch||"Sucursal"),empresa:esc(s.company||"Tu empresa"),codigo:esc(p?.code||"Código"),fecha:esc(new Date().toLocaleDateString("es-HN")),foto:image,logo:logoHTML};if(safeString(html).includes("{{tarjeta_cumple}}")){
  const pic=checked(await CCPoster.render({photo:data,name:p?.name||"Nombre del colaborador",position:p?.position||"Puesto",branch:p?.branch||"Sucursal",date:new Date().toLocaleDateString("es-HN",{day:"numeric",month:"long"})}));
  v.tarjeta_cumple=`<img alt="Tarjeta de cumpleaños personalizada" src="${pic}" width="540" style="width:100%;max-width:540px;height:auto;display:block;border:0">`;
 }
 const source=safeString(html),message=source.includes("{{mensaje}}")?source:source+($("composeMessageText").value.trim()?`<div style="padding:20px;line-height:1.6;font:16px Arial,sans-serif">${v.mensaje}</div>`:"");
 return message.replace(/\{\{(\w+)\}\}/gi,(_,key)=>v[key.toLowerCase()]??"");}
let previewCounter=0;
async function previewCompose(){
 const count=++previewCounter;
 const primary=state.contacts.find(c=>c.id===$("birthdayMainContact").value);
 const addr=$("composeMode").value==="celebration"?primary?.email?.toLowerCase():$("composeTo").value.split(/[;,\n]+/).map(v=>v.trim().toLowerCase()).filter(Boolean)[0];
 const p=($('composeMode').value==='celebration'&&primary)||state.contacts.find(c=>c.email.toLowerCase()===addr)||state.people.find(x=>x.email.toLowerCase()===addr)||null;
 if(p&&!p.photoId){const contact=state.contacts.find(c=>c.id===p.id||c.email.toLowerCase()===addr);if(contact){try{p.photoId=await contactPhotoFor(contact);}catch(e){console.warn("No se pudo precargar fotografía",e);}}}
 const manualName=$("composeManualName").value.trim();
 const composed=manualName?{...p,name:manualName,photoId:state.manualPhotoId||p?.photoId||null}:p?{...p,photoId:state.manualPhotoId||p.photoId||null}:{name:"Nombre del colaborador",photoId:state.manualPhotoId};
  try {
    const htmlSource=$("composeHtml").value||"<p>Selecciona una plantilla.</p>";
    const safeTemplate=CCEmailCSS.compile(htmlSource,$("composeCss").value,{progressive:false});
    const html=await materialize(safeTemplate,composed);
    if(count===previewCounter)previewFrame("emailPreview",html,$("composeCss").value,$("composePreviewMode").value==="animated",true);
  }catch(e){if(count===previewCounter)previewError("emailPreview",e);}
}
function previewError(frameId,e){$(frameId).srcdoc=`<!doctype html><html><body style="font:14px Arial;padding:20px;color:#b42332">Error HTML/CSS: ${esc(e.message||e)}</body></html>`;}
async function previewTemplate(){
  try{
    const css=$("templateCss").value;
    const safeTemplate=CCEmailCSS.compile($("templateHtml").value||"",css,{progressive:false});
    const html=await materialize(safeTemplate,state.people.find(x=>x.id===$("composePerson").value)||null);
    previewFrame("templatePreview",html,css,$("templatePreviewMode").value==="animated",true);
  }catch(e){previewError("templatePreview",e);}
}
function renderPeople(){const parent=$("peopleList");parent.replaceChildren();const needle=norm($("peopleSearch").value);const people=state.people.filter(p=>norm(p.name+" "+p.email+" "+p.code).includes(needle)).sort((a,b)=>a.name.localeCompare(b.name));if(!people.length)parent.append(create("p","muted","Aún no hay colaboradores registrados."));for(const p of people){const card=create("div","person-card"),placeholder=create("div","avatar",p.name.split(/\s+/).slice(0,2).map(x=>x[0]).join("")),text=create("div","person-text");text.append(create("b",null,p.name),create("small",null,`${p.code||"Sin código"} · ${p.position||"Sin puesto"}`),create("small",null,`${p.birthday?.slice(5)||"--"} · ${p.automatic?"✓ Automático":"Manual"}`));const edit=create("button","tiny-btn","Editar empleado");edit.onclick=()=>openPerson(p);text.append(edit);card.append(placeholder,text);parent.append(card);avatar(p.photoId,p).then(av=>card.replaceChild(av,placeholder));}}
function directoryRecipients(id){
 if(!id)return [];
 const group=id.startsWith("native:")?id.slice(7):id;
 if(group.startsWith("book:"))return state.contacts.filter(c=>c.bookId===group.slice(5));
 if(group.startsWith("list:"))return state.contacts.filter(c=>(c.listIds||[]).includes(group.slice(5)));
 const legacy=state.lists.find(l=>l.id===id);
 return legacy?(legacy.memberIds||[]).map(pid=>state.people.find(p=>p.id===pid)).filter(Boolean):[];
}
function populateNativeSelectors(){
 const list=$("composeRecipientList"),previous=list.value;
 list.replaceChildren(new Option("Seleccionar lista de Thunderbird", ""));
 for(const g of state.contactGroups.filter(x=>x.id!=="all"))list.append(new Option(g.name,"native:"+g.id));
 list.value=[...list.options].some(x=>x.value===previous)?previous:"";
 const sel=$("birthdayMainContact"),prior=sel.value;
 sel.replaceChildren(new Option("Elige al cumpleañero en la libreta", ""));
 for(const c of [...state.contacts].sort((a,b)=>a.name.localeCompare(b.name)))sel.append(new Option(`${c.name} · ${c.email}`,c.id));
 sel.value=[...sel.options].some(x=>x.value===prior)?prior:"";
 const settingGroup=$("settingsBirthdayGroup"),priorGroup=settingGroup.value||state.settings.birthdayCopyGroupId||"";
 settingGroup.replaceChildren(new Option("Sin copia a la empresa",""));
 for(const g of state.contactGroups.filter(x=>x.id!=="all"))settingGroup.append(new Option(g.name,g.id));
 settingGroup.value=[...settingGroup.options].some(o=>o.value===priorGroup)?priorGroup:"";
}
async function renderSelectedContactCard(){
 const box=$("selectedContactCard");if(!box)return;
 const c=state.contacts.find(c=>c.id===$("birthdayMainContact").value);
 box.hidden=!c;
 if(!c)return;
 $("selectedContactName").textContent=c.name;
 $("selectedContactMeta").textContent=[c.position,c.branch,c.company,c.code?"Código: "+c.code:"",c.email].filter(Boolean).join(" · ")||c.email;
 $("editSelectedContact").onclick=()=>globalThis.CC_openContactPhoto?.(c.id);
 const avatar=$("selectedContactAvatar");
 avatar.textContent=c.name.slice(0,1).toUpperCase();
 try{const id=await contactPhotoFor(c);const data=id?await PhotoDB.get(id):await call("contactPhoto",{id:c.id});
  if(data && state.contacts.find(x=>x.id===$("birthdayMainContact").value)?.id===c.id){
   avatar.replaceChildren();const img=create("img");img.src=data;img.alt="Foto de "+c.name;avatar.append(img);
  }
 }catch(e){console.warn("Fotografía no disponible",e);}
}
function renderNativeBirthdays(){
 const container=$("nativeBirthdayList");if(!container)return;
 const q=norm($("nativeBirthdaySearch").value),filter=$("nativeBirthdayFilter")?.value||"all",book=$("nativeBookFilter")?.value||"all";
 const all=state.contacts.filter(c=>(filter==="all"||(filter==="birthday"&&c.birthday)||(filter==="missing"&&!c.birthday))&&
  (book==="all"||(book.startsWith("book:")&&c.bookId===book.slice(5))||(book.startsWith("list:")&&(c.listIds||[]).includes(book.slice(5))))&&
  norm(`${c.name} ${c.email} ${c.birthday||""} ${c.code||""} ${c.position||""}`).includes(q)).sort((a,b)=>a.name.localeCompare(b.name,"es"));
 container.replaceChildren();
 const birthdays=state.contacts.filter(c=>!!c.birthday).length;
 $("nativeDirectoryCount").textContent=`${all.length} contactos encontrados · ${state.contacts.length} en la agenda · ${birthdays} con cumpleaños. No es necesario tener fecha para usar un contacto.`;
 if(!all.length){container.append(create("p","muted",state.contacts.length?"No hay contactos con este filtro. Prueba «Todos los contactos».":"Thunderbird no devolvió contactos con correo. Abre la libreta nativa y comprueba su contenido."));$("nativeShowMore").hidden=true;return;}
 for(const c of all.slice(0,state.nativeShown)){
  const row=create("div","person-card native-person-card"),txt=create("div","person-text");
  txt.append(create("b",null,c.name),create("small",null,`${c.email} · ${c.book}`),create("small",null,`${c.birthday?"🎂 "+c.birthday.slice(5):"Sin cumpleaños"}${c.position?" · "+c.position:""}`));
  const actions=create("div","native-actions"),send=create("button","tiny-btn","Felicitar"),photo=create("button","tiny-btn","Editar / foto");send.type=photo.type="button";
  send.onclick=()=>{nav("redactar");$("composeMode").value="celebration";updateComposeMode();$("birthdayMainContact").value=c.id;chooseComposeTemplate("builtin-yude-poster");$("composeManualName").value=c.name;$("composeTo").value=c.email;renderSelectedContactCard();updateSendSummary();previewCompose();};
  photo.onclick=()=>globalThis.CC_openContactPhoto?.(c.id);actions.append(send,photo);
  row.append(create("div","avatar",c.name.slice(0,1).toUpperCase()),txt,actions);container.append(row);
  contactPhotoFor(c).then(id=>id?PhotoDB.get(id):null).then(data=>{if(data&&row.isConnected){const img=create("img");img.src=data;img.alt="Fotografía de "+c.name;row.querySelector(".avatar")?.replaceChildren(img);}}).catch(console.warn);
 }
 const more=$("nativeShowMore");more.hidden=all.length<=state.nativeShown;more.textContent=`Mostrar más (${Math.min(all.length-state.nativeShown,60)} de ${all.length-state.nativeShown} restantes)`;
}
function populateNativeAgendaFilter(){
 const sel=$("nativeBookFilter");if(!sel)return;const old=sel.value;sel.replaceChildren(new Option("Todas las libretas","all"));
 for(const g of state.contactGroups.filter(x=>x.id!=="all"))sel.append(new Option(`${g.name}${g.kind==="list"?" · "+(g.resolvedCount||0)+" correos":""}`,g.id));
 sel.value=[...sel.options].some(o=>o.value===old)?old:"all";
}
function showRecipientsForJob(job){
 const audit=job.recipientAudit||{to:job.mode==="broadcast"?[state.identities.find(i=>i.id===job.identityId)?.email||job.to]:[job.to],cc:job.cc||[],bcc:job.bcc||[]};
 const text=["DESTINATARIOS REGISTRADOS EN ESTE TRABAJO","Para: "+(audit.to||[]).join(", "),"CC: "+((audit.cc||[]).join(", ")||"Ninguno"),"CCO (ocultos para los destinatarios): "+((audit.bcc||[]).join(", ")||"Ninguno"),"Estado: "+(job.status==="sent"?"Thunderbird informó aceptación por SMTP, NO entrega confirmada a cada destinatario.":badge(job.status))].join("\n");
 // La auditoría solo es visible en el equipo local; CCO jamás se incorpora al cuerpo.
 window.alert(text);
}
function renderGroups(){const box=$("groupMembers"),saved=$("groupsSaved");const marked=new Set([...box.querySelectorAll("input:checked")].map(x=>x.value));box.replaceChildren();saved.replaceChildren();for(const p of [...state.people].sort((a,b)=>a.name.localeCompare(b.name))){const lab=create("label","group-option");const ck=create("input");ck.type="checkbox";ck.value=p.id;ck.checked=marked.has(p.id);lab.append(ck,create("span",null,`${p.code||"—"} · ${p.name} · ${p.email}`));box.append(lab);}for(const l of state.lists||[]){const row=create("div","group-row");row.append(create("b",null,`${l.name} (${l.memberIds.length})`));const use=create("button","tiny-btn","Usar"),edit=create("button","tiny-btn","Editar"),del=create("button","tiny-btn","Eliminar");use.onclick=()=>{$("composeRecipientList").value=l.id;applyRecipientList();nav("redactar");};edit.onclick=()=>{$("groupId").value=l.id;$("groupName").value=l.name;for(const ch of box.querySelectorAll("input[type=checkbox]"))ch.checked=l.memberIds.includes(ch.value);};del.onclick=async()=>{if(confirm(`¿Eliminar lista ${l.name}?`)){await call("deleteList",{id:l.id});await refresh();}};row.append(use,edit,del);saved.append(row);}}

const contactIdentity=c=>c.id+"|"+c.email.toLowerCase();
function filteredContacts(){const group=$("contactBookFilter").value,term=norm($("contactSearch").value);
 return state.contacts.filter(c=>(group==="all"||(group.startsWith("book:")&&c.bookId===group.slice(5))||(group.startsWith("list:")&&(c.listIds||[]).includes(group.slice(5))))&&norm(c.name+" "+c.email+" "+c.book).includes(term));
}
function renderContactPicker(){const items=filteredContacts(),parent=$("contactResults");parent.replaceChildren();
 $("contactCount").textContent=`${items.length} contactos visibles / ${state.contacts.length} con correo`;
 $("contactSelectedCount").textContent=`${state.selectedContactIds.size} seleccionados`;
 if(!items.length){parent.append(create("p","muted", "No se encontraron contactos. Revisa que Thunderbird tenga una libreta configurada."));return;}
 for(const c of items.slice(0,1500)){
   const lab=create("label","contact-result"),input=create("input");input.type="checkbox";input.checked=state.selectedContactIds.has(contactIdentity(c));
   input.onchange=()=>{if(input.checked)state.selectedContactIds.add(contactIdentity(c));else state.selectedContactIds.delete(contactIdentity(c));$("contactSelectedCount").textContent=`${state.selectedContactIds.size} seleccionados`;};
   const block=create("span");block.append(create("b",null,c.name),create("small",null,c.email+" · "+c.book));const actions=create("span","contact-actions"),pic=create("button","tiny-btn","✎ Editar / foto");
   pic.type="button";pic.onclick=ev=>{ev.preventDefault();ev.stopPropagation();$("contactDialog").close();globalThis.CC_openContactPhoto?.(c.id);};actions.append(pic);
   lab.append(input,block,actions);parent.append(lab);
 }
 if(items.length>1500)parent.append(create("p","muted","Se muestran los primeros 1500 contactos; usa el buscador para filtrar."));
}
async function openContactPicker(){const d=$("contactDialog");d.showModal();$("contactResults").replaceChildren(create("p","muted","Leyendo la libreta de Thunderbird…"));
 try{const result=await call("contactDirectory");state.contacts=result.contacts||[];state.contactGroups=result.groups||[];
   const selector=$("contactBookFilter"),selected=selector.value;selector.replaceChildren();for(const g of state.contactGroups)selector.append(new Option(g.name,g.id));selector.value=[...selector.options].some(o=>o.value===selected)?selected:"all";
   const oldEmails=new Set($("composeTo").value.split(/[;,\n]+/).map(x=>x.trim().toLowerCase()).filter(Boolean));state.selectedContactIds=new Set(state.contacts.filter(c=>oldEmails.has(c.email.toLowerCase())).map(contactIdentity));renderContactPicker();
   if(!state.contacts.length)toast("No aparecen contactos con correo","error","Revisa las libretas de direcciones de Thunderbird.");
 }catch(e){$("contactResults").replaceChildren(create("p","error-msg",e.message));toast("Thunderbird no entregó la libreta","error",e.message);}
}
function applyPickedContacts(){const contacts=state.contacts.filter(c=>state.selectedContactIds.has(contactIdentity(c)));
 const existing=$("composeTo").value.split(/[;,\n]+/).map(x=>x.trim()).filter(validEmail);
 const addresses=[...new Map(contacts.map(c=>[c.email.toLowerCase(),c.email])).values()];
 if($("composeMode").value==="celebration"&&contacts.length===1){$("birthdayMainContact").value=contacts[0].id;$("composeManualName").value=contacts[0].name;$("composeTo").value=contacts[0].email;}
 else if($("composeMode").value!=="celebration")$("composeTo").value=addresses.join(", ");if(addresses.length>1 && $("composeMode").value!=="broadcast" && $("composeMode").value!=="celebration"){ $("composeMode").value="broadcast"; updateComposeMode();toast("Un único comunicado CCO seleccionado", "ok", "Si necesitas cumpleaños separados, cambia a modo individual."); }updateSendSummary();$("recipientResolution").textContent=`${addresses.length} direcciones seleccionadas; ${contacts.length} de la libreta de Thunderbird.`;
 $("contactDialog").close();toast(`${contacts.length} contactos agregados`);previewCompose();
}
async function contactPhotoFor(c){if(!c?.id)return null;const key=state.contactPhotos?.[c.id]?.photoId||"tb-contact-photo:"+c.id;
 let data=await PhotoDB.get(key);
 if(!data){try{const raw=await call("contactPhoto",{id:c.id});if(raw){const blob=await(await fetch(raw)).blob();const file=new File([blob],"foto-contacto.jpg",{type:blob.type||"image/jpeg"});data=await resizedPhoto(file);await PhotoDB.put(key,data);}}catch(e){console.warn("Sin foto disponible",c.name,e);}}
 return data?key:null;
}
function getSavedListAddresses(id){const l=state.lists.find(x=>x.id===id);return l?[...new Set(l.memberIds.map(id=>state.people.find(p=>p.id===id)?.email).filter(Boolean))]:[];}
function applyRecipientList(){
 const members=directoryRecipients($("composeRecipientList").value);const names=[...new Set(members.map(p=>p.email.toLowerCase()))];
 if($("composeMode").value!=="celebration")$("composeTo").value=names.join(", ");
 updateSendSummary();const group=state.contactGroups.find(g=>"native:"+g.id===$("composeRecipientList").value);
 $("recipientResolution").textContent=names.length?`${names.length} correos resueltos ${group?.memberCount!==undefined?"de "+group.memberCount+" integrantes de la lista":"de la agenda"}. ${$("composeMode").value==="celebration"?"Recibirán copia; el cumpleañero se mantiene en Para.":""}`:"Esta lista no contiene direcciones válidas. No se puede enviar.";
 previewCompose();
}
function previewRecipients(){
 const mode=$("composeMode").value,raw=$("composeTo").value;
 const typed=[...new Set(raw.split(/[;,\n]+/).map(a=>a.trim().toLowerCase()).filter(Boolean))];
 const identity=state.identities.find(i=>i.id===$("composeIdentity").value)?.email||"Cuenta remitente";
 if(mode==="broadcast")return {to:[identity],cc:[],bcc:typed,source:$("composeRecipientList").value};
 if(mode==="celebration"){
  const main=state.contacts.find(c=>c.id===$("birthdayMainContact").value);
  const copied=[...new Set(directoryRecipients($("composeRecipientList").value).map(c=>c.email.toLowerCase()).filter(email=>email!==main?.email?.toLowerCase()))];
  return {to:main?[main.email]:[],cc:$("composeCopyMode").value==="cc"?copied:[],bcc:$("composeCopyMode").value==="bcc"?copied:[],source:$("composeRecipientList").value};
 }
 return {to:typed,cc:[],bcc:[],source:$("composeRecipientList").value};
}
function showRecipientAudit(){
 const r=previewRecipients(),body=$("recipientAuditBody");if(!body)return;body.replaceChildren();
 for(const [label,key] of [["Para","to"],["CC (visibles)","cc"],["CCO (ocultos)","bcc"]]){
  const col=create("div","recipient-audit-group");col.append(create("b",null,`${label} · ${r[key].length}`));
  if(r[key].length){const lst=create("ul");for(const email of r[key])lst.append(create("li",null,email));col.append(lst);}else col.append(create("small",null,"Ninguno"));body.append(col);
 }
 const g=state.contactGroups.find(g=>"native:"+g.id===r.source||g.id===r.source);
 if(g?.kind==="list"){
  const count=g.memberCount??0,resolved=g.resolvedCount??0;
  const diagnostic=create("p",count!==resolved||g.error?"error-msg":"hint",`Lista de Thunderbird: ${count} miembros, ${resolved} correos encontrados.${g.error?" Error: "+g.error:""}`);body.prepend(diagnostic);
 }
 body.append(create("p","hint","La aceptación por SMTP no confirma la entrega individual. CCO solo se ve en el registro local, no en el correo recibido."));
}
function updateSendSummary(){
 const r=previewRecipients(),mode=$("composeMode").value,recipients=r.to.length+r.cc.length+r.bcc.length;
 const summary=$("sendSummary");summary.textContent=mode==="broadcast"?`UN correo · ${r.bcc.length} destinatarios en CCO`:mode==="celebration"?`UN correo · ${r.to.length} destinatario principal + ${r.cc.length} CC + ${r.bcc.length} CCO`:`${r.to.length} correos personalizados`;
 const group=state.contactGroups.find(g=>"native:"+g.id===r.source||g.id===r.source);
 if(group?.kind==="list"&&(group.memberCount!==group.resolvedCount||group.error))summary.textContent+=` · ⚠ Revisar lista: ${group.resolvedCount||0}/${group.memberCount||0}`;
 $("composeSubmit").textContent=mode==="individual"?`◷ Programar ${r.to.length} mensaje(s)`:"◷ Programar UN correo";
 summary.dataset.mode=mode;showRecipientAudit();
}

function updateComposeMode(){
 const mode=$("composeMode").value,celebration=mode==="celebration",bulk=mode==="broadcast";
 $("birthdayCopyBox").hidden=!celebration;
 $("recipientHint").textContent=celebration?"(principal: cumpleañero; copias desde lista)":bulk?"(un mensaje, destinatarios CCO)":"(uno por cada persona)";
 $("composePrivacy").textContent=celebration?"🎂 Un mensaje personalizado al cumpleañero con copias a la lista que elijas.":bulk?"🔒 UN correo general con CCO. Puedes escribir un nombre común sin revelar la lista.":"✉ Un correo personalizado por destinatario.";
 $("composePerson").disabled=celebration||bulk;$("composePersonSearch").disabled=celebration||bulk;
 $("composePhotoFile").disabled=bulk;$("clearComposePhoto").disabled=bulk;$("composeManualName").disabled=false;
 $("composePhotoStatus").textContent=bulk?"El comunicado permite un texto común; las fotos personales son para cumpleaños.":state.manualPhotoId?"Fotografía elegida manualmente.":"Se usará la foto del contacto seleccionado.";
 updateSendSummary();
}
function renderFooter(){const s=state.settings||{},nav=$("footerSocial"),foot=$("appFooter");nav.replaceChildren();const safeUrl=value=>{try{const u=new URL(value);return u.protocol==="https:"?u.href:null;}catch{return null;}};for(const [label,url] of [["Sitio web",s.website],["Facebook",s.socials?.facebook],["Instagram",s.socials?.instagram],["LinkedIn",s.socials?.linkedin]]){const href=safeUrl(url);if(!href)continue;const a=create("a","footer-link",label);a.href=href;a.target="_blank";a.rel="noopener noreferrer";nav.append(a);}PhotoDB.get(s.footerAssetId).then(pic=>{if(pic&&foot)foot.style.backgroundImage=`linear-gradient(90deg,#061b42e6,#0b3150cf),url("${pic}")`;else foot.style.backgroundImage="";}).catch(console.warn);}
function renderConfigOptions(){const f=$("settingsForm");if(f.dataset.dirty==="1")return;$("settingsCompany").value=state.settings.company||"";$("settingsIdentity").value=state.settings.defaultIdentityId||"";$("settingsTemplate").value=state.settings.defaultTemplateId||"builtin-birthday";$("settingsTime").value=state.settings.defaultTime||"09:00";$("settingsNativeAuto").checked=!!state.settings.autoNativeBirthday;$("settingsBirthdayCopyMode").value=state.settings.birthdayCopyMode||"bcc";$("settingsBirthdayGroup").value=state.settings.birthdayCopyGroupId||"";$("settingsWebsite").value=state.settings.website||"";$("settingsFacebook").value=state.settings.socials?.facebook||"";$("settingsInstagram").value=state.settings.socials?.instagram||"";$("settingsLinkedin").value=state.settings.socials?.linkedin||"";}
async function openPerson(p={}){$("personForm").reset();$("personId").value=p.id||"";$("personPhotoId").value=p.photoId||"";$("personContactId").value=p.contactId||"";$("personCode").value=p.code||"";$("personName").value=p.name||"";$("personEmail").value=p.email||"";$("personPosition").value=p.position||"";$("personBranch").value=p.branch||"";$("personBirthday").value=p.birthday||"";$("personAutomatic").checked=!!p.automatic;$("personTime").value=p.sendTime||state.settings.defaultTime||"09:00";$("personIdentity").value=p.identityId||state.settings.defaultIdentityId||"";$("personTemplate").value=p.templateId||state.settings.defaultTemplateId||"builtin-birthday";$("personError").textContent="";$("personPhotoPreview").removeAttribute("src");if(p.photoId){const data=await PhotoDB.get(p.photoId);if(data)$("personPhotoPreview").src=data;}$("personDialog").showModal();}
async function resizedPhoto(file){if(file.size>8*1024*1024)throw Error(`${file.name}: imagen supera 8 MB`);if(!/image\/(png|jpeg|webp)/.test(file.type))throw Error("Usa imágenes PNG, JPG o WebP.");const url=URL.createObjectURL(file);try{const img=await new Promise((resolve,reject)=>{const e=new Image();e.onload=()=>resolve(e);e.onerror=()=>reject(Error("No se pudo abrir imagen"));e.src=url;});const max=440,ratio=Math.min(1,max/Math.max(img.width,img.height)),canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(img.width*ratio));canvas.height=Math.max(1,Math.round(img.height*ratio));const ctx=canvas.getContext("2d");ctx.fillStyle="#fff";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);return canvas.toDataURL("image/jpeg",.84);}finally{URL.revokeObjectURL(url);}}
async function savePersonUI(ev){ev.preventDefault();$("personError").textContent="";const button=$("personForm").querySelector('button[type="submit"]')||$("personForm").querySelector(".primary");button.disabled=true;try{let photoId=$("personPhotoId").value||null;const photo=$("personPhotoFile").files[0];if(photo){photoId=photoId||"person-photo-"+crypto.randomUUID();await PhotoDB.put(photoId,await resizedPhoto(photo),{category:"person",code:$("personCode").value,name:$("personName").value,originalName:photo.name});}const person={id:$("personId").value||undefined,photoId,contactId:$("personContactId").value,code:$("personCode").value,name:$("personName").value,email:$("personEmail").value,position:$("personPosition").value,branch:$("personBranch").value,birthday:$("personBirthday").value,automatic:$("personAutomatic").checked,sendTime:$("personTime").value,identityId:$("personIdentity").value,templateId:$("personTemplate").value};await call("savePerson",{person});$("personDialog").close();await refresh();await galleryReload();toast("Colaborador guardado", "ok",person.name);}catch(e){$("personError").textContent=e.message;}finally{button.disabled=false;}}
function icsEscape(s){return safeString(s).replace(/\\/g,"\\\\").replace(/\n/g,"\\n").replace(/;/g,"\\;").replace(/,/g,"\\,");}
function foldICS(line){const units=Array.from(line),parts=[];let segment="";for(const char of units){if((segment+char).length>70){parts.push(segment);segment=" "+char;}else segment+=char;}parts.push(segment);return parts.join("\r\n");}
function buildICS(people){const rows=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Correo Calendario//Cumpleanos Contactos//ES","CALSCALE:GREGORIAN","METHOD:PUBLISH","X-WR-CALNAME:Cumpleaños y felicitaciones"];
 for(const p of people){if(!p.birthday)continue;const mm=Number(p.birthday.slice(5,7)),dd=Number(p.birthday.slice(8,10));let start=null;for(let y=new Date().getFullYear();y<new Date().getFullYear()+9;y++){const d=new Date(y,mm-1,dd,12);if(d.getMonth()===mm-1){start=d;break;}}if(!start)continue;const key=localDay(start).replace(/-/g,"");rows.push("BEGIN:VEVENT",`UID:cc-birthday-${p.id}@local.addon`,`DTSTAMP:${new Date().toISOString().replace(/[-:]/g,"").replace(/\.\d{3}/,"")}`,`DTSTART;VALUE=DATE:${key}`,`DTEND;VALUE=DATE:${localDay(new Date(start.getFullYear(),start.getMonth(),start.getDate()+1)).replace(/-/g,"")}`,"RRULE:FREQ=YEARLY",`SUMMARY:${icsEscape("Cumpleaños: "+p.name)}`,`DESCRIPTION:${icsEscape([p.position,p.branch].filter(Boolean).join(" · "))}`,"TRANSP:TRANSPARENT","END:VEVENT");}
 rows.push("END:VCALENDAR");return rows.map(foldICS).join("\r\n")+"\r\n";}
function downloadICS(){const blob=new Blob([buildICS(agendaPeople())],{type:"text/calendar;charset=utf-8"}),url=URL.createObjectURL(blob),a=create("a");a.href=url;a.download="cumpleanos-contactos-correo-calendario.ics";document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),20000);toast("Calendario .ics generado","ok","Impórtalo desde Calendario de Thunderbird → Eventos y tareas → Importar.");}
// Biblioteca de contactos: la indexación se realiza una vez por lote (O(n + m)).
let galleryItems=[],galleryShown=24,galleryChoice="compose",galleryBusy=false;
const ccFolderLabel="CorreoCalendario / Imagenes / Empleados";
async function galleryInit(){
  try{const info=await PhotoDB.ensureFolders();
    $("photoStorageInfo").textContent=info.type==="opfs"?
      `✓ Carpeta privada creada automáticamente: ${ccFolderLabel} · perfil de Thunderbird`:
      "✓ Biblioteca creada en IndexedDB del perfil Thunderbird (respaldo de compatibilidad).";
  }catch(error){$("photoStorageInfo").textContent=`No se pudo inicializar biblioteca: ${error.message}`;}
  await galleryReload();
}
function galleryReferenced(id){return state.people.some(p=>p.photoId===id)||state.jobs.some(j=>["pending","sending","review"].includes(j.status)&&j.photoId===id)||[state.settings.logoAssetId,state.settings.footerAssetId,state.manualPhotoId].includes(id);}
async function galleryReload(){try{galleryItems=await PhotoDB.list();$("photoGalleryCount").textContent=galleryItems.filter(x=>x.category==="person").length;renderPhotoGallery();}catch(e){console.warn("No se puede consultar galería",e);}}
async function renderPhotoGallery(){
 const grid=$("photoGallery");if(!grid)return;const query=norm($("photoGallerySearch").value);
 const filtered=galleryItems.filter(x=>x.category==="person"&&norm([x.code,x.name,x.originalName,x.id].join(" ")).includes(query));
 grid.replaceChildren();if(!filtered.length){grid.append(create("p","hint",query?"No hay fotografías con ese código o nombre.":"Biblioteca vacía. Pulsa «Agregar imágenes» para comenzar."));$("photoGalleryMore").hidden=true;return;}
 for(const item of filtered.slice(0,galleryShown))galleryCard(item,grid,false);
 $("photoGalleryMore").hidden=filtered.length<=galleryShown;
}
function galleryCard(item,container,dialogMode){
 const owner=state.people.find(p=>p.photoId===item.id);
 const box=create("article","photo-gallery-card"),img=create("img"),name=create("strong",null,owner?.name||item.name||item.originalName||"Foto sin asignar"),detail=create("small",null,owner?.code||item.code||"Sin código");
 img.alt=`Fotografía de ${name.textContent}`;img.loading="lazy";box.append(img,name,detail);
 PhotoDB.get(item.id).then(url=>{if(url&&box.isConnected)img.src=url;}).catch(console.warn);
 const actions=create("div","buttons"),choose=create("button","ghost small",dialogMode?"Elegir":"Asociar a empleado");
 choose.type="button";
 choose.onclick=async()=>{
  if(dialogMode){await gallerySelect(item);return;}
  const query=prompt("Indica el código exacto de empleado (o su nombre completo):",owner?.code||item.code||"");if(!query)return;
  const matches=state.people.filter(p=>(p.code&&norm(p.code)===norm(query))||norm(p.name)===norm(query));
  if(matches.length!==1){toast("Empleado ambiguo o inexistente","error","Primero registra al empleado con código único.");return;}
  try{await call("attachPhotos",{links:[{personId:matches[0].id,photoId:item.id}]});await refresh();await galleryReload();toast("Foto vinculada","ok",matches[0].name);}catch(e){toast("No se pudo vincular foto","error",e.message);}
 };
 actions.append(choose);
 if(!dialogMode){const exportOne=create("button","ghost small","Exportar"),remove=create("button","danger-btn","Quitar");
 exportOne.type=remove.type="button";
 exportOne.onclick=async()=>{const data=await PhotoDB.get(item.id);if(!data){toast("Imagen no disponible","error");return;}
  const a=create("a");a.href=data;a.download=(item.code||item.originalName?.replace(/\.[^.]+$/,'')||"fotografia").replace(/[^\w-]/g,"_")+".jpg";document.body.append(a);a.click();a.remove();};
 remove.onclick=async()=>{if(galleryReferenced(item.id)){toast("Foto en uso","error","Desvincúlala del empleado o de los envíos antes de borrarla.");return;}
  if(!confirm("¿Eliminar esta imagen de la biblioteca privada?"))return;
  try{await PhotoDB.del(item.id);await galleryReload();toast("Imagen eliminada");}catch(e){toast("No se pudo eliminar","error",e.message);}};
 actions.append(exportOne,remove);}
 box.append(actions);container.append(box);
}
async function gallerySelect(item){const data=await PhotoDB.get(item.id);if(!data){toast("Fotografía no disponible","error");return;}
 if(galleryChoice==="person"){$("personPhotoId").value=item.id;$("personPhotoPreview").src=data;$("personPhotoFile").value="";}
 else {state.manualPhotoId=item.id;$("composePhotoPreview").src=data;$("composePhotoPreview").hidden=false;$("composePhotoStatus").textContent="Fotografía elegida de biblioteca: "+(item.name||item.originalName);await previewCompose();}
 $("galleryDialog").close();toast("Fotografía seleccionada");}
async function openGallery(mode){galleryChoice=mode;await galleryReload();const target=$("galleryDialogList");target.replaceChildren();const items=galleryItems.filter(x=>x.category==="person");for(const item of items.slice(0,80))galleryCard(item,target,true);if(items.length>80)target.append(create("p","hint","Se muestran las 80 más recientes. Usa la búsqueda en la biblioteca de contactos para localizar otras."));if(!items.length)target.append(create("p","hint","Aún no hay imágenes. En Cumpleaños y felicitaciones pulsa «Agregar imágenes»."));$("galleryDialog").showModal();}
async function importPhotos(event){
 const files=Array.from(event.target.files||[]);event.target.value="";
 if(!files.length)return;if(galleryBusy){toast("Otra importación está activa","error");return;}
 if(files.length>500){toast("Importa como máximo 500 fotos por lote","error");return;}
 galleryBusy=true;let imported=0,errors=0;
 try{
  for(const file of files){
   if(!/\.(jpe?g|png|webp)$/i.test(file.name)){errors++;continue;}
   try{
    const base=file.name.replace(/\.[^.]+$/,""),id="gallery-photo-"+crypto.randomUUID();
    await PhotoDB.put(id,await resizedPhoto(file),{category:"person",code:"",name:base,originalName:file.name});imported++;
   }catch(e){errors++;console.warn("Foto omitida",file.name,e);}
  }
  await galleryReload();
  $("importResult").textContent=`${imported} fotografía(s) importadas sin asignar. Vincúlalas desde «Contactos Thunderbird + fotos» o elige el empleado exacto. ${errors} rechazadas.`;
  toast("Fotos guardadas", "ok", "No se asignaron automáticamente a personas equivocadas.");
 }finally{galleryBusy=false;}
}
async function importCSV(file){const raw=await file.text(),rows=parseCsv(raw.replace(/^\uFEFF/,""));if(rows.length<2)throw Error("CSV vacío. Incluye encabezados.");const headers=rows.shift().map(x=>norm(x));const aliases={code:["codigo","codigoempleado","employeeid"],name:["nombre","nombrecompleto","name"],email:["correo","email"],position:["puesto","cargo"],branch:["sucursal","oficina"],birthday:["fecha","fechanacimiento","cumpleanos","birthday"]};const pos={};for(const [k,keys] of Object.entries(aliases))pos[k]=headers.findIndex(h=>keys.includes(h));if(["name","email","birthday"].some(k=>pos[k]<0))throw Error("Se requieren columnas: nombre, correo y fecha_nacimiento.");if(rows.length>500)throw Error("Importa máximo 500 personas por archivo CSV.");let count=0,rejected=0;const existing=new Map(state.people.map(p=>[p.email.toLowerCase(),p]));for(const row of rows){const get=k=>pos[k]<0?"":(row[pos[k]]||"").trim();const email=get("email").toLowerCase();try{const prev=existing.get(email)||{};const person={...prev,code:get("code")||prev.code,name:get("name"),email,position:get("position"),branch:get("branch"),birthday:dateCSV(get("birthday")),automatic:!!prev.automatic,sendTime:prev.sendTime||"09:00",identityId:prev.identityId||"",templateId:prev.templateId||"builtin-birthday"};const saved=await call("savePerson",{person});existing.set(email,saved);count++;}catch(e){rejected++;}}
 await refresh();$("importResult").textContent=`CSV: ${count} empleados guardados o actualizados, ${rejected} filas no válidas. Las importaciones nuevas no activan envíos automáticos; se conserva la configuración de empleados existentes.`;toast(`${count} empleados importados`);}
async function importContacts(){const list=await call("contacts");state.contacts=list;if(!list.length){toast("No hay contactos con correo","error");return;}const term=prompt(`Hay ${list.length} contactos. Escribe parte del nombre o correo para elegir:`);if(term===null)return;const matches=list.filter(x=>norm(x.name+" "+x.email).includes(norm(term))).slice(0,10);if(matches.length===1){await fromContact(matches[0]);return;}const pick=prompt(`Coincidencias:\n${matches.map((x,i)=>`${i+1}. ${x.name} · ${x.email}`).join("\n")}\nEscribe el número del contacto:`);const c=matches[Number(pick)-1];if(c)await fromContact(c);else toast("No se seleccionó contacto","error");}
async function fromContact(c){const previous=state.people.find(p=>p.email.toLowerCase()===c.email.toLowerCase())||{};await openPerson({...previous,name:c.name,email:c.email,birthday:c.birthday||previous.birthday||"",contactId:c.id});if(!previous.photoId){try{const photo=await call("contactPhoto",{id:c.id});if(photo){const blob=await(await fetch(photo)).blob();const file=new File([blob],"foto-contacto.jpg",{type:blob.type||"image/jpeg"});const id="person-photo-"+crypto.randomUUID();await PhotoDB.put(id,await resizedPhoto(file));$("personPhotoId").value=id;$("personPhotoPreview").src=await PhotoDB.get(id);}}catch(e){console.warn("Sin foto de contacto",e);}}}
function wiring(){initNav();initTheme();$("prevMonth").onclick=()=>{state.month=new Date(state.month.getFullYear(),state.month.getMonth()-1,1);renderCalendar("miniCalendar",false);renderCalendar("bigCalendar",true);};$("nextMonth").onclick=()=>{state.month=new Date(state.month.getFullYear(),state.month.getMonth()+1,1);renderCalendar("miniCalendar",false);renderCalendar("bigCalendar",true);};$("calendarToday").onclick=()=>{state.selectedDay="";state.month=new Date(new Date().getFullYear(),new Date().getMonth(),1);renderCalendar("miniCalendar",false);renderCalendar("bigCalendar",true);renderJobs();};$("jobFilter").onchange=renderJobs;$("exportIcs").onclick=downloadICS;
 $("nativeBirthdayFilter").onchange=()=>{state.nativeShown=60;renderNativeBirthdays();};
 $("nativeBookFilter").onchange=()=>{state.nativeShown=60;renderNativeBirthdays();};
 $("nativeShowMore").onclick=()=>{state.nativeShown+=60;renderNativeBirthdays();};
 $("openThunderbirdBook").onclick=async()=>{try{await call("openAddressBook");}catch(e){toast("No se pudo abrir la agenda nativa","error",e.message);}};
 $("composeTemplate").onchange=()=>chooseComposeTemplate($("composeTemplate").value);$("composePersonSearch").oninput=()=>{const q=norm($("composePersonSearch").value),sel=$("composePerson"),selected=sel.value;sel.replaceChildren(new Option("Selecciona un empleado o destinatario manual", ""));const matches=state.people.filter(p=>norm(p.code+" "+p.name+" "+p.email).includes(q)).slice(0,100);for(const p of matches)sel.append(new Option(`${p.code||"—"} · ${p.name} (${p.email})`,p.id));if(matches.length===1&&q)sel.value=matches[0].id;else sel.value=selected; if(sel.value){const p=state.people.find(x=>x.id===sel.value);if(p)$("composeTo").value=p.email;}previewCompose();};
 $("composeMode").onchange=()=>{updateComposeMode();previewCompose();};$("composeRecipientList").onchange=applyRecipientList;
 $("birthdayMainContact").onchange=()=>{const c=state.contacts.find(c=>c.id===$("birthdayMainContact").value);state.manualPhotoId=null;$("composePhotoFile").value="";$("composePhotoPreview").hidden=true;if(c){$("composeTo").value=c.email;$("composeManualName").value=c.name;chooseComposeTemplate("builtin-yude-poster");}renderSelectedContactCard();updateSendSummary();previewCompose();};
 $("composeCopyMode").onchange=()=>{updateSendSummary();previewCompose();};$("composeMessageText").oninput=()=>{clearTimeout(window.__msgT);window.__msgT=setTimeout(previewCompose,200);};
 $("openContactPicker").onclick=openContactPicker;
 $("closeContactPicker").onclick=$("cancelContactPicker").onclick=()=>$("contactDialog").close();
 $("contactBookFilter").onchange=renderContactPicker;$("contactSearch").oninput=renderContactPicker;
 $("contactSelectAll").onclick=()=>{for(const c of filteredContacts())state.selectedContactIds.add(contactIdentity(c));renderContactPicker();};
 $("contactClearSelection").onclick=()=>{state.selectedContactIds.clear();renderContactPicker();};
 $("applyContactPicker").onclick=applyPickedContacts;
 $("createEmployeeFromCompose").onclick=()=>globalThis.CC_openContactPhoto?.($("birthdayMainContact").value||"");
 $("composeManualName").oninput=previewCompose;
 $("composePhotoFile").onchange=async ev=>{const file=ev.target.files?.[0];if(!file)return;
   try{const key="compose-photo:"+crypto.randomUUID();const data=await resizedPhoto(file);await PhotoDB.put(key,data,{category:"temporary",originalName:file.name});state.manualPhotoId=key;
   $("composePhotoStatus").textContent="Fotografía seleccionada: "+file.name;$("composePhotoPreview").src=data;$("composePhotoPreview").hidden=false;
   await previewCompose();toast("Fotografía cargada");}catch(e){toast("No se pudo cargar la fotografía","error",e.message);} };
 $("clearComposePhoto").onclick=async()=>{state.manualPhotoId=null;$("composePhotoFile").value="";$("composePhotoPreview").hidden=true;$("composePhotoPreview").removeAttribute("src");$("composePhotoStatus").textContent="Sin foto manual; se usará la foto del contacto o empleado.";await previewCompose();};
 $("composeTo").oninput=()=>{updateSendSummary();$("recipientResolution").textContent=$("composeTo").value.split(/[;,\n]+/).filter(x=>x.trim()).length+" direcciones en esta programación.";previewCompose();};
 $("composePerson").onchange=()=>{const p=state.people.find(x=>x.id===$("composePerson").value);if(p)$("composeTo").value=p.email;previewCompose();};$("composeHtml").addEventListener("input",()=>{clearTimeout(window.__previewDebounce);window.__previewDebounce=setTimeout(previewCompose,400);});$("composePreview").onclick=previewCompose;
 $("composeForm").onsubmit=async ev=>{
  ev.preventDefault();
  const when=new Date($("composeWhen").value).getTime();if(!Number.isFinite(when)||when<Date.now()+500){toast("Selecciona una fecha futura","error");return;}
  const mode=$("composeMode").value,raw=$("composeTo").value;
  const addresses=[...new Set(raw.split(/[;,\n]+/).map(a=>a.trim().toLowerCase()).filter(Boolean))];
  const identityId=$("composeIdentity").value;
  if(!identityId){toast("Selecciona una cuenta de Thunderbird","error");return;}
  const chosenGroup=state.contactGroups.find(g=>"native:"+g.id===$("composeRecipientList").value);
  if(chosenGroup?.kind==="list"&&(chosenGroup.error||chosenGroup.memberCount!==chosenGroup.resolvedCount)){
   toast("La lista de Thunderbird no se leyó completamente","error",`${chosenGroup.resolvedCount||0} de ${chosenGroup.memberCount||0} contactos con correo. Corrige la libreta antes de enviar.`);return;
  }
  const common={identityId,subject:$("composeSubject").value,html:$("composeHtml").value,css:$("composeCss").value,messageText:$("composeMessageText").value,emailAnimation:$("composeAnimated").checked,at:when,template:$("composeTemplate").value};
  let requests=[];
  if(mode==="celebration"){
   const main=state.contacts.find(c=>c.id===$("birthdayMainContact").value);
   if(!main){toast("Elige al cumpleañero de los contactos de Thunderbird","error");return;}
   const recipients=[...new Set(directoryRecipients($("composeRecipientList").value).map(c=>c.email.toLowerCase()).filter(email=>email!==main.email.toLowerCase()))];
   const copyMode=$("composeCopyMode").value;
   if(copyMode!=="none"&&!$("composeRecipientList").value){toast("Selecciona una lista para copiar o elige Sin copias","error");return;}
   if(recipients.length>150){toast("Lista demasiado grande (máximo 150 copias)","error");return;}
   const photoId=state.manualPhotoId||await contactPhotoFor(main);
   requests=[{...common,mode:"individual",to:main.email,cc:copyMode==="cc"?recipients:[],bcc:copyMode==="bcc"?recipients:[],personName:$("composeManualName").value.trim()||main.name,position:main.position||"",branch:main.branch||"",photoId,employeeCode:main.code||""}];
   if(!confirm(`UN correo personalizado a ${main.name} <${main.email}>; ${copyMode==="none"?"sin copias":recipients.length+" copias " + copyMode.toUpperCase()}. ¿Programar?`))return;
  } else if(mode==="broadcast"){
   if(!addresses.length||addresses.length>150||addresses.some(x=>!validEmail(x))){toast("Introduce entre 1 y 150 destinatarios CCO válidos","error");return;}
   requests=[{...common,mode:"broadcast",to:state.identities.find(i=>i.id===identityId)?.email,bcc:addresses,personName:$("composeManualName").value.trim()}];
   if(!confirm(`UN correo con ${addresses.length} destinatarios CCO ocultos. ¿Programar?`))return;
  } else {
   if(!addresses.length||addresses.length>30||addresses.some(x=>!validEmail(x))){toast("Introduce entre 1 y 30 direcciones válidas","error");return;}
   if(state.manualPhotoId&&addresses.length!==1){toast("La foto manual solo puede aplicarse a una persona","error");return;}
   requests=await Promise.all(addresses.map(async email=>{const c=state.contacts.find(x=>x.email.toLowerCase()===email);const person=state.people.find(x=>x.email.toLowerCase()===email);
    return {...common,mode:"individual",to:email,personName:addresses.length===1&&$("composeManualName").value.trim()||c?.name||person?.name||email.split("@")[0],position:c?.position||person?.position||"",branch:c?.branch||person?.branch||"",employeeCode:c?.code||person?.code||"",photoId:state.manualPhotoId||await contactPhotoFor(c)||person?.photoId||null};}));
   if(!confirm(`Programar ${requests.length} mensajes separados, uno por persona. ¿Continuar?`))return;
  }
  try{await call("createBatch",{jobs:requests});await refresh();toast(`${requests.length} trabajo(s) programado(s)`,`ok`,mode==="celebration"?"Un mensaje al cumpleañero con copias":mode==="broadcast"?"Comunicado privado con CCO":"Individuales");nav("calendario");}catch(e){toast("No se pudo programar","error",e.message);}
 };
 for(const [field,fn] of [["composeCss",previewCompose],["templateCss",previewTemplate]]){
   $(field).addEventListener("input",()=>{clearTimeout(window["__"+field+"Timer"]);window["__"+field+"Timer"]=setTimeout(fn,320);});
  }
  $("composePreviewMode").onchange=previewCompose;$("templatePreviewMode").onchange=previewTemplate;
  $("composeAnimated").onchange=previewCompose;$("templateAnimated").onchange=previewTemplate;
  $("templateFormatHTML").onclick=()=>{$("templateHtml").value=CCEmailCSS.prettyHTML($("templateHtml").value);previewTemplate();toast("HTML ordenado y sangrado");};
  $("templateFormatCSS").onclick=()=>{try{$("templateCss").value=CCEmailCSS.prettyCSS($("templateCss").value);previewTemplate();toast("CSS ordenado");}catch(e){toast("CSS inválido","error",e.message);}};
  $("composeFormatHTML").onclick=()=>{$("composeHtml").value=CCEmailCSS.prettyHTML($("composeHtml").value);previewCompose();};
  $("composeFormatCSS").onclick=()=>{try{$("composeCss").value=CCEmailCSS.prettyCSS($("composeCss").value);previewCompose();}catch(e){toast("CSS inválido","error",e.message);}};
  $("templateCheckCSS").onclick=()=>{try{const result=CCEmailCSS.analyze($("templateHtml").value,$("templateCss").value);toast("Diagnóstico CSS","ok",result.summary);}catch(e){toast("CSS no permitido","error",e.message);}};
  $("composeCheckCSS").onclick=()=>{try{const result=CCEmailCSS.analyze($("composeHtml").value,$("composeCss").value);toast("Diagnóstico CSS","ok",result.summary);}catch(e){toast("CSS no permitido","error",e.message);}};
  $("templateImportCss").onchange=async ev=>{
    const file=ev.target.files?.[0];if(!file)return;
    try{const text=await file.text();CCEmailCSS.validateCss(text);$("templateCss").value=text;previewTemplate();toast("CSS importado y validado");}
    catch(e){toast("No se pudo importar CSS","error",e.message);}finally{ev.target.value="";}
  };
  $("templateImportFile").onchange=async ev=>{const file=ev.target.files?.[0];if(!file)return;try{if(file.size>140000)throw Error("HTML supera los 140 KB");$("templateId").value="";$("templateName").value=file.name.replace(/\.(?:html?|xhtml)$/i,"").slice(0,100);$("templateSubject").value="¡Feliz cumpleaños, {{nombre}}!";$("templateCategory").value="birthday";const content=await file.text();const extracted=CCEmailCSS.extract(content);$("templateHtml").value=extracted.html;$("templateCss").value=extracted.css;await previewTemplate();toast("HTML importado. Guarda la plantilla para utilizarla.");nav("plantillas");}catch(e){toast("Error al importar HTML","error",e.message);}ev.target.value="";};
 $("sendTest").onclick=async()=>{
  const identity=state.identities.find(i=>i.id===$("composeIdentity").value);if(!identity?.email){toast("Selecciona una cuenta de Thunderbird","error");return;}
  if(!confirm(`Se enviará una prueba REAL desde ${identity.email} hacia la MISMA cuenta. ¿Continuar?`))return;
  const mode=$("composeMode").value;
  const selected=mode==="celebration"?state.contacts.find(c=>c.id===$("birthdayMainContact").value):
    mode==="individual"?state.contacts.find(c=>c.email.toLowerCase()===$("composeTo").value.trim().toLowerCase()):null;
  const legacy=state.people.find(p=>p.id===$("composePerson").value);
  const btn=$("sendTest");btn.disabled=true;
  try{const previewPhoto=state.manualPhotoId||(selected?await contactPhotoFor(selected):null)||legacy?.photoId||null;
    await call("createBatch",{jobs:[{identityId:identity.id,to:identity.email,subject:"[PRUEBA] "+$("composeSubject").value,messageText:$("composeMessageText").value,html:$("composeHtml").value,css:$("composeCss").value,emailAnimation:$("composeAnimated").checked,at:Date.now()-1000,personId:legacy?.id||null,personName:$("composeManualName").value.trim()||selected?.name||legacy?.name||"Contacto de prueba",position:selected?.position||legacy?.position||"",branch:selected?.branch||legacy?.branch||"",employeeCode:selected?.code||legacy?.code||"",photoId:previewPhoto,template:$("composeTemplate").value}]});toast("Preparando envío de prueba...","sending",`Destino: ${identity.email}`);await call("sendDueNow");await refresh();const recent=state.jobs.filter(j=>j.to===identity.email&&j.subject.startsWith("[PRUEBA]")).sort((a,b)=>b.createdAt-a.createdAt)[0];toast(recent?.status==="sent"?"Thunderbird confirmó el envío de prueba":"Revisa el historial de la prueba",recent?.status==="sent"?"ok":"error",recent?.error||"Comprueba el correo recibido y los adjuntos.");}catch(e){toast("Error durante la prueba","error",e.message);}finally{btn.disabled=false;}
 };
 $("newTemplate").onclick=()=>{$("templateId").value="";$("templateName").value="";$("templateSubject").value="";$("templateHtml").value=CC_DEFAULT_TEMPLATES[0].html;$("templateCss").value=CC_DEFAULT_TEMPLATES[0].css||"";$("templateAnimated").checked=true;$("templateCategory").value="birthday";state.templateId="";previewTemplate();};$("templateHtml").oninput=()=>{clearTimeout(window.__templateTimer);window.__templateTimer=setTimeout(previewTemplate,350);};$("templatePreviewBtn").onclick=previewTemplate;$("templateForm").onsubmit=async ev=>{ev.preventDefault();try{const t=await call("saveTemplate",{template:{id:$("templateId").value||undefined,name:$("templateName").value,category:$("templateCategory").value,subject:$("templateSubject").value,html:$("templateHtml").value,css:$("templateCss").value,emailAnimation:$("templateAnimated").checked}});state.templateId=t.id;await refresh();toast("Plantilla guardada");}catch(e){toast("Error de plantilla","error",e.message);}};$("templateDelete").onclick=async()=>{const id=$("templateId").value;if(!id||!confirm("¿Eliminar la plantilla?"))return;await call("deleteTemplate",{id});state.templateId="";await refresh();toast("Plantilla eliminada");};
 $("newPerson").onclick=()=>openPerson();$("nativeBirthdaySearch").oninput=()=>{state.nativeShown=60;renderNativeBirthdays();};$("reloadNativeBirthdays").onclick=async()=>{await refreshDirectory();toast("Agenda Thunderbird actualizada");};$("closePerson").onclick=$("dismissPerson").onclick=()=>$("personDialog").close();$("personForm").onsubmit=savePersonUI;$("choosePersonGallery").onclick=()=>openGallery("person");$("openComposeGallery").onclick=()=>openGallery("compose");$("closeGalleryDialog").onclick=()=>$("galleryDialog").close();$("photoGalleryMore").onclick=()=>{galleryShown+=24;renderPhotoGallery();};$("photoGallerySearch").oninput=()=>{galleryShown=24;renderPhotoGallery();};$("photoFiles").onchange=importPhotos;$("photoFolder").onchange=async ev=>{try{await importPhotos(ev);}catch(e){toast("Error de importación","error",e.message);}};$("peopleSearch").oninput=renderPeople;$("importContacts").onclick=()=>importContacts().catch(e=>toast("Error de contactos","error",e.message));$("importCsv").onclick=()=>$("csvFile").click();$("csvFile").onchange=async ev=>{try{const f=ev.target.files[0];if(f)await importCSV(f);}catch(e){toast("Error CSV","error",e.message);}ev.target.value="";};
 $("saveGroup").onclick=async()=>{const memberIds=[...$("groupMembers").querySelectorAll("input:checked")].map(x=>x.value);try{await call("saveList",{list:{id:$("groupId").value,name:$("groupName").value,memberIds}});$("groupId").value="";$("groupName").value="";await refresh();toast("Lista reutilizable guardada");}catch(e){toast("No se pudo guardar lista","error",e.message);}};
 $("clearGroup").onclick=()=>{$("groupId").value="";$("groupName").value="";for(const x of $("groupMembers").querySelectorAll("input"))x.checked=false;};
 $("settingsForm").addEventListener("input",()=>$("settingsForm").dataset.dirty="1");$("settingsForm").onsubmit=async ev=>{ev.preventDefault();try{let logoAssetId=state.settings.logoAssetId||"";const file=$("logoFile").files[0];if(file){logoAssetId="company-logo";await PhotoDB.put(logoAssetId,await resizedPhoto(file));}let footerAssetId=state.settings.footerAssetId||"";const footerFile=$("footerFile").files[0];if(footerFile){footerAssetId="footer-background";await PhotoDB.put(footerAssetId,await resizedPhoto(footerFile));}
    await call("saveSettings",{settings:{company:$("settingsCompany").value,defaultIdentityId:$("settingsIdentity").value,defaultTemplateId:$("settingsTemplate").value,defaultTime:$("settingsTime").value,autoNativeBirthday:$("settingsNativeAuto").checked,birthdayCopyGroupId:$("settingsBirthdayGroup").value,birthdayCopyMode:$("settingsBirthdayCopyMode").value,logoAssetId,footerAssetId,website:$("settingsWebsite").value,socials:{facebook:$("settingsFacebook").value,instagram:$("settingsInstagram").value,linkedin:$("settingsLinkedin").value}}});$("settingsForm").dataset.dirty="0";await refresh();previewCompose();toast("Configuración guardada");}catch(e){toast("No se guardó configuración","error",e.message);}};
 }
async function refreshDirectory(){try{const d=await call("contactDirectory");state.contacts=d.contacts||[];state.contactGroups=d.groups||[];populateNativeAgendaFilter();populateNativeSelectors();renderSelectedContactCard();renderNativeBirthdays();renderCalendar("bigCalendar",true);renderCalendar("miniCalendar",false);renderUpcoming();renderSelectedBirthdays();}catch(e){toast("No se pudo leer la agenda","error",e.message);}}
async function bootstrap(){wiring();try{state.identities=await call("identities");const data=await call("state");Object.assign(state,data);await refreshDirectory();renderAll();$("composeWhen").value=isoTime(new Date(Date.now()+60*60*1000));chooseComposeTemplate("builtin-notice");renderConfigOptions();galleryInit().catch(e=>console.warn("Galería no disponible",e));updateComposeMode();renderSelectedContactCard();}catch(e){toast("Error al abrir complemento","error",e.message);}}
API.runtime.onMessage.addListener(message=>{if(message?.event){if(message.type==="jobChanged"&&message.status==="sending")toast("Enviando correo...","sending","Procesando mediante Thunderbird");if(message.type==="jobChanged"&&message.status==="sent")toast("Correo enviado mediante Thunderbird","ok","Comprueba el registro en Enviados.");if(message.type==="jobChanged"&&message.status==="review")toast("Envío pendiente de revisión","error");refresh().catch(console.error);}});
bootstrap();setInterval(()=>{if(document.hidden||["redactar","plantillas"].includes(state.page))return;refresh().catch(console.error);},30000);

// Ayuda local de actualización. La descarga e instalación las gestiona Thunderbird,
// no ejecutamos código remoto ni alteramos el instalador desde la página del XPI.
{
 const button=document.getElementById('updateDetailsBtn');
 const details=document.getElementById('updateDetails');
 if(button&&details){
  button.addEventListener('click',()=>{details.hidden=!details.hidden;button.setAttribute('aria-expanded',String(!details.hidden));});
  const version=(globalThis.messenger||globalThis.browser)?.runtime?.getManifest?.()?.version||'0.7.0';
  document.getElementById('addonVersion').textContent='Correo Calendario '+version;
  const origin='https://lordmanuel.github.io/automail/updates.json';
  document.getElementById('addonUpdateStatus').textContent='Canal configurado: '+origin+' · Se activará al publicar GitHub Pages.';
 }
}
