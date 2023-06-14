import intercept from "intercept-stdout";

import constants from "./constants";

/**
 * Logger class meant to provide logging functions for both terminal and user-visible output
 * Automatically captures all console.log output
 */
export default class Logger {
    unhook;
    private strings:Array<string>;

    constructor() {
        this.strings = [];
        this.unhook = intercept((txt:string) => {
            let arr = (txt.endsWith("\n") ? txt.slice(0, -1) : txt).split("\n");
            for(let i in arr) this.strings.push(arr[i]);
            while(this.strings.length > constants.LOG_BUFFER_LINES) this.strings.shift();
        });
    };

    /**
     * Stop capturing input
     * This is a once-only command, class has to be disposed of afterward
     */
    quit():void {
        this.unhook();
    };

    /**
     * Get array of log lines, up to LOG_BUFFER_LINES
     * 
     * @returns log array - one item is one line of log, going from oldest to most recent
     */
    getLog():Array<string> {
        return this.strings;
    }
}