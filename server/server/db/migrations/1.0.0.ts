import {Knex} from "knex";

export const up = (schema:Knex.SchemaBuilder) => {
    return schema.createTable("projects", table => {
        table.increments("id").primary();
        table.bigInteger("created").unsigned();
        table.string("title", 128);
        table.boolean("finished").defaultTo(false);
        table.integer("renderdata_index").unsigned().comment("Id of render data in table")
    }).createTable("renderdata", table => {
        table.increments("id").primary();
        table.string("finished_chunks").defaultTo("[]").notNullable().comment("Stringified javascript array of chunks rendered"); // this isn't the best solution (large overhead), but there is no other way to make it frame-uncaring
        table.integer("cutinto").unsigned().notNullable();
        table.boolean("animation").notNullable();
        table.bigInteger("framestart").notNullable().comment("If the render is an still image rather than an animation, this represents the frame to be rendered.");
        table.bigInteger("frameend");
    });
}

export const down = (knex:Knex) => {}