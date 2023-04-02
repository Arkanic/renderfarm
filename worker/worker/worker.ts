import fs, {PathLike} from "fs";
import path from "path";
import {spawn} from "child_process";
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

let previousLog:Array<string> = [];
function log(str:string) {
    console.log(str);
    previousLog.push(str);
}

function resetLog() {
    previousLog = [];
}

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

async function unzipTar(file:string):Promise<void> {
    log(`Un-tar.xzing ${file}`)
    return new Promise((resolve, reject) => {
        const tar = spawn("tar", ["-xvf", file, "-C", BLENDER_DIR]);

        tar.stdout.on("data", data => {
            // response data, into a string, removing the last character (newline)
            log(data.toString());
        });

        tar.stderr.on("data", data => {
            log(data.toString());
        });

        tar.on("close", (code) => {
            if(code != 0) return reject();
            resolve();
        });
    });
}

async function unzipZip(file:string, to:string):Promise<void> {
    return new Promise((resolve, reject) => {
        const zip = spawn("unzip", [file, "-d", to]);

        zip.stdout.on("data", data => {
            // response data, into a string, removing the last character (newline)
            log(data.toString());
        });

        zip.stderr.on("data", data => {
            log(data.toString());
        });

        zip.on("close", (code) => {
            if(code != 0) return reject();
            resolve();
        });
    });
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
    log("ERR! No server.txt!!!\nMake a file called server.txt that contains the ip (ie 192.168.1.1) of the server!");
    exit(1);
}
let sip = fs.readFileSync(SERVER_TXT).toString().split("\n")[0]; // only interested in the first line
if(sip.split(".").length != 4) {
    log("ERR! server.txt contains an invalid ip address!");
    exit(1);
}
log(`Server's IP is ${sip}`);

let surl = `http://${sip}:2254`;

