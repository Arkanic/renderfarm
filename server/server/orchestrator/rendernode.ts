import constants from "../constants";

class RenderNode {
    id:string;
    name:string;
    working:boolean;
    currentlyDoing:string;
    lastHeartbeat:number;
    logs:string;

    constructor(id:string, name:string) {
        this.id = id;
        this.name = name;
        this.working = false;
        this.currentlyDoing = "nothing";
        this.lastHeartbeat = Date.now();
        this.logs = "";
    }

    startJob(job:string) {
        this.working = true;
        this.currentlyDoing = job;
    }

    finishJob() {
        this.working = false;
        this.currentlyDoing = "nothing";
    }

    /**
     * Does this chunk match what I am meant to be doing?
     */
    amICurrentlyDoing(chunk:string):boolean {
        if(!this.working) return false;
        return chunk == this.currentlyDoing;
    }

    /**
     * Has the client expired?
     */
    isDead():boolean {
        return Date.now() > (this.lastHeartbeat + constants.HEARTBEAT_INTERVAL);
    }

    /**
     * Client is alive
     */
    ping() {
        this.lastHeartbeat = Date.now();
    }

    /**
     * Add new logs to this rendernode. Automatically prunes old messages once WORKER_LOG_NEWLINE_LENGTH is reached.
     */
    appendLog(log:string) {
        this.logs += log;
        this.logs = this.logs.split("\n") // keep log length at WORKER_LOG_NEWLINE_LENGTH newlines tops
            .slice(Math.max(this.logs.split("\n").length - constants.WORKER_LOG_NEWLINE_LENGTH, 0))
            .join("\n");
    }

    getLog():string {
        return this.logs;
    }
}

export default RenderNode;