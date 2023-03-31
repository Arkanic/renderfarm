/**
 * Automatically update (via an external function) a thing every x seconds
 * Uses provided element to display how long, and a button to update now
 * 
 * @param text Text element to display "Updating in 3s" etc
 * @param updateButton Button to update now
 * @param cooldownTime Time between update (in seconds)
 * @param doTask Task to do, async allowed
 */
export function autoUpdate(text:HTMLElement, updateButton:HTMLInputElement, cooldownTime:number, doTask:() => Promise<void>) {
    let countdown = cooldownTime;
    setInterval(async () => {
        text.innerHTML = `Updating in ${Math.max(countdown, 0)}s`;

        countdown -= 1;
        if(countdown !== -1) return;

        text.innerHTML = "Updating...";
        await doTask();
        countdown = cooldownTime;
    }, 1000);

    updateButton.addEventListener("click", async () => {
        text.innerHTML = "Updating...";
        await doTask();
        countdown = cooldownTime;
    });
}