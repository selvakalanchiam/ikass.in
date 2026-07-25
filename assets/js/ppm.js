(function(){
"use strict";
// ---------- Supabase setup ----------
const SUPABASE_URL = 'https://grnjlnrjviagslasqmhq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdybmpsbnJqdmlhZ3NsYXNxbWhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzMjc3MzQsImV4cCI6MjA5NzkwMzczNH0.i9PxQim9ZnUxN9ANSFgCfIE7gQ6uWm6bN1S6RB53P6M';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let entries = [];
let kadans = [];
let timelogs = [];
let tasks = [];
let activeSession = null; // {date, in_datetime, is_active}
let currentHourlyRate = 52; // fallback until fetched
let adminPin = '1234'; // fallback until fetched
let settingsUnlocked = false;
let pinEntry = '';

function setSyncStatus(ok, text){
  document.getElementById('sync-dot').className = 'sync-dot' + (ok ? '' : ' off');
  document.getElementById('sync-text').textContent = text;
}

async function withSync(fn){
  try{
    await fn();
    setSyncStatus(true, 'Synced');
  }catch(err){
    console.error(err);
    setSyncStatus(false, 'Connection issue');
    showToast('⚠️ Could not save — check internet', true);
    throw err;
  }
}

// ---------- Helpers ----------
function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,6); }
function todayStr(){
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function nowTimeStr(){ const d=new Date(); return d.toTimeString().slice(0,5); }
function money(n){
  n = Number(n)||0;
  const neg = n<0; n = Math.abs(n);
  const s = n.toLocaleString('en-IN',{minimumFractionDigits:0,maximumFractionDigits:2});
  return (neg?'-':'') + '₹' + s;
}
function showToast(msg, isError){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (isError ? ' error' : '');
  setTimeout(()=>{ t.classList.remove('show'); }, 2200);
}
function escapeHtml(str){
  const div = document.createElement('div'); div.textContent = str; return div.innerHTML;
}
function fmtMinutes(min){
  min = Math.round(min);
  const h = Math.floor(min/60), m = min%60;
  if(h===0) return m+' min';
  return h+'h '+m+'m';
}
function formatDateTime(iso){
  if(!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
}

// ---------- Tabs ----------
document.querySelectorAll('.tab').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.tab').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.tabpanel').forEach(p=>p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('panel-'+btn.dataset.tab).classList.add('active');
    renderAll();
  });
});

// =================== FETCH FROM SUPABASE ===================
async function fetchEntries(){
  const {data, error} = await sb.from('entries').select('*').order('date', {ascending:false}).order('created_at', {ascending:false});
  if(error) throw error;
  entries = data || [];
}
async function fetchKadans(){
  const {data, error} = await sb.from('kadans').select('*').order('date', {ascending:false}).order('created_at', {ascending:false});
  if(error) throw error;
  kadans = data || [];
}
async function fetchTimelogs(){
  const {data, error} = await sb.from('timelogs').select('*').order('date', {ascending:false}).order('created_at', {ascending:false});
  if(error) throw error;
  timelogs = data || [];
}
async function fetchTasks(){
  const {data, error} = await sb.from('tasks').select('*').order('date', {ascending:false}).order('created_at', {ascending:false});
  if(error) throw error;
  tasks = data || [];
}
async function fetchActiveSession(){
  const {data, error} = await sb.from('active_session').select('*').eq('id', 1).single();
  if(error) throw error;
  activeSession = data;
}
async function fetchSettings(){
  const {data, error} = await sb.from('settings').select('*').eq('id', 1).single();
  if(error) throw error;
  currentHourlyRate = Number(data.hourly_rate);
  adminPin = data.admin_pin || '1234';
}

async function loadAll(){
  setSyncStatus(true, 'Loading...');
  await withSync(async ()=>{
    await Promise.all([fetchEntries(), fetchKadans(), fetchTimelogs(), fetchTasks(), fetchActiveSession(), fetchSettings()]);
  });
  renderAll();
}

// =================== ENTRY TAB ===================
document.getElementById('f-date').value = todayStr();

function updateCategoryUI(){
  const cat = document.getElementById('f-category').value;
  document.getElementById('payment-type-wrap').style.display = cat==='Sell' ? 'block' : 'none';
  if(cat!=='Sell'){
    document.getElementById('full-amount-wrap').style.display='block';
    document.getElementById('partial-amount-wrap').style.display='none';
    document.getElementById('toggle-full').classList.add('active');
    document.getElementById('toggle-partial').classList.remove('active');
  }
  const isTransfer = cat==='Transfer';
  const isPersonal = cat==='Personal';
  document.getElementById('dealer-wrap').style.display = (isTransfer || isPersonal) ? 'none' : 'block';
  document.getElementById('mode-wrap').style.display = isTransfer ? 'none' : 'block';
  document.getElementById('direction-wrap').style.display = isTransfer ? 'block' : 'none';
}
document.getElementById('f-category').addEventListener('change', updateCategoryUI);

document.getElementById('toggle-full').addEventListener('click', ()=>{
  document.getElementById('toggle-full').classList.add('active');
  document.getElementById('toggle-partial').classList.remove('active');
  document.getElementById('full-amount-wrap').style.display='block';
  document.getElementById('partial-amount-wrap').style.display='none';
});
document.getElementById('toggle-partial').addEventListener('click', ()=>{
  document.getElementById('toggle-partial').classList.add('active');
  document.getElementById('toggle-full').classList.remove('active');
  document.getElementById('full-amount-wrap').style.display='none';
  document.getElementById('partial-amount-wrap').style.display='block';
});

