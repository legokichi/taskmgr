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
  com["inputdir"] = "/nfs/nedo-s3/";
  com["outputdir"] = "/nfs/nedo-openpose/";
  com["workdir"] = "/home/dgxuser/yosuke/Github/taskmgr/data";
  com["save"] = "/home/dgxuser/yosuke/Github/taskmgr/save.json";
  if([com["save"], com["inputdir"], com["outputdir"], com["workdir"]].some((a)=> typeof a !== "string")){
    console.log(com);
    com.help();
    return;
  }
  const io = new taskmgr.IO(com["save"], com["inputdir"], com["outputdir"]);
  await io.fetch();
  const prms = [0,1].map((gpuId)=> (async ()=>{
    const workdir = path.join(com["workdir"], `workdir_${gpuId}`);
    while(true){
      if(io.empty()){
        console.log(gpuId, "nothing todo");
        await taskmgr.sleep(60*1000);
        continue;
      }
      await io.run(async (processing_file)=>{
        console.log(gpuId, "got file", processing_file);
        const rm = await taskmgr.spawn(`docker run -ti --rm -v ${workdir}/${workdir} --workdir ${workdir} ubuntu:16.04 rm -rf ${path.join(workdir, "*")}`, {}).promise;
        if(rm.code !== 0){ throw new Error("rm failed "+rm.code); }
        const mkdir = await taskmgr.spawn(`mkdir -p ${workdir}`, {}).promise;
        if(mkdir.code !== 0){ throw new Error("mkdir failed "+mkdir.code); }
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
