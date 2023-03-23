import axios, { AxiosRequestConfig } from "axios";
import {apiurl, networkOptions} from "./networking";
import {base64ArrayBuffer} from "./b64";

import * as types from "./types/api";

let mainBox = document.getElementById("settings-main-box")!;
let blenderuploadStart = document.getElementById("settings-blenderupload-start")!;
let cleardbStart = document.getElementById("settings-cleardb-start")!;

let blenderuploadBox = document.getElementById("settings-blenderupload-box")!;
let blenderuploadForm = document.getElementById("settings-blenderupload-form")! as HTMLFormElement;
let blenderfile = document.getElementById("settings-blenderfile")! as HTMLInputElement;
let blenderuploadSubmit = document.getElementById("settings-blenderupload-submit")! as HTMLInputElement;

let uploadingBox = document.getElementById("settings-uploading-box")!;
let uploadingProgress = document.getElementById("settings-uploading-progress")! as HTMLProgressElement;
let uploadingProgressMessage = document.getElementById("settings-uploading-progress-message")!;


let done = false;

export default async function settings() {
    if(done) return;
    done = true;

    cleardbStart.addEventListener("click", async () => {
        alert("This will completely wipe all projects, renders, and crash the server temporarily. Are you sure?");
        let confirmation = prompt("Type 'yes' to confirm deletion");
        if(confirmation === null || confirmation !== "yes") return;
        confirmation = prompt("Are you really really sure? Type 'DIE DIE DIE' to continue");
        if(confirmation === null || confirmation !== "DIE DIE DIE") return;

        await axios.post(`${apiurl()}/api/cleardb`, {}, networkOptions());
    });

    // now the user wants to upload a blender file
    blenderuploadStart.addEventListener("click", () => {
        mainBox.classList.add("hidden");
        blenderuploadBox.classList.remove("hidden");
    });

    blenderuploadSubmit.addEventListener("click", async () => {
        blenderuploadBox.classList.add("hidden");
        uploadingBox.classList.remove("hidden");

        if(blenderfile.files!.length < 1) {
            alert("Please select a blender tarball!!!");
            window.location.reload();
        }

        let formData = new FormData(blenderuploadForm);

        let options:AxiosRequestConfig = networkOptions();
        options.headers = {
            "Content-Type": "multipart/form-data"
        }

        options.onUploadProgress = e => {
            let currentPercentage = Math.round((e.loaded * 100) / e.total!);
            uploadingProgress.value = currentPercentage;
            uploadingProgressMessage.innerHTML = `Uploading... ${currentPercentage}%`;
        }

        let res:types.UploadProjectResponse = (await axios.post(`${apiurl()}/form/uploadblender`,
                                                                formData,
                                                                options)).data;
        if(!res.success) {
            alert(res.message);
            window.location.reload();
        }

        alert("Success!!");
        window.location.reload();
    });
}