document.getElementById('btn-save-entry').addEventListener('click', async ()=>{
  const category = document.getElementById('f-category').value;
  const date = document.getElementById('f-date').value || todayStr();
  const isTransfer = category==='Transfer';
  const isPersonal = category==='Personal';
  const dealer = (isTransfer || isPersonal) ? 'Self' : document.getElementById('f-dealer').value.trim();
  const mode = document.getElementById('f-mode').value;
  const isPartial = category==='Sell' && document.getElementById('toggle-partial').classList.contains('active');

  if(!isTransfer && !isPersonal && !dealer){ showToast('Please enter dealer name', true); return; }

  if(isTransfer){
    const amount = Number(document.getElementById('f-amount').value);
    if(!amount || amount<=0){ showToast('Please enter amount', true); return; }
    const direction = document.getElementById('f-direction').value;
    const fromMode = direction==='CashToDigital' ? 'Cash' : 'Digital';
    const toMode = direction==='CashToDigital' ? 'Digital' : 'Cash';
    await withSync(async ()=>{
      const {error:e1} = await sb.from('entries').insert({date, dealer:'Self', category:'Transfer', mode:fromMode, amount, type:'debit', note:'Transfer to '+toMode});
      if(e1) throw e1;
      const {error:e2} = await sb.from('entries').insert({date, dealer:'Self', category:'Transfer', mode:toMode, amount, type:'credit', note:'Transfer from '+fromMode});
      if(e2) throw e2;
      await fetchEntries();
    });
    document.getElementById('f-amount').value='';
    showToast('✅ Transfer recorded!');
  } else if(isPartial){
    const total = Number(document.getElementById('f-total-amount').value);
    const paidNowRaw = document.getElementById('f-paid-now').value;
    const paidNow = paidNowRaw==='' ? NaN : Number(paidNowRaw);
    if(!total || total<=0){ showToast('Enter the total sale amount', true); return; }
    if(isNaN(paidNow) || paidNow<0){ showToast('Enter amount paid now (0 or more)', true); return; }
    if(paidNow>total){ showToast('Paid amount cannot be more than total', true); return; }
    await withSync(async ()=>{
      // Kadan always stores the FULL sale amount, so it always reflects the true total owed.
      const {data:kadanRow, error:eK} = await sb.from('kadans')
        .insert({dealer, total_amount:total, paid_amount:0, date, status:'Pending', payments:[], source:'sale'})
        .select().single();
      if(eK) throw eK;
      // Always create a linked entry — even when paidNow is 0 — so every sale is
      // visible in Entry/Records, not just buried in the Kadan tab.
      const note = paidNow>0 ? 'Partial payment' : 'Full Kadan — nothing paid yet';
      const {data:entryRow, error:e1} = await sb.from('entries')
        .insert({date, dealer, category:'Sell', mode, amount:paidNow, type:'credit', note, kadan_id:kadanRow.id})
        .select().single();
      if(e1) throw e1;
      if(paidNow>0){
        const newStatus = paidNow>=total ? 'Cleared' : 'Pending';
        const {error:e2} = await sb.from('kadans')
          .update({paid_amount:paidNow, status:newStatus, payments:[{date, amount:paidNow, entryId:entryRow.id, mode}]})
          .eq('id', kadanRow.id);
        if(e2) throw e2;
      }
      await Promise.all([fetchEntries(), fetchKadans()]);
    });
    document.getElementById('f-total-amount').value='';
    document.getElementById('f-paid-now').value='';
    showToast(paidNow>0 ? '✅ Saved! Remaining amount added to Kadan.' : '✅ Saved as full Kadan — nothing paid yet.');
  } else {
    const amount = Number(document.getElementById('f-amount').value);
    if(!amount || amount<=0){ showToast('Please enter amount', true); return; }
    const typeMap = {Sell:'credit', Investment:'debit', Expense:'debit', Salary:'debit', Personal:'debit'};
    await withSync(async ()=>{
      const {error} = await sb.from('entries').insert({date, dealer, category, mode, amount, type:typeMap[category]});
      if(error) throw error;
      await fetchEntries();
    });
    document.getElementById('f-amount').value='';
    showToast('✅ Entry saved!');
  }
  document.getElementById('f-dealer').value='';
  renderAll();
});

function entryAmountHtml(e){
  // Marker entries (a full-Kadan sale where nothing was paid yet) carry amount=0
  // and a kadan_id — show the live Kadan status instead of a meaningless "+₹0".
  if(Number(e.amount)===0 && e.kadan_id){
    const k = kadans.find(x=>x.id===e.kadan_id);
    if(!k) return `<span class="kadan-badge">KADAN (deleted)</span>`;
    const remaining = Number(k.total_amount) - Number(k.paid_amount);
    return k.status==='Cleared'
      ? `<span class="kadan-badge cleared">CLEARED ✓</span>`
      : `<span class="kadan-badge">KADAN ${money(remaining)}</span>`;
  }
  return `<span class="amt ${e.type}">${e.type==='credit'?'+':'-'}${money(e.amount)}</span>`;
}
function renderEntries(){
  const wrap = document.getElementById('entry-list');
  if(entries.length===0){ wrap.innerHTML = '<div class="empty">No entries yet.</div>'; return; }
  wrap.innerHTML = entries.slice(0,30).map(e=>`
    <div class="entry-row">
      <div>
        <div>${escapeHtml(e.dealer)} · ${e.category}${e.note?' ('+e.note+')':''}</div>
        <div class="meta">${e.date} · ${e.mode}</div>
      </div>
      <div style="display:flex;align-items:center;gap:6px;">
        ${entryAmountHtml(e)}
        <button class="del-btn" onclick="deleteEntry('${e.id}')">✕</button>
      </div>
    </div>
  `).join('');
}
async function deleteEntry(id){
  const entry = entries.find(e=>e.id===id);
  let confirmMsg = 'Delete this entry? This cannot be undone.';
  let k = null;
  let isPaymentEntry = false;
  if(entry && entry.kadan_id){
    k = kadans.find(x=>x.id===entry.kadan_id);
    if(k){
      isPaymentEntry = (k.payments||[]).some(p=>p.entryId===id);
      confirmMsg = isPaymentEntry
        ? `Delete this ${money(entry.amount)} payment? The linked Kadan for ${k.dealer} will go back to Pending for that amount.`
        : `Delete this record? The Kadan for ${k.dealer} (${money(Number(k.total_amount)-Number(k.paid_amount))} pending) will stay — manage it from the Kadan tab.`;
    }
  }
  if(!confirm(confirmMsg)) return;
  await withSync(async ()=>{
    if(entry && entry.kadan_id && k){
      const remainingPayments = (k.payments||[]).filter(p=>p.entryId!==id);
      const newPaid = remainingPayments.reduce((s,p)=>s+Number(p.amount),0);
      const newStatus = newPaid >= k.total_amount ? 'Cleared' : 'Pending';
      const {error:eK} = await sb.from('kadans').update({paid_amount:newPaid, status:newStatus, payments:remainingPayments}).eq('id', k.id);
      if(eK) throw eK;
    }
    const {error} = await sb.from('entries').delete().eq('id', id);
    if(error) throw error;
    await Promise.all([fetchEntries(), fetchKadans()]);
  });
  showToast('🗑️ Entry deleted' + (isPaymentEntry ? ' — Kadan updated back to Pending' : ''));
  renderAll();
}

