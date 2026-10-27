/* V0.6.0 — Ficha única vinculada al ID nativo del contacto Thunderbird. */
{
  const dialog = $("contactPhotoDialog");
  let contacts = [];
  let chosenPhotoId = "";
  let imageChanged = false;
  const selected = () => contacts.find(c => c.id === $("contactPhotoChoice").value);
  const fields = {
    name: "contactProfileName", email: "contactProfileEmail",
    position: "contactProfilePosition", branch: "contactProfileBranch",
    company: "contactProfileCompany", birthday: "contactProfileBirthday",
    code: "contactPhotoCode"
  };
  const status = message => $("contactProfileStatus").textContent = message;

  async function refreshChoice(preferredId = "") {
    const filter=norm($("contactPhotoSearch").value);
    const matching=contacts.filter(c=>norm([
      c.name,c.email,c.code,c.book,c.position,c.branch,state.contactPhotos?.[c.id]?.code
    ].join(" ")).includes(filter));
    const box=$("contactPhotoChoice"),previous=preferredId || box.value;
    box.replaceChildren();
    for(const c of matching.slice(0,500))box.append(new Option(`${c.name} · ${c.email} · ${c.book}`,c.id));
    if(matching.some(c=>c.id===previous))box.value=previous;
    $("contactPhotoFound").textContent=`${matching.length} contacto(s) encontrados · elige una ficha para editar.`;
    await selectContact();
  }

  async function selectContact(){
    const c=selected();
    $("saveContactPhoto").disabled=!c || !c.writable;
    $("contactPhotoHeading").textContent=c?c.name:"Selecciona un contacto";
    for(const [key,id] of Object.entries(fields))$(id).value=c?(key==="code" ? (c.code||state.contactPhotos?.[c.id]?.code||"") : c[key]||""):"";
    $("contactPhotoFile").value="";
    $("contactPhotoGalleryChoice").value="";
    chosenPhotoId=c?(state.contactPhotos?.[c.id]?.photoId||""):"";
    imageChanged=false;
    const preview=$("contactPhotoPreview");preview.hidden=true;preview.removeAttribute("src");
    if(c){
      try{
        const stored=chosenPhotoId?await PhotoDB.get(chosenPhotoId):null;
        const image=stored||await call("contactPhoto",{id:c.id});
        if(image&&selected()?.id===c.id){preview.src=image;preview.hidden=false;}
      }catch(e){console.warn("No se pudo mostrar la fotografía",e);}
    }
    status(!c?"Selecciona una persona de la izquierda.":!c.writable?
      "Esta libreta es de solo lectura. Edita la ficha en el origen de la libreta.":
      "Los cambios se guardarán en la libreta de Thunderbird. La foto puede permanecer sin cambios.");
  }

  async function loadGallery(){
    const box=$("contactPhotoGalleryChoice");box.replaceChildren(new Option("Seleccionar una imagen ya importada", ""));
    try{
      const list=await PhotoDB.list();
      for(const pic of list.filter(x=>x.category==="person").slice(0,800))box.append(new Option(
        [pic.originalName||pic.name||"Foto",pic.code].filter(Boolean).join(" · "),pic.id));
    }catch(e){console.warn("La galería no está disponible",e);}
  }

  async function open(preferredId=""){
    if(!dialog.open)dialog.showModal();
    $("contactPhotoFound").textContent="Cargando contactos de Thunderbird…";
    try{
      const directory=await call("contactDirectory");contacts=directory.contacts||[];state.contacts=contacts;
      await loadGallery();
      await refreshChoice(preferredId);
      if(preferredId)$("contactPhotoChoice").scrollIntoView({block:"nearest"});
    }catch(e){toast("No se pudo leer la libreta","error",e.message);}
  }
  globalThis.CC_openContactPhoto=open;

  $("openContactPhotoManager").onclick=()=>open();
  $("topPhotoPick").onclick=()=>$("contactPhotoFile").click();
  $("closeContactPhotoDialog").onclick=()=>dialog.close();
  $("contactPhotoSearch").oninput=()=>refreshChoice().catch(console.error);
  $("contactPhotoChoice").onchange=()=>selectContact().catch(console.error);

  $("contactPhotoGalleryChoice").onchange=async()=>{
    const id=$("contactPhotoGalleryChoice").value;
    if(!id)return;
    const data=await PhotoDB.get(id);
    if(!data){status("La imagen no se pudo recuperar; selecciona otra.");return;}
    chosenPhotoId=id;imageChanged=true;
    $("contactPhotoPreview").src=data;$("contactPhotoPreview").hidden=false;
    $("contactPhotoFile").value="";
    status("Fotografía lista para guardar en el contacto seleccionado.");
  };

  $("contactPhotoFile").onchange=async e=>{
    const file=e.target.files?.[0];if(!file)return;
    try{
      const data=await resizedPhoto(file);
      const id="native-contact-photo:"+crypto.randomUUID();
      await PhotoDB.put(id,data,{category:"person",originalName:file.name,name:selected()?.name||file.name});
      chosenPhotoId=id;imageChanged=true;
      $("contactPhotoPreview").src=data;$("contactPhotoPreview").hidden=false;
      $("contactPhotoGalleryChoice").value="";
      status(`Foto seleccionada: ${file.name}. Pulsa Guardar cambios para asociarla.`);
    }catch(err){toast("Imagen no admitida","error",err.message);}
  };

  $("saveContactPhoto").onclick=async()=>{
    const c=selected();if(!c)return;
    const profile=Object.fromEntries(Object.entries(fields).map(([key,id])=>[key,$(id).value.trim()]));
    const button=$("saveContactPhoto");button.disabled=true;status("Guardando cambios…");
    const previousName=c.name,previousEmail=c.email;
    try{
      const result=await call("updateContactProfile",{
        id:c.id,bookId:c.bookId,profile,
        photoId:imageChanged?chosenPhotoId:"",
        syncVCardPhoto:$("syncContactPhoto").checked
      });
      if(imageChanged&&chosenPhotoId){state.contactPhotos=state.contactPhotos||{};state.contactPhotos[c.id]={photoId:chosenPhotoId,code:profile.code};}
      const previousId=$("birthdayMainContact").value;
      if(previousId===c.id){
        if($("composeManualName").value.trim()===previousName)$("composeManualName").value=profile.name;
        if($("composeTo").value.trim().toLowerCase()===previousEmail.toLowerCase())$("composeTo").value=profile.email;
      }
      await refreshDirectory();await refresh();
      if(previousId&&[...$("birthdayMainContact").options].some(x=>x.value===previousId))$("birthdayMainContact").value=previousId;
      await renderSelectedContactCard();await previewCompose();
      await galleryReload();
      dialog.close();
      toast(result.photoWarning?"Ficha actualizada con advertencia":"Contacto actualizado","ok",result.photoWarning||profile.name);
    }catch(e){status(e.message);toast("No se pudieron guardar los datos","error",e.message);}
    finally{button.disabled=false;}
  };

  // Los contactos nuevos se crean en la agenda nativa, no en una base de datos paralela.
  $("newContactCreate").onclick=()=>toast("Utiliza la Libreta de direcciones de Thunderbird para crear el contacto.","ok");

  const safeGet = key=>{try{return localStorage.getItem(key);}catch{return null;}};
  const safeSet = (key,value)=>{try{localStorage.setItem(key,value);}catch{}}
  const zoomSteps=[75,80,85,90,95,100,105,110];
  let zoom=Number(safeGet("cc_ui_zoom")||90);
  function setZoom(v){
    zoom=zoomSteps.reduce((a,b)=>Math.abs(v-a)<=Math.abs(v-b)?a:b);
    document.documentElement.style.zoom=String(zoom/100);
    $("zoomLevel").textContent=zoom+"%";safeSet("cc_ui_zoom",String(zoom));
  }
  $("zoomMinus").onclick=()=>setZoom(zoom-5);
  $("zoomPlus").onclick=()=>setZoom(zoom+5);
  $("collapseSidebar").onclick=()=>{
    document.body.classList.toggle("menu-collapsed");
    safeSet("cc_sidebar_collapsed",String(document.body.classList.contains("menu-collapsed")));
  };
  if(safeGet("cc_sidebar_collapsed")==="true")document.body.classList.add("menu-collapsed");
  setZoom(zoom);
}
