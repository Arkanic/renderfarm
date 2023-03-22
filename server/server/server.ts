import express from "express";
import fs from "fs";
import crypto from "crypto"
import {nanoid} from "nanoid";

import database, {DbConnection} from "./db";
import constants from "./constants";

import Orchestrator from "./orchestrator/orchestrator";

import dashboardRouter from "./routes/dashboard";
import orchestratorRouter from "./routes/orchestrator";

export interface Context {
    dashboard:express.Application,
    api:express.Application,
    dbc:DbConnection,
    orchestrator:Orchestrator,
    serverhash:string,
    blenderhash:string
}

let ctx:Context = null as any as Context;

export function updateBlenderHash():string {
    let blenderLocation = `./${constants.DATA_DIR}/blender.tar.xz`;
    if(!fs.existsSync(blenderLocation)) {
        console.log("blender.tar.xz not found in /data!!!");
        console.log("download it from blender.org, later versions can be installed from client.");
        process.exit(1);
    }

    console.log("Updating blender binary hash...");
    // generate sha256 file hash of blender tarball to see if it has changed for clients 
    const blenderTarball = fs.readFileSync(blenderLocation);
    const hash = crypto.createHash("sha256").update(blenderTarball).digest("hex");

    ctx.blenderhash = hash;
    console.log(hash);
    return hash;
}

database("production").then(async db => {
    const dbConnection = new DbConnection(db);

    const dashboard = express(); // client dashboard interface
    const api = express(); // api interface for render nodes

    let serverHashLocation = `./${constants.DATA_DIR}/serverhash.txt`;
    let serverHash = "";
    if(!fs.existsSync(serverHashLocation)) {
        console.log("Server hash does not exist...");
        serverHash = crypto.createHash("sha256").update(nanoid()).digest("hex");
        fs.writeFileSync(serverHashLocation, serverHash);
    } else {
        console.log("Server hash found in file");
        serverHash = fs.readFileSync(serverHashLocation).toString();
    }
    console.log(serverHash);

    ctx = {
        dashboard,
        api,
        dbc: dbConnection,
        orchestrator:null as unknown as Orchestrator, //need to initially set orchestrator to null to prevent recursive definition,
        serverhash: serverHash,
        blenderhash: "placeholder"
    }

    updateBlenderHash();

    // because of orchestrator:null orchestrator object cannot access itself through ctx - although it should be using `this` anyway
    let orchestrator = new Orchestrator(ctx);
    ctx.orchestrator = orchestrator;

    
    orchestratorRouter(ctx);
    dashboardRouter(ctx);

    // start all of the servers up
    dashboard.listen("8080", () => {
        console.log("Dashboard is online");
    });
    api.listen("2254", () => {
        console.log("Orchestrator server is online");
    });
});