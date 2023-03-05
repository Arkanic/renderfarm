import express from "express";
import path from "path";

import database, {DbConnection} from "./db";

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


    // serve static & generated dashboard files
    dashboard.use(express.static(path.join(__dirname, "../dashboard-build")));
    dashboard.listen("8080", () => {
        console.log("Dashboard online");
    });

});