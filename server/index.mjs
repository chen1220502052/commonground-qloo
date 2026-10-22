import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { AppError, QlooClient } from './qloo.mjs';

const client=new QlooClient({apiKey:process.env.QLOO_API_KEY,baseUrl:process.env.QLOO_BASE_URL || 'https://hackathon.api.qloo.com'});
const port=Number(process.env.PORT || 4318);
const publicFiles=new Map([['/','index.html'],['/index.html','index.html'],['/styles.css','styles.css'],['/app.js','app.js'],['/engine.js','engine.js'],['/fixtures.js','fixtures.js'],['/instructions.js','instructions.js']]);
const mime={html:'text/html; charset=utf-8',css:'text/css; charset=utf-8',js:'text/javascript; charset=utf-8'};
let active=0;
function json(response,status,data){response.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});response.end(JSON.stringify(data));}
async function body(request){let size=0;const chunks=[];for await(const chunk of request){size+=chunk.length;if(size>16384)throw new AppError('Request too large.',413);chunks.push(chunk);}try{return JSON.parse(Buffer.concat(chunks).toString());}catch{throw new AppError('Send valid JSON.',400);}}
const server=http.createServer(async(request,response)=>{
  try{
    const host=request.headers.host;
    if(![`127.0.0.1:${port}`,`localhost:${port}`].includes(host))return json(response,403,{error:'Local access only.'});
    const url=new URL(request.url,`http://${host}`);
    if(url.pathname==='/api/status' && request.method==='GET')return json(response,200,{qlooConfigured:!!process.env.QLOO_API_KEY,modelConnected:false});
    if(url.pathname==='/api/negotiate' && request.method==='POST'){
      if(request.headers.origin && request.headers.origin!==`http://${host}`)return json(response,403,{error:'Request origin does not match.'});
      if(request.headers['content-type']?.split(';',1)[0].trim().toLowerCase()!=='application/json')return json(response,415,{error:'Use application/json.'});
      if(active>=1)return json(response,429,{error:'A negotiation is in progress. Please retry shortly.'});
      active++;try{return json(response,200,await client.negotiate(await body(request)));}finally{active--;}
    }
    if(request.method!=='GET')return json(response,405,{error:'Method not allowed.'});
    const file=publicFiles.get(url.pathname);if(!file)return json(response,404,{error:'Not found.'});
    const content=await readFile(fileURLToPath(new URL(`../dist/${file}`,import.meta.url)));
    response.writeHead(200,{'Content-Type':mime[file.split('.').pop()],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});response.end(content);
  }catch(error){json(response,error instanceof AppError?error.status:500,{error:error instanceof AppError?error.message:'The server could not complete this request.'});}
});
server.listen(port,'127.0.0.1',()=>console.log(`CommonGround: http://127.0.0.1:${port}/`));
