import express from "express";
import path from "path";

import database, {DbConnection} from "./db";


database("production").then(db => {
    const dbConnection = new DbConnection(db);


    // DASHBOARD
    const dashboard = express();
    // serve static & generated dashboard files
    dashboard.use(express.static(path.join(__dirname, "../dashboard-build")));
    dashboard.listen("8080", () => {
        console.log("Dashboard online");
    });

});