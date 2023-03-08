import express from "express";
import fs from "fs";
import crypto from "crypto"

import database, {DbConnection} from "./db";
import constants from "./constants";

import Orchestrator from "./orchestrator/orchestrator";

import dashboardRouter from "./routes/dashboard";
import orchestratorRouter from "./routes/orchestrator";

export interface Context {
    dashboard:express.Application,
    api:express.Application,
    dbc:DbConnection,
    orchestrator:Orchestrator
}

database("production").then(async db => {
    const dbConnection = new DbConnection(db);

    const dashboard = express(); // client dashboard interface
    const api = express(); // api interface for render nodes

    let ctx:Context = {
        dashboard,
        api,
        dbc: dbConnection,
        orchestrator:null as unknown as Orchestrator //need to initially set orchestrator to null to prevent recursive definition
    }

    let blenderLocation = `./${constants.DATA_DIR}/blender.tar.xz`;
    if(!fs.existsSync(blenderLocation)) {
        console.log("blender.tar.xz not found in /data!!!");
        console.log("download it from blender.org, later versions can be installed from client.");
        process.exit(1);
    }

    console.log("Updating blender binary hash...");
    // generate sha256 file hash of blender tarball to see if it has changed for clients 
    const blenderTarball = fs.readFileSync(blenderLocation);
    const blenderHash = crypto.createHash("sha256");
    blenderHash.update(blenderTarball);
    const hash = blenderHash.digest("hex");

    // insert into database
    await dbConnection.insert("metadata", {blenderhash: hash, created: Date.now()});
    console.log(hash);


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