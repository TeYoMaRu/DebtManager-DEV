const STORAGE_KEY = "my_money_flow_v2";
const SUPABASE_URL = "https://teqpvdsxihbgknicupvj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlcXB2ZHN4aWhiZ2tuaWN1cHZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMDg4MDUsImV4cCI6MjA5NTg4NDgwNX0.cMCBlzvRpHn9crzHcPavFVCsrvgaweBbXvjxF7ezhI8";

const sb = window.supabase?.createClient
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

let currentUser = null;
let cloudTimer = null;
let authMode = "login";

function defaultState(){
  return {
    balanceAdjustment:0,
    debts:[],
    payments:[],
    incomes:[],
    rotations:[],
    expenses:[],
    rotationPlans:[]
  };
}

function loadState(){
  try{
    const old = JSON.parse(localStorage.getItem(STORAGE_KEY) || localStorage.getItem("my_money_flow_v1") || "null");
    return { ...defaultState(), ...(old || {}) };
  }catch{
    return defaultState();
  }
}

const state = loadState();

function persistLocal(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function saveState(){
  persistLocal();
  queueCloudSync();
}

function replaceState(next){
  const clean = { ...defaultState(), ...(next || {}) };
  Object.keys(state).forEach(k=>delete state[k]);
  Object.assign(state, clean);
  persistLocal();
}

function queueCloudSync(){
  if(!currentUser || !sb) return;
  clearTimeout(cloudTimer);
  setCloudStatus("syncing","☁️ กำลังซิงก์");
  cloudTimer=setTimeout(()=>syncToCloud(false),550);
}

async function syncToCloud(showToast=true){
  if(!currentUser || !sb) return false;
  setCloudStatus("syncing","☁️ กำลังซิงก์");
  const { error } = await sb.from("money_flow_state").upsert({
    user_id: currentUser.id,
    data: state,
    updated_at: new Date().toISOString()
  }, { onConflict:"user_id" });

  if(error){
    console.error(error);
    setCloudStatus("error","⚠️ ซิงก์ไม่สำเร็จ");
    if(showToast) toast("ซิงก์ Supabase ไม่สำเร็จ");
    return false;
  }
  setCloudStatus("online","☁️ ซิงก์แล้ว");
  const el=byId("lastSyncText");
  if(el) el.textContent="ซิงก์ล่าสุด "+new Date().toLocaleTimeString("th-TH",{hour:"2-digit",minute:"2-digit"});
  if(showToast) toast("ซิงก์ข้อมูลแล้ว");
  return true;
}

async function loadCloudState(){
  if(!currentUser || !sb) return;
  setCloudStatus("syncing","☁️ กำลังโหลด");
  const { data, error } = await sb.from("money_flow_state")
    .select("data, updated_at")
    .eq("user_id",currentUser.id)
    .maybeSingle();

  if(error){
    console.error(error);
    setCloudStatus("error","⚠️ โหลด Cloud ไม่สำเร็จ");
    return;
  }

  if(data?.data){
    replaceState(data.data);
    renderAll();
    setCloudStatus("online","☁️ ซิงก์แล้ว");
    if(data.updated_at && byId("lastSyncText")){
      byId("lastSyncText").textContent="Cloud อัปเดต "+new Date(data.updated_at).toLocaleString("th-TH");
    }
  }else{
    await syncToCloud(false);
  }
}

function setCloudStatus(mode,text){
  const el=byId("cloudStatus");
  if(!el) return;
  el.className="cloud-status "+mode;
  el.textContent=text;
}

async function initAuth(){
  if(!sb){
    setCloudStatus("error","⚠️ โหลด Supabase ไม่ได้");
    return;
  }
  const { data:{ session } } = await sb.auth.getSession();
  currentUser=session?.user || null;
  updateAuthUI();
  if(currentUser) await loadCloudState();

  sb.auth.onAuthStateChange(async (_event,session)=>{
    currentUser=session?.user || null;
    updateAuthUI();
    if(currentUser) await loadCloudState();
  });
}

function updateAuthUI(){
  const signed=!!currentUser;
  byId("authSignedOut")?.classList.toggle("hidden",signed);
  byId("authSignedIn")?.classList.toggle("hidden",!signed);
  if(signed){
    byId("accountEmail").textContent=currentUser.email || currentUser.id;
    setCloudStatus("online","☁️ เชื่อมต่อแล้ว");
    byId("accountBtn").textContent="บัญชี";
  }else{
    setCloudStatus("offline","☁️ ยังไม่ได้เข้าสู่ระบบ");
    if(byId("accountEmail")) byId("accountEmail").textContent="-";
  }
}

function uid(prefix="id"){ return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`; }
function num(v){ return Number(v||0); }
function money(n){ return new Intl.NumberFormat("th-TH",{style:"currency",currency:"THB",maximumFractionDigits:0}).format(num(n)); }
function isoDate(d=new Date()){ const z=new Date(d.getTime()-d.getTimezoneOffset()*60000); return z.toISOString().slice(0,10); }
function todayKey(){ return isoDate(); }
function parseDate(s){ return new Date(`${s}T00:00:00`); }
function monthKey(s){ return s?.slice(0,7)||""; }
function thaiDate(s){ return s?parseDate(s).toLocaleDateString("th-TH",{day:"numeric",month:"short",year:"2-digit"}):"-"; }
function byId(id){ return document.getElementById(id); }
function toast(msg){ const t=byId("toast"); if(!t)return; t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2200); }

const pageTitles={dashboard:"ภาพรวม",calendar:"รายการต้องจ่าย",debts:"หนี้ทั้งหมด",income:"เงินเข้า",rotation:"เงินหมุน",forecast:"แผนล่วงหน้า"};

document.querySelectorAll(".nav-item").forEach(btn=>{
  btn.addEventListener("click",()=>{
    document.querySelectorAll(".nav-item").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
    byId(btn.dataset.page).classList.add("active");
    byId("pageTitle").textContent=pageTitles[btn.dataset.page];
    renderAll();
    window.scrollTo({top:0,behavior:"smooth"});
  });
});

byId("todayText").textContent=new Date().toLocaleDateString("th-TH",{weekday:"long",day:"numeric",month:"long",year:"numeric"});

/* ===== Auth UI ===== */
const authModal=byId("authModal");
function openAuth(){ authModal.classList.remove("hidden"); updateAuthUI(); }
function closeAuth(){ authModal.classList.add("hidden"); }
byId("accountBtn").onclick=openAuth;
byId("closeAuthBtn").onclick=closeAuth;
authModal.addEventListener("click",e=>{if(e.target===authModal)closeAuth();});
document.querySelectorAll(".auth-tab").forEach(b=>b.onclick=()=>{
  authMode=b.dataset.authMode;
  document.querySelectorAll(".auth-tab").forEach(x=>x.classList.toggle("active",x===b));
  byId("authSubmitBtn").textContent=authMode==="login"?"เข้าสู่ระบบ":"สมัครบัญชี";
  byId("authPassword").autocomplete=authMode==="login"?"current-password":"new-password";
});
byId("authForm").addEventListener("submit",async e=>{
  e.preventDefault();
  if(!sb) return toast("โหลด Supabase ไม่สำเร็จ");
  const email=byId("authEmail").value.trim();
  const password=byId("authPassword").value;
  byId("authSubmitBtn").disabled=true;
  byId("authSubmitBtn").textContent="กำลังดำเนินการ...";
  try{
    if(authMode==="register"){
      const {data,error}=await sb.auth.signUp({email,password});
      if(error) throw error;
      if(!data.session){
        toast("สมัครแล้ว กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ");
      }else{
        toast("สมัครและเข้าสู่ระบบแล้ว");
      }
    }else{
      const {error}=await sb.auth.signInWithPassword({email,password});
      if(error) throw error;
      toast("เข้าสู่ระบบแล้ว");
    }
  }catch(err){
    console.error(err);
    alert("Supabase: "+(err.message||"เกิดข้อผิดพลาด"));
  }finally{
    byId("authSubmitBtn").disabled=false;
    byId("authSubmitBtn").textContent=authMode==="login"?"เข้าสู่ระบบ":"สมัครบัญชี";
  }
});
byId("logoutBtn").onclick=async()=>{ if(sb) await sb.auth.signOut(); closeAuth(); toast("ออกจากระบบแล้ว"); };
byId("syncNowBtn").onclick=()=>syncToCloud(true);

/* ===== Add data modal ===== */
const addModal=byId("addModal"), dataForm=byId("dataForm");
let currentType="debt";
function openModal(type="debt"){currentType=type;setActiveType();buildForm();addModal.classList.remove("hidden");}
function closeModal(){addModal.classList.add("hidden");}
byId("openAddBtn").onclick=()=>openModal();
byId("fabAdd").onclick=()=>openModal();
byId("closeModalBtn").onclick=closeModal;
byId("cancelBtn").onclick=closeModal;
addModal.addEventListener("click",e=>{if(e.target===addModal)closeModal();});
document.querySelectorAll(".add-type").forEach(btn=>btn.onclick=()=>{currentType=btn.dataset.type;setActiveType();buildForm();});
function setActiveType(){document.querySelectorAll(".add-type").forEach(b=>b.classList.toggle("active",b.dataset.type===currentType));}

const field=(name,label,type="text",extra="")=>`<div class="field"><label for="${name}">${label}</label><input id="${name}" name="${name}" type="${type}" ${extra}></div>`;
const selectField=(name,label,options)=>`<div class="field"><label for="${name}">${label}</label><select id="${name}" name="${name}">${options.map(o=>`<option value="${o[0]}">${o[1]}</option>`).join("")}</select></div>`;

function buildForm(){
  const today=todayKey(), now=new Date(), ym=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  const next=new Date();next.setMonth(next.getMonth()+1);

  if(currentType==="debt"){
    dataForm.innerHTML=`
      ${selectField("debtKind","ประเภทหนี้",[["credit_card","บัตรเครดิต"],["installment","ผ่อนคงที่"],["loan","สินเชื่อ / เงินกู้"],["statement","ยอดตามใบแจ้งหนี้"]])}
      ${field("name","ชื่อหนี้ / ชื่อบัตร","text",'required placeholder="เช่น เครดิต A"')}
      ${field("totalDebt","ยอดหนี้คงเหลือเดิม","number",'min="0" step="0.01" required')}
      ${field("currentBill","ยอดเรียกเก็บ / ตั้งใจจ่ายรอบนี้","number",'min="0" step="0.01" required')}
      ${field("minimumDue","ยอดขั้นต่ำ (ถ้ามี)","number",'min="0" step="0.01" value="0"')}
      ${field("dueDate","วันครบกำหนดรอบนี้","date",`value="${today}" required`)}
      ${field("statementDay","วันตัดรอบ (ถ้ามี)","number",'min="1" max="31"')}
      ${selectField("payer","ผู้จ่ายเจ้าหนี้",[["me","ฉัน"],["partner","แฟน"],["other","คนอื่น"]])}
      <div class="field full"><small>ยอดหนี้คงเหลือ กับยอดที่ต้องจ่ายรอบนี้ แยกจากกัน เพื่อรองรับบัตรแต่ละใบที่คิดไม่เหมือนกัน</small></div>`;
  }else if(currentType==="shared"){
    dataForm.innerHTML=`
      ${selectField("sharedMode","รูปแบบหนี้ร่วม",[["one_time","ยอดร่วมครั้งเดียว"],["installment","ผ่อนร่วมคงที่ / มีจำนวนงวด"]])}
      ${field("name","ชื่อหนี้ร่วม","text",'required placeholder="เช่น รถ / SEasyCash"')}
      ${field("totalAmount","ยอดหนี้รวม / ยอดรอบนี้","number",'min="0" step="0.01" required')}
      ${field("installmentAmount","ยอดต่องวด","number",'min="0" step="0.01" value="0"')}
      ${field("installments","จำนวนงวดทั้งหมด","number",'min="1" value="1"')}
      ${field("paidInstallments","จ่ายมาแล้วกี่งวด","number",'min="0" value="0"')}
      ${field("myShare","ส่วนของฉันต่องวด","number",'min="0" step="0.01" required')}
      ${field("partnerShare","ส่วนของแฟน / คนอื่นต่องวด","number",'min="0" step="0.01" required')}
      ${field("transferDate","วันที่อีกฝ่ายควรโอนงวดแรก","date",`value="${today}" required`)}
      ${field("dueDate","วันครบกำหนดงวดถัดไป","date",`value="${today}" required`)}
      ${selectField("payer","ผู้จ่ายเจ้าหนี้",[["me","ฉัน"],["partner","แฟน"],["other","คนอื่น"]])}
      ${field("partnerName","ชื่อผู้ร่วมจ่าย","text",'value="แฟน"')}
      <div class="field full"><small>ถ้าเลือก “ผ่อนร่วมคงที่” ระบบจะสร้างงวดที่เหลือให้อัตโนมัติ</small></div>`;
  }else if(currentType==="income"){
    dataForm.innerHTML=`
      ${field("name","ชื่อเงินเข้า","text",'required placeholder="เช่น เงินเดือน"')}
      ${field("amount","จำนวนเงิน","number",'min="0" step="0.01" required')}
      ${field("date","วันที่เงินเข้า","date",`value="${today}" required`)}
      ${selectField("kind","ประเภท",[["income","รายได้จริง"],["pass_through","เงินผ่านมือ / เงินสำหรับจ่ายหนี้"]])}
      ${field("note","หมายเหตุ","text",'placeholder="เช่น เงินที่แฟนโอนมาสำหรับหนี้ A"')}`;
  }else if(currentType==="expense"){
    dataForm.innerHTML=`
      ${field("name","รายการค่าใช้จ่าย","text",'required')}
      ${field("amount","จำนวนเงิน","number",'min="0" step="0.01" required')}
      ${field("dueDate","วันครบกำหนด","date",`value="${today}" required`)}
      ${selectField("recurring","เกิดซ้ำ",[["no","ครั้งเดียว"],["monthly","ทุกเดือน"]])}
      ${field("months","สร้างล่วงหน้ากี่เดือน","number",'min="1" value="1"')}`;
  }else if(currentType==="rotation"){
    dataForm.innerHTML=`
      ${field("name","ชื่อเงินหมุน / แหล่งยืม","text",'required')}
      ${field("received","รับมา","number",'min="0" step="0.01" required')}
      ${field("receiveDate","วันที่รับเงิน","date",`value="${today}" required`)}
      ${field("repayTotal","ยอดที่ต้องคืนทั้งหมด","number",'min="0" step="0.01" required')}
      ${field("repayDate","วันเริ่มคืน","date",`value="${isoDate(next)}" required`)}
      ${field("installments","จำนวนงวดที่คืน","number",'min="1" value="1" required')}`;
  }else if(currentType==="balance"){
    dataForm.innerHTML=`<div class="field full"><label for="balance">ยอดเงินจริงปัจจุบัน</label><input id="balance" name="balance" type="number" step="0.01" value="${getCurrentBalance()}" required><small>ใส่ค่าติดลบได้ เช่น -8500</small></div>`;
  }
}

function formData(){return Object.fromEntries(new FormData(dataForm).entries());}
function addMonthsToDate(ds,add){const d=parseDate(ds);d.setMonth(d.getMonth()+add);return isoDate(d);}
function makeMonthlyDate(ds,add){const d=parseDate(ds);const day=d.getDate();const target=new Date(d.getFullYear(),d.getMonth()+add,1);const last=new Date(target.getFullYear(),target.getMonth()+1,0).getDate();target.setDate(Math.min(day,last));return isoDate(target);}

function saveCurrent(closeAfter=true){
  const d=formData(); if(!dataForm.reportValidity())return;

  if(currentType==="debt"){
    const debtId=uid("debt"), total=num(d.totalDebt), bill=num(d.currentBill);
    state.debts.push({
      id:debtId,name:d.name,type:"debt",debtKind:d.debtKind,totalDebt:total,remaining:total,
      monthlyAmount:bill,currentBill:bill,minimumDue:num(d.minimumDue),dueDay:parseDate(d.dueDate).getDate(),
      statementDay:num(d.statementDay)||null,payer:d.payer,createdAt:todayKey()
    });
    state.payments.push({
      id:uid("pay"),debtId,name:d.name,amount:bill,myShare:bill,partnerShare:0,partnerReceived:0,
      dueDate:d.dueDate,paid:false,type:"debt",payer:d.payer,debtKind:d.debtKind,debtReduction:null
    });
  }

  if(currentType==="shared"){
    const debtId=uid("debt"), mode=d.sharedMode||"one_time";
    const total=num(d.totalAmount), instAmt=mode==="installment"?num(d.installmentAmount):total;
    const installments=mode==="installment"?Math.max(1,num(d.installments)):1;
    const paidInstallments=mode==="installment"?Math.min(installments,Math.max(0,num(d.paidInstallments))):0;
    const remainingInstallments=Math.max(0,installments-paidInstallments);
    state.debts.push({id:debtId,name:d.name,totalDebt:total,remaining:mode==="installment"?instAmt*remainingInstallments:total,monthlyAmount:instAmt,currentBill:instAmt,dueDay:parseDate(d.dueDate).getDate(),payer:d.payer,type:mode==="installment"?"shared_installment":"shared",sharedMode:mode,myShare:num(d.myShare),partnerShare:num(d.partnerShare),partnerName:d.partnerName,installments,paidInstallments,firstDueDate:d.dueDate,transferDate:d.transferDate});
    if(mode==="installment"){
      for(let i=0;i<remainingInstallments;i++) state.payments.push({id:uid("pay"),debtId,name:d.name,amount:instAmt,myShare:num(d.myShare),partnerShare:num(d.partnerShare),partnerReceived:0,partnerName:d.partnerName,transferDate:makeMonthlyDate(d.transferDate,i),dueDate:makeMonthlyDate(d.dueDate,i),paid:false,type:"shared_installment",payer:d.payer,installmentNo:paidInstallments+i+1,totalInstallments:installments});
    }else state.payments.push({id:uid("pay"),debtId,name:d.name,amount:total,myShare:num(d.myShare),partnerShare:num(d.partnerShare),partnerReceived:0,partnerName:d.partnerName,transferDate:d.transferDate,dueDate:d.dueDate,paid:false,type:"shared",payer:d.payer});
  }

  if(currentType==="income") state.incomes.push({id:uid("inc"),name:d.name,amount:num(d.amount),date:d.date,kind:d.kind,note:d.note||"",received:true});

  if(currentType==="expense"){
    const count=d.recurring==="monthly"?num(d.months||1):1;
    for(let i=0;i<count;i++) state.payments.push({id:uid("pay"),name:d.name,amount:num(d.amount),myShare:num(d.amount),partnerShare:0,partnerReceived:0,dueDate:addMonthsToDate(d.dueDate,i),paid:false,type:"expense",payer:"me"});
  }

  if(currentType==="rotation"){
    const rotationId=uid("rot"),recv=num(d.received),repay=num(d.repayTotal),inst=num(d.installments);
    state.rotations.push({id:rotationId,name:d.name,received:recv,receiveDate:d.receiveDate,repayTotal:repay,remaining:repay,repayDate:d.repayDate,installments:inst});
    state.incomes.push({id:uid("inc"),name:`เงินหมุน: ${d.name}`,amount:recv,date:d.receiveDate,kind:"rotation",note:"เงินยืม/เงินหมุน",received:true,rotationId});
    const each=repay/inst;
    for(let i=0;i<inst;i++){
      const amt=i===inst-1?repay-each*(inst-1):each;
      state.payments.push({id:uid("pay"),rotationId,name:`คืนเงินหมุน: ${d.name}`,amount:amt,myShare:amt,partnerShare:0,partnerReceived:0,dueDate:addMonthsToDate(d.repayDate,i),paid:false,type:"rotation",payer:"me"});
    }
  }

  if(currentType==="balance"){
    const target=num(d.balance), without=getCurrentBalance()-num(state.balanceAdjustment);
    state.balanceAdjustment=target-without;
  }

  saveState();renderAll();toast("บันทึกข้อมูลแล้ว");
  if(closeAfter)closeModal();else buildForm();
}
byId("saveBtn").onclick=()=>saveCurrent(true);
byId("saveAndContinueBtn").onclick=()=>saveCurrent(false);

function getCurrentBalance(){
  const income=state.incomes.filter(x=>x.received).reduce((s,x)=>s+num(x.amount),0);
  const paid=state.payments.filter(x=>x.paid&&x.payer==="me").reduce((s,x)=>s+num(x.amount),0);
  return num(state.balanceAdjustment)+income-paid;
}
function effectiveMyBurden(p){return (p.type==="shared"||p.type==="shared_installment")?(p.payer==="me"?num(p.myShare):0):(p.payer==="me"?num(p.amount):0);}
function expectedPartner(p){return (p.type==="shared"||p.type==="shared_installment")&&p.payer==="me"?Math.max(0,num(p.partnerShare)-num(p.partnerReceived)):0;}

function renderDashboard(){
  const now=new Date(),ym=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  const monthPays=state.payments.filter(p=>monthKey(p.dueDate)===ym);
  const due=monthPays.reduce((s,p)=>s+num(p.amount),0), unpaid=monthPays.filter(p=>!p.paid).reduce((s,p)=>s+num(p.amount),0);
  const expected=monthPays.filter(p=>!p.paid).reduce((s,p)=>s+expectedPartner(p),0),myBurden=monthPays.reduce((s,p)=>s+effectiveMyBurden(p),0);
  const paid=monthPays.filter(p=>p.paid).reduce((s,p)=>s+num(p.amount),0), current=getCurrentBalance();
  const futureIncome=state.incomes.filter(x=>x.received&&monthKey(x.date)===ym&&x.date>todayKey()).reduce((s,x)=>s+num(x.amount),0);
  const futureMyPays=monthPays.filter(p=>!p.paid&&p.dueDate>=todayKey()&&p.payer==="me").reduce((s,p)=>s+num(p.amount),0);
  const futureExpected=monthPays.filter(p=>!p.paid&&p.dueDate>=todayKey()).reduce((s,p)=>s+expectedPartner(p),0);
  const end=current+futureIncome+futureExpected-futureMyPays;

  byId("currentBalance").textContent=money(current);byId("monthDue").textContent=money(due);byId("monthUnpaid").textContent=money(unpaid);
  byId("expectedShared").textContent=money(expected);byId("myBurden").textContent=money(myBurden);byId("throughHands").textContent=money(due);
  byId("paidThisMonth").textContent=money(paid);byId("monthEndBalance").textContent=money(end);byId("monthEndBalance").className=end<0?"amount-danger":"amount-success";

  const timeline=[];
  state.incomes.filter(x=>x.received&&x.date>=todayKey()&&monthKey(x.date)===ym).forEach(x=>timeline.push({date:x.date,delta:num(x.amount)}));
  monthPays.filter(p=>!p.paid&&p.dueDate>=todayKey()&&p.payer==="me").forEach(p=>{
    if(expectedPartner(p)>0)timeline.push({date:p.transferDate||p.dueDate,delta:expectedPartner(p)});
    timeline.push({date:p.dueDate,delta:-num(p.amount)});
  });
  timeline.sort((a,b)=>a.date.localeCompare(b.date)||b.delta-a.delta);
  let running=current,min=running,minDate=todayKey();timeline.forEach(t=>{running+=t.delta;if(running<min){min=running;minDate=t.date;}});
  const box=byId("monthSituation");
  if(min<0){box.className="situation-box danger";box.innerHTML=`<strong>🔴 มีโอกาสเงินไม่พอ</strong><br>จุดต่ำสุดประมาณ <strong>${money(min)}</strong> วันที่ <strong>${thaiDate(minDate)}</strong><br>ควรเตรียมเพิ่มอย่างน้อย <strong>${money(Math.abs(min))}</strong>`;}
  else{box.className="situation-box good";box.innerHTML=`<strong>🟢 จากข้อมูลที่มี เดือนนี้ยังผ่านได้</strong><br>ยอดต่ำสุดประมาณ <strong>${money(min)}</strong><br>คาดว่าสิ้นเดือนเหลือ <strong>${money(end)}</strong>`;}

  const upcoming=state.payments.filter(p=>!p.paid).sort((a,b)=>a.dueDate.localeCompare(b.dueDate)).slice(0,6);
  byId("upcomingList").innerHTML=upcoming.length?upcoming.map(p=>`<div class="compact-item"><div><strong>${p.name}</strong><br><small>${thaiDate(p.dueDate)} ${p.type==="shared"?"• หนี้ร่วม":""}</small></div><strong class="${p.dueDate<todayKey()?"amount-danger":""}">${money(p.amount)}</strong></div>`).join(""):`<div class="empty">ยังไม่มีรายการที่ต้องจ่าย</div>`;
}

function renderMonthOptions(){
  const s=byId("calendarMonth");if(s.options.length)return;
  const base=new Date();base.setDate(1);
  for(let i=-2;i<10;i++){const d=new Date(base);d.setMonth(base.getMonth()+i);const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;const op=document.createElement("option");op.value=key;op.textContent=d.toLocaleDateString("th-TH",{month:"long",year:"numeric"});if(i===0)op.selected=true;s.appendChild(op);}
}
byId("calendarMonth").addEventListener("change",renderPayments);
byId("calendarStatus").addEventListener("change",renderPayments);
function labelType(t){return({debt:"หนี้",shared:"หนี้ร่วม",shared_installment:"ผ่อนร่วม",expense:"ค่าใช้จ่าย",rotation:"เงินหมุน"})[t]||t;}

function renderPayments(){
  renderMonthOptions();const ym=byId("calendarMonth").value,status=byId("calendarStatus").value;
  let list=state.payments.filter(p=>monthKey(p.dueDate)===ym);if(status==="paid")list=list.filter(p=>p.paid);if(status==="unpaid")list=list.filter(p=>!p.paid);list.sort((a,b)=>a.dueDate.localeCompare(b.dueDate));
  byId("paymentList").innerHTML=list.length?list.map(p=>`<div class="payment-row type-${p.type} ${p.paid?"paid":""} ${p.dueDate<todayKey()&&!p.paid?"overdue":""}">
    <button class="check-btn ${p.paid?"done":""}" onclick="togglePaid('${p.id}')">${p.paid?"✓":""}</button>
    <div><strong>${p.name}</strong><br><small>${thaiDate(p.dueDate)} ${(p.type==="shared"||p.type==="shared_installment")?`• ${p.partnerName||"ผู้ร่วมจ่าย"} ${money(p.partnerShare)}${p.installmentNo?` • งวด ${p.installmentNo}/${p.totalInstallments}`:""}`:""}</small></div>
    <div class="hide-mobile"><span class="tag ${(p.type==="shared"||p.type==="shared_installment")?"shared":""}">${labelType(p.type)}</span></div>
    <div class="hide-mobile">${p.paid?"จ่ายแล้ว":"ยังไม่จ่าย"}</div>
    <div style="text-align:right"><strong>${money(p.amount)}</strong><br><div class="row-actions">${(p.type==="shared"||p.type==="shared_installment")&&!p.paid?`<button class="action-link" onclick="receiveShared('${p.id}')">รับเงินร่วม</button>`:""}<button class="edit-btn" onclick="openEdit('payment','${p.id}')">✏️ แก้ไข</button></div></div></div>`).join(""):`<div class="empty">ไม่มีรายการในเดือนนี้</div>`;
}

window.togglePaid=function(id){
  const p=state.payments.find(x=>x.id===id);if(!p)return;
  if(!p.paid && p.debtId){
    const d=state.debts.find(x=>x.id===p.debtId);
    if(d?.debtKind==="credit_card"||d?.debtKind==="statement"){
      const val=prompt(`จ่าย ${money(p.amount)} แล้ว\nยอดที่ตัดจาก "หนี้คงเหลือจริง" เท่าไร?`,String(p.amount));
      if(val===null)return;
      p.debtReduction=Math.max(0,num(val));
    }
  }
  p.paid=!p.paid;
  if(p.debtId){
    const d=state.debts.find(x=>x.id===p.debtId);
    if(d){
      const reduction=p.debtReduction??num(p.amount);
      d.remaining=Math.max(0,num(d.remaining)+(p.paid?-reduction:reduction));
      if(d.type==="shared_installment") d.paidInstallments=Math.max(0,Math.min(num(d.installments),num(d.paidInstallments)+(p.paid?1:-1)));
    }
  }
  if(p.rotationId){const r=state.rotations.find(x=>x.id===p.rotationId);if(r)r.remaining=Math.max(0,num(r.remaining)+(p.paid?-num(p.amount):num(p.amount)));}
  saveState();renderAll();toast(p.paid?"บันทึกว่าจ่ายแล้ว":"ยกเลิกสถานะจ่ายแล้ว");
};

window.receiveShared=function(id){
  const p=state.payments.find(x=>x.id===id);if(!p)return;
  const remain=Math.max(0,num(p.partnerShare)-num(p.partnerReceived));if(!remain)return toast("ได้รับเงินส่วนนี้ครบแล้ว");
  p.partnerReceived=num(p.partnerShare);
  state.incomes.push({id:uid("inc"),name:`รับจาก ${p.partnerName||"ผู้ร่วมจ่าย"} - ${p.name}`,amount:remain,date:todayKey(),kind:"pass_through",note:`สำหรับจ่าย ${p.name}`,received:true,paymentId:p.id});
  saveState();renderAll();toast(`รับเงินร่วม ${money(remain)} แล้ว`);
};

window.adjustDebtBalance=function(id){
  const d=state.debts.find(x=>x.id===id);if(!d)return;
  const val=prompt(`ยอดคงเหลือจริงของ ${d.name}`,String(d.remaining));if(val===null)return;
  d.remaining=Math.max(0,num(val));saveState();renderAll();toast("ปรับยอดหนี้แล้ว");
};

window.addDebtBill=function(id){
  const d=state.debts.find(x=>x.id===id);if(!d)return;
  const amountRaw=prompt(`ยอดรอบใหม่ของ ${d.name}`,String(d.currentBill||d.monthlyAmount||0));if(amountRaw===null)return;
  const total=num(amountRaw);if(total<=0)return toast("ยอดต้องมากกว่า 0");
  const due=prompt("วันครบกำหนดงวดแรก (YYYY-MM-DD)",todayKey());if(!due)return;
  if(d.type==="shared"||d.type==="shared_installment"){
    const monthsRaw=prompt("ต้องการแบ่งจ่ายกี่เดือน? เช่น 1, 2, 3", "2");if(monthsRaw===null)return;
    const months=Math.max(1,Math.floor(num(monthsRaw)||1));
    const myRaw=prompt("ส่วนของฉัน รวมทั้งรอบ",String(d.myShare&&d.partnerShare? total*(num(d.myShare)/(num(d.myShare)+num(d.partnerShare))):total/2));if(myRaw===null)return;
    const myTotal=Math.max(0,num(myRaw)), partnerTotal=Math.max(0,total-myTotal);
    const each=total/months, myEach=myTotal/months, partnerEach=partnerTotal/months;
    for(let i=0;i<months;i++){
      const amt=i===months-1?total-each*(months-1):each;
      const mine=i===months-1?myTotal-myEach*(months-1):myEach;
      const partner=i===months-1?partnerTotal-partnerEach*(months-1):partnerEach;
      state.payments.push({id:uid("pay"),debtId:d.id,name:d.name,amount:amt,myShare:mine,partnerShare:partner,partnerReceived:0,partnerName:d.partnerName||"แฟน",transferDate:makeMonthlyDate(due,i),dueDate:makeMonthlyDate(due,i),paid:false,type:"shared",payer:d.payer||"me",roundPart:i+1,roundParts:months});
    }
    d.remaining=num(d.remaining)+total;d.currentBill=each;d.monthlyAmount=each;d.myShare=myEach;d.partnerShare=partnerEach;
    toast(`เพิ่มยอดรอบใหม่และแบ่ง ${months} เดือนแล้ว`);
  }else{
    state.payments.push({id:uid("pay"),debtId:d.id,name:d.name,amount:total,myShare:total,partnerShare:0,partnerReceived:0,dueDate:due,paid:false,type:"debt",payer:d.payer||"me",debtKind:d.debtKind,debtReduction:null});
    d.currentBill=total;toast("เพิ่มยอดรอบใหม่แล้ว");
  }
  saveState();renderAll();
};

function payerLabel(p){return p==="me"?"ฉัน":p==="partner"?"แฟน":"คนอื่น";}
function debtKindLabel(k){return({credit_card:"บัตรเครดิต",installment:"ผ่อนคงที่",loan:"สินเชื่อ",statement:"ใบแจ้งหนี้"})[k]||"หนี้";}

function renderDebts(){
  byId("debtCards").innerHTML=state.debts.length?state.debts.map(d=>{
    const paid=Math.max(0,num(d.totalDebt)-num(d.remaining)),pct=d.totalDebt?Math.min(100,(paid/num(d.totalDebt))*100):0;
    const kindClass=d.type==="shared_installment"?"shared_installment":(d.type==="shared"?"shared":(d.debtKind||"installment"));
    const title=d.type==="shared_installment"?"ผ่อนร่วมคงที่":(d.type==="shared"?"หนี้ร่วม":debtKindLabel(d.debtKind));
    return `<div class="debt-card kind-${kindClass}">
      <div class="debt-top"><div><h4>${d.name}</h4><p>${title}</p></div><span class="tag ${d.type==="shared"||d.type==="shared_installment"?"shared":""}">${d.type==="shared_installment"?"ผ่อนร่วม":(d.type==="shared"?"ร่วม":debtKindLabel(d.debtKind))}</span></div>
      <div class="big">${money(d.remaining)}</div><div class="progress"><span style="width:${pct}%"></span></div>
      <div class="debt-meta"><div><small>ยอดตั้งต้น</small><strong>${money(d.totalDebt)}</strong></div><div><small>จ่ายลดหนี้แล้ว</small><strong>${money(paid)}</strong></div><div><small>ยอดรอบล่าสุด</small><strong>${money(d.currentBill||d.monthlyAmount)}</strong></div><div><small>ผู้จ่าย</small><strong>${payerLabel(d.payer)}</strong></div></div>
      ${d.type==="shared_installment"?`<div class="installment-info"><strong>ผ่อนร่วม ${num(d.paidInstallments)}/${num(d.installments)} งวด</strong><div class="installment-grid"><div><small>ต่องวด</small><b>${money(d.monthlyAmount)}</b></div><div><small>ส่วนของฉัน</small><b>${money(d.myShare)}</b></div><div><small>${d.partnerName||"ผู้ร่วมจ่าย"}</small><b>${money(d.partnerShare)}</b></div><div><small>เหลือ</small><b>${Math.max(0,num(d.installments)-num(d.paidInstallments))} งวด</b></div></div></div>`:""}
      <div class="card-actions"><button class="edit-btn" onclick="openEdit('debt','${d.id}')">✏️ แก้ไข</button><button class="btn btn-ghost" onclick="adjustDebtBalance('${d.id}')">ปรับยอดคงเหลือ</button><button class="btn btn-secondary" onclick="addDebtBill('${d.id}')">＋ เพิ่มยอดรอบใหม่</button></div>
    </div>`;
  }).join(""):`<div class="empty">ยังไม่มีข้อมูลหนี้</div>`;
}

function renderIncome(){
  const list=[...state.incomes].sort((a,b)=>b.date.localeCompare(a.date));
  byId("incomeList").innerHTML=list.length?`<table><thead><tr><th>วันที่</th><th>รายการ</th><th>ประเภท</th><th>จำนวน</th><th>หมายเหตุ</th><th></th></tr></thead><tbody>${list.map(x=>`<tr><td>${thaiDate(x.date)}</td><td>${x.name}</td><td><span class="tag income-kind-${x.kind}">${x.kind==="income"?"รายได้จริง":x.kind==="rotation"?"เงินหมุน":"เงินผ่านมือ"}</span></td><td class="amount-success">${money(x.amount)}</td><td>${x.note||"-"}</td><td><button class="edit-btn" onclick="openEdit('income','${x.id}')">✏️ แก้ไข</button></td></tr>`).join("")}</tbody></table>`:`<div class="empty">ยังไม่มีข้อมูลเงินเข้า</div>`;
}

function renderRotations(){
  byId("rotationList").innerHTML=state.rotations.length?state.rotations.map(r=>`<div class="debt-card"><h4>${r.name}</h4><p>รับ ${thaiDate(r.receiveDate)}</p><div class="big">${money(r.remaining)}</div><div class="debt-meta"><div><small>รับมา</small><strong>${money(r.received)}</strong></div><div><small>ต้องคืน</small><strong>${money(r.repayTotal)}</strong></div><div><small>เริ่มคืน</small><strong>${thaiDate(r.repayDate)}</strong></div><div><small>จำนวนงวด</small><strong>${r.installments}</strong></div></div><div class="card-actions"><button class="edit-btn" onclick="openEdit('rotation','${r.id}')">✏️ แก้ไข</button></div></div>`).join(""):`<div class="empty">ยังไม่มีเงินหมุน / เงินยืม</div>`;
}

function renderForecast(){
  const rows=[],base=new Date();base.setDate(1);let carry=getCurrentBalance();
  for(let i=0;i<6;i++){const d=new Date(base);d.setMonth(base.getMonth()+i);const ym=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;const inc=state.incomes.filter(x=>monthKey(x.date)===ym).reduce((s,x)=>s+num(x.amount),0);const pays=state.payments.filter(p=>monthKey(p.dueDate)===ym&&p.payer==="me").reduce((s,p)=>s+num(p.amount),0);const shared=state.payments.filter(p=>monthKey(p.dueDate)===ym).reduce((s,p)=>s+expectedPartner(p),0);const projected=carry+inc+shared-pays;rows.push({label:d.toLocaleDateString("th-TH",{month:"long",year:"numeric"}),inc:inc+shared,pays,projected});carry=projected;}
  byId("forecastTable").innerHTML=`<table><thead><tr><th>เดือน</th><th>เงินเข้า/รอรับ</th><th>ต้องจ่าย</th><th>คาดการณ์คงเหลือ</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r.label}</td><td>${money(r.inc)}</td><td>${money(r.pays)}</td><td class="${r.projected<0?"amount-danger":"amount-success"}"><strong>${money(r.projected)}</strong></td></tr>`).join("")}</tbody></table>`;
}