// =================== KADAN TAB ===================
document.getElementById('btn-save-kadan').addEventListener('click', async ()=>{
  const dealer = document.getElementById('k-dealer').value.trim();
  const amount = Number(document.getElementById('k-amount').value);
  if(!dealer || !amount || amount<=0){ showToast('Please enter dealer & amount', true); return; }
  await withSync(async ()=>{
    const {error} = await sb.from('kadans').insert({dealer, total_amount:amount, paid_amount:0, date:todayStr(), status:'Pending', payments:[], source:'manual'});
    if(error) throw error;
    await fetchKadans();
  });
  document.getElementById('k-dealer').value=''; document.getElementById('k-amount').value='';
  showToast('✅ Kadan added!');
  renderAll();
});

async function addPayment(id){
  const dateInput = document.getElementById('pay-date-'+id);
  const amtInput = document.getElementById('pay-'+id);
  const modeInput = document.getElementById('pay-mode-'+id);
  const val = Number(amtInput.value);
  const mode = modeInput.value;
  const payDate = dateInput.value || todayStr();
  if(!val || val<=0){ showToast('Please enter amount', true); return; }
  const k = kadans.find(x=>x.id===id);
  if(!k) return;
  const newPaid = Number(k.paid_amount) + val;
  const newStatus = newPaid >= k.total_amount ? 'Cleared' : 'Pending';

  await withSync(async ()=>{
    // Always record an entry for money actually collected — regardless of whether the
    // Kadan came from a sale or was added manually — so Cash/Digital totals stay accurate.
    const {data, error:e2} = await sb.from('entries')
      .insert({date:payDate, dealer:k.dealer, category:'Sell', mode, amount:val, type:'credit', note:'Kadan payment', kadan_id:k.id})
      .select().single();
    if(e2) throw e2;
    const newPayments = [...(k.payments||[]), {date:payDate, amount:val, entryId:data.id}];
    const {error:e1} = await sb.from('kadans').update({paid_amount:newPaid, status:newStatus, payments:newPayments}).eq('id', id);
    if(e1) throw e1;
    await Promise.all([fetchKadans(), fetchEntries()]);
  });
  showToast(newStatus==='Cleared' ? '🎉 Fully cleared!' : '✅ Payment added!');
  renderAll();
}
async function deleteKadan(id){
  const k = kadans.find(x=>x.id===id);
  if(!k) return;
  const remaining = Number(k.total_amount) - Number(k.paid_amount);
  const confirmMsg = remaining>0
    ? `Delete this Kadan? ${money(remaining)} pending will be removed. Any money already collected stays in your Entry records.`
    : 'Delete this Kadan record? This cannot be undone.';
  if(!confirm(confirmMsg)) return;
  await withSync(async ()=>{
    const linkedEntries = entries.filter(e=>e.kadan_id===id);
    // Pure marker entries (₹0, no real money) are only a reference to this Kadan — remove them too.
    const zeroEntryIds = linkedEntries.filter(e=>Number(e.amount)===0).map(e=>e.id);
    if(zeroEntryIds.length){
      const {error:eD} = await sb.from('entries').delete().in('id', zeroEntryIds);
      if(eD) throw eD;
    }
    // Real payment entries (actual money collected) are kept, just unlinked so they don't
    // point at a deleted Kadan.
    const {error:eU} = await sb.from('entries').update({kadan_id:null}).eq('kadan_id', id);
    if(eU) throw eU;
    const {error} = await sb.from('kadans').delete().eq('id', id);
    if(error) throw error;
    await Promise.all([fetchKadans(), fetchEntries()]);
  });
  showToast('🗑️ Kadan deleted');
  renderAll();
}

function renderKadans(){
  const pending = kadans.filter(k=>k.status==='Pending');
  const cleared = kadans.filter(k=>k.status==='Cleared');
  document.getElementById('pending-label').textContent = 'Pending ('+pending.length+')';
  const pendingWrap = document.getElementById('pending-list');
  if(pending.length===0){
    pendingWrap.innerHTML = '<div class="card"><div class="empty">No pending kadan 👍</div></div>';
  } else {
    pendingWrap.innerHTML = pending.map(k=>{
      const remaining = k.total_amount - k.paid_amount;
      return `
      <div class="kadan-item">
        <div class="kadan-top">
          <span class="kadan-name">${escapeHtml(k.dealer)}</span>
          <span class="kadan-badge">PENDING</span>
        </div>
        <div class="kadan-amounts">
          <span>Total: <b>${money(k.total_amount)}</b></span>
          <span>Paid: <b>${money(k.paid_amount)}</b></span>
          <span>Remaining: <b style="color:var(--rust);">${money(remaining)}</b></span>
        </div>
        <div class="pay-row">
          <input type="date" id="pay-date-${k.id}" value="${todayStr()}" style="flex:0 0 130px;">
          <input type="number" id="pay-${k.id}" placeholder="Payment amount">
          <select id="pay-mode-${k.id}"><option value="Cash">Cash</option><option value="Digital">Digital</option></select>
          <button class="btn small" onclick="addPayment('${k.id}')">Add Payment</button>
          <button class="del-btn" onclick="deleteKadan('${k.id}')">✕</button>
        </div>
      </div>`;
    }).join('');
  }
  const clearedWrap = document.getElementById('cleared-list');
  const clearedLabel = document.getElementById('cleared-label');
  if(cleared.length===0){ clearedLabel.style.display='none'; clearedWrap.innerHTML=''; }
  else {
    clearedLabel.style.display='block';
    clearedLabel.textContent = 'Cleared ('+cleared.length+')';
    clearedWrap.innerHTML = cleared.map(k=>`
      <div class="kadan-item cleared">
        <div class="kadan-top">
          <span class="kadan-name">${escapeHtml(k.dealer)}</span>
          <span class="kadan-badge cleared">CLEARED ✓</span>
        </div>
        <div class="kadan-amounts"><span>Total: <b>${money(k.total_amount)}</b></span></div>
      </div>
    `).join('');
  }
}

