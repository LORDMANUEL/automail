const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'dashboard.html'),'utf8');
const js=fs.readFileSync(path.join(root,'dashboard.js'),'utf8');
const defaults=fs.readFileSync(path.join(root,'defaults.js'),'utf8');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
assert.equal(manifest.version,'0.6.0');
assert.equal(manifest.browser_specific_settings.gecko.id,'correo-calendario@local.addon');
assert.equal(manifest.browser_specific_settings.gecko.strict_min_version,'153.0');
assert(!/RRHH|Recursos Humanos/i.test(html),'La UI no debe contener etiquetas de RRHH');
assert(!/RRHH|Recursos Humanos/i.test(js),'El Javascript no debe mostrar etiquetas exclusivas de RRHH');
assert(html.includes('Contactos y cumpleaños'));
assert(js.includes('personas:"Contactos y cumpleaños"'));
assert(html.includes('Elegir contactos y fotografías'));
assert(html.includes('UN correo para todos'));
assert(html.includes('Mensajes separados'));
assert(html.includes('Un cumpleañero + copia'));
assert(!/Comunicado RRHH/.test(defaults));
assert(defaults.includes('Comunicado general'));
// Probar únicamente el mecanismo de migración, en un entorno aislado sin SMTP.
const events={};const data={scheduledMessages:[{id:'pendiente',subject:'No borrar',status:'pending'}],cc_people:[],cc_templates:[
 {id:'builtin-notice',name:'Comunicado RRHH',html:'<p>{{mensaje}}</p>',builtin:true},
 {id:'custom-1',name:'Mi plantilla',html:'<h1>Personalizada</h1>',builtin:false}
 ],cc_settings:{company:'Organización'}};
const local={get:async key=>Array.isArray(key)?Object.fromEntries(key.map(k=>[k,data[k]])):{[key]:data[key]},set:async x=>Object.assign(data,x)};
const listener=(key)=>({addListener(fn){events[key]=fn;}});
const api={storage:{local},accounts:{list:async()=>[]},action:{onClicked:listener('click')},tabs:{create:async()=>{}},alarms:{onAlarm:listener('alarm'),create:async()=>{}},notifications:{create:async()=>{}},runtime:{getURL:x=>x,onMessage:listener('message'),onStartup:listener('start'),onInstalled:listener('install'),sendMessage:async()=>{}},addressBooks:{list:async()=>[]}};
const ctx=vm.createContext({console,Date,Promise,Uint8Array,crypto:require('node:crypto').webcrypto,globalThis:null,setTimeout});ctx.globalThis=ctx;ctx.messenger=api;ctx.CC_DEFAULT_TEMPLATES=[{id:'builtin-notice',name:'Comunicado general',html:'<p>{{mensaje}}</p>',builtin:true}];
ctx.CCEmailCSS={analyze(){return{}},compile(h){return h}};
vm.runInContext(fs.readFileSync(path.join(root,'background.js'),'utf8'),ctx);
(async()=>{
 await new Promise(r=>setTimeout(r,130));
 assert.equal(data.cc_templates.find(x=>x.id==='builtin-notice').name,'Comunicado general','Solo se renombra plantilla integrada');
 assert.equal(data.cc_templates.find(x=>x.id==='custom-1').html,'<h1>Personalizada</h1>');
 assert.equal(data.scheduledMessages[0].subject,'No borrar','No alterar programaciones');
 assert.equal(data.cc_settings.company,'Organización');
 console.log('V059 GENERAL UI/MIGRATION PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
