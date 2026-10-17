const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
export function createSocialReceiver(enqueue,snapshot){
  const users=new Map(),seen=new Set();
  if(snapshot){for(const [k,v] of snapshot.users||[])users.set(k,v);for(const k of snapshot.seen||[])seen.add(k);}
  function user(data){
    const id=data.user?.uniqueId || data.uniqueId || data.user?.userId;
    if(!id)return null;
    if(!users.has(id))users.set(id,{name:data.user?.nickname||id,likes:0,followed:false,pendingFollow:false,team:null});
    const state=users.get(id);state.avatar=data.user?.profilePictureUrl||state.avatar||'';return state;
  }
  function flush(state){
    const quantity=Math.floor(state.likes/200);
    if(quantity){state.likes%=200;enqueue({team:'lula',votes:100,quantity,user:state.name,avatar:state.avatar,kind:'like'});}
    if(state.pendingFollow){state.pendingFollow=false;enqueue({team:'flavio',votes:300,quantity:1,user:state.name,avatar:state.avatar,kind:'follow'});}
  }
  function duplicate(data,type){
    const id=data.eventId??data.msgId;
    if(id==null||id==='')return false;
    const key=`${type}:${data.user?.uniqueId||data.uniqueId}:${id}`;
    if(seen.has(key))return true;seen.add(key);return false;
  }
  return {
    snapshot:()=>({users:[...users],seen:[...seen]}),
    clear(){users.clear();seen.clear();},
    chat(data){
      const state=user(data);if(!state)return;
      const message=normalize(data.comment).replace(/\s+/g,' ').replace(/^[!#]+|[!.,?]+$/g,'').trim();
      const team=['lula','13'].includes(message)?'lula':['flavio','flavio bolsonaro','22'].includes(message)?'flavio':null;
      if(!team||duplicate(data,'chat'))return;
      enqueue({team,votes:1,quantity:1,user:state.name,avatar:state.avatar,kind:'comment'});
    },
    like(data){
      const state=user(data),count=Number(data.likeCount);
      if(!state||!Number.isSafeInteger(count)||count<1||duplicate(data,'like'))return;
      state.likes+=count;flush(state);
    },
    follow(data){
      const state=user(data);if(!state||state.followed)return;
      state.followed=true;state.pendingFollow=true;flush(state);
    }
  };
}
