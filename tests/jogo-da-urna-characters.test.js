import test from 'node:test';
import assert from 'node:assert/strict';
import { characterPosition,characterScale } from '../public/games/jogo-da-urna/characters.js';
test('todos os tipos caminham uma distância visível e ficam dentro da arena',()=>{
  for(const team of ['lula','flavio'])for(const type of [{votes:10},{votes:100},{votes:500},{votes:5000},{kind:'like',votes:100},{kind:'follow',votes:300},{kind:'comment',votes:1}]){
    const base={...type,team,user:'Nome bem comprido',lane:-20};
    const start=characterPosition({...base,age:0}),end=characterPosition({...base,age:2.4});
    assert.ok(Math.hypot(end.x-start.x,end.y-start.y)>95,`${team} ${type.kind||type.votes} precisa andar`);
    const scale=characterScale(base),extent=base.kind?114:base.votes>=5000?128:120;
    for(let age=0;age<=3.7;age+=.1){
      const {x,y}=characterPosition({...base,age});
      assert.ok(y-50-extent*scale>=0,'nome e chapéu dentro do topo');
      assert.ok(y-50+20*scale<480,'pés dentro da arena');
      assert.ok(x-48*scale>=0 && x+48*scale<=540,'nome dentro das laterais');
    }
  }
});
