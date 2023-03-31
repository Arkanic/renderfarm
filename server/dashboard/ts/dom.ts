import home from "./home";
import upload from "./upload";
import workers from "./workers";
import settings from "./settings";

/**
 * Start up the navbar handler so that clicking the buttons changes what "page" you are on
 */
export async function startNavListener() {
    await home();
    await workers();
    await upload();
    await settings();

    let boxes = ["home", "workers", "upload", "settings"];
    for(let box of boxes) {
        let button = document.getElementById(`nav-${box}`)!;
        button.addEventListener("click", async e => {
            if(button.classList.contains("active")) return; // if we are already on this page, ignore

            // hide all the other boxes
            for(let otherBox of boxes.filter(b => b != box)) {
                document.getElementById(`box-${otherBox}`)?.classList.add("hidden");
            
                let otherNav = document.getElementById(`nav-${otherBox}`)!;
                if(otherNav.classList.contains("active")) otherNav.classList.remove("active"); // it's not longer the current page
            }

            document.getElementById(`box-${box}`)?.classList.remove("hidden"); // show our one
            document.getElementById(`nav-${box}`)?.classList.add("active");
        });
    }
}