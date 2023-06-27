import fs from "fs";
import path from "path";
import {spawn} from "child_process";

import {createCanvas, loadImage} from "node-canvas";
import mime from "mime-types";

import {DiscriminatedUnion} from "./discriminatedUnion";
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

async function framesToMp4(id:string, format:string, framerate:number) {
    console.log("ffmpeg frame converting");
    return new Promise((resolve, reject) => {
        const ffmpeg = spawn("ffmpeg", ["-framerate", `${framerate}`,
                                        `-i`, `data/renders/${id}/finished/frame-%d.PNG`,
                                        `data/renders/${id}/finished/final.mp4`]);

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

type ThumbnailCache = DiscriminatedUnion<"status", {
    done: {path:string},
    pending: {lastChecked:number}
}>;
// creating thumbnails is an expensive operation, so we keep a cache to check against
let thumbnailCache:{[unit:string]:ThumbnailCache} = {};

/**
 * Get thumbnail for project
 * 
 * @returns path of thumbnail
 */
export async function getThumbnail(ctx:Context, projectid:string | number):Promise<string> {
    if(!fs.existsSync(path.join(constants.DATA_DIR, constants.THUMBNAIL_DIR))) fs.mkdirSync(path.join(constants.DATA_DIR, constants.THUMBNAIL_DIR));
    const defaultThumbnailPath = path.join("server", "compositor", "assets", constants.DEFAULT_THUMBNAIL_NAME);

    //console.log(`Cache for ${projectid}`);
    if(thumbnailCache[projectid]) { // cache entry exists
        //console.log("cache entry exists");
        let cacheEntry = thumbnailCache[projectid];
        if(cacheEntry.status === "done") {  // cache is complete
            //console.log("cache entry is done");
            return cacheEntry.path;
        } else if(cacheEntry.status === "pending") { // cache is incomplete
            //console.log("cache entry is incomplete");
            if(Date.now() < (cacheEntry.lastChecked + constants.THUMBNAIL_RECHECK_INTERVAL)) {
                //console.log("cache entry is below regen threshold");
                return defaultThumbnailPath;
            } // cache is checked too soon to retry
        }
    }

    //console.log("generating cache entry");

    const thumbDir = path.join(constants.DATA_DIR, constants.THUMBNAIL_DIR);
    const thumbPath = path.join(thumbDir, `${projectid}.jpg`);
    if(fs.existsSync(thumbPath)) { // has already been generated!
        //console.log("already exists");
        thumbnailCache[projectid] = {
            status: "done",
            path: thumbPath
        };
        return thumbPath;
    }
    
    // ok, we need to generate
    let project = await ctx.dbc.getById("projects", projectid);
    let renderdata = await ctx.dbc.getById("renderdata", project.renderdata_index);
    let finishedChunks:Array<string> = JSON.parse(renderdata.finished_chunks);
    let firstFrameFinishedChunks = finishedChunks.filter(chunk => chunk.split("_")[1] === String(renderdata.framestart));

    if(firstFrameFinishedChunks.length < renderdata.cutinto * renderdata.cutinto) { // not enough to complete the first frame
        //console.log("do not have enough data to generate thumbnail");

        thumbnailCache[projectid] = {
            status: "pending",
            lastChecked: Date.now()
        };

        return defaultThumbnailPath;
    }

    // ok, we can generate
    console.log(`generating thumbnail for ${project.id}`);

    let format = getImagesFormat(`${project.id}_${renderdata.framestart}_0_0`); // so we know if it is png or jpeg
    let imagesPath = path.join(constants.DATA_DIR, constants.RENDERS_DIR, `${project.id}`, "raw");
    let sampleImage = await loadImage(path.join(imagesPath, `${project.id}_${renderdata.framestart}_0_0.${format}`));
    let imageWidth = constants.THUMBNAIL_WIDTH;
    let imageHeight = imageWidth / (sampleImage.width / sampleImage.height);
    let {cutinto, framestart} = renderdata;

    let canvas = createCanvas(imageWidth, imageHeight);
    let c = canvas.getContext("2d");
    for(let row = 0; row < cutinto; row++) {
        for(let col = 0; col < cutinto; col++) {
            let image = await loadImage(path.join(imagesPath, `${project.id}_${framestart}_${row}_${col}.${format}`));
            c.drawImage(image, 0, 0, imageWidth, imageHeight);
        }
    }

    fs.writeFileSync(thumbPath, canvas.toBuffer("image/jpeg"));
    thumbnailCache[projectid] = {
        status: "done",
        path: thumbPath
    }

    //console.log("Done");

    return thumbPath;
}

/**
 * Ok lets stitch a scene into images
 */
export async function compositeRender(ctx:Context, projectid:string | number) {
    let project = await ctx.dbc.getById("projects", projectid);
    let renderdata = await ctx.dbc.getById("renderdata", project.renderdata_index);

    let rd = JSON.parse(fs.readFileSync(path.join(constants.DATA_DIR, constants.RENDERS_DIR, `${project.id}`, "renderdata")).toString());
    let {fps, fps_base} = rd;
    let resolution = { // output image dimensions
        width: rd.resolution_x * (rd.resolution_percentage / 100),
        height: rd.resolution_y * (rd.resolution_percentage / 100)
    };

    let format = getImagesFormat(`${project.id}_${renderdata.framestart}_0_0`); // so we know if it is png or jpeg
    let imagesPath = path.join(constants.DATA_DIR, constants.RENDERS_DIR, `${project.id}`, "raw");

    let finishedPath = path.join(constants.DATA_DIR, constants.RENDERS_DIR, `${project.id}`, "finished");
    if(!fs.existsSync(finishedPath)) fs.mkdirSync(finishedPath); // path for all the finished stuff to go into

    //for(let frame = renderdata.framestart; renderdata.animation ? frame < renderdata.frameend : !imageDone; frame++) {
    let frame = renderdata.framestart;
    do {
        let canvas = createCanvas(resolution.width, resolution.height);
        let c = canvas.getContext("2d");
        for(let row = 0; row < renderdata.cutinto; row++) {
            for(let col = 0; col < renderdata.cutinto; col++) {
                let image = await loadImage(path.join(imagesPath, `${project.id}_${frame}_${row}_${col}.${format}`));
                c.drawImage(image, 0, 0);
            }
        }

        fs.writeFileSync(path.join(constants.DATA_DIR, constants.RENDERS_DIR, `${project.id}`, "finished", `frame-${frame}.${format}`), canvas.toBuffer(mime.lookup(format) as unknown as any));
        console.log(`Combined frame ${frame}`);
        frame++;
    } while((renderdata.animation == 1) ? frame < renderdata.frameend : false);

    if(renderdata.animation) { // if it is an animation
        // we need to combine the frames into a video now
        console.log("Combining frames with ffmpeg");
        await framesToMp4(`${project.id}`, format, fps * fps_base); // ok lets stitch
    } else {
        // rename image and dump it in
        console.log("Renaming image");
        fs.renameSync(path.join(constants.DATA_DIR, constants.RENDERS_DIR, `${project.id}`, "finished", `frame-${renderdata.framestart}.${format}`), path.join(finishedPath, `final.${format}`));
    }

    console.log("Zipping raw frames");
    // zip raw images, also set rendered to true
    await zipDir(path.join(constants.DATA_DIR, constants.RENDERS_DIR, `${project.id}`, "raw"), path.join(constants.DATA_DIR, constants.RENDERS_DIR, `${project.id}`, "finished", "raw.zip"));

    await ctx.dbc.updateById("projects", project.id, {rendered: true});

    // done!
}
