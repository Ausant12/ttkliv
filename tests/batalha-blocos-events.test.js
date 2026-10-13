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

test("meta de 500 preserva excedente do presente após vitória", async () => {
  const source = fs.readFileSync(new URL("../public/games/batalha-blocos/game.js", import.meta.url), "utf8");
  const state = { flavio: { pontos: 450 } };
  let vitorias = 0;
  const meta = Number(source.match(/const META = (\d+);/)[1]);
  assert.equal(meta, 500);
  const context = vm.createContext({ META: meta, TEMPO_BLOCO: 65, state,
    adicionarEvento() {}, atualizarCamera() {}, criarBloco() {}, atualizarHUD() {}, esperar: async () => {}, animarQueda: async (lado, quantidade, pousar) => { for (let i=0;i<quantidade;i++) pousar(); },
    encerrarRodada: async lado => { vitorias++; state[lado].pontos = 0; }
  });
  vm.runInContext(source.slice(source.indexOf("async function animarPresente"), source.indexOf("async function encerrarRodada")), context);
  await context.animarPresente({ lado: "flavio", nome: "Galáxia", blocos: 6000 });
  assert.equal(vitorias, 12);
  assert.equal(state.flavio.pontos, 450);
});

test("presente sem grupo usa ID da mensagem sem bloquear outros presentes", () => {
  const { context, eventos } = jogo();
  const gift = { giftId: 5655, rawGiftType: 0, groupId: "0", repeatCount: 1 };
  assert.equal(context.registrarPresenteReal({ ...gift, eventId: "100" }), true);
  assert.equal(context.registrarPresenteReal({ ...gift, eventId: "100" }), false);
  assert.equal(context.registrarPresenteReal({ ...gift, eventId: "101" }), true);
  assert.equal(eventos.length, 2);
});

test('200 blocos depositam 200 pisos e só somam pontos depois da queda', async () => {
  const source = fs.readFileSync(new URL('../public/games/batalha-blocos/game.js', import.meta.url), 'utf8');
  const state = { lula: { pontos: 0 } };
  const pisos = [];
  let pousar;
  const context = vm.createContext({
    META: 500, TEMPO_BLOCO: 65, state,
    adicionarEvento() {}, atualizarCamera() {}, atualizarHUD() {}, esperar: async () => {},
    animarQueda: (lado, quantidade, depositar) => new Promise(resolve => { pousar = () => { for (let i=0;i<quantidade;i++) depositar(); resolve(); }; }),
    criarBloco: (...args) => pisos.push(args),
    encerrarRodada() { assert.fail('Não deveria haver vitória'); }
  });
  vm.runInContext(source.slice(source.indexOf('async function animarPresente'), source.indexOf('async function encerrarRodada')), context);
  const animacao = context.animarPresente({ lado: 'lula', nome: 'Presente', blocos: 200 });
  assert.equal(state.lula.pontos, 0);
  assert.equal(pisos.length, 0);
  pousar();
  await animacao;
  assert.equal(state.lula.pontos, 200);
  assert.equal(pisos.length, 200);
  assert.deepEqual(pisos[0], ['lula', 1, 1]);
  assert.deepEqual(pisos[199], ['lula', 200, 1]);
});

test('câmera acompanha a torre mais alta e volta à base na rodada vazia', () => {
  const source = fs.readFileSync(new URL('../public/games/batalha-blocos/game.js', import.meta.url), 'utf8');
  const estilos = {};
  const game = { clientWidth: 400, style: { setProperty: (key, value) => { estilos[key] = value; } } };
  const torres = { lula: { children: { length: 10 }, parentElement: { clientHeight: 500 } }, flavio: { children: { length: 40 } } };
  const context = vm.createContext({ document: { getElementById: () => game }, el: { torres } });
  vm.runInContext(source.slice(source.indexOf('let medidasArena'), source.indexOf('function criarBloco')), context);
  context.atualizarCamera();
  assert.equal(estilos['--camera-y'], '350px');
  torres.lula.children.length = torres.flavio.children.length = 0;
  context.atualizarCamera();
  assert.equal(estilos['--camera-y'], '0px');
});

