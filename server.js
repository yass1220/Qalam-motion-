import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const app=express();
app.disable('x-powered-by');
app.use(helmet({contentSecurityPolicy:false}));
app.use(express.json({limit:'32kb'}));
app.use('/api',rateLimit({windowMs:15*60*1000,limit:80,standardHeaders:'draft-7',legacyHeaders:false}));
app.use(express.static('public'));
const mode=process.env.PAYPAL_MODE==='live'?'live':'sandbox';
const paypalBase=mode==='live'?'https://api-m.paypal.com':'https://api-m.sandbox.paypal.com';
const catalog={short:{name:'Short Story',price:'29.00',duration:'Up to 20 seconds'},signature:{name:'Signature Reel',price:'59.00',duration:'Up to 45 seconds'}};
const dataDir=path.resolve(process.env.DATA_DIR||'./data');
const file=path.join(dataDir,'orders.json');
let orders=[];
await fs.mkdir(dataDir,{recursive:true});
try {orders=JSON.parse(await fs.readFile(file,'utf8'));if(!Array.isArray(orders))orders=[];}catch(e){if(e.code!=='ENOENT')throw e;}
let writeQueue=Promise.resolve();
function persist(){writeQueue=writeQueue.then(async()=>{const tmp=file+'.tmp';await fs.writeFile(tmp,JSON.stringify(orders,null,2),{mode:0o600});await fs.rename(tmp,file);});return writeQueue;}
function fail(res,status,message){return res.status(status).json({error:message});}
function clean(v,max){return typeof v==='string'?v.trim().slice(0,max):'';}
function validEmail(v){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)&&v.length<=254;}
async function accessToken(){
 const id=process.env.PAYPAL_CLIENT_ID,secret=process.env.PAYPAL_CLIENT_SECRET;
 if(!id||!secret||id.startsWith('replace_'))throw Error('PayPal credentials are not configured');
 const r=await fetch(paypalBase+'/v1/oauth2/token',{method:'POST',headers:{Authorization:'Basic '+Buffer.from(id+':'+secret).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials'});
 const j=await r.json();if(!r.ok||!j.access_token)throw Error('PayPal authentication failed');return j.access_token;
}
async function paypal(pathname,method,body,requestId){
 const token=await accessToken();
 const headers={Authorization:'Bearer '+token,'Content-Type':'application/json','Accept':'application/json','PayPal-Request-Id':requestId};
 const r=await fetch(paypalBase+pathname,{method,headers,...(body?{body:JSON.stringify(body)}:{})});
 const j=await r.json().catch(()=>({}));if(!r.ok)throw Error(`PayPal ${method} failed (${r.status}): ${j.name||'unknown error'}`);return j;
}
app.get('/api/config',(req,res)=>res.json({mode,currency:'USD',catalog,configured:Boolean(process.env.PAYPAL_CLIENT_ID&&!process.env.PAYPAL_CLIENT_ID.startsWith('replace_'))}));
app.post('/api/orders',async(req,res)=>{
 try{
 const {packageId}=req.body||{};const pkg=catalog[packageId];
 const name=clean(req.body?.name,100),email=clean(req.body?.email,254),brief=clean(req.body?.brief,4000);
 if(!pkg||name.length<2||!validEmail(email)||brief.length<15)return fail(res,400,'Enter a valid package, name, email and a story of at least 15 characters.');
 const localId=crypto.randomUUID();
 const result=await paypal('/v2/checkout/orders','POST',{intent:'CAPTURE',purchase_units:[{reference_id:localId,description:`Qalam Motion — ${pkg.name}`,custom_id:localId,amount:{currency_code:'USD',value:pkg.price}}],payment_source:{paypal:{experience_context:{brand_name:'Qalam Motion',user_action:'PAY_NOW',shipping_preference:'NO_SHIPPING',return_url:`${process.env.PUBLIC_BASE_URL||'http://localhost:3000'}/?payment=return`,cancel_url:`${process.env.PUBLIC_BASE_URL||'http://localhost:3000'}/?payment=cancel`}}}},`create-${localId}`);
 const approve=result.links?.find(x=>x.rel==='payer-action'||x.rel==='approve')?.href;
 if(!approve||!result.id)throw Error('PayPal did not return an approval URL');
 const record={id:localId,paypalOrderId:result.id,packageId,amount:pkg.price,currency:'USD',name,email,brief,status:'AWAITING_PAYMENT',createdAt:new Date().toISOString()};
 orders.push(record);await persist();res.json({orderId:localId,paypalOrderId:result.id,approvalUrl:approve});
 }catch(e){console.error(e);fail(res,502,'Could not start PayPal checkout. Check server configuration and try again.');}
});
app.post('/api/orders/:paypalOrderId/capture',async(req,res)=>{
 const record=orders.find(x=>x.paypalOrderId===req.params.paypalOrderId);
 if(!record)return fail(res,404,'Order not found');
 if(record.status==='PAID')return res.json({status:'PAID',orderId:record.id});
 try{
 // PayPal is authoritative. Never trust a client-side success redirect alone.
 const result=await paypal(`/v2/checkout/orders/${encodeURIComponent(record.paypalOrderId)}/capture`,'POST',null,`capture-${record.id}`);
 const unit=result.purchase_units?.[0];const capture=unit?.payments?.captures?.find(c=>c.status==='COMPLETED');
 if(result.status!=='COMPLETED'||!capture||capture.amount?.value!==record.amount||capture.amount?.currency_code!=='USD'||unit?.custom_id!==record.id)return fail(res,409,'Payment has not been verified. Contact support.');
 record.status='PAID';record.captureId=capture.id;record.paidAt=new Date().toISOString();await persist();
 res.json({status:'PAID',orderId:record.id});
 }catch(e){console.error(e);fail(res,502,'Could not confirm payment. Do not pay again; contact support with your order reference.');}
});
app.get('/api/admin/orders',(req,res)=>{
 const expected=process.env.ADMIN_TOKEN;
 const supplied=(req.headers.authorization||'').replace(/^Bearer /,'');
 if(!expected||expected.startsWith('replace_')||supplied.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(supplied),Buffer.from(expected)))return fail(res,401,'Unauthorized');
 res.set('Cache-Control','no-store').json(orders.map(({id,packageId,amount,name,email,brief,status,createdAt,paidAt,captureId})=>({id,packageId,amount,name,email,brief,status,createdAt,paidAt,captureId})));
});
app.get('/health',(req,res)=>res.json({ok:true}));
app.listen(Number(process.env.PORT)||3000,()=>console.log(`Qalam Motion running on port ${process.env.PORT||3000} (${mode})`));
