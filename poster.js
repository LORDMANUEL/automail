/* Imagen corporativa facilitada por el usuario. Se compone localmente, sin servicios externos. */
const CCPoster = (() => {
  const API = globalThis.messenger || globalThis.browser;
  let basePromise;
  function load(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(Error('No se pudo cargar la imagen de la tarjeta.'));
      img.src = src;
    });
  }
  function rounded(ctx,x,y,w,h,r){
    ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();
  }
  function centered(ctx,text,y,maxWidth,maxSize,minSize=28,color='#0b2c81',bold=false) {
    text = String(text || '').trim() || '—';
    let size=maxSize;
    do {ctx.font=`${bold?'bold ':''}${size}px Arial, Helvetica, sans-serif`;if(ctx.measureText(text).width<=maxWidth)break;size-=2;}while(size>minSize);
    ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,540,y,maxWidth);
  }
  async function render({photo,name,position,branch,date}={}){
    if(!basePromise) basePromise=load(API.runtime.getURL('assets/yude-base.jpg'));
    const base=await basePromise;
    const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1920;
    const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)throw Error('El equipo no permite renderizar la imagen.');
    ctx.drawImage(base,0,0,1080,1920);
    const x=256,y=354,w=570,h=666;
    ctx.save();ctx.shadowColor='rgba(20,53,92,.25)';ctx.shadowBlur=19;ctx.shadowOffsetY=10;
    ctx.fillStyle='#fff';rounded(ctx,x-13,y-13,w+26,h+26,29);ctx.fill();ctx.restore();
    ctx.save();rounded(ctx,x,y,w,h,21);ctx.clip();
    if(photo){
      try {const portrait=await load(photo);const scale=Math.max(w/portrait.width,h/portrait.height);const dw=portrait.width*scale,dh=portrait.height*scale;ctx.drawImage(portrait,x+(w-dw)/2,y+(h-dh)/2,dw,dh);}
      catch(e){throw Error('La fotografía del colaborador no se puede abrir.');}
    } else {
      const grad=ctx.createLinearGradient(x,y,x+w,y+h);grad.addColorStop(0,'#c8dff1');grad.addColorStop(1,'#edf7ff');ctx.fillStyle=grad;ctx.fillRect(x,y,w,h);
      centered(ctx,'SIN FOTOGRAFÍA',y+h/2,w-38,35,27,'#31548b');
    }
    ctx.restore();
    centered(ctx,name||'NOMBRE DEL COLABORADOR',1414,825,65,31,'#0876c9',true);
    centered(ctx,position||'PUESTO',1496,790,43,25,'#152939');
    centered(ctx,branch||'San Pedro Sula',1562,775,31,22,'#1176c7');
    // La fecha del cumpleaños aparece encima del mensaje, sin mostrar el año de nacimiento.
    if(date) centered(ctx,date,1630,740,29,21,'#245786');
    return canvas.toDataURL('image/jpeg',.83);
  }
  return {render};
})();
globalThis.CCPoster=CCPoster;
