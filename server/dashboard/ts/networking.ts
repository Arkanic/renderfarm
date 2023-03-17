const protocol:string = window.location.protocol.includes("https") ? "https": "http";
// for testing reasons, as gitpod does not use ports
const url = window.location.hostname.startsWith("8080") ? `${protocol}://2254${window.location.hostname.slice(4)}` : `${protocol}://${window.location.hostname}:2254`;

export function apiurl():string {
    return url;
}

export function isGitpod():boolean {
    return window.location.hostname.startsWith("8080");
}

export function networkOptions() {
    if(isGitpod()) return {withCredentials: true};
    else return {};
}