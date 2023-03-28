import axios from "axios";
import {apiurl, networkOptions} from "./networking";
import * as types from "./types/api";

let projectsList = document.getElementById("projects-list")!;

export default async function home() {
    projectsList.innerHTML = "";

    let projects:types.ProjectsIndexResponse = (await axios.post(`${apiurl()}/api/projectsindex`, {unfinishedonly: false}, networkOptions())).data;
    // it didn't work, show message
    if(!projects.success) {
        let p = document.createElement("p");
        p.classList.add("error");
        p.innerHTML = projects.message!;

        return;
    }

    let totalSize = 0;
    for(let i = 0; i < projects.projects.length; i++) totalSize += projects.projects[i].size;

    let p = document.createElement("p");
    p.innerHTML = `There are a total of ${projects.projects.length} projects, taking up ${(totalSize / 1000000000).toFixed(3)}gb of storage.`;
    projectsList.appendChild(p);

    // ok now lets display all projects
    projects.projects = projects.projects.reverse(); // newest first
    for(let i = 0; i < projects.projects.length; i++) {
        let project = projects.projects[i];

        let section = document.createElement("div");
        section.classList.add("section");
        if(project.finished) section.classList.add("finished"); // if it is finished dull it out

        let title = document.createElement("h4");
        title.innerHTML = project.title;
        section.appendChild(title);

        if(project.finished) {
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

        let deleteButton = document.createElement("button");
        deleteButton.innerHTML = "Delete";
        deleteButton.addEventListener("click", async () => {
            let confirmation = prompt("type 'yes' to confirm deletion")?.toLowerCase();
            if(confirmation === null || confirmation !== "yes") return;

            await axios.post(`${apiurl()}/api/deleteproject`, {projectid: project.id}, networkOptions());

            home();
        });
        section.appendChild(deleteButton);

        let dateCreated = new Date(project.created);
        let info = document.createElement("p");
        info.classList.add("info");
        info.innerHTML = `Created: ${dateCreated.toLocaleDateString()} ${dateCreated.toLocaleTimeString()} %${((project.finishedchunks / project.totalchunks) * 100).toFixed(2)} done`;
        section.appendChild(info);

        projectsList.appendChild(section);
    }
}
