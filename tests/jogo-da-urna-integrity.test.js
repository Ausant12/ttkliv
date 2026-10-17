import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeChat,normalizeLike} from '../src/lib/tiktokEventNormalizer.js';
import {createSocialReceiver} from '../public/games/jogo-da-urna/social.js';
import {createGiftReceiver} from '../public/games/jogo-da-urna/votes.js';
import {encodeProgress,decodeProgress,shouldFlushProgress} from '../public/games/jogo-da-urna/progress.js';
import {Rounds} from '../public/games/jogo-da-urna/rounds.js';
import {claimSession} from '../public/games/jogo-da-urna/session.js';
test('salvamento agrupa rajadas em quatro gravações por segundo',()=>{
  let last=0,writes=0;
  for(let now=1;now<=1000;now++)if(shouldFlushProgress(now,last,true)){writes++;last=now;}
  assert.equal(writes,4);
  assert.equal(shouldFlushProgress(999,0,false),false);
  assert.equal(shouldFlushProgress(1000,0,false),true);
});
test('pipeline real preserva IDs e bloqueia duplicação de comentários e curtidas, inclusive após restaurar',()=>{
  const actions=[];let social=createSocialReceiver(a=>actions.push(a));
  const raw={uniqueId:'a',comment:'Flavio',likeCount:200,common:{msgId:'one'}};
  social.chat(normalizeChat(raw));social.like(normalizeLike(raw));
  social=createSocialReceiver(a=>actions.push(a),JSON.parse(JSON.stringify(social.snapshot())));
  social.chat(normalizeChat(raw));social.like(normalizeLike(raw));
  assert.deepEqual(actions.map(a=>[a.kind,a.votes]),[['comment',1],['like',100]]);
  social.chat(normalizeChat({...raw,common:{msgId:'two'}}));
  assert.equal(actions.length,3);
});
test('finais de combos diferentes sem groupId contam; reenvios identificados não contam de novo',()=>{
  let total=0;const receive=createGiftReceiver(a=>total+=a.quantity);
  const raw={giftId:5655,rawGiftType:1,user:{uniqueId:'a'},repeatCount:1,repeatEnd:true};
  for(const eventId of ['a','a','b','b'])receive({...raw,eventId});
  assert.equal(total,2);
});
test('grupo faz parte da identidade e combos com mesmo message ID continuam independentes',()=>{
  let total=0;const receive=createGiftReceiver(a=>total+=a.quantity);
  const raw={giftId:5655,rawGiftType:1,user:{uniqueId:'a'},repeatCount:2,repeatEnd:true,eventId:'same'};
  receive({...raw,groupId:'a'});receive({...raw,groupId:'b'});receive({...raw,groupId:'a'});
  assert.equal(total,4);
});
test('replay anônimo imediato de combo concluído não abre outro combo',()=>{
  let total=0;const receive=createGiftReceiver(a=>total+=a.quantity);
  const raw={giftId:5655,rawGiftType:1,user:{uniqueId:'a'},repeatCount:1};
  for(const repeatEnd of [false,true,false,true])receive({...raw,repeatEnd});
  assert.equal(total,1);
});
test('restauração rejeita personagens e registros incompletos',()=>{
  const base={rounds:new Rounds(30),scores:{lula:0,flavio:0},people:[],queue:[],nextQueue:[]};
  assert.ok(decodeProgress(encodeProgress(base,0),1));
  for(const change of [
    {people:[{team:'lula',votes:10,quantity:1}]},
    {gifts:{seen:'bad',streaks:[]}},
    {social:{users:[['a',{likes:-1}]],seen:[]}},
    {queue:[{team:'lula',votes:10,quantity:Infinity}]}
  ])assert.equal(decodeProgress(encodeProgress({...base,...change},0),1),null);
});
test('segunda aba não assume nem libera a sessão da primeira',async()=>{
  const held=new Set();const locks={async request(key,_options,callback){
    if(held.has(key))return callback(null);
    held.add(key);try{return await callback({name:key});}finally{held.delete(key);}
  }};
  let release,owners=0,blocked=0;
  const first=claimSession(locks,'live',r=>{release=r;owners++;},()=>blocked++);
  await claimSession(locks,'live',()=>owners++,()=>blocked++);
  assert.equal(owners,1);assert.equal(blocked,1);assert.equal(held.size,1);
  release();await first;
  await claimSession(locks,'live',r=>{owners++;r();},()=>blocked++);
  assert.equal(owners,2);assert.equal(held.size,0);
});
