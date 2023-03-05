import express from "express";
import path from "path";

import database, {DbConnection} from "./db";

import dashboardRouter from "./routes/dashboard";

export interface Context {
    dashboard:express.Application,
    orchestrator:express.Application,
    dbc:DbConnection
}

database("production").then(db => {
    const dbConnection = new DbConnection(db);

    const dashboard = express(); // client dashboard interface
    const orchestrator = express(); // api interface for render nodes

    let ctx:Context = {
        dashboard,
        orchestrator,
        dbc: dbConnection
    }


    dashboardRouter(ctx);


    // start all of the servers up
    dashboard.listen("8080", () => {
        console.log("Dashboard is online");
    });
    orchestrator.listen("2254", () => {
        console.log("Orchestrator server is online");
    });
});