test('sons reutilizam canais, limitam impactos e param na vitória', async () => {
  const source = fs.readFileSync(new URL('../public/games/batalha-blocos/game.js', import.meta.url), 'utf8');
  let agora = 0;
  const audios = Array.from({ length: 3 }, () => ({
    tocou: 0, pausou: 0, currentTime: 0,
    play() { this.tocou++; return Promise.resolve(); },
    pause() { this.pausou++; }
  }));
  const canais = audios.map(audio => ({ audio, ocupado: false }));
  const context = vm.createContext({
    audioLiberado: true, finalizando: false, performance: { now: () => agora },
    canaisImpacto: { lula: canais, flavio: [] }, ultimoSomImpacto: -Infinity
  });
  vm.runInContext(source.slice(source.indexOf('function reproduzirSomBloco'), source.indexOf('async function animarPresente')), context);
  for (agora = 0; agora <= 480; agora += 40) context.reproduzirSomBloco('lula');
  assert.equal(audios.reduce((total, audio) => total + audio.tocou, 0), 3);
  audios[0].onended();
  agora = 600;
  context.reproduzirSomBloco('lula');
  assert.equal(audios[0].tocou, 2);
  context.pararSonsImpacto();
  assert.ok(canais.every(canal => !canal.ocupado));
  assert.ok(audios.every(audio => audio.pausou === 1));
  context.finalizando = true;
  agora = 1000;
  context.reproduzirSomBloco('lula');
  assert.equal(audios.reduce((total, audio) => total + audio.tocou, 0), 4);
});

test('presente grande libera a fila para os menores sem perder blocos', async () => {
  const source = fs.readFileSync(new URL('../public/games/batalha-blocos/game.js', import.meta.url), 'utf8');
  const eventos = [];
  const fila = [{ lado:'flavio', nome:'Galaxy', blocos:6000 }, { lado:'lula', nome:'Rose', blocos:15 }];
  const context = vm.createContext({ fila, processando:false,
    animarPresente: async evento => { eventos.push(evento); }
  });
  vm.runInContext(source.slice(source.indexOf('async function processarFila'), source.indexOf('// Compatível')), context);
  await context.processarFila();
  assert.equal(eventos[0].blocos, 100);
  assert.equal(eventos[1].nome, 'Rose');
  assert.equal(eventos.filter(evento => evento.lado === 'flavio').reduce((total, evento) => total + evento.blocos, 0), 6000);
  assert.equal(fila.length, 0);
});

test('500 quedas são atualizadas por quadro preservando cada pouso', async () => {
  const source = fs.readFileSync(new URL('../public/games/batalha-blocos/game.js', import.meta.url), 'utf8');
  const base = { appendChild() {} };
  const elemento = () => ({ style: { setProperty() {} }, remove() {} });
  let proximoFrame;
  let pousos = 0;
  let atualizacoes = 0;
  const context = vm.createContext({
    el: { torres: { lula: { children: [], parentElement: base } } },
    medidasArena: { altura:500 }, alturaPiso: () => 16, TEMPO_QUEDA:220,
    document: {
      getElementById: () => ({ style: { getPropertyValue: () => '0px' } }),
      createElement: elemento,
      createDocumentFragment: () => ({ childNodes: [], appendChild(el) { this.childNodes.push(el); } })
    },
    performance: { now: () => 0 },
    atualizarCamera: () => { atualizacoes++; }, atualizarHUD() {}, reproduzirSomBloco() {},
    setTimeout() {}, requestAnimationFrame: fn => { proximoFrame = fn; }
  });
  vm.runInContext(source.slice(source.indexOf('async function animarQueda'), source.indexOf('function celebrarVitoria')), context);
  const animacao = context.animarQueda('lula', 500, () => { pousos++; });
  for (let agora = 16; pousos < 500 && agora < 5000; agora += 16) proximoFrame(agora);
  assert.equal(pousos, 500);
  await animacao;
  assert.ok(atualizacoes < 100, 'A câmera deve atualizar por quadro, não por bloco');
});

