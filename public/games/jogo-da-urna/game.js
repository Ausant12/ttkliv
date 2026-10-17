import { GIFTS, createGiftReceiver } from './votes.js';
import { Rounds, CELEBRATION_MS, takeVoters } from './rounds.js';
import { encodeProgress,decodeProgress,shouldFlushProgress } from './progress.js';
import { createSocialReceiver } from './social.js';
import { characterPosition, characterScale } from './characters.js';
import { claimSession } from './session.js';
let rounds=new Rounds(), nextQueue=[];
let banner=null;
const urnPulse={lula:0,flavio:0};
const crowd=Array.from({length:44},(_,i)=>({x:18+(i%22)*24,y:23+Math.floor(i/22)*29,team:i%22<11?'lula':'flavio',seed:i*1.7}));
const displayName=team=>team==='lula'?'Lula':'Flávio';
const giftIcons={5655:'rose',6560:'tiny-diny',5585:'confetti',6064:'gg',5327:'heart',544015:'heart-my-earthling'};
const giftGroup=document.createElement('div');
giftGroup.className='gift-group';
// Alternate candidates so both teams stay visible as the carousel moves.
for(const index of [0,3,1,4,2,5,6,7]){
  const gift=GIFTS[index];
  const card=document.createElement('div');
  card.className=`gift-card gift-${gift.team}`;
  const icon=document.createElement('img');
  icon.src=`/games/duelo-2d/icones/${gift.icon || giftIcons[gift.id]}.webp`;
  icon.alt=gift.name;icon.width=46;icon.height=46;
  const info=document.createElement('div');
  const candidate=document.createElement('b');candidate.textContent=displayName(gift.team).toUpperCase();
  const name=document.createElement('span');name.textContent=gift.label || gift.name;
  const votes=document.createElement('strong');votes.textContent=`+${gift.votes.toLocaleString('pt-BR')} ${gift.votes===1?'voto':'votos'}`;
  info.append(candidate,name,votes);card.append(icon,info);giftGroup.append(card);
}
const giftCopy=giftGroup.cloneNode(true);giftCopy.setAttribute('aria-hidden','true');
document.querySelector('#gift-track').append(giftGroup,giftCopy);
const socialGroup=document.createElement('div');socialGroup.className='gift-group';
for(const [title,description,detail,team,icon] of [
  ['SIGA A LIVE','+300 votos para Flávio','Uma vez por seguidor','flavio','seguir.png'],
  ['200 CURTIDAS','+100 votos para Lula','Acumule curtidas e repita!','lula','tiktok-heart.png'],
  ['COMENTE LULA','Lula ou 13 no chat','+1 voto por comentário','lula',null],
  ['COMENTE FLÁVIO','Flávio / Flavio / 22','+1 voto por comentário','flavio',null]
]){
  const card=document.createElement('div');card.className=`gift-card gift-${team}`;
  if(icon){const image=document.createElement('img');image.src=`/games/duelo-2d/icones/${icon}`;image.alt='';card.append(image);}
  const info=document.createElement('div'),heading=document.createElement('b'),label=document.createElement('strong'),hint=document.createElement('span');
  heading.textContent=title;label.textContent=description;hint.textContent=detail;info.append(heading,label,hint);card.append(info);socialGroup.append(card);
}
const socialCopy=socialGroup.cloneNode(true);socialCopy.setAttribute('aria-hidden','true');
document.querySelector('#social-track').append(socialGroup,socialCopy);
const canvas = document.querySelector('#arena'), ctx = canvas.getContext('2d');
const crowdCanvas=document.querySelector('#crowd-arena'),crowdContext=crowdCanvas.getContext('2d');
// Keep operational messages in the side panel, outside the capture.
document.querySelector('#controls').append(document.querySelector('#activity'),document.querySelector('#connection'));
document.querySelector('.overlay footer').remove();
const scores = {lula:0,flavio:0}, colors = {lula:'#f24d68',flavio:'#48ce7c'};
const urnCenters = {lula:140,flavio:400};
const urnImages = {};
const voteSound = new Audio(new URL('assets/somurna.mp3',import.meta.url).href);
voteSound.preload = 'auto';
voteSound.volume = 0.35;
const victorySounds={};
for(const [team,file] of Object.entries({lula:'vitorialula (2).mp3',flavio:'vitoriaflavio.mp3'})){
  const audio=new Audio(new URL(`assets/${file}`,import.meta.url).href);
  audio.preload='auto';audio.volume=.45;victorySounds[team]=audio;
}
const victoryPanel=document.querySelector('#victory');
function hideVictory(){
  victoryPanel.hidden=true;
  for(const audio of Object.values(victorySounds)){audio.pause();audio.currentTime=0;}
}
function showVictory(team){
  hideVictory();
  if(!team)return;
  // Stop the final voting beep before the winner's track begins.
  voteSound.pause();voteSound.currentTime=0;voteSoundBusy=false;
  victoryPanel.style.setProperty('--winner-color',colors[team]);
  document.querySelector('#victory-title').textContent=team==='lula'?'O Brasil é Lula':'O Brasil é Flavio Bolsonaro';
  const image=document.querySelector('#victory-urn');
  image.src=urnImages[team].src;image.alt=`Urna do vencedor: ${displayName(team)}`;
  document.querySelector('#victory-result').textContent=`${scores[team].toLocaleString('pt-BR')} votos • ${rounds.wins[team]} ${rounds.wins[team]===1?'vitória':'vitórias'}`;
  const confetti=document.querySelector('#victory-confetti');confetti.replaceChildren();
  for(let i=0;i<48;i++){
    const piece=document.createElement('i');
    piece.style.left=`${Math.random()*100}%`;
    piece.style.background=['#ffe09b','#fff6db',colors[team]][i%3];
    piece.style.animationDelay=`${-Math.random()*4}s`;
    piece.style.animationDuration=`${2.5+Math.random()*2}s`;
    confetti.append(piece);
  }
  victoryPanel.hidden=false;
  victorySounds[team].play().catch(()=>{
    // Browser autoplay policy may require interaction with this page first.
  });
}
let voteSoundBusy = false;
let lastVoteSound = -Infinity;
voteSound.addEventListener('ended',() => { voteSoundBusy = false; });
voteSound.addEventListener('error',() => { voteSoundBusy = false; });
function playVoteSound() {
  const now = performance.now();
  // Merge rapid votes into one sound, without overlapping or queuing audio.
  // The full clip finishes before another vote can trigger it again.
  if (voteSoundBusy || now-lastVoteSound < 450) return;
  voteSoundBusy = true;
  lastVoteSound = now;
  voteSound.currentTime = 0;
  voteSound.play().catch(() => {
    voteSoundBusy = false;
    // Browsers may require a click on the page before allowing sound.
  });
}
for (const [team, file] of Object.entries({lula:'urna_lula_presidente_13.png',flavio:'urna_flavio_presidente_22.png'})) {
  const image = new Image();
  image.src = new URL(`assets/${file}`,import.meta.url).href;
  image.onerror = () => console.error(`Não foi possível carregar a urna: ${file}`);
  urnImages[team] = image;
}
let people = [], queue = [], particles = [], last = performance.now(), spawnClock = 0;
const voteNotices = {lula:{votes:0,remaining:0},flavio:{votes:0,remaining:0}};
function showVoteNotice(team,votes) {
  const notice=voteNotices[team];
  notice.votes=(notice.remaining>0 ? notice.votes : 0)+votes;
  notice.remaining=1.6;
}
function drawVoteNotices(dt) {
  for(const team of ['lula','flavio']) {
    const notice=voteNotices[team];
    if(notice.remaining<=0) continue;
    notice.remaining=Math.max(0,notice.remaining-dt);
    const x=urnCenters[team];
    const y=139-(1-notice.remaining/1.6)*10;
    const label=`+${notice.votes.toLocaleString('pt-BR')} ${notice.votes===1?'voto':'votos'} pro ${team==='lula'?'Lula':'Flávio'}`;
    ctx.save();
    ctx.globalAlpha=Math.min(1,notice.remaining/.35);
    ctx.font='bold 14px Arial';
    const width=ctx.measureText(label).width+22;
    box(x-width/2,y-21,width,32,'#101725',10);
    text(label,x,y,14,colors[team]);
    ctx.restore();
  }
}
const params = new URLSearchParams(location.search);
const storageKey=`jogo-da-urna:v1:${(params.get('id')||params.get('username')||'teste').replace(/^@/,'').toLowerCase()}`;
let restored=null,saveAt=0,saveDirty=false,isOwner=false,releaseSession=null,restoreIssue='';
try{const raw=localStorage.getItem(storageKey);restored=decodeProgress(raw,performance.now());if(raw&&!restored)restoreIssue='O progresso salvo está incompleto e não foi carregado. Confira antes de iniciar uma nova sessão.';}catch{restoreIssue='O navegador não permitiu ler o progresso salvo.';}
if(restored){rounds=restored.rounds;Object.assign(scores,restored.scores);people=restored.people;queue=restored.queue;nextQueue=restored.nextQueue;}
const duration=Number(params.get('duration'));
if(!restored&&[30,60,180,300].includes(duration))rounds.duration=duration;
document.querySelector('#duration').value=String(rounds.duration);
document.querySelector('#duration').onchange=event=>{
  rounds.duration=Number(event.target.value);
  const url=new URL(document.querySelector('#overlay-link').href);
  url.searchParams.set('duration',String(rounds.duration));
  document.querySelector('#overlay-link').href=url.href;
};
document.body.classList.toggle('clean',params.get('overlay') === '1');
const captureFrame=document.querySelector('#capture-frame');
const gameOverlay=captureFrame.querySelector('.overlay');
const participant=document.createElement('div');participant.className='participant';participant.hidden=true;
let participantPhoto=document.createElement('img');participantPhoto.alt='';participantPhoto.referrerPolicy='no-referrer';
const participantInitial=document.createElement('span');participantInitial.className='participant-initial';
const participantText=document.createElement('div');
participant.append(participantPhoto,participantInitial,participantText);gameOverlay.append(participant);
let highlights=[],highlightUntil=0,hideHighlightAt=0,spawnNumber=0;
function highlight(p){
  const description=p.kind==='comment'?'comentou':p.kind==='like'?'curtiu a live':p.kind==='follow'?'seguiu a live':`enviou ${p.label||p.name}`;
  highlights.push({user:p.user,avatar:p.avatar,team:p.team,text:`${p.user} ${description}: +${p.totalVotes.toLocaleString('pt-BR')} votos`});
}
function updateHighlight(now){
  if(now<highlightUntil)return;
  const item=highlights.shift();
  if(!item){if(now>=hideHighlightAt)participant.hidden=true;return;}
  participant.hidden=false;
  participant.style.setProperty('--participant-color',colors[item.team]);
  participantText.textContent=item.text;participantInitial.textContent=Array.from(String(item.user||'?'))[0].toUpperCase();
  // Each person owns their image element, so a late load/error cannot hide the next photo.
  const photo=document.createElement('img');photo.alt=`Foto de ${item.user}`;photo.referrerPolicy='no-referrer';photo.hidden=true;
  participantPhoto.replaceWith(photo);participantPhoto=photo;participantInitial.hidden=false;
  photo.onload=()=>{if(participantPhoto===photo){photo.hidden=false;participantInitial.hidden=true;}};
  photo.onerror=()=>{if(participantPhoto===photo){photo.hidden=true;participantInitial.hidden=false;}};
  if(item.avatar)photo.src=item.avatar;
  // Show every confirmation, quickly draining bursts instead of waiting 3s each.
  highlightUntil=now+(highlights.length>8?45:highlights.length>2?80:140);
  hideHighlightAt=now+3000;
}
const resizeOverlay=()=>{
  gameOverlay.style.transform=`scale(${captureFrame.clientWidth/540})`;
};
new ResizeObserver(resizeOverlay).observe(captureFrame);
resizeOverlay();
const overlayURL = new URL(location.href); overlayURL.searchParams.set('overlay','1');
document.querySelector('#overlay-link').href = overlayURL.href;
function enqueue(action) {
  if(!isOwner||restoreIssue)return;
  if(action.avatar){const photo=new Image();photo.src=action.avatar;}
  const now=performance.now();
  const next=rounds.phase==='draining'||rounds.phase==='celebrating'||(rounds.phase==='open'&&now>=rounds.deadline);
  (next?nextQueue:queue).push({...action,quantity:action.quantity || 1});
  if(!next)rounds.start(now);
  saveProgress();
}
const receiveGift = createGiftReceiver(enqueue,restored?.gifts);
window.TikTokBridge.on('gift',data=>{if(isOwner)receiveGift(data);});
const social=createSocialReceiver(enqueue,restored?.social);
const socialHelp=document.createElement('p');
socialHelp.textContent='200 curtidas por pessoa = 100 votos para Lula. Follow = 300 votos para Flávio, uma vez por sessão. Comente Lula/13 ou Flávio/Flavio/22: 1 voto por comentário válido.';
document.querySelector('#controls').prepend(socialHelp);
window.TikTokBridge.on('chat',data=>{if(isOwner)social.chat(data);});
window.TikTokBridge.on('like',data=>{if(isOwner)social.like(data);});
const followSockets=new WeakSet();
window.TikTokBridge.on('connected',()=>{
  const socket=window.TikTokBridge.socket;
  if(socket&&!followSockets.has(socket)){socket.on('tiktok_follow',data=>{if(isOwner)social.follow(data);});followSockets.add(socket);}
});
for(const [team,kind] of [['lula','like'],['flavio','follow']]){
  const button=document.createElement('button');
  button.textContent=`${displayName(team)} • ${kind==='like'?'200 curtidas: +100':'Follow: +300'}`;
  button.onclick=()=>enqueue({team,kind,votes:kind==='like'?100:300,user:'Teste',quantity:1});
  document.querySelector('#test-buttons').append(button);
}
const status = document.querySelector('#connection');
if(params.get('id') || params.get('username')) status.textContent = 'Conectando à live…';
window.TikTokBridge.on('connected',() => {status.textContent = '● Sala conectada • aguardando presentes';});
window.TikTokBridge.on('disconnected',() => {status.textContent = 'Live desconectada';});
window.TikTokBridge.on('reconnecting',() => {status.textContent = 'Reconectando à live…';});
window.TikTokBridge.on('error',() => {status.textContent = 'Não foi possível conectar à live';});
for(const gift of GIFTS) {
  const button = document.createElement('button');
  button.textContent = `${gift.team === 'lula' ? 'Lula' : 'Flávio'} • +${gift.votes.toLocaleString('pt-BR')} • ${gift.label || gift.name}`;
  button.addEventListener('click',() => enqueue({...gift,user:'Teste'}));
  document.querySelector('#test-buttons').append(button);
}
for(const team of ['lula','flavio']){
  const button=document.createElement('button');button.textContent=`${displayName(team)} • comentário: +1 voto`;
  button.onclick=()=>enqueue({team,kind:'comment',votes:1,quantity:1,user:'Teste'});
  document.querySelector('#test-buttons').append(button);
}
document.querySelector('#reset').onclick = () => {
  if(!isOwner)return;
  if(!confirm('Começar uma sessão nova? Isso zera votos, vitórias, filas e bônus de seguidores.')) return;
  restoreIssue='';sessionNotice.hidden=true;
  people=[]; queue=[]; particles=[]; scores.lula=0; scores.flavio=0; updateScore();
  rounds=new Rounds(rounds.duration);nextQueue=[];banner=null;urnPulse.lula=0;urnPulse.flavio=0;
  hideVictory();
  receiveGift.clear();social.clear();highlights=[];highlightUntil=0;hideHighlightAt=0;spawnNumber=0;participant.hidden=true;
  for(const notice of Object.values(voteNotices)){notice.votes=0;notice.remaining=0;}
  document.querySelector('#activity').textContent='As urnas estão abertas!';
  saveProgress();
  flushProgress();
};
document.querySelector('#reset').textContent='Começar nova sessão';
const saveStatus=document.createElement('p');document.querySelector('#controls').append(saveStatus);
function saveProgress(){
  if(isOwner)saveDirty=true;
}
function flushProgress(){
  if(!isOwner||restoreIssue)return;
  try{
    localStorage.setItem(storageKey,encodeProgress({scores,rounds,people,queue,nextQueue,gifts:receiveGift.snapshot(),social:social.snapshot()},performance.now()));
    saveDirty=false;
    saveStatus.textContent='Progresso salvo neste navegador. O cronômetro pausa ao fechar.';
  }catch{saveStatus.textContent='Não foi possível salvar o progresso neste navegador.';}
}
window.addEventListener('pagehide',()=>{flushProgress();isOwner=false;releaseSession?.();});
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)flushProgress();});
updateScore();
const sessionNotice=document.createElement('div');sessionNotice.className='session-notice';sessionNotice.hidden=true;gameOverlay.append(sessionNotice);
claimSession(navigator.locks,storageKey,release=>{
  releaseSession=release;
  isOwner=true;
  if(restoreIssue){sessionNotice.hidden=false;sessionNotice.textContent=restoreIssue;saveStatus.textContent=restoreIssue;return;}
  if(restored?.rounds.phase==='celebrating')showVictory(rounds.winner);
},message=>{isOwner=false;sessionNotice.hidden=false;sessionNotice.textContent=message;saveStatus.textContent=message;});
function updateScore() {
  for(const team of ['lula','flavio']) document.querySelector(`#score-${team}`).textContent=scores[team].toLocaleString('pt-BR');
  const total=scores.lula+scores.flavio;
  document.querySelector('#meter-lula').style.width=`${total ? scores.lula/total*100 : 50}%`;
  const diff=scores.lula-scores.flavio;
  document.querySelector('#leader').textContent=!total ? 'Quem vai abrir a votação?' : !diff ? 'Tudo igual! Disputa empatada' : `${diff>0?'Lula':'Flávio'} na frente • ${Math.abs(diff).toLocaleString('pt-BR')} votos de vantagem`;
}
function text(value,x,y,size=14,color='#fff') {ctx.fillStyle=color;ctx.font=`bold ${size}px Arial`;ctx.textAlign='center';ctx.fillText(value,x,y);}
function line(x,y,a,b,color,width=5) {ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(a,b);ctx.stroke();}
function box(x,y,w,h,color,r=8) {ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
function star(x,y,r=5){
  ctx.fillStyle='#ffe46b';ctx.beginPath();
  for(let i=0;i<10;i++){
    const angle=-Math.PI/2+i*Math.PI/5, radius=i%2?r*.44:r;
    const px=x+Math.cos(angle)*radius,py=y+Math.sin(angle)*radius;
    if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);
  }
  ctx.closePath();ctx.fill();
}
function urn(team,x) {
  const color=colors[team];
  ctx.save();
  const glow=ctx.createRadialGradient(x,230,12,x,230,145);
  glow.addColorStop(0,team==='lula'?'#f24d684d':'#48ce7c4d');
  glow.addColorStop(1,team==='lula'?'#f24d6800':'#48ce7c00');
  ctx.fillStyle=glow;ctx.fillRect(x-145,85,290,290);
  ctx.restore();
  const image=urnImages[team];
  if(image.complete && image.naturalWidth) {
    const pulse=urnPulse[team];
    const width=260+pulse*10, height=width*image.naturalHeight/image.naturalWidth;
    ctx.save();ctx.shadowColor=color;ctx.shadowBlur=18+pulse*25;
    ctx.translate(Math.sin(pulse*22)*pulse*3,-pulse*4);
    ctx.drawImage(image,x-width/2,305-height,width,height);
    ctx.restore();
  } else {
    text('Carregando urna…',x,245,12,'#8191a7');
  }
  text(team==='lula'?'LULA':'FLÁVIO',x,321,19,color);
}
function elegantPerson(p,x,y,swing,walking,time) {
  const direction=p.team==='lula'?1:-1, color=colors[p.team];
  const suit=p.team==='flavio'?'#157044':'#192638';
  ctx.save();
  if(p.age>3.15)ctx.globalAlpha=Math.max(0,1-(p.age-3.15)/.55);
  // A full-size, tailored silhouette exclusive to the 1,000-vote tier.
  ctx.fillStyle='#ffd66b18';ctx.beginPath();ctx.ellipse(x,y+20,43,10,0,0,Math.PI*2);ctx.fill();
  ctx.translate(x,y);ctx.scale(characterScale(p),characterScale(p));
  ctx.shadowColor='#ffe5a0';ctx.shadowBlur=12;
  line(-6,-9,-9+swing*.45,13,'#182436',8);
  line(6,-9,9-swing*.45,13,'#182436',8);
  box(-15+swing*.45,11,14,5,'#070c14',2);
  box(2-swing*.45,11,14,5,'#070c14',2);
  box(-13,-46,26,39,suit,5);
  ctx.shadowBlur=0;
  // White shirt, satin lapels and a bow tie in the candidate's color.
  ctx.fillStyle='#f8f3e6';ctx.beginPath();ctx.moveTo(-7,-45);ctx.lineTo(7,-45);ctx.lineTo(0,-23);ctx.fill();
  ctx.fillStyle=p.team==='flavio'?'#ffe363':'#35445b';
  for(const side of [-1,1]){
    ctx.beginPath();ctx.moveTo(side*10,-46);ctx.lineTo(side*3,-39);ctx.lineTo(side*8,-33);ctx.lineTo(0,-19);ctx.closePath();ctx.fill();
  }
  ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(-7,-43);ctx.lineTo(0,-40);ctx.lineTo(7,-43);ctx.lineTo(7,-36);ctx.lineTo(0,-40);ctx.lineTo(-7,-36);ctx.closePath();ctx.fill();
  line(-12,-40,-19-swing*.2,-18,suit,7);
  const handX=direction*23,handY=walking?-19:-41;
  line(12,-39,handX,handY,suit,7);
  line(handX-2,handY,handX+2,handY,'#fff5df',5);
  box(5,-33,5,4,color,1);
  if(p.team==='lula')star(-7,-31,4);
  else {box(5,-33,5,4,'#ffe363',1);line(-12,-40,-18,-21,'#48ce7c',4);}
  for(let i=0;i<3;i++)box(-1,-25+i*6,2,2,'#e9c776',1);
  ctx.fillStyle='#ebc9a5';ctx.beginPath();ctx.arc(0,-59,11,0,Math.PI*2);ctx.fill();
  box(-10,-65,9,5,'#0a111d',2);box(1,-65,9,5,'#0a111d',2);line(-2,-63,2,-63,'#e5c77b',1);
  box(-16,-73,32,4,'#0c1422',2);box(-10,-89,20,17,'#192638',3);box(-10,-77,20,4,'#e6bf61',0);
  if(!walking)box(handX-5,handY-7,12,9,'#fff9e5',1);
  // Small gold glints around the suit, without covering the urn's portrait.
  for(let i=0;i<4;i++){
    const sx=Math.cos(time*2+i*1.8)*27,sy=-45+Math.sin(time*3+i*1.8)*34;
    line(sx-2,sy,sx+2,sy,'#ffe6a0',1);line(sx,sy-2,sx,sy+2,'#ffe6a0',1);
  }
  text(`+${p.totalVotes.toLocaleString('pt-BR')}`,0,-103,13,'#ffe09b');
  const name=Array.from(String(p.user||'Visitante')).slice(0,12).join('');
  text(name,0,-117,9,'#fff3ce');
  ctx.restore();
}
function socialPerson(p,x,y,swing,walking){
  const color=colors[p.team],like=p.kind==='like';
  ctx.save();ctx.translate(x,y);ctx.scale(characterScale(p),characterScale(p));
  if(p.age>3.15)ctx.globalAlpha=Math.max(0,1-(p.age-3.15)/.55);
  line(-5,-9,-9+swing*.6,13,'#b9cadd',5);line(5,-9,9-swing*.6,13,'#b9cadd',5);
  box(-12,-43,24,34,color,like?10:4);
  line(-10,-35,-19,-17,color,6);line(10,-35,22,walking?-18:-39,color,6);
  ctx.fillStyle='#ebc9a5';ctx.beginPath();ctx.arc(0,-56,10,0,Math.PI*2);ctx.fill();
  if(p.kind==='comment'){
    // Chat messenger: speech-bubble hat and a white message badge.
    box(-17,-79,34,16,'#f1f6ff',5);
    ctx.fillStyle='#f1f6ff';ctx.beginPath();ctx.moveTo(-8,-64);ctx.lineTo(-8,-59);ctx.lineTo(-1,-64);ctx.fill();
    text('···',0,-68,14,color);
    box(-7,-35,14,12,'#f1f6ff',3);
    line(-3,-31,3,-31,color,1);line(-3,-27,1,-27,color,1);
    text('COMENTÁRIO',0,-94,9,'#bdd8ff');
  }else if(like){
    // Heart-shaped headphones and a heart on the hoodie.
    ctx.strokeStyle='#ff9bd3';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,-57,12,Math.PI,0);ctx.stroke();
    box(-14,-59,5,10,'#ff9bd3',2);box(9,-59,5,10,'#ff9bd3',2);
    ctx.fillStyle='#fff';ctx.beginPath();ctx.moveTo(0,-21);ctx.bezierCurveTo(-17,-31,-6,-40,0,-32);ctx.bezierCurveTo(6,-40,17,-31,0,-21);ctx.fill();
    text('CURTIDAS',0,-88,10,'#ffb4df');
  }else{
    // A follower arrives with a cap, gold scarf and a plus badge.
    box(-12,-68,24,6,'#ffe09b',3);box(-6,-63,23,3,'#ffe09b',1);
    line(-10,-43,10,-43,'#ffe09b',5);line(7,-42,13,-23,'#ffe09b',4);
    box(-6,-33,12,12,'#fff2bd',3);line(-3,-27,3,-27,color,2);line(0,-30,0,-24,color,2);
    text('NOVO SEGUIDOR',0,-88,9,'#ffe09b');
  }
  if(p.team==='lula')star(-7,-37,3);else line(-9,-37,-7,-21,'#ffe363',3);
  if(!walking)box(17,-46,12,9,'#fff9e5',1);
  text(`+${p.totalVotes.toLocaleString('pt-BR')}`,0,-73,13,'#fff');
  text(Array.from(String(p.user)).slice(0,12).join(''),0,-103,9,'#dce7f4');
  ctx.restore();
}
function person(p,time) {
  const direction=p.team==='lula'?1:-1;
  const {x,y}=characterPosition(p);
  const walking=p.age<2.4, swing=walking?Math.sin(time*11+p.seed)*11:0;
  if(p.kind){socialPerson(p,x,y,swing,walking);return;}
  if(p.votes>=5000){elegantPerson(p,x,y,swing,walking,time);return;}
  if(p.votes>=100 && walking){
    ctx.save();ctx.globalAlpha=.35;
    box(p.team==='lula'?0:430,y+9,110,9,p.votes>=500?'#ffd65d':colors[p.team],4);
    ctx.restore();
  }
  if(p.votes>=500 && p.age<1.5){
    ctx.save();ctx.globalAlpha=(1-p.age/1.5)*.3;
    ctx.fillStyle='#ffda64';ctx.beginPath();ctx.moveTo(x,-5);ctx.lineTo(x-45,y+16);ctx.lineTo(x+45,y+16);ctx.fill();ctx.restore();
  }
  const size=characterScale(p);
  ctx.save();ctx.translate(x,y);ctx.scale(size,size);
  if(p.age>3.15) ctx.globalAlpha=Math.max(0,1-(p.age-3.15)/.55);
  const color=colors[p.team];
  if(p.votes>=100){ctx.shadowColor=p.votes>=500?'#ffd65d':color;ctx.shadowBlur=16;}
  if(p.votes>=500){ctx.fillStyle=p.team==='lula'?'#9e2842':'#1d7862';ctx.beginPath();ctx.moveTo(-8,-42);ctx.lineTo(-direction*29,4);ctx.lineTo(8,-5);ctx.fill();}
  line(-4,-8,-8+swing,13,'#dce5f3',4);line(4,-8,8-swing,13,'#dce5f3',4);
  line(0,-39,0,-10,color,15);
  if(p.team==='flavio') line(-5,-35,5,-16,'#ffe363',4);
  else star(0,-27,6);
  line(-6,-34,-13-swing/2,-16,'#dce5f3',4);
  line(6,-34,direction*21,walking?-20:-39,'#dce5f3',4);
  if(p.team==='flavio'){
    line(-6,-34,-10-swing/4,-26,'#ffe363',6);
    line(6,-34,direction*13,walking?-27:-37,'#ffe363',6);
  }
  ctx.fillStyle='#ebd3b3';ctx.beginPath();ctx.arc(0,-53,10,0,Math.PI*2);ctx.fill();
  if(p.votes===100){box(-12,-59,24,6,'#171d2c',2);line(-8,-40,8,-40,'#e2c16d',2);}
  if(p.votes>=500){ctx.fillStyle='#ffda64';ctx.beginPath();ctx.moveTo(-12,-63);ctx.lineTo(-14,-77);ctx.lineTo(-5,-71);ctx.lineTo(0,-82);ctx.lineTo(5,-71);ctx.lineTo(14,-77);ctx.lineTo(12,-63);ctx.fill();}
  if(!walking){box(direction*20-7,-47,14,10,'#f8f4df',1);}
  text(`+${p.totalVotes.toLocaleString('pt-BR')}`,0,-91,13,p.votes>=500?'#ffda64':'#fff');
  const name=Array.from(String(p.user || 'Visitante')).slice(0,12).join('');
  ctx.shadowBlur=0;
  text(name,0,-108,10,'#e9eef8');
  ctx.restore();
}
function frame(now) {
  if(!isOwner||restoreIssue){last=now;requestAnimationFrame(frame);return;}
  const dt=Math.min((now-last)/1000,.05);last=now;spawnClock+=dt;
  const transition=rounds.tick(now,queue.length>0||people.some(p=>!p.counted),scores);
  if(transition==='finish'){
    showVictory(rounds.winner);
    banner={title:rounds.winner?`${displayName(rounds.winner).toUpperCase()} VENCEU!`:'EMPATE!',subtitle:`${scores.lula.toLocaleString('pt-BR')} × ${scores.flavio.toLocaleString('pt-BR')} votos`,team:rounds.winner,until:now+CELEBRATION_MS};
    for(let i=0;i<160;i++)particles.push({x:Math.random()*540,y:Math.random()*160,vx:(Math.random()-.5)*100,vy:Math.random()*60,life:5+Math.random()*3,color:['#ffd65d','#fff',colors[rounds.winner]||'#89baff'][i%3]});
  }
  if(transition==='next'){
    hideVictory();
    scores.lula=0;scores.flavio=0;people=[];queue=nextQueue;nextQueue=[];banner=null;updateScore();
    for(const notice of Object.values(voteNotices)){notice.votes=0;notice.remaining=0;}
    if(queue.length)rounds.start(now);
    document.querySelector('#activity').textContent='Nova rodada! As urnas estão abertas!';
  }
  const seconds=rounds.remaining(now);
  document.querySelector('#clock').textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
  document.querySelector('#clock').classList.toggle('urgent',rounds.phase==='open'&&seconds<=10);
  document.querySelector('#round-label').textContent=`RODADA ${rounds.number}`;
  document.querySelector('#round-phase').textContent=({waiting:'AGUARDANDO VOTOS',open:'URNAS ABERTAS',draining:'FINALIZANDO A FILA',celebrating:'PRÓXIMA EM '+seconds+'s'})[rounds.phase];
  const suspense=rounds.phase==='open'&&seconds>0&&seconds<=10;
  document.querySelector('.round-bar').classList.toggle('final-seconds',suspense);
  document.querySelector('.round-bar').style.setProperty('--countdown',`${seconds*10}%`);
  if(suspense)document.querySelector('#round-phase').textContent=`${seconds}s • ÚLTIMOS VOTOS!`;
  for(const team of ['lula','flavio']){
    document.querySelector(`#wins-${team}`).textContent=rounds.wins[team];
    urnPulse[team]=Math.max(0,urnPulse[team]-dt*2.5);
  }
  let spawned=false;
  // Admit several voters per frame; both teams can have crowds in motion.
  while(queue.length && spawnClock>=.045 && people.length<70){
    const entry=takeVoters(queue);spawnClock-=.045;
    people.push({...entry,age:0,seed:Math.random()*10,lane:(spawnNumber++%3)*18,counted:false});
    spawned=true;
  }
  if(!queue.length||people.length>=70)spawnClock=Math.min(spawnClock,.045);
  if(spawned)saveProgress();
  ctx.clearRect(0,0,540,480);
  drawCrowd(now/1000);
  ctx.save();
  // Keep voting action above the lower area occupied by the live chat.
  ctx.translate(0,-50);
  urn('lula',urnCenters.lula);urn('flavio',urnCenters.flavio);
  for(const p of people){
    p.age+=dt;
    if(p.age>=2.65&&!p.counted){
      p.counted=true;scores[p.team]+=p.totalVotes;updateScore();playVoteSound();
      showVoteNotice(p.team,p.totalVotes);
      highlight(p);saveProgress();
      urnPulse[p.team]=1;
      const flipped=rounds.lead(scores);
      if(flipped)banner={title:'VIROU!',subtitle:`${displayName(flipped)} assume a liderança`,team:flipped,until:now+2300};
      document.querySelector('#activity').textContent=`${p.user} • +${p.totalVotes.toLocaleString('pt-BR')} votos para ${p.team==='lula'?'Lula':'Flávio'}!`;
      for(let i=0;i<12;i++)particles.push({x:urnCenters[p.team],y:210,vx:(Math.random()-.5)*120,vy:-Math.random()*120,life:1,color:colors[p.team]});
      if(p.votes>=5000){
        // Bounded particles keep a burst of expensive gifts from flooding the canvas.
        const count=Math.min(100,Math.max(0,600-particles.length));
        for(let i=0;i<count;i++)particles.push({
          x:urnCenters[p.team]+(Math.random()-.5)*220,y:Math.random()*45,
          vx:(Math.random()-.5)*65,vy:15+Math.random()*35,life:2.4+Math.random(),
          color:['#ffe09b','#fff6db',colors[p.team]][i%3],
          confetti:true,angle:Math.random()*Math.PI*2,spin:(Math.random()-.5)*8
        });
      }
    }
    person(p,now/1000);
  }
  people=people.filter(p=>p.age<3.7);
  for(const p of particles){
    p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=(p.confetti?35:150)*dt;
    ctx.save();ctx.globalAlpha=Math.max(0,Math.min(1,p.life));
    if(p.confetti){p.angle+=p.spin*dt;ctx.translate(p.x,p.y);ctx.rotate(p.angle);box(-3,-2,6,3,p.color,0);}
    else box(p.x,p.y,4,4,p.color,1);
    ctx.restore();
  }
  ctx.globalAlpha=1;particles=particles.filter(p=>p.life>0);
  drawVoteNotices(dt);
  ctx.restore();
  if(banner && now<banner.until){
    ctx.save();ctx.globalAlpha=Math.min(1,(banner.until-now)/350);
    box(65,12,410,91,'#0b1229ed',16);
    text(banner.title,270,53,30,banner.team?colors[banner.team]:'#ffda64');
    text(banner.subtitle,270,80,13,'#fff');ctx.restore();
  }
  const waiting=queue.reduce((sum,p)=>sum+p.quantity,0);
  if(waiting)text(`${waiting.toLocaleString('pt-BR')} eleitores a caminho`,270,292,11,'#8799b1');
  if(nextQueue.length)text(`${nextQueue.reduce((sum,p)=>sum+p.quantity,0)} na próxima rodada`,270,307,10,'#d6bd76');
  updateHighlight(now);
  // Coalesce bursts into at most four synchronous writes per second.
  if(shouldFlushProgress(now,saveAt,saveDirty)){saveAt=now;flushProgress();}
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
function drawCrowd(time){
  const ctx=crowdContext;
  ctx.clearRect(0,0,540,90);
  const stroke=(x,y,a,b,color,width)=>{
    ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(a,b);ctx.stroke();
  };
  for(const fan of crowd){
    const cheering=rounds.lastLeader===fan.team;
    const bounce=cheering?Math.max(0,Math.sin(time*7+fan.seed))*6:Math.sin(time*2+fan.seed)*1.5;
    const y=fan.y-bounce;
    ctx.save();ctx.globalAlpha=cheering?.65:.28;
    stroke(fan.x,y,fan.x,y+13,colors[fan.team],7);
    stroke(fan.x,y+2,fan.x-8,y+(cheering?-9:8),colors[fan.team],3);
    stroke(fan.x,y+2,fan.x+8,y+(cheering?-9:8),colors[fan.team],3);
    ctx.fillStyle='#c3cddd';ctx.beginPath();ctx.arc(fan.x,y-7,4,0,Math.PI*2);ctx.fill();ctx.restore();
  }
}
