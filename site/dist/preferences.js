/* Runs before paint. No tracking; only display preferences are stored locally. */
(() => {
  const key = 'liam-a11y-v1';
  const defaults = {text:'100',lines:'normal',contrast:false,links:false,font:false,headings:false,cursor:false,motion:false};
  let prefs = {...defaults};
  try {const saved=JSON.parse(localStorage.getItem(key));if(saved && typeof saved==='object') prefs={...defaults,...saved};} catch {}
  const apply = () => {
    if(!['100','115','130','150','200'].includes(String(prefs.text))) prefs.text='100';
    document.documentElement.style.setProperty('--text-scale', Number(prefs.text)/100);
    document.documentElement.style.fontSize = `${Number(prefs.text)}%`;
    for(const name of ['contrast','links','font','headings','cursor','motion']) document.documentElement.classList.toggle(`a11y-${name}`, prefs[name] === true);
    document.documentElement.classList.toggle('a11y-lines', prefs.lines === 'wide');
  };
  const persist = () => {apply();try {localStorage.setItem(key,JSON.stringify(prefs));}catch{}};
  window.liamPreferences = {get:()=>({...prefs}),set:(name,value)=>{if(name in defaults){prefs[name]=value;persist();}},reset:()=>{prefs={...defaults};persist();}};
  apply();
})();
