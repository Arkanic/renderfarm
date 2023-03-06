/**
Why this?
Typescript compiles directly into JS, meaning that any artificial types are lost in the build process.
This means that there is no way to infer interfaces, or even have a direct concept of interfaces, at runtime,
as they are dropped as soon as the TS is compiled.

The server needs a way of checking that messages sent from the client *are* actually instances of an interface
at runtime, to prevent poisoned messages from the client. However, these interfaces do not actually exist in
the resultant JS code. I could just use JSONShema to test the incoming values by itself, but that would require
double-programming every input interface as a TS interface and a JSONSchema. Instead, we have this system.

At runtime, when an input needs to be checked by the `validateInput` function, the object file is loaded from src,
and the selected interface is extracted from the file. This is then converted to a JSONSchema, which is then compared
against the input.
*/

import * as tsj from "ts-json-schema-generator";
import {Validator} from "jsonschema";

export interface ValidatorContext {
    generator:tsj.SchemaGenerator,
    validator:Validator
}

export function createValidatorContext(policyPath:string):ValidatorContext {
    let tsjInputConfig = {
        path: policyPath,
        tsconfig: "tsconfig.json",
        type: "*"
    }

    const generator = tsj.createGenerator(tsjInputConfig);
    const validator = new Validator();

    return {
        generator,
        validator
    }
}

/**
 * Validate JSON socket input against an interface from `inputObject.ts`
 * 
 * @param json The object to be checked against
 * @param policy The name of the interface in `inputObject.ts` which is to be compared against
 * 
 * @returns Is the input valid?
 * 
 * @see protocol.ts - there is a rather insightful wall of text explaining why this is implemented
 */
export function validateClientInput(ctx:ValidatorContext, json:any, policy:string):boolean {
    const {generator, validator} = ctx;

    let schema = generator.createSchema(policy);
    let validatorResult = validator.validate(json, schema.definitions![policy] as any);

    return validatorResult.valid;
}