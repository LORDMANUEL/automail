/* Correo Calendario - v0.5.5. Biblioteca persistente de fotos.
 * OPFS crea la carpeta PRIVADA CorreoCalendario/Imagenes/<categoria> dentro del perfil.
 * IndexedDB mantiene el índice y compatibilidad completa con fotos de v0.5.4.
 * Un XPI no tiene permisos para crear C:\\... ni carpetas visibles en Explorer.
 */
const CC_PHOTO_DB = "cc-photo-assets";
let ccDbPromise;
const ccImageCache=new Map();
function ccCacheGet(id){if(!ccImageCache.has(id))return null;const value=ccImageCache.get(id);ccImageCache.delete(id);ccImageCache.set(id,value);return value;}
function ccCachePut(id,value){ccImageCache.delete(id);ccImageCache.set(id,value);if(ccImageCache.size>48)ccImageCache.delete(ccImageCache.keys().next().value);}

const CC_CATEGORIES = Object.freeze({person:"Empleados",temporary:"Temporales",company:"Corporativo"});
function ccCategory(id, cat) {
  if (cat && CC_CATEGORIES[cat]) return cat;
  return String(id).startsWith("compose-photo:") ? "temporary" :
    /^(company-logo|footer-background)$/.test(String(id)) ? "company" : "person";
}
function openPhotoDB() {
  if (!ccDbPromise) ccDbPromise = new Promise((resolve,reject)=>{
    const r=indexedDB.open(CC_PHOTO_DB,2);
    r.onupgradeneeded=()=>{
      const db=r.result;
      if (!db.objectStoreNames.contains("assets")) db.createObjectStore("assets",{keyPath:"id"});
    };
    r.onsuccess=()=>{const db=r.result;db.onversionchange=()=>{db.close();ccDbPromise=null;};resolve(db);};
    r.onerror=()=>reject(r.error);
  }).catch(err=>{ccDbPromise=null;throw err;});
  return ccDbPromise;
}
async function ccTransaction(mode,action){
  const db=await openPhotoDB();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction("assets",mode), store=tx.objectStore("assets");
    let value, failed=false;
    let req;
    try{req=action(store);}catch(e){tx.abort();reject(e);return;}
    if(req){req.onsuccess=()=>{value=req.result;};req.onerror=()=>{failed=true;};}
    tx.oncomplete=()=>resolve(value);
    tx.onerror=()=>reject(tx.error || req?.error || Error("Error guardando la fotografía"));
    tx.onabort=()=>reject(tx.error || Error("Almacenamiento interrumpido"));
  });
}
function ccImageDataUrl(data) {
  if(typeof data!=="string"||!/^data:image\/(jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(data))throw Error("La imagen no es JPG, PNG o WebP válido.");
  if(data.length>2_500_000)throw Error("La imagen optimizada supera el límite permitido.");
  return data;
}
function ccFilename(id){
  // Stable filename, safe even for legacy IDs containing ':' or '/' — no user path traversal.
  let hash=2166136261;
  for(const char of String(id)){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}
  return (hash>>>0).toString(16).padStart(8,"0")+"-"+Array.from(String(id)).slice(0,72).map(c=>/[a-z0-9_-]/i.test(c)?c:"_").join("")+".jpg";
}
async function ccDirectory(category, create=true){
  if(!globalThis.navigator?.storage?.getDirectory)throw Error("OPFS no disponible");
  let root=await navigator.storage.getDirectory();
  for(const folder of ["CorreoCalendario","Imagenes",CC_CATEGORIES[category]||CC_CATEGORIES.person]){
    root=await root.getDirectoryHandle(folder,{create});
  }
  return root;
}
function ccToBlob(data){const pos=data.indexOf(","),mime=data.slice(5,data.indexOf(";"));const decoded=atob(data.slice(pos+1));const bytes=new Uint8Array(decoded.length);for(let i=0;i<decoded.length;i++)bytes[i]=decoded.charCodeAt(i);return new Blob([bytes],{type:mime});}
function ccReadDataURL(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error||Error("No se pudo leer la imagen"));reader.readAsDataURL(file);});}
async function ccInitFolders(){
  if(!globalThis.navigator?.storage?.getDirectory)return {type:"indexeddb",path:"Perfil Thunderbird / IndexedDB"};
  try{
    for(const cat of Object.keys(CC_CATEGORIES))await ccDirectory(cat,true);
    return {type:"opfs",path:"CorreoCalendario/Imagenes/Empleados"};
  }catch(e){console.warn("OPFS no disponible; las fotos quedarán en IndexedDB",e);return {type:"indexeddb",path:"Perfil Thunderbird / IndexedDB"};}
}
const PhotoDB={
  ensureFolders:ccInitFolders,
  async put(id,dataUrl,meta={}){
    if(!id||String(id).length>220)throw Error("Identificador de imagen incorrecto.");
    ccImageDataUrl(dataUrl);
    const category=ccCategory(id,meta.category),name=String(meta.name||"").slice(0,160),
          code=String(meta.code||"").slice(0,100),updatedAt=Date.now();
    const previous=await ccTransaction("readonly",s=>s.get(id));
    // Keep photo reference IDs stable, to preserve existing employees and scheduled jobs.
    const record={id,category,name:name||previous?.name||"",code:code||previous?.code||"",
      updatedAt,originalName:String(meta.originalName||previous?.originalName||"").slice(0,160)};
    let fileSaved=false;
    try{
      const dir=await ccDirectory(category),fileName=ccFilename(id);
      const file=await dir.getFileHandle(fileName,{create:true});
      const out=await file.createWritable();
      await out.write(ccToBlob(dataUrl));await out.close();
      record.opfs={category,fileName};fileSaved=true;
    }catch(error){record.dataUrl=dataUrl;record.storage="indexeddb";console.warn("Foto guardada en IndexedDB, no OPFS",error);}
    try{await ccTransaction("readwrite",s=>s.put(record));}
    catch(error){if(fileSaved){try{const dir=await ccDirectory(category,false);await dir.removeEntry(record.opfs.fileName);}catch(_){}}throw error;}
    if(previous?.opfs&&(previous.opfs.category!==record.opfs?.category||previous.opfs.fileName!==record.opfs?.fileName)){
      try{const dir=await ccDirectory(previous.opfs.category,false);await dir.removeEntry(previous.opfs.fileName);}catch(_){}}
    ccCachePut(id,dataUrl);return {id,category,storage:record.opfs?"opfs":"indexeddb"};
  },
  async get(id){if(!id)return null;const cached=ccCacheGet(id);if(cached)return cached;const record=await ccTransaction("readonly",s=>s.get(id));
    if(!record)return null;
    if(record.dataUrl){ccCachePut(id,record.dataUrl);return record.dataUrl;} // Legacy v0.5.4 backward compatibility.
    if(record.opfs){try{
      const dir=await ccDirectory(record.opfs.category,false),file=await dir.getFileHandle(record.opfs.fileName);
      const data=await ccReadDataURL(await file.getFile());ccCachePut(id,data);return data;
    }catch(e){console.warn("Foto no disponible en OPFS",id,e);return null;}}
    return null;
  },
  async list(){const items=await ccTransaction("readonly",s=>s.getAll());
    return items.map(({id,category,name,code,originalName,updatedAt,opfs,dataUrl})=>({id,category:category||ccCategory(id),
      name:name||"",code:code||"",originalName:originalName||"",updatedAt:updatedAt||0,
      storage:opfs?"opfs":"indexeddb",approxBytes:dataUrl?Math.round(dataUrl.length*.75):0})).sort((a,b)=>b.updatedAt-a.updatedAt);
  },
  async del(id){const record=await ccTransaction("readonly",s=>s.get(id));if(!record)return false;
    await ccTransaction("readwrite",s=>s.delete(id));ccImageCache.delete(id);
    if(record.opfs){try{const dir=await ccDirectory(record.opfs.category,false);await dir.removeEntry(record.opfs.fileName);}catch(e){console.warn("No se pudo borrar archivo OPFS",e);}}
    return true;
  }
};
globalThis.PhotoDB=PhotoDB;
