import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { normalizeUser } from "../src/lib/tiktokEventNormalizer.js";

test("conexão aceita username, usuario e id e entra na sala correta", () => {
  const source = fs.readFileSync(new URL("../public/games/batalha-blocos/game.js", import.meta.url), "utf8");
  const connectionSource = source.slice(source.indexOf("function conectarLive()"), source.indexOf("// Testes locais"));
  for (const search of ["?username=anny.fofinha4", "?usuario=anny.fofinha4", "?id=anny.fofinha4", "?usuario=&username=%40Anny.Fofinha4"]) {
    const handlers = {};
    const emitted = [];
    const socket = { on(event, handler) { handlers[event] = handler; }, emit(...args) { emitted.push(args); } };
    const context = vm.createContext({
      location: { search }, URLSearchParams, console,
      window: { io: () => socket },
      registrarSeguidor() {}, registrarCurtidas() {}, registrarComentario() {}, registrarPresenteReal() {},
    });
    vm.runInContext(connectionSource + "\nconectarLive();", context);
    assert.equal(typeof handlers.connect, "function");
    handlers.connect();
    assert.deepEqual(emitted, [["join-room", "anny.fofinha4"]]);
  }
});

function jogo() {
  const source = fs.readFileSync(new URL("../public/games/batalha-blocos/game.js", import.meta.url), "utf8");
  const config = source.slice(source.indexOf("const META ="), source.indexOf("const state ="));
  const inicio = source.indexOf("const SOCIAL =");
  const fim = source.indexOf("// Iniciar com ?usuario=");
  const eventos = [];
  const context = vm.createContext({
    Date, state: { lula: {}, flavio: {} },
    fila: { push: evento => eventos.push(evento) }, processarFila() {},
    receberPresenteTikTok(id, quantidade) { eventos.push({ id, quantidade }); return true; }
  });
  vm.runInContext(config + source.slice(inicio, fim), context);
  return { context, eventos };
}

test("seguidor do conector atual recebe 300 blocos uma vez", () => {
  const { context, eventos } = jogo();
  const user = normalizeUser({ user: { displayId: "visitante", idStr: "123" } });
  assert.equal(context.registrarSeguidor(user), true);
  assert.equal(context.registrarSeguidor(user), false);
  assert.equal(eventos.length, 1);
  assert.equal(eventos[0].lado, "flavio");
  assert.equal(eventos[0].blocos, 300);
  assert.equal(normalizeUser({ user: { idStr: "456" } }).uniqueId, "456");
});

test("curtidas acumulam pacotes de 200 que valem 100 blocos", () => {
  const { context, eventos } = jogo();
  assert.equal(context.registrarCurtidas(150), true);
  assert.equal(eventos.length, 0);
  assert.equal(context.registrarCurtidas(100), true);
  assert.equal(eventos.length, 1);
  assert.equal(eventos[0].lado, "lula");
  assert.equal(eventos[0].blocos, 100);
  assert.equal(context.registrarCurtidas(350), true);
  assert.equal(eventos.length, 3);
  assert.ok(eventos.every(evento => evento.blocos === 100));
});

test("sequência conta só no fim e ignora outro ID para o mesmo grupo", () => {
  const { context, eventos } = jogo();
  const gift = { giftId: 5655, rawGiftType: 1, user: { uniqueId: "a" }, groupId: "10", repeatCount: 3 };
  assert.equal(context.registrarPresenteReal({ ...gift, repeatEnd: 0, eventId: "1" }), false);
  assert.equal(context.registrarPresenteReal({ ...gift, repeatEnd: "1", eventId: "2" }), true);
  assert.equal(context.registrarPresenteReal({ ...gift, repeatEnd: true, eventId: "3" }), false);
  assert.equal(eventos.length, 3);
  assert.equal(eventos[0].blocos, 15);
  assert.equal(context.registrarPresenteReal({ ...gift, groupId: "11", repeatEnd: true }), true);
  assert.equal(context.registrarPresenteReal({ ...gift, user: { uniqueId: "b" }, repeatEnd: true }), true);
});

test("valores finais e presentes premium reconhecidos pelo nome", () => {
  const { context, eventos } = jogo();
  for (const [giftId, blocos] of [[5655, 15], [6064, 15], [6560, 50], [5327, 50], [544015, 200], [5585, 200]]) {
    assert.equal(context.encontrarPresente({ giftId }).blocos, blocos);
  }
  for (const [giftName, lado, blocos] of [["Money Gun", "flavio", 1000], ["You’re Amazing", "lula", 1000], ["Accelerator Crown", "lula", 6000], ["Galaxy", "flavio", 6000]]) {
    assert.equal(context.registrarPresenteReal({ giftId: 99999, giftName, repeatCount: 1, eventId: giftName }), true);
    assert.equal(eventos.at(-1).lado, lado);
    assert.equal(eventos.at(-1).blocos, blocos);
  }
  assert.equal(context.registrarPresenteReal({ giftName: "You're Awesome" }), false);
});

