(() => {
'use strict';

const SB_URL='https://verofwurljrefospefiz.supabase.co';
const SB_KEY='sb_publishable_quKumiIdYiZSyNZsaCDcfQ_WSb-ASBC';
const { createClient } = window.supabase || {};
const app=document.getElementById('app');
const modal=document.getElementById('modalRoot');
const nav=document.querySelector('.bottom-nav');
const topbar=document.querySelector('.topbar');
const nb=document.getElementById('neighborhoodButton');
const refreshBtn=document.getElementById('refreshButton');
const themeBtn=document.getElementById('themeButton');

if(!createClient){
  app.innerHTML='<div class="empty"><div class="emoji">⚠️</div><h3>Bağlantı kurulamadı</h3><p>Supabase istemcisi yüklenemedi. İnternet bağlantını kontrol edip tekrar aç.</p></div>';
  return;
}

const sb=createClient(SB_URL,SB_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
let state={user:null,profile:null,memberships:[],neighborhood:null,posts:[],items:[],help:[],lost:[],recs:[],requests:[],profiles:[],conversations:[],conversationMembers:[],messages:[]};
let realtime=null;
let reloadTimer=null;
let booting=false;

const e=(v='')=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const route=()=>((location.hash||'#/feed').replace(/^#\/?/,'').split('?')[0]||'feed');
const go=r=>location.hash='#/'+r;
const fmtDate=v=>{try{return new Date(v).toLocaleString('tr-TR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}catch{return ''}};
const ownerName=x=>x?.profiles?.full_name||x?.owner_profile?.full_name||x?.requester_profile?.full_name||'Komşu';
const mine=x=>state.user&&[x.author_id,x.owner_id,x.requester_id,x.sender_id].includes(state.user.id);

function toast(msg){
  const root=document.getElementById('toastRoot');
  if(!root)return;
  const d=document.createElement('div'); d.className='toast'; d.textContent=msg; root.appendChild(d);
  setTimeout(()=>d.remove(),3000);
}
function head(t,d,b=''){return `<div class="page-head"><div><h1 class="page-title">${e(t)}</h1><p class="page-subtitle">${e(d)}</p></div>${b}</div>`}
function empty(t){return `<div class="empty"><div class="emoji">🏘️</div><h3>Henüz kayıt yok</h3><p>${e(t)}</p></div>`}
function open(title,body){modal.hidden=false;modal.innerHTML=`<div class="modal"><div class="modal-grabber"></div><div class="modal-head"><div><h2>${e(title)}</h2></div><button class="close-btn" data-a="close">×</button></div>${body}</div>`}
function close(){modal.hidden=true;modal.innerHTML=''}
function setShell(authenticated=true){nav.style.display=authenticated?'':'none';topbar.style.display='';}
function setBusy(msg='Yükleniyor…'){app.innerHTML=`<div class="empty"><div class="emoji">⏳</div><h3>${e(msg)}</h3><p>Komşum verileri hazırlanıyor.</p></div>`}

async function init(){
  applyTheme(localStorage.getItem('komsum.theme')||'light');
  const {data:{session}}=await sb.auth.getSession();
  await boot(session);
  sb.auth.onAuthStateChange((event,session)=>{
    if(event==='SIGNED_IN'||event==='SIGNED_OUT'||event==='TOKEN_REFRESHED') setTimeout(()=>boot(session),0);
  });
}

async function boot(session){
  if(booting)return; booting=true;
  try{
    if(!session?.user){
      state={user:null,profile:null,memberships:[],neighborhood:null,posts:[],items:[],help:[],lost:[],recs:[],requests:[],profiles:[],conversations:[],conversationMembers:[],messages:[]};
      if(realtime){await sb.removeChannel(realtime);realtime=null;}
      renderAuth(); return;
    }
    state.user=session.user;
    setShell(true); setBusy();
    await loadIdentity();
    if(!state.memberships.length){renderNeighborhoodSetup();return;}
    if(!state.neighborhood) state.neighborhood=state.memberships[0].neighborhoods;
    await loadAll();
    subscribeRealtime();
    render();
  }catch(err){console.error(err);app.innerHTML=head('Bağlantı Hatası','Veriler alınamadı')+`<div class="notice danger">${e(err.message||err)}</div><button class="primary-btn" data-a="retry">Tekrar Dene</button>`}
  finally{booting=false;}
}

async function loadIdentity(){
  const uid=state.user.id;
  let {data:profile,error:pErr}=await sb.from('profiles').select('*').eq('id',uid).single();
  if(pErr)throw pErr;
  state.profile=profile;
  let {data:members,error:mErr}=await sb.from('memberships').select('neighborhood_id,role,joined_at,neighborhoods(id,name,city,district,invite_code)').eq('user_id',uid).order('joined_at');
  if(mErr)throw mErr;
  state.memberships=members||[];
  if(state.neighborhood&&!state.memberships.some(m=>m.neighborhood_id===state.neighborhood.id)) state.neighborhood=null;
}

async function loadAll(){
  const nid=state.neighborhood.id;
  const [posts,items,help,lost,recs,requests,profiles,convs,convMembers,messages]=await Promise.all([
    sb.from('posts').select('*,profiles!author_id(full_name)').eq('neighborhood_id',nid).order('created_at',{ascending:false}),
    sb.from('items').select('*,profiles!owner_id(full_name)').eq('neighborhood_id',nid).order('created_at',{ascending:false}),
    sb.from('help_posts').select('*,profiles!author_id(full_name)').eq('neighborhood_id',nid).order('created_at',{ascending:false}),
    sb.from('lost_found').select('*,profiles!author_id(full_name)').eq('neighborhood_id',nid).order('created_at',{ascending:false}),
    sb.from('recommendations').select('*,profiles!author_id(full_name)').eq('neighborhood_id',nid).order('created_at',{ascending:false}),
    sb.from('borrow_requests').select('*,items(id,title,owner_id,neighborhood_id),profiles!requester_id(full_name)').order('created_at',{ascending:false}),
    sb.from('memberships').select('user_id,profiles!user_id(id,full_name,avatar_url)').eq('neighborhood_id',nid),
    sb.from('conversations').select('*').eq('neighborhood_id',nid).order('created_at',{ascending:false}),
    sb.from('conversation_members').select('conversation_id,user_id,profiles!user_id(id,full_name)').order('joined_at'),
    sb.from('messages').select('*').order('created_at',{ascending:true})
  ]);
  for(const r of [posts,items,help,lost,recs,requests,profiles,convs,convMembers,messages]) if(r.error)throw r.error;
  state.posts=posts.data||[]; state.items=items.data||[]; state.help=help.data||[]; state.lost=lost.data||[]; state.recs=recs.data||[];
  state.requests=(requests.data||[]).filter(q=>q.items?.neighborhood_id===nid);
  state.profiles=(profiles.data||[]).map(x=>x.profiles).filter(Boolean);
  state.conversations=convs.data||[]; state.conversationMembers=convMembers.data||[]; state.messages=messages.data||[];
}

function subscribeRealtime(){
  if(realtime)sb.removeChannel(realtime);
  const nid=state.neighborhood.id;
  realtime=sb.channel('komsum-'+nid);
  ['posts','items','help_posts','lost_found','recommendations'].forEach(table=>{
    realtime.on('postgres_changes',{event:'*',schema:'public',table,filter:`neighborhood_id=eq.${nid}`},scheduleReload);
  });
  realtime.on('postgres_changes',{event:'*',schema:'public',table:'borrow_requests'},scheduleReload);
  realtime.on('postgres_changes',{event:'INSERT',schema:'public',table:'messages'},scheduleReload);
  realtime.subscribe();
}
function scheduleReload(){clearTimeout(reloadTimer);reloadTimer=setTimeout(async()=>{try{await loadAll();render();}catch(err){console.error(err)}},400)}

function renderAuth(){
  setShell(false); nb.textContent='Giriş gerekli';
  app.innerHTML=`<div class="auth-wrap"><div class="card"><div class="profile-avatar" style="margin:auto">🏘️</div><h1 class="page-title" style="text-align:center">Komşum’a Hoş Geldin</h1><p class="page-subtitle" style="text-align:center">Mahallendeki komşularla ortak akış, ödünç, pazar ve yardımlaşma.</p><div class="form-row"><button class="primary-btn" data-a="auth-login">Giriş Yap</button><button class="secondary-btn" data-a="auth-signup">Kayıt Ol</button></div></div></div>`;
}
function authForm(mode){
  const signup=mode==='signup';
  open(signup?'Kayıt Ol':'Giriş Yap',`<form id="authForm" data-mode="${mode}" class="form-grid">${signup?`<div class="field"><label>Ad Soyad</label><input name="name" required maxlength="80" autocomplete="name"></div>`:''}<div class="field"><label>E-posta</label><input name="email" type="email" required autocomplete="email"></div><div class="field"><label>Şifre</label><input name="password" type="password" required minlength="6" autocomplete="${signup?'new-password':'current-password'}"></div><div class="form-actions"><button type="button" class="secondary-btn" data-a="close">İptal</button><button class="primary-btn">${signup?'Hesap Oluştur':'Giriş Yap'}</button></div>${signup?'<small class="hint">Kayıttan sonra e-posta adresini doğrulaman istenebilir.</small>':''}</form>`)
}
async function submitAuth(form){
  const fd=new FormData(form), email=String(fd.get('email')).trim(), password=String(fd.get('password'));
  const mode=form.dataset.mode;
  form.querySelector('button[type="submit"],button.primary-btn').disabled=true;
  if(mode==='signup'){
    const name=String(fd.get('name')).trim();
    const {data,error}=await sb.auth.signUp({email,password,options:{data:{full_name:name}}});
    if(error)throw error;
    close();
    if(!data.session){open('E-postanı Doğrula',`<div class="notice"><strong>${e(email)}</strong> adresine doğrulama e-postası gönderildi. E-postadaki bağlantıya dokunduktan sonra Komşum’a dönüp giriş yap.</div><div class="form-actions"><button class="primary-btn" data-a="close">Tamam</button></div>`)}
  }else{
    const {error}=await sb.auth.signInWithPassword({email,password}); if(error)throw error; close();
  }
}

function renderNeighborhoodSetup(){
  nav.style.display='none'; nb.textContent='Mahalle seçilmedi';
  app.innerHTML=head('Mahalleni Kur','Yeni bir mahalle oluştur veya komşunun davet koduyla katıl')+`<div class="stack"><div class="card"><h3 class="card-title">Yeni mahalle oluştur</h3><form id="createNeighborhood" class="form-grid"><div class="field"><label>Mahalle / Site adı</label><input name="name" required maxlength="100" placeholder="Örn. Ataşehir Sitesi"></div><div class="form-row"><div class="field"><label>İl</label><input name="city" maxlength="80" placeholder="İstanbul"></div><div class="field"><label>İlçe</label><input name="district" maxlength="80" placeholder="Küçükçekmece"></div></div><button class="primary-btn">Mahalle Oluştur</button></form></div><div class="card"><h3 class="card-title">Davet koduyla katıl</h3><form id="joinNeighborhood" class="form-grid"><div class="field"><label>Davet Kodu</label><input name="code" required maxlength="20" autocapitalize="characters" placeholder="Örn. A1B2C3D4"></div><button class="secondary-btn">Mahalleye Katıl</button></form></div><button class="text-btn" data-a="logout">Çıkış Yap</button></div>`;
}
async function createNeighborhood(form){
  const fd=new FormData(form); const {error}=await sb.rpc('create_neighborhood',{p_name:String(fd.get('name')).trim(),p_city:String(fd.get('city')).trim()||null,p_district:String(fd.get('district')).trim()||null});
  if(error)throw error; toast('Mahalle oluşturuldu'); await boot((await sb.auth.getSession()).data.session);
}
async function joinNeighborhood(form){
  const code=String(new FormData(form).get('code')).trim().toUpperCase(); const {error}=await sb.rpc('join_neighborhood',{p_invite_code:code});
  if(error)throw error; toast('Mahalleye katıldın'); await boot((await sb.auth.getSession()).data.session);
}

function card(x,kind,extra=''){
  const name=ownerName(x); const isMine=mine(x); const title=x.title||'Paylaşım'; const text=x.body||x.description||'';
  return `<article class="card"><div class="card-head"><div class="avatar">${e((name||'K')[0])}</div><div class="card-meta"><strong>${e(name)}</strong><span class="meta">${e(fmtDate(x.created_at))}</span></div></div><h3 class="card-title">${e(title)}</h3><div class="card-text">${e(text)}</div>${extra}<div class="card-footer">${isMine?`<span class="spacer"></span><button class="text-btn" data-a="edit" data-k="${kind}" data-id="${x.id}">Düzenle</button><button class="text-btn danger" data-a="del" data-k="${kind}" data-id="${x.id}">Sil</button>`:''}</div></article>`
}
function render(){
  if(!state.user){renderAuth();return}
  if(!state.memberships.length){renderNeighborhoodSetup();return}
  nav.style.display=''; nb.textContent=state.neighborhood?.name||'Mahalle';
  const r=route(); document.querySelectorAll('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.route===r||(n.dataset.route==='more'&&['more','lost','recs','profile','messages'].includes(r))));
  ({feed:feed,lend:lend,market:market,help:help,lost:lost,recs:recs,profile:profile,more:more,messages:messagesPage}[r]||feed)();
}
function feed(){app.innerHTML=head('Mahalle Akışı','Mahallendeki ortak duyuru ve paylaşımlar',`<button class="primary-btn small-btn" data-a="new" data-k="posts">+ Paylaş</button>`)+`<div class="stack">${state.posts.length?state.posts.map(x=>card(x,'posts',`<div class="card-footer"><span class="badge">${e(x.category||'Genel')}</span></div>`)).join(''):empty('İlk paylaşımı sen yapabilirsin.')}</div>`}
function lend(){
  const list=state.items.filter(x=>x.kind==='lend'); const incoming=state.requests.filter(q=>q.items?.owner_id===state.user.id&&q.status==='pending');
  app.innerHTML=head('Ödünç','Komşular arasında eşya paylaşımı',`<button class="primary-btn small-btn" data-a="new" data-k="lend">+ Eşya</button>`)+(incoming.length?`<button class="setting-row" data-a="incoming"><span>🔔</span><span class="grow"><strong>${incoming.length} yeni talep</strong><small>Onaylamak veya reddetmek için dokun</small></span></button>`:'')+`<div class="stack">${list.length?list.map(x=>card(x,'lend',`<div class="card-footer"><span class="badge">${statusTR(x.status)}</span><span class="spacer"></span>${x.owner_id!==state.user.id&&x.status==='available'?`<button class="primary-btn small-btn" data-a="request" data-id="${x.id}">İste</button>`:''}</div>`)).join(''):empty('Ödünç verilecek eşya yok.')}</div>`
}
function market(){const list=state.items.filter(x=>x.kind==='market');app.innerHTML=head('Mahalle Pazarı','Mahalle içi satış ve paylaşım',`<button class="primary-btn small-btn" data-a="new" data-k="market">+ İlan</button>`)+`<div class="stack">${list.length?list.map(x=>card(x,'market',`<div class="card-footer"><span class="price">${Number(x.price||0).toLocaleString('tr-TR')} TL</span><span class="spacer"></span>${x.owner_id!==state.user.id?`<button class="secondary-btn small-btn" data-a="message-user" data-user="${x.owner_id}">Mesaj</button>`:''}</div>`)).join(''):empty('Henüz pazar ilanı yok.')}</div>`}
function help(){app.innerHTML=head('Yardımlaşma','Mahalle içinde yardım iste veya destek sun',`<button class="primary-btn small-btn" data-a="new" data-k="help">+ Yardım</button>`)+`<div class="stack">${state.help.length?state.help.map(x=>card(x,'help',`<div class="card-footer"><span class="badge">${statusTR(x.status)}</span>${x.author_id!==state.user.id?`<span class="spacer"></span><button class="secondary-btn small-btn" data-a="message-user" data-user="${x.author_id}">Yaz</button>`:''}</div>`)).join(''):empty('Yardım kaydı bulunmuyor.')}</div>`}
function lost(){app.innerHTML=head('Kayıp & Buluntu','Kaybettiğini ara, bulduğunu sahibine ulaştır',`<button class="primary-btn small-btn" data-a="new" data-k="lost">+ Kayıt</button>`)+`<div class="stack">${state.lost.length?state.lost.map(x=>card(x,'lost',`<div class="card-footer"><span class="badge ${x.type==='lost'?'danger':'accent'}">${x.type==='lost'?'Kayıp':'Bulundu'} · ${statusTR(x.status)}</span></div>`)).join(''):empty('Kayıp veya buluntu kaydı yok.')}</div>`}
function recs(){app.innerHTML=head('Tavsiyeler','Komşuların deneyimlediği usta ve işletmeler',`<button class="primary-btn small-btn" data-a="new" data-k="recs">+ Tavsiye</button>`)+`<div class="stack">${state.recs.length?state.recs.map(x=>card(x,'recs',`<div class="card-footer"><span class="badge accent">${'★'.repeat(Number(x.rating||5))}</span><span class="spacer"></span>${x.phone?`<button class="secondary-btn small-btn" data-a="call" data-phone="${e(x.phone)}">Ara</button>`:''}</div>`)).join(''):empty('İlk tavsiyeyi sen ekleyebilirsin.')}</div>`}
function more(){app.innerHTML=head('Daha Fazla','Komşum’un diğer bölümleri')+`<div class="grid-menu"><button class="menu-tile" data-go="lost"><span>🔎</span><strong>Kayıp & Buluntu</strong><small>Kayıp ve bulunan eşyalar</small></button><button class="menu-tile" data-go="recs"><span>⭐</span><strong>Tavsiyeler</strong><small>Usta ve işletme önerileri</small></button><button class="menu-tile" data-go="messages"><span>💬</span><strong>Mesajlar</strong><small>Komşularla özel görüşme</small></button><button class="menu-tile" data-go="profile"><span>👤</span><strong>Profil</strong><small>Hesap ve mahalle bilgileri</small></button></div>`}
function profile(){
  const m=state.memberships.find(x=>x.neighborhood_id===state.neighborhood.id);
  app.innerHTML=head('Profil','Hesabın ve mahalle üyeliğin')+`<div class="card profile-card"><div class="profile-avatar">${e((state.profile?.full_name||'K')[0])}</div><div><strong>${e(state.profile?.full_name||'Komşu')}</strong><div class="meta">${e(state.user.email||'')}</div></div></div><div class="card"><h3 class="card-title">${e(state.neighborhood.name)}</h3><div class="card-text">${e([state.neighborhood.district,state.neighborhood.city].filter(Boolean).join(' / '))}</div><div class="notice"><strong>Davet Kodu:</strong> ${e(state.neighborhood.invite_code)}</div><small class="hint">Bu kodu yalnız mahalleye davet etmek istediğin kişilerle paylaş.</small></div><div class="settings-list"><button class="setting-row" data-a="profile-edit"><span>✏️</span><span class="grow"><strong>Profili düzenle</strong><small>Ad ve telefon bilgisi</small></span></button><button class="setting-row" data-a="switch-neighborhood"><span>🏘️</span><span class="grow"><strong>Mahalle değiştir</strong><small>${state.memberships.length} üyelik · ${e(m?.role||'member')}</small></span></button><button class="setting-row" data-a="logout"><span>↪</span><span class="grow"><strong>Çıkış yap</strong><small>Bu cihazdaki oturumu kapat</small></span></button></div>`
}
function messagesPage(){
  const convs=state.conversations.map(c=>{const members=state.conversationMembers.filter(m=>m.conversation_id===c.id);const other=members.find(m=>m.user_id!==state.user.id)?.profiles;const msgs=state.messages.filter(m=>m.conversation_id===c.id);const last=msgs[msgs.length-1];return {c,other,last};});
  app.innerHTML=head('Mesajlar','Mahallendeki komşularla özel görüşmeler',`<button class="primary-btn small-btn" data-a="new-message">+ Yeni</button>`)+`<div class="stack">${convs.length?convs.map(x=>`<button class="setting-row" data-a="open-conv" data-id="${x.c.id}"><span class="avatar">${e((x.other?.full_name||'K')[0])}</span><span class="grow"><strong>${e(x.other?.full_name||'Komşu')}</strong><small>${e(x.last?.body||'Konuşmayı aç')}</small></span></button>`).join(''):empty('Henüz mesajlaşma yok.')}</div>`
}
function statusTR(v){return ({available:'Müsait',requested:'Talep Var',loaned:'Ödünçte',sold:'Satıldı',unavailable:'Kapalı',pending:'Bekliyor',approved:'Onaylandı',rejected:'Reddedildi',returned:'İade Edildi',cancelled:'İptal',open:'Açık',resolved:'Çözüldü',closed:'Kapalı'})[v]||v||''}

const meta={
  posts:{table:'posts',title:'Paylaşım',titleLabel:'Başlık',textLabel:'İçerik'},
  lend:{table:'items',title:'Ödünç Eşya',titleLabel:'Eşya adı',textLabel:'Açıklama'},
  market:{table:'items',title:'Pazar İlanı',titleLabel:'Ürün adı',textLabel:'Açıklama'},
  help:{table:'help_posts',title:'Yardım',titleLabel:'Başlık',textLabel:'Açıklama'},
  lost:{table:'lost_found',title:'Kayıp / Buluntu',titleLabel:'Başlık',textLabel:'Açıklama'},
  recs:{table:'recommendations',title:'Tavsiye',titleLabel:'İşletme / kişi',textLabel:'Deneyimin'}
};
function getEntity(k,id){if(k==='posts')return state.posts.find(x=>x.id===id);if(k==='lend'||k==='market')return state.items.find(x=>x.id===id);if(k==='help')return state.help.find(x=>x.id===id);if(k==='lost')return state.lost.find(x=>x.id===id);if(k==='recs')return state.recs.find(x=>x.id===id)}
function entityForm(k,id=''){
  const x=id?getEntity(k,id):null,m=meta[k];
  open(x?'Kaydı Düzenle':m.title,`<form id="entityForm" data-k="${k}" data-id="${id}" class="form-grid"><div class="field"><label>${e(m.titleLabel)}</label><input name="title" required maxlength="120" value="${e(x?.title||'')}"></div><div class="field"><label>${e(m.textLabel)}</label><textarea name="text" required maxlength="3000">${e(x?.body||x?.description||'')}</textarea></div>${k==='posts'?`<div class="field"><label>Kategori</label><input name="category" maxlength="40" value="${e(x?.category||'Genel')}"></div>`:''}${k==='market'?`<div class="field"><label>Fiyat (TL)</label><input name="price" type="number" min="0" step="1" required value="${e(x?.price??'')}"></div>`:''}${k==='lost'?`<div class="field"><label>Tür</label><select name="type"><option value="lost" ${x?.type==='found'?'':'selected'}>Kayıp</option><option value="found" ${x?.type==='found'?'selected':''}>Bulundu</option></select></div>`:''}${k==='recs'?`<div class="form-row"><div class="field"><label>Puan</label><select name="rating">${[5,4,3,2,1].map(n=>`<option value="${n}" ${Number(x?.rating||5)===n?'selected':''}>${n}</option>`).join('')}</select></div><div class="field"><label>Telefon</label><input name="phone" inputmode="tel" value="${e(x?.phone||'')}"></div></div>`:''}<div class="form-actions"><button type="button" class="secondary-btn" data-a="close">İptal</button><button class="primary-btn">Kaydet</button></div></form>`)
}
async function saveEntity(form){
  const k=form.dataset.k,id=form.dataset.id,fd=new FormData(form),m=meta[k],uid=state.user.id,nid=state.neighborhood.id;
  let payload={};
  if(k==='posts')payload={title:String(fd.get('title')).trim(),body:String(fd.get('text')).trim(),category:String(fd.get('category')||'Genel').trim()||'Genel',neighborhood_id:nid,author_id:uid};
  if(k==='lend'||k==='market')payload={title:String(fd.get('title')).trim(),description:String(fd.get('text')).trim(),kind:k==='lend'?'lend':'market',price:k==='market'?Number(fd.get('price')||0):null,neighborhood_id:nid,owner_id:uid};
  if(k==='help')payload={title:String(fd.get('title')).trim(),body:String(fd.get('text')).trim(),neighborhood_id:nid,author_id:uid};
  if(k==='lost')payload={title:String(fd.get('title')).trim(),body:String(fd.get('text')).trim(),type:String(fd.get('type')),neighborhood_id:nid,author_id:uid};
  if(k==='recs')payload={title:String(fd.get('title')).trim(),body:String(fd.get('text')).trim(),rating:Number(fd.get('rating')||5),phone:String(fd.get('phone')||'').trim()||null,neighborhood_id:nid,author_id:uid};
  const q=id?sb.from(m.table).update(payload).eq('id',id):sb.from(m.table).insert(payload); const {error}=await q; if(error)throw error;
  close(); toast('Kaydedildi'); await loadAll(); render();
}
async function deleteEntity(k,id){if(!confirm('Bu kayıt silinsin mi?'))return;const {error}=await sb.from(meta[k].table).delete().eq('id',id);if(error)throw error;await loadAll();render();toast('Silindi')}

function requestItem(id){const x=state.items.find(i=>i.id===id);open('Ödünç İste',`<form id="borrowForm" data-id="${id}" class="form-grid"><div class="notice"><strong>${e(x?.title||'Eşya')}</strong> için sahibine talep gönderilecek.</div><div class="field"><label>Not</label><textarea name="message" maxlength="1000" placeholder="Ne zaman ve ne kadar süre kullanacağını yazabilirsin."></textarea></div><div class="form-actions"><button type="button" class="secondary-btn" data-a="close">İptal</button><button class="primary-btn">Talep Gönder</button></div></form>`)}
async function submitBorrow(form){const itemId=form.dataset.id,message=String(new FormData(form).get('message')||'').trim();const {error}=await sb.from('borrow_requests').insert({item_id:itemId,requester_id:state.user.id,message:message||null});if(error)throw error;close();toast('Talep gönderildi');await loadAll();render()}
function incoming(){const qs=state.requests.filter(q=>q.items?.owner_id===state.user.id);open('Ödünç Talepleri',qs.length?qs.map(q=>`<div class="card"><strong>${e(q.profiles?.full_name||'Komşu')} → ${e(q.items?.title||'Eşya')}</strong><div class="card-text">${e(q.message||'Not bırakılmadı.')}</div><div class="card-footer"><span class="badge">${e(statusTR(q.status))}</span>${q.status==='pending'?`<span class="spacer"></span><button class="secondary-btn small-btn" data-a="borrow-status" data-id="${q.id}" data-status="rejected">Reddet</button><button class="primary-btn small-btn" data-a="borrow-status" data-id="${q.id}" data-status="approved">Onayla</button>`:''}</div></div>`).join(''):empty('Talep yok.'))}
async function updateBorrow(id,status){const q=state.requests.find(x=>x.id===id);let {error}=await sb.from('borrow_requests').update({status}).eq('id',id);if(error)throw error;if(status==='approved'&&q?.item_id){const r=await sb.from('items').update({status:'loaned'}).eq('id',q.item_id);if(r.error)throw r.error}close();await loadAll();render();toast(status==='approved'?'Talep onaylandı':'Talep reddedildi')}

function newMessage(){const others=state.profiles.filter(p=>p.id!==state.user.id);open('Yeni Mesaj',others.length?`<div class="settings-list">${others.map(p=>`<button class="setting-row" data-a="message-user" data-user="${p.id}"><span class="avatar">${e((p.full_name||'K')[0])}</span><span class="grow"><strong>${e(p.full_name||'Komşu')}</strong><small>Konuşma başlat</small></span></button>`).join('')}</div>`:empty('Mahallende başka üye görünmüyor.'))}
async function startConversation(other){const {data,error}=await sb.rpc('start_conversation',{p_other_user:other,p_neighborhood:state.neighborhood.id});if(error)throw error;close();await loadAll();openConversation(data)}
function openConversation(id){const members=state.conversationMembers.filter(m=>m.conversation_id===id);const other=members.find(m=>m.user_id!==state.user.id)?.profiles;const msgs=state.messages.filter(m=>m.conversation_id===id);open(other?.full_name||'Mesajlar',`<div class="stack" style="max-height:48vh;overflow:auto">${msgs.length?msgs.map(m=>`<div class="card ${m.sender_id===state.user.id?'mine-message':''}"><div class="card-text">${e(m.body)}</div><small class="meta">${e(fmtDate(m.created_at))}</small></div>`).join(''):empty('İlk mesajı sen gönder.')}</div><form id="messageForm" data-id="${id}" class="form-row" style="margin-top:12px"><input name="body" required maxlength="5000" placeholder="Mesaj yaz…"><button class="primary-btn small-btn">Gönder</button></form>`)}
async function sendMessage(form){const body=String(new FormData(form).get('body')).trim();if(!body)return;const {error}=await sb.from('messages').insert({conversation_id:form.dataset.id,sender_id:state.user.id,body});if(error)throw error;await loadAll();openConversation(form.dataset.id)}

function profileEdit(){open('Profili Düzenle',`<form id="profileForm" class="form-grid"><div class="field"><label>Ad Soyad</label><input name="name" required maxlength="80" value="${e(state.profile?.full_name||'')}"></div><div class="field"><label>Telefon</label><input name="phone" inputmode="tel" maxlength="30" value="${e(state.profile?.phone||'')}"></div><div class="form-actions"><button type="button" class="secondary-btn" data-a="close">İptal</button><button class="primary-btn">Kaydet</button></div></form>`)}
async function saveProfile(form){const fd=new FormData(form);const {error}=await sb.from('profiles').update({full_name:String(fd.get('name')).trim(),phone:String(fd.get('phone')||'').trim()||null,updated_at:new Date().toISOString()}).eq('id',state.user.id);if(error)throw error;close();await loadIdentity();render();toast('Profil güncellendi')}
function switchNeighborhood(){open('Mahalle Değiştir',`<div class="settings-list">${state.memberships.map(m=>`<button class="setting-row" data-a="choose-neighborhood" data-id="${m.neighborhood_id}"><span>🏘️</span><span class="grow"><strong>${e(m.neighborhoods?.name||'Mahalle')}</strong><small>${e([m.neighborhoods?.district,m.neighborhoods?.city].filter(Boolean).join(' / '))}</small></span></button>`).join('')}</div><div class="section-title">Başka mahalle</div><button class="secondary-btn" data-a="join-more">Davet koduyla katıl</button>`)}
function joinMore(){open('Davet Koduyla Katıl',`<form id="joinNeighborhood" class="form-grid"><div class="field"><label>Davet Kodu</label><input name="code" required maxlength="20" autocapitalize="characters"></div><div class="form-actions"><button type="button" class="secondary-btn" data-a="close">İptal</button><button class="primary-btn">Katıl</button></div></form>`)}
async function chooseNeighborhood(id){const m=state.memberships.find(x=>x.neighborhood_id===id);if(!m)return;state.neighborhood=m.neighborhoods;close();await loadAll();subscribeRealtime();go('feed');render()}

function applyTheme(v){document.documentElement.dataset.theme=v;localStorage.setItem('komsum.theme',v);if(themeBtn)themeBtn.textContent=v==='dark'?'☀':'☾'}
function toggleTheme(){applyTheme(document.documentElement.dataset.theme==='dark'?'light':'dark')}

async function safe(fn){try{await fn()}catch(err){console.error(err);toast(err.message||'Bir hata oluştu')}}

document.addEventListener('submit',ev=>{
  ev.preventDefault(); const f=ev.target;
  if(f.id==='authForm')return safe(()=>submitAuth(f));
  if(f.id==='createNeighborhood')return safe(()=>createNeighborhood(f));
  if(f.id==='joinNeighborhood')return safe(()=>joinNeighborhood(f));
  if(f.id==='entityForm')return safe(()=>saveEntity(f));
  if(f.id==='borrowForm')return safe(()=>submitBorrow(f));
  if(f.id==='profileForm')return safe(()=>saveProfile(f));
  if(f.id==='messageForm')return safe(()=>sendMessage(f));
});
document.addEventListener('click',ev=>{
  const el=ev.target.closest('[data-a],[data-go]'); if(!el)return;
  if(el.dataset.go)return go(el.dataset.go);
  const a=el.dataset.a;
  if(a==='close')return close(); if(a==='auth-login')return authForm('login'); if(a==='auth-signup')return authForm('signup');
  if(a==='new')return entityForm(el.dataset.k); if(a==='edit')return entityForm(el.dataset.k,el.dataset.id); if(a==='del')return safe(()=>deleteEntity(el.dataset.k,el.dataset.id));
  if(a==='request')return requestItem(el.dataset.id); if(a==='incoming')return incoming(); if(a==='borrow-status')return safe(()=>updateBorrow(el.dataset.id,el.dataset.status));
  if(a==='new-message')return newMessage(); if(a==='message-user')return safe(()=>startConversation(el.dataset.user)); if(a==='open-conv')return openConversation(el.dataset.id);
  if(a==='profile-edit')return profileEdit(); if(a==='switch-neighborhood')return switchNeighborhood(); if(a==='join-more')return joinMore(); if(a==='choose-neighborhood')return safe(()=>chooseNeighborhood(el.dataset.id));
  if(a==='logout')return safe(()=>sb.auth.signOut()); if(a==='retry')return safe(async()=>boot((await sb.auth.getSession()).data.session));
  if(a==='call'){const p=el.dataset.phone;if(p)location.href='tel:'+p.replace(/\s/g,'')}
});
window.addEventListener('hashchange',render);
refreshBtn?.addEventListener('click',()=>safe(async()=>{if(state.user&&state.neighborhood){await loadAll();render();toast('Güncellendi')}}));
themeBtn?.addEventListener('click',toggleTheme);
nb?.addEventListener('click',()=>{if(state.user&&state.memberships.length)go('profile')});

init();
})();
