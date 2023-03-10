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
}

export default RenderNode;