test("meta de 1000 preserva excedente do presente após vitória", async () => {
  const source = fs.readFileSync(new URL("../public/games/batalha-blocos/game.js", import.meta.url), "utf8");
  const state = { flavio: { pontos: 950 } };
  let vitorias = 0;
  const meta = Number(source.match(/const META = (\d+);/)[1]);
  assert.equal(meta, 1000);
  const context = vm.createContext({ META: meta, TEMPO_BLOCO: 65, state,
    adicionarEvento() {}, criarBloco() {}, atualizarHUD() {}, esperar: async () => {},
    encerrarRodada: async lado => { vitorias++; state[lado].pontos = 0; }
  });
  vm.runInContext(source.slice(source.indexOf("async function animarPresente"), source.indexOf("async function encerrarRodada")), context);
  await context.animarPresente({ lado: "flavio", nome: "Galáxia", blocos: 6000 });
  assert.equal(vitorias, 6);
  assert.equal(state.flavio.pontos, 950);
});

test("presente sem grupo usa ID da mensagem sem bloquear outros presentes", () => {
  const { context, eventos } = jogo();
  const gift = { giftId: 5655, rawGiftType: 0, groupId: "0", repeatCount: 1 };
  assert.equal(context.registrarPresenteReal({ ...gift, eventId: "100" }), true);
  assert.equal(context.registrarPresenteReal({ ...gift, eventId: "100" }), false);
  assert.equal(context.registrarPresenteReal({ ...gift, eventId: "101" }), true);
  assert.equal(eventos.length, 2);
});

function simulacaoLive() {
  const source = fs.readFileSync(new URL('../public/games/batalha-blocos/game.js', import.meta.url), 'utf8');
  const handlers = {};
  const state = { lula: { pontos: 0, vitorias: 0 }, flavio: { pontos: 0, vitorias: 0 } };
  const context = vm.createContext({
    state, Date, URLSearchParams, console,
    location: { search: '?username=teste_local' },
    window: { io: () => ({ on(event, fn) { handlers[event] = fn; }, emit() {} }) },
    adicionarEvento() {}, criarBloco() {}, atualizarHUD() {}, esperar: async () => {},
    encerrarRodada: async lado => {
      state[lado].vitorias++;
      state.lula.pontos = state.flavio.pontos = 0;
    }
  });
  const trechos = [
    source.slice(source.indexOf('const META ='), source.indexOf('const state =')),
    'const fila = []; let processando = false;',
    source.slice(source.indexOf('async function animarPresente'), source.indexOf('async function encerrarRodada')),
    source.slice(source.indexOf('async function processarFila'), source.indexOf('// Compatível')),
    source.slice(source.indexOf('const SOCIAL ='), source.indexOf('// Testes locais')),
    'conectarLive();'
  ];
  vm.runInContext(trechos.join('\n'), context);
  return { state, handlers, async concluir() {
    for (let i = 0; i < 10000; i++) {
      if (!vm.runInContext('processando || fila.length > 0', context)) return;
      await Promise.resolve();
    }
    assert.fail('A fila de eventos não terminou');
  } };
}

test('eventos Socket.IO processam todos os presentes até os pontos e vitórias', async () => {
  const casos = [
    [{ giftId: 5655 }, 'lula', 15], [{ giftId: 6064 }, 'flavio', 15],
    [{ giftId: 6560 }, 'lula', 50], [{ giftId: 5327 }, 'flavio', 50],
    [{ giftId: 544015 }, 'lula', 200], [{ giftId: 5585 }, 'flavio', 200],
    [{ giftName: "You're Amazing" }, 'lula', 1000], [{ giftName: 'Money Gun' }, 'flavio', 1000],
    [{ giftName: 'Accelerator Crown' }, 'lula', 6000], [{ giftName: 'Galaxy' }, 'flavio', 6000]
  ];
  for (const [payload, lado, total] of casos) {
    const sim = simulacaoLive();
    sim.handlers.tiktok_gift({ ...payload, repeatCount: 1, eventId: 'unico' });
    await sim.concluir();
    assert.equal(sim.state[lado].pontos, total % 1000);
    assert.equal(sim.state[lado].vitorias, Math.floor(total / 1000));
  }
});

test('eventos Socket.IO somam curtidas e seguidores sem repetir a mesma conta', async () => {
  const sim = simulacaoLive();
  for (const likeCount of [199, 1, 450, 150]) sim.handlers.tiktok_like({ likeCount });
  sim.handlers.tiktok_follow({ user: normalizeUser({ user: { displayId: 'visitante', idStr: '1' } }) });
  sim.handlers.tiktok_follow({ user: { uniqueId: 'VISITANTE' } });
  sim.handlers.tiktok_follow({ user: { uniqueId: 'outro' } });
  sim.handlers.tiktok_follow({});
  await sim.concluir();
  assert.equal(sim.state.lula.pontos, 400);
  assert.equal(sim.state.flavio.pontos, 600);
});

test('eventos inválidos não concedem blocos', async () => {
  const sim = simulacaoLive();
  for (const likeCount of [0, -1, 1.5, 'texto', Infinity, 100001]) sim.handlers.tiktok_like({ likeCount });
  for (const repeatCount of [0, -1, 1.5, 1001]) sim.handlers.tiktok_gift({ giftId: 5655, repeatCount });
  sim.handlers.tiktok_gift({ giftId: 999999, repeatCount: 1 });
  sim.handlers.tiktok_follow({ user: {} });
  await sim.concluir();
  assert.equal(sim.state.lula.pontos, 0);
  assert.equal(sim.state.flavio.pontos, 0);
});
