import {startNavListener} from "./ts/dom";

import home from "./ts/home";

console.log("dashboard");
window.addEventListener("load", async () => {
    console.log("loaded");
    startNavListener();

    await home();
});