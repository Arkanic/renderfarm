export interface Version {
    major:number,
    minor:number,
    patch:number
}

/**
 * Turn a version string into a proper version object
 * 
 * @param version 
 * @returns 
 */
export function parseVersion(version:string):Version {
    let parts = version.split(".");
    if(parts.length != 3) throw new Error("Version parse error");
    return {
        major: parseInt(parts[0]),
        minor: parseInt(parts[1]),
        patch: parseInt(parts[2])
    }
}

/**
 * Compare versions
 * 
 * @param sbig 
 * @param ssmall 
 * @returns true if first version is bigger than last version
 */
export function compareVersions(sbig:string, ssmall:string):boolean {
    let big = parseVersion(sbig);
    let small = parseVersion(ssmall);
    if(big.major !== small.major) return big.major > small.major;
    else
        if(big.minor !== small.minor) return big.minor > small.minor;
        else
            if(big.patch !== small.patch) return big.patch > small.patch
    return false;
}