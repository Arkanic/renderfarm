/**
 * Logger class meant to provide logging functions for both terminal and user-visible output
 */
export default class Logger {
    constructor() {};

    /**
     * Generic log function meant to replace console.log
     * 
     * @param msg list of strings to send
     */
    log(...msg:any[]) {
        console.log(...msg);
    }
}