/* ===== Rotation planner ===== */
let rotationDraft=[];
function addRotationStep(step={name:"",pay:0,back:0,note:""}){
  rotationDraft.push({id:uid("step"),...step});renderRotationPlanner();
}
function calcRotationPlan(){
  let cash=num(byId("rotationStartCash")?.value),start=cash,totalPaid=0,totalBack=0,totalCost=0,netDrop=0,failed=null;
  const rows=[];
  rotationDraft.forEach((s,i)=>{
    const pay=num(s.pay),back=Math.min(num(s.back),pay);
    if(!failed && pay>cash){failed={index:i,short:pay-cash,cash,pay};}
    const before=cash;
    if(!failed || failed.index!==i){cash=cash-pay+back;totalPaid+=pay;totalBack+=back;totalCost+=Math.max(0,pay-back);netDrop+=Math.max(0,pay-back);}
    rows.push({before,after:cash});
  });
  return {start,totalPaid,totalBack,totalCost,netDrop,end:cash,failed,rows};
}
function renderRotationPlanner(){
  const wrap=byId("rotationSteps");if(!wrap)return;
  wrap.innerHTML=rotationDraft.length?rotationDraft.map((s,i)=>`<div class="rotation-step">
    <div class="step-no">${i+1}</div>
    <div class="field"><label>กอง / บัตร</label><input value="${s.name.replaceAll('"','&quot;')}" oninput="updateRotationStep('${s.id}','name',this.value)" placeholder="เช่น เครดิต A"></div>
    <div class="field"><label>ยอดที่จ่าย</label><input type="number" step="0.01" value="${s.pay}" oninput="updateRotationStep('${s.id}','pay',this.value)"></div>
    <div class="field"><label>ยอดที่ดึงกลับ</label><input type="number" step="0.01" value="${s.back}" oninput="updateRotationStep('${s.id}','back',this.value)"></div>
    <div class="field step-note"><label>หมายเหตุ</label><input value="${s.note||""}" oninput="updateRotationStep('${s.id}','note',this.value)" placeholder="ถ้ามี"></div>
    <button class="remove-step" onclick="removeRotationStep('${s.id}')">✕</button>
  </div>`).join(""):`<div class="empty">ยังไม่มีรอบหมุน กด “เพิ่มรอบ” เพื่อเริ่มจำลอง</div>`;

  const c=calcRotationPlan();
  byId("planStartCash").textContent=money(c.start);byId("planTotalPaid").textContent=money(c.totalPaid);byId("planTotalBack").textContent=money(c.totalBack);
  byId("planTotalCost").textContent=money(c.totalCost);byId("planNetDebtDrop").textContent=money(c.netDrop);byId("planEndCash").textContent=money(c.end);
  const box=byId("rotationPlanStatus");
  if(c.failed){box.className="situation-box danger";box.innerHTML=`<strong>🔴 เงินสะดุดที่รอบ ${c.failed.index+1}</strong><br>มีเงินก่อนรอบนี้ ${money(c.failed.cash)} แต่ต้องจ่าย ${money(c.failed.pay)} — ขาด ${money(c.failed.short)}`;}
  else if(rotationDraft.length){box.className="situation-box good";box.innerHTML=`<strong>🟢 แผนนี้หมุนต่อได้ตามข้อมูลที่กรอก</strong><br>หลังจบรอบเหลือเงินสดประมาณ <strong>${money(c.end)}</strong> และต้นทุนจากการหมุนประมาณ <strong>${money(c.totalCost)}</strong>`;}
  else{box.className="situation-box";box.innerHTML="เพิ่มรอบเพื่อดูว่าเงินก้อนนี้จะหมุนต่อได้ถึงไหน";}
}
window.updateRotationStep=function(id,key,value){const s=rotationDraft.find(x=>x.id===id);if(!s)return;s[key]=["pay","back"].includes(key)?num(value):value;renderRotationPlanner();};
window.removeRotationStep=function(id){rotationDraft=rotationDraft.filter(x=>x.id!==id);renderRotationPlanner();};
byId("rotationStartCash").addEventListener("input",renderRotationPlanner);
byId("addRotationStepBtn").onclick=()=>addRotationStep();
byId("useCurrentBalanceBtn").onclick=()=>{byId("rotationStartCash").value=Math.max(0,getCurrentBalance());renderRotationPlanner();};
byId("clearRotationPlanBtn").onclick=()=>{rotationDraft=[];byId("rotationStartCash").value=0;renderRotationPlanner();};
byId("saveRotationPlanBtn").onclick=()=>{
  if(!rotationDraft.length)return toast("ยังไม่มีรอบหมุน");
  const c=calcRotationPlan();state.rotationPlans.push({id:uid("plan"),createdAt:new Date().toISOString(),startCash:c.start,endCash:c.end,totalCost:c.totalCost,totalPaid:c.totalPaid,steps:JSON.parse(JSON.stringify(rotationDraft))});
  saveState();renderSavedPlans();toast("บันทึกแผนหมุนแล้ว");
};
window.loadRotationPlan=function(id){const p=state.rotationPlans.find(x=>x.id===id);if(!p)return;rotationDraft=JSON.parse(JSON.stringify(p.steps||[]));byId("rotationStartCash").value=p.startCash;renderRotationPlanner();window.scrollTo({top:0,behavior:"smooth"});};
window.deleteRotationPlan=function(id){state.rotationPlans=state.rotationPlans.filter(x=>x.id!==id);saveState();renderSavedPlans();};
function renderSavedPlans(){
  const wrap=byId("savedRotationPlans");if(!wrap)return;
  const list=[...state.rotationPlans].reverse();
  wrap.innerHTML=list.length?list.map(p=>`<div class="saved-plan"><div><strong>${new Date(p.createdAt).toLocaleString("th-TH")}</strong><br><small>เริ่ม ${money(p.startCash)} • จ่ายผ่าน ${money(p.totalPaid)} • ต้นทุน ${money(p.totalCost)} • เหลือ ${money(p.endCash)}</small></div><div><button class="btn btn-secondary" onclick="loadRotationPlan('${p.id}')">เปิดแผน</button> <button class="btn btn-ghost" onclick="deleteRotationPlan('${p.id}')">ลบ</button></div></div>`).join(""):`<div class="empty">ยังไม่มีแผนที่บันทึกไว้</div>`;
}


