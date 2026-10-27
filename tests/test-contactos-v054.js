const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const root=path.resolve(__dirname,'..');
const data={cc_templates:[{id:'builtin-notice',name:'Comunicado RRHH',category:'notice',builtin:true,subject:'Aviso',html:'<p>Estimado/a <b>{{nombre}}</b>:</p><p>Comunicado</p>'}]};
const handlers={};const callback=key=>({addListener:fn=>{handlers[key]=fn;}});
const messenger={
 storage:{local:{get:async keys=>Object.fromEntries((Array.isArray(keys)?keys:[keys]).map(k=>[k,data[k]])),set:async ob=>Object.assign(data,ob)}},
 addressBooks:{list:async()=>[{id:'book1',name:'Personales'},{id:'book2',name:'Directorio HR'}],contacts:{list:async id=>id==='book1'?[{id:'c1',vCard:'BEGIN:VCARD\r\nVERSION:4.0\r\nFN:Ana Torres\r\nEMAIL;TYPE=work:ana@empresa.test\r\nBDAY:1992-10-26\r\nEND:VCARD'},{id:'c2',vCard:'BEGIN:VCARD\nFN:Pedro Peralta\nEMAIL:pedro@empresa.test\nEND:VCARD'}]:[{id:'c3',vCard:'BEGIN:VCARD\nFN:Karla Díaz\nEMAIL:karla@empresa.test\nEND:VCARD'}]},mailingLists:{list:async id=>id==='book1'?[{id:'list1',name:'Equipo Personal'}]:[],listMembers:async id=>[{id:'c1'},{id:'c2'}]}},
 accounts:{list:async()=>[{id:'acc1',identities:[{id:'ident1',name:'Info',email:'info@empresa.test'}]}]},
 runtime:{onMessage:callback('msg'),onInstalled:callback('installed'),onStartup:callback('startup'),sendMessage:async()=>{},getURL:x=>x},
 action:{onClicked:callback('clicked')},tabs:{create:async()=>{}},alarms:{create:async()=>{},onAlarm:callback('alarm')},notifications:{create:async()=>{}},compose:{beginNew:async()=>({id:1}),sendMessage:async()=>({mode:'sendNow'}),addAttachment:async()=>{}}
};
const scope={console,Date,Promise,File,Uint8Array,crypto:require('crypto').webcrypto,atob,DOMParser:class{parseFromString(s){return {body:{innerHTML:s,querySelectorAll(){return []}},querySelectorAll(){return []}}}},setTimeout,messenger};scope.globalThis=scope;scope.PhotoDB={get:async()=>null};scope.CCPoster={render:async()=>null};const ctx=vm.createContext(scope);
for(const file of ['email-css.js','defaults.js','background.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx);
(async()=>{await new Promise(r=>setTimeout(r,80));
 const output=await handlers.msg({type:'contactDirectory'});
 assert.equal(output.bookCount,2);assert.equal(output.contacts.length,3);
 assert.equal(output.contacts[0].name,'Ana Torres');assert.equal(output.contacts[0].birthday,'1992-10-26');
 assert.equal(output.contacts[0].email,'ana@empresa.test');
 assert(output.contacts[0].listIds.includes('list1'));
 assert.equal(output.groups.filter(g=>g.id.startsWith('list:')).length,1);
 assert(!data.cc_templates.find(t=>t.id==='builtin-notice').html.includes('{{nombre}}'),'Migrar comunicado obsoleto');
 const obj=await handlers.msg({type:'createBatch',jobs:[{mode:'broadcast',identityId:'ident1',to:'info@empresa.test',bcc:output.contacts.map(c=>c.email),subject:'Aviso',html:data.cc_templates.find(t=>t.id==='builtin-notice').html,at:Date.now()+600000}]});
 assert.equal(obj.length,1);assert.equal(obj[0].bcc.length,3);
 console.log('V054 BACKEND CONTACT DIRECTORY + MAILING LIST + MIGRATION + BCC PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
