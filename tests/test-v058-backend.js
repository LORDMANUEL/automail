const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const now=new Date(),today=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
const native=[
 {id:'c1',vCard:`BEGIN:VCARD\nVERSION:4.0\nFN:Maynor Funez\nEMAIL:maynor@test.invalid\nBDAY:${today}\nEND:VCARD`},
 {id:'c2',vCard:`BEGIN:VCARD\nVERSION:4.0\nFN:Ana Lopez\nEMAIL:ana@test.invalid\nBDAY:${today}\nEND:VCARD`},
 {id:'c3',vCard:'BEGIN:VCARD\nVERSION:4.0\nFN:Luis Rivera\nEMAIL:luis@test.invalid\nEND:VCARD'},
 {id:'c4',vCard:'BEGIN:VCARD\nVERSION:4.0\nFN:Otra persona\nEMAIL:otra@test.invalid\nEND:VCARD'}
];
const data={scheduledMessages:[],cc_people:[],cc_templates:[{id:'builtin-yude-poster',category:'birthday',name:'Yude',subject:'Feliz cumpleaños {{nombre}}',html:'<p>¡Hola {{nombre}}!</p><p>{{mensaje}}</p><div>{{tarjeta_cumple}}</div>'}],cc_settings:{company:'Grupo Yude',defaultIdentityId:'id',defaultTemplateId:'builtin-yude-poster',defaultTime:'00:01',autoNativeBirthday:true,birthdayCopyGroupId:'list:everyone',birthdayCopyMode:'bcc'}};
const sent=[],attachments=[],listeners={};const listener=(id)=>({addListener:fn=>{listeners[id]=fn;}});
const api={addressBooks:{async list(){return [{id:'bk',name:'Empresa',readOnly:false}];},contacts:{async list(){return native;},async getPhoto(){return null;}},mailingLists:{async list(){return [{id:'everyone',name:'Todo el personal'}];},async listMembers(){return native;}}},storage:{local:{async get(key){if(typeof key==='string')return {[key]:data[key]};if(Array.isArray(key))return Object.fromEntries(key.map(k=>[k,data[k]]));return {};},async set(x){Object.assign(data,x);}}},accounts:{async list(){return [{id:'account',identities:[{id:'id',name:'Sistemas',email:'sistemas@test.invalid'}]}];}},compose:{async beginNew(d){sent.push(d);return {id:1};},async addAttachment(_,x){attachments.push(x);},async sendMessage(){return {mode:'sendNow',headerMessageId:'<fake>'};}},action:{onClicked:listener('click')},tabs:{async create(){}},alarms:{onAlarm:listener('alarm'),async create(){}},notifications:{async create(){}},runtime:{getURL:x=>x,onMessage:listener('message'),onStartup:listener('start'),onInstalled:listener('install'),async sendMessage(){}}};
const ctx=vm.createContext({console,Date,Promise,File,Uint8Array,atob,crypto:require('node:crypto').webcrypto,globalThis:null,setTimeout});ctx.globalThis=ctx;ctx.messenger=api;
ctx.PhotoDB={get:async()=>null};ctx.CCPoster={render:async()=> 'data:image/jpeg;base64,AA=='};
ctx.CC_DEFAULT_TEMPLATES=[{id:'builtin-yude-poster',category:'birthday',subject:'Feliz cumpleaños {{nombre}}',html:'<p>{{nombre}}</p>'}];ctx.CCEmailCSS={analyze(){return{};},compile(html){return html;}};
vm.runInContext(fs.readFileSync(path.join(root,'background.js'),'utf8'),ctx);
(async()=>{
 await new Promise(ok=>setTimeout(ok,200));
 const d=await listeners.message({type:'contactDirectory'});assert.equal(d.contacts.length,4);assert.equal(d.contacts.filter(c=>c.birthday).length,2);assert.equal(d.groups.length,3);
 const annual=data.scheduledMessages.filter(j=>j.recurringKey?.startsWith('native:'));
 assert.equal(annual.length,2,'Se crean cumpleaños desde la libreta nativa');
 assert.equal(annual[0].bcc.length,3,'Un cumpleaños copia a la empresa menos al homenajeado');
 assert.equal(annual[1].bcc.length,3);
 await listeners.alarm({name:'scheduled-email-tick'});await new Promise(r=>setTimeout(r,25));assert.equal(data.scheduledMessages.filter(j=>j.recurringKey?.startsWith('native:')).length,2,'No duplica cumpleaños por año');
 assert.equal(sent.filter(d=>d.to?.[0]==='maynor@test.invalid').length,1,'Un envío único al homenajeado');
 assert(sent.some(d=>d.to?.[0]==='maynor@test.invalid'&&d.bcc.length===3),'Copia oculta a empresa');
 const manual=await listeners.message({type:'createBatch',jobs:[{identityId:'id',mode:'individual',to:'maynor@test.invalid',cc:['ana@test.invalid','luis@test.invalid'],bcc:[],personName:'Maynor Funez',subject:'Cumple {{nombre}}',html:'<p>{{mensaje}}</p>',messageText:'Saludos {{nombre}}',at:Date.now()-1000}]});
 assert.equal(manual.length,1);
 await new Promise(r=>setTimeout(r,30));await listeners.message({type:'sendDueNow'});await new Promise(r=>setTimeout(r,30));
 const cc=sent.find(x=>x.subject==='Cumple Maynor Funez');if(!cc) console.log("manual-not-sent",data.scheduledMessages.filter(j=>j.subject.includes("Cumple")),"recent-sent",sent.map(x=>x.subject));assert(cc);
 assert.deepEqual(Array.from(cc.cc),['ana@test.invalid','luis@test.invalid']);assert.equal(cc.to.length,1);
 assert(cc.body.includes('Saludos Maynor Funez'));
 const broadcast=await listeners.message({type:'createBatch',jobs:[{identityId:'id',mode:'broadcast',to:'sistemas@test.invalid',bcc:['maynor@test.invalid','ana@test.invalid'],personName:'Toda la empresa',subject:'Saludos a {{nombre}}',html:'<p>{{mensaje}}</p>',messageText:'Felicidades equipo',at:Date.now()-1000}]});
 await new Promise(r=>setTimeout(r,30));await listeners.message({type:'sendDueNow'});await new Promise(r=>setTimeout(r,30));
 assert.equal(broadcast.length,1);assert.equal(sent.at(-1).bcc.length,2);
 assert.equal(sent.at(-1).subject,'Saludos a Toda la empresa');assert.equal(sent.at(-1).to.length,1);
 assert(!sent.at(-1).cc,'La lista no se revela por CC');
 let duplicate=false;try{await listeners.message({type:'createBatch',jobs:[{identityId:'id',mode:'individual',to:'maynor@test.invalid',cc:['maynor@test.invalid'],subject:'Mal',html:'<p>x</p>',at:Date.now()+3600000}]});}catch(_){duplicate=true;}assert(duplicate,'Rechaza copia duplicada al propio homenajeado');
 console.log('V058 BACKEND PASS — vCard BDAY, annual dedupe, two birthdays, CC/BCC one mail, common-name broadcast, message placeholders, duplicate rejection. (SMTP simulated)');
})().catch(e=>{console.error(e);process.exitCode=1;});
