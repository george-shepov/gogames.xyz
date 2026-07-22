(() => {
  'use strict';
  const BALANCE_KEY='gogames.spades.playGgx.balance';
  const PICKS_KEY='gogames.spades.playGgx.predictions';
  const STAKE_KEY='gogames.spades.playGgx.defaultStake';
  const $=selector=>document.querySelector(selector);
  const state={balance:100,battles:[],predictions:[]};
  function readNumber(key,fallback){try{const n=Number(localStorage.getItem(key));return Number.isFinite(n)?n:fallback}catch(_){return fallback}}
  function readJSON(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback}catch(_){return fallback}}
  function save(){try{localStorage.setItem(BALANCE_KEY,String(state.balance));localStorage.setItem(PICKS_KEY,JSON.stringify(state.predictions))}catch(_){}}
  function setStatus(message,type=''){const el=$('#wallet-status');if(!el)return;el.textContent=message;el.className=`platform-status ${type}`.trim()}
  async function api(path){const response=await fetch(path,{headers:{Accept:'application/json'}});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||`Request failed (${response.status})`);return data}
  function configurePracticeUI(){
    $('#wallet-title').textContent='Play GGX Arena Predictions';
    $('#wallet-title').nextElementSibling.textContent='Practice-only points for predicting server-listed AI arenas. Play GGX cannot be purchased, cashed out, transferred, or exchanged for prizes.';
    $('#wallet-connect').classList.add('hidden');$('#wallet-dashboard').classList.remove('hidden');
    const store=$('#wallet-dashboard a.gold-btn');if(store)store.classList.add('hidden');
    const balanceTitle=$('#wallet-dashboard .platform-card h3');if(balanceTitle)balanceTitle.textContent='Play GGX balance';
    $('#wallet-refresh-btn').textContent='Settle predictions';$('#wallet-disconnect-btn').textContent='Reset play points';
    $('#wallet-load-battles-btn').textContent='Reload arenas';
    const note=$('.platform-note');if(note)note.innerHTML='<strong>Play-money boundary:</strong> Play GGX has no cash value and is never purchased or redeemed. Local Spades results do not affect points. Predictions are stored in this browser and settle only from published server arena results.';
    const connectButton=$('#wallet-connect-btn');if(connectButton)connectButton.disabled=true;
  }
  function renderBalance(){state.balance=Math.max(0,Math.floor(state.balance));$('#wallet-balance').textContent=`${state.balance} Play GGX`;$('#wallet-balance-large').textContent=state.balance}
  function predictionFor(id){return state.predictions.find(p=>p.battleId===id&&p.status==='pending')}
  function battleMarkup(battle){const id=String(battle.id||''),a=String(battle.modelAName||'Model A'),b=String(battle.modelBName||'Model B'),pending=predictionFor(id);return `<article class="battle-card" data-battle-id="${id}"><div class="battle-title"><span>${a} ⚔ ${b}</span><span>${String(battle.game||'game')}</span></div><div class="battle-meta">Practice prediction · no cash value${pending?` · ${pending.amount} points on ${pending.choice}`:''}</div><div class="platform-row"><select class="platform-select battle-choice" aria-label="Choose outcome" ${pending?'disabled':''}><option value="a">${a}</option><option value="draw">Draw</option><option value="b">${b}</option></select><button class="gold-btn battle-bet-btn" type="button" ${pending?'disabled':''}>${pending?'Prediction pending':'Make prediction'}</button></div></article>`}
  async function settlePredictions(){const pending=state.predictions.filter(p=>p.status==='pending');let settled=0;for(const pick of pending){try{const battle=await api(`/api/battles/${encodeURIComponent(pick.battleId)}`);if(battle.status==='finished'){pick.status=pick.choice===battle.winner?'won':'lost';pick.winner=battle.winner;if(pick.status==='won')state.balance+=pick.amount*2;settled++}}catch(_){}}
    if(settled){save();renderBalance();setStatus(`${settled} prediction(s) settled from arena results.`,'success')}return settled}
  async function loadBattles(){setStatus('Loading live arenas…');await settlePredictions();const battles=await api('/api/battles');state.battles=Array.isArray(battles)?battles.filter(b=>b&&b.status==='live'):[];$('#wallet-battles').innerHTML=state.battles.length?state.battles.map(battleMarkup).join(''):'<p style="color:var(--muted);">No live AI arenas are available right now.</p>';if(!state.battles.length)setStatus('No live arenas currently available.');else setStatus(`${state.battles.length} live arena(s) available.`,'success')}
  function placePrediction(card){const battleId=card.dataset.battleId,choice=card.querySelector('.battle-choice').value,amount=Number($('#wallet-bet-amount').value);if(!Number.isInteger(amount)||amount<1)throw new Error('Choose a valid play-point stake.');if(state.balance<amount)throw new Error('Not enough Play GGX. Reset the practice balance to continue.');if(predictionFor(battleId))throw new Error('A prediction is already pending for this arena.');state.balance-=amount;state.predictions.push({id:crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random()}`,battleId,choice,amount,status:'pending',createdAt:Date.now()});save();renderBalance();setStatus(`Practice prediction saved: ${amount} Play GGX.`,'success');loadBattles().catch(error=>setStatus(error.message,'error'))}
  function resetPlayPoints(){state.balance=100;state.predictions=[];save();renderBalance();setStatus('Practice balance reset to 100 Play GGX.','success');loadBattles().catch(()=>{})}
  function openPanel(){$('#wallet-modal').classList.remove('hidden');renderBalance();loadBattles().catch(error=>setStatus(error.message,'error'));setTimeout(()=>$('#wallet-load-battles-btn').focus(),40)}
  configurePracticeUI();state.balance=readNumber(BALANCE_KEY,100);state.predictions=readJSON(PICKS_KEY,[]);const savedStake=readNumber(STAKE_KEY,5);if([5,10,25,50].includes(savedStake))$('#wallet-bet-amount').value=String(savedStake);renderBalance();
  $('#btn-wallet').addEventListener('click',openPanel);$('#wallet-refresh-btn').addEventListener('click',()=>settlePredictions().catch(error=>setStatus(error.message,'error')));$('#wallet-disconnect-btn').addEventListener('click',resetPlayPoints);$('#wallet-load-battles-btn').addEventListener('click',()=>loadBattles().catch(error=>setStatus(error.message,'error')));$('#wallet-bet-amount').addEventListener('change',event=>{try{localStorage.setItem(STAKE_KEY,event.target.value)}catch(_){}});$('#wallet-battles').addEventListener('click',event=>{const button=event.target.closest('.battle-bet-btn');if(!button)return;try{placePrediction(button.closest('.battle-card'))}catch(error){setStatus(error.message,'error')}});
  window.addEventListener('gogames:spades-match-complete',event=>console.info('[GoGames] Local Spades match complete; Play GGX is unaffected.',event.detail||{}));
})();
