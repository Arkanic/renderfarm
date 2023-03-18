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

    // ok now lets display all projects
    for(let i = 0; i < projects.projects.length; i++) {
        let project = projects.projects[i];

        let section = document.createElement("div");
        section.classList.add("section");
        if(project.finished) section.classList.add("finished"); // if it is finished dull it out

        let title = document.createElement("h4");
        title.innerHTML = project.title;
        section.appendChild(title);

        let dateCreated = new Date(project.created);
        let info = document.createElement("p");
        info.classList.add("info");
        info.innerHTML = `Created: ${dateCreated.toLocaleDateString()} ${dateCreated.toLocaleTimeString()} %${((project.finishedchunks / project.totalchunks) * 100).toFixed(2)} done`;
        section.appendChild(info);

        projectsList.appendChild(section);
    }
}