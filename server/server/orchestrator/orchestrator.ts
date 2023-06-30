import {nanoid} from "nanoid";

import {Context} from "../server";
import RenderNode from "./rendernode";
import constants from "../constants";

import * as compositor from "../compositor/compositor";

// chunk format project_frame_row_column

export interface Project {
    id:string | number,
    title:string,
    cutinto:number,
    animation:boolean,
    framestart:number,
    frameend?:number,
    blendfile:string,
    finishedChunks:Array<string>,
    overscan:number
};

export interface Job {
    projectid:string | number,
    chunkid:string,
    frame:number,
    cutinto:number,
    row:number,
    column:number,
    blendfile:string,
    overscan:number
};

class Orchestrator {
    ctx:Context;

    renderNodes:{[key:string]:RenderNode};
    currentlyRendering:Array<string>

    constructor(ctx:Context) {
        this.ctx = ctx;
        this.renderNodes = {};
        this.currentlyRendering = [];

        // check for idle workers and DESTROY them with FIRE and FLAMES
        setInterval(() => {
            for(let i in this.renderNodes) {
                if(this.renderNodes[i].isDead()) {
                    console.log(`Rendernode ${this.renderNodes[i].name} has expired, deleting...`);
                    this.removeRenderNode(i);
                }
            }
        }, constants.HEARTBEAT_INTERVAL);
    }

    /**
     * Does this render node exist?
     */
    doesNodeExist(id:string) {
        return Object.keys(this.renderNodes).includes(id);
    }

    /**
     * Get a project in a nicely formatted way
     * 
     * @param id project id
     * @returns Neat project
     */
    async getProject(id:number | string):Promise<Project> {
        let unfinishedProject = await this.ctx.dbc.getById("projects", id);
        let unfinishedProjectRenderdata = await this.ctx.dbc.getById("renderdata", unfinishedProject.id);

        let project:Project = {
            id: unfinishedProject.id as number | string,
            title: unfinishedProject.title as string,
            cutinto: unfinishedProjectRenderdata.cutinto as number,
            animation: unfinishedProjectRenderdata.animation as boolean,
            framestart: unfinishedProjectRenderdata.framestart as number,
            blendfile: unfinishedProjectRenderdata.blendfile as string,
            finishedChunks: JSON.parse(unfinishedProjectRenderdata.finished_chunks) as Array<string>,
            overscan: unfinishedProjectRenderdata.overscan as number
        }
        if(project.animation) project.frameend = unfinishedProjectRenderdata.frameend as number; // if it is an animation we know it has an end frame

        return project;
    }

    /**
     * Turn database into a nicer array of projects for use within the orchestrator.
     * doesn't use getProject because that would mean an extra db call per item
     * 
     * @returns Array of unfinished projects
     */
    async getProjects():Promise<Array<Project>> {
        let projects:Array<Project> = [];

        // format database entry in a nice way
        let unfinishedProjects = await this.ctx.dbc.db("projects").where("finished", false);
        for(let i in unfinishedProjects) {
            let unfinishedProject = unfinishedProjects[i];
            let unfinishedProjectRenderdata = await this.ctx.dbc.getById("renderdata", unfinishedProject.id);

            let project:Project = {
                id: unfinishedProject.id as number | string,
                title: unfinishedProject.title as string,
                cutinto: unfinishedProjectRenderdata.cutinto as number,
                animation: unfinishedProjectRenderdata.animation as boolean,
                framestart: unfinishedProjectRenderdata.framestart as number,
                blendfile: unfinishedProjectRenderdata.blendfile as string,
                finishedChunks: JSON.parse(unfinishedProjectRenderdata.finished_chunks) as Array<string>,
                overscan: unfinishedProjectRenderdata.overscan as number
            }
            if(project.animation) project.frameend = unfinishedProjectRenderdata.frameend as number; // if it is an animation we know it has an end frame

            projects.push(project);
        }

        return projects;
    }

    /**
     * Decide which project rendernode should render for
     * 
     * @returns Project id to render (NOT CHUNKID)
     */
    async assignProject():Promise<string | number | null> {
        // potentially look at load balancing later?
        // priority system?
        // for now just choose a random project
        let rawproj = await this.ctx.dbc.db("projects").where("finished", false);
        if(rawproj.length == 0) return null;
        return rawproj[Math.floor(rawproj.length * Math.random())].id as number | string;
    }

