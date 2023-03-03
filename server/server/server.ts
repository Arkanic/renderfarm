import express from "express";
import path from "path";


// DASHBOARD
const dashboard = express();

dashboard.use(express.static(path.join(__dirname, "../dashboard-build")));
dashboard.listen("8080", () => {
    console.log("Dashboard online");
});