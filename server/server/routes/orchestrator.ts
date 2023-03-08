import express from "express";
import JSZip, * as JSZipFull from "jszip";
import path from "path";
import fs from "fs";

import {Context} from "../server";
import * as protocol from "../protocol";
import * as types from "../types/api";
import constants from "../constants";

function valid(proto:protocol.ValidatorContext, data:any, policy:string):boolean {
    return protocol.validateClientInput(proto, data, policy);
}

export default (ctx:Context) => {
    const {api, orchestrator, dbc} = ctx;

    // create protocol
    let proto = protocol.createValidatorContext("server/types/api.ts");

    api.use(express.json({limit: "8gb"}));

    // following are practical implementations of the api. Requests are checked against the codified api spec in /types/api

    api.post("/api/uploadproject", async (req, res, next) => {
        if(!valid(proto, req.body, "UploadProjectRequest")) return next(); // skip to error section 
        let data:types.UploadProjectRequest = req.body;
        if(data.animation && !data.frameend) return next(); // if it is an animation there should be a frameend variable

        // decode zip file
        let zipData = Buffer.from(data.data, "base64");
        let zip = new JSZip();
        try {
            // make sure the blend file the user claims to exist does exist
            let foundBlend = false;
            await zip.loadAsync(zipData);
            zip.forEach((relativePath:string, zipEntry:JSZipFull.JSZipObject) => {
                console.log(relativePath);
                if(relativePath == data.blendfile) foundBlend = true;
            });
            if(!foundBlend) {
                return res.status(400).json({
                    success: false,
                    message: ".blend file does not exist in this zip file"
                });
            }
        } catch(err) {
            return res.status(400).json({
                success: false,
                message: "invalid zip file"
            });
        }

        // insert it into database
        let renderdata = {
            cutinto: data.cutinto,
            animation: data.animation,
            framestart: data.framestart,
            frameend: 0,
            blendfile: data.blendfile
        };
        if(data.animation) renderdata.frameend = data.frameend!;

        let renderdataId = await dbc.insert("renderdata", renderdata);

        let projectId = await dbc.insert("projects", {
            created: Date.now(),
            title: data.title,
            renderdata_index: renderdataId
        });

        // write zip project to file
        fs.writeFileSync(path.join(constants.DATA_DIR, constants.PROJECTS_DIR, `${projectId}.zip`), zipData);

        console.log(`Uploaded project ${projectId}, "${data.title}"`);

        res.status(200).json({
            success: true,
            projectid: projectId
        });
    });

    // request an index of projects
    api.post("/api/projectsindex", async (req, res, next) => {
        if(!valid(proto, req.body, "ProjectsIndexRequest")) return next();
        
        let projects;
        if(req.body.unfinishedonly) projects = await dbc.db("projects").where({finished: false});
        else projects = await dbc.db("projects");

        let formattedProjects:Array<{
            id:number | string,
            title:string,
            created:number,
            finished:boolean
        }> = projects.map(p => {return {id: p.id, title: p.title, created: p.created, finished: p.finished ? true : false}});

        let response:types.ProjectsIndexResponse = {
            success: true,
            projects: formattedProjects
        }

        res.status(200).json(response);
    });

    // join server
    api.post("/api/join", async (req, res, next) => {
        if(!valid(proto, req.body, "JoinRequest")) return next();
        let data:types.JoinRequest = req.body;

        // get most recent metadata entry
        let metadata = (await dbc.db("metadata").orderBy("id", "desc").limit(1))[0];

        // add render node
        let id = orchestrator.addRenderNode(data.name);
        let response:types.JoinResponse = {
            success: true,
            id,
            blenderhash: metadata.blenderhash,
            heartbeatinterval: constants.HEARTBEAT_INTERVAL
        }

        res.status(200).json(response);
    });

    // leave server
    api.post("/api/leave", (req, res, next) => {
        if(!valid(proto, req.body, "LeaveRequest")) return next();

        orchestrator.removeRenderNode(req.body.id);
        
        res.status(200).json({success: true});
    });

    // request has fallen through to this, either due to not existing or being a malformed request
    api.all("/api/*", (req, res) => {
        res.status(400).json({
            success: false,
            message: "Bad Request"
        });
    });
}