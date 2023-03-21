import fs from "fs";
import path from "path";

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

/**
 * Ok lets stitch a scene into images
 */
export async function compositeRender(ctx:Context, projectid:string | number) {
    let project = await ctx.dbc.getById("projects", projectid);
    let renderdata = await ctx.dbc.getById("renderdata", project.renderdata_index);

    let format = getImagesFormat(`${project.id}_${renderdata.framestart}_0_0`); // so we know if it is png or jpeg
    let imagesPath = path.join(constants.DATA_DIR, constants.RENDERS_DIR, `${project.id}`, "raw");

    let sampleImage = await loadImage(path.join(imagesPath, `${project.id}_${renderdata.framestart}_0_0.${format}`));
    
    let canvas = createCanvas(sampleImage.width, sampleImage.height);
    let c = canvas.getContext("2d");
    for(let row = 0; row < renderdata.cutinto; row++) {
        for(let col = 0; col < renderdata.cutinto; col++) {
            let image = await loadImage(path.join(imagesPath, `${project.id}_${renderdata.framestart}_${row}_${col}.${format}`));
            c.drawImage(image, 0, 0);
        }
    }

    fs.writeFileSync(path.join(constants.DATA_DIR, constants.RENDERS_DIR, `${project.id}`, "raw", `${renderdata.framestart}.PNG`), canvas.toBuffer());
}