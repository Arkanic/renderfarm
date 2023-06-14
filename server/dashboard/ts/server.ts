import axios from "axios";
import {apiPost, apiurl, networkOptions} from "./networking";
import {autoUpdate} from "./util/autoupdate";
import * as types from "./types/api";

const UPDATE_RATE = 5; // 5 seconds

let serverLogs = document.getElementById("server-logs")!;
let serverUpdateText = document.getElementById("server-update-text")!;
let serverUpdateButton = document.getElementById("server-update-button")! as HTMLInputElement;

export default async function server() {
    await serverTask();

    autoUpdate(serverUpdateText, serverUpdateButton, UPDATE_RATE, async () => {
        await serverTask();
    });
}

async function serverTask() {
    let logs:types.ServerLogResponse = await apiPost("/api/serverlog", {});
    
    serverLogs.innerHTML = "";

    for(let i in logs.logs) {
        let log = logs.logs[i];
        let part = document.createElement("p");
        part.innerHTML = log;
        serverLogs.appendChild(part);
    }
}