import axios from "axios";
import {autoUpdate} from "./util/autoupdate";
import {createModal, ModalSize} from "./util/popup";
import {apiPost, apiurl, networkOptions} from "./networking";
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

    let workers:types.OnlineWorkersResponse = await apiPost("/api/onlineworkers", {});
    if(!workers.success) {
        let p = document.createElement("p");
        p.classList.add("error");
        p.innerHTML = workers.message!;

        return;
    }

    workersList.innerHTML = "";

    for(let i = 0; i < workers.workers.length; i++) {
        let worker = workers.workers[i];

        let box = document.createElement("div");
        box.classList.add("list-item", "col-4", "border", "py-2");

        let section = document.createElement("div");
        section.classList.add("d-flex", "align-items-left", "justify-content-between", "flex-column");

        let name = document.createElement("h5");
        name.innerHTML = worker.name;
        section.appendChild(name);

        let info = document.createElement("p");
        info.innerHTML = `Currently working on "${worker.currentlyrendering}"`;
        section.appendChild(info);

        let logButton = document.createElement("button");
        logButton.classList.add("btn", "btn-primary");
        logButton.innerHTML = "View Logs";
        logButton.addEventListener("click", () => {
            let logBox = document.createElement("div");
            logBox.classList.add("terminal");

            let parts = worker.logs.split("\n");
            for(let part of parts) {
                let log = document.createElement("p");
                log.innerHTML = part;
                logBox.appendChild(log);
            }

            createModal(logBox, "Worker Logs", ModalSize.Large);
        });
        section.appendChild(logButton);

        box.appendChild(section);
        workersList.appendChild(box);
    }
}