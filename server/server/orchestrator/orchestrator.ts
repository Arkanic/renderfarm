import {nanoid} from "nanoid";

import {Context} from "../server";
import RenderNode from "./rendernode";

class Orchestrator {
    ctx:Context;

    renderNodes:{[key:string]:RenderNode};

    constructor(ctx:Context) {
        this.ctx = ctx;
        this.renderNodes = {};
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
        console.log(`Rendernode "${this.renderNodes[id].name}" is cleanly quitting the pool`);
        delete this.renderNodes[id];
    }
}

export default Orchestrator;