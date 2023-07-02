import express from "express";
import fs from "fs";
import crypto from "crypto"
import bcrypt from "bcrypt";
import {nanoid, customAlphabet} from "nanoid";

import database, {DbConnection} from "./db";
import constants from "./constants";
import Logger from "./util/logger";

import Orchestrator from "./orchestrator/orchestrator";

import dashboardRouter from "./routes/dashboard";
import orchestratorRouter from "./routes/orchestrator";

export interface Context {
    dashboard:express.Application,
    api:express.Application,
    dbc:DbConnection,
    orchestrator:Orchestrator,
    serverhash:string,
    blenderhash:string,
    verifyPassword:(pass:string) => boolean,
    logger:Logger
}
let ctx:Context = null as any as Context;

let logger = new Logger(); // start capturing stdout

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


    let passwordLocation = `./${constants.DATA_DIR}/shadow`;
    let password = "";
    if(!fs.existsSync(passwordLocation)) {
        console.log("No password has been set!\nAutomatically generating password...");
        let rawPassword = customAlphabet("abcdefghijklmnnopqrstuvwxyz0123456789", Math.floor(Math.random() * 4) + 8)();
        console.log(`The password for the dashboard is\n${rawPassword}`);

        let salt = bcrypt.genSaltSync(constants.BCRYPT_SALT_ROUNDS);
        password = bcrypt.hashSync(rawPassword, salt);

        fs.writeFileSync(passwordLocation, password);
    } else {
        password = fs.readFileSync(passwordLocation).toString().split("\n")[0];
    }


    ctx = {
        dashboard,
        api,
        dbc: dbConnection,
        orchestrator:null as unknown as Orchestrator, //need to initially set orchestrator to null to prevent recursive definition,
        serverhash: serverHash,
        blenderhash: "placeholder",
        verifyPassword: (pass:string) => {
            return bcrypt.compareSync(pass, password);
        },
        logger
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