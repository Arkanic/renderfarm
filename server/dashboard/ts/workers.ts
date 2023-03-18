import axios from "axios";
import {apiurl, networkOptions} from "./networking";
import * as types from "./types/api";

let workersList = document.getElementById("workers-list")!;

export default async function workers() {
    workersList.innerHTML = "";

    let workers:types.OnlineWorkersResponse = (await axios.post(`${apiurl()}/api/onlineworkers`, {}, networkOptions())).data;
    if(!workers.success) {
        let p = document.createElement("p");
        p.classList.add("error");
        p.innerHTML = workers.message!;

        return;
    }

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

        workersList.appendChild(section);
    }
}