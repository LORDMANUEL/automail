/* Regresión: imagen corporativa expandida > 140 KB, plantilla < 140 KB. Sin SMTP real. */
const fs = require('fs'), vm = require('vm'), assert = require('node:assert/strict'), path=require('path');
const root=path.resolve(__dirname,'..');
const store={cc_settings:{company:'Yude Canahuati',defaultIdentityId:'tb-id',defaultTemplateId:'builtin-yude-poster',defaultTime:'09:00'},cc_people:[]};
const sent=[],attachments=[],listeners={};
const on=(key)=>({addListener(fn){listeners[key]=fn}});
const api={storage:{local:{async get(keys){if(typeof keys==='string')return {[keys]:store[keys]};return Object.fromEntries(keys.map(k=>[k,store[k]]))},async set(o){Object.assign(store,o)}}},accounts:{async list(){return [{id:'acct',identities:[{id:'tb-id',email:'rrhh@example.invalid',name:'RRHH'}]}]}},compose:{async beginNew(body){sent.push(body);return {id:45}},async addAttachment(tab,attachment){attachments.push(attachment);return {}},async sendMessage(){return {mode:'sendNow',headerMessageId:'<test@example.invalid>'}}},action:{onClicked:on('action')},tabs:{async create(){}},notifications:{async create(){}},alarms:{onAlarm:on('alarm'),async create(){}},runtime:{getURL:x=>x,onInstalled:on('installed'),onStartup:on('startup'),onMessage:on('message'),async sendMessage(){}}};
const ctx=vm.createContext({console,Date,Promise,File,Uint8Array,atob,crypto:require('crypto').webcrypto,DOMParser:class{parseFromString(raw){return {body:{innerHTML:raw,querySelectorAll:()=>[]},querySelectorAll:()=>[]}}},setTimeout});
ctx.globalThis=ctx;ctx.messenger=api;
ctx.PhotoDB={get:async()=>`data:image/jpeg;base64,${'A'.repeat(160000)}`};
ctx.CCPoster={render:async()=>`data:image/jpeg;base64,${'A'.repeat(320000)}`};
for(const file of ['email-css.js','defaults.js','background.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx);
(async()=>{
 await new Promise(resolve=>setTimeout(resolve,130));
 const tpl=store.cc_templates.find(t=>t.id==='builtin-yude-poster');
 assert(tpl.html.length<140000);
 const j=await listeners.message({type:'create',job:{identityId:'tb-id',to:'persona@example.invalid',subject:tpl.subject,html:tpl.html,personName:'Empleado',position:'Asesor',branch:'SPS',photoId:'p1',at:Date.now()-2000}});
 await listeners.message({type:'sendDueNow'});
 assert.equal(store.scheduledMessages.find(x=>x.id===j.id).status,'sent','Expanded body should not be rejected');
 const body=sent.find(x=>x.body?.includes('data:image/jpeg;base64,')); assert(body,'Need HTML with embedded card');
 assert(body.body.length>140000,'Render should exceed former source HTML limit');
 assert(body.body.includes('data:image/jpeg;base64,')&&body.body.includes('Empleado'));
 assert(attachments.some(x=>x.file?.name?.startsWith('tarjeta-cumpleanos-')),'Keep JPG fallback');
 let rejected=false;
 try{await listeners.message({type:'create',job:{identityId:'tb-id',to:'persona@example.invalid',subject:'x',html:'<div>'+('x'.repeat(140001))+'</div>',at:Date.now()+3600000}})}catch(e){rejected=/140 KB/.test(e.message)}
 assert(rejected,'Original editable HTML limit must remain');
 console.log('V057 LARGE CARD PASS — generated JPG > 140 KB sent, JPG attachment, original HTML limit kept');
})().catch(e=>{console.error(e);process.exitCode=1});
