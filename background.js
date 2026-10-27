/* Correo Calendario 0.7.2. Persistencia transaccional de programaciones y recuperación segura. */
const API = globalThis.messenger || globalThis.browser;
const KEY="scheduledMessages", PEOPLE="cc_people", TEMPLATES="cc_templates", SETTINGS="cc_settings", LEDGER="cc_annual_ledger", LISTS="cc_recipient_lists", CONTACT_PHOTOS="cc_contact_photos";
const ALARM="scheduled-email-tick", MAX_SEND_PER_TICK=5;
let processing=false;
// Serialización de todos los cambios en la misma colección: evita pérdidas cuando
// varios formularios programan o cancelan simultáneamente mientras corre un envío.
let jobsMutation=Promise.resolve();
function mutateJobs(callback){
  const work=jobsMutation.then(async()=>{
    const list=await jobs();
    const result=await callback(list);
    if(result?.changed)await write(KEY,list);
    return result?.value;
  });
  jobsMutation=work.then(()=>undefined,()=>undefined);
  return work;
}
let initialized=false, initialization=null;
const stamp=()=>Date.now();
const safeText=s=>String(s??"");
const emailList=s=>String(s??"").split(/[;,\n]+/).map(v=>v.trim()).filter(Boolean);
const validEmail=s=>/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(s);
async function read(key,def){const o=await API.storage.local.get(key);return o[key]??def;}
async function write(key,val){await API.storage.local.set({[key]:val});}
async function jobs(){return read(KEY,[]);}
async function identities(){const accounts=await API.accounts.list();return accounts.flatMap(a=>(a.identities||[]).map(i=>({id:i.id,email:i.email,name:i.name||i.email,accountId:a.id}))).filter(i=>i.email);}
async function ensureDefaults(){const d=await API.storage.local.get([PEOPLE,TEMPLATES,SETTINGS,LEDGER,LISTS,CONTACT_PHOTOS]);if(!Array.isArray(d[PEOPLE]))await write(PEOPLE,[]);if(!Array.isArray(d[TEMPLATES]))await write(TEMPLATES,CC_DEFAULT_TEMPLATES);else {
    const existing=d[TEMPLATES];
    const additions=CC_DEFAULT_TEMPLATES.filter(t=>!existing.some(x=>x.id===t.id));
    // Migrar únicamente el comunicado integrado antiguo que bloqueaba los envíos CCO.
    const fixed=existing.map(t=>{
      if(t.id!=="builtin-notice"||!t.builtin)return t;
      // Renombrar solo la plantilla integrada: conservar HTML y CSS personalizados.
      const title=t.name==="Comunicado RRHH"?"Comunicado general":t.name;
      const html=t.html?.replace("<p>Estimado/a <b>{{nombre}}</b>:</p>","<p>Estimado equipo:</p>")
        .replace("[Escribe aquí tu comunicado]","{{mensaje}}")||t.html;
      return title!==t.name||html!==t.html?{...t,name:title,html}:t;
    });
    if(additions.length||fixed.some((t,i)=>t!==existing[i]))await write(TEMPLATES,[...additions,...fixed]);
  }if(!d[SETTINGS])await write(SETTINGS,{company:"Mi organización",defaultIdentityId:"",defaultTemplateId:"builtin-birthday",defaultTime:"09:00",logoAssetId:"",footerAssetId:"",autoNativeBirthday:false,birthdayCopyGroupId:"",birthdayCopyMode:"bcc",website:"",socials:{facebook:"",instagram:"",linkedin:""}});if(!d[LEDGER])await write(LEDGER,{});if(!Array.isArray(d[LISTS]))await write(LISTS,[]);if(!d[CONTACT_PHOTOS])await write(CONTACT_PHOTOS,{});}
