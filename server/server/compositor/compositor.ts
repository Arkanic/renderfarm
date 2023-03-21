import fs from "fs";
import path from "path";
import {spawn} from "child_process";

import {createCanvas, loadImage} from "node-canvas";

import {Context} from "../server";
import constants from "../constants";

/**
 * Get the format that the images are in
 * 
 * @param firstChunkid *what* chunkid this is doesn't actually matter, just used to search the directory
 * @returns "PNG", "JPEG", "RANDOMEXTENSION"
 */
function getImagesFormat(firstChunkid:string):string {
    let files = fs.readdirSync(path.join(constants.DATA_DIR, constants.RENDERS_DIR, firstChunkid.split("_")[0], "raw")).filter(f => f.startsWith(firstChunkid));
    if(files.length < 1) throw new Error("image does not exist!");

    let file = files[0];
    let splitFile = file.split(".");

    return splitFile[splitFile.length - 1];
}

async function zipDir(dir:string, out:string) {
    console.log(`Zipping ${dir} into ${out}`);
    return new Promise((resolve, reject) => {
        const zip = spawn("zip", ["-r", out, dir]);
        
        zip.stdout.on("data", data => {
            console.log(data.toString());
        });

        zip.stderr.on("data", data => {
            console.log(data.toString());
        });

        zip.on("close", code => {
            if(code != 0) reject(code);
            resolve(code);
        });
    })
}

async function framesToMp4(loc:string, format:string, framerate:number) {
    console.log("ffmpeg frame converting");
    return new Promise((resolve, reject) => {
        const ffmpeg = spawn("ffmpeg", ["-framerate", `${framerate}`,
                                        "-i", `"${path.join(loc, "raw", `frame-%d.${format}`)}"`,
                                        path.join(loc, "finished", "final.mp4")]);
        
        ffmpeg.stdout.on("data", data => {
            console.log(data.toString());
        });

        ffmpeg.stderr.on("data", data => {
            console.log(data.toString());
        });

        ffmpeg.on("close", code => {
            if(code != 0) return reject();
            resolve(code);
        });
    });
}

/**
 * Ok lets stitch a scene into images
 */
export async function compositeRender(ctx:Context, projectid:string | number) {
    let project = await ctx.dbc.getById("projects", projectid);
    let renderdata = await ctx.dbc.getById("renderdata", project.renderdata_index);

    let format = getImagesFormat(`${project.id}_${renderdata.framestart}_0_0`); // so we know if it is png or jpeg
    let imagesPath = path.join(constants.DATA_DIR, constants.RENDERS_DIR, `${project.id}`, "raw");

    let sampleImage = await loadImage(path.join(imagesPath, `${project.id}_${renderdata.framestart}_0_0.${format}`));

    for(let frame = renderdata.framestart; renderdata.animation ? frame < renderdata.frameend : frame < renderdata.framestart + 1; frame++) {
        let canvas = createCanvas(sampleImage.width, sampleImage.height);
        let c = canvas.getContext("2d");
        for(let row = 0; row < renderdata.cutinto; row++) {
            for(let col = 0; col < renderdata.cutinto; col++) {
                let image = await loadImage(path.join(imagesPath, `${project.id}_${frame}_${row}_${col}.${format}`));
                c.drawImage(image, 0, 0);
            }
        }

        fs.writeFileSync(path.join(constants.DATA_DIR, constants.RENDERS_DIR, `${project.id}`, "raw", `frame-${frame}.${format}`), canvas.toBuffer());
    }

    let finishedPath = path.join(constants.DATA_DIR, constants.RENDERS_DIR, `${project.id}`, "finished");
    if(!fs.existsSync(finishedPath)) fs.mkdirSync(finishedPath); // path for all the finished stuff to go into

    if(renderdata.animation) { // if it is an animation
        // we need to combine the frames into a video now
        let [fps, fpsbase] = fs.readFileSync(path.join(constants.DATA_DIR, constants.RENDERS_DIR, `${project.id}`, "renderdata")).toString().split("\n").map(s => parseInt(s));
        await framesToMp4(path.join(constants.DATA_DIR, constants.RENDERS_DIR, `${project.id}`), format, fps * fpsbase); // ok lets stitch
    } else {
        // rename image and dump it in
        fs.renameSync(path.join(constants.DATA_DIR, constants.RENDERS_DIR, `${project.id}`, "raw", `frame-${renderdata.framestart}.${format}`), path.join(finishedPath, `final.${format}`));
    }

    // zip raw images, also set rendered to true
    await zipDir(imagesPath, path.join(constants.DATA_DIR, constants.RENDERS_DIR, `${project.id}`, "finished", "raw.zip"));

    await ctx.dbc.updateById("projects", project.id, {rendered: true});

    // done!
}