import express from "express";
import path from "path";

import database, {DbConnection} from "./db";

import Orchestrator from "./orchestrator/orchestrator";

import dashboardRouter from "./routes/dashboard";

export interface Context {
    dashboard:express.Application,
    api:express.Application,
    dbc:DbConnection,
    orchestrator:Orchestrator
}

database("production").then(db => {
    const dbConnection = new DbConnection(db);

    const dashboard = express(); // client dashboard interface
    const api = express(); // api interface for render nodes

    let ctx:Context = {
        dashboard,
        api,
        dbc: dbConnection,
        orchestrator:null as unknown as Orchestrator //need to initially set orchestrator to null to prevent recursive definition
    }

    // because of orchestrator:null orchestrator object cannot access itself through ctx - although it should be using `this` anyway
    let orchestrator = new Orchestrator(ctx);
    ctx.orchestrator = orchestrator;

    dashboardRouter(ctx);


    // start all of the servers up
    dashboard.listen("8080", () => {
        console.log("Dashboard is online");
    });
    api.listen("2254", () => {
        console.log("Orchestrator server is online");
    });
});