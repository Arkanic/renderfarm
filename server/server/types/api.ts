// api typings, serves as a codified reference for SPEC.md requests

export interface Response {
    success:boolean,
    message?:string // error message if it all goes wrong
}
export interface Request {
    id:string
}

// upload project to renderfarm
export interface UploadProjectRequest {
    title:string,
    blendfile:string, // relative path to .blend file
    cutinto:number,
    animation:boolean,
    framestart:number,
    frameend?:number,
    data:string
}
export interface UploadProjectResponse extends Response {
    projectid:string | number
}

// get a list of projects being rendered by the renderfarm
export interface ProjectsIndexFormattedProject {
    id:number | string,
    title:string,
    created:number,
    finished:boolean,
    finishedchunks:number,
    totalchunks:number
}
export interface ProjectsIndexRequest {
    unfinishedonly:boolean
}
export interface ProjectsIndexResponse extends Response {
    projects:Array<ProjectsIndexFormattedProject>
}

// delete project from renderfarm
export interface DeleteProjectRequest {
    projectid:string | number
}
export interface DeleteProjectResponse extends Response {}

// see what workers are online
export interface OnlineWorkersWorker {
    name:string,
    currentlyrendering:string // name of what it is currently rendering
}
export interface OnlineWorkersRequest {}
export interface OnlineWorkersResponse extends Response {
    workers:Array<OnlineWorkersWorker>
}

// request to join renderfarm
export interface JoinRequest {
    name:string
}
export interface JoinResponse extends Response {
    id:string,
    blenderhash:string,
    serverhash:string, // server's id, useful for when db is purged
    heartbeatinterval:number
}

// leave renderfarm cleanly
export interface LeaveRequest extends Request {}
export interface LeaveResponse extends Response {}

// get something to do
export interface GetjobRequest extends Request {}
export interface GetjobResponse extends Response {
    available:boolean,
    waittime?:number,
    dataid:string | number,
    chunkid:string,
    frame:number,
    cutinto:number,
    row:number,
    column:number,
    blendfile:string
    // settings unused
}

// return results of job
export interface FinishjobRequest extends Request {
    chunkid:string,
    success:boolean,
    errormessage?:string,
    statuscode:number,
    image:string,
    fps:number,
    fpsbase:number
}
export interface FinishjobResponse extends Response {}

// send heartbeat
export interface HeartbeatRequest extends Request {}
export interface HeartbeatResponse extends Response {}