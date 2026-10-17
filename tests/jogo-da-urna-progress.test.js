import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeProgress,decodeProgress } from '../public/games/jogo-da-urna/progress.js';
import { Rounds,takeVoters } from '../public/games/jogo-da-urna/rounds.js';
import { createGiftReceiver } from '../public/games/jogo-da-urna/votes.js';
import { createSocialReceiver } from '../public/games/jogo-da-urna/social.js';
test('progresso mantém placar, vitórias, filas e tempo restante ao recarregar',()=>{
  const rounds=new Rounds(30);rounds.start(1000);rounds.wins.lula=2;
  const voter={team:'lula',votes:10,quantity:3,totalVotes:30,age:1,counted:false,seed:2,lane:18};
  const state={rounds,scores:{lula:20,flavio:30},people:[voter],queue:[{...voter,team:'flavio'}],nextQueue:[voter]};
  const restored=decodeProgress(encodeProgress(state,11000),100);
  assert.equal(restored.rounds.remaining(100),20);
  assert.equal(restored.rounds.wins.lula,2);assert.deepEqual(restored.scores,state.scores);
  assert.deepEqual(restored.people,state.people);assert.deepEqual(restored.queue,state.queue);assert.deepEqual(restored.nextQueue,state.nextQueue);
  assert.equal(decodeProgress('bad',0),null);
  assert.equal(decodeProgress(JSON.stringify({version:1}),0),null);
});
test('vitória restaurada não concede outro ponto',()=>{
  const rounds=new Rounds(30);rounds.start(0);rounds.tick(30000,false,{lula:10,flavio:0});
  const restored=decodeProgress(encodeProgress({rounds,scores:{lula:10,flavio:0},people:[],queue:[],nextQueue:[]},31000),100);
  assert.equal(restored.rounds.tick(2100,false,restored.scores),'next');
  assert.equal(restored.rounds.wins.lula,1);
});
test('fila admite vários personagens do mesmo lado e preserva todos os votos',()=>{
  const queue=[{team:'lula',votes:10,quantity:600},{team:'flavio',votes:5000,quantity:3}];
  const first=takeVoters(queue),second=takeVoters(queue);
  assert.equal(first.team,'lula');assert.equal(second.team,'lula');
  let total=first.totalVotes+second.totalVotes;
  while(queue.length)total+=takeVoters(queue).totalVotes;
  assert.equal(total,21000);
});
test('combos, foto, curtidas restantes e follow único sobrevivem à restauração',()=>{
  const actions=[];let receive=createGiftReceiver(a=>actions.push(a));
  const gift={giftId:5655,groupId:'one',rawGiftType:1,user:{uniqueId:'a',profilePictureUrl:'https://example.com/photo.png'}};
  receive({...gift,repeatCount:2,repeatEnd:false});
  receive=createGiftReceiver(a=>actions.push(a),JSON.parse(JSON.stringify(receive.snapshot())));
  receive({...gift,repeatCount:2,repeatEnd:false});receive({...gift,repeatCount:3,repeatEnd:true});
  assert.equal(actions.reduce((sum,a)=>sum+a.quantity,0),3);assert.equal(actions[0].avatar,gift.user.profilePictureUrl);
  const user={uniqueId:'a'};let social=createSocialReceiver(a=>actions.push(a));
  social.like({user,likeCount:150});social.follow({user});
  const before=actions.length;
  social=createSocialReceiver(a=>actions.push(a),JSON.parse(JSON.stringify(social.snapshot())));
  social.follow({user});social.like({user,likeCount:50});
  assert.equal(actions.length,before+1);assert.equal(actions.at(-1).kind,'like');
});
