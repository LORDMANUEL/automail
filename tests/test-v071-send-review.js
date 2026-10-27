const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const now=Date.now(),auditEmails=['one@example.com','two@example.com','three@example.com'];
const initialJob={id:'review-bcc',schemaVersion:7,identityId:'sender',to:'sender@example.com',mode:'broadcast',bcc:auditEmails,cc:[],status:'pending',subject:'Aviso',html:'<p>Hola</p>',at:now-30000,attempts:0};
const store={scheduledMessages:[initialJob],cc_settings:{company:'Prueba',autoNativeBirthday:false},cc_annual_ledger:{},cc_contact_photos:{}};const listeners={};let calls=0;
const listener=k=>({addListener:fn=>listeners[k]=fn});
const api={
 accounts:{async list(){return[{id:'a',identities:[{id:'sender',email:'sender@example.com',name:'Remitente'}]}]}},
 addressBooks:{async list(){return[]},contacts:{async list(){return[]}},mailingLists:{async list(){return[]}}},
 action:{onClicked:listener('action')},tabs:{async create(){}},alarms:{async create(){},onAlarm:listener('alarm')},notifications:{async create(){}},
 runtime:{onMessage:listener('message'),onInstalled:listener('installed'),onStartup:listener('startup'),getURL:x=>x,async sendMessage(){}},
 storage:{local:{async get(k){return typeof k==='string'?{[k]:store[k]}:Object.fromEntries(k.map(x=>[x,store[x]]))},async set(a){Object.assign(store,a)}}},
 compose:{async beginNew(d){api.lastDetails=d;return{id:42}},async sendMessage(){calls++;return{mode:'sendLater',error:'Servidor no confirmó la entrega inmediata'}},async addAttachment(){}}
};
const ctx={console,File,Uint8Array,atob,crypto:require('node:crypto').webcrypto,Date,Promise,setTimeout};ctx.globalThis=ctx;ctx.messenger=api;ctx.CC_DEFAULT_TEMPLATES=[];ctx.PhotoDB={get:async()=>null};ctx.CCEmailCSS={compile:h=>h,analyze:()=>({})};ctx.CCPoster={render:async()=>null};vm.createContext(ctx);
for(const f of ['contact-profile.js','background.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx);
(async()=>{
 await new Promise(r=>setTimeout(r,45));
 assert.equal(calls,1,'Envío intentado solo una vez');
 assert.equal(api.lastDetails.bcc.length,3);
 const job=store.scheduledMessages[0];
 assert.equal(job.status,'review');assert.equal(job.recipientAudit.bcc.length,3);
 assert.equal(job.recipientAudit.deliveryConfirmed,false);
 assert.equal(job.recipientAudit.uncertain,true);
 await listeners.message({type:'sendDueNow'});
 assert.equal(calls,1,'No se reintenta un SMTP incierto de manera automática');
 console.log('V071 SEND REVIEW PASS: CCO retained in audit on uncertain send; never auto-retry');
})().catch(e=>{console.error(e);process.exitCode=1});
