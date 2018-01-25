import fs = require('fs');
import path = require('path');
import child_process = require('child_process');
import deep_diff = require("deep-diff");
import util = require("util")

export function checkEnv(key: string, defaultVal?: string): string {
  const val = process.env[key];
  if(typeof val !== "string"){
    if(typeof defaultVal === "string"){
      console.warn(`process.env.${key} := ${defaultVal}`);
      return defaultVal;
    }
    throw new Error(`process.env.${key} is not defined`);
  }
  return val;
}

export function sleep(ms: number){ return new Promise((resolve)=> setTimeout(resolve, ms) ); }

export function spawn(command: string, opt: child_process.SpawnOptions): {process: child_process.ChildProcess, promise: Promise<{code: number, signal: string}>} {
  console.log("spawn", command, opt);
  const child = child_process.spawn("bash", ["-c", command], {detached: true, stdio: 'inherit', ...opt});
  const sigint = ()=>{ process.kill(-child.pid); };
  process.on('SIGINT', sigint);
  const finalize = ()=>{ process.removeListener('SIGINT', sigint); };
  const promise = new Promise<{code: number, signal: string}>((r,l)=>{
    child.on("close", (code, signal)=>{
      finalize();
      r({code, signal});
    });
    child.on("error", (err)=>{
      finalize();
      l(err);
    });
  });
  return {process: child, promise}
}

export namespace FS {
  export type FileType = "file"|"dir"|"blcdev"|"chardev"|"symlink"|"fifo"|"socket"|"unkown";
  export function getFileType(stat: fs.Stats): FileType {
    return stat.isFile() ? "file"
        : stat.isDirectory() ? "dir"
        : stat.isBlockDevice() ? "blcdev"
        : stat.isCharacterDevice() ? "chardev"
        : stat.isSymbolicLink() ? "symlink"
        : stat.isFIFO() ? "fifo"
        : stat.isSocket() ? "socket"
        : "unkown";
  }

  export type FileInfo = {name: string, stat: fs.Stats};
  export async function ls(info: FileInfo, prefix=""): Promise<FileInfo[]>{
    if(!info.stat.isDirectory()){ return [] }
    const names = await new Promise<string[]>((r, l)=> fs.readdir(path.join(prefix, info.name), (err, val)=> err ? l(err) : r(val) ));
    return Promise.all(
      names.map((name)=>
        new Promise<FileInfo>((r, l)=> fs.lstat(path.join(prefix, info.name, name), (err, val)=> err ? l(err) : r({name: name, stat: val}) ) )
      )
    );
  }

  export type DirTree = {name: string, stat: fs.Stats, children: DirTree[] };
  export async function tree(pathname: string, maxDepth=Infinity): Promise<DirTree[]> {
    const parent = await new Promise<FileInfo>((r, l)=> fs.lstat(pathname, (err, val)=> err ? l(err) : r({name: pathname, stat: val}) ) );
    const children = await ls(parent);
    return Promise.all(children.map((info)=> tree2(info.name, pathname)));
    async function tree2(pathname: string, prefix="", depth=0): Promise<DirTree> {
      const parent = await new Promise<FileInfo>((r, l)=> fs.lstat(path.join(prefix, pathname), (err, val)=> err ? l(err) : r({name: pathname, stat: val}) ) );
      const children = depth >= maxDepth ? [] : await Promise.all((await ls(parent, prefix)).map((info)=> tree2(path.join(pathname, info.name), prefix, depth+1)));
      return {children, ...parent};
    }
  }

  export type SimpleDirTree = {name: string, isDirectory: false} | {name: string, isDirectory: true, children: SimpleDirTree[] };
  export function simplify(tree: DirTree): SimpleDirTree {
    const {name, stat, children} = tree;
    if(stat.isDirectory()){
      return {name, isDirectory: true, children: children.map((a)=> simplify(a) )}
    }else{
      return {name, isDirectory: false};
    }
  }
  export function listify(tree: DirTree): {[path: string]: boolean} {
    const {name, stat, children} = tree;
    if(stat.isDirectory()){
      return children.reduce<{[path: string]: boolean}>((o, a)=> Object.assign(o, listify(a)), {[name]: true});
    }else{
      return {[name]: false};
    }
  }
}


