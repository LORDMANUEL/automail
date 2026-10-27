const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const keepId='existing-job-id';
const initial={
 scheduledMessages:[
  {id:keepId,mode:'individual',to:'person@example.com',cc:[],bcc:[],identityId:'sender',subject:'Saludo previo',at:Date.now()+6e7,status:'pending',html:'<p>Hola</p>',schemaVersion:7,attempts:0},
  {id:'old-uncertain',mode:'individual',to:'again@example.com',cc:[],bcc:[],identityId:'sender',subject:'Correo incierto',at:Date.now()-30000,status:'sending',html:'<p>Hola</p>',schemaVersion:7,attempts:1},
  {id:'old-sent',mode:'individual',to:'done@example.com',cc:[],bcc:[],identityId:'sender',subject:'Ya enviado',at:Date.now()-60000,status:'sent',html:'<p>Hola</p>',schemaVersion:7,attempts:1}
 ],
 cc_templates:[{id:'custom-template',name:'Plantilla del usuario',subject:'Mensaje',html:'<p>Hola</p>'}],
 cc_settings:{company:'Compañía del usuario',autoNativeBirthday:false,defaultIdentityId:'sender'},
 cc_contact_photos:{'native-contact':{photoId:'local-photo-id'}},
 cc_annual_ledger:{'native:contact:2026':{jobId:'existing-job-id'}},
 cc_recipient_lists:[{id:'list-1',name:'Mi equipo',memberIds:['native-contact']}]
};
const store=structuredClone(initial), listeners={};let nSent=0;
const listener=k=>({addListener:f=>{listeners[k]=f}});
const API={accounts:{async list(){return[{id:'a',identities:[{id:'sender',email:'sender@example.com'}]}];}},
 addressBooks:{async list(){return[];},contacts:{async list(){return[];}},mailingLists:{async list(){return[];}}},
 runtime:{onMessage:listener('message'),onStartup:listener('startup'),onInstalled:listener('installed'),getURL:x=>x,async sendMessage(){}},
 action:{onClicked:listener('action')},alarms:{onAlarm:listener('alarm'),async create(){}},
 storage:{local:{async get(k){if(typeof k==='string')return {[k]:store[k]};return Object.fromEntries(k.map(x=>[x,store[x]]));},async set(v){Object.assign(store,v);}}},
 notifications:{async create(){}},tabs:{async create(){}},compose:{async beginNew(){return{id:1};},async sendMessage(){nSent++;return{mode:'sendNow',headerMessageId:'a'};},async addAttachment(){}}
};
const ctx={console,File,Uint8Array,atob,crypto:require('node:crypto').webcrypto,Date,Promise,setTimeout};ctx.globalThis=ctx;ctx.messenger=API;
ctx.CC_DEFAULT_TEMPLATES=[{id:'builtin-test',name:'Integrada',subject:'Asunto',html:'<p>{{nombre}}</p>'}];ctx.PhotoDB={get:async()=>null};ctx.CCEmailCSS={compile:h=>h,analyze:()=>({})};ctx.CCPoster={render:async()=>null};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root,'contact-profile.js'),'utf8'),ctx);
vm.runInContext(fs.readFileSync(path.join(root,'background.js'),'utf8'),ctx);
(async()=>{
 await new Promise(r=>setTimeout(r,40));
 await listeners.installed({reason:'update',previousVersion:'0.7.0'});
 await new Promise(r=>setTimeout(r,30));
 assert.equal(nSent,0,'La actualización no debe reintentar estados inciertos ni mensajes enviados');
 assert.deepEqual(store.cc_settings,initial.cc_settings);
 assert.deepEqual(store.cc_contact_photos,initial.cc_contact_photos);
 assert.deepEqual(store.cc_annual_ledger,initial.cc_annual_ledger);
 assert.deepEqual(store.cc_recipient_lists,initial.cc_recipient_lists);
 assert.equal(store.scheduledMessages.find(x=>x.id===keepId).status,'pending');
 assert.equal(store.scheduledMessages.find(x=>x.id==='old-uncertain').status,'review');
 assert.equal(store.scheduledMessages.find(x=>x.id==='old-sent').status,'sent');
 assert.ok(store.cc_templates.some(x=>x.id==='custom-template'));
 assert.equal(store.cc_templates.filter(x=>x.id==='custom-template').length,1);
 console.log('V071 UPGRADE PASS: jobs and IDs, templates, photos, preferences and ledger preserved; ambiguous sends not retried');
})().catch(e=>{console.error(e);process.exitCode=1});