// =================== TIME LOG TAB ===================
document.getElementById('t-date-in').value = todayStr();
document.getElementById('t-date-out').value = todayStr();

document.getElementById('btn-save-manual-time').addEventListener('click', async ()=>{
  const dIn = document.getElementById('t-date-in').value;
  const tIn = document.getElementById('t-time-in').value;
  const dOut = document.getElementById('t-date-out').value;
  const tOut = document.getElementById('t-time-out').value;
  if(!dIn || !tIn || !dOut || !tOut){ showToast('Please fill date & time', true); return; }
  const inDT = new Date(dIn+'T'+tIn);
  const outDT = new Date(dOut+'T'+tOut);
  const minutes = (outDT - inDT) / 60000;
  if(minutes<=0){ showToast('Charge Out must be after Charge In', true); return; }
  await withSync(async ()=>{
    const {error} = await sb.from('timelogs').insert({date:dIn, in_time:tIn, out_date:dOut, out_time:tOut, minutes, manual:true, hourly_rate:currentHourlyRate});
    if(error) throw error;
    await fetchTimelogs();
  });
  showToast('✅ Time entry saved!');
  renderAll();
});

function renderTimeLog(){
  const filtered = timelogs.filter(t=>matchesPeriod(t.date, getFilter('time')));
  const totalMinutes = filtered.reduce((s,t)=>s+Number(t.minutes),0);
  const totalSalary = filtered.reduce((s,t)=>s+(Number(t.minutes)/60)*(Number(t.hourly_rate)||currentHourlyRate),0);
  document.getElementById('time-filtered-total').textContent = fmtMinutes(totalMinutes);
  document.getElementById('time-filtered-salary').textContent = money(totalSalary);

  const wrap = document.getElementById('time-list');
  if(filtered.length===0){ wrap.innerHTML = '<div class="card"><div class="empty">No sessions in this period.</div></div>'; return; }
  wrap.innerHTML = filtered.slice(0,100).map(t=>{
    const rate = Number(t.hourly_rate)||currentHourlyRate;
    const sessionSalary = (Number(t.minutes)/60) * rate;
    return `
    <div class="time-item">
      <div class="time-top">
        <span class="kadan-name">${t.date}${t.out_date && t.out_date!==t.date ? ' → '+t.out_date : ''}</span>
        <button class="del-btn" onclick="deleteTimelog('${t.id}')">✕</button>
      </div>
      <div class="time-amounts">
        <span>In: <b>${t.in_time}</b></span>
        <span>Out: <b>${t.out_time}</b></span>
        <span>Total: <b style="color:var(--green-deep);">${fmtMinutes(t.minutes)}</b></span>
        <span>Salary: <b style="color:var(--green-deep);">${money(sessionSalary)}</b> <span style="color:#aaa;font-weight:400;">(@₹${rate}/hr)</span></span>
      </div>
    </div>
  `;
  }).join('');
}
async function deleteTimelog(id){
  if(!confirm('Delete this time session? This cannot be undone.')) return;
  await withSync(async ()=>{
    const {error} = await sb.from('timelogs').delete().eq('id', id);
    if(error) throw error;
    await fetchTimelogs();
  });
  renderAll();
}

// =================== TASKS TAB ===================
document.getElementById('task-date').value = todayStr();

document.getElementById('btn-save-task').addEventListener('click', async ()=>{
  const date = document.getElementById('task-date').value || todayStr();
  const text = document.getElementById('task-text').value.trim();
  const tag = document.getElementById('task-tag').value || 'Other';
  if(!text){ showToast('Please type a task', true); return; }
  await withSync(async ()=>{
    await insertTaskRow({date, text, done:false, tag});
    await fetchTasks();
  });
  document.getElementById('task-text').value='';
  showToast('✅ Task added!');
  renderAll();
});

// ---------- Task tag helpers ----------
async function insertTaskRow(payload){
  const {error} = await sb.from('tasks').insert(payload);
  if(error){
    const missingTagCol = /column .*tag.* does not exist/i.test(error.message||'') || error.code==='42703';
    if(missingTagCol){
      const {tag, ...rest} = payload;
      const {error:retryErr} = await sb.from('tasks').insert(rest);
      if(retryErr) throw retryErr;
      showToast('⚠️ Task saved, but tag wasn\'t — ask admin to add the "tag" column in Supabase', true);
      return;
    }
    throw error;
  }
}
function taskTag(t){ return t.tag || 'Other'; }
function tagBadge(tag){
  const cls = (tag||'Other').toLowerCase();
  const icon = tag==='Pickup' ? '📦 ' : tag==='Deliver' ? '🚚 ' : '';
  return `<span class="task-tag ${cls}">${icon}${escapeHtml(tag||'Other')}</span>`;
}
let taskHistoryFilter = 'all';
let dashTaskFilter = 'all';
function setupTagFilterBar(elId, onChange){
  const bar = document.getElementById(elId);
  if(!bar) return;
  bar.querySelectorAll('.tag-filter-chip').forEach(chip=>{
    chip.addEventListener('click', ()=>{
      bar.querySelectorAll('.tag-filter-chip').forEach(c=>c.classList.remove('active'));
      chip.classList.add('active');
      onChange(chip.dataset.tag);
    });
  });
}
setupTagFilterBar('task-history-filter', (tag)=>{ taskHistoryFilter = tag; renderTaskHistory(); });
setupTagFilterBar('dash-task-filter', (tag)=>{ dashTaskFilter = tag; renderDashTasks(); });

async function toggleTask(id){
  const t = tasks.find(x=>x.id===id);
  if(!t) return;
  const newDone = !t.done;
  const completedAt = newDone ? new Date().toISOString() : null;
  await withSync(async ()=>{
    const {error} = await sb.from('tasks').update({done:newDone, completed_at:completedAt}).eq('id', id);
    if(error) throw error;
    await fetchTasks();
  });
  renderAll();
}
async function deleteTask(id){
  if(!confirm('Delete this task? This cannot be undone.')) return;
  await withSync(async ()=>{
    const {error} = await sb.from('tasks').delete().eq('id', id);
    if(error) throw error;
    await fetchTasks();
  });
  renderAll();
}

