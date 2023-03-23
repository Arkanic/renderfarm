import axios, { AxiosRequestConfig } from "axios";
import {apiurl, networkOptions} from "./networking";
import {base64ArrayBuffer} from "./b64";

import * as types from "./types/api";

let mainBox = document.getElementById("settings-main-box")!;
let blenderuploadStart = document.getElementById("settings-blenderupload-start")!;

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