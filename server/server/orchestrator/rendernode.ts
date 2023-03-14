import constants from "../constants";

class RenderNode {
    id:string;
    name:string;
    working:boolean;
    currentlyDoing:string;
    lastHeartbeat:number;

    constructor(id:string, name:string) {
        this.id = id;
        this.name = name;
        this.working = false;
        this.currentlyDoing = "nothing";
        this.lastHeartbeat = Date.now();
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
}

export default RenderNode;