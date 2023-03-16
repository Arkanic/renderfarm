import express from "express";
import JSZip, * as JSZipFull from "jszip";
import im from "imagemagick";
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

    // whenever a node makes a request reset the death timer of that node
    api.post("/api/*", (req, res, next) => {
        if(!req.body.id) return next();
        if(typeof req.body.id != "string") return next();
        if(!orchestrator.doesNodeExist(req.body.id)) return next();

        orchestrator.renderNodes[req.body.id].ping();

        next();
    });

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

    api.post("/api/deleteproject", async (req, res, next) => {
        if(!valid(proto, req.body, "DeleteProjectRequest")) return next();

        // does the project exist??
        let projects = await dbc.db("projects").where("id", req.body.projectid);
        if(projects.length == 0) {
            return res.status(400).json({
                success: false,
                message: "That project doesn't exist!"
            });
        }

        // it does, delete it
        await dbc.deleteById("projects", req.body.projectid);

        res.status(200).json({
            success: true
        });

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

    // get job
    api.post("/api/getjob", async (req, res, next) => {
        if(!valid(proto, req.body, "GetjobRequest")) return next();
        let data:types.GetjobRequest = req.body;

        if(!orchestrator.doesNodeExist(data.id)) return next(); // we don't give a custom message here as it gives potential for brute forcing
        if(orchestrator.renderNodes[data.id].working) return next(); // already has a job

        let project = await orchestrator.assignProject();
        if(!project) {
            return res.status(200).json({
                available: false,
                waittime: constants.TASK_WAIT_TIME
            });
        }
        let job = await orchestrator.assignJob(project, data.id);
        if(!job) {
            return res.status(200).json({
                available: false,
                waittime: constants.TASK_WAIT_TIME
            });
        }
        let response:types.GetjobResponse = {
            success: true,
            available: true,
            dataid: job.projectid,
            chunkid: job.chunkid,
            frame: job.frame,
            cutinto: job.cutinto,
            row: job.row,
            column: job.column,
            blendfile: job.blendfile
        }

        res.status(200).json(response);
    });

    // finish job
    api.post("/api/finishjob", async (req, res, next) => {
        if(!valid(proto, req.body, "FinishjobRequest")) return next();
        let response:types.FinishjobRequest = req.body;


        if(!orchestrator.doesNodeExist(response.id)) return next(); // node doesn't exist, false submission!!!
        if(!orchestrator.renderNodes[response.id].amICurrentlyDoing(response.chunkid)) { // you aren't meant to be doing this!!
            return res.status(400).json({
                success: false,
                message: "You aren't meant to be doing that task!!!"
            });
        }

        if(!response.success) {
            if(!response.errormessage) return next(); // no message = not correct

            // ok now we should write down that error to compare with any later ones - and decide if the project should be stopped
            let project = await dbc.getById("projects", response.chunkid.split("_")[0]);
            let renderdata = await dbc.getById("renderdata", project.renderdata_index);
            let newErrors = JSON.parse(renderdata.errors); // add the finished frame to finished chunks list
            // if an array for error messages of this chunk does not exist, create it
            if(!Object.keys(newErrors).includes(response.chunkid)) newErrors[response.chunkid] = [];

            newErrors[response.chunkid].push({
                id: response.id,
                statuscode: response.statuscode,
                errormessage: response.errormessage!
            });

            await dbc.updateById("renderdata", renderdata.id, {errors: JSON.stringify(newErrors)});

        } else { // no error, continue
            try {
                // lets see if the image is actually valid, and not random information
                let image = Buffer.from(response.image, "base64");
                let location = path.join(constants.DATA_DIR, constants.PROJECTS_DIR, `${response.chunkid}.tmp`); // .tmp because we don't know what extension it is yet
                fs.writeFileSync(location, image); // write to temp file
                let format:string = await new Promise(resolve => {
                    im.identify(location, (err, features) => { // validate the image - is it real? if so find extension type of image
                        if(err) throw err;
                        if(!features.format) throw new Error("Features format does not exist!!!");
                        console.log(features.format);
                        resolve(features.format);
                    });
                });

                fs.renameSync(location, path.join(constants.DATA_DIR, constants.PROJECTS_DIR, `${response.chunkid}.${format}`)); // rename it to correct file
            } catch(err) {
                let location = path.join(constants.DATA_DIR, constants.PROJECTS_DIR, `${response.chunkid}.tmp`);
                if(fs.existsSync(location)) fs.unlinkSync(location); // if the temp file exists delete it

                return res.status(400).json({
                    success: false,
                    message: "Invalid image"
                });
            }
        
            let project = await dbc.getById("projects", response.chunkid.split("_")[0]);
            let renderdata = await dbc.getById("renderdata", project.renderdata_index);

            let newFinishedChunks = JSON.parse(renderdata.finished_chunks); // add the finished frame to finished chunks list
            newFinishedChunks.push(response.chunkid);
            await dbc.updateById("renderdata", renderdata.id, {finished_chunks: JSON.stringify(newFinishedChunks)});

        }

        orchestrator.finishJob(response.id, response.chunkid);

        res.status(200).json({
            success: true
        });
    });

    api.post("/api/heartbeat", (req, res, next) => {
        return res.status(200).json({
            success: true
        });
    });



    // /DAT data get requests
    api.get("/dat/blender.tar.xz", (req, res) => {
        res.status(200).sendFile(path.join(constants.DATA_DIR, "blender.tar.xz"), {root: "."});
    });

    // project files
    api.get("/dat/projects/:id", (req, res, next) => {
        let id = parseInt(req.params.id);
        let filepath = path.join(constants.DATA_DIR, constants.PROJECTS_DIR, `${id}.zip`);
        if(!fs.existsSync(filepath)) return res.status(404).json({success: false, message: "Bad Request"});

        res.status(200).sendFile(filepath, {root: "."});
    });

    // request has fallen through to this, either due to not existing or being a malformed request
    api.all("/api/*", (req, res) => {
        res.status(400).json({
            success: false,
            message: "Bad Request"
        });
    });
}