async function emit(type,data={}){try{await API.runtime.sendMessage({event:true,type,...data});}catch(_){/*panel cerrado*/}}
async function notify(title,message){try{await API.notifications.create({type:"basic",iconUrl:API.runtime.getURL("icons/icon-128.png"),title,message});}catch(e){console.warn("Notificación no disponible",e);}}
async function updateJob(id,patch,expected){
  const status=await mutateJobs(list=>{
    const i=list.findIndex(x=>x.id===id);
    if(i<0||(expected&&list[i].status!==expected))return {changed:false,value:null};
    list[i]={...list[i],...patch};
    return {changed:true,value:list[i].status};
  });
  if(status!==null)await emit("jobChanged",{id,status});
  return status!==null;
}
function validBirthdayDate(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const [y,m,d]=s.split("-").map(Number);const actual=new Date(y,m-1,d);return actual.getFullYear()===y&&actual.getMonth()===m-1&&actual.getDate()===d;}
function validateNew(job,now=stamp()){
  if(!job.identityId||!job.subject?.trim())throw Error("Cuenta y asunto son obligatorios.");
  const mode=job.mode==="broadcast"?"broadcast":"individual";
  // Sin foto se utiliza el recuadro neutro de la plantilla corporativa; no bloquear el saludo.
  if(mode==="individual"&&(/\{\{\s*(nombre|puesto|codigo)\s*\}\}/i.test(job.html||""))&&!job.personId&&!job.personName)throw Error("Elige un contacto de Thunderbird para completar la plantilla.");
  const recipients=mode==="broadcast"?emailList(Array.isArray(job.bcc)?job.bcc.join(","):job.bcc):emailList(job.to);
  if(!recipients.length||recipients.some(r=>!validEmail(r)))throw Error("Hay direcciones de correo no válidas.");
  if(mode==="individual"&&recipients.length!==1)throw Error("Para mensajes personalizados usa un correo por empleado.");
  if(mode==="broadcast"&&(recipients.length>150||new Set(recipients.map(x=>x.toLowerCase())).size!==recipients.length))throw Error("Comunicado: máximo 150 direcciones CCO únicas por trabajo.");
  if(mode==="broadcast"&&!job.personName&&/\{\{\s*(nombre|nombre_pila)\s*\}\}/i.test((job.html||"")+job.subject))throw Error("La plantilla usa {{nombre}}: escribe el nombre común que debe ver toda la lista.");
  const carbonCopy=emailList(Array.isArray(job.cc)?job.cc.join(","):job.cc),blindCopy=mode==="broadcast"?recipients:emailList(Array.isArray(job.bcc)?job.bcc.join(","):job.bcc);
  if(carbonCopy.length+blindCopy.length>150||[...carbonCopy,...blindCopy].some(e=>!validEmail(e)))throw Error("Copias inválidas o demasiados destinatarios (máximo 150).");
  if(mode!=="broadcast"&&[...carbonCopy,...blindCopy].some(e=>e.toLowerCase()===recipients[0]?.toLowerCase()))throw Error("El destinatario principal no debe repetirse en CC o CCO.");
  if(new Set([...carbonCopy,...blindCopy, ...(mode==="broadcast"?[]:recipients)].map(e=>e.toLowerCase())).size !== carbonCopy.length+blindCopy.length+(mode==="broadcast"?0:recipients.length))throw Error("Una misma dirección aparece repetida entre Para, CC y CCO.");
  if(!job.html?.trim()&&!job.body?.trim())throw Error("El mensaje o HTML no puede estar vacío.");
  CCEmailCSS.analyze(job.html||"",job.css||"");
  if((job.html||"").length>140000)throw Error("La plantilla HTML es demasiado grande (máximo 140 KB de texto).");
  if(!Number.isFinite(job.at)||job.at<now-60000||job.at>now+3*365*86400000)throw Error("Fecha inválida (máximo 3 años).");
  return recipients;
}
function prepareJob(data){return {id:crypto.randomUUID(),schemaVersion:7,mode:data.mode==="broadcast"?"broadcast":"individual",cc:emailList(Array.isArray(data.cc)?data.cc.join(","):data.cc),bcc:emailList(Array.isArray(data.bcc)?data.bcc.join(","):data.bcc),identityId:data.identityId,to:emailList(data.to)[0]||"",subject:safeText(data.subject).trim(),body:safeText(data.body),messageText:safeText(data.messageText),html:safeText(data.html),css:safeText(data.css||""),emailAnimation:data.emailAnimation!==false,at:data.at,personId:data.personId||null,personName:safeText(data.personName),position:safeText(data.position),branch:safeText(data.branch),employeeCode:safeText(data.employeeCode),photoId:data.photoId||null,recurringKey:data.recurringKey||null,template:data.template||"html",status:"pending",attempts:0,error:null,createdAt:stamp(),updatedAt:stamp()};}
async function createBatch(input){const arr=Array.isArray(input)?input:[];if(!arr.length||arr.length>100)throw Error("Programa entre 1 y 100 correos por operación.");const ids=await identities();const now=stamp(),prepared=[];
  for(const j of arr){validateNew(j,now);if(!ids.some(i=>i.id===j.identityId))throw Error("Cuenta de correo no disponible.");prepared.push(prepareJob(j));}
  await mutateJobs(list=>{list.push(...prepared);return {changed:true,value:true};});
  await emit("scheduled",{count:prepared.length});return prepared;
}
function escapeHTML(s){return safeText(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));}
function sanitizeHTML(html,css="",progressive=true){
  // IMPORTANTE: validar antes de interpolar los recursos gráficos en Base64.
  // El límite de 140 KB corresponde al HTML editable, no al JPG generado.
  return CCEmailCSS.compile(html,css,{progressive});
}
function checkedImageData(value,label="imagen"){
  if(!value)return null;
  if(typeof value!=="string"||value.length>5_000_000||!/^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(value)){
    throw Error(`El archivo de ${label} no es válido o supera el límite de 3.75 MB. Optimiza la fotografía antes de enviar.`);
  }
  return value;
}

