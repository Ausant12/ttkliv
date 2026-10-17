import test from 'node:test';
import assert from 'node:assert/strict';
import { createSocialReceiver } from '../public/games/jogo-da-urna/social.js';
const user=id=>({uniqueId:id,nickname:id});
test('comentários aceitam variantes, acentos e pontuação, sem duplicar IDs',()=>{
  const actions=[],social=createSocialReceiver(a=>actions.push(a));
  for(const comment of ['Flávio','flavio','FLÁVIO BOLSONARO','Flavio   Bolsonaro!','!flavio','22'])social.chat({user:user('a'),comment});
  for(const comment of ['Lula','13','!Lula!'])social.chat({user:user('a'),comment});
  social.chat({user:user('a'),comment:'outro assunto'});
  social.chat({user:user('a'),comment:'Flávio',eventId:'one'});
  social.chat({user:user('a'),comment:'Flávio',eventId:'one'});
  assert.equal(actions.length,10);
  assert.equal(actions.filter(a=>a.team==='flavio').length,7);
  assert.ok(actions.every(a=>a.kind==='comment'&&a.votes===1));
});
test('curtidas acumulam por pessoa com sobra e dão votos diretamente ao Lula',()=>{
  const actions=[],social=createSocialReceiver(a=>{if(a.kind!=='comment')actions.push(a);});
  social.like({user:user('a'),likeCount:150});social.like({user:user('b'),likeCount:150});
  social.like({user:user('a'),likeCount:300});assert.equal(actions.length,1);
  social.chat({user:user('a'),comment:'13'});
  assert.deepEqual(actions.map(a=>[a.team,a.votes,a.quantity,a.kind]),[['lula',100,2,'like']]);
  social.like({user:user('a'),likeCount:150});assert.equal(actions[1].quantity,1);
  social.chat({user:user('b'),comment:'Flávio'});assert.equal(actions.length,2);
});
test('follow gera 300 para Flávio uma vez, independentemente do comentário',()=>{
  const actions=[],social=createSocialReceiver(a=>{if(a.kind!=='comment')actions.push(a);});
  social.follow({user:user('a')});social.follow({user:user('a')});
  social.chat({user:user('a'),comment:'22'});social.follow({user:user('a')});
  social.chat({user:user('a'),comment:'Lula'});social.follow({user:user('a')});
  assert.equal(actions.length,1);assert.equal(actions[0].votes,300);assert.equal(actions[0].team,'flavio');assert.equal(actions[0].kind,'follow');
});
test('comentar não muda os destinos fixos nem gera votos adicionais',()=>{
  const actions=[],social=createSocialReceiver(a=>{if(a.kind!=='comment')actions.push(a);});
  social.chat({user:user('a'),comment:'Lula'});social.follow({user:user('a')});
  social.chat({user:user('b'),comment:'Flávio'});social.like({user:user('b'),likeCount:200});
  assert.deepEqual(actions.map(a=>[a.team,a.votes]),[['flavio',300],['lula',100]]);
});
test('likes com ID duplicado não repetem bônus e eventos sem usuário são ignorados',()=>{
  const actions=[],social=createSocialReceiver(a=>{if(a.kind!=='comment')actions.push(a);});
  social.chat({user:user('a'),comment:'Lula'});
  for(let i=0;i<2;i++)social.like({user:user('a'),likeCount:200,eventId:'one'});
  social.like({likeCount:400});social.follow({});social.like({user:user('a'),likeCount:-3});
  assert.equal(actions.length,1);
});
