"use strict";

const META = 500;
const PONTOS_POR_PISO = 15;
const TEMPO_QUEDA = 220;
const TEMPO_VITORIA = 2600;

const PRESENTES = Object.freeze({
  5655: { lado: "lula", nome: "Rose", blocos: 15 },
  6560: { lado: "lula", nome: "Tiny Diny", blocos: 50 },
  544015: { lado: "lula", nome: "Heart My Earthling", blocos: 500 },
  6064: { lado: "flavio", nome: "GG", blocos: 15 },
  5327: { lado: "flavio", nome: "Heart", blocos: 50 },
  5585: { lado: "flavio", nome: "Confetti", blocos: 500 },
  "Money Gun": { lado: "flavio", nome: "Pistola de Dinheiro", blocos: 2500, aliases: ["Money Gun", "Pistola de Dinheiro"] },
  "You're Amazing": { lado: "lula", nome: "Você é Demais", blocos: 2500, aliases: ["You're Amazing", "You are Amazing", "Você é Demais"] },
  "Accelerator Crown": { lado: "lula", nome: "Coroa do Acelerador", blocos: 6000, aliases: ["Accelerator Crown", "Coroa do Acelerador"] },
  "Galaxy": { lado: "flavio", nome: "Galáxia", blocos: 6000, aliases: ["Galaxy", "Galáxia"] }
});

const state = {
  lula: { pontos: 0, vitorias: 0 },
  flavio: { pontos: 0, vitorias: 0 }
};

const el = {
  torres: {
    lula: document.getElementById("torre-lula"),
    flavio: document.getElementById("torre-flavio")
  },
  numeros: {
    lula: document.getElementById("numero-lula"),
    flavio: document.getElementById("numero-flavio")
  },
  infos: {
    lula: document.getElementById("info-lula"),
    flavio: document.getElementById("info-flavio")
  },
  placar: {
    lula: document.getElementById("score-lula"),
    flavio: document.getElementById("score-flavio")
  },
  feed: document.getElementById("feed-eventos"),
  overlay: document.getElementById("overlay-vitoria"),
  titulo: document.getElementById("titulo-vitoria"),
  texto: document.getElementById("texto-vitoria")
};

const fila = [];
let processando = false;
let finalizando = false;

function atualizarHUD() {
  for (const lado of ["lula", "flavio"]) {
    el.numeros[lado].textContent = state[lado].pontos;
    // Contadores fixos no alto, como na referência.
    el.numeros[lado].style.bottom = "auto";
    el.infos[lado].textContent = `TORRE: ${state[lado].pontos}/${META}`;
    el.placar[lado].textContent = state[lado].vitorias;
    const torre = el.torres[lado];
    torre.parentElement.style.setProperty('--altura-torre', 'calc(' + torre.children.length + ' * var(--altura-piso))');
    const simbolo = document.getElementById(lado === 'lula' ? 'estrela-lula' : 'bandeira-flavio');
    if (simbolo) simbolo.style.clipPath = state[lado].pontos ? 'inset(0 0 0 0)' : 'inset(100% 0 0 0)';
  }
}

function adicionarEvento(mensagem) {
  if (!el.feed) return;
  const item = document.createElement("div");
  item.className = "evento";
  item.textContent = mensagem;
  el.feed.prepend(item);
  while (el.feed.children.length > 6) el.feed.lastElementChild.remove();
}

