import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../public/games/batalha-videos/game.js', import.meta.url), 'utf8');
function setup() {
  function element() {
    return {
      hidden: true, paused: true, ended: false, currentTime: 0, src: '',
      style: { setProperty() {} }, classList: { toggle() {} },
      play() { this.paused = false; return Promise.resolve(); },
      pause() { this.paused = true; }, load() { this.currentTime = 0; this.ended = false; },
      getAttribute(name) { return this[name] || null; },
      removeAttribute(name) { this[name] = ''; },
    };
  }
  const loop = element(); const action = element();
  const fighter = { querySelector: selector => selector === '.loop' ? loop : action };
  const elements = new Map();
  const context = vm.createContext({
    URLSearchParams, URL, console,
    location: { search: '' },
    localStorage: { getItem() { return null; }, setItem() {} },
    BroadcastChannel: class { postMessage() {} },
    // The playback tests do not open or mutate a real browser database.
    indexedDB: { open() { return {}; } },
    document: {
      body: element(),
      querySelectorAll: selector => selector === '.fighter' ? [fighter] : [loop, action],
      querySelector(selector) {
        if (!elements.has(selector)) elements.set(selector, element());
        return elements.get(selector);
      },
    },
  });
  vm.runInContext(source + '\n globalThis.api = { assets, playlist, startLoop, nextLoop, trigger, resume };', context);
  const api = context.api;
  for (const [id, order] of [['first', 0], ['second', 1], ['third', 2]]) {
    api.assets.set(id, { id, order, side: 0, kind: 'loop', name: id, url: `blob:${id}` });
  }
  return { api, loop, action };
}

test('plays the ordered sequence and returns to the first video', () => {
  const { api, loop } = setup();
  api.startLoop(0, 'first');
  assert.equal(loop.loop, false);
  for (const expected of ['second', 'third', 'first']) {
    loop.onended();
    assert.equal(loop.src, `blob:${expected}`);
    assert.equal(loop.paused, false);
  }
});

test('an action pauses the current video and resumes at the same position', () => {
  const { api, loop, action } = setup();
  api.assets.set('effect', { id: 'effect', side: 0, kind: 'action', name: 'effect', url: 'blob:effect' });
  api.startLoop(0, 'second');
  loop.currentTime = 12;
  api.trigger('effect');
  action.onplaying();
  assert.equal(loop.paused, true);
  assert.equal(action.hidden, false);
  action.onended();
  assert.equal(action.hidden, true);
  assert.equal(loop.src, 'blob:second');
  assert.equal(loop.currentTime, 12);
  assert.equal(loop.paused, false);
  loop.onended();
  assert.equal(loop.src, 'blob:third');
});

test('changing the order changes the next video without restarting the current one', () => {
  const { api, loop } = setup();
  api.startLoop(0, 'first');
  api.assets.get('third').order = 1;
  api.assets.get('second').order = 2;
  loop.onended();
  assert.equal(loop.src, 'blob:third');
});

test('one video repeats and the previous single-loop record remains usable', () => {
  const { api, loop } = setup();
  api.assets.clear();
  api.assets.set('loop-0', { id: 'loop-0', side: 0, kind: 'loop', name: 'original', url: 'blob:original' });
  api.startLoop(0, 'loop-0');
  loop.ended = true;
  api.resume(0);
  assert.equal(loop.src, 'blob:original');
  assert.equal(loop.paused, false);
});
