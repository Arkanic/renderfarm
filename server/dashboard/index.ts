import "./scss/global.scss"
import * as bootstrap from "bootstrap";

import {startNavListener} from "./ts/dom";

import home from "./ts/home";

console.log("dashboard");
window.addEventListener("load", async () => {
    console.log("loaded");
    startNavListener();
});