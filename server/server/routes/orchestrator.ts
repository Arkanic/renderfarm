import express from "express";
import cors from "cors";
import fileUpload, {UploadedFile} from "express-fileupload";
import JSZip, * as JSZipFull from "jszip";
import im from "imagemagick";
import path from "path";
import fs from "fs";
import os from "os";
import {exit} from "process";

import {Context, updateBlenderHash} from "../server";
import * as protocol from "../protocol";
import * as types from "../types/api";
import constants from "../constants";
import { nanoid } from "nanoid";


function valid(proto:protocol.ValidatorContext, data:any, policy:string):boolean {
    return protocol.validateClientInput(proto, data, policy);
}

function getIPAddress():string {
    let interfaces = os.networkInterfaces();
    for (let devName in interfaces) {
        let iface = interfaces[devName]!;

        for (let i = 0; i < iface.length; i++) {
            let alias = iface[i];
            if(alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) return alias.address;
        }
    }
    return '0.0.0.0';
}

export default (ctx:Context) => {
    const {api, orchestrator, dbc} = ctx;

    // create protocol
    let proto = protocol.createValidatorContext("server/types/api.ts");

    api.use(cors({
        origin: process.env.GITPOD_WORKSPACE_ID ? `https://8080-${process.env.GITPOD_WORKSPACE_URL?.slice(8)}` : `http://${getIPAddress()}:8080`,
        credentials: (process.env.GITPOD_WORKSPACE_ID ? true : false)
    }));


    // following are practical implementations of the api. Requests are checked against the codified api spec in /types/api
    // upload project and upload blender are multipart forms as the file content is much too large for js

    
    api.post("/form/uploadproject", fileUpload(), express.urlencoded({extended: true}), async (req, res, next) => {
        let data:types.UploadProjectRequest = null as unknown as types.UploadProjectRequest;
        try {
            data = {
                title: req.body["upload-title"],
                blendfile: req.body["upload-blendfile"],
                cutinto: parseInt(req.body["upload-cutinto"]),
                animation: req.body["upload-animation"] ? true : false,
                framestart: parseInt(req.body["upload-framestart"]),
                frameend: Number.isNaN(parseInt(req.body["upload-frameend"])) ? 0 : parseInt(req.body["upload-frameend"]) + 1
            }
        } catch(err) {
            return next();
        }

        if(!req.files || Object.keys(req.files).length < 1) return next();
        if(!req.files["upload-file"]) return next();

        let filename = nanoid();

        let file:UploadedFile = req.files["upload-file"] as unknown as any;
        
        await new Promise((resolve, reject) => {
            file.mv(path.join(constants.DATA_DIR, `${filename}`), (err) => {
                if(err) {
                    reject();
                    return next();
                }
                resolve(null);
            }); // store as temp
        });


        if(data.animation && !data.frameend) return next(); // if it is an animation there should be a frameend variable


        let zip = new JSZip();
        let unzippedSizes:any = [];
        try {
            // make sure the blend file the user claims to exist does exist
            let foundBlend = false;
            await zip.loadAsync(fs.readFileSync(path.join(constants.DATA_DIR, filename))); // read zip file
            zip.forEach((relativePath:string, zipEntry:JSZipFull.JSZipObject) => {
                unzippedSizes.push(new Promise(async (resolve) => {
                    let ab = await zip.file(relativePath)!.async("arraybuffer");
                    let sum = ab.byteLength;
                    resolve(sum);
                }));
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

        await Promise.all(unzippedSizes);
        let totalSize = 0;
        for(let unzippedSize of unzippedSizes) {
            totalSize += await unzippedSize;
        }

        console.log(`Unzipped size of project is ${(totalSize / 1000000).toFixed(2)}mb`);

        // insert it into database
        let renderdata = {
            cutinto: data.cutinto,
            animation: data.animation,
            framestart: data.framestart,
            frameend: 0,
            blendfile: data.blendfile,
            size: totalSize
        };
        if(data.animation) renderdata.frameend = data.frameend!;

        let renderdataId = await dbc.insert("renderdata", renderdata);

        let projectId = await dbc.insert("projects", {
            created: Date.now(),
            title: data.title,
            renderdata_index: renderdataId
        });

        // write zip project to file
        fs.renameSync(path.join(constants.DATA_DIR, filename), path.join(constants.DATA_DIR, constants.PROJECTS_DIR, `${projectId}.zip`));

        console.log(`Uploaded project ${projectId}, "${data.title}"`);

        res.status(200).json({
            success: true,
            projectid: projectId
        });
    });


    
    api.post("/form/uploadblender", fileUpload(), express.urlencoded({extended: true}), async (req, res, next) => {
        try {
            if(!req.files || Object.keys(req.files).length < 1) return next();
            if(!req.files["settings-blenderfile"]) return next();

            let file:UploadedFile = req.files["settings-blenderfile"] as unknown as any;

            let blendertxzTmp = path.join(constants.DATA_DIR, "blender.tar.xz.tmp");
            let blendertxz = path.join(constants.DATA_DIR, "blender.tar.xz");
            // the temp file is so that blender can still be downloaded while the disk is being written to
            await new Promise((resolve, reject) => {
                file.mv(blendertxzTmp, err => {
                    if(err) {
                        reject();
                        return next();
                    }
                    resolve(null);
                });
            });

            fs.unlinkSync(blendertxz);
            fs.renameSync(blendertxzTmp, blendertxz);

            updateBlenderHash();
        } catch(err) {
            return next();
        }

        res.status(200).json({success: true});
    });  



    api.use(express.json({limit: "100mb"}));

    // whenever a node makes a request reset the death timer of that node
    api.post("/api/*", (req, res, next) => {
        if(!req.body.id) return next();
        if(typeof req.body.id != "string") return next();
        if(!orchestrator.doesNodeExist(req.body.id)) return next();

        orchestrator.renderNodes[req.body.id].ping();

        next();
    });

    // request an index of projects
    api.post("/api/projectsindex", async (req, res, next) => {
        if(!valid(proto, req.body, "ProjectsIndexRequest")) return next();
        
        let projects;
        if(req.body.unfinishedonly) projects = await dbc.db("projects").where({finished: false});
        else projects = await dbc.db("projects");

        let formattedProjects:Array<types.ProjectsIndexFormattedProject> = [];

        for(let i in projects) {
            let project = projects[i];
            let renderdata = await dbc.getById("renderdata", project.renderdata_index);

            formattedProjects.push({
                id: project.id,
                title: project.title,
                created: project.created,
                finished: project.finished ? true : false,
                rendered: project.rendered ? true : false,
                finishedchunks: JSON.parse(renderdata.finished_chunks).length,
                totalchunks: (renderdata.animation ? (renderdata.frameend - renderdata.framestart) : 1) * renderdata.cutinto * renderdata.cutinto,
                size: renderdata.size
            } as types.ProjectsIndexFormattedProject);
        }

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

        // it does, purge
        console.log(`Deleting project ${projects[0].title}`);
        fs.rmSync(path.join(constants.DATA_DIR, constants.PROJECTS_DIR, `${req.body.projectid}.zip`));
        fs.rmSync(path.join(constants.DATA_DIR, constants.RENDERS_DIR, `${req.body.projectid}`), {recursive: true, force: true});

        await dbc.deleteById("projects", req.body.projectid);

        res.status(200).json({
            success: true
        });
    });

    // show currently online workers and what project they are working on
    api.post("/api/onlineworkers", async (req, res, next) => {
        if(!valid(proto, req.body, "OnlineWorkersRequest")) return next();

        let renderNodes = Object.values(ctx.orchestrator.renderNodes).map(r => {return {name: r.name, currentProjectId: r.currentlyDoing.split("_")[0]}});
        let serializedNodes:Array<types.OnlineWorkersWorker> = [];
        for(let i in renderNodes) {
            let renderNode = renderNodes[i];

            let project = await ctx.dbc.getById("projects", renderNode.currentProjectId);

            serializedNodes.push({
                name: renderNode.name,
                currentlyrendering: project.title
            });
        }

        res.status(200).json({
            success: true,
            workers: serializedNodes
        });
    });

    // PURGE!!!! (leaves blender.tar.xz)
    api.post("/api/cleardb", async (req, res, next) => {
        if(!valid(proto, req.body, "ClearDBRequest")) return next();
        let data:types.ClearDBRequest = req.body;

        fs.renameSync(path.join(constants.DATA_DIR, "blender.tar.xz"), "blender.tar.xz");
        fs.rmSync(constants.DATA_DIR, {force: true, recursive: true}); // HAHAHHA
        fs.mkdirSync(constants.DATA_DIR);
        fs.renameSync("blender.tar.xz", path.join(constants.DATA_DIR, "blender.tar.xz"));

        console.log("Purging all data and then quitting!!!!");

        res.status(200).json({success: true, message: "help"});
        exit(0);
    });

    // join server
    api.post("/api/join", async (req, res, next) => {
        if(!valid(proto, req.body, "JoinRequest")) return next();
        let data:types.JoinRequest = req.body;

        // add render node
        let id = orchestrator.addRenderNode(data.name);
        let response:types.JoinResponse = {
            success: true,
            id,
            blenderhash: ctx.blenderhash,
            serverhash: ctx.serverhash,
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

    api.post("/api/panic", (req, res, next) => {
        if(!valid(proto, req.body, "PanicRequest")) return next();
        
        let data:types.PanicRequest = req.body;
        if(!orchestrator.doesNodeExist(data.id)) return next();

        console.log(`Worker ${orchestrator.renderNodes[data.id].name} has panicked with the following:\n${data.error}`);

        res.status(200).json({success: true});
    })

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

        if((await ctx.dbc.db("projects").where("id", parseInt(response.chunkid.split("_")[0]))).length !== 0) {
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
                    let location = path.join(constants.DATA_DIR, constants.RENDERS_DIR, `${response.chunkid}.tmp`); // .tmp because we don't know what extension it is yet
                    fs.writeFileSync(location, image); // write to temp file
                    let format:string = await new Promise(resolve => {
                        im.identify(location, (err, features) => { // validate the image - is it real? if so find extension type of image
                            if(err) throw err;
                            if(!features.format) throw new Error("Features format does not exist!!!");
                            resolve(features.format);
                        });
                    });

                    let theoreticalRenderSubfolder = path.join(constants.DATA_DIR, constants.RENDERS_DIR, `${response.chunkid.split("_")[0]}`);
                    if(!fs.existsSync(theoreticalRenderSubfolder)) fs.mkdirSync(theoreticalRenderSubfolder); // if the render subfolder does not exist make it
                    if(!fs.existsSync(path.join(theoreticalRenderSubfolder, "raw"))) fs.mkdirSync(path.join(theoreticalRenderSubfolder, "raw"));
                    fs.renameSync(location, path.join(theoreticalRenderSubfolder, "raw", `${response.chunkid}.${format}`)); // rename it to correct file

                    let fpsStr = `${response.fps}\n${response.fpsbase}`;
                    fs.writeFileSync(path.join(theoreticalRenderSubfolder, "renderdata"), fpsStr); // write renderdata to string
                } catch(err) {
                    console.log(err);
                    let location = path.join(constants.DATA_DIR, constants.RENDERS_DIR, `${response.chunkid}.tmp`);
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
        } else {
            console.log("Chunk didn't exist");
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
        if(!fs.existsSync(filepath)) return next();

        res.status(200).sendFile(filepath, {root: "."});
    });

    api.use("/dat/renders/:id/result", async (req, res, next) => {
        let id = parseInt(req.params.id);
        if((await ctx.dbc.db("projects").where("id", id)).length === 0) return next();
        if(!(await ctx.dbc.getById("projects", id)).rendered) return next();

        let folderpath = path.join(constants.DATA_DIR, constants.RENDERS_DIR, `${id}`, "finished");
        if(!fs.existsSync(folderpath)) return next();

        let result = fs.readdirSync(folderpath).filter(f => f.startsWith("final"))[0];

        return res.status(200).sendFile(path.join(folderpath, result), {root: "."});
    });

    api.use("/dat/renders/:id/raw", async (req, res, next) => {
        let id = parseInt(req.params.id);
        if((await ctx.dbc.db("projects").where("id", id)).length < 1) return next();
        if(!(await ctx.dbc.getById("projects", id)).rendered) return next();

        let folderpath = path.join(constants.DATA_DIR, constants.RENDERS_DIR, `${id}`, "finished");
        if(!fs.existsSync(folderpath)) return next();

        let result = fs.readdirSync(folderpath).filter(f => f.startsWith("raw"))[0];

        return res.status(200).sendFile(path.join(folderpath, result), {root: "."});
    });

    // request has fallen through to this, either due to not existing or being a malformed request
    api.all("/api/*", (req, res) => {
        res.status(400).json({
            success: false,
            message: "Bad Request"
        });
    });
}