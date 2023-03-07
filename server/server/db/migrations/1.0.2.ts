import {Knex} from "knex";

export const up = (schema:Knex.SchemaBuilder) => {
    return schema.createTable("metadata", table => {
        table.increments("id").primary();
        table.string("blenderhash").notNullable();
        table.bigInteger("created").notNullable();
    });
}

export const down = (knex:Knex) => {}