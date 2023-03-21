import fs from "fs";
import path from "path";

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
}