async function renderHtml(job,person,settings){
  const name=job.personName||person?.name||emailList(job.to)[0]?.split("@")[0]||"Colaborador";
  const links=await read(CONTACT_PHOTOS,{});
  const resolvedPhotoId=job.photoId||person?.photoId||links[person?.contactId]?.photoId;
  if(resolvedPhotoId&&!job.photoId)job.photoId=resolvedPhotoId;
  const photoUrl=checkedImageData(await PhotoDB.get(resolvedPhotoId),"fotografía");
  const logoUrl=checkedImageData(await PhotoDB.get(settings.logoAssetId),"logotipo");
  const img=u=>u&&/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(u)?`<img alt="Foto del colaborador" width="200" height="200" src="${u}" style="width:200px;height:200px;max-width:100%;object-fit:cover;border-radius:18px;border:6px solid #fff;display:inline-block">`:"";
  const logo=u=>u&&/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(u)?`<img alt="Logo de la empresa" src="${u}" width="170" style="width:170px;max-width:100%;height:auto">`:escapeHTML(settings.company||"Empresa");
  const messageVars={nombre:name,nombre_pila:name.split(/\s+/)[0],empresa:settings.company||"Empresa",puesto:job.position||person?.position||"",sucursal:job.branch||person?.branch||"",codigo:job.employeeCode||person?.code||""};
  const expandedMessage=safeText(job.messageText).replace(/\{\{([a-z_]+)\}\}/gi,(match,key)=>messageVars[key.toLowerCase()]??match);
  if(/\{\{[\w_]+\}\}/.test(expandedMessage))throw Error("El texto del comunicado contiene una variable desconocida.");
  const messageText=escapeHTML(expandedMessage).replace(/\r?\n/g,"<br>");
  const vars={"mensaje":messageText,"nombre":escapeHTML(name),"nombre_pila":escapeHTML(name.split(/\s+/)[0]),"empresa":escapeHTML(settings.company||"Empresa"),"puesto":escapeHTML(job.position||person?.position||""),"sucursal":escapeHTML(job.branch||person?.branch||""),"codigo":escapeHTML(job.employeeCode||person?.code||""),"fecha":escapeHTML(new Date(job.at).toLocaleDateString("es-HN")),"foto":img(photoUrl),"logo":logo(logoUrl)};
  // Sanear y convertir CSS sobre el código pequeño de la plantilla ANTES de
  // agregar la tarjeta JPG. Así no rechazamos correos válidos por Base64.
  let s=sanitizeHTML(safeText(job.html),job.css||"",job.emailAnimation!==false);
  if(s.includes("{{tarjeta_cumple}}")){
    const image=checkedImageData(await CCPoster.render({photo:photoUrl,name,position:job.position||person?.position,date:new Date(job.at).toLocaleDateString("es-HN",{day:"numeric",month:"long"}),branch:job.branch||person?.branch}),"tarjeta de cumpleaños");
    job.generatedPoster=image;
    vars.tarjeta_cumple=`<img src="${image}" width="540" alt="Tarjeta de cumpleaños personalizada para ${escapeHTML(name)}" style="width:100%;max-width:540px;height:auto;display:block;border:0">`;
  }
  if(!s.includes("{{mensaje}}")&&job.messageText?.trim()) s+=`<div style="max-width:620px;margin:18px auto;padding:20px;color:#162a46;font:16px/1.6 Arial,sans-serif">${messageText}</div>`;
  s=s.replace(/\{\{([\w_]+)\}\}/gi,(_,key)=>vars[key.toLowerCase()]??`{{${key}}}`);
  if(/\{\{[\w_]+\}\}/.test(s))throw Error("La plantilla contiene variables no reconocidas; revisa el HTML antes de enviar.");
  // Los fragmentos insertados proceden solo de valores escapados o de las
  // funciones internas que construyen IMG con data URL previamente validada.
  return s;
}
function plainInterpolate(s,job,person,settings){const name=job.personName||person?.name||emailList(job.to)[0]?.split("@")[0]||"Colaborador";const v={mensaje:job.messageText||"",nombre:name,empresa:settings.company||"Empresa",puesto:job.position||person?.position||"",sucursal:job.branch||person?.branch||"",codigo:job.employeeCode||person?.code||""};const output=safeText(s).replace(/\{\{(\w+)\}\}/gi,(m,k)=>v[k.toLowerCase()]??m);if(/\{\{[\w_]+\}\}/.test(output))throw Error("Hay variables sin reemplazar en el asunto o texto del correo.");return output;}
function asFile(dataUrl,name){const match=/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/i.exec(dataUrl||"");if(!match)return null;const bin=atob(match[2]),bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);return new File([bytes],name,{type:match[1]});}
async function runDue(){if(processing)return;processing=true;
 try{
  await enqueueBirthdays();
  const due=(await jobs()).filter(j=>j.status==="pending"&&j.at<=stamp()).sort((a,b)=>a.at-b.at).slice(0,MAX_SEND_PER_TICK);
  for(const job of due){if(!await updateJob(job.id,{status:"sending",attempts:(job.attempts||0)+1,updatedAt:stamp()},"pending"))continue;
   let planned=null;
   try{
    const identity=(await identities()).find(i=>i.id===job.identityId);if(!identity)throw Error("No existe la cuenta remitente seleccionada.");
    const people=await read(PEOPLE,[]),person=people.find(p=>p.id===job.personId);
    const settings=await read(SETTINGS,{});
    const mode=job.mode==="broadcast"?"broadcast":"individual";
    const details={identityId:job.identityId,to:mode==="broadcast"?[identity.email]:emailList(job.to),subject:plainInterpolate(job.subject,job,person,settings)};
    if(mode==="broadcast"){if(!job.bcc?.length||job.bcc.some(x=>!validEmail(x)))throw Error("La lista CCO no es válida.");details.bcc=job.bcc;}else{if(job.cc?.length)details.cc=job.cc;if(job.bcc?.length)details.bcc=job.bcc;}
    planned={to:[...details.to],cc:[...(details.cc||[])],bcc:[...(details.bcc||[])]};
    if(job.html){details.body=await renderHtml(job,person,settings);details.isPlainText=false;details.deliveryFormat="both";}
    else{details.plainTextBody=plainInterpolate(job.body,job,person,settings);details.isPlainText=true;}
    const tab=await API.compose.beginNew(details);
    // Respaldo de la fotografía: se adjunta incluso si el cliente no representa el data URI embebido.
    if(job.photoId||job.photo){const data=job.photo||await PhotoDB.get(job.photoId);if(data){const file=asFile(data,`foto-${(job.employeeCode||job.id).replace(/[^a-z0-9_-]/gi,"")}.jpg`);if(file)await API.compose.addAttachment(tab.id,{file});}}
    if(job.generatedPoster){const card=asFile(job.generatedPoster,`tarjeta-cumpleanos-${(job.employeeCode||job.id).replace(/[^a-z0-9_-]/gi,"")}.jpg`);if(card)await API.compose.addAttachment(tab.id,{file:card});}
    const result=await API.compose.sendMessage(tab.id,{mode:"sendNow"});
    if(result?.error)throw Error(`Thunderbird informó un error de envío: ${result.error}`);
    if(result?.mode!=="sendNow")throw Error("Thunderbird no confirmó el envío inmediato. Comprueba la Bandeja de salida antes de reprogramar.");
    await updateJob(job.id,{status:"sent",resolvedSubject:details.subject,sentAt:stamp(),headerMessageId:result?.headerMessageId||null,
      recipientAudit:{to:details.to||[],cc:details.cc||[],bcc:details.bcc||[],
      acceptedBy:"Thunderbird/SMTP",checkedAt:stamp(),deliveryConfirmed:false},error:null,updatedAt:stamp()},"sending");
    await notify("Correo aceptado por Thunderbird",`${details.subject} · ${mode==="broadcast"?job.bcc.length+" destinatarios CCO":job.to}`);
   }catch(e){
    // La excepción no indica si el servidor SMTP procesó el mensaje: dejar revisión humana, no reintentar.
    const recipientAudit={to:planned?.to||[job.to],cc:planned?.cc||job.cc||[],bcc:planned?.bcc||job.bcc||[],
      acceptedBy:null,checkedAt:stamp(),deliveryConfirmed:false,uncertain:true};
    await updateJob(job.id,{status:"review",recipientAudit,error:String(e?.message||e),updatedAt:stamp()},"sending");
    await notify("Revisar envío programado",`${job.to}: ${String(e?.message||e).slice(0,130)}`);
   }
  }
 }finally{processing=false;}
}
// La libreta nativa es la fuente de aniversarios. Nunca activar sin consentimiento.
async function enqueueBirthdays(){
 const settings=await read(SETTINGS,{});if(!settings.autoNativeBirthday)return;
 const now=new Date(),today=`${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
 const hour=(settings.defaultTime||"09:00").split(":").map(Number),due=new Date(now.getFullYear(),now.getMonth(),now.getDate(),hour[0]||0,hour[1]||0).getTime();
 if(stamp()<due||!settings.defaultIdentityId)return;
 const {contacts,groups}=await getContactDirectory();const people=[...new Map(contacts.filter(c=>c.birthday?.slice(5)===today).map(c=>[c.email.toLowerCase(),c])).values()];
 if(!people.length)return;
 const groupId=settings.birthdayCopyGroupId||"",copy=groupId?contacts.filter(c=>groupId.startsWith("book:")?c.bookId===groupId.slice(5):(c.listIds||[]).includes(groupId.slice(5))):[];
 const templates=await read(TEMPLATES,[]),t=templates.find(x=>x.id===settings.defaultTemplateId)||CC_DEFAULT_TEMPLATES[0];
 const wasChanged=await mutateJobs(async list=>{
 const ledger=await read(LEDGER,{});let changed=false;
 for(const c of people){const key=`native:${c.id}:${now.getFullYear()}`;
  if(ledger[key]||list.some(j=>j.recurringKey===key))continue;
  // No volver a enviar el mismo año si la V0.5.x dejó una felicitación pendiente o enviada.
  if(list.some(j=>j.to?.toLowerCase()===c.email.toLowerCase()&&j.status!=="cancelled"&&new Date(j.at).toDateString()===now.toDateString()&&(j.recurringKey||/cumple|birthday/i.test(j.template||"")||/cumple|birthday/i.test(j.subject||""))))continue;
  const recipients=[...new Set(copy.map(e=>e.email.toLowerCase()).filter(e=>e!==c.email.toLowerCase()))];
  const data={mode:"individual",to:c.email,cc:settings.birthdayCopyMode==="cc"?recipients:[],bcc:settings.birthdayCopyMode==="bcc"?recipients:[],identityId:settings.defaultIdentityId,subject:t.subject,html:t.html,css:t.css||"",at:Math.max(due,stamp()),personName:c.name,position:c.position||"",branch:c.branch||"",employeeCode:c.code,photoId:(await read(CONTACT_PHOTOS,{}))[c.id]?.photoId||null,recurringKey:key,template:t.id};
  try{validateNew(data,stamp());list.push(prepareJob(data));ledger[key]={createdAt:stamp(),jobId:list.at(-1).id};changed=true;}catch(e){console.warn("No programado",c.id,e);}
 }
 if(changed)await write(LEDGER,ledger);
 return {changed,value:changed};
 });
 if(wasChanged)await emit("birthdayQueued");
}

async function savePerson(person){
 const people=await read(PEOPLE,[]);const p={id:person.id||crypto.randomUUID(),code:safeText(person.code).trim().slice(0,70),name:safeText(person.name).trim().slice(0,180),email:safeText(person.email).trim().slice(0,180),position:safeText(person.position).trim().slice(0,140),branch:safeText(person.branch).trim().slice(0,140),birthday:safeText(person.birthday),photoId:person.photoId||null,contactId:person.contactId||null,automatic:!!person.automatic,sendTime:person.sendTime||"09:00",identityId:person.identityId||"",templateId:person.templateId||"builtin-birthday"};
 if(!p.name||!validEmail(p.email)||!validBirthdayDate(p.birthday))throw Error("Nombre, correo y fecha de nacimiento válida son obligatorios.");
 if(people.some(x=>x.id!==p.id&&x.email.toLowerCase()===p.email.toLowerCase()))throw Error("Ya existe un empleado con ese correo.");
 if(p.code&&people.some(x=>x.id!==p.id&&x.code&&x.code.toLowerCase()===p.code.toLowerCase()))throw Error("Ya existe un empleado con ese código; verifica los datos para evitar confundir fotografías.");
 if(p.automatic&&!p.identityId&&!(await read(SETTINGS,{})).defaultIdentityId)throw Error("Selecciona una cuenta remitente en Configuración antes de activar automatización.");
 const index=people.findIndex(x=>x.id===p.id);if(index>=0)people[index]=p;else people.push(p);await write(PEOPLE,people);if(!p.automatic){await mutateJobs(list=>{let changed=false;for(const j of list){if(j.status==="pending"&&j.recurringKey?.startsWith(p.id+"-")){j.status="cancelled";j.updatedAt=stamp();changed=true;}}return {changed,value:changed};});}await emit("personChanged");return p;
}
async function saveTemplate(template){const entries=await read(TEMPLATES,[]);const t={id:template.id||crypto.randomUUID(),name:safeText(template.name).trim().slice(0,120),category:template.category==="birthday"?"birthday":"notice",subject:safeText(template.subject).trim().slice(0,260),html:safeText(template.html),css:safeText(template.css||""),emailAnimation:template.emailAnimation!==false,builtin:false};CCEmailCSS.analyze(t.html,t.css);if(!t.name||!t.subject||!t.html||t.html.length>140000)throw Error("Plantilla: nombre, asunto y HTML válidos son obligatorios.");const index=entries.findIndex(x=>x.id===t.id);if(index>=0)entries[index]=t;else entries.push(t);await write(TEMPLATES,entries);return t;}
// Thunderbird 128+ devuelve ContactNode.vCard directamente; properties es un formato antiguo.
function unfoldVCard(source){return safeText(source).replace(/\r?\n[ \t]/g,"").replace(/\r\n/g,"\n");}
function vCardFields(source,key){return unfoldVCard(source).split("\n").filter(line=>new RegExp(`^(?:[a-z0-9_-]+\\.)?${key}(?:[;:]|$)`,"i").test(line)).map(line=>line.slice(line.indexOf(":")+1).trim().replace(/\\n/gi," ").replace(/\\([,;\\])/g,"$1"));}
function convertContact(item,book){const props=item.properties||{},v=item.vCard||props.vCard||"";
  const name=(vCardFields(v,"FN")[0]||props.DisplayName||[props.FirstName,props.LastName].filter(Boolean).join(" ")||"Contacto").trim();
  const email=(vCardFields(v,"EMAIL")[0]||props.PrimaryEmail||"").replace(/^mailto:/i,"").trim();
  const birthdayRaw=(vCardFields(v,"BDAY")[0]||"");
  const birthday=birthdayRaw.replace(/^(\d{4})(\d{2})(\d{2})$/,"$1-$2-$3").replace(/^--(\d{2})-?(\d{2})$/,"2000-$1-$2");
  return validEmail(email)?{id:item.id,name,email,birthday:/^\d{4}-\d{2}-\d{2}$/.test(birthday)?birthday:"",book:book.name,bookId:book.id,listIds:[],code:vCardFields(v,"X-EMPLOYEE-CODE")[0]||"",position:vCardFields(v,"TITLE")[0]||"",branch:vCardFields(v,"X-CC-BRANCH")[0]||vCardFields(v,"X-BRANCH")[0]||"",company:vCardFields(v,"ORG")[0]||"",writable:!book.readOnly,remote:!!item.remote}:null;
}
async function getContactDirectory(){
 const books=await API.addressBooks.list(),contacts=[],groups=[{id:"all",name:"Todas las libretas",kind:"all"}];
 const byId=new Map(),byMail=new Map();
 function include(node,book,listId=""){
  const c=convertContact(node,book);if(!c)return null;
  let person=byId.get(c.id);
  // Algunos proveedores de libretas devuelven IDs distintos para la lista y para la libreta.
  // La dirección completa, no el nombre, es la segunda llave de identificación.
  if(!person)person=byMail.get(c.email.toLowerCase());
  if(!person){person=c;contacts.push(person);byId.set(c.id,person);byMail.set(c.email.toLowerCase(),person);}
  if(listId&&!person.listIds.includes(listId))person.listIds.push(listId);
  return person;
 }
 for(const book of books){
  groups.push({id:"book:"+book.id,name:"📒 "+book.name,kind:"book",bookId:book.id});
  try{for(const item of await API.addressBooks.contacts.list(book.id))include(item,book);}
  catch(e){console.warn("No se pudo leer libreta",book.name,e);groups.at(-1).error=String(e?.message||e);}
  try{
   for(const list of await API.addressBooks.mailingLists.list(book.id)){
    const g={id:"list:"+list.id,name:"👥 "+list.name+" · "+book.name,kind:"list",bookId:book.id,memberCount:0,resolvedCount:0,unresolvedCount:0};
    groups.push(g);
    try{
     const members=await API.addressBooks.mailingLists.listMembers(list.id);
     g.memberCount=members.length;
     for(const m of members){if(include(m,book,list.id))g.resolvedCount++;else g.unresolvedCount++;}
     // Un recuento distinto es un problema real que el usuario debe conocer ANTES de enviar.
    }catch(e){g.error=String(e?.message||e);console.warn("Lista no accesible",list.name,e);}
   }
  }catch(e){console.warn("No se pudieron enumerar listas",book.name,e);}
 }
 for(const g of groups.filter(x=>x.kind==="book"))g.resolvedCount=contacts.filter(c=>c.bookId===g.bookId).length;
 return {contacts,groups,bookCount:books.length};
}
async function getContacts(){return (await getContactDirectory()).contacts;}
async function listState(){const d=await API.storage.local.get([KEY,PEOPLE,TEMPLATES,SETTINGS,LISTS]);return {jobs:d[KEY]||[],people:d[PEOPLE]||[],templates:d[TEMPLATES]||CC_DEFAULT_TEMPLATES,settings:d[SETTINGS]||{},lists:d[LISTS]||[],contactPhotos:await read(CONTACT_PHOTOS,{})};}
async function init(){
  // onInstalled, onStartup y carga del background pueden coincidir. La reparación
  // de trabajos interrumpidos se hace exactamente una vez por proceso, no durante
  // otro envío que todavía está ejecutándose en este mismo background.
  if(initialization)return initialization;
  if(initialized)return;
  initialization=(async()=>{
    await ensureDefaults();
    await mutateJobs(list=>{
      let changed=false;
      for(const j of list)if(j.status==="sending"){
        j.status="review";
        j.error="Thunderbird se cerró o se interrumpió durante el envío. Revisa Enviados antes de reprogramar.";
        j.updatedAt=stamp();changed=true;
      }
      return {changed,value:changed};
    });
    await API.alarms.create(ALARM,{periodInMinutes:1});
    initialized=true;
    await runDue();
  })();
  try{return await initialization;}
  finally{initialization=null;}
}
API.action.onClicked.addListener(()=>API.tabs.create({url:API.runtime.getURL("dashboard.html")}));
API.alarms.onAlarm.addListener(a=>{if(a.name===ALARM)runDue().catch(console.error);});
API.runtime.onMessage.addListener(async req=>{
 if(req?.event)return;
 switch(req?.type){
  case "state":return listState();case "list":return jobs();case "identities":return identities();case "contacts":return getContacts();case "contactDirectory":return getContactDirectory();
  case "openAddressBook":return API.addressBooks.openUI();
  case "writableBooks":return (await API.addressBooks.list()).filter(b=>!b.readOnly&&!b.remote).map(b=>({id:b.id,name:b.name}));
  case "contactPhoto":{const file=await API.addressBooks.contacts.getPhoto(req.id);if(!file||file.size>2*1024*1024)return null;return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.readAsDataURL(file);});}
  case "linkContactPhoto":{
    const id=safeText(req.id).trim(),photoId=safeText(req.photoId).trim();
    if(!id||!photoId||!(await PhotoDB.get(photoId)))throw Error("Selecciona un contacto exacto y una fotografía almacenada.");
    const contact=await API.addressBooks.contacts.get(id);
    if(!contact)throw Error("No existe el contacto seleccionado.");
    const links=await read(CONTACT_PHOTOS,{});
    links[id]={photoId,code:safeText(req.code).trim().slice(0,70),email:(vCardFields(contact.vCard||"","EMAIL")[0]||"").toLowerCase(),updatedAt:stamp()};
    if(req.syncVCardPhoto){const data=await PhotoDB.get(photoId),file=asFile(data,"foto-contacto.jpg");if(!file)throw Error("El archivo no es una fotografía admitida.");await API.addressBooks.contacts.setPhoto(id,file);}
    await write(CONTACT_PHOTOS,links);
    await emit("personChanged");return links[id];
  }
  case "updateContactProfile":{
    const id=safeText(req.id).trim(), current=await API.addressBooks.contacts.get(id);
    if(!current)throw Error("El contacto seleccionado ya no existe en Thunderbird.");
    const parentId=current.parentId||req.bookId;
    const book=(await API.addressBooks.list()).find(b=>b.id===parentId);
    if(book?.readOnly)throw Error("Esta libreta es de solo lectura. Edita el contacto desde su origen o usa otra libreta.");
    const original=current.vCard||current.properties?.vCard;
    if(!original)throw Error("Thunderbird no entregó la vCard; no se modificaron los datos.");
    const updated=CCProfile.patch(original,req.profile||{});
    await API.addressBooks.contacts.update(id,updated);
    let photoWarning="";
    const photoId=safeText(req.photoId).trim();
    if(photoId){
      const data=await PhotoDB.get(photoId);
      if(!data)throw Error("Los datos de contacto se guardaron, pero la imagen seleccionada ya no existe.");
      const links=await read(CONTACT_PHOTOS,{});
      links[id]={...links[id],photoId,code:safeText(req.profile?.code).trim().slice(0,70),email:safeText(req.profile?.email).toLowerCase(),updatedAt:stamp()};
      await write(CONTACT_PHOTOS,links);
      if(req.syncVCardPhoto){
        try {const file=asFile(data,"foto-contacto.jpg");if(!file)throw Error("Formato de imagen no válido.");await API.addressBooks.contacts.setPhoto(id,file);}
        catch(e){photoWarning="Los datos y la foto del complemento se guardaron, pero Thunderbird no pudo actualizar su imagen nativa: "+String(e.message||e);}
      }
    }
    await emit("personChanged");
    return {id,photoWarning,contact:convertContact(await API.addressBooks.contacts.get(id),book||{id:parentId,name:"Libreta"})};
  }
  case "newThunderbirdContact":{
    const name=safeText(req.name).trim().slice(0,180),email=safeText(req.email).trim().toLowerCase(),code=safeText(req.code).trim().slice(0,70);
    if(!name||!validEmail(email))throw Error("Nombre y correo válido son obligatorios.");
    if(/[\r\n]/.test(name+email+code))throw Error("No se admiten saltos de línea en los campos.");
    const directory=(await API.addressBooks.list()).find(b=>b.id===req.bookId&&!b.readOnly&&!b.remote);
    if(!directory)throw Error("Selecciona una libreta local que permita crear contactos.");
    const existing=(await getContacts()).some(c=>c.email.toLowerCase()===email);
    if(existing)throw Error("Ese correo ya está registrado en Thunderbird: selecciónalo para evitar duplicados.");
    const escapeV=s=>s.replace(/([\\;,])/g,"\\$1").replace(/\n/g,"\\n");
    const lines=["BEGIN:VCARD","VERSION:4.0",`FN:${escapeV(name)}`,`EMAIL:${email}`];
    if(code)lines.push(`X-EMPLOYEE-CODE:${escapeV(code)}`);
    lines.push("END:VCARD");
    const id=await API.addressBooks.contacts.create(directory.id,lines.join("\r\n"));
    return {id,name,email,code,bookId:directory.id};
  }
  case "createBatch":return createBatch(req.jobs);case "create":return (await createBatch([req.job]))[0];
  case "cancel":{if(!await updateJob(req.id,{status:"cancelled",updatedAt:stamp()},"pending"))throw Error("Solo se puede cancelar un pendiente.");return true;}
  case "delete":{await mutateJobs(list=>{const one=list.find(j=>j.id===req.id);if(!one||["sending","pending"].includes(one.status))throw Error("Cancela primero el envío.");list.splice(list.indexOf(one),1);return {changed:true,value:true};});return true;}
  case "attachPhotos":{
    const links=req.links||[];if(!Array.isArray(links)||!links.length||links.length>500)throw Error("Selecciona de 1 a 500 asociaciones.");
    const people=await read(PEOPLE,[]),used=new Set(),updates=new Map();
    for(const l of links){if(!l||typeof l.personId!=="string"||typeof l.photoId!=="string")throw Error("Asociación incorrecta");
      if(used.has(l.personId))throw Error("Empleado duplicado en el lote");used.add(l.personId);
      const p=people.find(p=>p.id===l.personId);if(!p)throw Error("El empleado seleccionado ya no existe");
      if(!(await PhotoDB.get(l.photoId)))throw Error("La foto no está disponible: "+l.photoId);
      updates.set(l.personId,l.photoId);
    }
    for(const p of people)if(updates.has(p.id))p.photoId=updates.get(p.id);
    await write(PEOPLE,people);await emit("personChanged");return {updated:updates.size};
  }
  case "savePerson":return savePerson(req.person);
  case "deletePerson":{const p=await read(PEOPLE,[]);await write(PEOPLE,p.filter(x=>x.id!==req.id));return true;}
  case "saveTemplate":return saveTemplate(req.template);
  case "saveList":{
    const name=safeText(req.list?.name).trim().slice(0,100),memberIds=[...new Set((req.list?.memberIds||[]).map(String))];
    if(!name||!memberIds.length||memberIds.length>100)throw Error("La lista necesita nombre y entre 1 y 100 empleados.");
    const people=await read(PEOPLE,[]);if(memberIds.some(id=>!people.find(p=>p.id===id)))throw Error("Uno o más empleados no existen.");
    const lists=await read(LISTS,[]),old=lists.find(l=>l.id===req.list.id),item={id:old?.id||crypto.randomUUID(),name,memberIds,updatedAt:stamp()};
    if(old)lists.splice(lists.indexOf(old),1,item);else lists.push(item);await write(LISTS,lists);return item;
  }
  case "deleteList":{const lists=await read(LISTS,[]);await write(LISTS,lists.filter(l=>l.id!==req.id));return true;}
  case "scheduleBirthdaysForDate":{
    if(!/^\d{4}-\d{2}-\d{2}$/.test(req.date))throw Error("Fecha incorrecta.");
    const day=new Date(req.date+"T12:00:00"),now=new Date();if(!Number.isFinite(day.getTime())||day.getTime()<new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime())throw Error("Selecciona hoy o una fecha posterior.");
    const directory=await getContactDirectory(),settings=await read(SETTINGS,{}),templates=await read(TEMPLATES,[]);
    if(!settings.defaultIdentityId)throw Error("Configura una cuenta remitente antes de programar.");
    const mmdd=req.date.slice(5),match=[...new Map(directory.contacts.filter(c=>c.birthday?.slice(5)===mmdd).map(c=>[c.email.toLowerCase(),c])).values()],groupId=settings.birthdayCopyGroupId||"";
    const copy=groupId?directory.contacts.filter(c=>groupId.startsWith("book:")?c.bookId===groupId.slice(5):(c.listIds||[]).includes(groupId.slice(5))):[];
    const t=templates.find(x=>x.id===settings.defaultTemplateId)||CC_DEFAULT_TEMPLATES[0];
    const count=await mutateJobs(async existing=>{const ledger=await read(LEDGER,{});let count=0;
    for(const c of match){const key=`native:${c.id}:${req.date.slice(0,4)}`;
      if(ledger[key]||existing.some(j=>j.recurringKey===key)||existing.some(j=>j.to?.toLowerCase()===c.email.toLowerCase()&&j.status!=="cancelled"&&new Date(j.at).toDateString()===day.toDateString()&&(j.recurringKey||/cumple|birthday/i.test(j.template||"")||/cumple|birthday/i.test(j.subject||""))))continue;
      const others=[...new Set(copy.map(x=>x.email.toLowerCase()).filter(x=>x!==c.email.toLowerCase()))];
      const when=Math.max(Date.parse(req.date+"T"+(settings.defaultTime||"09:00")+":00"),stamp()+65000);
      const data={mode:"individual",to:c.email,cc:settings.birthdayCopyMode==="cc"?others:[],bcc:settings.birthdayCopyMode==="bcc"?others:[],identityId:settings.defaultIdentityId,subject:t.subject,html:t.html,css:t.css||"",at:when,personName:c.name,position:c.position||"",branch:c.branch||"",employeeCode:c.code,photoId:(await read(CONTACT_PHOTOS,{}))[c.id]?.photoId||null,recurringKey:key,template:t.id};
      validateNew(data,stamp());existing.push(prepareJob(data));ledger[key]={jobId:existing.at(-1).id,createdAt:stamp()};count++;
    }
    if(count)await write(LEDGER,ledger);
    return {changed:count>0,value:count};
    });
    if(count)await emit("birthdayQueued");
    return {count};
  }
  case "deleteTemplate":{const t=await read(TEMPLATES,[]);await write(TEMPLATES,t.filter(x=>x.id!==req.id));return true;}
  case "saveSettings":{const old=await read(SETTINGS,{});const next={...old,footerAssetId:req.settings.footerAssetId||"",website:safeText(req.settings.website).slice(0,250),socials:Object.fromEntries(["facebook","instagram","linkedin"].map(k=>[k,safeText(req.settings.socials?.[k]).slice(0,250)])),company:safeText(req.settings.company).slice(0,150),defaultIdentityId:req.settings.defaultIdentityId||"",defaultTemplateId:req.settings.defaultTemplateId||"builtin-birthday",defaultTime:req.settings.defaultTime||"09:00",autoNativeBirthday:!!req.settings.autoNativeBirthday,birthdayCopyGroupId:safeText(req.settings.birthdayCopyGroupId||""),birthdayCopyMode:req.settings.birthdayCopyMode==="cc"?"cc":"bcc",logoAssetId:req.settings.logoAssetId||""};await write(SETTINGS,next);return next;}
  case "sendDueNow":await runDue();return true;
  default:throw Error("Solicitud desconocida.");
 }
});
API.runtime.onStartup.addListener(()=>init().catch(console.error));
API.runtime.onInstalled.addListener(()=>init().catch(console.error));
init().catch(console.error);
