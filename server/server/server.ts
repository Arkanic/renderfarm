import express from "express";
import path from "path";

import database, {DbConnection} from "./db";

import Orchestrator from "./orchestrator/orchestrator";

import dashboardRouter from "./routes/dashboard";

export interface Context {
    dashboard:express.Application,
    api:express.Application,
    dbc:DbConnection
}

database("production").then(db => {
    const dbConnection = new DbConnection(db);

    const dashboard = express(); // client dashboard interface
    const api = express(); // api interface for render nodes

    let ctx:Context = {
        dashboard,
        api,
        dbc: dbConnection
    }

    let orchestrator = new Orchestrator(ctx);

    dashboardRouter(ctx);


    // start all of the servers up
    dashboard.listen("8080", () => {
        console.log("Dashboard is online");
    });
    api.listen("2254", () => {
        console.log("Orchestrator server is online");
    });
});