import express from "express";
import {Context} from "../server";
import * as protocol from "../protocol";

export default (ctx:Context) => {
    const {api, orchestrator} = ctx;

    api.use(express.json());

    api.post("/join", (req, res) => {
        
    })
}