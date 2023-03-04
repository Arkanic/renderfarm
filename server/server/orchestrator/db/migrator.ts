// Helper functions for database migrator system

import path from "path";
import fs from "fs";
import {Version, parseVersion, compareVersions} from "./versions";

const baseMigrationPath = path.join("../../../server-build/orchestrator/db/migrations");

/**
 * Get a list of migrations that need to be applied to make the database up-to-date
 * 
 * @param version 
 * @returns Array of migrations
 */
export function getMigrations(version:string) {
    const migrationFiles = fs.readdirSync(baseMigrationPath);
    return migrationFiles.map(m => m.replace(".js", "")).filter(m => compareVersions(m, version)).sort((a, b) => compareVersions(a, b) ? 1 : -1);
}

/**
 * Correct migration name if it doesn't actually point to a javascript file
 * 
 * @param migration 
 * @returns migration-name.js
 */
export function getMigrationName(migration:string):string {
    return migration.indexOf(".js") >= 0 ? migration : `${migration}.js`;
}

/**
 * Import migration for calling
 * 
 * @param migration 
 * @returns 
 */
export async function getMigration(migration:string) {
    return await import(path.join(baseMigrationPath, getMigrationName(migration)));
}