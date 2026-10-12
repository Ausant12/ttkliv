import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { normalizeLike, normalizeUser } from '../src/lib/tiktokEventNormalizer.js';

function jogo() {
  const handlers = {};
  const queue = [];
  const context = vm.createContext({
    window: { location: { search: '?username=teste' } },
    URLSearchParams,
    console: { log() {}, warn() {}, error() {} },
    io: () => ({ on: (event, handler) => { handlers[event] = handler; }, emit() {} }),
    fighters: { lula: {}, bolsonaro: {} },
    attacks: { soco: {}, combo: {}, especial: {} },
    attackQueue: queue, round: 1, processQueue() {},
  });
  const engine = fs.readFileSync(new URL('../public/games/duelo-2d/game.js', import.meta.url), 'utf8');
  // Usa a função real que insere os golpes na fila do motor.
  vm.runInContext(engine.slice(engine.indexOf('function attack('), engine.indexOf('async function processQueue()')), context);
  vm.runInContext(fs.readFileSync(new URL('../public/games/duelo-2d/tiktok-duelo.js', import.meta.url), 'utf8'), context);
  return { handlers, queue };
}

test('199 curtidas aguardam; a curtida 200 coloca um soco do Lula na fila', () => {
  const { handlers, queue } = jogo();
  handlers.tiktok_like(normalizeLike({ likeCount: 199 }));
  assert.equal(queue.length, 0);
  handlers.tiktok_like(normalizeLike({ likeCount: 1 }));
  assert.equal(queue.length, 1);
  assert.equal(queue[0].name, 'lula');
  assert.equal(queue[0].type, 'soco');
});

test('lotes preservam o saldo e curtidas inválidas são ignoradas', () => {
  const { handlers, queue } = jogo();
  handlers.tiktok_like({ likeCount: 450 });
  assert.equal(queue.length, 2);
  handlers.tiktok_like({ likeCount: 150 });
  assert.equal(queue.length, 3);
  for (const likeCount of [0, -1, NaN, Infinity, 'invalido', 1.5]) handlers.tiktok_like({ likeCount });
  assert.equal(queue.length, 3);
});

test('seguidor normalizado gera um soco do Flávio; duplicado não gera outro', () => {
  const { handlers, queue } = jogo();
  const event = { user: normalizeUser({ user: { displayId: 'visitante', idStr: '123' } }) };
  handlers.tiktok_follow(event);
  handlers.tiktok_follow(event);
  assert.equal(queue.length, 1);
  assert.equal(queue[0].name, 'bolsonaro');
  assert.equal(queue[0].type, 'soco');
  handlers.tiktok_follow({ user: normalizeUser({ user: { idStr: '456' } }) });
  assert.equal(queue.length, 2);
});

test('curtidas e seguidores intercalados mantêm a ordem na fila', () => {
  const { handlers, queue } = jogo();
  handlers.tiktok_like({ likeCount: 200 });
  handlers.tiktok_follow({ user: { uniqueId: 'novo' } });
  handlers.tiktok_like({ likeCount: 200 });
  assert.deepEqual(queue.map(item => item.name), ['lula', 'bolsonaro', 'lula']);
});

test('presentes continuam gerando os golpes configurados', () => {
  const { handlers, queue } = jogo();
  for (const giftId of [5655, 6560, 5585, 6064, 5327, 544015]) {
    handlers.tiktok_gift({ giftId, repeatCount: 1, eventId: String(giftId) });
  }
  assert.equal(queue.length, 6);
  assert.deepEqual(queue.map(item => item.type), ['soco', 'combo', 'especial', 'soco', 'combo', 'especial']);
});
