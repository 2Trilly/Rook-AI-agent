(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const STORE = "rook.finished.v1";
  const defaults = {memories:[], notes:[], shortcuts:[], messages:[], provider:{url:"",model:"",key:""}, personality:"Calm, clever, observant, confident, trustworthy, conversational, a little witty. Casual, never corporate. Be honest about uncertainty.", prefs:{},};
  let state = load();
  let toastTimer;
  function load(){try{return {...structuredClone(defaults),...JSON.parse(localStorage.getItem(STORE)||"{}")};}catch{return structuredClone(defaults);}}
  function save(){localStorage.setItem(STORE,JSON.stringify(state));}
  function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
  function id(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7);}
  function toast(s){const el=$("toast");el.textContent=s;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),2600);}
  function date(s){try{return new Date(s).toLocaleString(undefined,{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"});}catch{return "";}}
  const views={chat:"Chat",research:"Live research",memory:"Memory",notes:"Notes",shortcuts:"iPhone actions",settings:"Settings"};
  function navigate(name){document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id==="view-"+name));document.querySelectorAll(".nav-item").forEach(v=>v.classList.toggle("active",v.dataset.view===name));$("topbarTitle").textContent=views[name]||"ROOK";$("sidebar").classList.remove("open");if(name==="memory")renderMemories();if(name==="notes")renderNotes();if(name==="shortcuts")renderShortcuts();if(name==="settings")syncSettings();}
  document.querySelectorAll(".nav-item").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.view)));
  $("menuToggle").addEventListener("click",()=>$("sidebar").classList.toggle("open"));
  $("newChat").addEventListener("click",()=>{state.messages=[];save();renderMessages();$("welcome").classList.remove("hidden");navigate("chat");$("messageInput").focus();});
  document.querySelectorAll("[data-prompt]").forEach(b=>b.addEventListener("click",()=>{ $("messageInput").value=b.dataset.prompt;sendMessage();}));
  $("messageInput").addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage();}});
  $("chatForm").addEventListener("submit",e=>{e.preventDefault();sendMessage();});
  async function sendMessage(){
    const box=$("messageInput"),text=box.value.trim();if(!text)return;box.value="";box.style.height="auto";
    state.messages.push({id:id(),role:"user",text,at:new Date().toISOString()});save();$("welcome").classList.add("hidden");renderMessages();
    const pending={id:id(),role:"assistant",text:"",at:new Date().toISOString(),pending:true};state.messages.push(pending);renderMessages();
    let answer;
    try{answer=state.provider.url&&state.provider.model?await callAI(text):localReply(text);}
    catch(e){answer="I couldn't reach the configured AI provider. Check the endpoint, model, internet connection, and provider rules. Your message is still in this browser. Details: "+(e.message||"request failed")+"\n\nYou can keep using local mode, or open Live research to search the web.";}
    state.messages=state.messages.filter(m=>m.id!==pending.id);state.messages.push({id:id(),role:"assistant",text:answer,at:new Date().toISOString()});save();renderMessages();
  }
  async function callAI(userText){
    const p=state.provider;const history=state.messages.filter(m=>!m.pending).slice(-18).map(m=>({role:m.role==="assistant"?"assistant":"user",content:m.text}));
    const memories=state.memories.map(m=>m.text).slice(0,30).join("\n- ");
    const system=`You are ROOK, a personal assistant. Personality: ${state.personality}\nBe useful, direct, warm, a little witty, and honest. Do not claim to have searched live sources unless the user actually opens them or provides results. Do not invent current prices, links, facts, or capabilities. If asked to take an iPhone action, explain the supported action or suggest the appropriate shortcut. Never imply you can control the phone unrestrictedly. User-saved context (may be incomplete):\n- ${memories||"No saved memories."}`;
    const headers={"Content-Type":"application/json"};if(p.key)headers.Authorization="Bearer "+p.key;
    const res=await fetch(p.url,{method:"POST",headers,body:JSON.stringify({model:p.model,messages:[{role:"system",content:system},...history]})});
    if(!res.ok)throw new Error("Provider returned HTTP "+res.status+".");
    const data=await res.json();const content=data?.choices?.[0]?.message?.content;
    if(typeof content!=="string"||!content.trim())throw new Error("No chat text was returned in the expected format.");
    return content.trim();
  }
  function localReply(t){
    const s=t.toLowerCase();
    if(/^(hi|hey|yo|hello|what's up)\b/.test(s))return "Yo. ROOK is here. I'm in local mode right now, so I can handle simple guidance and tools, but I'm not a full AI model until you connect a compatible provider in Settings. What's the move?";
    if(/music|song|playlist|artist/.test(s))return "I can help narrow down a vibe, but local mode can't generate reliable personalized picks by itself. Tell me the mood, then use Live research → YouTube or Google to check real tracks. Try searching: "+(s.includes("sad")?"melancholy rap songs":s.includes("hype")?"high energy rap playlist":"music for the mood and activity you want")+".";
    if(/fit|outfit|fashion|clothes|jeans|shoes|streetwear/.test(s))return "Let's make the fit work with what you already own first. Local mode can't reason as deeply as a real model, but a solid formula is: one focal piece, two supporting colors, and shoes that make sense for the occasion. Use Live research to compare current items and prices; verify the seller before buying.";
    if(/research|deal|price|buy|product|find/.test(s))return "Open Live research in the sidebar and search the exact item, including model/size and your budget. Compare at least two sellers, shipping, returns, and the final checkout price. I won't pretend I checked live listings from this local reply.";
    if(/plan|goal|schedule|steps|start/.test(s))return "Here's a simple way to start: 1) define the outcome in one sentence, 2) pick the smallest useful action, 3) set a realistic deadline, 4) check what could block you, and 5) review after you try it. For a tailored plan, connect an AI provider in Settings.";
    if(/remember|memory/.test(s))return "You control what I remember. Open Memory to add, edit, or delete saved details. In this build, memories stay in this browser unless you export them.";
    if(/shortcut|iphone|open app|reminder|note/.test(s))return "Open iPhone actions for supported app links, or add a trusted iCloud Shortcut link there. iOS permissions determine what can happen; review any shortcut before running it.";
    return "I can help with that, but this response is running in local mode rather than a real AI model. Try the built-in Live research, Memory, Notes, or iPhone actions tools—or connect a compatible provider in Settings. I won't fake a full AI answer or pretend I checked the web.";
  }
  function renderMessages(){
    const host=$("messages");host.innerHTML=state.messages.map(m=>`<div class="message ${m.role==="user"?"user":""}"><div class="avatar">${m.role==="user"?"YOU":"R"}</div><div class="bubble">${esc(m.pending?"Thinking…":m.text)}</div></div>`).join("");
    $("chatScroll").scrollTop=$("chatScroll").scrollHeight;
  }
  $("researchForm").addEventListener("submit",e=>{e.preventDefault();doSearch($("researchQuery").value,document.querySelector('input[name="searchEngine"]:checked')?.value||"google");});
  document.querySelectorAll("[data-research]").forEach(b=>b.addEventListener("click",()=>{$("researchQuery").value=b.dataset.research;doSearch(b.dataset.research,"google");}));
  function doSearch(q,engine){q=q.trim();if(!q)return;const urls={google:"https://www.google.com/search?q=",bing:"https://www.bing.com/search?q=",youtube:"https://www.youtube.com/results?search_query=",reddit:"https://www.google.com/search?q=site%3Areddit.com+"};window.open((urls[engine]||urls.google)+encodeURIComponent(q),"_blank","noopener,noreferrer");}
  $("memoryForm").addEventListener("submit",e=>{e.preventDefault();const text=$("memoryInput").value.trim();if(!text)return;state.memories.unshift({id:id(),text,at:new Date().toISOString()});save();$("memoryInput").value="";renderMemories();toast("Memory saved on this device.");});
  function renderMemories(){const host=$("memoryList");host.innerHTML=state.memories.length?state.memories.map(m=>`<div class="item-card"><div class="item-main"><div class="item-meta">${date(m.at)}</div>${esc(m.text)}</div><div class="item-actions"><button class="small-button" data-edit-memory="${m.id}">Edit</button><button class="small-button delete" data-delete-memory="${m.id}">Delete</button></div></div>`).join(""):'<div class="empty-state">Nothing saved yet. Add a memory above when you want ROOK to reuse a detail.</div>';
    host.querySelectorAll("[data-delete-memory]").forEach(b=>b.onclick=()=>{state.memories=state.memories.filter(m=>m.id!==b.dataset.deleteMemory);save();renderMemories();toast("Memory deleted.");});
    host.querySelectorAll("[data-edit-memory]").forEach(b=>b.onclick=()=>{const m=state.memories.find(x=>x.id===b.dataset.editMemory);if(!m)return;const v=prompt("Edit this memory",m.text);if(v===null)return;if(!v.trim()){toast("Memory was not changed.");return;}m.text=v.trim();save();renderMemories();toast("Memory updated.");});
  }
  $("noteForm").addEventListener("submit",e=>{e.preventDefault();const title=$("noteTitle").value.trim()||"Untitled note",body=$("noteBody").value.trim();if(!body)return;state.notes.unshift({id:id(),title,body,at:new Date().toISOString()});save();$("noteTitle").value="";$("noteBody").value="";renderNotes();toast("Note saved.");});
  function renderNotes(){const host=$("noteList");$("noteCount").textContent=state.notes.length+" saved";host.innerHTML=state.notes.length?state.notes.map(n=>`<div class="item-card"><div class="item-main"><b>${esc(n.title)}</b><div class="item-meta">${date(n.at)}</div>${esc(n.body)}</div><div class="item-actions"><button class="small-button delete" data-delete-note="${n.id}">Delete</button></div></div>`).join(""):'<div class="empty-state">No notes yet. Save an idea above.</div>';host.querySelectorAll("[data-delete-note]").forEach(b=>b.onclick=()=>{state.notes=state.notes.filter(n=>n.id!==b.dataset.deleteNote);save();renderNotes();toast("Note deleted.");});}
  $("shortcutForm").addEventListener("submit",e=>{e.preventDefault();const name=$("shortcutName").value.trim(),url=$("shortcutUrl").value.trim();try{const u=new URL(url);if(!["https:","shortcuts:"].includes(u.protocol))throw new Error();}catch{$("shortcutUrl").setCustomValidity("Use a valid https:// iCloud Shortcut link.");$("shortcutUrl").reportValidity();return;}$("shortcutUrl").setCustomValidity("");state.shortcuts.push({id:id(),name,url});save();$("shortcutName").value="";$("shortcutUrl").value="";renderShortcuts();toast("Shortcut button added.");});
  function renderShortcuts(){const host=$("shortcutList");host.innerHTML=state.shortcuts.length?state.shortcuts.map(s=>`<div class="item-card"><div class="item-main"><b>${esc(s.name)}</b><div class="item-meta">${esc(s.url)}</div></div><div class="item-actions"><a class="small-button" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">Open</a><button class="small-button delete" data-delete-shortcut="${s.id}">Delete</button></div></div>`).join(""):'<div class="empty-state">Your added shortcuts will appear here.</div>';host.querySelectorAll("[data-delete-shortcut]").forEach(b=>b.onclick=()=>{state.shortcuts=state.shortcuts.filter(s=>s.id!==b.dataset.deleteShortcut);save();renderShortcuts();});}
  function syncSettings(){$("providerUrl").value=state.provider.url||"";$("providerModel").value=state.provider.model||"";$("providerKey").value=state.provider.key||"";$("personality").value=state.personality||"";$("providerStatus").textContent=state.provider.url&&state.provider.model?"Provider configured · not tested yet":"Local mode active";$("modeLabel").textContent=state.provider.url&&state.provider.model?"Optional AI provider configured":"Local mode · no API required";}
  $("saveProvider").addEventListener("click",()=>{const url=$("providerUrl").value.trim(),model=$("providerModel").value.trim(),key=$("providerKey").value.trim();if(url){try{const u=new URL(url);if(!["https:","http:"].includes(u.protocol))throw 0;}catch{toast("Enter a valid endpoint URL.");return;}if(!model){toast("Enter the model name too.");return;}}state.provider={url,model,key};save();syncSettings();toast(url?"Provider settings saved. Test with a simple message.":"Local mode enabled.");});
  $("removeProvider").addEventListener("click",()=>{state.provider={url:"",model:"",key:""};save();syncSettings();toast("Provider and saved key removed.");});
  $("savePersonality").addEventListener("click",()=>{state.personality=$("personality").value.trim()||defaults.personality;save();toast("Personality saved.");});
  function exportData(){const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="rook-backup-"+new Date().toISOString().slice(0,10)+".json";a.click();URL.revokeObjectURL(a.href);toast("Backup exported.");}
  $("exportData").addEventListener("click",exportData);$("settingsExport").addEventListener("click",exportData);
  $("importFile").addEventListener("change",async e=>{const f=e.target.files?.[0];if(!f)return;try{const d=JSON.parse(await f.text());if(!d||typeof d!=="object")throw 0;state={...structuredClone(defaults),...d};save();renderMemories();renderNotes();renderShortcuts();syncSettings();renderMessages();toast("Backup imported.");}catch{toast("That backup file couldn't be read.");}e.target.value="";});
  $("clearData").addEventListener("click",()=>{if(!confirm("Clear all ROOK memories, notes, chat history, shortcuts, and provider settings from this browser? Export a backup first if you want to keep anything."))return;state=structuredClone(defaults);save();renderMemories();renderNotes();renderShortcuts();syncSettings();renderMessages();$("welcome").classList.remove("hidden");toast("Local ROOK data cleared.");});
  if("serviceWorker" in navigator && location.protocol!=="file:"){window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));}
  renderMessages();renderMemories();renderNotes();renderShortcuts();syncSettings();
})();