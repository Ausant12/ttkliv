export const CELEBRATION_MS=3000;
export function takeVoters(queue) {
  if(!queue.length)return null;
  const waiting=queue.reduce((sum,item)=>sum+item.quantity,0);
  const entry=queue[0];
  const quantity=Math.min(entry.quantity,Math.max(1,Math.ceil(waiting/30)));
  const voter={...entry,quantity,totalVotes:entry.votes*quantity};
  entry.quantity-=quantity;
  if(!entry.quantity)queue.shift();
  return voter;
}
export class Rounds {
  constructor(duration=180) { this.duration=duration;this.number=1;this.phase='waiting';this.wins={lula:0,flavio:0};this.lastLeader=null; }
  start(now) { if(this.phase==='waiting'){this.phase='open';this.deadline=now+this.duration*1000;} }
  tick(now,pending,scores) {
    if(this.phase==='open' && now>=this.deadline) this.phase='draining';
    if(this.phase==='draining' && !pending) {
      this.winner=scores.lula===scores.flavio?null:scores.lula>scores.flavio?'lula':'flavio';
      if(this.winner)this.wins[this.winner]++;
      this.phase='celebrating';this.deadline=now+CELEBRATION_MS;
      return 'finish';
    }
    if(this.phase==='celebrating' && now>=this.deadline){this.number++;this.phase='waiting';this.lastLeader=null;return 'next';}
  }
  lead(scores) {
    const leader=scores.lula===scores.flavio?null:scores.lula>scores.flavio?'lula':'flavio';
    const flipped=leader && this.lastLeader && leader!==this.lastLeader;
    if(leader)this.lastLeader=leader;
    return flipped?leader:null;
  }
  remaining(now) {return this.phase==='waiting'?this.duration:Math.max(0,Math.ceil((this.deadline-now)/1000));}
}
