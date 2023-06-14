import axios from "axios";

const protocol:string = window.location.protocol.includes("https") ? "https": "http";
// for testing reasons, as gitpod does not use ports
const url = window.location.hostname.startsWith("8080") ? `${protocol}://2254${window.location.hostname.slice(4)}` : `${protocol}://${window.location.hostname}:2254`;

/**
 * Api url of server
 * @note designed to support public gitpod instances for development
 * 
 * @returns correct api url, including protocol and port
 */
export function apiurl():string {
    return url;
}

/**
 * Are we using gitpod?
 */
export function isGitpod():boolean {
    return window.location.hostname.startsWith("8080");
}

/**
 * Global networking options
 * @returns object
 */
export function networkOptions():any {
    if(isGitpod()) return {withCredentials: true};
    else return {};
}

/**
 * Make generic api post request
 * 
 * @param path api path. Make sure this starts with a slash!
 * @param content body of post request. Server uses JSON.
 * 
 * @returns response from server. This is specifically the ".data" attribute of the axios result
 */
export async function apiPost(path:string, content:any):Promise<any> {
    let result;
    try {
        result = await axios.post(`${apiurl()}${path}`, content, networkOptions());
    } catch(err) {
        alert("Networking Crash!\nMake sure the server is online!\n" + err);
        console.error(err);
        throw err;
    }

    return result.data;
}