function renderTaskHistory(){
  const wrap = document.getElementById('task-history');
  const filtered = taskHistoryFilter==='all' ? tasks : tasks.filter(t=>taskTag(t)===taskHistoryFilter);
  if(filtered.length===0){ wrap.innerHTML = '<div class="card"><div class="empty">No tasks yet.</div></div>'; return; }
  const byDate = {};
  filtered.forEach(t=>{ (byDate[t.date] = byDate[t.date]||[]).push(t); });
  const dates = Object.keys(byDate).sort((a,b)=>b.localeCompare(a));
  wrap.innerHTML = dates.map(d=>`
    <div class="day-heading">${d}</div>
    <div class="card" style="padding:6px 16px;">
      ${byDate[d].map(t=>`
        <div class="task-row">
          <input type="checkbox" ${t.done?'checked':''} onchange="toggleTask('${t.id}')">
          <div class="task-row-main">
            <div class="task-row-top">
              <span class="txt ${t.done?'done':''}">${escapeHtml(t.text)}</span>
              ${tagBadge(taskTag(t))}
            </div>
            ${t.done && t.completed_at ? `<div class="meta" style="margin-top:2px;">✅ Completed: ${formatDateTime(t.completed_at)}</div>` : ''}
          </div>
          <button class="del-btn" onclick="deleteTask('${t.id}')">✕</button>
        </div>
      `).join('')}
    </div>
  `).join('');
}

function renderDashTasks(){
  const today = todayStr();
  const wrap = document.getElementById('dash-today-tasks');
  // Show ALL tasks that are not yet done, regardless of when they were added.
  // Sort oldest pending first so nothing gets buried/forgotten.
  let pendingTasks = tasks.filter(t=>!t.done).sort((a,b)=>(a.date||'').localeCompare(b.date||''));
  if(dashTaskFilter!=='all'){ pendingTasks = pendingTasks.filter(t=>taskTag(t)===dashTaskFilter); }
  if(pendingTasks.length===0){ wrap.innerHTML = '<div class="empty">No pending tasks 👍</div>'; return; }
  wrap.innerHTML = pendingTasks.map(t=>`
    <div class="task-row">
      <input type="checkbox" ${t.done?'checked':''} onchange="toggleTask('${t.id}')">
      <div class="task-row-main">
        <div class="task-row-top">
          <span class="txt ${t.done?'done':''}">${escapeHtml(t.text)}</span>
          ${tagBadge(taskTag(t))}
        </div>
        <div class="meta" style="margin-top:2px;">${t.date===today ? 'Today' : 'Added: '+t.date}</div>
      </div>
      <button class="del-btn" onclick="deleteTask('${t.id}')">✕</button>
    </div>
  `).join('');
}
document.getElementById('dash-task-add').addEventListener('click', async ()=>{
  const text = document.getElementById('dash-task-input').value.trim();
  const tag = document.getElementById('dash-task-tag').value || 'Other';
  if(!text){ showToast('Please type a task', true); return; }
  await withSync(async ()=>{
    await insertTaskRow({date:todayStr(), text, done:false, tag});
    await fetchTasks();
  });
  document.getElementById('dash-task-input').value='';
  renderAll();
});

// =================== DASHBOARD: Charge In/Out ===================
function renderStatus(){
  const banner = document.getElementById('status-banner');
  const btn = document.getElementById('btn-charge-toggle');
  const warnWrap = document.getElementById('dash-warning');

  if(activeSession && activeSession.is_active){
    const inDT = new Date(activeSession.in_datetime);
    banner.className = 'status-banner on';
    banner.innerHTML = `<div>Charge In since</div><div class="time">${inDT.toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</div>`;
    btn.className = 'btn charge-out';
    btn.textContent = '🔴 Charge Out';

    const today = todayStr();
    if(activeSession.date !== today){
      warnWrap.innerHTML = `
        <div class="warning-card">
          <b>⚠️ Forgot to Charge Out?</b>
          You charged in on ${activeSession.date} and haven't charged out yet. Enter the correct Charge Out time:
          <div class="row2" style="margin-top:10px;">
            <input type="date" id="fix-date-out" value="${today}">
            <input type="time" id="fix-time-out" value="${nowTimeStr()}">
          </div>
          <button class="btn warn" onclick="fixActiveSession()">Save & Close Session</button>
        </div>`;
    } else {
      warnWrap.innerHTML = '';
    }
  } else {
    banner.className = 'status-banner off';
    banner.innerHTML = `<div>Status</div><div class="time">OFF</div>`;
    btn.className = 'btn charge-in';
    btn.textContent = '🟢 Charge In';
    warnWrap.innerHTML = '';
  }
}

document.getElementById('btn-charge-toggle').addEventListener('click', async ()=>{
  if(activeSession && activeSession.is_active){
    const outDT = new Date();
    const inDT = new Date(activeSession.in_datetime);
    const minutes = (outDT - inDT) / 60000;
    await withSync(async ()=>{
      const {error:e1} = await sb.from('timelogs').insert({
        date:activeSession.date, in_time:inDT.toTimeString().slice(0,5),
        out_date:todayStr(), out_time:outDT.toTimeString().slice(0,5), minutes, manual:false, hourly_rate:currentHourlyRate
      });
      if(e1) throw e1;
      const {error:e2} = await sb.from('active_session').update({is_active:false}).eq('id',1);
      if(e2) throw e2;
      await Promise.all([fetchTimelogs(), fetchActiveSession()]);
    });
    showToast('✅ Charge Out done! '+fmtMinutes(minutes)+' recorded.');
  } else {
    const nowISO = new Date().toISOString();
    await withSync(async ()=>{
      const {error} = await sb.from('active_session').update({date:todayStr(), in_datetime:nowISO, is_active:true}).eq('id',1);
      if(error) throw error;
      await fetchActiveSession();
    });
    showToast('🟢 Charge In done!');
  }
  renderAll();
});

async function fixActiveSession(){
  const dOut = document.getElementById('fix-date-out').value;
  const tOut = document.getElementById('fix-time-out').value;
  if(!dOut || !tOut){ showToast('Please fill date & time', true); return; }
  const inDT = new Date(activeSession.in_datetime);
  const outDT = new Date(dOut+'T'+tOut);
  const minutes = (outDT - inDT) / 60000;
  if(minutes<=0){ showToast('Out time must be after In time', true); return; }
  await withSync(async ()=>{
    const {error:e1} = await sb.from('timelogs').insert({
      date:activeSession.date, in_time:inDT.toTimeString().slice(0,5),
      out_date:dOut, out_time:tOut, minutes, manual:true, hourly_rate:currentHourlyRate
    });
    if(e1) throw e1;
    const {error:e2} = await sb.from('active_session').update({is_active:false}).eq('id',1);
    if(e2) throw e2;
    await Promise.all([fetchTimelogs(), fetchActiveSession()]);
  });
  showToast('✅ Session fixed & closed!');
  renderAll();
}

