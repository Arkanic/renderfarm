import axios from "axios";
import {autoUpdate} from "./util/autoupdate";
import {apiurl, networkOptions} from "./networking";
import * as types from "./types/api";

const UPDATE_RATE = 10;

let workersList = document.getElementById("workers-list")!;
let workersUpdateText = document.getElementById("workers-update-text")! as HTMLElement;
let workersUpdateButton = document.getElementById("workers-update-button")! as HTMLInputElement;

export default async function workers() {
    await workersTask();

    autoUpdate(workersUpdateText, workersUpdateButton, UPDATE_RATE, async () => {
        await workersTask();
    });
}

async function workersTask() {

    let workers:types.OnlineWorkersResponse = (await axios.post(`${apiurl()}/api/onlineworkers`, {}, networkOptions())).data;
    if(!workers.success) {
        let p = document.createElement("p");
        p.classList.add("error");
        p.innerHTML = workers.message!;

        return;
    }


    workersList.innerHTML = "";

    for(let i = 0; i < workers.workers.length; i++) {
        let worker = workers.workers[i];

        let section = document.createElement("div");
        section.classList.add("section");

        let name = document.createElement("h4");
        name.innerHTML = worker.name;
        section.appendChild(name);

        let info = document.createElement("p");
        info.classList.add("info");
        info.innerHTML = `Currently working on "${worker.currentlyrendering}"`;
        section.appendChild(info);

        let logBox = document.createElement("div");
        logBox.classList.add("terminal");

        let parts = worker.logs.split("\n");
        for(let part of parts) {
            let log = document.createElement("p");
            log.innerHTML = part;
            logBox.appendChild(log);
        }
        section.appendChild(logBox);

        workersList.appendChild(section);
    }
}