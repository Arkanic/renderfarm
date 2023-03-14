class RenderNode {
    id:string;
    name:string;
    working:boolean;
    currentlyDoing:string;

    constructor(id:string, name:string) {
        this.id = id;
        this.name = name;
        this.working = false;
        this.currentlyDoing = "nothing";
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
}

export default RenderNode;