import {spawn} from "child_process";

export default async function spawnProcess(command:string, args:Array<string>):Promise<number> {
    console.log(`Spawning ${command}`);

    return new Promise((resolve, reject) => {
        const cmd = spawn(command, args);

        cmd.stdout.on("data", (data) => {
            process.stdout.write(data.toString());
        });

        cmd.stderr.on("data", (data) => {
            process.stdout.write(data.toString());
        });

        cmd.on("close", code => {
            if(code != 0) reject(code);
            else resolve(code);
        });
    });
}