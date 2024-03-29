import fs, {PathLike} from "fs";
import path from "path";
import Logger from "./util/logger";
import spawnProcess from "./util/spawn";
import {exit} from "process";
import crypto, {BinaryToTextEncoding} from "crypto";

import * as types from "./types/api";

import axios from "axios";
import orc from "orc-me";

const SERVER_TXT = "./server.txt";
const SERVER_HASH_TXT = "./server-hash.txt";
const NAME_TXT = "./name.txt";
const BLENDER_TAR_XZ = "./blender.tar.xz";
const BLENDER_DIR = "./blender";
const BLENDER_LOCATION_TXT = "./blender-location.txt";
const DATA_DIR = "./data";
const TEMP_DIR = "./temp";
const PRUNE_PROJECTS_INTERVAL = 1000 * 60 * 30; // every 30 minutes check
const SEND_LOGS_INTERVAL = 1000 * 30; // every 30 seconds send current logs

let logger = new Logger();

console.log("Renderfarm worker");

const delay = (ms:number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Get the sha256 hash of a file in the specified format
 */
function getFileHash(file:PathLike, as:BinaryToTextEncoding) {
    const fileData = fs.readFileSync(file);
    const fileHash = crypto.createHash("sha256");
    fileHash.update(fileData);

    return fileHash.digest(as);
}

async function unzipTar(file:string):Promise<number> {
    console.log(`Un-tar.xzing ${file}`)

    return spawnProcess("tar", ["-xvf", file, "-C", BLENDER_DIR]);
}

async function unzipZip(file:string, to:string):Promise<number> {
    return spawnProcess("unzip", [file, "-d", to]);
}

// make folders required by the code
function makeFolders() {
    // If any of these required folders do not exist, make them (they will be populated later)
    if(!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
    if(!fs.existsSync(BLENDER_DIR)) fs.mkdirSync(BLENDER_DIR);
    if(!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);
}
makeFolders();

// first up try to decipher server.txt to find what to connect to
if(!fs.existsSync(SERVER_TXT)) {
    console.log("ERR! No server.txt!!!\nMake a file called server.txt that contains the ip (ie 192.168.1.1) of the server!");
    exit(1);
}
let sip = fs.readFileSync(SERVER_TXT).toString().split("\n")[0]; // only interested in the first line
if(sip.split(".").length != 4) {
    console.log("ERR! server.txt contains an invalid ip address!");
    exit(1);
}
console.log(`Server's IP is ${sip}`);

let surl = `http://${sip}:2254`;

let name = "";
// ok now lets find our name or generate it
if(!fs.existsSync(NAME_TXT)) {
    console.log("Generating name for myself");
    name = `${orc()} ${orc()}`; // shrig glur nogg
    fs.writeFileSync(NAME_TXT, name);
} else {
    console.log("Finding my name");
    name = fs.readFileSync(NAME_TXT).toString().split("\n")[0];
}
console.log(`I am ${name}`);

// main code body, async wrapper so we can use neat await
(async () => {
    let joinResponse:types.JoinResponse = null as unknown as types.JoinResponse;
    let joinResponded = false;
    while(!joinResponded) {
        try {
            joinResponse = (await axios.post(`${surl}/api/join`, {
                name
            })).data;
        } catch(err:any) {
            console.log("Can't connect to server. sleeping for one minute then retry.");
            await delay(1000 * 60); // 1 minute
            continue;
        }

        joinResponded = true; // didn't continue, must work
    }

    const {id} = joinResponse;

    try {

    console.log("Checking server hash");
    if(fs.existsSync(SERVER_HASH_TXT)) {
        let oldServerHash = fs.readFileSync(SERVER_HASH_TXT).toString();
        if(oldServerHash != joinResponse.serverhash) {
            console.log("It is different, removing old cache...");
            fs.rmSync(TEMP_DIR, {force: true, recursive: true});
            fs.rmSync(DATA_DIR, {force: true, recursive: true});
            makeFolders();
        } else {
            console.log("It is the same");
        }
    }
    fs.writeFileSync(SERVER_HASH_TXT, joinResponse.serverhash);
    console.log(joinResponse.serverhash);

    console.log(`My id is "${id}"`);

    /**
     * Save blender.tar.xz to a file and unzip it
     */
    async function downloadProcessBlender() {
        console.log("Downloading blender.tar.xz...");
        let blenderdata = await axios.get(`${surl}/dat/blender.tar.xz`, {responseType: "arraybuffer"});
        console.log("Writing blender.tar.xz to file...");
        fs.writeFileSync(BLENDER_TAR_XZ, blenderdata.data);
        if(getFileHash(BLENDER_TAR_XZ, "hex") !== joinResponse.blenderhash) {
            console.log("Newly downloaded blender.tar.xz doesn't match the hash the server sent!!!\n(this is weird)");
            console.log(`Local ${getFileHash(BLENDER_TAR_XZ, "hex")} vs Server ${joinResponse.blenderhash}`)
            exit(1);
        }
        await unzipTar(BLENDER_TAR_XZ);

        // ok now we find where the binary is
        let blenderVersionDir = fs.readdirSync(BLENDER_DIR)[0]; // there shouldn't be anything else in here.
        let blenderVersionDirContents = fs.readdirSync(path.join(BLENDER_DIR, blenderVersionDir));
        if(!blenderVersionDirContents.includes("blender")) {
            console.log("Couldn't find blender in unzipped contents!!!");
            exit(1);
        }

        let blenderLocation = path.join(BLENDER_DIR, blenderVersionDir, "blender");
        fs.writeFileSync(BLENDER_LOCATION_TXT, blenderLocation);
    }

    // lets see if we have the right blender now
    if(!fs.existsSync(BLENDER_TAR_XZ)) {
        console.log("Downloading blender...");
        await downloadProcessBlender();
    } else if(getFileHash(BLENDER_TAR_XZ, "hex") !== joinResponse.blenderhash) {
        console.log("Downloading updated blender...");
        console.log("Resetting files..."); // now we remove all traces of old blender
        fs.rmSync(BLENDER_DIR, {recursive: true, force: true});
        fs.unlinkSync(BLENDER_TAR_XZ);
        fs.mkdirSync(BLENDER_DIR);
        await downloadProcessBlender();
    } else {
        console.log("Blender hash is the same");
    }

    const blenderLocation = fs.readFileSync(BLENDER_LOCATION_TXT).toString().split("\n")[0];
    console.log(`Blender is at ${blenderLocation}`);

    /**
     * Prune old project files
     */
    async function pruneProjects() {
        console.log("Pruning old projects...");
        let res = await axios.post(`${surl}/api/projectsindex`, {unfinishedonly: false});
        let data:types.ProjectsIndexResponse = res.data;
        if(!data.success) {
            console.log("Projectsindex fail");
            console.log(data.message || "No message provided");
            exit(2);
        }

        let {projects} = data;
        let allUnfinishedProjects = projects.filter(p => !p.finished).map(p => (typeof p.id === "string") ? parseInt(p.id) : p.id); // remove unfinished projects
        let cachedProjects = fs.readdirSync(TEMP_DIR).map(f => parseInt(f));
        for(let i in cachedProjects) {
            let cachedProject = cachedProjects[i];
            if(allUnfinishedProjects.includes(cachedProject)) continue;

            let theoreticalPath = path.join(DATA_DIR, `${cachedProject}.zip`);
            if(fs.existsSync(theoreticalPath)) {
                console.log(`Deleting finished project files of ${cachedProject}`);
                fs.unlinkSync(theoreticalPath);

                // delete unzipped version
                fs.rmSync(path.join(TEMP_DIR, `${cachedProject}`), {recursive: true, force: true});
            }
        }
    }

    setInterval(async () => {await pruneProjects()}, PRUNE_PROJECTS_INTERVAL);
    await pruneProjects();

    setInterval(async () => {

        await axios.post(`${surl}/api/updatelogs`, {
            id: id,
            newlogs: logger.getLog().join("\n") + "\n"
        });
    }, SEND_LOGS_INTERVAL);

    setInterval(async () => {
        await axios.post(`${surl}/api/heartbeat`, {id: id}); // kindly let them know we are alive
    }, joinResponse.heartbeatinterval);

    process.on("SIGTERM", async () => {
        console.log("Received sigterm...");
        await axios.post(`${surl}/api/leave`, {id: id});
    });

    // the eternal silicon torture begins
    while(true) {
        // first step: ask for job
        let iHaveJob = false;
        let job:types.GetjobResponse = null as unknown as types.GetjobResponse;
        while(!iHaveJob) {
            let res = await axios.post(`${surl}/api/getjob`, {id: id})
            job = res.data;

            if(job.available) {
                iHaveJob = true; // yes!
            } else {
                console.log(`No jobs available. Waiting ${Math.floor(job.waittime!/1000)}s before retrying`);
                await delay(job.waittime!);
            }
        }

        // ok, we have a job now!
        console.log(`Job Found! I am now doing part ${job.chunkid}`);
        
        let theoreticalPath = path.join(DATA_DIR, `${job.dataid}.zip`);
        if(!fs.existsSync(theoreticalPath)) {
            console.log("Data for this project not cached, downloading...");
            let projectdata = await axios.get(`${surl}/dat/projects/${job.dataid}`, {responseType: "arraybuffer"});
            console.log("Saving...");
            fs.writeFileSync(theoreticalPath, projectdata.data);

            console.log("Unzipping...");
            fs.mkdirSync(path.join(TEMP_DIR, `${job.dataid}`)); // if it is a number turn the id into a string
            await unzipZip(theoreticalPath, path.join(TEMP_DIR, `${job.dataid}`));

            console.log("Done!");
        } else {
            console.log("I already have the data for this project cached. continuing...");
        }

        // we have project file, go for it!
        console.log(`Rendering ${job.chunkid}`);
        console.log(`File is ${job.blendfile}, split into ${job.cutinto}x${job.cutinto}. I am rendering (${job.row}, ${job.column})`);

        let blenderResult = await spawnProcess(`./${blenderLocation}`, [ // launch blender
            "-noaudio", // don't do audio, causes some strange crashes
            "-b", path.join(TEMP_DIR, `${job.dataid}`, job.blendfile), // the blender file is here
            "-P", "worker/renderer.py", // the script is here
            "--", // options for the script
            TEMP_DIR, // where to save out.whatever
            job.frame.toString(), // frame
            job.cutinto.toString(), // what to split into?
            job.row.toString(), // what row to render
            job.column.toString(), // what column to render
            job.overscan.toString()
        ]);

        console.log("Blender finished");

        let request:types.FinishjobRequest = {
            id: id,
            chunkid: job.chunkid,
            statuscode: blenderResult
        } as unknown as types.FinishjobRequest;

        if(blenderResult !== 0) {
            console.log("Blender fail");

            request.success = false;
            request.errormessage = logger.getLog().join("\n") + "\n";

            request.image = "placeholder";

            await axios.post(`${surl}/api/finishjob`, request);
        } else {
            console.log("Blender success");

            let files = fs.readdirSync(TEMP_DIR).filter(o => o.startsWith("out"));
            if(files.length < 1) {
                console.log("Out image doesn't exist!");
                request.success = false;
                request.errormessage = "Blender didn't produce an image";

                await axios.post(`${surl}/api/finishjob`, request);
            } else {
                let blenderOutput = files.filter(f => f.startsWith("out"))[0]; // our image;
                let blenderOutputPath = path.join(TEMP_DIR, blenderOutput);

                // trim overscanned edges from output image
                // therefore removing seams from image
                if(job.row > 0) {
                    await spawnProcess("convert", [
                        blenderOutputPath,
                        "-gravity", "West",
                        "-chop", `${job.overscan}x0`,
                        blenderOutputPath
                    ]);
                }
                if(job.row < job.cutinto - 1) {
                    await spawnProcess("convert", [
                        blenderOutputPath,
                        "-gravity", "East",
                        "-chop", `${job.overscan}x0`,
                        blenderOutputPath
                    ]);
                }
                if(job.column > 0) {
                    await spawnProcess("convert", [
                        blenderOutputPath,
                        "-gravity", "South",
                        "-chop", `0x${job.overscan}`,
                        blenderOutputPath
                    ]);
                }
                if(job.column < job.cutinto - 1) {
                    await spawnProcess("convert", [
                        blenderOutputPath,
                        "-gravity", "North",
                        "-chop", `0x${job.overscan}`,
                        blenderOutputPath
                    ]);
                }

                let outputImage = fs.readFileSync(blenderOutputPath);
                request.success = true;
                request.image = outputImage.toString("base64");

                if(!fs.existsSync(path.join(TEMP_DIR, "renderdata"))) {
                    console.log("Renderdata doesn't exist!");
                    request.success = false;
                    request.errormessage = "Renderdata didn't exist for this image";

                    await axios.post(`${surl}/api/finishjob`, request);
                } else {
                    let outputImagedata = fs.readFileSync(path.join(TEMP_DIR, "renderdata")).toString();
                    let [fps, fps_base, resolution_x, resolution_y, resolution_percentage] = outputImagedata.split("\n").map(s => parseInt(s));

                    request.renderdata = {
                        fps,
                        fps_base,
                        resolution_x,
                        resolution_y,
                        resolution_percentage
                    }

                    console.log("Sending result image...");
                    await axios.post(`${surl}/api/finishjob`, request);
                }

                // clean up
                fs.unlinkSync(blenderOutputPath); // delete result image
            }
        }

        console.log("Done!!!");
    }

    } catch(err:any) {
        await axios.post(`${surl}/api/panic`, {id:id, error:err.toString()});
        throw err;
    }
})();