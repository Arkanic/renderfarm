import "./scss/global.scss"
import * as bootstrap from "bootstrap";

import home from "./ts/home";
import upload from "./ts/upload";
import workers from "./ts/workers";
import settings from "./ts/settings";

import {startNavListener} from "./ts/dom";

console.log("dashboard");
window.addEventListener("load", async () => {
    await home();
    await upload();
    await workers();
    await settings();

    console.log("loaded");
    startNavListener();
});