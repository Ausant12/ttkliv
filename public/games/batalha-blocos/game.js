"use strict";

const META = 1000;
const PISOS_POR_FAIXA = META / 40;
const TEMPO_VITORIA = 2600;
const TEMPO_BLOCO = 65;

const PRESENTES = Object.freeze({
  5655: { lado: "lula", nome: "Rose", blocos: 15 },
  6560: { lado: "lula", nome: "Tiny Diny", blocos: 50 },
  544015: { lado: "lula", nome: "Heart My Earthling", blocos: 200 },
  6064: { lado: "flavio", nome: "GG", blocos: 15 },
  5327: { lado: "flavio", nome: "Heart", blocos: 50 },
  5585: { lado: "flavio", nome: "Confetti", blocos: 200 },
  "Money Gun": { lado: "flavio", nome: "Pistola de Dinheiro", blocos: 1000, aliases: ["Money Gun", "Pistola de Dinheiro"] },
  "You're Amazing": { lado: "lula", nome: "Você é Demais", blocos: 1000, aliases: ["You're Amazing", "You are Amazing", "Você é Demais"] },
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

// Quarenta barras representam os 1.000 blocos sem sobrecarregar a tela.
function criarBloco(lado, numero) {
  const fileira = Math.floor((numero - 1) / PISOS_POR_FAIXA);
  const progresso = ((numero - 1) % PISOS_POR_FAIXA) + 1;
  const torre = el.torres[lado];
  let faixa = torre.children[fileira];
  if (!faixa) {
    faixa = document.createElement("div");
    faixa.className = "faixa";
    if (lado === "flavio") faixa.classList.add(fileira % 2 === 0 ? "verde" : "amarelo");
    faixa.style.bottom = `${fileira * 2.5}%`;
    faixa.style.setProperty('--desvio', `${Math.sin(fileira * 7.3) * 4}px`);
    torre.appendChild(faixa);
  }
  faixa.style.width = "100%";
  // Os símbolos aparecem de baixo para cima junto com a torre.
  const revelacao = document.getElementById(lado === "lula" ? "estrela-lula" : "bandeira-flavio");
  if (revelacao) revelacao.style.clipPath = `inset(${100 - (numero / META * 100)}% 0 0 0)`;
  animarQueda(lado, numero);
}

const ultimoImpacto = { lula: 0, flavio: 0 };
function animarQueda(lado, numero) {
  // Um efeito por lote evita centenas de sons e elementos simultâneos.
  const agora = performance.now();
  if (agora - ultimoImpacto[lado] < 60) return;
  ultimoImpacto[lado] = agora;
  const base = el.torres[lado].parentElement;
  const bloco = document.createElement('div');
  bloco.className = `bloco-caindo bloco-${lado}`;
  bloco.style.bottom = `${Math.floor((numero - 1) / PISOS_POR_FAIXA) * 2.5}%`;
  bloco.style.setProperty('--queda', `${-base.clientHeight}px`);
  base.appendChild(bloco);
  setTimeout(() => {
    bloco.remove();
    reproduzirSomBloco(lado);
    base.classList.remove('impacto');
    void base.offsetWidth;
    base.classList.add('impacto');
    for (let i = 0; i < 5; i++) {
      const particula = document.createElement('i');
      particula.className = `particula particula-${lado}`;
      particula.style.bottom = bloco.style.bottom;
      particula.style.setProperty('--dx', `${(Math.random() - .5) * 120}px`);
      particula.style.setProperty('--dy', `${-15 - Math.random() * 65}px`);
      base.appendChild(particula);
      setTimeout(() => particula.remove(), 550);
    }
  }, 320);
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
function liberarAudio() {
  audioLiberado = true;
  const botao = document.getElementById("ativar-audio");
  if (botao) botao.remove();
}
const botaoAudio = document.getElementById("ativar-audio");
if (botaoAudio) botaoAudio.addEventListener("click", () => {
  // Libera a reprodução automática no Chrome/Electron após um gesto do usuário.
  Object.values(SONS).forEach(audio => {
    audio.muted = true;
    audio.play().then(() => { audio.pause(); audio.currentTime = 0; audio.muted = false; }).catch(() => {});
  });
  liberarAudio();
});
document.addEventListener("pointerdown", liberarAudio, { once: true });
document.addEventListener("keydown", liberarAudio, { once: true });
function reproduzirSomBloco(lado) {
  if (!audioLiberado) return;
  const original = SONS[lado];
  if (!original) return;
  // Pequenos sons podem se sobrepor sem interromper o anterior.
  const audio = original.cloneNode();
  audio.volume = original.volume;
  audio.play().catch(() => {});
  audio.addEventListener("ended", () => { audio.src = ""; }, { once: true });
}

async function animarPresente({ lado, nome, blocos }) {
  adicionarEvento(`${lado.toUpperCase()} recebeu ${nome} (+${blocos})`);

  // Presentes grandes animam em lotes em até cerca de três segundos.
  const passo = Math.max(1, Math.ceil(blocos / 45));
  let restantes = blocos;
  while (restantes > 0) {
    const novos = Math.min(passo, restantes, META - state[lado].pontos);
    for (let i = 0; i < novos; i++) {
      state[lado].pontos++;
      criarBloco(lado, state[lado].pontos);
    }
    restantes -= novos;
    atualizarHUD();
    await esperar(TEMPO_BLOCO);
    if (state[lado].pontos >= META) await encerrarRodada(lado);
  }
}

async function encerrarRodada(vencedor) {
  finalizando = true;
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
  try {
    while (fila.length > 0) {
      const evento = fila.shift();
      await animarPresente(evento);
    }
  } finally {
    processando = false;
    if (fila.length) void processarFila();
  }
}

// Compatível com os botões do HTML atual.
function receberPresente(lado, presente, valor) {
  const permitido = Object.values(PRESENTES).find(
    p => p.lado === lado && p.nome.toLowerCase() === String(presente).toLowerCase()
  );
  if (!permitido || Number(valor) !== permitido.blocos) return false;
  fila.push({ ...permitido });
  void processarFila();
  return true;
}

// Para integrar com o evento de presente do servidor futuramente:
// window.receberPresenteTikTok(5655) -> Rose do Lula, por exemplo.
function receberPresenteTikTok(giftId, quantidade = 1) {
  const presente = encontrarPresente({ giftId, giftName: giftId });
  if (!presente) return false;
  const total = Math.max(1, Math.min(1000, Math.floor(Number(quantidade) || 1)));
  for (let i = 0; i < total; i++) fila.push({ ...presente });
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
const LIMITE_CACHES = 1000;

function enfileirarBlocos(lado, nome, blocos) {
  if (!state[lado] || !Number.isSafeInteger(blocos) || blocos <= 0) return false;
  fila.push({ lado, nome, blocos });
  void processarFila();
  return true;
}

function registrarSeguidor(usuario) {
  const id = String(usuario?.uniqueId || usuario?.userId || "").trim().toLowerCase();
  // Um follow da mesma conta conta uma vez por sessão do navegador.
  if (!id || SOCIAL.follows.has(id)) return false;
  SOCIAL.follows.set(id, Date.now());
  if (SOCIAL.follows.size > LIMITE_CACHES) {
    SOCIAL.follows.delete(SOCIAL.follows.keys().next().value);
  }
  return enfileirarBlocos("flavio", `Novo seguidor: ${id}`, 300);
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
  return Object.values(PRESENTES).find(p => p.aliases?.some(alias => normalizar(alias) === nome));
}

function registrarPresenteReal(payload) {
  const id = Number(payload?.giftId);
  const presente = encontrarPresente(payload);
  if (!presente) return false;
  // Presentes de sequência: aguardar fim da sequência para não contar cumulativos.
  const tipo = Number(payload?.rawGiftType ?? payload?.giftType);
  const fim = [true, 1, "1", "true"].includes(payload?.repeatEnd);
  const emSequencia = tipo === 1 || [false, 0, "0", "false"].includes(payload?.repeatEnd);
  if (emSequencia && !fim) return false;
  const qtd = Number(payload?.repeatCount ?? 1);
  if (!Number.isSafeInteger(qtd) || qtd < 1 || qtd > 1000) return false;
  const usuario = payload?.user;
  const remetente = usuario?.uniqueId || usuario?.userId || usuario?.displayId || usuario?.idStr || usuario?.id;
  const grupo = payload?.groupId;
  const eventId = payload?.eventId ?? payload?.msgId ?? payload?.common?.msgId;
  // O fim da mesma sequência pode chegar em mensagens com IDs diferentes.
  const temGrupo = grupo != null && String(grupo) !== "" && String(grupo) !== "0";
  const key = temGrupo && remetente
    ? `grupo:${remetente}:${presente.nome || id}:${grupo}`
    : eventId != null && String(eventId) !== "0" && String(eventId) !== ""
      ? `evento:${eventId}`
      : null;
  if (key !== null) {
    if (SOCIAL.presentes.has(key)) return false;
    SOCIAL.presentes.set(key, Date.now());
    if (SOCIAL.presentes.size > LIMITE_CACHES) {
      SOCIAL.presentes.delete(SOCIAL.presentes.keys().next().value);
    }
  }
  for (let i = 0; i < qtd; i++) fila.push({ ...presente });
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

if (new URLSearchParams(location.search).get("teste") === "1") {
  document.body.classList.add("modo-teste");
} else {
  conectarLive();
}
