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

    addRenderNode(renderNode:RenderNode) {
        this.renderNodes[renderNode.id] = renderNode;
    }

    removeRenderNode(id:string) {
        delete this.renderNodes[id];
    }
}

export default Orchestrator;