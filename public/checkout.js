const $=id=>document.getElementById(id);
function setMessage(text){$('message').textContent=text}
function statusPath(orderId){return'/status.html?orderId='+encodeURIComponent(orderId)}
function setStored(storage,key,value){try{storage.setItem(key,value)}catch{}}
function getStored(storage,key){try{return storage.getItem(key)}catch{return''}}
function removeStored(storage,key){try{storage.removeItem(key)}catch{}}
function rememberOrder(orderId,paypalOrderId){
  const pending={orderId,paypalOrderId,createdAt:Date.now()};
  setStored(sessionStorage,'qalam_order_id',orderId);
  setStored(sessionStorage,'qalam_paypal_order',paypalOrderId);
  setStored(sessionStorage,'qalam_pending_checkout',JSON.stringify(pending));
  setStored(localStorage,'qalam_pending_checkout',JSON.stringify(pending));
}
function pendingOrder(){
  const raw=getStored(sessionStorage,'qalam_pending_checkout')||getStored(localStorage,'qalam_pending_checkout');
  try{
    const pending=JSON.parse(raw||'{}');
    if(Date.now()-Number(pending.createdAt||0)>30*60*1000)return null;
    return pending;
  }catch{
    return null;
  }
}
function clearPendingOrder(){
  removeStored(sessionStorage,'qalam_paypal_order');
  removeStored(sessionStorage,'qalam_pending_checkout');
  removeStored(localStorage,'qalam_pending_checkout');
}
function showPaid(orderId,statusUrl){
  setStored(sessionStorage,'qalam_order_id',orderId);
  const url=statusUrl||statusPath(orderId);
  $('message').innerHTML='';
  const title=document.createElement('strong');
  title.textContent='تم تأكيد الدفع!';
  const text=document.createElement('div');
  text.textContent='رقم الطلب: '+orderId;
  const actions=document.createElement('div');
  actions.className='success-actions';
  const link=document.createElement('a');
  link.className='button';
  link.href=url;
  link.textContent='تتبع الطلب';
  const copy=document.createElement('button');
  copy.className='button button-outline';
  copy.type='button';
  copy.textContent='نسخ معلومات الطلب';
  copy.onclick=async()=>{
    const email=getStored(sessionStorage,'qalam_order_email')||$('email').value.trim();
    const fullUrl=new URL(url,location.origin).href;
    const details=['Qalam Motion','Order ID: '+orderId,email?'Email: '+email:'','Status: '+fullUrl].filter(Boolean).join('\n');
    try{await navigator.clipboard.writeText(details);copy.textContent='تم النسخ'}catch{copy.textContent='انسخ رقم الطلب يدويا'}
  };
  actions.append(link,copy);
  $('message').append(title,text,actions);
}
const planNames={short:'حكاية مرسومة',signature:'حكاية موسّعة'};
let activeCatalog=null;
let checkoutConfigured=false;
let submitBusy=false;
let enquiryComplete=false;
const enquiryRequestId=crypto.randomUUID();
function updateNextStep(){
  const paying=$('next-pay').checked;
  $('payment-consent').hidden=!paying;
  $('enquiry-consent').hidden=paying;
  $('next-step-note').textContent=paying?'ستنتقل إلى PayPal لإتمام الدفع. تأكد من الاتفاق على تفاصيل مشروعك أولاً. لا نحفظ بيانات بطاقتك.':'سنتلقى فكرتك ونراجعها قبل الاتفاق والدفع. لا يتم إنشاء دفعة عند إرسال الاستفسار.';
  $('pay').disabled=submitBusy||!activeCatalog||(paying?!checkoutConfigured:enquiryComplete);
  $('pay').textContent=submitBusy?'جارٍ الإرسال…':paying?(checkoutConfigured?'المتابعة إلى PayPal':'الدفع غير متاح حالياً'):(enquiryComplete?'تم إرسال فكرتك':'أرسل فكرتي بدون دفع');
}
document.querySelectorAll('input[name="next-step"]').forEach(input=>input.addEventListener('change',updateNextStep));
function updateSummary(){
  const id=$('package').value;
  const plan=activeCatalog?.[id];
  if(!plan)return;
  $('selected-duration').textContent=planNames[id]+' · '+plan.durationSeconds.min+'–'+plan.durationSeconds.max+' ثانية';
  $('selected-price').textContent='$'+Number(plan.price)+' USD';
}
$('package').addEventListener('change',updateSummary);
document.querySelectorAll('[data-plan]').forEach(a=>a.onclick=()=>{
  $('package').value=a.dataset.plan;
  updateSummary();
});
fetch('/api/config').then(r=>{if(!r.ok)throw Error('Configuration unavailable');return r.json()}).then(c=>{
  const sandbox=c.mode==='sandbox';
  $('mode').textContent=sandbox?'وضع التجربة — مدفوعات وهمية':'';
  $('sandbox-note').textContent=sandbox?'مدفوعات هذه النسخة وهمية ولا تُخصم أموال حقيقية.':'احفظ رقم الطلب بعد الدفع لتتبعه.';
  $('site-footer').textContent='© 2026 قلم موشن'+(sandbox?' • نسخة تجريبية':'');
  for(const id of Object.keys(planNames)){
    const plan=c.catalog?.[id];
    if(!plan?.durationSeconds||!Number.isFinite(Number(plan.price)))throw Error('Invalid catalog');
  }
  activeCatalog=c.catalog;
  for(const id of Object.keys(planNames)){
    const plan=activeCatalog[id];
    const duration=plan.durationSeconds.min+'–'+plan.durationSeconds.max+' ثانية';
    document.querySelector('[data-price="'+id+'"]').textContent='$'+Number(plan.price);
    document.querySelector('[data-duration="'+id+'"]').textContent=duration;
    $('package').querySelector('option[value="'+id+'"]').textContent=planNames[id]+' · '+duration+' · $'+Number(plan.price);
  }
  updateSummary();
  checkoutConfigured=c.configured===true;
  updateNextStep();
}).catch(()=>{
  $('pay').disabled=true;
  $('pay').textContent='الدفع غير متاح حالياً';
  setMessage('تعذّر تحميل الباقات. حدّث الصفحة أو تواصل معنا بالبريد.');
});
$('checkout').onsubmit=async e=>{
  e.preventDefault();
  if(!activeCatalog||$('pay').disabled||submitBusy)return;
  const paying=$('next-pay').checked;
  submitBusy=true;
  updateNextStep();
  setMessage(paying?'جارٍ تجهيز صفحة الدفع الآمنة…':'جارٍ حفظ فكرتك…');
  try{
    const email=$('email').value.trim();
    const details={name:$('name').value,email,contact:$('contact').value,packageId:$('package').value,brief:$('brief').value};
    if(!paying){details.requestId=enquiryRequestId;details.website=$('website').value;}
    const r=await fetch(paying?'/api/orders':'/api/enquiries',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(details)});
    const j=await r.json();
    if(!r.ok)throw Error('Submission failed');
    if(!paying){
      if(!j.enquiryId||j.status!=='ENQUIRY')throw Error('Invalid enquiry response');
      enquiryComplete=true;
      setMessage('وصلتنا فكرتك! رقم الاستفسار: '+j.enquiryId+' — سنراجع التفاصيل ونتواصل على بريدك. لم يتم إنشاء طلب دفع أو خصم أي مبلغ.');
    }else{
      setStored(sessionStorage,'qalam_order_email',email);
      rememberOrder(j.orderId,j.paypalOrderId);
      location.assign(j.approvalUrl);
    }
  }catch{
    setMessage(paying?'تعذّر بدء الدفع. لم يتم خصم مبلغ هنا. حاول مجدداً أو تواصل معنا بالبريد.':'تعذّر تأكيد استلام فكرتك. حاول مجدداً أو راسلنا بالبريد؛ لا يلزم أي دفع.');
  }finally{
    submitBusy=false;
    updateNextStep();
  }
};
const q=new URLSearchParams(location.search);
const pending=pendingOrder();
if(q.get('payment')==='cancel'){
  clearPendingOrder();
  setMessage('تم إلغاء الدفع.');
}
const returnedFromPayPal=q.get('payment')==='return'||q.has('token');
if(returnedFromPayPal&&q.get('payment')!=='cancel'){
  const orderRef=q.get('token')||q.get('orderId')||pending?.paypalOrderId||pending?.orderId||'';
  if(!orderRef)setMessage('لم يرجع باي بال رقم الطلب. تواصل مع الدعم قبل إعادة المحاولة.');
  else{
    history.replaceState({},'',location.pathname+'#order');
    $('order').scrollIntoView();
    setMessage('جارٍ التحقق من الدفع عبر باي بال…');
    fetch('/api/orders/'+encodeURIComponent(orderRef)+'/capture',{method:'POST'}).then(async r=>{
      const j=await r.json();
      if(!r.ok)throw Error(j.error);
      clearPendingOrder();
      showPaid(j.orderId,j.statusUrl);
    }).catch(e=>setMessage(e.message));
  }
}

