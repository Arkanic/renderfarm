import * as knex from "knex";
import fs from "fs";

import {getMigration, getMigrations} from "./db/migrator";
import constants from "../constants";

const DATA_DIR = "data";

/**
 * Set up database and return
 */
export default async (type:string | undefined):Promise<knex.Knex<any, unknown[]>> => {
    return new Promise((resolve, reject) => {
        if(!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

        let db:knex.Knex<any, unknown[]> | PromiseLike<knex.Knex<any, unknown[]>>;
        db = knex.default({
            client: "better-sqlite3",
            connection: {
                filename: `./${DATA_DIR}/renderfarm.db`
            },
            useNullAsDefault: true
        });
        
        initdb(db).then((_) => {
            resolve(db);
        });
    });
}

function readVersion():string {
    return fs.readFileSync(`./${DATA_DIR}/version`).toString();
}

function createVersion(version:string) {
    fs.writeFileSync(`./${DATA_DIR}/version`, version);
}

/**
 * Initialize database
 * @param db 
 * @returns 
 */
export async function initdb(db:knex.Knex<any, unknown[]>):Promise<knex.Knex.SchemaBuilder> {
    let {schema} = db;
    let version = "0.0.0";
    if(await schema.hasTable("projects")) { // if projects table exists we know that the database does exist
        version = readVersion();
    }

    let migrations = getMigrations(version);
    for(let i in migrations) {
        let migration = await getMigration(migrations[i]);
        migration.up(schema);
    }

    createVersion(constants.VERSION);

    return schema;
}

export class DbConnection {
    db:knex.Knex<any, unknown[]>

    constructor(db:knex.Knex<any, unknown[]>) {
        this.db = db;
    }

    async getById(table:string, id:number | string) {
        let [result] = await this.db(table).select().where("id", id);
        return result;
    }

    async insert(table:string, content:any) {
        let id = await this.db(table).insert(content);
        let [r] = id;
        return r;
    }

    async updateById(table:string, id:number | string, content:any) {
        await this.db(table).update(content).where("id", id);
    }

    async deleteById(table:string, id:number | string) {
        await this.db(table).del().where("id", id);
    }
}