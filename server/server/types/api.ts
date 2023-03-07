// api typings, serves as a codified reference for SPEC.md requests

export interface Response {
    success:boolean,
    message:string | undefined
}
export interface Request {
    id:string
}

// request to join renderfarm
export interface JoinRequest {
    name:string
}
export interface JoinResponse extends Response {
    id:string,
    blenderhash:string,
    heartbeatinterval:number
}

// leave renderfarm cleanly
export interface LeaveRequest extends Request {}
export interface LeaveResponse extends Response {}

// get something to do
export interface GetjobRequest extends Request {}
export interface GetjobResponse extends Response {
    available:boolean,
    waittime:number | undefined,
    dataid:string,
    chunkid:string,
    frame:number,
    cutinto:number,
    row:number,
    column:number,
    // settings unused
}

// return results of job
export interface JobfinishRequest extends Request {
    chunkid:string,
    success:boolean,
    statuscode:number,
    image:string
}
export interface JobfinishResponse extends Response {}

// send heartbeat
export interface HeartbeatRequest extends Request {}
export interface HeartbeatResponse extends Response {}