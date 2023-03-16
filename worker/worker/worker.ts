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

if(!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if(!fs.existsSync(BLENDER_DIR)) fs.mkdirSync(BLENDER_DIR);

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

    // the eternal silicon torture begins
    while(true) {
        // first step: ask for job
        let iHaveJob = false;
        let job:types.GetjobResponse = null as unknown as types.GetjobResponse;
        while(!iHaveJob) {
            try {
                let res = await axios.post(`${surl}/api/getjob`, {id: id})
                job = res.data;
            } catch(err) {
                console.log(err);
                exit(1);
            }

            if(!job.success) {
                console.log("Getjob fail");
                exit(2);
            }

            if(job.available) {
                // ok do stuff now
                console.log("doing thing");
            } else {
                console.log(`No jobs available. Waiting ${Math.floor(job.waittime!/1000)}s before retrying`);
                await delay(job.waittime!);
                continue;
            }
        }
    }
})();