import { Rounds } from './rounds.js';
export function shouldFlushProgress(now,last,dirty){return (dirty&&now-last>=250)||now-last>=1000;}
export function encodeProgress(state,now){
  return JSON.stringify({version:1,...state,rounds:{...state.rounds,deadline:undefined,remainingMs:Math.max(0,(state.rounds.deadline||now)-now)}});
}
export function decodeProgress(raw,now){
  try{
    const data=JSON.parse(raw);
    if(data?.version!==1||!['waiting','open','draining','celebrating'].includes(data.rounds?.phase))return null;
    if(!['lula','flavio'].every(t=>Number.isSafeInteger(data.scores?.[t])&&data.scores[t]>=0&&Number.isSafeInteger(data.rounds.wins?.[t])&&data.rounds.wins[t]>=0))return null;
    if(![30,60,180,300].includes(data.rounds.duration)||!Number.isFinite(data.rounds.remainingMs)||data.rounds.remainingMs<0)return null;
    if(!Number.isSafeInteger(data.rounds.number)||data.rounds.number<1)return null;
    const validVoter=p=>p&&['lula','flavio'].includes(p.team)&&Number.isSafeInteger(p.votes)&&p.votes>0&&Number.isSafeInteger(p.quantity)&&p.quantity>0&&Number.isSafeInteger(p.votes*p.quantity);
    for(const key of ['people','queue','nextQueue'])if(!Array.isArray(data[key])||!data[key].every(validVoter))return null;
    if(!data.people.every(p=>Number.isFinite(p.age)&&p.age>=0&&Number.isFinite(p.seed)&&Number.isFinite(p.lane)&&typeof p.counted==='boolean'&&p.totalVotes===p.votes*p.quantity))return null;
    if(data.rounds.phase==='celebrating'&&![null,'lula','flavio'].includes(data.rounds.winner))return null;
    const entries=value=>Array.isArray(value)&&value.every(e=>Array.isArray(e)&&e.length===2&&typeof e[0]==='string');
    if(data.gifts && (!entries(data.gifts.seen)||!entries(data.gifts.streaks)||!data.gifts.seen.every(([,v])=>Number.isFinite(v?.time))||!data.gifts.streaks.every(([,v])=>Number.isFinite(v?.time)&&Number.isSafeInteger(v.count)&&v.count>=0&&typeof v.ended==='boolean')))return null;
    if(data.social && (!entries(data.social.users)||!Array.isArray(data.social.seen)||!data.social.seen.every(k=>typeof k==='string')||!data.social.users.every(([,v])=>v&&typeof v.name==='string'&&Number.isSafeInteger(v.likes)&&v.likes>=0&&typeof v.followed==='boolean'&&typeof v.pendingFollow==='boolean')))return null;
    data.rounds=Object.assign(new Rounds(data.rounds.duration),data.rounds,{deadline:now+data.rounds.remainingMs});
    return data;
  }catch{return null;}
}
