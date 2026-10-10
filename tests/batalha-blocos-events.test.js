import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { normalizeUser } from "../src/lib/tiktokEventNormalizer.js";

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

test("seguidor do conector atual recebe 20 blocos uma vez", () => {
  const { context, eventos } = jogo();
  const user = normalizeUser({ user: { displayId: "visitante", idStr: "123" } });
  assert.equal(context.registrarSeguidor(user), true);
  assert.equal(context.registrarSeguidor(user), false);
  assert.equal(eventos.length, 1);
  assert.equal(eventos[0].lado, "flavio");
  assert.equal(eventos[0].blocos, 20);
  assert.equal(normalizeUser({ user: { idStr: "456" } }).uniqueId, "456");
});

test("sequência conta só no fim e ignora outro ID para o mesmo grupo", () => {
  const { context, eventos } = jogo();
  const gift = { giftId: 5655, rawGiftType: 1, user: { uniqueId: "a" }, groupId: "10", repeatCount: 3 };
  assert.equal(context.registrarPresenteReal({ ...gift, repeatEnd: 0, eventId: "1" }), false);
  assert.equal(context.registrarPresenteReal({ ...gift, repeatEnd: "1", eventId: "2" }), true);
  assert.equal(context.registrarPresenteReal({ ...gift, repeatEnd: true, eventId: "3" }), false);
  assert.equal(eventos.length, 3);
  assert.equal(eventos[0].blocos, 5);
  assert.equal(context.registrarPresenteReal({ ...gift, groupId: "11", repeatEnd: true }), true);
  assert.equal(context.registrarPresenteReal({ ...gift, user: { uniqueId: "b" }, repeatEnd: true }), true);
});

test("valores finais e presentes premium reconhecidos pelo nome", () => {
  const { context, eventos } = jogo();
  for (const [giftId, blocos] of [[6560, 25], [5327, 25], [544015, 100], [5585, 100]]) {
    assert.equal(context.encontrarPresente({ giftId }).blocos, blocos);
  }
  for (const [giftName, lado, blocos] of [["Money Gun", "flavio", 600], ["You’re Amazing", "lula", 600], ["Accelerator Crown", "lula", 1200], ["Galaxy", "flavio", 1200]]) {
    assert.equal(context.registrarPresenteReal({ giftId: 99999, giftName, repeatCount: 1, eventId: giftName }), true);
    assert.equal(eventos.at(-1).lado, lado);
    assert.equal(eventos.at(-1).blocos, blocos);
  }
  assert.equal(context.registrarPresenteReal({ giftName: "You're Awesome" }), false);
});

test("presente de 1200 preserva excedente após vitória", async () => {
  const source = fs.readFileSync(new URL("../public/games/batalha-blocos/game.js", import.meta.url), "utf8");
  const state = { flavio: { pontos: 150 } };
  let vitorias = 0;
  const meta = Number(source.match(/const META = (\d+);/)[1]);
  assert.equal(meta, 200);
  const context = vm.createContext({ META: meta, TEMPO_BLOCO: 65, state,
    adicionarEvento() {}, criarBloco() {}, atualizarHUD() {}, esperar: async () => {},
    encerrarRodada: async lado => { vitorias++; state[lado].pontos = 0; }
  });
  vm.runInContext(source.slice(source.indexOf("async function animarPresente"), source.indexOf("async function encerrarRodada")), context);
  await context.animarPresente({ lado: "flavio", nome: "Galáxia", blocos: 1200 });
  assert.equal(vitorias, 6);
  assert.equal(state.flavio.pontos, 150);
});

test("presente sem grupo usa ID da mensagem sem bloquear outros presentes", () => {
  const { context, eventos } = jogo();
  const gift = { giftId: 5655, rawGiftType: 0, groupId: "0", repeatCount: 1 };
  assert.equal(context.registrarPresenteReal({ ...gift, eventId: "100" }), true);
  assert.equal(context.registrarPresenteReal({ ...gift, eventId: "100" }), false);
  assert.equal(context.registrarPresenteReal({ ...gift, eventId: "101" }), true);
  assert.equal(eventos.length, 2);
});
