import "./scss/global.scss"
import * as bootstrap from "bootstrap";

import home from "./ts/home";
import upload from "./ts/upload";
import workers from "./ts/workers";
import settings from "./ts/settings";

import {startNavListener} from "./ts/dom";

import {createModal} from "./ts/util/popup";

console.log("dashboard");
window.addEventListener("load", async () => {
    document.getElementById("cover")!.classList.add("hidden"); // was covered to prevent css-less html from showing

    await home();
    await upload();
    await workers();
    await settings();

    console.log("loaded");
    startNavListener();
});