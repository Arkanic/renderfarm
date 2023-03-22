import axios from "axios";
import {apiurl, networkOptions} from "./networking";
import {base64ArrayBuffer} from "./b64";

import * as types from "./types/api";

let mainBox = document.getElementById("settings-main-box")!;
let blenderuploadStart = document.getElementById("settings-blenderupload-start")!;

let blenderuploadBox = document.getElementById("settings-blenderupload-box")!;
let blenderfile = document.getElementById("settings-blenderfile")! as HTMLInputElement;
let blenderuploadSubmit = document.getElementById("settings-blenderupload-submit")! as HTMLInputElement;

let uploadingBox = document.getElementById("settings-uploading-box")!;

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

        const fileReader = new FileReader();
        fileReader.readAsArrayBuffer(blenderfile.files![0]);

        let blenderTarXz:ArrayBuffer = await new Promise(resolve => {fileReader.onload = e => {
            resolve(fileReader.result as unknown as ArrayBuffer);
        }});

        console.log("Converting blender...");
        let request:types.UploadBlenderRequest = {
            data: base64ArrayBuffer(blenderTarXz)
        }

        console.log("Uploading blender...");
        let res:types.UploadBlenderResponse = (await axios.post(`${apiurl()}/api/uploadblender`, request, networkOptions())).data;

        if(!res.success) {
            alert(res.message);
            window.location.reload();
        }

        alert("Success!!");
        window.location.reload();
    });
}