import axios from "axios";
import {apiurl, networkOptions, apiPost} from "./networking";
import {autoUpdate} from "./util/autoupdate";
import * as types from "./types/api";
import {timeAgo} from "./util/timeago";

const UPDATE_RATE = 15; // fifteen seconds

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
    let projects:types.ProjectsIndexResponse = await apiPost("/api/projectsindex", {unfinishedonly: false});
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
        box.classList.add("list-item", "col-6", "border", "py-2", "bg-body-tertiary");

        let section = document.createElement("div");
        section.classList.add("d-flex", "align-items-left", "justify-content-between", "flex-column");

        let title = document.createElement("h4");
        title.innerHTML = project.finished ? `${project.title} (finished) ` : project.title;
        section.appendChild(title);

        let thumbnail = document.createElement("img");
        thumbnail.classList.add("rounded", "float-right", "img-thumbnail");
        thumbnail.width = 128;
        thumbnail.alt = `thumbnail of ${project.title}`;
        thumbnail.src = `${apiurl()}/dat/thumbnails/${project.id}`;

        section.appendChild(thumbnail);

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

        let size = document.createElement("p");
        size.innerHTML = `Size: ${(project.size / 1000000).toFixed(2)}mb`;
        section.appendChild(size);

        let progressText = document.createElement("p");

        let ptCurrent = document.createElement("span");
        ptCurrent.innerHTML = `${project.currentlyrenderingchunks}/`;
        ptCurrent.setAttribute("data-toggle", "tooltip");
        ptCurrent.title = "Currently rendering chunks";
        progressText.appendChild(ptCurrent);

        let ptDone = document.createElement("span");
        ptDone.innerHTML = `${project.finishedchunks}/`;
        ptDone.setAttribute("data-toggle", "tooltip");
        ptDone.title = "Finished chunks";
        progressText.appendChild(ptDone);

        let ptTotal = document.createElement("span");
        ptTotal.innerHTML = `${project.totalchunks}`;
        ptTotal.setAttribute("data-toggle", "tooltip");
        ptTotal.title = "Total chunks in project";
        progressText.appendChild(ptTotal);

        section.appendChild(progressText);

        let dateCreated = new Date(project.created);
        let info = document.createElement("p");
        info.classList.add("info");
        info.innerHTML = `Created ${timeAgo(dateCreated)} ago, ${((project.finishedchunks / project.totalchunks) * 100).toFixed(2)}% done`;
        section.appendChild(info);

        if(project.rendered) {
            let linkbox = document.createElement("div");
            linkbox.classList.add("d-flex", "justify-content-left", "w-50", "px-2");

            let resultlink = document.createElement("a");
            resultlink.classList.add("btn", "btn-success", "w-33");
            resultlink.href = `${apiurl()}/dat/renders/${project.id}/result`;
            resultlink.innerHTML = `Finished result`;
            resultlink.target = "_blank";
            linkbox.appendChild(resultlink);

            let br = document.createElement("br");
            linkbox.appendChild(br);

            let rawlink = document.createElement("a");
            rawlink.classList.add("btn", "btn-success", "w-33");
            rawlink.href = `${apiurl()}/dat/renders/${project.id}/raw`;
            rawlink.innerHTML = `Raw frames`;
            rawlink.target = "_blank";
            linkbox.appendChild(rawlink);

            section.appendChild(linkbox);

            section.appendChild(document.createElement("p"));
        }

        let deleteButtonBox = document.createElement("div");
        deleteButtonBox.classList.add("px-2");

        let deleteButton = document.createElement("button");
        deleteButton.classList.add("btn", "btn-outline-danger", "btn-block", "w-25");
        deleteButton.innerHTML = "Delete";
        deleteButton.addEventListener("click", async () => {
            let confirmation = prompt("type 'yes' to confirm deletion")?.toLowerCase();
            if(confirmation === null || confirmation !== "yes") return;

            await apiPost("/api/deleteproject", {projectid: project.id});

            await homeTask();
        });

        deleteButtonBox.appendChild(deleteButton);
        section.appendChild(deleteButtonBox);

        box.appendChild(section);
        projectsList.appendChild(box);
    }
}