let name = "";
// ok now lets find our name or generate it
if(!fs.existsSync(NAME_TXT)) {
    log("Generating name for myself");
    name = `${orc()} ${orc()}`; // shrig glur nogg
    fs.writeFileSync(NAME_TXT, name);
} else {
    log("Finding my name");
    name = fs.readFileSync(NAME_TXT).toString().split("\n")[0];
}
log(`I am ${name}`);

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
            log("Can't connect to server. sleeping for one minute then retry.");
            await delay(1000 * 60); // 1 minute
            continue;
        }

        joinResponded = true; // didn't continue, must work
    }

    const {id} = joinResponse;

    try {

    log("Checking server hash");
    if(fs.existsSync(SERVER_HASH_TXT)) {
        let oldServerHash = fs.readFileSync(SERVER_HASH_TXT).toString();
        if(oldServerHash != joinResponse.serverhash) {
            log("It is different, removing old cache...");
            fs.rmSync(TEMP_DIR, {force: true, recursive: true});
            fs.rmSync(DATA_DIR, {force: true, recursive: true});
            makeFolders();
        } else {
            log("It is the same");
        }
    }
    fs.writeFileSync(SERVER_HASH_TXT, joinResponse.serverhash);
    log(joinResponse.serverhash);

    log(`My id is "${id}"`);

    /**
     * Save blender.tar.xz to a file and unzip it
     */
    async function downloadProcessBlender() {
        log("Downloading blender.tar.xz...");
        let blenderdata = await axios.get(`${surl}/dat/blender.tar.xz`, {responseType: "arraybuffer"});
        log("Writing blender.tar.xz to file...");
        fs.writeFileSync(BLENDER_TAR_XZ, blenderdata.data);
        if(getFileHash(BLENDER_TAR_XZ, "hex") !== joinResponse.blenderhash) {
            log("Newly downloaded blender.tar.xz doesn't match the hash the server sent!!!\n(this is weird)");
            log(`Local ${getFileHash(BLENDER_TAR_XZ, "hex")} vs Server ${joinResponse.blenderhash}`)
            exit(1);
        }
        await unzipTar(BLENDER_TAR_XZ);

        // ok now we find where the binary is
        let blenderVersionDir = fs.readdirSync(BLENDER_DIR)[0]; // there shouldn't be anything else in here.
        let blenderVersionDirContents = fs.readdirSync(path.join(BLENDER_DIR, blenderVersionDir));
        if(!blenderVersionDirContents.includes("blender")) {
            log("Couldn't find blender in unzipped contents!!!");
            exit(1);
        }

        let blenderLocation = path.join(BLENDER_DIR, blenderVersionDir, "blender");
        fs.writeFileSync(BLENDER_LOCATION_TXT, blenderLocation);
    }

    // lets see if we have the right blender now
    if(!fs.existsSync(BLENDER_TAR_XZ)) {
        log("Downloading blender...");
        await downloadProcessBlender();
    } else if(getFileHash(BLENDER_TAR_XZ, "hex") !== joinResponse.blenderhash) {
        log("Downloading updated blender...");
        log("Resetting files..."); // now we remove all traces of old blender
        fs.rmSync(BLENDER_DIR, {recursive: true, force: true});
        fs.unlinkSync(BLENDER_TAR_XZ);
        fs.mkdirSync(BLENDER_DIR);
        await downloadProcessBlender();
    } else {
        log("Blender hash is the same");
    }

    const blenderLocation = fs.readFileSync(BLENDER_LOCATION_TXT).toString().split("\n")[0];
    log(`Blender is at ${blenderLocation}`);

    /**
     * Prune old project files
     */
    async function pruneProjects() {
        log("Pruning old projects...");
        let res = await axios.post(`${surl}/api/projectsindex`, {unfinishedonly: false});
        let data:types.ProjectsIndexResponse = res.data;
        if(!data.success) {
            log("Projectsindex fail");
            log(data.message || "No message provided");
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
                log(`Deleting finished project files of ${cachedProject}`);
                fs.unlinkSync(theoreticalPath);

                // delete unzipped version
                fs.rmSync(path.join(TEMP_DIR, `${cachedProject}`), {recursive: true, force: true});
            }
        }
    }

    setInterval(async () => {await pruneProjects()}, PRUNE_PROJECTS_INTERVAL);
    await pruneProjects();

    setInterval(async () => {
        if(previousLog.length == 0) return;

        await axios.post(`${surl}/api/updatelogs`, {
            id: id,
            newlogs: previousLog.join("\n") + "\n"
        });

        resetLog();
    }, SEND_LOGS_INTERVAL);

    setInterval(async () => {
        await axios.post(`${surl}/api/heartbeat`, {id: id}); // kindly let them know we are alive
    }, joinResponse.heartbeatinterval);

    process.on("SIGTERM", async () => {
        log("Received sigterm...");
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
                log(`No jobs available. Waiting ${Math.floor(job.waittime!/1000)}s before retrying`);
                await delay(job.waittime!);
            }
        }

        // ok, we have a job now!
        log(`Job Found! I am now doing part ${job.chunkid}`);
        
        let theoreticalPath = path.join(DATA_DIR, `${job.dataid}.zip`);
        if(!fs.existsSync(theoreticalPath)) {
            log("Data for this project not cached, downloading...");
            let projectdata = await axios.get(`${surl}/dat/projects/${job.dataid}`, {responseType: "arraybuffer"});
            log("Saving...");
            fs.writeFileSync(theoreticalPath, projectdata.data);

            log("Unzipping...");
            fs.mkdirSync(path.join(TEMP_DIR, `${job.dataid}`)); // if it is a number turn the id into a string
            await unzipZip(theoreticalPath, path.join(TEMP_DIR, `${job.dataid}`));

            log("Done!");
        } else {
            log("I already have the data for this project cached. continuing...");
        }

        // we have project file, go for it!
        log(`Rendering ${job.chunkid}`);
        log(`File is ${job.blendfile}, split into ${job.cutinto}x${job.cutinto}. I am rendering (${job.row}, ${job.column})`);

        let tempLog = "";

        let resultCode = await (new Promise((resolve, reject) => {
            let blender = spawn(`./${blenderLocation}`, [ // launch blender
                "-noaudio", // don't do audio, causes some strange crashes
                "-b", path.join(TEMP_DIR, `${job.dataid}`, job.blendfile), // the blender file is here
                "-P", "worker/renderer.py", // the script is here
                "--", // options for the script
                "-o", TEMP_DIR, // where to save out.whatever
                "-f", job.frame.toString(), // frame
                "-ci", job.cutinto.toString(), // what to split into?
                "-r", job.row.toString(), // what row to render
                "-cl", job.column.toString() // what column to render
            ]);

            blender.stdout.on("data", data => {
                log(data.toString());
                tempLog += data.toString();
            });

            blender.stderr.on("data", data => {
                log(data.toString());
                tempLog += data.toString();
            });

            blender.on("close", code => {
                resolve(code);
            });
        }));

        log("Blender finished");

        let request:types.FinishjobRequest = {
            id: id,
            chunkid: job.chunkid,
            statuscode: resultCode,

        } as unknown as types.FinishjobRequest;

        if(resultCode !== 0) {
            log("Blender fail");

            request.success = false;
            request.errormessage = tempLog;

            request.image = "placeholder";
            request.fps = 0;
            request.fpsbase = 0;

            await axios.post(`${surl}/api/finishjob`, request);
        } else {
            log("Blender success");

            let files = fs.readdirSync(TEMP_DIR).filter(o => o.startsWith("out"));
            log(files.join(" "));
            if(files.length < 1) {
                log("Out image doesn't exist!");
                request.success = false;
                request.errormessage = "Blender didn't produce an image";

                await axios.post(`${surl}/api/finishjob`, request);
            } else {
                let file = files.filter(f => f.startsWith("out"))[0]; // our image;
                let outputImage = fs.readFileSync(path.join(TEMP_DIR, file));

                request.success = true;
                request.image = outputImage.toString("base64");

                if(!fs.existsSync(path.join(TEMP_DIR, "renderdata"))) {
                    log("Renderdata doesn't exist!");
                    request.success = false;
                    request.errormessage = "Renderdata didn't exist for this image";

                    await axios.post(`${surl}/api/finishjob`, request);
                } else {
                    let outputImagedata = fs.readFileSync(path.join(TEMP_DIR, "renderdata")).toString();
                    let [fps, fps_base] = outputImagedata.split("\n").map(s => parseInt(s));

                    request.fps = fps;
                    request.fpsbase = fps_base;

                    log("Sending result image...");
                    await axios.post(`${surl}/api/finishjob`, request);
                }
            }
        }

        log("Done!!!");
    }

    } catch(err:any) {
        await axios.post(`${surl}/api/panic`, {id:id, error:err.toString()});
        throw err;
    }
})();