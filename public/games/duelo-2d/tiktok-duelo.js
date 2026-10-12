
// ========================================
// DUELO DA LIVE — PRESENTES DO TIKTOK
// ========================================

const urlParams = new URLSearchParams(window.location.search);
const TIKTOK_USERNAME = urlParams.get("id") || urlParams.get("username") || "anny.fofinha4";
// Mantém os mesmos seis presentes e golpes.
const PRESENTES_DUELO = {
  5655: {
    name: "lula",
    type: "soco",
    presente: "Rose"
  },
  6560: {
    name: "lula",
    type: "combo",
    presente: "Tiny Diny"
  },
  5585: {
    name: "lula",
    type: "especial",
    presente: "Confetti"
  },
  6064: {
    name: "bolsonaro",
    type: "soco",
    presente: "GG"
  },
  5327: {
    name: "bolsonaro",
    type: "combo",
    presente: "Heart"
  },
  544015: {
    name: "bolsonaro",
    type: "especial",
    presente: "Heart My Earthling"
  }
};

// ========================================
// IDENTIFICAÇÃO DOS PRESENTES
// ========================================

function normalizarNomePresente(nome) {
  return String(nome || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

const PRESENTES_POR_NOME = Object.create(null);

for (const presente of Object.values(PRESENTES_DUELO)) {
  PRESENTES_POR_NOME[
    normalizarNomePresente(presente.presente)
  ] = presente;
}

// ========================================
// CONTROLE DAS SEQUÊNCIAS
// ========================================

// Guarda a quantidade de presentes já convertida
// em golpes para evitar duplicações.
const sequencias = new Map();
const eventosRecebidos = new Map();

let ultimaLimpeza = 0;

function limparRegistrosAntigos() {
  const agora = Date.now();

  if (agora - ultimaLimpeza < 60000) return;

  ultimaLimpeza = agora;

  for (const [chave, estado] of sequencias) {
    if (agora - estado.atualizadoEm > 300000) {
      sequencias.delete(chave);
    }
  }

  for (const [chave, horario] of eventosRecebidos) {
    if (agora - horario > 300000) {
      eventosRecebidos.delete(chave);
    }
  }
}

// ========================================
// EXECUÇÃO DOS GOLPES
// ========================================

function executarGolpes(acao, quantidade) {
  if (quantidade <= 0) return;

  console.log(
    `[Duelo] ${acao.presente}: +${quantidade} ` +
    `${acao.type}(s) para ${acao.name}`
  );

  for (let i = 0; i < quantidade; i++) {
    attack(
      acao.name,
      acao.type,
      "presente-tiktok"
    );
  }
}

// ========================================
// RECEBER PRESENTES
// ========================================

function receberPresente(gift) {
  limparRegistrosAntigos();

  const id = Number(
    gift.giftId ??
    gift.id ??
    gift.gift?.id
  );

  const nome = normalizarNomePresente(
    gift.giftName ??
    gift.gift?.name
  );

  const acao =
    PRESENTES_DUELO[id] ??
    PRESENTES_POR_NOME[nome];

  if (!acao) {
    console.log(
      "[Duelo] Presente não configurado:",
      id,
      nome
    );
    return;
  }

  const quantidade = Number(
    gift.repeatCount ?? 1
  );

  // Proteção contra eventos inválidos.
  if (
    !Number.isSafeInteger(quantidade) ||
    quantidade < 1 ||
    quantidade > 10000
  ) {
    console.error(
      "[Duelo] Quantidade inválida ou excessiva:",
      gift
    );
    return;
  }

  const valorTipo =
    gift.rawGiftType ??
    gift.gift?.gift_type ??
    gift.giftType;

  const tipo =
    valorTipo != null &&
      Number.isFinite(Number(valorTipo))
      ? Number(valorTipo)
      : null;

  const terminou =
    gift.repeatEnd === true ||
    gift.repeatEnd === 1 ||
    gift.repeatEnd === "1";

  const emAndamento =
    gift.repeatEnd === false ||
    gift.repeatEnd === 0 ||
    gift.repeatEnd === "0";

  const usuario = String(
    gift.user?.uniqueId ||
    gift.user?.userId ||
    gift.uniqueId ||
    gift.userId ||
    gift.user?.nickname ||
    "desconhecido"
  );

  // groupId identifica uma sequência específica.
  const grupo =
    gift.groupId ??
    gift.gift?.group_id;

  const temGrupo =
    grupo !== undefined &&
    grupo !== null &&
    String(grupo) !== "";

  const chave = temGrupo
    ? `grupo:${usuario}:${id}:${grupo}`
    : `alternativa:${usuario}:${id}`;

  let estado = sequencias.get(chave);

  const ehSequencia =
    tipo === 1 ||
    (
      tipo === null &&
      (emAndamento || Boolean(estado))
    );

  // ========================================
  // PRESENTES EM SEQUÊNCIA
  // ========================================

  if (ehSequencia) {
    // Se não houver groupId, detecta quando
    // começa uma nova sequência.
    if (
      estado?.terminou &&
      !temGrupo &&
      emAndamento
    ) {
      sequencias.delete(chave);
      estado = undefined;
    }

    if (!estado) {
      estado = {
        contabilizados: 0,
        terminou: false,
        atualizadoEm: Date.now()
      };

      sequencias.set(chave, estado);
    }

    // Evita executar novamente o evento final.
    if (estado.terminou) {
      console.log(
        "[Duelo] Evento final repetido ignorado:",
        acao.presente
      );
      return;
    }

    // Ignora atualizações antigas.
    if (quantidade < estado.contabilizados) {
      console.warn(
        "[Duelo] Contagem fora de ordem:",
        quantidade
      );
      return;
    }

    // Executa somente os presentes NOVOS.
    const novos =
      quantidade - estado.contabilizados;

    estado.contabilizados = quantidade;
    estado.terminou = terminou;
    estado.atualizadoEm = Date.now();

    executarGolpes(acao, novos);

    return;
  }

  // ========================================
  // PRESENTES NÃO SEQUENCIAIS
  // ========================================

  const eventId =
    gift.eventId ??
    gift.msgId;

  if (
    eventId !== undefined &&
    eventId !== null
  ) {
    const chaveEvento =
      `${usuario}:${id}:${eventId}`;

    if (eventosRecebidos.has(chaveEvento)) {
      console.log(
        "[Duelo] Evento duplicado ignorado:",
        chaveEvento
      );
      return;
    }

    eventosRecebidos.set(
      chaveEvento,
      Date.now()
    );
  }

  executarGolpes(acao, quantidade);
}

// ========================================
// CONEXÃO COM O SERVIDOR
// ========================================

if (typeof io !== "function") {
  console.error(
    "[Duelo] Socket.IO não carregado!"
  );
} else if (window.__socketDueloIniciado) {
  console.warn(
    "[Duelo] Conexão duplicada evitada."
  );
} else {
  window.__socketDueloIniciado = true;

  const socketDuelo = io();

  socketDuelo.on("connect", () => {
    console.log(
      "[Duelo] Conectado ao servidor!"
    );

    socketDuelo.emit(
      "join-room",
      TIKTOK_USERNAME
    );
  });

  socketDuelo.on("room-joined", data => {
    console.log(
      "[Duelo] Sala:",
      data.room
    );
  });

  socketDuelo.on("tiktok_connected", () => {
    console.log(
      "[Duelo] LIVE conectada!"
    );
  });

  socketDuelo.on(
    "tiktok_gift",
    receberPresente
  );

  // ========================================
  // MECÂNICA GRATUITA (CURTIDAS E SEGUIDORES)
  // ========================================
  let acumuladorCurtidas = 0;
  const seguidoresRecebidos = new Set();

  // A cada 200 curtidas na live: Lula dá 1 soco
  socketDuelo.on("tiktok_like", data => {
    console.log("[Duelo] Evento de curtida recebido:", data);
    const qtd = Number(data?.likeCount ?? data?.like_count ?? data?.count ?? 1);
    if (!Number.isSafeInteger(qtd) || qtd <= 0) return;
    acumuladorCurtidas += qtd;
    console.log(`[Duelo] Progresso Curtidas: ${acumuladorCurtidas}/200 (+${qtd})`);

    while (acumuladorCurtidas >= 200) {
      acumuladorCurtidas -= 200;
      attack("lula", "soco", "curtidas-200");
      console.log("[Duelo] Meta de 200 Curtidas atingida -> Lula soco!");
    }
  });


  // Seguir a live: Flávio dá 1 soco
  socketDuelo.on("tiktok_follow", data => {
    const usuario = data?.user ?? data ?? {};
    const id = usuario.uniqueId || usuario.displayId || usuario.userId || usuario.idStr || usuario.id;
    const chave = id ? 'usuario:' + id : (data?.eventId || data?.msgId ? 'evento:' + (data.eventId ?? data.msgId) : null);
    if (chave && seguidoresRecebidos.has(chave)) return;
    if (chave) seguidoresRecebidos.add(chave);
    console.log(`[Duelo] Follow de ${data?.user?.nickname || "espectador"} -> Flávio soco!`);
    attack("bolsonaro", "soco", "seguidor");
  });

  // Compartilhar a live: Bolsonaro dá 1 soco
  socketDuelo.on("tiktok_share", data => {
    console.log(`[Duelo] Share de ${data?.user?.nickname || "espectador"} -> Flávio soco!`);
    attack("bolsonaro", "soco", "compartilhar");
  });


  socketDuelo.on("connection-error", erro => {
    console.warn(
      "[Duelo] LIVE indisponível:",
      erro?.message || erro
    );
  });

  socketDuelo.on("tiktok_error", erro => {
    console.warn(
      "[Duelo] TikTok:",
      erro?.message || erro
    );
  });

  socketDuelo.on("disconnect", () => {
    console.log(
      "[Duelo] Servidor desconectado."
    );
  });
}

console.log(
  "[Duelo] Mecânicas ativas: Presentes + (200 curtidas = Lula soco) + (seguir/compartilhar = Flávio soco)!"
);
