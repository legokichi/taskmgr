import path = require("path");
import * as taskmgr from "./taskmgr";

export async function run(gpuId: number, filepath: string, workdir: string): Promise<void> {
    const cmd = `
    cp -f ${filepath} ${workdir} \
    && nvidia-docker run \
      --rm \
      -ti \
      -v ${workdir}:${workdir} \
      --workdir /opt/openpose-docker \
      scp-dev/openpose/openpose:latest \
        bash -c " \
          ./build/examples/openpose/openpose.bin \
            --no_display=1 \
            --num_gpu=1 \
            --video ${path.join(workdir, path.basename(filepath))} \
            --write_video=./result.mp4 \
            --write_json=./result_dir \
          && cat ./result_dir/* > ./result.json \
          && mv ./result.mp4 ${workdir} \
          && mv ./result.json ${workdir} \
        "`
    const task = await taskmgr.spawn(cmd, {}).promise;
    if(task.code !== 0){ return Promise.reject(new Error("task failed")); }
  }
  