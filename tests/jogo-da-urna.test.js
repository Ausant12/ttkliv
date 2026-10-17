import test from 'node:test';
import assert from 'node:assert/strict';
import { createGiftReceiver } from '../public/games/jogo-da-urna/votes.js';

test('mesmo message ID com combo crescente não perde incrementos',()=>{
  let total=0;const receive=createGiftReceiver(a=>{total+=a.quantity;});
  const base={giftId:5655,rawGiftType:1,groupId:'one',eventId:'reused'};
  for(const repeatCount of [1,2,4,4])receive({...base,repeatCount,repeatEnd:false});
  receive({...base,repeatCount:4,repeatEnd:true});
  assert.equal(total,4);
});
test('final atrasado ou contagem maior depois do final não perde votos',()=>{
  let total=0;const receive=createGiftReceiver(a=>{total+=a.quantity;});
  const base={giftId:5655,rawGiftType:1,groupId:'one'};
  receive({...base,repeatCount:4,repeatEnd:false});
  receive({...base,repeatCount:2,repeatEnd:true});
  receive({...base,repeatCount:5,repeatEnd:false});
  receive({...base,repeatCount:5,repeatEnd:true});
  receive({...base,repeatCount:7,repeatEnd:true});
  assert.equal(total,7);
});
test('presente não sequencial não vira combo apenas por ter groupId',()=>{
  let total=0;const receive=createGiftReceiver(a=>{total+=a.quantity;});
  const base={giftName:'Galaxy',rawGiftType:2,groupId:'same',repeatCount:1};
  receive({...base,eventId:'a'});receive({...base,eventId:'b'});receive({...base,eventId:'b'});
  assert.equal(total,2);
});

test('Coroa e Galáxia valem 5000 votos e reconhecem nomes locais e combos independentes',()=>{
  const totals={lula:0,flavio:0};
  const receive=createGiftReceiver(a=>{totals[a.team]+=a.votes*a.quantity;});
  for(const giftName of ['Accelerator Crown','Coroa do Acelerador','Coroa'])receive({giftName});
  for(const giftName of ['Galaxy','Galáxia','Galaxia'])receive({giftName});
  assert.deepEqual(totals,{lula:15000,flavio:15000});
  const base={rawGiftType:1,groupId:'same',user:{uniqueId:'a'},repeatEnd:false};
  receive({...base,giftName:'Accelerator Crown',repeatCount:2});
  receive({...base,giftName:'Galaxy',repeatCount:3});
  receive({...base,giftName:'Galaxy',repeatCount:3,repeatEnd:true});
  assert.deepEqual(totals,{lula:25000,flavio:30000});
});

test('cada presente mantém seu candidato e valor, incluindo repetições', () => {
  const actions=[],receive=createGiftReceiver(a=>actions.push(a));
  for(const giftId of [5655,6560,5585,6064,5327,544015]) receive({giftId,repeatCount:2});
  assert.deepEqual(actions.map(a=>[a.team,a.votes*a.quantity]),[
    ['lula',20],['lula',200],['lula',1000],['flavio',20],['flavio',200],['flavio',1000]
  ]);
});
test('combo cumulativo contabiliza somente presentes novos e ignora final duplicado', () => {
  let total=0;
  const receive=createGiftReceiver(a=>{total+=a.quantity*a.votes;});
  const base={giftId:6560,rawGiftType:1,groupId:'combo',user:{uniqueId:'a'}};
  for(const count of [1,2,2,5,3])receive({...base,repeatCount:count,repeatEnd:false});
  receive({...base,repeatCount:5,repeatEnd:true});
  receive({...base,repeatCount:5,repeatEnd:true});
  assert.equal(total,500);
  receive({...base,groupId:'next',repeatCount:1,repeatEnd:false});
  assert.equal(total,600);
});
test('eventos repetidos, presentes desconhecidos e contagens inválidas não duplicam votos', () => {
  const actions=[],receive=createGiftReceiver(a=>actions.push(a));
  receive({giftId:5585,eventId:'one'});receive({giftId:5585,eventId:'one'});
  receive({giftId:999});
  for(const repeatCount of [0,-1,1.5,Infinity,10001])receive({giftId:5585,repeatCount});
  assert.equal(actions.length,1);
});
test('novo combo sem grupo e usuários diferentes são independentes', () => {
  let total=0;const receive=createGiftReceiver(a=>{total+=a.quantity;});
  const base={giftId:5655,rawGiftType:1,user:{uniqueId:'a'}};
  receive({...base,repeatCount:2,repeatEnd:false,eventId:'first-start'});
  receive({...base,repeatCount:2,repeatEnd:true,eventId:'first-end'});
  receive({...base,repeatCount:1,repeatEnd:false,eventId:'second-start'});
  receive({...base,user:{uniqueId:'b'},repeatCount:3,repeatEnd:true});
  assert.equal(total,6);
});
