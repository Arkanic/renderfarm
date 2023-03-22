import axios, {AxiosRequestConfig} from "axios";
import JSZip from "jszip";
import {apiurl, networkOptions} from "./networking";
import {base64ArrayBuffer} from "./b64";
import * as types from "./types/api";

let uploadBox = document.getElementById("upload-upload-box")!;
let file = document.getElementById("upload-file")! as HTMLInputElement;
let uploadSubmit = document.getElementById("upload-upload-submit")!;

let loadingBox = document.getElementById("upload-loading-box")!;

let configBox = document.getElementById("upload-config-box")!;
let blendfile = document.getElementById("upload-blendfile")! as HTMLInputElement;
let title = document.getElementById("upload-title")! as HTMLInputElement;
let animation = document.getElementById("upload-animation")! as HTMLInputElement;
let framestart = document.getElementById("upload-framestart")! as HTMLInputElement;
let framestartLabel = document.getElementById("upload-framestart-label")!;
let frameend = document.getElementById("upload-frameend")! as HTMLInputElement;
let frameendLabel = document.getElementById("upload-frameend-label")!;
let cutinto = document.getElementById("upload-cutinto")! as HTMLInputElement;
let configSubmit = document.getElementById("upload-config-submit");

let uploadingBox = document.getElementById("upload-uploading-box")!;
let progress = document.getElementById("upload-progress")! as HTMLProgressElement;
let progressMessage = document.getElementById("upload-progress-message")!;

let uploadform = document.getElementById("uploadform")! as HTMLFormElement;

let done = false;

export default async function upload() {
    if(done) return;
    done = true;

    let zip:JSZip = null as unknown as JSZip;
    let zipFile:ArrayBuffer = null as unknown as ArrayBuffer;
    uploadSubmit.addEventListener("click", async e => {
        uploadBox.classList.add("hidden"); // hide old box
        loadingBox.classList.remove("hidden"); // show loading screen

        if(file.files!.length < 1) { // no zip file in the file selector
            alert("Please select a zip file!");
            window.location.reload();
        }

        const fileReader = new FileReader();
        fileReader.readAsArrayBuffer(file.files![0]);

        zipFile = await new Promise(resolve => {fileReader.onload = e => {
            resolve(fileReader.result as unknown as ArrayBuffer);
        }}); // ok handle read

        zip = await JSZip.loadAsync(zipFile);
        let len = 0;
        zip.forEach((relativePath, file) => {
            if(!relativePath.endsWith(".blend")) return; // not a blender file

            let option = document.createElement("option");
            option.value = relativePath;
            option.innerHTML = relativePath;

            blendfile.appendChild(option); // add this blender file to the dropdown

            len++; // one more blend file
        });
        if(len == 0) {
            alert("That zip file doesn't contain a blender file.");
            window.location.reload();
        }

        loadingBox.classList.add("hidden");
        configBox.classList.remove("hidden");
    });

    animation.addEventListener("change", e => {
        if(animation.checked) {
            framestartLabel.innerHTML = "Animation start frame: ";
            frameend.classList.remove("hidden");
            frameendLabel.classList.remove("hidden");
        } else {
            framestartLabel.innerHTML = "Frame to render: ";
            frameend.classList.add("hidden");
            frameendLabel.classList.add("hidden");
        }
    });

    configSubmit?.addEventListener("click", async e => {
        let formData = new FormData(uploadform);
        console.log(formData);

        configBox.classList.add("hidden");
        uploadingBox.classList.remove("hidden");

        let options:AxiosRequestConfig = networkOptions();
        options.headers = {
            "Content-Type": "multipart/form-data"
        }

        options.onUploadProgress = e => {
            let currentPercentage = Math.round((e.loaded * 100) / e.total!);
            progress.value = currentPercentage;
            progressMessage.innerHTML = `Uploading... ${currentPercentage}%`;
        }
        

        let res:types.UploadProjectResponse = (await axios.post(`${apiurl()}/form/uploadproject`,
                                                                formData,
                                                                options)).data;

        if(!res.success) {
            alert(res.message!);
            window.location.reload();
        }

        alert(`Success!`);
        window.location.reload();
    });
}