function simulacaoLive() {
  const source = fs.readFileSync(new URL('../public/games/batalha-blocos/game.js', import.meta.url), 'utf8');
  const handlers = {};
  const state = { lula: { pontos: 0, vitorias: 0 }, flavio: { pontos: 0, vitorias: 0 } };
  const depositados = { lula:0, flavio:0 };
  const context = vm.createContext({
    state, Date, URLSearchParams, console,
    location: { search: '?username=teste_local' },
    window: { io: () => ({ on(event, fn) { handlers[event] = fn; }, emit() {} }) },
    adicionarEvento() {}, atualizarCamera() {}, criarBloco(lado) { depositados[lado]++; }, atualizarHUD() {}, esperar: async () => {}, animarQueda: async (lado, quantidade, pousar) => { for (let i=0;i<quantidade;i++) pousar(); },
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
  return { state, handlers, depositados, async concluir() {
    for (let i = 0; i < 10000; i++) {
      if (!vm.runInContext('processando || fila.length > 0', context)) return;
      await Promise.resolve();
    }
    assert.fail('A fila de eventos não terminou');
  } };
}

test('comentários só pontuam 13 e 22 e aceitam espaços externos', async () => {
  const sim = simulacaoLive();
  for (const comment of ['13', ' 13 ', '22', '22!', '113', 'Boa live', null]) sim.handlers.tiktok_chat({ comment });
  await sim.concluir();
  assert.equal(sim.state.lula.pontos, 10);
  assert.equal(sim.state.flavio.pontos, 5);
});

test('rajada de mil ações mantém todos os blocos aceitos sem duplicações', async () => {
  const sim = simulacaoLive();
  for (let i=0;i<250;i++) {
    sim.handlers.tiktok_chat({comment:'13'});
    sim.handlers.tiktok_chat({comment:'22'});
    sim.handlers.tiktok_like({likeCount:1});
    const gift={giftId:5655,repeatCount:1,rawGiftType:2,eventId:`rajada_${i}`};
    sim.handlers.tiktok_gift(gift);
    sim.handlers.tiktok_gift(gift);
  }
  await sim.concluir();
  assert.equal(sim.depositados.lula,250*5+250*15+100);
  assert.equal(sim.depositados.flavio,250*5);
});

test('presente antigo não volta a contar após mais de mil mensagens', () => {
  const {context,eventos}=jogo();
  const gift={giftId:5655,rawGiftType:2,eventId:'primeiro'};
  assert.equal(context.registrarPresenteReal(gift),true);
  for(let i=0;i<1100;i++) context.registrarPresenteReal({...gift,eventId:`novo_${i}`});
  assert.equal(context.registrarPresenteReal(gift),false);
  assert.equal(eventos.length,1101);
});

test('seguidor continua único mesmo depois de mais de mil contas', () => {
  const { context, eventos } = jogo();
  assert.equal(context.registrarSeguidor({ uniqueId:'primeiro' }), true);
  for (let i = 0; i < 1100; i++) context.registrarSeguidor({ uniqueId:`pessoa_${i}` });
  assert.equal(context.registrarSeguidor({ uniqueId:' PRIMEIRO ' }), false);
  assert.equal(eventos.length, 1101);
});

test('lado inválido não entra na fila e não altera protótipos', () => {
  const { context, eventos } = jogo();
  for (const lado of ['constructor', '__proto__', 'toString', '', 'outra']) assert.equal(context.enfileirarBlocos(lado, 'teste', 5), false);
  assert.equal(eventos.length, 0);
});

test('presentes comuns também são encontrados pelo nome quando falta ID', () => {
  const { context } = jogo();
  for (const [giftName, pontos] of [['Rose',15], ['GG',15], ['Tiny Diny',50], ['Heart',50], ['Heart My Earthling',200], ['Confetti',200], ['Galaxia',6000]]) {
    assert.equal(context.encontrarPresente({ giftName }).blocos, pontos);
  }
});

test('presentes sem sequência não são perdidos nem confundidos pelo grupo', () => {
  const { context, eventos } = jogo();
  const payload = { giftId:5655, rawGiftType:2, repeatEnd:false, groupId:'igual', user:{uniqueId:'pessoa'} };
  assert.equal(context.registrarPresenteReal({...payload,eventId:'a'}), true);
  assert.equal(context.registrarPresenteReal({...payload,eventId:'b'}), true);
  assert.equal(context.registrarPresenteReal({...payload,eventId:'a'}), false);
  assert.equal(eventos.length, 2);
});

test('API de testes rejeita quantidades inválidas de presentes', () => {
  const source = fs.readFileSync(new URL('../public/games/batalha-blocos/game.js', import.meta.url), 'utf8');
  const eventos = [];
  const context = vm.createContext({
    fila:{push:evento=>eventos.push(evento)}, processarFila() {}, mostrarEnvioPresente() {},
    encontrarPresente: () => ({lado:'lula',nome:'Rose',blocos:15})
  });
  vm.runInContext(source.slice(source.indexOf('function receberPresenteTikTok'), source.indexOf('window.receberPresente =')), context);
  for (const quantidade of [0,-1,1.5,1001,Infinity,'erro',null]) assert.equal(context.receberPresenteTikTok(5655,quantidade), false);
  assert.equal(context.receberPresenteTikTok(5655,'3'), true);
  assert.equal(eventos.length, 3);
});

test('aviso mostra remetente, ícone e quantidade apenas para presentes aceitos', () => {
  const {context}=jogo();
  const ids=['aviso-presente','aviso-presente-texto','aviso-presente-quantidade','aviso-presente-icone'];
  const nodes=Object.fromEntries(ids.map(id=>[id,{hidden:true,textContent:''}]));
  const timers=[];
  const cancelados=[];
  context.document={getElementById:id=>nodes[id]};
  context.setTimeout=(fn,ms)=>{timers.push({fn,ms});return timers.length;};
  context.clearTimeout=id=>cancelados.push(id);
  const rose={giftId:5655,repeatCount:6,rawGiftType:1,repeatEnd:true,eventId:'rose_aviso',user:{nickname:'João',uniqueId:'joao'}};
  assert.equal(context.registrarPresenteReal({...rose,repeatEnd:false}),false);
  assert.equal(nodes['aviso-presente'].hidden,true);
  assert.equal(context.registrarPresenteReal(rose),true);
  assert.equal(nodes['aviso-presente-texto'].textContent,'João mandou 6 rosas');
  assert.equal(nodes['aviso-presente-quantidade'].textContent,'×6');
  assert.ok(nodes['aviso-presente-icone'].src.endsWith('/rose.webp'));
  assert.equal(context.registrarPresenteReal(rose),false);
  assert.equal(timers.length,1);
  context.registrarPresenteReal({giftId:6064,repeatCount:2,rawGiftType:2,eventId:'gg_aviso',user:{nickname:'<b>Ana</b>'}});
  assert.equal(nodes['aviso-presente-texto'].textContent,'<b>Ana</b> mandou 2 × GG');
  assert.equal(nodes['aviso-presente'].hidden,false);
  assert.ok(cancelados.includes(1));
  assert.equal(timers[1].ms,6000);
  timers[1].fn();
  assert.equal(nodes['aviso-presente'].hidden,true);
});

test('fila preserva blocos pendentes e pode retomar após falha', async () => {
  const source = fs.readFileSync(new URL('../public/games/batalha-blocos/game.js', import.meta.url), 'utf8');
  const fila = [{lado:'lula',nome:'teste',blocos:200}];
  let falhar = true;
  let depositados = 0;
  const context = vm.createContext({fila,processando:false,console:{error(){}},
    animarPresente: async evento => {
      if (falhar) { falhar=false; depositados+=30; const erro=new Error('simulação'); erro.blocosRestantes=70; throw erro; }
      depositados+=evento.blocos;
    }
  });
  vm.runInContext(source.slice(source.indexOf('async function processarFila'), source.indexOf('// Compatível')), context);
  await context.processarFila();
  assert.equal(context.processando, false);
  assert.equal(fila.reduce((total,evento)=>total+evento.blocos,0),170);
  await context.processarFila();
  assert.equal(depositados,200);
  assert.equal(fila.length,0);
});

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
    assert.equal(sim.state[lado].pontos, total % 500);
    assert.equal(sim.state[lado].vitorias, Math.floor(total / 500));
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
  assert.equal(sim.state.lula.pontos, 0);
  assert.equal(sim.state.flavio.pontos, 100);
  assert.equal(sim.state.flavio.vitorias, 1);
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
