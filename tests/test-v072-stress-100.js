/* Simulación de 100 programaciones y de cierre/reapertura de Thunderbird.
   NO se usa un servidor SMTP real ni se instala Thunderbird. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..');
const BASE=Date.now();
let simulatedTime=BASE;
let sent=[];
let starts=0;
let alarms=[];
const durableStore={};
const delay=ms=>new Promise(r=>setTimeout(r,ms));
class ClockDate extends Date {
  constructor(...args){super(...(args.length?args:[simulatedTime]));}
  static now(){return simulatedTime;}
}
function runtime(){
  const events={};let nextTab=0;
  const listener=name=>({addListener:f=>{events[name]=f;}});
  const api={
    storage:{local:{
      async get(keys){await delay(1);if(typeof keys==='string')return {[keys]:structuredClone(durableStore[keys])};return Object.fromEntries(keys.map(x=>[x,structuredClone(durableStore[x])]));},
      async set(v){await delay(1);for(const [k,value] of Object.entries(v))durableStore[k]=structuredClone(value);}
    }},
    accounts:{async list(){return[{id:'a1',identities:[{id:'sender',email:'sender@test.invalid'}]}];}},
    addressBooks:{async list(){return [];},contacts:{async list(){return[];}},mailingLists:{async list(){return[];}}},
    runtime:{onMessage:listener('message'),onStartup:listener('startup'),onInstalled:listener('installed'),getURL:x=>x,async sendMessage(){}},
    alarms:{onAlarm:listener('alarm'),async create(name,opt){alarms.push({name,opt});}},
    action:{onClicked:listener('action')},notifications:{async create(){}},tabs:{async create(){}},
    compose:{async beginNew(details){nextTab+=1;api.compose.byTab.set(nextTab,details);return{id:nextTab};},byTab:new Map(),
      async sendMessage(id,{mode}){assert.equal(mode,'sendNow');let details=api.compose.byTab.get(id);assert(details);sent.push({subject:details.subject,to:[...details.to],cc:[...(details.cc||[])],bcc:[...(details.bcc||[])]});return {mode:'sendNow',headerMessageId:`<simulated-${sent.length}>`};},async addAttachment(){}
    }
  };
  const context={console,File,Uint8Array,atob,crypto:crypto.webcrypto,Date:ClockDate,Promise,setTimeout};
  context.globalThis=context;context.messenger=api;
  context.CC_DEFAULT_TEMPLATES=[{id:'builtin-birthday',name:'Happy',subject:'Cumpleaños',html:'<p>¡Felicidades!</p>'}];
  context.CCEmailCSS={compile:h=>h,analyze:()=>({})};
  context.PhotoDB={get:async()=>null};context.CCPoster={render:async()=>null};
  vm.createContext(context);
  for(const f of ['contact-profile.js','background.js'])vm.runInContext(fs.readFileSync(path.join(ROOT,f),'utf8'),context);
  starts++;
  return {events,api};
}
function createJobs(start,count,at){return Array.from({length:count},(_,i)=>{
 const j=start+i;
 return {identityId:'sender',mode:'individual',to:`contact-${j}@test.invalid`,personName:`Contacto ${j}`,subject:`Prueba ${j}`,html:'<p>{{nombre}}</p>',at};
});}
async function ready(rt){await rt.events.installed({reason:'startup'});assert(durableStore.cc_settings,'Background debe inicializar preferencias');}
async function test(){
  let rt=runtime();await ready(rt);
  const future=simulatedTime+120000;
  const batches=[createJobs(0,25,future),createJobs(25,25,future),createJobs(50,25,future),createJobs(75,25,future)];
  const results=await Promise.all(batches.map(jobs=>rt.events.message({type:'createBatch',jobs})));
  assert.equal(results.flat().length,100);
  let rows=structuredClone(durableStore.scheduledMessages);
  assert.equal(rows.length,100,'Las cuatro escrituras concurrentes no deben pisarse');
  assert.equal(new Set(rows.map(j=>j.id)).size,100,'Cada programación tiene ID único');
  assert.equal(rows.filter(j=>j.status==='pending').length,100);
  const keysBefore=rows.map(j=>j.id);
  assert.equal(sent.length,0,'Nunca enviar futuros');
  const savedPrefs=structuredClone(durableStore.cc_settings);
  // Cierra y abre mientras los 100 trabajos siguen en el futuro.
  rt=runtime();await ready(rt);
  assert.equal(durableStore.scheduledMessages.length,100,'Persisten después de reiniciar proceso');
  assert.deepEqual(durableStore.scheduledMessages.map(j=>j.id),keysBefore);
  assert.deepEqual(durableStore.cc_settings,savedPrefs);
  assert.equal(sent.length,0);
  // Simular apagado abrupto en mitad de un intento, antes de conocer SMTP.
  durableStore.scheduledMessages[0].status='sending';
  durableStore.scheduledMessages[0].attempts=1;
  simulatedTime=future+1000;
  rt=runtime();await ready(rt);
  for(let i=0;i<200&&durableStore.scheduledMessages.filter(j=>j.status==='sent').length<5;i++)await delay(5);
  assert.equal(durableStore.scheduledMessages.filter(j=>j.status==='review').length,1,'El incierto se revisa, jamás reintenta');
  assert.equal(durableStore.scheduledMessages.filter(j=>j.status==='sent').length,5,'Máximo 5 envíos por tick');
  assert.equal(sent.length,5);
  // Comprueba 20 ticks sin duplicación para los restantes 94.
  for(let n=0;n<22;n++){
    rt.events.alarm({name:'scheduled-email-tick'});
    const target=Math.min(99,10+n*5);
    for(let poll=0;poll<400&&durableStore.scheduledMessages.filter(x=>x.status==='sent').length<target;poll++)await delay(5);
    for(let poll=0;poll<200&&durableStore.scheduledMessages.some(x=>x.status==='sending');poll++)await delay(2);
  }
  rows=structuredClone(durableStore.scheduledMessages);
  assert.equal(rows.length,100);
  assert.equal(rows.filter(x=>x.status==='pending').length,0);
  assert.equal(rows.filter(x=>x.status==='review').length,1);
  assert.equal(rows.filter(x=>x.status==='sent').length,99);
  assert.equal(sent.length,99,'Solo 99 intentos; el trabajo incierto nunca se repite');
  assert.equal(new Set(sent.map(x=>x.subject)).size,99,'No hay duplicados de mensajes');
  assert.equal(rows.find(x=>x.id===keysBefore[0]).attempts,1);
  assert(rows.filter(x=>x.status==='sent').every(x=>x.attempts===1));
  assert(rows.filter(x=>x.status==='sent').every(x=>x.recipientAudit.deliveryConfirmed===false));
  // Cierra y vuelve a abrir una segunda vez; los enviados no deben reintentarse.
  rt=runtime();await ready(rt);
  await rt.events.message({type:'sendDueNow'});
  assert.equal(sent.length,99,'Reabrir no duplica 99 mensajes ya aceptados');
  assert.equal(durableStore.scheduledMessages.length,100);
  // 100 trabajos en una sola operación, también deben aceptarse.
  simulatedTime+=60000;
  const direct=await rt.events.message({type:'createBatch',jobs:createJobs(200,100,simulatedTime+120000)});
  assert.equal(direct.length,100);
  assert.equal(durableStore.scheduledMessages.length,200);
  assert.equal(durableStore.scheduledMessages.filter(x=>x.status==='pending').length,100);
  // Dos eventos init paralelos nunca deben convertir un envío activo en revisión.
  await Promise.all([rt.events.startup(),rt.events.installed({reason:'update'})]);
  assert.equal(durableStore.scheduledMessages.filter(x=>x.status==='pending').length,100);
  console.log(JSON.stringify({result:'PASS',scheduledInitially:100,concurrentBatches:4,restarts:3,recoveredUncertain:1,smtpSimulatedAccepts:99,duplicateSends:0,retainedJobs:100,singleOperationLimit:100,finalJobs:200,tickCap:5,realSMTP:false},null,2));
}
test().catch(e=>{console.error(e);process.exitCode=1;});
