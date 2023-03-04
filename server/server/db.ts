import * as knex from "knex";
import fs from "fs";

import {getMigration, getMigrations} from "./db/migrator";
import constants from "./constants";

const DATA_DIR = "data";

/**
 * Set up database and return
 */
export default async (type:string | undefined):Promise<knex.Knex<any, unknown[]>> => {
    return new Promise((resolve, reject) => {
        if(!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR); // if the data folder doesn't exist, make it

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
    let version = "0.0.0"; // if no database exists, a version of 0 will update the database right up to the present
    if(await schema.hasTable("projects")) { // if projects table exists we know that the database does exist
        version = readVersion();
    }

    // get migrations that are needed and apply them if there are any
    let migrations = getMigrations(version);
    for(let i in migrations) {
        let migration = await getMigration(migrations[i]);
        migration.up(schema);
    }

    // update version file to current version
    createVersion(constants.VERSION);

    return schema;
}

/**
 * Database connection instance
 */
export class DbConnection {
    db:knex.Knex<any, unknown[]>

    constructor(db:knex.Knex<any, unknown[]>) {
        this.db = db;
    }

    /**
     * Get an item from a table by its (primary) id
     * 
     * @param table 
     * @param id 
     * @returns 
     */
    async getById(table:string, id:number | string) {
        let [result] = await this.db(table).select().where("id", id);
        return result;
    }

    /**
     * Insert an item into a table
     * 
     * @param table 
     * @param content 
     * @returns The id of the newitem
     */
    async insert(table:string, content:any) {
        let id = await this.db(table).insert(content);
        let [r] = id;
        return r;
    }

    /**
     * Update the content of a table row by id
     * 
     * @param table 
     * @param id 
     * @param content does not have to be a repeat of the entire object, only keys that are specified are modified
     */
    async updateById(table:string, id:number | string, content:any) {
        await this.db(table).update(content).where("id", id);
    }

    /**
     * Delete item in table by id
     * Warning, this does not delete items that are referenced by the item being deleted
     * 
     * @param table 
     * @param id 
     */
    async deleteById(table:string, id:number | string) {
        await this.db(table).del().where("id", id);
    }
}