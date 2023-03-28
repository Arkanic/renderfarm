import {Knex} from "knex";

export const up = (schema:Knex.SchemaBuilder) => {
    return schema.alterTable("projects", table => {
        table.string("message").defaultTo(""); // server message about the render
    });
}