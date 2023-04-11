const bcrypt = require("bcrypt");
const prompt = require("prompt-sync")({ sigint: true });

const saltRounds = 16;

let salt = bcrypt.genSaltSync(saltRounds);

const password = prompt("Input password: ");
const passwordCheck = prompt("Repeat password: ");

if(password !== passwordCheck) {
    console.error("Passwords are not the same!");
    exit(1);
}

let hash = bcrypt.hashSync(password, saltRounds);

console.log(hash);