    /**
     * All chunks in a given project. Array will be rather large.
     * 
     * @param project
     */
    allPossibleChunks(project:Project):Array<string> {
        let chunks:string[] = [];
        for(let frame = project.framestart; project.animation ? frame < project.frameend! : frame == project.framestart; frame++) {
            for(let row = 0; row < project.cutinto; row++) {
                for(let column = 0; column < project.cutinto; column++) {
                    chunks.push(`${project.id}_${frame}_${row}_${column}`);
                }
            }
        }

        return chunks;
    }

    /**
     * Find a job for the worker to do, in chunkid format
     * 
     * @param projectid the id of the project being rendered.
     * @returns chunkid to do. "none" if there are no more jobs available.
     */
    async assignJob(projectid:number | string, rendernodeId:string):Promise<Job | null> {
        let project = await this.getProject(projectid);
        if(!project) { // no projects available
            console.log(`Nothing to do for ${this.renderNodes[rendernodeId].name}`);

            return null;
        }
        let possibleChunks = this.allPossibleChunks(project); // produce every theoretically possible chunk
        possibleChunks = possibleChunks.filter(n => !project.finishedChunks.includes(n)); // remove all finished chunks from the list
        possibleChunks = possibleChunks.filter(n => !this.currentlyRendering.includes(n)); // remove all currently rendering chunks from the list

        if(possibleChunks.length == 0) { // the project is done, nothing more to be rendered!
            //await this.ctx.dbc.updateById("projects", projectid, {finished: true});
            //console.log(`Finished project ${project.title}`);
            // this should be handled in finish job - IT IS NOT DONE, just no more AVAILABLE chunks (might still be being rendered).

            return null; // hope for better luck finding a good project next time
        }

        this.currentlyRendering.push(possibleChunks[0]);
        this.renderNodes[rendernodeId].startJob(possibleChunks[0]);

        console.log(`Rendernode ${this.renderNodes[rendernodeId].name} is now doing task ${possibleChunks[0]}`);

        return {
            projectid,
            chunkid: possibleChunks[0],
            frame: parseInt(possibleChunks[0].split("_")[1]),
            cutinto: project.cutinto,
            row: parseInt(possibleChunks[0].split("_")[2]),
            column: parseInt(possibleChunks[0].split("_")[3]),
            blendfile: project.blendfile,
            overscan: project.overscan
        }
    }

    /**
     * When a job is finished by a machine
     * NOTE: this does not mean that the task completed *successfully*, just that it was *finished*
     */
    async finishJob(id:string, chunkid:string) {
        console.log(`Rendernode ${this.renderNodes[id].name} has just finished ${chunkid}`);
        this.currentlyRendering = this.currentlyRendering.filter(n => n != chunkid); // remove old chunkid from the system
        this.renderNodes[id].finishJob();

        // if the project doesn't exist anymore, ditch it
        if((await this.ctx.dbc.db("projects").where("id", parseInt(chunkid.split("_")[0]))).length === 0) return;
        // if the project is finished (errored out), ditch it
        //if(((await this.ctx.dbc.getById("projects", parseInt(chunkid.split("_")[0]))).finished == 0)) return;

        let project = await this.getProject(chunkid.split("_")[0]);

        let possibleChunks = this.allPossibleChunks(project);
        possibleChunks = possibleChunks.filter(c => !project.finishedChunks.includes(c));

        if(possibleChunks.length > 0) return;

        // ok so clearly the project is done (all possible frames have been finished)
        await this.ctx.dbc.updateById("projects", project.id, {finished: true});

        console.log(`Starting composition of "${project.title}"`)
        compositor.compositeRender(this.ctx, project.id).then(() => {
            console.log(`Composite of "${project.title}" finished.`);
        });
    }

    /**
     * Add render node to the system, given its name
     * 
     * @param name machine name it provided when launching
     * @returns the id of the machine
     */
    addRenderNode(name:string):string {
        console.log(`Rendernode "${name}" is joining the pool`);
        let id = nanoid();
        this.renderNodes[id] = new RenderNode(id, name);

        return id;
    }

    removeRenderNode(id:string) {
        let renderNode = this.renderNodes[id];
        console.log(`Rendernode "${this.renderNodes[id].name}" is quitting the pool`);
        if(renderNode.working) { // if they are working we should cancel the task they are doing
            this.currentlyRendering = this.currentlyRendering.filter(c => c != renderNode.currentlyDoing); // filter it out
        }
        delete this.renderNodes[id];
    }
}

export default Orchestrator;