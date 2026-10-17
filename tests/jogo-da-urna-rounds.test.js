import test from 'node:test';
import assert from 'node:assert/strict';
import { Rounds, takeVoters } from '../public/games/jogo-da-urna/rounds.js';
test('rodada aguarda primeiro voto e esgota fila antes de premiar',()=>{
  const round=new Rounds(30);
  assert.equal(round.remaining(99999),30);
  round.start(1000);round.start(15000);
  assert.equal(round.remaining(2000),29);
  assert.equal(round.tick(31000,true,{lula:3,flavio:4}),undefined);
  assert.equal(round.phase,'draining');
  assert.equal(round.tick(35000,false,{lula:13,flavio:4}),'finish');
  assert.equal(round.wins.lula,1);
  round.tick(36000,false,{lula:13,flavio:4});
  assert.equal(round.wins.lula,1);
  assert.equal(round.tick(37999,false,{}),undefined);
  assert.equal(round.tick(38000,false,{}),'next');
  assert.equal(round.number,2);assert.equal(round.phase,'waiting');
  assert.equal(round.wins.lula,1);
});
test('fila grande agrupa visuais sem perder votos ou misturar candidatos',()=>{
  const queue=[{team:'lula',votes:1,quantity:10000},{team:'flavio',votes:1000,quantity:53}];
  const totals={lula:0,flavio:0};let visuals=0;
  while(queue.length){const voter=takeVoters(queue);totals[voter.team]+=voter.totalVotes;visuals++;}
  assert.deepEqual(totals,{lula:10000,flavio:53000});
  assert.ok(visuals<250);
});
test('empate não dá vitória e virada funciona passando pelo empate',()=>{
  const round=new Rounds(30);
  assert.equal(round.lead({lula:1,flavio:0}),null);
  assert.equal(round.lead({lula:1,flavio:1}),null);
  assert.equal(round.lead({lula:1,flavio:2}),'flavio');
  assert.equal(round.lead({lula:1,flavio:3}),null);
  round.start(0);round.tick(30000,false,{lula:2,flavio:2});
  assert.equal(round.winner,null);
  assert.deepEqual(round.wins,{lula:0,flavio:0});
});
