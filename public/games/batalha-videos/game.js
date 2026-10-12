const overlay = new URLSearchParams(location.search).get('overlay') === '1';
document.body.classList.toggle('overlay', overlay);
if (overlay) document.title = 'Tela da live — Batalha de vídeos';
const channel = new BroadcastChannel('batalha-videos-v1');
const fighters = [...document.querySelectorAll('.fighter')];
const assets = new Map();
const versions = fighters.map(() => 0);
const currentLoops = fighters.map(() => null);
const status = (message) => { document.querySelector('#status').textContent = message; };
let db;
let sound = false;
let background = localStorage.getItem('batalha-videos-background') || '#151b36';
function setBackground(color) {
  if (!/^#[0-9a-f]{6}$/i.test(color)) return;
  background = color;
  document.querySelector('#arena').style.setProperty('--arena-background', color);
  document.querySelector('#background-color').value = color;
  localStorage.setItem('batalha-videos-background', color);
}
setBackground(background);
const ready = new Promise((resolve, reject) => {
  const request = indexedDB.open('batalha-videos', 1);
  request.onupgradeneeded = () => request.result.createObjectStore('videos', { keyPath: 'id' });
  request.onsuccess = () => { db = request.result; resolve(); };
  request.onerror = () => reject(request.error);
});
async function records() {
  await ready;
  return new Promise((resolve, reject) => {
    const request = db.transaction('videos').objectStore('videos').getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function write(record, remove = false) {
  return writeMany([record], remove);
}
async function writeMany(items, remove = false) {
  await ready;
  await new Promise((resolve, reject) => {
    const transaction = db.transaction('videos', 'readwrite');
    const store = transaction.objectStore('videos');
    for (const record of items) {
      if (remove) store.delete(record.id); else {
        const { url, ...saved } = record;
        store.put(saved);
      }
    }
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
  await refresh();
  channel.postMessage({ type: 'refresh' });
}
function play(video) {
  const pending = video.play();
  if (pending) pending.catch(() => status('Clique na tela dos vídeos para permitir a reprodução. Confira também o formato do arquivo.'));
}
function playlist(side) {
  return [...assets.values()].filter(asset => asset.side === side && asset.kind === 'loop')
    .sort((a, b) => (a.order ?? -1) - (b.order ?? -1) || a.id.localeCompare(b.id));
}
function startLoop(side, id) {
  const video = fighters[side].querySelector('.loop');
  const asset = assets.get(id);
  if (!asset || asset.kind !== 'loop' || asset.side !== side) return;
  currentLoops[side] = id;
  video.loop = false;
  video.hidden = false;
  video.src = asset.url;
  video.muted = !sound;
  video.onended = () => nextLoop(side);
  video.onerror = () => status(`Erro em ${asset.name}. Remova ou substitua esse vídeo da sequência.`);
  // A sequência fica pausada enquanto uma ação está na tela.
  if (fighters[side].querySelector('.action').hidden) play(video);
}
function nextLoop(side) {
  const items = playlist(side);
  if (!items.length) return;
  const index = items.findIndex(asset => asset.id === currentLoops[side]);
  startLoop(side, items[(index + 1) % items.length].id);
}
async function moveLoop(side, id, direction) {
  const items = playlist(side);
  const index = items.findIndex(asset => asset.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= items.length) return;
  [items[index], items[target]] = [items[target], items[index]];
  await writeMany(items.map((asset, order) => ({ ...asset, order })));
}
function resume(side) {
  versions[side]++;
  const loop = fighters[side].querySelector('.loop');
  const action = fighters[side].querySelector('.action');
  action.onended = null;
  action.onerror = null;
  action.onplaying = null;
  action.pause();
  action.hidden = true;
  action.removeAttribute('src');
  action.load();
  if (loop.getAttribute('src')) {
    if (loop.ended) nextLoop(side); else play(loop);
  }
}
function trigger(id) {
  const asset = assets.get(id);
  if (!asset || asset.kind !== 'action' || !fighters[asset.side]) return;
  const { side } = asset;
  resume(side);
  const version = versions[side];
  const loop = fighters[side].querySelector('.loop');
  const action = fighters[side].querySelector('.action');
  action.src = asset.url;
  action.muted = !sound;
  action.onplaying = () => {
    if (versions[side] !== version) return;
    loop.pause();
    action.hidden = false;
  };
  action.onended = () => { if (versions[side] === version) resume(side); };
  action.onerror = () => {
    if (versions[side] !== version) return;
    resume(side);
    status(`Não foi possível reproduzir ${asset.name}. Use um vídeo compatível, como MP4 H.264.`);
  };
  play(action);
  status(`${asset.name}. Ao terminar, o loop continua.`);
}
function dispatch(message) {
  receive(message);
  channel.postMessage(message);
}
function receive(message) {
  if (message.type === 'background') {
    setBackground(message.color);
    status('Fundo alterado. O vídeo continua normalmente.');
  }
  if (message.type === 'refresh') refresh().catch(report);
  if (message.type === 'action') trigger(message.id);
  if (message.type === 'resume') fighters.forEach((_, side) => resume(side));
  if (message.type === 'sound') {
    sound = message.value;
    document.querySelector('#sound').checked = sound;
    document.querySelectorAll('video').forEach(video => { video.muted = !sound; });
  }
  if (message.type === 'hello' && !overlay) {
    channel.postMessage({ type: 'sound', value: sound });
    channel.postMessage({ type: 'background', color: background });
  }
}
channel.onmessage = ({ data }) => receive(data);
function report(error) { status(`Não foi possível salvar/carregar os vídeos: ${error.message}`); }
async function upload(side, kind, files) {
  const items = [];
  const order = Math.max(-1, ...playlist(side).map(asset => asset.order ?? -1)) + 1;
  for (const file of files) {
    if (!file.type.startsWith('video/')) { status('Selecione um arquivo de vídeo.'); continue; }
    const id = crypto.randomUUID();
    items.push({ id, side, kind, name: file.name, file, order: order + items.length });
  }
  if (!items.length) return;
  await writeMany(items);
  status(kind === 'loop' ? 'Vídeos adicionados à sequência. Use ↑ e ↓ para escolher a ordem.' : 'Ações salvas. Clique em uma ação para reproduzir.');
}
function picker(side, kind, label) {
  const wrapper = document.createElement('label');
  wrapper.className = 'file-button';
  wrapper.textContent = label;
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'video/*'; input.hidden = true;
  input.multiple = true;
  input.onchange = () => upload(side, kind, [...input.files]).catch(report);
  wrapper.append(input);
  return wrapper;
}
function renderControls() {
  const controls = document.querySelector('#controls');
  controls.replaceChildren();
  fighters.forEach((_, side) => {
    const section = document.createElement('section'); section.className = 'side-controls';
    const heading = document.createElement('h2'); heading.textContent = 'Vídeos';
    const name = document.createElement('span'); name.className = 'loop-name';
    name.textContent = 'A sequência se repete automaticamente. Use ↑ e ↓ para mudar a ordem.';
    const loops = document.createElement('div'); loops.className = 'actions';
    const items = playlist(side);
    if (!items.length) {
      const empty = document.createElement('span'); empty.className = 'loop-name';
      empty.textContent = 'Nenhum vídeo na sequência'; loops.append(empty);
    }
    items.forEach((asset, index) => {
      const row = document.createElement('div'); row.className = 'action-row';
      const label = document.createElement('span'); label.className = 'playlist-name';
      label.textContent = `${index + 1}. ${asset.name}`;
      const up = document.createElement('button'); up.textContent = '↑'; up.disabled = index === 0;
      up.setAttribute('aria-label', `Mover ${asset.name} para cima`);
      up.onclick = () => moveLoop(side, asset.id, -1).catch(report);
      const down = document.createElement('button'); down.textContent = '↓'; down.disabled = index === items.length - 1;
      down.setAttribute('aria-label', `Mover ${asset.name} para baixo`);
      down.onclick = () => moveLoop(side, asset.id, 1).catch(report);
      const remove = document.createElement('button'); remove.className = 'remove'; remove.textContent = '×';
      remove.setAttribute('aria-label', `Remover ${asset.name} da sequência`);
      remove.onclick = () => write(asset, true).catch(report);
      row.append(label, up, down, remove); loops.append(row);
    });
    const actions = document.createElement('div'); actions.className = 'actions';
    for (const asset of assets.values()) {
      if (asset.side !== side || asset.kind !== 'action') continue;
      const row = document.createElement('div'); row.className = 'action-row';
      const button = document.createElement('button'); button.className = 'trigger'; button.textContent = `▶ ${asset.name}`;
      button.onclick = () => dispatch({ type: 'action', id: asset.id });
      const remove = document.createElement('button'); remove.className = 'remove'; remove.textContent = '×';
      remove.setAttribute('aria-label', `Remover ${asset.name}`);
      remove.onclick = () => write(asset, true).catch(report);
      row.append(button, remove); actions.append(row);
    }
    section.append(heading, picker(side, 'loop', '+ Adicionar vídeos à sequência'), name, loops, picker(side, 'action', '+ Adicionar vídeos de ação'), actions);
    controls.append(section);
  });
}
let refreshChain = Promise.resolve();
function refresh() {
  refreshChain = refreshChain.catch(() => {}).then(async () => {
    const saved = (await records()).filter(record => fighters[record.side]);
    const ids = new Set(saved.map(record => record.id));
    for (const [id, old] of assets) {
      const replacement = saved.find(record => record.id === id);
      if (!ids.has(id) || replacement.file.lastModified !== old.file.lastModified || replacement.file.size !== old.file.size || replacement.name !== old.name) {
        if (old.kind === 'action' && fighters[old.side].querySelector('.action').getAttribute('src') === old.url) resume(old.side);
        if (old.kind === 'loop' && currentLoops[old.side] === id) {
          const video = fighters[old.side].querySelector('.loop');
          video.pause(); video.removeAttribute('src'); video.load();
        }
        URL.revokeObjectURL(old.url); assets.delete(id);
      }
    }
    for (const record of saved) {
      if (!assets.has(record.id)) assets.set(record.id, { ...record, url: URL.createObjectURL(record.file) });
      else Object.assign(assets.get(record.id), record);
    }
    fighters.forEach((fighter, side) => {
      const items = playlist(side);
      const video = fighter.querySelector('.loop');
      video.hidden = !items.length;
      if (!items.length) {
        currentLoops[side] = null;
        video.pause(); video.removeAttribute('src'); video.load();
      } else {
        const asset = items.find(item => item.id === currentLoops[side]) || items[0];
        if (video.getAttribute('src') !== asset.url) startLoop(side, asset.id);
      }
    });
    renderControls();
  });
  return refreshChain;
}
document.querySelector('#open-overlay').onclick = () => {
  const url = new URL(location.href); url.searchParams.set('overlay', '1');
  // A tela de captura não precisa de uma segunda conexão ao TikTok.
  url.searchParams.delete('id'); url.searchParams.delete('username');
  const popup = window.open(url, 'batalha-videos-live', 'popup,width=540,height=960');
  if (!popup) status('Permita abrir janelas neste navegador para abrir a tela da live.');
};
document.querySelector('#resume').onclick = () => dispatch({ type: 'resume' });
document.querySelector('#change-background').onclick = () => dispatch({ type: 'background', color: document.querySelector('#background-color').value });
document.querySelector('#sound').onchange = (event) => dispatch({ type: 'sound', value: event.target.checked });
document.querySelector('#arena').onclick = () => fighters.forEach(fighter => {
  const action = fighter.querySelector('.action');
  const video = action.getAttribute('src') ? action : fighter.querySelector('.loop');
  if (video.getAttribute('src')) play(video);
});
refresh().then(() => channel.postMessage({ type: 'hello' })).catch(report);