/* ===== Edit existing data v2 ===== */
let editContext=null;const editModal=byId("editModal"),editForm=byId("editForm");
function esc(v=""){return String(v??"").replaceAll("&","&amp;").replaceAll('"',"&quot;").replaceAll("<","&lt;").replaceAll(">","&gt;")}
function editField(name,label,type="text",value="",extra=""){return `<div class="field"><label for="edit_${name}">${label}</label><input id="edit_${name}" name="${name}" type="${type}" value="${esc(value)}" ${extra}></div>`}
function editSelect(name,label,value,options){return `<div class="field"><label for="edit_${name}">${label}</label><select id="edit_${name}" name="${name}">${options.map(o=>`<option value="${o[0]}" ${String(o[0])===String(value)?"selected":""}>${o[1]}</option>`).join("")}</select></div>`}
function openEdit(kind,id){editContext={kind,id};let o=kind==="debt"?state.debts.find(x=>x.id===id):kind==="payment"?state.payments.find(x=>x.id===id):kind==="income"?state.incomes.find(x=>x.id===id):state.rotations.find(x=>x.id===id);if(!o)return toast("ไม่พบรายการ");
 if(kind==="debt"){const sh=o.type==="shared"||o.type==="shared_installment";byId("editModalTitle").textContent="✏️ แก้ไขข้อมูลหนี้";editForm.innerHTML=`${editField("name","ชื่อหนี้","text",o.name,"required")}${!sh?editSelect("debtKind","ประเภทหนี้",o.debtKind||"installment",[["credit_card","บัตรเครดิต"],["installment","ผ่อนคงที่"],["loan","สินเชื่อ"],["statement","ใบแจ้งหนี้"]]):""}${editField("totalDebt","ยอดตั้งต้น / ยอดรวม","number",o.totalDebt,'min="0" step="0.01" required')}${editField("remaining","ยอดคงเหลือจริง","number",o.remaining,'min="0" step="0.01" required')}${editField("currentBill","ยอดรอบล่าสุด / ต่องวด","number",o.currentBill??o.monthlyAmount??0,'min="0" step="0.01"')}${sh?editField("myShare","ส่วนของฉันต่องวด","number",o.myShare||0,'min="0" step="0.01"'):""}${sh?editField("partnerShare","ส่วนของผู้ร่วมจ่ายต่องวด","number",o.partnerShare||0,'min="0" step="0.01"'):""}${sh?editField("partnerName","ชื่อผู้ร่วมจ่าย","text",o.partnerName||"แฟน"):""}${o.type==="shared_installment"?editField("installments","จำนวนงวดทั้งหมด","number",o.installments||1,'min="1"'):""}${o.type==="shared_installment"?editField("paidInstallments","จ่ายแล้วกี่งวด","number",o.paidInstallments||0,'min="0"'):""}${editSelect("payer","ผู้จ่ายเจ้าหนี้",o.payer||"me",[["me","ฉัน"],["partner","แฟน"],["other","คนอื่น"]])}`}
 if(kind==="payment"){const sh=o.type==="shared"||o.type==="shared_installment";byId("editModalTitle").textContent="✏️ แก้ไขรายการต้องจ่าย";editForm.innerHTML=`${editField("name","ชื่อรายการ","text",o.name,"required")}${editField("amount","ยอดที่ต้องจ่าย","number",o.amount,'min="0" step="0.01" required')}${editField("dueDate","วันครบกำหนด","date",o.dueDate,"required")}${editSelect("payer","ผู้จ่ายเจ้าหนี้",o.payer||"me",[["me","ฉัน"],["partner","แฟน"],["other","คนอื่น"]])}${sh?editField("myShare","ส่วนของฉัน","number",o.myShare||0,'min="0" step="0.01"'):""}${sh?editField("partnerShare","ส่วนของผู้ร่วมจ่าย","number",o.partnerShare||0,'min="0" step="0.01"'):""}${sh?editField("partnerName","ชื่อผู้ร่วมจ่าย","text",o.partnerName||"แฟน"):""}${sh?editField("transferDate","วันที่ควรโอน","date",o.transferDate||o.dueDate):""}`}
 if(kind==="income"){byId("editModalTitle").textContent="✏️ แก้ไขเงินเข้า";editForm.innerHTML=`${editField("name","ชื่อเงินเข้า","text",o.name,"required")}${editField("amount","จำนวนเงิน","number",o.amount,'min="0" step="0.01" required')}${editField("date","วันที่เงินเข้า","date",o.date,"required")}${editSelect("kind","ประเภท",o.kind||"income",[["income","รายได้จริง"],["pass_through","เงินผ่านมือ"],["rotation","เงินหมุน"]])}${editField("note","หมายเหตุ","text",o.note||"")}`}
 if(kind==="rotation"){byId("editModalTitle").textContent="✏️ แก้ไขเงินหมุน";editForm.innerHTML=`${editField("name","ชื่อเงินหมุน","text",o.name,"required")}${editField("received","รับมา","number",o.received,'min="0" step="0.01" required')}${editField("receiveDate","วันที่รับ","date",o.receiveDate,"required")}${editField("repayTotal","ยอดต้องคืนทั้งหมด","number",o.repayTotal,'min="0" step="0.01" required')}${editField("remaining","ยอดคงเหลือที่ต้องคืน","number",o.remaining,'min="0" step="0.01" required')}${editField("repayDate","วันเริ่มคืน","date",o.repayDate,"required")}${editField("installments","จำนวนงวด","number",o.installments,'min="1" required')}`}
 editModal.classList.remove("hidden")}