// =================== DASHBOARD: Quick Stats ===================
function renderDashStats(){
  const today = todayStr();
  const todayEarn = entries.filter(e=>e.date===today && e.category==='Sell').reduce((s,e)=>s+Number(e.amount),0);
  const totalPending = kadans.filter(k=>k.status==='Pending').reduce((s,k)=>s+(Number(k.total_amount)-Number(k.paid_amount)),0);
  document.getElementById('dash-today-earn').textContent = money(todayEarn);
  document.getElementById('dash-pending').textContent = money(totalPending);

  // This month's hours & salary — each session uses the rate that was active when it was logged
  const now = new Date();
  const curMonth = now.getMonth()+1, curYear = now.getFullYear();
  const monthSessions = timelogs.filter(t=>{
    if(!t.date) return false;
    const d = new Date(t.date+'T00:00:00');
    return d.getFullYear()===curYear && d.getMonth()+1===curMonth;
  });
  const monthMinutes = monthSessions.reduce((s,t)=>s+Number(t.minutes),0);
  const salaryEarned = monthSessions.reduce((s,t)=>s+(Number(t.minutes)/60)*(Number(t.hourly_rate)||currentHourlyRate),0);

  document.getElementById('sal-hours').textContent = fmtMinutes(monthMinutes);
  document.getElementById('sal-due').textContent = money(salaryEarned);
}

// =================== ACCOUNTS / FINANCIAL DASHBOARD ===================
function renderAccounts(){
  const f = getFilter('acc');
  const fEntries = entries.filter(e=>matchesPeriod(e.date, f));
  const fTimelogs = timelogs.filter(t=>matchesPeriod(t.date, f));

  // P&L — filtered by selected period
  const totalInvestment = fEntries.filter(e=>e.category==='Investment').reduce((s,e)=>s+Number(e.amount),0);
  const totalEarnings = fEntries.filter(e=>e.category==='Sell').reduce((s,e)=>s+Number(e.amount),0);
  const totalExpenses = fEntries.filter(e=>e.category==='Expense').reduce((s,e)=>s+Number(e.amount),0);
  const totalSalary = fEntries.filter(e=>e.category==='Salary').reduce((s,e)=>s+Number(e.amount),0);
  const totalPersonal = fEntries.filter(e=>e.category==='Personal').reduce((s,e)=>s+Number(e.amount),0);
  const profit = totalEarnings - totalInvestment - totalExpenses - totalSalary;

  // Cash / Digital balance — ALWAYS all-time (balance is cumulative, carries forward every month)
  const cashIn = entries.filter(e=>e.mode==='Cash' && e.type==='credit').reduce((s,e)=>s+Number(e.amount),0);
  const cashOut = entries.filter(e=>e.mode==='Cash' && e.type==='debit').reduce((s,e)=>s+Number(e.amount),0);
  const digIn = entries.filter(e=>e.mode==='Digital' && e.type==='credit').reduce((s,e)=>s+Number(e.amount),0);
  const digOut = entries.filter(e=>e.mode==='Digital' && e.type==='debit').reduce((s,e)=>s+Number(e.amount),0);

  // Kadan pending — always live snapshot
  const totalPending = kadans.filter(k=>k.status==='Pending').reduce((s,k)=>s+(Number(k.total_amount)-Number(k.paid_amount)),0);
  const pendingCount = kadans.filter(k=>k.status==='Pending').length;

  const totalMinutes = fTimelogs.reduce((s,t)=>s+Number(t.minutes),0);

  document.getElementById('acc-investment').textContent = money(totalInvestment);
  document.getElementById('acc-earnings').textContent = money(totalEarnings);
  document.getElementById('acc-expenses').textContent = money(totalExpenses);
  document.getElementById('acc-profit').textContent = money(Math.abs(profit));
  document.getElementById('acc-profit-label').textContent = profit>=0 ? 'Profit' : 'Loss';
  document.getElementById('acc-profit-card').className = 'stat ' + (profit>=0 ? 'profit' : 'loss');

  document.getElementById('acc-cash').textContent = money(cashIn-cashOut);
  document.getElementById('acc-digital').textContent = money(digIn-digOut);
  document.getElementById('acc-pending').textContent = money(totalPending);
  document.getElementById('acc-pending-count').textContent = pendingCount + ' dealers pending (current, not period-based)';
  document.getElementById('acc-total-hours').textContent = fmtMinutes(totalMinutes);
  document.getElementById('acc-salary').textContent = money(totalSalary);
  document.getElementById('acc-personal').textContent = money(totalPersonal);
}

// =================== RECORDS (All entries with filter) ===================
function renderRecords(){
  const f = getFilter('rec');
  const filtered = entries.filter(e=>matchesPeriod(e.date, f));
  const totalCredit = filtered.filter(e=>e.type==='credit').reduce((s,e)=>s+Number(e.amount),0);
  const totalDebit = filtered.filter(e=>e.type==='debit').reduce((s,e)=>s+Number(e.amount),0);
  document.getElementById('rec-total-credit').textContent = 'Earnings: ' + money(totalCredit);
  document.getElementById('rec-total-debit').textContent = 'Spent: ' + money(totalDebit);

  const wrap = document.getElementById('records-list');
  if(filtered.length===0){ wrap.innerHTML = '<div class="empty">No entries in this period.</div>'; return; }
  wrap.innerHTML = filtered.map(e=>`
    <div class="entry-row">
      <div>
        <div>${escapeHtml(e.dealer)} · ${e.category}${e.note?' ('+e.note+')':''}</div>
        <div class="meta">${e.date} · ${e.mode}</div>
      </div>
      <div style="display:flex;align-items:center;gap:6px;">
        ${entryAmountHtml(e)}
        <button class="del-btn" onclick="deleteEntry('${e.id}')">✕</button>
      </div>
    </div>
  `).join('');
}

