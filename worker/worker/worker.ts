import fs, {PathLike} from "fs";
import path from "path";
import {spawn} from "child_process";
import {exit} from "process";
import crypto, {BinaryToTextEncoding} from "crypto";

import * as types from "./types/api";

import axios from "axios";
import orc from "orc-me";

const SERVER_TXT = "./server.txt";
const NAME_TXT = "./name.txt";
const BLENDER_TAR_XZ = "./blender.tar.xz";
const BLENDER_DIR = "./blender";
const BLENDER_LOCATION_TXT = "./blender-location.txt";
const DATA_DIR = "./data";
const TEMP_DIR = "./temp";
const PRUNE_PROJECTS_INTERVAL = 1000 * 60 * 30; // every 30 minutes check

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
    console.log(`Un-tar.xzing ${file}`)
    return new Promise((resolve, reject) => {
        const tar = spawn("tar", ["-xvf", file, "-C", BLENDER_DIR]);

        tar.stdout.on("data", data => {
            // response data, into a string, removing the last character (newline)
            console.log(data.toString().slice(0, -1));
        });

        tar.stderr.on("data", data => {
            console.log(data.toString().slice(0, -1));
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
            console.log(data.toString().slice(0, -1));
        });

        zip.stderr.on("data", data => {
            console.log(data.toString().slice(0, -1));
        });

        zip.on("close", (code) => {
            if(code != 0) return reject();
            resolve();
        });
    });
}

// If any of these required folders do not exist, make them (they will be populated later)
if(!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if(!fs.existsSync(BLENDER_DIR)) fs.mkdirSync(BLENDER_DIR);
if(!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

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
    name = `${orc()} ${orc()} ${orc()}`; // shrig glur nogg
    fs.writeFileSync(NAME_TXT, name);
} else {
    console.log("Finding my name");
    name = fs.readFileSync(NAME_TXT).toString().split("\n")[0];
}
console.log(`I am ${name}`);

// main code body, async wrapper so we can use neat await
(async () => {
    let joinResponse:types.JoinResponse = null as unknown as types.JoinResponse;
    try {
        joinResponse = (await axios.post(`${surl}/api/join`, {
            name
        })).data;
    } catch(err:any) {
        console.log("Can't connect to server. sleeping for one minute then quit.");
        await delay(1000 * 60); // 1 minute
        exit(1);
    }

    const {id} = joinResponse;
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
    }

    const blenderLocation = fs.readFileSync(BLENDER_LOCATION_TXT).toString().split("\n")[0];
    console.log(`Blender is at ${blenderLocation}`);

    /**
     * Prune old project files
     */
    setInterval(async () => {
        console.log("Pruning old projects...");
        let res = await axios.post(`${surl}/api/projectsindex`, {unfinishedonly: false});
        let data:types.ProjectsIndexResponse = res.data;
        if(!data.success) {
            console.log("Projectsindex fail");
            console.log(data.message);
            exit(2);
        }

        let {projects} = data;
        let finishedProjects = projects.filter(p => p.finished); // remove unfinished projects
        for(let i in finishedProjects) {
            let finishedProject = finishedProjects[i];

            let theoreticalPath = path.join(DATA_DIR, `${finishedProject.id}.zip`);
            if(fs.existsSync(theoreticalPath)) {
                console.log(`Deleting finished project files of ${finishedProject.title}`);
                fs.unlinkSync(theoreticalPath);

                // delete unzipped version
                fs.rmSync(path.join(TEMP_DIR, `${finishedProject.id}`), {recursive: true, force: true});
            }
        }

    }, PRUNE_PROJECTS_INTERVAL);

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

        await (new Promise((resolve, reject) => {
            let blender = spawn(`./${blenderLocation}`, [ // launch blender
                "-noaudio", // don't do audio, causes some strange crashes
                "-b", path.join(TEMP_DIR, `${job.dataid}`, job.blendfile), // the blender file is here
                "-P", "worker/renderer.py", // the script is here
                "--", // options for the script
                TEMP_DIR, // where to save out.whatever
                job.frame.toString(), // frame
                job.cutinto.toString(), // what to split into?
                job.row.toString(), // what row to render
                job.column.toString() // what column to render
            ]);

            blender.stdout.on("data", data => {
                console.log(data.toString().slice(0, -1));
            });

            blender.stderr.on("data", data => {
                console.log(data.toString().slice(0, -1));
            });

            blender.on("close", code => {
                if(code != 0) return reject();
                resolve(code);
            });
        }));
    }
})();