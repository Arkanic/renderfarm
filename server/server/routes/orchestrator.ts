import express, { Application } from "express";
import path from "path";

import {Context} from "../server";
import * as protocol from "../protocol";
import * as types from "../types/api";
import constants from "../constants";

function valid(proto:protocol.ValidatorContext, data:any, policy:string):boolean {
    return protocol.validateClientInput(proto, data, policy);
}

export default (ctx:Context) => {
    const {api, orchestrator} = ctx;

    // create protocol
    let proto = protocol.createValidatorContext("server/types/api.ts");

    api.use(express.json());

    // following are practical implementations of the api. Requests are checked against the codified api spec in /types/api

    // join server
    api.post("/api/join", (req, res, next) => {
        if(!valid(proto, req.body, "JoinRequest")) return next(); // skip to error section 
        let data:types.JoinRequest = req.body;

        // add render node
        let id = orchestrator.addRenderNode(data.name);
        let response:types.JoinResponse = {
            success: true,
            id,
            blenderhash: "placeholder",
            heartbeatinterval: constants.HEARTBEAT_INTERVAL
        }

        res.status(200).json(response);
    });

    // request has fallen through to this, either due to not existing or being a malformed request
    api.all("/api/*", (req, res) => {
        res.status(400).json({
            success: false,
            message: "Bad Request"
        });
    });
}