/* Contactos Thunderbird 153+: edición no destructiva de los campos de vCard.
 * No elimina teléfonos, direcciones, notas, listas, UID ni datos desconocidos.
 */
(() => {
  "use strict";
  const str = v => String(v ?? "");
  const clean = (v, max=180) => str(v).trim().slice(0,max);
  const value = v => str(v).replace(/\\/g,"\\\\").replace(/\r?\n/g,"\\n").replace(/([;,])/g,"\\$1");
  const decode = v => str(v).replace(/\\n/gi," ").replace(/\\([,;\\])/g,"$1");
  const nameOf = line => /^((?:item\d+\.)?)([A-Z0-9-]+)(?:;[^:]*)?:/i.exec(line)?.[2]?.toUpperCase() || "";
  const unfolded = vcard => str(vcard).replace(/\r?\n[ \t]/g, "").replace(/\r\n/g,"\n");
  const linesOf = vcard => unfolded(vcard).split("\n").filter(Boolean);
  const first = (vcard,key) => {
    const line=linesOf(vcard).find(l=>nameOf(l)===key);
    return line ? decode(line.substring(line.indexOf(":")+1).split(";")[0]) : "";
  };
  const field = (lines,key,raw,opts={}) => {
    const indices=lines.map((l,i)=>nameOf(l)===key?i:-1).filter(i=>i>=0);
    const v=clean(raw,opts.max||180), encoded=opts.date ? v : value(v);
    if(indices.length){
      if(!v){lines.splice(indices[0],1);return;}
      const old=lines[indices[0]], colon=old.indexOf(":");
      lines[indices[0]]=old.slice(0,colon+1)+encoded;return;
    }
    if(v){const end=lines.findIndex(l=>/^END:VCARD$/i.test(l));lines.splice(end>=0?end:lines.length,0,`${key}:${encoded}`);}
  };
  const validDate= v => !v || (/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v+"T12:00:00").getMonth()===Number(v.slice(5,7))-1&&new Date(v+"T12:00:00").getDate()===Number(v.slice(8,10)));
  function patch(vcard, data){
    const lines=linesOf(vcard);
    if(!lines.some(l=>/^BEGIN:VCARD$/i.test(l)) || !lines.some(l=>/^END:VCARD$/i.test(l))) throw Error("No es posible editar este contacto: falta su vCard original.");
    const name=clean(data.name),email=clean(data.email).toLowerCase(),position=clean(data.position,140),branch=clean(data.branch,140),company=clean(data.company,140),code=clean(data.code,70),birthday=clean(data.birthday,10);
    if(!name)throw Error("Escribe el nombre del contacto.");
    if(!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email))throw Error("Introduce un correo electrónico válido.");
    if(!validDate(birthday))throw Error("La fecha de cumpleaños no es válida.");
    if([name,email,position,branch,company,code].some(x=>/[\r\n\u0000-\u001f]/.test(x)))throw Error("Los datos del contacto no pueden contener saltos de línea ni caracteres de control.");
    field(lines,"FN",name);
    field(lines,"EMAIL",email);
    field(lines,"TITLE",position);
    field(lines,"ORG",company);
    field(lines,"X-CC-BRANCH",branch);
    field(lines,"X-EMPLOYEE-CODE",code);
    field(lines,"BDAY",birthday,{date:true});
    return lines.join("\r\n")+"\r\n";
  }
  const read = vcard => ({
    name:first(vcard,"FN"),email:first(vcard,"EMAIL"),
    position:first(vcard,"TITLE"),company:first(vcard,"ORG"),
    branch:first(vcard,"X-CC-BRANCH")||first(vcard,"X-BRANCH"),
    code:first(vcard,"X-EMPLOYEE-CODE"),birthday:first(vcard,"BDAY")
  });
  globalThis.CCProfile={patch,read,validDate};
})();