// =================== DEALERS (Profile view) ===================
let openDealerName = null;

function getDealerSummaries(){
  const names = new Set();
  entries.forEach(e=>{ if(e.dealer && e.dealer!=='Self') names.add(e.dealer); });
  kadans.forEach(k=>{ if(k.dealer && k.dealer!=='Self') names.add(k.dealer); });

  const list = Array.from(names).map(name=>{
    const dEntries = entries.filter(e=>e.dealer===name);
    const dKadans = kadans.filter(k=>k.dealer===name);
    const totalCredit = dEntries.filter(e=>e.type==='credit').reduce((s,e)=>s+Number(e.amount),0);
    const totalDebit = dEntries.filter(e=>e.type==='debit').reduce((s,e)=>s+Number(e.amount),0);
    const pendingKadan = dKadans.filter(k=>k.status==='Pending').reduce((s,k)=>s+(Number(k.total_amount)-Number(k.paid_amount)),0);
    const lastDate = dEntries.length ? dEntries[0].date : (dKadans.length ? dKadans[0].date : '');
    return {name, totalCredit, totalDebit, pendingKadan, entryCount:dEntries.length, lastDate, entries:dEntries, kadans:dKadans};
  });
  list.sort((a,b)=> (b.lastDate||'').localeCompare(a.lastDate||''));
  return list;
}

function renderDealers(){
  const search = (document.getElementById('dealer-search').value || '').trim().toLowerCase();
  const wrap = document.getElementById('dealers-list');
  let list = getDealerSummaries();
  if(search) list = list.filter(d=>d.name.toLowerCase().includes(search));

  if(list.length===0){ wrap.innerHTML = '<div class="card"><div class="empty">No dealers found.</div></div>'; return; }

  wrap.innerHTML = list.map(d=>{
    const isOpen = openDealerName===d.name;
    return `
    <div class="dealer-card" onclick="toggleDealer('${escapeHtml(d.name).replace(/'/g,"\\'")}')">
      <div class="dealer-head">
        <span class="dealer-name">${escapeHtml(d.name)}</span>
        <span class="chevron ${isOpen?'open':''}">▼</span>
      </div>
      <div class="dealer-stats">
        <span>Sales/Credit: <b style="color:var(--green-deep);">${money(d.totalCredit)}</b></span>
        <span>Given/Debit: <b style="color:var(--rust);">${money(d.totalDebit)}</b></span>
        ${d.pendingKadan>0 ? `<span>Pending Kadan: <b style="color:var(--rust);">${money(d.pendingKadan)}</b></span>` : ''}
        <span>Entries: <b>${d.entryCount}</b></span>
      </div>
      <div class="dealer-detail ${isOpen?'open':''}" onclick="event.stopPropagation()">
        ${renderDealerDetail(d)}
      </div>
    </div>`;
  }).join('');
}

function renderDealerDetail(d){
  let html = '';
  if(d.kadans.length){
    html += `<div class="day-heading">Kadan History</div>`;
    html += d.kadans.map(k=>{
      const remaining = k.total_amount - k.paid_amount;
      return `<div class="kadan-item ${k.status==='Cleared'?'cleared':''}" style="margin-bottom:8px;">
        <div class="kadan-top">
          <span style="font-size:13px;">${k.date}</span>
          <span class="kadan-badge ${k.status==='Cleared'?'cleared':''}">${k.status.toUpperCase()}</span>
        </div>
        <div class="kadan-amounts">
          <span>Total: <b>${money(k.total_amount)}</b></span>
          <span>Paid: <b>${money(k.paid_amount)}</b></span>
          ${k.status==='Pending' ? `<span>Remaining: <b style="color:var(--rust);">${money(remaining)}</b></span>` : ''}
        </div>
      </div>`;
    }).join('');
  }
  if(d.entries.length){
    html += `<div class="day-heading">Entry History</div>`;
    html += d.entries.map(e=>`
      <div class="entry-row">
        <div>
          <div>${e.category}${e.note?' ('+e.note+')':''}</div>
          <div class="meta">${e.date} · ${e.mode}</div>
        </div>
        ${entryAmountHtml(e)}
      </div>
    `).join('');
  }
  if(!d.kadans.length && !d.entries.length){
    html = '<div class="empty">No records.</div>';
  }
  return html;
}

function toggleDealer(name){
  openDealerName = openDealerName===name ? null : name;
  renderAll();
}

document.getElementById('dealer-search').addEventListener('input', renderDealers);

// =================== PERIOD FILTER HELPERS ===================
const filterState = {
  rec: {type:'month', month:new Date().getMonth()+1, year:new Date().getFullYear()},
  acc: {type:'month', month:new Date().getMonth()+1, year:new Date().getFullYear()},
  time: {type:'month', month:new Date().getMonth()+1, year:new Date().getFullYear()}
};
function getFilter(prefix){ return filterState[prefix]; }