function esperar(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Um piso visual representa 15 pontos; o contador mantém o valor exato.
let medidasArena;
function medirArena() {
  medidasArena = {
    piso: Math.max(10, Math.min(20, document.getElementById('game').clientWidth * .04)),
    altura: el.torres.lula.parentElement.clientHeight
  };
}
function alturaPiso() {
  if (!medidasArena) medirArena();
  return medidasArena.piso;
}

function atualizarCamera(quantidade = 0, lado) {
  const game = document.getElementById('game');
  const altura = Math.max(
    el.torres.lula.children.length + (lado === 'lula' ? quantidade : 0),
    el.torres.flavio.children.length + (lado === 'flavio' ? quantidade : 0)
  ) * alturaPiso();
  const deslocamento = Math.max(0, altura - medidasArena.altura * .58);
  game.style.setProperty('--camera-y', deslocamento + 'px');
}

function criarBloco(lado, numero, valor) {
  const torre = el.torres[lado];
  const fileira = torre.children.length;
  const faixa = document.createElement('div');
  faixa.className = 'faixa';
  if (lado === 'flavio') faixa.classList.add('verde');
  faixa.style.bottom = 'calc(' + fileira + ' * var(--altura-piso))';
  faixa.style.setProperty('--desvio', Math.sin(fileira * 7.3) * 4 + 'px');
  faixa.style.width = '100%';
  faixa.title = '+' + valor + ' blocos';
  torre.appendChild(faixa);
}

async function animarQueda(lado, quantidade = 1, aoPousar) {
  const base = el.torres[lado].parentElement;
  const fileira = el.torres[lado].children.length;
  const altura = alturaPiso();
  const alturaBase = medidasArena.altura;
  const intervalo = Math.max(2, Math.min(12, 700 / quantidade));
  const inicio = performance.now();
  const caindo = [];
  let lancados = 0;
  let pousados = 0;
  let ultimoEfeito = -Infinity;
  await new Promise((resolve, reject) => {
    const frame = agora => {
      try {
        const alvo = Math.min(quantidade, Math.floor((agora - inicio) / intervalo) + 1);
        const camera = parseFloat(document.getElementById('game').style.getPropertyValue('--camera-y')) || 0;
        const fragmento = document.createDocumentFragment();
        for (let limite = 0; lancados < alvo && limite < 24; limite++) {
          const bloco = document.createElement('div');
          bloco.className = 'bloco-caindo bloco-' + lado;
          bloco.style.bottom = 'calc(' + (fileira + lancados) + ' * var(--altura-piso))';
          bloco.style.setProperty('--queda', -Math.max(80, alturaBase - (fileira + lancados) * altura + camera) + 'px');
          fragmento.appendChild(bloco);
          caindo.push({ bloco, pouso: agora + TEMPO_QUEDA });
          lancados++;
        }
        if (fragmento.childNodes.length) base.appendChild(fragmento);
        let mudou = false;
        while (pousados < caindo.length && caindo[pousados].pouso <= agora) {
          caindo[pousados].bloco.remove();
          aoPousar();
          pousados++;
          mudou = true;
        }
        if (mudou) {
          atualizarCamera();
          atualizarHUD();
          if (agora - ultimoEfeito >= 120) {
            ultimoEfeito = agora;
            reproduzirSomBloco(lado);
            const particula = document.createElement('i');
            particula.className = 'particula particula-' + lado;
            particula.style.bottom = 'calc(' + (fileira + pousados - 1) + ' * var(--altura-piso))';
            particula.style.setProperty('--dx', (Math.random() - .5) * 80 + 'px');
            particula.style.setProperty('--dy', '-35px');
            base.appendChild(particula);
            setTimeout(() => particula.remove(), 550);
          }
        }
        if (pousados === quantidade) resolve();
        else requestAnimationFrame(frame);
      } catch (erro) {
        for (const item of caindo) item.bloco.remove();
        reject(erro);
      }
    };
    requestAnimationFrame(frame);
  });
}

function celebrarVitoria(lado) {
  const game = document.getElementById('game');
  game.classList.add('celebrando');
  for (let i = 0; i < 70; i++) {
    const confete = document.createElement('i');
    confete.className = 'confete';
    confete.style.left = `${Math.random() * 100}%`;
    confete.style.background = ['#ffdf38', '#ffffff', lado === 'lula' ? '#ff3347' : '#20ed69'][i % 3];
    confete.style.animationDelay = `${Math.random() * .7}s`;
    game.appendChild(confete);
    setTimeout(() => confete.remove(), 2500);
  }
  setTimeout(() => game.classList.remove('celebrando'), TEMPO_VITORIA);
}

const SONS = {
  lula: new Audio("assets/som-lula.wav"),
  flavio: new Audio("assets/som-flavio.wav"),
  vitoria_lula: new Audio("assets/vitorialula (2).mp3"),
  vitoria_flavio: new Audio("assets/vitoriaflavio.mp3")
};
Object.values(SONS).forEach(audio => {
  audio.volume = 0.32;
  audio.preload = "auto";
});
let audioLiberado = false;
const canaisImpacto = Object.fromEntries(['lula', 'flavio'].map(lado => [lado,
  Array.from({ length: 3 }, () => {
    const audio = SONS[lado].cloneNode();
    audio.volume = 0.24;
    audio.preload = 'auto';
    return { audio, ocupado: false, token: 0 };
  })
]));
let ultimoSomImpacto = -Infinity;
function liberarAudio() {
  audioLiberado = true;
  const botao = document.getElementById("ativar-audio");
  if (botao) botao.remove();
}
const botaoAudio = document.getElementById("ativar-audio");
if (botaoAudio) botaoAudio.addEventListener("click", liberarAudio);
document.addEventListener("pointerdown", liberarAudio, { once: true });
document.addEventListener("keydown", liberarAudio, { once: true });
function reproduzirSomBloco(lado) {
  if (!audioLiberado || finalizando) return;
  const agora = performance.now();
  if (agora - ultimoSomImpacto < 120) return;
  const canal = canaisImpacto[lado]?.find(item => !item.ocupado);
  if (!canal) return;
  ultimoSomImpacto = agora;
  canal.ocupado = true;
  const token = canal.token = (canal.token || 0) + 1;
  canal.audio.currentTime = 0;
  const liberar = () => { if (canal.token === token) canal.ocupado = false; };
  canal.audio.onended = liberar;
  canal.audio.onerror = liberar;
  canal.audio.play().catch(liberar);
}

function pararSonsImpacto() {
  for (const canais of Object.values(canaisImpacto)) {
    for (const canal of canais) {
      canal.audio.pause();
      canal.token = (canal.token || 0) + 1;
      canal.audio.currentTime = 0;
      canal.ocupado = false;
    }
  }
}

async function animarPresente({ lado, nome, blocos }) {
  adicionarEvento(`${lado.toUpperCase()} recebeu ${nome} (+${blocos})`);

  let restantes = blocos;
  try {
    while (restantes > 0) {
      const novos = Math.min(restantes, META - state[lado].pontos);
      const fim = state[lado].pontos + novos;
      const pisos = Math.floor(fim / PONTOS_POR_PISO) - Math.floor(state[lado].pontos / PONTOS_POR_PISO)
        + (fim === META && META % PONTOS_POR_PISO !== 0 ? 1 : 0);
      if (pisos > 0) {
        await animarQueda(lado, pisos, () => {
          const pontos = Math.min(PONTOS_POR_PISO - state[lado].pontos % PONTOS_POR_PISO, restantes, META - state[lado].pontos);
          criarBloco(lado, state[lado].pontos + pontos, Math.min(PONTOS_POR_PISO, META - Math.floor(state[lado].pontos / PONTOS_POR_PISO) * PONTOS_POR_PISO));
          state[lado].pontos += pontos;
          restantes -= pontos;
        });
      }
      // O saldo inferior a 15 soma pontos e completa o próximo piso.
      const saldo = Math.min(restantes, META - state[lado].pontos, PONTOS_POR_PISO - state[lado].pontos % PONTOS_POR_PISO - 1);
      if (saldo > 0) {
        state[lado].pontos += saldo;
        restantes -= saldo;
      }
      atualizarHUD();
      if (state[lado].pontos >= META) await encerrarRodada(lado);
    }
  } catch (erro) {
    const falha = erro instanceof Error ? erro : new Error(String(erro));
    falha.blocosRestantes = restantes;
    throw falha;
  }
}

async function encerrarRodada(vencedor) {
  finalizando = true;
  pararSonsImpacto();
  celebrarVitoria(vencedor);
  if (audioLiberado) {
    SONS.vitoria_lula.pause();
    SONS.vitoria_flavio.pause();
    const somVitoria = SONS[`vitoria_${vencedor}`];
    somVitoria.currentTime = 0;
    somVitoria.play().catch(() => {});
  }
  state[vencedor].vitorias++;
  atualizarHUD();
  el.overlay.classList.remove("hidden");
  el.overlay.dataset.vencedor = vencedor;
  el.titulo.textContent = "VITÓRIA!";
  el.texto.textContent = `${vencedor === "lula" ? "LULA" : "FLÁVIO"} venceu a rodada!`;
  adicionarEvento(`${vencedor.toUpperCase()} venceu a rodada!`);

  await esperar(TEMPO_VITORIA);
  state.lula.pontos = 0;
  state.flavio.pontos = 0;
  el.torres.lula.replaceChildren();
  el.torres.flavio.replaceChildren();
  for (const torre of Object.values(el.torres)) torre.parentElement.style.setProperty('--altura-torre', '0px');
  atualizarCamera();
  for (const id of ["estrela-lula", "bandeira-flavio"]) {
    const simbolo = document.getElementById(id);
    if (simbolo) simbolo.style.clipPath = "inset(100% 0 0 0)";
  }
  el.overlay.classList.add("hidden");
  delete el.overlay.dataset.vencedor;
  atualizarHUD();
  adicionarEvento("Nova rodada iniciada!");
  finalizando = false;
}

async function processarFila() {
  if (processando) return;
  processando = true;
  let falhou = false;
  try {
    while (fila.length > 0) {
      const evento = fila.shift();
      // Consumir o presente inteiro, incluindo o saldo após cada vitória.
      // Intercalar outro vencedor no meio descartaria a torre deste presente.
      try {
        if (evento.quantidade) mostrarEnvioPresente(evento.usuario, evento, evento.quantidade);
        await animarPresente(evento);
        ocultarEnvioPresente();
      } catch (erro) {
        const pendentes = erro.blocosRestantes ?? evento.blocos;
        if (pendentes > 0) fila.unshift({ ...evento, blocos: pendentes });
        falhou = true;
        console.error('[BLOCOS] Falha na animação. Ações pendentes preservadas; o próximo evento retoma a fila.', erro);
        break;
      }
    }
  } finally {
    processando = false;
    if (fila.length && !falhou) void processarFila();
  }
}

// Compatível com os botões do HTML atual.
function receberPresente(lado, presente, valor) {
  const permitido = Object.values(PRESENTES).find(
    p => p.lado === lado && p.nome.toLowerCase() === String(presente).toLowerCase()
  );
  if (!permitido || Number(valor) !== permitido.blocos) return false;
  fila.push({ ...permitido, quantidade:1, usuario:{nickname:'Teste'} });
  void processarFila();
  return true;
}

// Para integrar com o evento de presente do servidor futuramente:
// window.receberPresenteTikTok(5655) -> Rose do Lula, por exemplo.
function receberPresenteTikTok(giftId, quantidade = 1, nomeUsuario = 'Teste') {
  const presente = encontrarPresente({ giftId, giftName: giftId });
  if (!presente) return false;
  const total = Number(quantidade);
  if (!Number.isSafeInteger(total) || total < 1 || total > 1000) return false;
  fila.push({ ...presente, blocos:presente.blocos * total, quantidade:total, usuario:{nickname:nomeUsuario} });
  void processarFila();
  return true;
}

window.receberPresente = receberPresente;
window.receberPresenteTikTok = receberPresenteTikTok;

atualizarHUD();
adicionarEvento("Batalha dos Blocos carregada.");

// =====================================================
// INTEGRAÇÃO TIKTOK: seguir, curtir, comentar e presentes
// =====================================================
const SOCIAL = { curtidasPendentes: 0, follows: new Map(), presentes: new Map() };

function enfileirarBlocos(lado, nome, blocos) {
  if (!['lula', 'flavio'].includes(lado) || !Number.isSafeInteger(blocos) || blocos <= 0) return false;
  fila.push({ lado, nome, blocos });
  void processarFila();
  return true;
}

function registrarSeguidor(usuario) {
  const id = String(usuario?.uniqueId || usuario?.userId || "").trim().toLowerCase();
  // Um follow da mesma conta conta uma vez por sessão do navegador.
  if (!id || id === '0' || SOCIAL.follows.has(id)) return false;
  SOCIAL.follows.set(id, Date.now());
  return enfileirarBlocos("flavio", `Novo seguidor: ${id}`, 200);
}

function registrarCurtidas(quantidade) {
  // normalizeLike(data).likeCount é a quantidade deste evento, não o total da LIVE.
  const n = Number(quantidade);
  if (!Number.isSafeInteger(n) || n < 1 || n > 100000) return false;
  SOCIAL.curtidasPendentes += n;
  const pacotes = Math.floor(SOCIAL.curtidasPendentes / 200);
  SOCIAL.curtidasPendentes %= 200;
  // Cada pacote de 200 curtidas vale 100 blocos para Lula.
  for (let i = 0; i < pacotes; i++) {
    enfileirarBlocos("lula", "200 curtidas", 100);
  }
  return true;
}

function registrarComentario(comentario) {
  const texto = String(comentario ?? "").trim();
  if (texto === "13") return enfileirarBlocos("lula", "Comentário 13", 5);
  if (texto === "22") return enfileirarBlocos("flavio", "Comentário 22", 5);
  return false;
}

function encontrarPresente(payload) {
  const porId = PRESENTES[Number(payload?.giftId)];
  if (porId) return porId;
  const normalizar = nome => String(nome ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/’/g, "'").trim().toLowerCase();
  const nome = normalizar(payload?.giftName);
  return Object.values(PRESENTES).find(p => [p.nome, ...(p.aliases || [])].some(alias => normalizar(alias) === nome));
}

function mostrarEnvioPresente(usuario, presente, quantidade) {
  if (typeof document === 'undefined') return;
  const aviso = document.getElementById('aviso-presente');
  if (!aviso) return;
  const icones = {
    'Rose':'rose.webp', 'GG':'gg.webp', 'Tiny Diny':'tiny-diny.webp',
    'Heart':'heart.webp', 'Heart My Earthling':'heart-my-earthling.webp',
    'Confetti':'confetti.webp', 'Você é Demais':'voceedemais.webp',
    'Pistola de Dinheiro':'pistoladinheiro.webp', 'Coroa do Acelerador':'coroa.webp', 'Galáxia':'galaxia.webp'
  };
  const nome = String(usuario?.nickname || usuario?.uniqueId || 'Alguém').trim() || 'Alguém';
  const descricao = presente.nome === 'Rose' ? (quantidade === 1 ? 'rosa' : 'rosas') : `× ${presente.nome}`;
  const texto = `${nome} mandou ${quantidade} ${descricao}`;
  document.getElementById('aviso-presente-texto').textContent = texto;
  document.getElementById('aviso-presente-quantidade').textContent = `×${quantidade}`;
  const icone = document.getElementById('aviso-presente-icone');
  icone.src = '../duelo-2d/icones/' + icones[presente.nome];
  icone.alt = presente.nome;
  aviso.title = texto;
  aviso.hidden = false;
}

function ocultarEnvioPresente() {
  if (typeof document === 'undefined') return;
  const aviso = document.getElementById('aviso-presente');
  if (aviso) aviso.hidden = true;
}

function registrarPresenteReal(payload) {
  const id = Number(payload?.giftId);
  const presente = encontrarPresente(payload);
  if (!presente) return false;
  // Presentes de sequência: aguardar fim da sequência para não contar cumulativos.
  const tipo = Number(payload?.rawGiftType ?? payload?.giftType);
  const fim = [true, 1, "1", "true"].includes(payload?.repeatEnd);
  const emAndamento = [false, 0, "0", "false"].includes(payload?.repeatEnd);
  const emSequencia = tipo === 1 || (!Number.isFinite(tipo) && (emAndamento || fim));
  if (emSequencia && !fim) return false;
  const qtd = Number(payload?.repeatCount ?? 1);
  if (!Number.isSafeInteger(qtd) || qtd < 1 || qtd > 1000) return false;
  const usuario = payload?.user;
  const remetente = usuario?.uniqueId || usuario?.userId || usuario?.displayId || usuario?.idStr || usuario?.id;
  const grupo = payload?.groupId;
  const eventId = payload?.eventId ?? payload?.msgId ?? payload?.common?.msgId;
  // O fim da mesma sequência pode chegar em mensagens com IDs diferentes.
  const temGrupo = grupo != null && String(grupo) !== "" && String(grupo) !== "0";
  const key = emSequencia && temGrupo && remetente
    ? `grupo:${remetente}:${presente.nome || id}:${grupo}`
    : eventId != null && String(eventId) !== "0" && String(eventId) !== ""
      ? `evento:${eventId}`
      : null;
  if (key !== null) {
    if (SOCIAL.presentes.has(key)) return false;
    SOCIAL.presentes.set(key, Date.now());
  }
  fila.push({ ...presente, blocos:presente.blocos * qtd, quantidade:qtd, usuario });
  void processarFila();
  return true;
}

// Iniciar com ?usuario=nome_da_conta na URL.
function conectarLive() {
  const params = new URLSearchParams(location.search);
  const usuario = ["usuario", "username", "id"]
    .map(param => params.get(param)?.trim().replace(/^@/, "").toLowerCase())
    .find(Boolean);
  if (!usuario) {
    console.info("[BLOCOS] Para conectar à LIVE, abra a URL com ?username=seu_perfil (também aceita usuario ou id)");
    return;
  }
  if (typeof window.io !== "function") {
    console.warn("[BLOCOS] Socket.IO indisponível. Inclua /socket.io/socket.io.js antes de game.js");
    return;
  }
  const socket = window.io();
  socket.on("connect", () => socket.emit("join-room", usuario));
  socket.on("room-joined", () => console.log(`[BLOCOS] Conectado à sala ${usuario}`));
  socket.on("connection-error", erro => console.warn("[BLOCOS] LIVE:", erro?.message));
  socket.on("tiktok_follow", data => registrarSeguidor(data?.user));
  socket.on("tiktok_like", data => registrarCurtidas(data?.likeCount));
  socket.on("tiktok_chat", data => registrarComentario(data?.comment));
  socket.on("tiktok_gift", registrarPresenteReal);
  window.socketBatalha = socket;
}

// Testes locais (mesma lógica usada na LIVE).
window.testeSeguir = (usuario = "teste_usuario") => registrarSeguidor({ uniqueId: usuario });
window.testeCurtidas = quantidade => registrarCurtidas(quantidade);
window.testeComentario = texto => registrarComentario(texto);
window.testeBlocos = (lado, quantidade = 100) => enfileirarBlocos(lado, 'Simulação', quantidade);
window.addEventListener('resize', () => { medirArena(); atualizarCamera(); });

if (new URLSearchParams(location.search).get("teste") === "1") {
  document.body.classList.add("modo-teste");
} else {
  conectarLive();
}
