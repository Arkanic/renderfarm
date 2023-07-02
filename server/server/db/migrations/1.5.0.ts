import {Knex} from "knex";

export const up = (schema:Knex.SchemaBuilder) => {
    return schema.alterTable("renderdata", table => {
        table.integer("overscan").defaultTo(32);
    });
}