function closeEdit(){editModal.classList.add("hidden");editContext=null}byId("closeEditBtn").onclick=closeEdit;byId("cancelEditBtn").onclick=closeEdit;editModal.addEventListener("click",e=>{if(e.target===editModal)closeEdit()});
byId("saveEditBtn").onclick=()=>{if(!editContext||!editForm.reportValidity())return;const d=Object.fromEntries(new FormData(editForm).entries());
 if(editContext.kind==="debt"){const x=state.debts.find(v=>v.id===editContext.id);x.name=d.name;if(d.debtKind)x.debtKind=d.debtKind;x.totalDebt=num(d.totalDebt);x.remaining=num(d.remaining);x.currentBill=num(d.currentBill);x.monthlyAmount=num(d.currentBill);x.payer=d.payer;if(x.type==="shared"||x.type==="shared_installment"){x.myShare=num(d.myShare);x.partnerShare=num(d.partnerShare);x.partnerName=d.partnerName||"แฟน"}if(x.type==="shared_installment"){x.installments=Math.max(1,num(d.installments));x.paidInstallments=Math.min(x.installments,Math.max(0,num(d.paidInstallments)))}}
 if(editContext.kind==="payment"){const x=state.payments.find(v=>v.id===editContext.id);x.name=d.name;x.amount=num(d.amount);x.dueDate=d.dueDate;x.payer=d.payer;if(x.type==="shared"||x.type==="shared_installment"){x.myShare=num(d.myShare);x.partnerShare=num(d.partnerShare);x.partnerName=d.partnerName||"แฟน";x.transferDate=d.transferDate||d.dueDate}else x.myShare=num(d.amount)}
 if(editContext.kind==="income"){const x=state.incomes.find(v=>v.id===editContext.id);x.name=d.name;x.amount=num(d.amount);x.date=d.date;x.kind=d.kind;x.note=d.note||""}
 if(editContext.kind==="rotation"){const x=state.rotations.find(v=>v.id===editContext.id);x.name=d.name;x.received=num(d.received);x.receiveDate=d.receiveDate;x.repayTotal=num(d.repayTotal);x.remaining=num(d.remaining);x.repayDate=d.repayDate;x.installments=num(d.installments)}
 saveState();renderAll();closeEdit();toast("แก้ไขข้อมูลแล้ว")};window.openEdit=openEdit;

function renderAll(){renderDashboard();renderPayments();renderDebts();renderIncome();renderRotations();renderForecast();renderRotationPlanner();renderSavedPlans();}

/* ===== Backup / Import / Reset ===== */
byId("exportBtn").onclick=()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`money-flow-backup-${todayKey()}.json`;a.click();URL.revokeObjectURL(a.href);};
byId("importInput").addEventListener("change",async e=>{const f=e.target.files[0];if(!f)return;try{replaceState(JSON.parse(await f.text()));saveState();renderAll();toast("นำเข้าข้อมูลแล้ว");}catch{alert("ไฟล์ข้อมูลไม่ถูกต้อง");}e.target.value="";});
byId("resetBtn").onclick=()=>{if(!confirm("ต้องการล้างข้อมูลทั้งหมดจริงหรือไม่?"))return;replaceState(defaultState());saveState();renderAll();toast("ล้างข้อมูลแล้ว");};

renderMonthOptions();buildForm();renderAll();initAuth();
