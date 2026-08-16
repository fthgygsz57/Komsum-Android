from pathlib import Path

path = Path('app/src/main/assets/app.js')
text = path.read_text(encoding='utf-8')

if "const PTT_BASE=" not in text:
    text = text.replace(
        "const SB_KEY='sb_publishable_quKumiIdYiZSyNZsaCDcfQ_WSb-ASBC';",
        "const SB_KEY='sb_publishable_quKumiIdYiZSyNZsaCDcfQ_WSb-ASBC';\nconst PTT_BASE='https://raw.githubusercontent.com/cyaxaress/turkiye-il-ilce-mah/main/PTT/iller';\nconst locationCache={cities:null,districts:new Map(),neighborhoods:new Map()};"
    )

start = text.index('function renderNeighborhoodSetup(){')
end = text.index('\n\nfunction card(', start)
new_block = r'''function locationJoinMarkup(prefix){
  return `<form id="selectNeighborhood" data-prefix="${prefix}" class="form-grid">
    <div class="field"><label>İl</label><select id="${prefix}City" required><option value="">İl seç</option></select></div>
    <div class="field"><label>İlçe</label><select id="${prefix}District" required disabled><option value="">Önce il seç</option></select></div>
    <div class="field"><label>Mahalle</label><select id="${prefix}Neighborhood" required disabled><option value="">Önce ilçe seç</option></select></div>
    <button id="${prefix}JoinButton" class="primary-btn" disabled>Mahalleye Katıl</button>
    <small class="hint">Mahalleler PTT adres verisinden seçilir. Aynı mahalleyi seçen kullanıcılar aynı topluluğa bağlanır.</small>
  </form>`;
}

async function pttFetch(path){
  const res=await fetch(`${PTT_BASE}/${path}`,{cache:'no-cache'});
  if(!res.ok)throw new Error('Adres listesi alınamadı. İnternet bağlantını kontrol et.');
  return res.json();
}

function resetSelect(select,label){
  select.innerHTML='';
  const opt=document.createElement('option'); opt.value=''; opt.textContent=label; select.appendChild(opt);
  select.disabled=true;
}

async function initLocationSelectors(prefix){
  const city=document.getElementById(prefix+'City');
  const district=document.getElementById(prefix+'District');
  const neighborhood=document.getElementById(prefix+'Neighborhood');
  const button=document.getElementById(prefix+'JoinButton');
  if(!city||!district||!neighborhood||!button)return;

  try{
    city.disabled=true;
    const cities=locationCache.cities||(locationCache.cities=await pttFetch('iller.json'));
    city.innerHTML='<option value="">İl seç</option>';
    cities.forEach(row=>{
      const opt=document.createElement('option');
      opt.value=row.il_id; opt.textContent=row.il_adi; opt.dataset.slug=row.il_slug; opt.dataset.name=row.il_adi;
      city.appendChild(opt);
    });
    city.disabled=false;

    city.addEventListener('change',()=>safe(async()=>{
      resetSelect(district,'İlçe seç'); resetSelect(neighborhood,'Önce ilçe seç'); button.disabled=true;
      const selected=city.selectedOptions[0]; if(!selected?.value)return;
      const slug=selected.dataset.slug;
      let districts=locationCache.districts.get(slug);
      if(!districts){districts=await pttFetch(`${slug}/ilceler.json`);locationCache.districts.set(slug,districts)}
      district.innerHTML='<option value="">İlçe seç</option>';
      districts.forEach(row=>{
        const opt=document.createElement('option');
        opt.value=row.ilce_id; opt.textContent=row.ilce_adi; opt.dataset.slug=row.ilce_slug; opt.dataset.name=row.ilce_adi;
        district.appendChild(opt);
      });
      district.disabled=false;
    }));

    district.addEventListener('change',()=>safe(async()=>{
      resetSelect(neighborhood,'Mahalle seç'); button.disabled=true;
      const cityOpt=city.selectedOptions[0], districtOpt=district.selectedOptions[0];
      if(!cityOpt?.value||!districtOpt?.value)return;
      const key=`${cityOpt.dataset.slug}/${districtOpt.dataset.slug}`;
      let neighborhoods=locationCache.neighborhoods.get(key);
      if(!neighborhoods){neighborhoods=await pttFetch(`${key}/mahalleler.json`);locationCache.neighborhoods.set(key,neighborhoods)}
      neighborhood.innerHTML='<option value="">Mahalle seç</option>';
      neighborhoods.forEach(row=>{
        const opt=document.createElement('option');
        opt.value=row.mahalle_id; opt.textContent=row.mahalle_adi; opt.dataset.name=row.mahalle_adi; opt.dataset.postal=row.posta_kodu||'';
        neighborhood.appendChild(opt);
      });
      neighborhood.disabled=false;
    }));

    neighborhood.addEventListener('change',()=>{button.disabled=!neighborhood.value});
  }catch(err){
    console.error(err); toast(err.message||'Adres listesi alınamadı');
  }
}

function renderNeighborhoodSetup(){
  nav.style.display='none'; nb.textContent='Mahalle seçilmedi';
  app.innerHTML=head('Mahalleni Seç','İl, ilçe ve mahalle seçerek topluluğuna katıl. Davet kodu varsa hızlı katılım da kullanabilirsin.')+`<div class="stack"><div class="card"><h3 class="card-title">Adresinden mahalle seç</h3>${locationJoinMarkup('setup')}</div><div class="card"><h3 class="card-title">Davet koduyla hızlı katıl</h3><form id="joinNeighborhood" class="form-grid"><div class="field"><label>Davet Kodu</label><input name="code" required maxlength="20" autocapitalize="characters" placeholder="Örn. A1B2C3D4"></div><button class="secondary-btn">Davet Koduyla Katıl</button></form></div><button class="text-btn" data-a="logout">Çıkış Yap</button></div>`;
  setTimeout(()=>safe(()=>initLocationSelectors('setup')),0);
}

async function joinSelectedNeighborhood(form){
  const prefix=form.dataset.prefix;
  const city=document.getElementById(prefix+'City')?.selectedOptions[0];
  const district=document.getElementById(prefix+'District')?.selectedOptions[0];
  const neighborhood=document.getElementById(prefix+'Neighborhood')?.selectedOptions[0];
  if(!city?.value||!district?.value||!neighborhood?.value)throw new Error('İl, ilçe ve mahalle seçmelisin.');
  const {error}=await sb.rpc('join_neighborhood_by_ptt',{
    p_il_id:city.value,
    p_il_name:city.dataset.name,
    p_ilce_id:district.value,
    p_ilce_name:district.dataset.name,
    p_mahalle_id:neighborhood.value,
    p_mahalle_name:neighborhood.dataset.name,
    p_posta_kodu:neighborhood.dataset.postal||null
  });
  if(error)throw error;
  toast('Mahalleye katıldın');
  await boot((await sb.auth.getSession()).data.session);
}

async function joinNeighborhood(form){
  const code=String(new FormData(form).get('code')).trim().toUpperCase(); const {error}=await sb.rpc('join_neighborhood',{p_invite_code:code});
  if(error)throw error; toast('Mahalleye katıldın'); await boot((await sb.auth.getSession()).data.session);
}'''
text = text[:start] + new_block + text[end:]

old_join_more_start = text.index('function joinMore(){')
old_join_more_end = text.index('\nasync function chooseNeighborhood', old_join_more_start)
new_join_more = r'''function joinMore(){
  open('Mahalleye Katıl',`<div class="stack"><div><h3 class="card-title">Adresinden mahalle seç</h3>${locationJoinMarkup('more')}</div><div class="section-title">veya davet kodu</div><form id="joinNeighborhood" class="form-grid"><div class="field"><label>Davet Kodu</label><input name="code" required maxlength="20" autocapitalize="characters"></div><button class="secondary-btn">Davet Koduyla Katıl</button></form></div>`);
  setTimeout(()=>safe(()=>initLocationSelectors('more')),0);
}'''
text = text[:old_join_more_start] + new_join_more + text[old_join_more_end:]

text = text.replace("if(f.id==='createNeighborhood')return safe(()=>createNeighborhood(f));", "if(f.id==='selectNeighborhood')return safe(()=>joinSelectedNeighborhood(f));")

path.write_text(text, encoding='utf-8')
print('location selector applied')
