#!/usr/bin/env node
import clean from "./cleanup.js"
import build from "./build.js"
import yargs from "yargs"


yargs(process.argv.slice(2))
    .command("build", "Builds the local modules for deployment.", {
        localModulesDirectory: {
            type: "string",
            description: "The directory to store the local modules in.",
            alias: "l",
        },
        workspaceIndicator: {
            type: "string",
            description: "The string to look for in the dependencies to indicate that it is a local module.",
            alias: "w",
        },
        cwdFromModule: {
            type: "string",
            description: "The path from the module to the root of the project.",
            alias: "c",
        },
        workspacesRoot: {
            type: "string",
            description: "The path to the root of the monorepo. This is where to search for the local modules.",
            alias: "r",
        },
    }, build)
    .command("clean", "Cleans up the local modules after deployment.", {
        localModulesDirectory: {
            type: "string",
            description: "The directory the local modules are stored in.",
            alias: "l",
        },
    }, clean)
    .demandCommand()
    .help()
    .argv