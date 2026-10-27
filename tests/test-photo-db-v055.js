/* Storage contract test: OPFS hierarchy + IndexedDB metadata + legacy record + deletion.
 * This uses in-memory API shims; Thunderbird integration remains to be tested by user.
 */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const nodes=new Map(),dirs=new Map(),entries=new Map();
function makeFolder(path='') {if(!dirs.has(path))dirs.set(path,{async getDirectoryHandle(name,opt={}){const key=path+'/'+name;if(!dirs.has(key)&&!opt.create)throw Error('folder missing');return makeFolder(key);},async getFileHandle(name,opt={}){const key=path+'/'+name;if(!nodes.has(key)&&!opt.create)throw Error('file missing');return {async createWritable(){return {async write(blob){nodes.set(key,blob);},async close(){}}},async getFile(){return nodes.get(key)}};},async removeEntry(name){nodes.delete(path+'/'+name);}});return dirs.get(path);}
const store=new Map();
function dbStore(tx){
 return {
  get(id){return enqueue(tx,()=>store.get(id));},
  getAll(){return enqueue(tx,()=>Array.from(store.values()));},
  put(value){return enqueue(tx,()=>{store.set(value.id,value);return value.id;});},
  delete(id){return enqueue(tx,()=>store.delete(id));}
 };
}
function enqueue(tx,func){
 const req={onsuccess:null,onerror:null,result:null,error:null};
 queueMicrotask(()=>{try{req.result=func();req.onsuccess?.();tx.oncomplete?.();}catch(e){req.error=e;req.onerror?.();tx.onerror?.();}});
 return req;
}
const indexedDB={
 open(name,version){
  const request={result:null,onsuccess:null,onerror:null,onupgradeneeded:null};
  queueMicrotask(()=>{
   const db={
    objectStoreNames:{contains:x=>x==='assets'},
    onversionchange:null,close(){},
    transaction(name,mode){
     const tx={oncomplete:null,onerror:null,onabort:null,error:null};
     tx.objectStore=()=>dbStore(tx);return tx;
    }
   };
   request.result=db;
   if(!entries.has(name)){entries.set(name,true);request.onupgradeneeded?.();}
   request.onsuccess?.();
  });
  return request;
 }
};
class Reader{readAsDataURL(blob){blob.arrayBuffer().then(buf=>{this.result='data:'+blob.type+';base64,'+Buffer.from(buf).toString('base64');this.onload?.();}).catch(e=>{this.error=e;this.onerror?.();});}}
const ctx={console,Date,Promise,Blob,Uint8Array,atob,btoa,indexedDB,FileReader:Reader,navigator:{storage:{getDirectory:async()=>makeFolder()}},globalThis:null};ctx.globalThis=ctx;
vm.runInNewContext(fs.readFileSync(require('path').resolve(__dirname,'../photo-db.js'),'utf8'),ctx);
(async()=>{const photos=ctx.PhotoDB;const folders=await photos.ensureFolders();assert.equal(folders.type,'opfs');const original='data:image/jpeg;base64,'+Buffer.from('test-photo').toString('base64');await photos.put('person-photo-abc',original,{category:'person',name:'Maynor',code:'00315',originalName:'00315.jpg'});assert.equal(await photos.get('person-photo-abc'),original);assert.equal(nodes.size,1);
 const listing=await photos.list();assert.equal(listing.length,1);assert.equal(listing[0].code,'00315');assert.equal(listing[0].storage,'opfs');assert.equal(listing[0].dataUrl,undefined);
 store.set('legacy-photo',{id:'legacy-photo',dataUrl:original});assert.equal(await photos.get('legacy-photo'),original);
 await photos.del('person-photo-abc');assert.equal(await photos.get('person-photo-abc'),null);assert.equal(nodes.size,0);
 assert(dirs.has('/CorreoCalendario/Imagenes/Empleados'));assert(dirs.has('/CorreoCalendario/Imagenes/Temporales'));assert(dirs.has('/CorreoCalendario/Imagenes/Corporativo'));
 console.log('PHOTO DB TEST PASS: create private folders, store/load, legacy compatibility, metadata and deletion');
})().catch(e=>{console.error(e);process.exitCode=1;});