export class IO{
  readonly savefile: string;
  readonly input_dir: string;
  readonly output_dir: string;
  queuing: Array<string>;
  processing: Set<string>;
  processed: Set<string>;
  ignored: {[path: string]:  [number, string]};
  constructor(savefile: string, input_dir: string, output_dir: string){
    this.savefile = savefile;
    this.input_dir = input_dir;
    this.output_dir = output_dir;
    this.queuing = [];
    this.processing = new Set();
    this.processed = new Set();
    this.ignored = {};
  }
  async load(){
    try{
      console.log("loading");
      const text = await new Promise<string>((r,l)=> fs.readFile(this.savefile, "utf8", (err, val)=> err ? l(err) : r(val)) );
      const o = JSON.parse(text);
      this.processed = new Set(o.processed);
      this.ignored = o.ignored;
    }catch(err){
      console.log("create save file");
      await this.save();
    }
    console.log("loaded");
  }
  async fetch(){
    const [in_tree, out_tree] = await Promise.all([
      FS.tree(this.input_dir),
      FS.tree(this.output_dir, 2)
    ]);
    await Promise.all([
      new Promise<void>((r,l)=> fs.writeFile("/home/dgxuser/yosuke/Github/ScorerManagementConsole/public/in.json", JSON.stringify(in_tree.map((a)=>FS.simplify(a))), (err)=> err ? l(err) : r())),
      new Promise<void>((r,l)=> fs.writeFile("/home/dgxuser/yosuke/Github/ScorerManagementConsole/public/out.json", JSON.stringify(out_tree.map((a)=>FS.simplify(a))), (err)=> err ? l(err) : r())),
      new Promise<void>((r,l)=> fs.writeFile("/home/dgxuser/yosuke/Github/ScorerManagementConsole/public/processing.json", JSON.stringify([...this.processing]), (err)=> err ? l(err) : r()))
    ]);
    const [in_list, out_list] = [in_tree, out_tree].map((lst)=> lst.reduce((o, a)=> Object.assign(o, FS.listify(a)), {}));
    //console.log(util.inspect({in_list}, true, 10));
    //console.log(util.inspect({out_list}, true, 10));
    const diff = deep_diff.diff(out_list, in_list);
    //console.log(util.inspect({diff}, true, 10));
    const new_mp4_files = diff.filter((a)=> a.kind === "N" && a.rhs === false && in_list[a.path[0]] != null && /\.mp4$/.test(a.path[0] || "")).map((a)=> a.path[0]);
    //console.log(util.inspect({new_mp4_files}, true, 10));
    console.log("new_mp4_files", new_mp4_files.length);
    this.queuing = new_mp4_files
      .filter((somepath)=> this.ignored[somepath] == null)
      .filter((somepath)=> !this.processing.has(somepath));
  }
  empty(): boolean {
    return this.queuing.length === 0;
  }
  async run(gpuId: number, workdir: string, bash_script_file: string): Promise<number> {
    const initialize = await spawn(`rm -rf "${workdir}" && mkdir -p "${workdir}"`, {}).promise;
    if(initialize.code !== 0){ throw new Error("initialize failed "+initialize.code); }
    const nullable = this.queuing.shift();
    if(typeof nullable !== "string"){ throw new Error("queue is empty"); }
    const processing_file = nullable;
    const input_file = path.join(this.input_dir, processing_file);
    const output_path = path.join(this.output_dir, processing_file);
    const log_file = path.join(workdir, path.basename(bash_script_file)+".log");
    this.processing.add(processing_file);
    const bash = await spawn(`bash -euvx "${bash_script_file}" "${gpuId}" "${input_file}" "${workdir}" 2>&1 | tee "${log_file}"`, { stdio: ["inherit", "ignore", "ignore"] }).promise;
    if(bash.code !== 0){
      console.log("ignore", processing_file, log_file);
      this.ignored[processing_file] = [Date.now(), log_file];
      return bash.code;
    }
    const finalize = await spawn(`mkdir -p "${output_path}" && cd "${workdir}" && cp -r ./* "${output_path}" && rm -rf ./*`, {}).promise;
    if(finalize.code !== 0){ throw new Error("finalize failed "+finalize.code); }
    console.log("commit", processing_file);
    this.processing.delete(processing_file);
    this.processed.add(processing_file);
    return bash.code;
  }
  async save(){
    const text = JSON.stringify({
      processed: [...this.processed],
      ignored: this.ignored
    });
    //console.log(this.savefile, text);
    await new Promise<void>((r,l)=> fs.writeFile(this.savefile, text, (err)=> err ? l(err) : r()));
  }
}
