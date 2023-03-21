import {Knex} from "knex";

export const up = (schema:Knex.SchemaBuilder) => {
    return schema.alterTable("projects", table => {
        table.boolean("rendered").defaultTo(false); // has the scene been composited?
    });
}

export const down = (knex:Knex) => {}