import path = require("path");
import * as taskmgr from "./taskmgr";

export async function run(gpuId: number, filepath: string, workdir: string): Promise<void> {
    workdir = workdir.split(" ").join("\\ ");
    filepath = filepath.split(" ").join("\\ ");
    const cp = await taskmgr.spawn(`cp -f ${filepath} ${workdir}`, {}).promise;
    if(cp.code !== 0){ throw new Error("cp failed "+cp.code); }
    const nvidia_docker = await taskmgr.spawn(`
      env NV_GPU=${gpuId} nvidia-docker run \
        --rm -ti \
        -v ${workdir}:${workdir} \
        --workdir /opt/openpose \
        openpose-docker:9.0 \
         bash -c " \
          ./build/examples/openpose/openpose.bin \
            --no_display=1 \
            --num_gpu=1 \
            --video ${path.join(workdir, path.basename(filepath))} \
            --write_video=${workdir}/result.mp4 \
            --write_keypoint_json=${workdir}/result_dir \
          && chown 777 -R ${workdir} " \
    `, {}).promise;
    if(nvidia_docker.code !== 0){ throw new Error("nvidia_docker failed "+nvidia_docker.code); }
    // cat ${workdir}/result_dir/* > ${workdir}/result.json \
  }
  
