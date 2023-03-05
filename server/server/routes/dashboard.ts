import express from "express";
import path from "path";
import {Context} from "../server";

export default (ctx:Context) => {
    const {dashboard} = ctx;

    // host the static generated files
    dashboard.use(express.static(path.join(__dirname, "../../dashboard-build")));
}