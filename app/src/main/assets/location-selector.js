(() => {
'use strict';

const SB_URL = 'https://verofwurljrefospefiz.supabase.co';
const SB_KEY = 'sb_publishable_quKumiIdYiZSyNZsaCDcfQ_WSb-ASBC';
const DATA_BASE = 'https://raw.githubusercontent.com/cyaxaress/turkiye-il-ilce-mah/main/PTT/iller';
const CACHE = 'komsum.location.v2:';

if (!window.supabase?.createClient) return;
const sb = window.supabase.createClient(SB_URL, SB_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

let provinces = [];
let districts = [];
let neighborhoods = [];
let patching = false;

const esc = (v = '') => String(v ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));
const opt = (value, label) => `<option value="${esc(value)}">${esc(label)}</option>`;

function status(message = '', danger = false) {
  const el = document.getElementById('locationStatus');
  if (!el) return;
  el.hidden = !message;
  el.className = danger ? 'notice danger' : 'notice';
  el.textContent = message;
}

function loading(select, label) {
  if (!select) return;
  select.disabled = true;
  select.innerHTML = opt('', label);
}

function cacheGet(key) {
  try {
    const raw = sessionStorage.getItem(CACHE + key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function cacheSet(key, value) {
  try { sessionStorage.setItem(CACHE + key, JSON.stringify(value)); } catch {}
}

async function json(url, key) {
  const hit = cacheGet(key);
  if (hit) return hit;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
    if (!response.ok) throw new Error(`Adres listesi alınamadı (${response.status})`);
    const data = await response.json();
    cacheSet(key, data);
    return data;
  } finally { clearTimeout(timer); }
}

async function loadProvinces() {
  const select = document.getElementById('locationProvince');
  if (!select) return;
  loading(select, 'İller yükleniyor…');
  try {
    provinces = await json(`${DATA_BASE}/iller.json`, 'provinces');
    provinces.sort((a, b) => a.il_adi.localeCompare(b.il_adi, 'tr'));
    select.innerHTML = opt('', 'İl seç') + provinces.map(x => opt(x.il_slug, x.il_adi)).join('');
    select.disabled = false;
    status();
  } catch (error) {
    select.innerHTML = opt('', 'İller yüklenemedi');
    status('Adres listesi alınamadı. Davet kodun varsa aşağıdaki alandan katılabilirsin.', true);
    console.error(error);
  }
}

async function provinceChanged() {
  const province = document.getElementById('locationProvince');
  const district = document.getElementById('locationDistrict');
  const neighborhood = document.getElementById('locationNeighborhood');
  if (!province || !district || !neighborhood) return;

  districts = [];
  neighborhoods = [];
  loading(neighborhood, 'Önce ilçe seç');
  if (!province.value) {
    loading(district, 'Önce il seç');
    return;
  }

  loading(district, 'İlçeler yükleniyor…');
  status();
  try {
    districts = await json(`${DATA_BASE}/${encodeURIComponent(province.value)}/ilceler.json`, `districts:${province.value}`);
    districts.sort((a, b) => a.ilce_adi.localeCompare(b.ilce_adi, 'tr'));
    district.innerHTML = opt('', 'İlçe seç') + districts.map(x => opt(x.ilce_slug, x.ilce_adi)).join('');
    district.disabled = false;
  } catch (error) {
    district.innerHTML = opt('', 'İlçeler yüklenemedi');
    status('İlçe listesi alınamadı. İnternet bağlantını kontrol edip yeniden dene.', true);
    console.error(error);
  }
}

async function districtChanged() {
  const province = document.getElementById('locationProvince');
  const district = document.getElementById('locationDistrict');
  const neighborhood = document.getElementById('locationNeighborhood');
  if (!province || !district || !neighborhood) return;

  neighborhoods = [];
  if (!province.value || !district.value) {
    loading(neighborhood, 'Önce ilçe seç');
    return;
  }

  loading(neighborhood, 'Mahalleler yükleniyor…');
  status();
  try {
    neighborhoods = await json(
      `${DATA_BASE}/${encodeURIComponent(province.value)}/${encodeURIComponent(district.value)}/mahalleler.json`,
      `neighborhoods:${province.value}:${district.value}`
    );
    neighborhoods.sort((a, b) => a.mahalle_adi.localeCompare(b.mahalle_adi, 'tr'));
    neighborhood.innerHTML = opt('', 'Mahalle seç') + neighborhoods.map(x => opt(x.mahalle_id, x.mahalle_adi)).join('');
    neighborhood.disabled = false;
  } catch (error) {
    neighborhood.innerHTML = opt('', 'Mahalleler yüklenemedi');
    status('Mahalle listesi alınamadı. İnternet bağlantını kontrol edip yeniden dene.', true);
    console.error(error);
  }
}

async function joinCanonical(form) {
  const provinceSlug = form.querySelector('#locationProvince')?.value;
  const districtSlug = form.querySelector('#locationDistrict')?.value;
  const neighborhoodId = form.querySelector('#locationNeighborhood')?.value;
  const province = provinces.find(x => x.il_slug === provinceSlug);
  const district = districts.find(x => x.ilce_slug === districtSlug);
  const neighborhood = neighborhoods.find(x => x.mahalle_id === neighborhoodId);

  if (!province || !district || !neighborhood) {
    status('Lütfen il, ilçe ve mahalleyi sırayla seç.', true);
    return;
  }

  const button = form.querySelector('button[type="submit"]');
  if (button) {
    button.disabled = true;
    button.textContent = 'Katılınıyor…';
  }
  status('Mahalle üyeliğin hazırlanıyor…');

  try {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) throw new Error('Oturum bulunamadı. Lütfen yeniden giriş yap.');

    const { error } = await sb.rpc('join_neighborhood_by_ptt', {
      p_il_id: String(province.il_id),
      p_il_name: province.il_adi,
      p_ilce_id: String(district.ilce_id),
      p_ilce_name: district.ilce_adi,
      p_mahalle_id: neighborhood.mahalle_id,
      p_mahalle_name: neighborhood.mahalle_adi,
      p_posta_kodu: neighborhood.posta_kodu || null
    });
    if (error) throw error;

    status(`${neighborhood.mahalle_adi} için üyeliğin hazır. Açılıyor…`);
    setTimeout(() => location.reload(), 350);
  } catch (error) {
    console.error(error);
    status(error.message || 'Mahalleye katılırken bir hata oluştu.', true);
    if (button) {
      button.disabled = false;
      button.textContent = 'Mahalleye Katıl';
    }
  }
}

function patchSetup() {
  if (patching) return;
  const oldForm = document.getElementById('createNeighborhood');
  if (!oldForm) return;
  const card = oldForm.closest('.card');
  if (!card) return;

  patching = true;
  card.innerHTML = `
    <h3 class="card-title">Mahalleni seç</h3>
    <p class="card-text">İl, ilçe ve mahalleyi listeden seç. Aynı mahalleyi seçen komşular otomatik olarak aynı topluluğa bağlanır.</p>
    <form id="canonicalNeighborhoodForm" class="form-grid">
      <div class="field">
        <label>İl</label>
        <select id="locationProvince" required disabled>${opt('', 'İller yükleniyor…')}</select>
      </div>
      <div class="field">
        <label>İlçe</label>
        <select id="locationDistrict" required disabled>${opt('', 'Önce il seç')}</select>
      </div>
      <div class="field">
        <label>Mahalle</label>
        <select id="locationNeighborhood" required disabled>${opt('', 'Önce ilçe seç')}</select>
      </div>
      <div id="locationStatus" class="notice" hidden></div>
      <button class="primary-btn" type="submit">Mahalleye Katıl</button>
      <small class="hint">Adres seçenekleri PTT tabanlı güncel katalogdan alınır. Davet kodun varsa aşağıdaki hızlı katılım alanını da kullanabilirsin.</small>
    </form>`;

  document.getElementById('locationProvince')?.addEventListener('change', provinceChanged);
  document.getElementById('locationDistrict')?.addEventListener('change', districtChanged);
  loadProvinces();
  patching = false;
}

document.addEventListener('submit', event => {
  if (event.target?.id !== 'canonicalNeighborhoodForm') return;
  event.preventDefault();
  event.stopImmediatePropagation();
  joinCanonical(event.target);
}, true);

const app = document.getElementById('app');
if (app) new MutationObserver(patchSetup).observe(app, { childList: true, subtree: true });
patchSetup();
})();