function matchesPeriod(dateStr, f){
  if(!f || f.type==='all') return true;
  if(!dateStr) return false;
  const d = new Date(dateStr+'T00:00:00');
  const y = d.getFullYear(), m = d.getMonth()+1;
  if(f.type==='year') return y===Number(f.year);
  if(f.type==='month') return y===Number(f.year) && m===Number(f.month);
  return true;
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function setupFilterUI(prefix, onChange){
  const typeSel = document.getElementById(prefix+'-filter-type');
  const monthSel = document.getElementById(prefix+'-filter-month');
  const yearSel = document.getElementById(prefix+'-filter-year');

  const thisYear = new Date().getFullYear();
  monthSel.innerHTML = MONTH_NAMES.map((mn,i)=>`<option value="${i+1}">${mn}</option>`).join('');
  monthSel.value = filterState[prefix].month;
  yearSel.innerHTML = '';
  for(let y=thisYear-5; y<=thisYear+1; y++){
    yearSel.innerHTML += `<option value="${y}">${y}</option>`;
  }
  yearSel.value = filterState[prefix].year;
  typeSel.value = filterState[prefix].type;

  function updateVisibility(){
    const type = typeSel.value;
    monthSel.style.display = type==='month' ? 'block' : 'none';
    yearSel.style.display = (type==='month' || type==='year') ? 'block' : 'none';
  }
  updateVisibility();

  typeSel.addEventListener('change', ()=>{
    filterState[prefix].type = typeSel.value;
    updateVisibility();
    onChange();
  });
  monthSel.addEventListener('change', ()=>{
    filterState[prefix].month = Number(monthSel.value);
    onChange();
  });
  yearSel.addEventListener('change', ()=>{
    filterState[prefix].year = Number(yearSel.value);
    onChange();
  });
}

setupFilterUI('rec', renderRecords);
setupFilterUI('acc', renderAccounts);
setupFilterUI('time', renderTimeLog);

let dealerNamesList = [];
function updateDealerSuggestions(){
  const names = new Set();
  entries.forEach(e=>{ if(e.dealer && e.dealer!=='Self') names.add(e.dealer); });
  kadans.forEach(k=>{ if(k.dealer && k.dealer!=='Self') names.add(k.dealer); });
  dealerNamesList = Array.from(names).sort();
}

function attachDealerAutocomplete(inputId, listId){
  const input = document.getElementById(inputId);
  const list = document.getElementById(listId);
  if(!input || !list) return;
  function render(){
    const q = input.value.trim().toLowerCase();
    const matches = q ? dealerNamesList.filter(n=>n.toLowerCase().includes(q)) : dealerNamesList;
    if(matches.length===0){
      list.innerHTML = `<div class="autocomplete-empty">${q ? 'No matching dealer — type to add new' : 'No dealers yet'}</div>`;
    } else {
      list.innerHTML = matches.slice(0,50).map(n=>`<div class="autocomplete-item">${escapeHtml(n)}</div>`).join('');
    }
    list.classList.add('show');
  }
  input.addEventListener('focus', render);
  input.addEventListener('input', render);
  list.addEventListener('mousedown', (e)=>{
    const item = e.target.closest('.autocomplete-item');
    if(!item) return;
    input.value = item.textContent;
    list.classList.remove('show');
  });
  list.addEventListener('touchstart', (e)=>{
    const item = e.target.closest('.autocomplete-item');
    if(!item) return;
    input.value = item.textContent;
    list.classList.remove('show');
  }, {passive:true});
  input.addEventListener('blur', ()=>{
    setTimeout(()=>{ list.classList.remove('show'); }, 150);
  });
}
attachDealerAutocomplete('f-dealer','f-dealer-list');
attachDealerAutocomplete('k-dealer','k-dealer-list');

// ---------- Render everything ----------
// Sub-tabs inside Data page
document.querySelectorAll('.sub-tab').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.sub-tab').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.subpanel').forEach(p=>p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('sub-'+btn.dataset.sub).classList.add('active');
  });
});

// =================== SETTINGS (PIN protected) ===================
function renderSettingsLock(){
  const lockedView = document.getElementById('settings-locked-view');
  const unlockedView = document.getElementById('settings-unlocked-view');
  if(!lockedView) return;
  if(settingsUnlocked){
    lockedView.style.display = 'none';
    unlockedView.style.display = 'block';
    const rateInput = document.getElementById('settings-rate-input');
    if(rateInput && document.activeElement !== rateInput){
      rateInput.value = currentHourlyRate;
    }
  } else {
    lockedView.style.display = 'block';
    unlockedView.style.display = 'none';
    updatePinDots();
  }
}

function updatePinDots(){
  const dots = document.querySelectorAll('#pin-dots .dot');
  dots.forEach((d,i)=>{ d.classList.toggle('filled', i < pinEntry.length); });
}

function pinPress(digit){
  if(pinEntry.length>=4) return;
  pinEntry += digit;
  document.getElementById('pin-error').textContent = '';
  updatePinDots();
  if(pinEntry.length===4){
    setTimeout(()=>{
      if(pinEntry === adminPin){
        settingsUnlocked = true;
        pinEntry = '';
        renderSettingsLock();
      } else {
        document.getElementById('pin-error').textContent = 'Incorrect PIN, try again';
        pinEntry = '';
        updatePinDots();
      }
    }, 150);
  }
}
function pinBackspace(){
  pinEntry = pinEntry.slice(0,-1);
  document.getElementById('pin-error').textContent = '';
  updatePinDots();
}
function pinClear(){
  pinEntry = '';
  document.getElementById('pin-error').textContent = '';
  updatePinDots();
}
function lockSettings(){
  settingsUnlocked = false;
  renderSettingsLock();
}

document.getElementById('btn-save-rate').addEventListener('click', async ()=>{
  const newRate = Number(document.getElementById('settings-rate-input').value);
  if(!newRate || newRate<=0){ showToast('Please enter a valid rate', true); return; }
  await withSync(async ()=>{
    const {error} = await sb.from('settings').update({hourly_rate:newRate}).eq('id', 1);
    if(error) throw error;
    await fetchSettings();
  });
  showToast('✅ Rate updated to ₹'+newRate+'/hour for future sessions!');
  renderAll();
});

document.getElementById('btn-save-pin').addEventListener('click', async ()=>{
  const newPin = document.getElementById('settings-new-pin').value.trim();
  if(!/^\d{4}$/.test(newPin)){ showToast('PIN must be exactly 4 digits', true); return; }
  await withSync(async ()=>{
    const {error} = await sb.from('settings').update({admin_pin:newPin}).eq('id', 1);
    if(error) throw error;
    await fetchSettings();
  });
  document.getElementById('settings-new-pin').value = '';
  showToast('✅ Admin PIN updated!');
});

function renderAll(){
  renderEntries();
  renderKadans();
  renderTimeLog();
  renderTaskHistory();
  renderDashTasks();
  renderStatus();
  renderDashStats();
  renderAccounts();
  renderRecords();
  renderDealers();
  updateDealerSuggestions();
  renderSettingsLock();
}

setTimeout(()=>{
  const splash = document.getElementById('splash-screen');
  if(splash) splash.style.display = 'none';
}, 2300);

updateCategoryUI();
loadAll();


// expose handlers referenced via inline onclick="..." in generated HTML
  window.lockSettings = lockSettings;
  window.pinBackspace = pinBackspace;
  window.pinClear = pinClear;
  window.pinPress = pinPress;
  window.addPayment = addPayment;
  window.deleteEntry = deleteEntry;
  window.deleteKadan = deleteKadan;
  window.deleteTask = deleteTask;
  window.deleteTimelog = deleteTimelog;
  window.fixActiveSession = fixActiveSession;
  window.toggleDealer = toggleDealer;
})();