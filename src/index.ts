import path = require("path");
import com = require('commander');
import * as taskmgr from "./taskmgr";
import {run} from "./process";
const pkg: {version: string; name: string} = require("../package.json");

export async function main(){
  com
    .version(pkg.version)
    .usage("[options]")
    .option('--inputdir /home/legokichi/Github/gpu-taskmgr/in', 'inputdir',)
    .option('--outputdir /home/legokichi/Github/gpu-taskmgr/out', 'outputdir')
    .option('--workdir /home/legokichi/Github/gpu-taskmgr/data', 'workdir')
    .option('--save /home/legokichi/Github/gpu-taskmgr/save.json', 'save')
    //.arguments('<*>')
    .parse(process.argv);
  if([com["save"], com["inputdir"], com["outputdir"], com["workdir"]].some((a)=> typeof a !== "string")){
    com.help();
    return;
  }
  const io = new taskmgr.IO(com["save"], com["inputdir"], com["outputdir"]);
  await io.fetch();
  const prms = [0].map((gpuId)=> (async ()=>{
    const workdir = path.join(com["workdir"], `workdir_${gpuId}`);
    while(true){
      if(io.empty()){
        console.log(gpuId, "nothing todo");
        await taskmgr.sleep(60*1000);
        continue;
      }
      await io.run(async (processing_file)=>{
        console.log(gpuId, "got file", processing_file);
        const rm = await taskmgr.spawn(`rm -rf ${workdir}`, {}).promise;
        if(rm.code !== 0){ return Promise.reject(new Error("rm failed")); }
        const mkdir = await taskmgr.spawn(`mkdir -p ${workdir}`, {}).promise;
        if(mkdir.code !== 0){ return Promise.reject(new Error("mkdir failed")); }
        await run(gpuId, processing_file, workdir);
        return workdir;
      });
      console.log(gpuId, "done");
      //await sleep(60*1000);// for debug
    }
  })().catch(console.error.bind(console, gpuId, "error")));
  const fetch = (async ()=>{ while(true){ await io.fetch(); console.log("fetched"); await taskmgr.sleep(60*1000); } })();
  const save = (async ()=>{ while(true){ await io.save(); console.log("saved"); await taskmgr.sleep(60*1000); } })();
  process.on('SIGINT', async () => { await io.save(); console.log("saved"); process.exit(); });
}

main();