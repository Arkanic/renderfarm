import {Knex} from "knex";

export const up = (schema:Knex.SchemaBuilder) => {
    return schema.alterTable("renderdata", table => {
        table.string("blendfile").notNullable().defaultTo("project.blend").comment("blender project file to render with");
    });
}

export const down = (knex:Knex) => {}