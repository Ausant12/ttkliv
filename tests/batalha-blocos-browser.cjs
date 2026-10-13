// Teste local completo. Não conecta ao TikTok nem envia presentes reais.
const { app, BrowserWindow } = require('electron');
const express = require('express');
const { createServer } = require('node:http');
const { Server } = require('socket.io');
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');

const software = process.argv.includes('--software');
if (software) {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('disable-gpu-compositing');
}
let server, io;
app.whenReady().then(async () => {
  const web = express();
  web.use(express.static(path.join(__dirname, '../public')));
  server = createServer(web);
  io = new Server(server);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let sala;
  io.on('connection', socket => socket.on('join-room', nome => {
    socket.join(nome); sala = nome; socket.emit('room-joined');
  }));
  const erros = [];
  const win = new BrowserWindow({ show: false, width:540, height:960,
    webPreferences: { backgroundThrottling:false, offscreen:true } });
  win.webContents.setFrameRate(60);
  win.webContents.on('console-message', (...args) => {
    const mensagem = typeof args[1] === 'object' ? args[1] : { level:args[1], message:args[2] };
    if (mensagem.level === 'error' || mensagem.level === 3) erros.push(mensagem.message);
  });
  const url = `http://127.0.0.1:${server.address().port}/games/batalha-blocos/?username=qa_local`;
  await win.loadURL(url);
  const js = (code, gesture = false) => win.webContents.executeJavaScript(code, gesture);
  const aguardar = code => js(`(async()=>{const inicio=Date.now();while(!(${code})){if(Date.now()-inicio>60000)throw Error('timeout: '+${JSON.stringify(code)});await esperar(20)}})()`);
  await aguardar("window.socketBatalha?.connected");
  assert.equal(sala,'qa_local');
  await js("document.getElementById('ativar-audio').click()", true);
  await js("window.qaBarreira=0;window.socketBatalha.on('qa-barreira', numero=>window.qaBarreira=numero);void 0");
  const snapshots = [];
  let barreira = 0;
  const ler = async nome => {
    io.to(sala).emit('qa-barreira', ++barreira);
    await aguardar(`window.qaBarreira === ${barreira} && !processando && fila.length === 0`);
    const snapshot = await js(`({state:JSON.parse(JSON.stringify(state)),pisos:[el.torres.lula.children.length,el.torres.flavio.children.length],pendentes:SOCIAL.curtidasPendentes,temporarios:document.querySelectorAll('.bloco-caindo').length})`);
    snapshots.push({nome,...snapshot});
    for(const lado of ['lula','flavio']) assert.equal(Math.floor(snapshot.state[lado].pontos/15),snapshot.pisos[lado==='lula'?0:1]);
    assert.equal(snapshot.temporarios,0);
    return snapshot;
  };
  const enviar = (tipo,payload) => io.to(sala).emit(tipo,payload);
  if(process.argv.includes('--saldo')) {
    await js("window.qaTorres=[];const vencerOriginal=encerrarRodada;encerrarRodada=async lado=>{window.qaTorres.push({lado,pontos:state[lado].pontos,pisos:el.torres[lado].children.length});await vencerOriginal(lado)};void 0");
    enviar('tiktok_gift',{giftId:5655,repeatCount:32,rawGiftType:2,eventId:'preparar_480'});
    enviar('tiktok_chat',{comment:'13'}); enviar('tiktok_chat',{comment:'13'});
    let s=await ler('adversário com 490');
    assert.equal(s.state.lula.pontos,490);
    enviar('tiktok_gift',{giftName:'Galaxy',repeatCount:1,rawGiftType:2,eventId:'galaxia_6000'});
    enviar('tiktok_gift',{giftId:5655,repeatCount:1,rawGiftType:2,eventId:'rose_pendente'});
    s=await ler('Galáxia completa e próximo presente');
    assert.equal(s.state.flavio.vitorias,12); assert.equal(s.state.flavio.pontos,0);
    assert.equal(s.state.lula.vitorias,0); assert.equal(s.state.lula.pontos,15);
    enviar('tiktok_gift',{giftName:'Money Gun',repeatCount:1,rawGiftType:2,eventId:'presente_2500'});
    s=await ler('2500 blocos completos');
    assert.equal(s.state.flavio.vitorias,17); assert.equal(s.state.flavio.pontos,0);
    const torres=await js('window.qaTorres');
    assert.equal(torres.length,17);
    assert.ok(torres.every(torre=>torre.lado==='flavio'&&torre.pontos===500&&torre.pisos===34));
    assert.deepEqual(erros,[]);
    const destino=path.join(__dirname,'../artifacts/batalha-blocos');
    fs.mkdirSync(destino,{recursive:true});
    fs.writeFileSync(path.join(destino,'qa-saldo.json'),JSON.stringify({snapshots,torres,erros},null,2));
    console.log(JSON.stringify({galaxia:12,presente2500:5,torresCom500Pontos:torres.length,erros}));
    win.destroy();io.close();server.close();app.quit();return;
  }
  await js(`window.qaFrames=[];window.qaAtivo=true;let anterior=performance.now();const medir=agora=>{if(!window.qaAtivo)return;window.qaFrames.push(agora-anterior);anterior=agora;requestAnimationFrame(medir)};requestAnimationFrame(medir);window.qaInicio=performance.now();`);
  for(const giftId of [5655,6064,6560,5327,544015,5585]) enviar('tiktok_gift',{giftId,repeatCount:1,rawGiftType:1,repeatEnd:true,eventId:`gift_${giftId}`});
  let s=await ler('seis presentes');
  assert.equal(s.state.lula.pontos,0); assert.equal(s.state.flavio.pontos,0);
  assert.equal(s.state.lula.vitorias,1); assert.equal(s.state.flavio.vitorias,1);
  const velocidade = await js(`(()=>{window.qaAtivo=false;const ordenados=window.qaFrames.slice().sort((a,b)=>a-b);return {tempoMs:Math.round(performance.now()-window.qaInicio),quadros:ordenados.length,intervaloP95Ms:Math.round(ordenados[Math.floor(ordenados.length*.95)]||0),intervaloMaxMs:Math.round(ordenados.at(-1)||0)}})()`);
  assert.ok(velocidade.tempoMs < 20000,'Fila dos seis presentes excedeu 20 segundos');
  for(let i=0;i<20;i++) { enviar('tiktok_chat',{comment:'13'}); enviar('tiktok_chat',{comment:'22'}); }
  s=await ler('quarenta comentários');
  assert.equal(s.state.lula.pontos,100); assert.equal(s.state.flavio.pontos,100);
  enviar('tiktok_like',{likeCount:250});
  enviar('tiktok_follow',{user:{uniqueId:'seguidor_qa'}});
  enviar('tiktok_follow',{user:{uniqueId:'SEGUIDOR_QA'}});
  enviar('tiktok_chat',{comment:'Boa live!'});
  s=await ler('curtidas, follow e duplicação');
  assert.equal(s.state.flavio.vitorias,1); assert.equal(s.state.flavio.pontos,300);
  assert.equal(s.state.lula.pontos,200); assert.equal(s.pendentes,50);
  enviar('tiktok_gift',{giftName:"You're Amazing",repeatCount:1,rawGiftType:2,eventId:'premium'});
  await aguardar('state.lula.vitorias === 6 && finalizando');
  enviar('tiktok_gift',{giftId:5655,repeatCount:1,rawGiftType:2,eventId:'durante_vitoria'});
  enviar('tiktok_chat',{comment:'22'});
  s=await ler('ações durante a vitória');
  assert.equal(s.state.lula.vitorias,6); assert.equal(s.state.lula.pontos,215); assert.equal(s.state.flavio.pontos,5);
  const streak={giftId:5655,repeatCount:3,rawGiftType:1,groupId:'streak_qa',user:{uniqueId:'pessoa'}};
  enviar('tiktok_gift',{...streak,repeatEnd:false,eventId:'inicio'});
  enviar('tiktok_gift',{...streak,repeatEnd:true,eventId:'fim'});
  enviar('tiktok_gift',{...streak,repeatEnd:true,eventId:'fim_repetido'});
  s=await ler('sequência e fim duplicado');
  assert.equal(s.state.lula.pontos,260);
  enviar('tiktok_gift',{giftId:5655,repeatCount:13,rawGiftType:2,eventId:'resize'});
  await new Promise(resolve=>setTimeout(resolve,150));
  win.setSize(360,640);
  s=await ler('redimensionar durante a queda');
  assert.equal(s.state.lula.pontos,455);
  await new Promise(resolve=>setTimeout(resolve,600));
  const recursos=await js(`(async()=>{
    const refs=[...document.querySelectorAll('img[src],source[src],link[href]')].map(el=>el.src||el.href);
    refs.push(...Object.values(SONS).map(audio=>audio.src));
    const status=await Promise.all(refs.map(async ref=>({ref,status:(await fetch(ref)).status})));
    const topo=el.torres.lula.lastElementChild.getBoundingClientRect();
    const arena=document.querySelector('.torre-area').getBoundingClientRect();
    return {status,topoVisivel:topo.top>=arena.top&&topo.bottom<=arena.bottom,video:{muted:document.getElementById('video-fundo').muted,loop:document.getElementById('video-fundo').loop,readyState:document.getElementById('video-fundo').readyState},audio:{lula:SONS.vitoria_lula.error?.code||null,flavio:SONS.vitoria_flavio.error?.code||null},efeitos:document.querySelectorAll('.particula,.confete').length};
  })()`);
  assert.ok(recursos.status.every(ref=>ref.status===200));
  assert.ok(recursos.topoVisivel); assert.ok(recursos.video.muted&&recursos.video.loop&&recursos.video.readyState>=2);
  assert.equal(recursos.audio.lula,null); assert.equal(recursos.audio.flavio,null);
  assert.equal(recursos.efeitos,0); assert.deepEqual(erros,[]);
  fs.mkdirSync(path.join(__dirname,'../artifacts/batalha-blocos'),{recursive:true});
  fs.writeFileSync(path.join(__dirname,`../artifacts/batalha-blocos/qa-${software?'software':'padrao'}.json`),JSON.stringify({perfil:software?'sem aceleração GPU':'padrão',snapshots,velocidade,recursos,erros},null,2));
  console.log(JSON.stringify({perfil:software?'software':'padrao',cenarios:snapshots.length,velocidade,erros}));
  win.destroy(); io.close(); server.close(); app.quit();
}).catch(err=>{console.error(err);io?.close();server?.close();app.exit(1)});
