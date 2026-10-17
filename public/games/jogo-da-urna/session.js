// Web Locks serialize ownership across tabs in the same browser and origin.
export function claimSession(locks,key,onOwned,onBlocked){
  if(!locks?.request){onBlocked('Este navegador não oferece proteção entre abas. Use Chrome ou Edge atualizado.');return;}
  return locks.request(key,{mode:'exclusive',ifAvailable:true},async lock=>{
    if(!lock){onBlocked('Esta live já está ativa em outra aba. Feche a outra aba e atualize esta para assumir.');return;}
    await new Promise(resolve=>onOwned(resolve));
  }).catch(()=>onBlocked('Não foi possível proteger esta sessão. Atualize a página antes de iniciar.'));
}
