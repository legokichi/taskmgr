import path = require("path");
import com = require('commander');
import {checkEnv, sleep, spawn, IO} from "./taskmgr";
const pkg: {version: string; name: string} = require("../package.json");

export async function main(){
  const BASH_SCRIPT = checkEnv("BASH_SCRIPT", path.join(__dirname, "../script/openpose.sh"));
  const INPUT_DIR = checkEnv("INPUT_DIR", path.join(__dirname, "../in/"));
  const OUTPUT_DIR = checkEnv("OUTPUT_DIR", path.join(__dirname, "../out/"));
  const DATA_DIR = checkEnv("DATA_DIR", path.join(__dirname, "../data/"));
  const SAVE_FILE = path.join(DATA_DIR, "save.json");
  const io = new IO(SAVE_FILE, INPUT_DIR, OUTPUT_DIR);
  await io.load();
  console.log("fetching");
  await io.fetch();
  console.log("fetched");
  const prms = [0,1,2,3,4,5,6,7].map((gpuId)=> (async ()=>{
    const workdir = path.join(DATA_DIR, `workdir_${gpuId}`);
    while(true){
      if(io.empty()){
        console.log(gpuId, "nothing todo");
        await sleep(60*1000);
        continue;
      }
      await io.run(gpuId, workdir, BASH_SCRIPT);
      console.log(gpuId, "done");
      //await sleep(60*1000);// for debug
    }
  })().catch(console.error.bind(console, gpuId, "error")));
  const fetch = (async ()=>{ while(true){ await io.fetch(); console.log("fetched"); await sleep(60*1000); } })();
  const save = (async ()=>{ while(true){ await io.save(); console.log("saved"); await sleep(60*1000); } })();
  process.on('SIGINT', async () => { await io.save(); console.log("saved"); process.exit(); });
}

main();
