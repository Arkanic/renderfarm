import {Knex} from "knex";

export const up = (schema:Knex.SchemaBuilder) => {
    return schema.alterTable("renderdata", table => {
        table.string("errors").defaultTo("{}"); // errors occuring
    });
}

export const down = (knex:Knex) => {}