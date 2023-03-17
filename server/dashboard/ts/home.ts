import axios from "axios";
import {apiurl, networkOptions} from "./networking";

let projectsList = document.getElementById("projects-list")!;

export default async function home() {
    let projects = (await axios.post(`${apiurl()}/api/projectsindex`, {unfinishedonly: false}, networkOptions())).data;
    projectsList.innerHTML = JSON.stringify(projects);
}