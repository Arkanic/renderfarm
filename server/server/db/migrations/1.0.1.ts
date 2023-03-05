import {Knex} from "knex";

export const up = (schema:Knex.SchemaBuilder) => {
    return schema.alterTable("renderdata", table => {
        table.bigInteger("size").notNullable().defaultTo(0);
    });
}

export const down = (knex:Knex) => {}