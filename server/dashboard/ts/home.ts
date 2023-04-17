import axios from "axios";
import TimeAgo from "javascript-time-ago";
import en from "javascript-time-ago/locale/en";
import {apiurl, networkOptions} from "./networking";
import {autoUpdate} from "./util/autoupdate";
import * as types from "./types/api";

TimeAgo.addDefaultLocale(en);
const timeAgo = new TimeAgo("en-GB");

const UPDATE_RATE = 30; // ten seconds

let projectsList = document.getElementById("projects-list")!;
let projectsSize = document.getElementById("projects-size")!;
let projectsUpdateText = document.getElementById("projects-update-text")! as HTMLHeadingElement;
let projectsUpdateButton = document.getElementById("projects-update-button")! as HTMLInputElement;

export default async function home() {
    await homeTask();

    autoUpdate(projectsUpdateText, projectsUpdateButton, UPDATE_RATE, async () => {
        await homeTask();
    });
}

async function homeTask() {
    let projects:types.ProjectsIndexResponse = (await axios.post(`${apiurl()}/api/projectsindex`, {unfinishedonly: false}, networkOptions())).data;
    // it didn't work, show message
    if(!projects.success) {
        projectsSize.innerText = projects.message!;

        return;
    }

    projectsList.innerHTML = ""; // remove old content

    let totalSize = 0;
    for(let i = 0; i < projects.projects.length; i++) totalSize += projects.projects[i].size;

    projectsSize.innerText = `There are a total of ${projects.projects.length} projects, taking up ${(totalSize / 1000000000).toFixed(3)}gb of storage. The disk has ${(projects.disk.free / 1000000000).toFixed(3)}gb free.`;


    // ok now lets display all projects
    projects.projects = projects.projects.reverse(); // newest first
    for(let i = 0; i < projects.projects.length; i++) {
        let project = projects.projects[i];

        let box = document.createElement("div");
        box.classList.add("w-100", "list-group-item", "py-5", "lh-sm", "border");

        let section = document.createElement("div");
        section.classList.add("d-flex", "w-100", "align-items-left", "justify-content-between", "flex-column");
        if(project.finished) {
            let p = document.createElement("p");
            p.innerHTML = "FINISHED";
            section.appendChild(p);
        }

        let title = document.createElement("h4");
        title.innerHTML = project.title;
        section.appendChild(title);

        if(project.finished && project.message) {
            let messagesBox = document.createElement("div");
            messagesBox.classList.add("terminal");

            let parts = project.message.split("\n");
            for(let part of parts) {
                let message = document.createElement("p");
                message.innerHTML = part;
                messagesBox.appendChild(message);
            }

            section.appendChild(messagesBox);
        }

        if(project.rendered) {
            let resultlink = document.createElement("a");
            resultlink.href = `${apiurl()}/dat/renders/${project.id}/result`;
            resultlink.innerHTML = `Finished result`;
            resultlink.target = "_blank";
            section.appendChild(resultlink);

            let br = document.createElement("br");
            section.appendChild(br);

            let rawlink = document.createElement("a");
            rawlink.href = `${apiurl()}/dat/renders/${project.id}/raw`;
            rawlink.innerHTML = `Raw frames`;
            rawlink.target = "_blank";
            section.appendChild(rawlink);
        }

        let size = document.createElement("p");
        size.innerHTML = `Size: ${(project.size / 1000000).toFixed(2)}mb`;
        section.appendChild(size);

        let dateCreated = new Date(project.created);
        let info = document.createElement("p");
        info.classList.add("info");
        info.innerHTML = `Created ${timeAgo.format(dateCreated)}`;
        section.appendChild(info);

        let progress = document.createElement("div");
        progress.classList.add("progress");
        let bar = document.createElement("progress");
        bar.role = "progressbar";
        bar.classList.add("progress-bar");
        bar.ariaValueMin = "0";
        bar.ariaValueMax = "100";
        bar.ariaValueNow = Math.round(((project.finishedchunks / project.totalchunks) * 100)).toString();
        bar.style.width = Math.round((project.finishedchunks / project.totalchunks) * 100).toString();
        bar.innerText = ((project.finishedchunks / project.totalchunks) * 100).toFixed(2) + "%";
        progress.appendChild(bar);
        section.appendChild(progress);

        section.appendChild(document.createElement("p"));

        let deleteButton = document.createElement("button");
        deleteButton.classList.add("btn", "btn-outline-danger", "btn-block", "w-25");
        deleteButton.innerHTML = "Delete";
        deleteButton.addEventListener("click", async () => {
            let confirmation = prompt("type 'yes' to confirm deletion")?.toLowerCase();
            if(confirmation === null || confirmation !== "yes") return;

            await axios.post(`${apiurl()}/api/deleteproject`, {projectid: project.id}, networkOptions());

            await homeTask();
        });
        section.appendChild(deleteButton);

        box.appendChild(section);
        projectsList.appendChild(box);
    }
}
