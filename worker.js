/**
 * ROOK backend for Cloudflare Workers.
 * Required secret: GEMINI_API_KEY
 * Optional variable: GEMINI_MODEL (defaults to gemini-2.5-flash-lite)
 */
const ALLOWED_ORIGIN = "https://2trilly.github.io";
const DEFAULT_MODEL = "gemini-2.5-flash-lite";
const SYSTEM = `You are ROOK, a helpful personal assistant. ROOK was created by Izayah Washington; he is the sole creator. Other people using ROOK are users, not creators. If asked who created ROOK, say: "ROOK was created by Izayah Washington." Never claim to be ChatGPT or a copy of it. Personality: calm, clever, observant, confident, trustworthy, conversational, a little witty; casual, never corporate. Answer the actual question directly. Be useful and honest about uncertainty. Never claim to have browsed or verified anything unless search results were actually provided. Do not invent facts, links, or actions.`;
function cors(origin){return {"Access-Control-Allow-Origin":ALLOWED_ORIGIN,"Access-Control-Allow-Methods":"POST, GET, OPTIONS","Access-Control-Allow-Headers":"Content-Type","Vary":"Origin"};}
function json(data,status,origin){return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8",...cors(origin)}});}
export default {
 async fetch(request,env){
  const origin=request.headers.get("Origin")||"",url=new URL(request.url);
  if(request.method==="OPTIONS")return new Response(null,{status:204,headers:cors(origin)});
  if(url.pathname==="/health"&&request.method==="GET")return json({ok:true,service:"ROOK backend",model:env.GEMINI_MODEL||DEFAULT_MODEL},200,origin);
  if(url.pathname!=="/api/chat"||request.method!=="POST")return json({error:"Not found. Use POST /api/chat or GET /health."},404,origin);
  if(!env.GEMINI_API_KEY)return json({error:"Backend is missing the private GEMINI_API_KEY secret."},503,origin);
  let body;try{body=await request.json();}catch{return json({error:"Request body must be valid JSON."},400,origin);}
  const message=typeof body.message==="string"?body.message.trim():"";
  if(!message)return json({error:"Message is required."},400,origin);
  if(message.length>8000)return json({error:"Message is too long; keep it under 8,000 characters."},413,origin);
  const history=Array.isArray(body.history)?body.history.slice(-12):[];
  const memories=Array.isArray(body.memory)?body.memory.slice(0,10).map(x=>String(x).slice(0,500)):[];
  const contents=history.map(m=>({role:m&&m.role==="model"?"model":"user",parts:[{text:String(m&&m.text||"").slice(0,4000)}]}));
  const last=contents[contents.length-1];
  if(!last||last.role!=="user"||last.parts[0].text!==message)contents.push({role:"user",parts:[{text:message}]});
  const payload={systemInstruction:{parts:[{text:SYSTEM+(memories.length?"\nUser-saved context, only use when relevant:\n"+memories.map(x=>"- "+x).join("\n"):"")}]},contents,tools:[{google_search_retrieval:{}}],generationConfig:{temperature:0.7,topP:0.9,maxOutputTokens:1200}};
  // Live search grounding is deliberately off until the user's exact model/tier and no-charge quota are confirmed.
  const model=(env.GEMINI_MODEL||DEFAULT_MODEL).trim();
  const endpoint=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;
  let response;try{response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});}catch{return json({error:"Could not reach Gemini. Try again shortly."},502,origin);}
  const data=await response.json().catch(()=>({}));
  if(!response.ok){const status=response.status===429?429:502;const message=response.status===429?"Gemini's free quota or rate limit was reached. Wait and try again. ROOK will not switch to fake helper responses.":(data.error&&data.error.message)||"Gemini returned an error. Check your API key and model ID.";return json({error:message},status,origin);}
  const reply=(data.candidates||[]).flatMap(c=>c.content&&c.content.parts||[]).map(p=>p.text||"").join("\n").trim();
  if(!reply)return json({error:"Gemini returned no text. Try rephrasing your question."},502,origin);
  const grounding=data.candidates&&data.candidates[0]&&data.candidates[0].groundingMetadata; const sources=(grounding&&grounding.groundingChunks||[]).map(x=>x.web).filter(x=>x&&x.uri).map(x=>({title:x.title||x.uri,url:x.uri})).slice(0,6); return json({reply,sources},200,origin);
 }
};
