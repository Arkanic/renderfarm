import fs from "fs";
import path from "path";
import os from "os";
import {exit} from "process";
import crypto from "crypto";

import * as types from "./types/api";

import axios, { AxiosError } from "axios";
import orc from "orc-me";

const SERVER_TXT = "./server.txt";
const NAME_TXT = "./name.txt";

console.log("Renderfarm worker");

const delay = (ms:number) => new Promise(resolve => setTimeout(resolve, ms))

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

    console.log(joinResponse);
})();

// now we will join server

