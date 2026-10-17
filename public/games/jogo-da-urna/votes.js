// Initial gift selection follows the existing Lula / Flávio duel.
export const GIFTS = [
  { id:5655, name:'Rose', team:'lula', votes:10 },
  { id:6560, name:'Tiny Diny', team:'lula', votes:100 },
  { id:5585, name:'Confetti', team:'lula', votes:500 },
  { id:6064, name:'GG', team:'flavio', votes:10 },
  { id:5327, name:'Heart', team:'flavio', votes:100 },
  { id:544015, name:'Heart My Earthling', team:'flavio', votes:500 },
  { name:'Accelerator Crown', label:'Coroa do Acelerador', aliases:['Coroa do Acelerador','Coroa'], icon:'coroa', team:'lula', votes:5000 },
  { name:'Galaxy', label:'Galáxia', aliases:['Galáxia','Galaxia'], icon:'galaxia', team:'flavio', votes:5000 }
];
export function createGiftReceiver(enqueue,snapshot) {
  const seen = new Map(), streaks = new Map();
  if(snapshot){for(const [k,v] of snapshot.seen||[])seen.set(k,v);for(const [k,v] of snapshot.streaks||[])streaks.set(k,v);}
  const receive = (gift) => {
    const now = Date.now();
    // Identified events and groups stay protected for the whole saved session.
    for(const [key,value] of streaks)if(!value.grouped&&now-value.time>300000)streaks.delete(key);
    const normalize=name=>String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
    const action = GIFTS.find(x => x.id != null && x.id === Number(gift.giftId)) || GIFTS.find(x => [x.name,...(x.aliases || [])].some(name=>normalize(name)===normalize(gift.giftName)));
    const count = Number(gift.repeatCount ?? 1);
    if (!action || !Number.isSafeInteger(count) || count < 1 || count > 10000) return;
    const user = gift.user?.uniqueId || gift.uniqueId || gift.user?.nickname || 'visitante';
    const hasGroup = gift.groupId != null && gift.groupId !== '';
    const key = `${user}:${action.id ?? action.name}:${hasGroup ? gift.groupId : 'ungrouped'}`;
    const end = [true,1,'1'].includes(gift.repeatEnd);
    const ongoing = [false,0,'0'].includes(gift.repeatEnd);
    const rawType=Number(gift.rawGiftType);
    let state = streaks.get(key);
    const isStreak=rawType===1 || (rawType!==2 && (ongoing || end || Boolean(state)));
    const eventId=gift.eventId ?? gift.msgId;
    const identified=eventId!=null && eventId!=='';
    if (identified) {
      // A combo may reuse its message ID as its cumulative count increases.
      const eventKey = `${key}:${eventId}:${isStreak?`${count}:${end}`:'single'}`;
      if (seen.has(eventKey)) return;
      seen.set(eventKey,{time:now});
    }
    let quantity = count;
    if (isStreak) {
      // With no group, a fresh message after a completed streak identifies a new one.
      // Anonymous replays cannot be distinguished reliably from a new streak.
      if(state?.ended && !hasGroup && identified && String(eventId)!==String(state.eventId))state=undefined;
      if (state?.ended && !hasGroup && ongoing && !identified && now-state.time>1500) state = undefined;
      if (state?.ended && count<=state.count) return;
      quantity = Math.max(0,count-(state?.count || 0));
      streaks.set(key,{count:Math.max(count,state?.count || 0),ended:(state?.ended || false) || (end && count>=(state?.count || 0)),time:now,eventId:identified?String(eventId):state?.eventId,grouped:hasGroup});
    }
    if(quantity) enqueue({...action,quantity,user:gift.user?.nickname || user,avatar:gift.user?.profilePictureUrl || ''});
  };
  receive.snapshot=()=>({seen:[...seen],streaks:[...streaks]});
  receive.clear=()=>{seen.clear();streaks.clear();};
  return receive;
}
