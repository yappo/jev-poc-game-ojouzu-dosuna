import {spawn} from 'node:child_process';
import {createGameServer} from '../src/http-server.mjs';
if(!process.env.TYPESAFE_API_KEY?.trim()){
  console.error('TYPESAFE_API_KEY がありません。設定済みのシェルから起動してください。');
  process.exit(1);
}
const port=Number(process.env.PORT||4173);
const server=createGameServer({apiKey:process.env.TYPESAFE_API_KEY,model:process.env.TYPESAFE_MODEL});
server.on('error',error=>{console.error(error.code==='EADDRINUSE'?'このポートは使用中です。起動済みのサーバーを終了するかPORTを変更してください。':'サーバーを起動できませんでした。');process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>{
  const address=`http://127.0.0.1:${server.address().port}`;
  console.log(`お上手どすなぁ is running at ${address}`);
  if(process.env.NO_OPEN!=='1'){
    const command=process.platform==='darwin'?'open':process.platform==='win32'?'cmd':'xdg-open';
    const args=process.platform==='win32'?['/c','start','',address]:[address];
    const child=spawn(command,args,{stdio:'ignore',detached:true});
    child.on('error',()=>console.warn(`ブラウザで ${address} を開いてください。`));child.unref();
  }
});
