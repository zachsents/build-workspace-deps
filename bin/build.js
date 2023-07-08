import fs from "fs/promises"
import path from "path"
import { exec as execCallback } from "child_process"
import { promisify } from "util"
import chalk from "chalk"

const exec = promisify(execCallback)


/**
 * @typedef {Object} BuildOptions
 * 
 * @property {string} [localModulesDirectory="./local_modules"] The directory to store the local modules in.
 * @property {string} [workspaceIndicator="workspace:"] The string to look for in the dependencies to indicate that it is a local module.
 * @property {string} cwdFromModule The path from the module to the root of the project.
 * @property {string} [workspacesRoot="../"] The path to the root of the monorepo. This is where to search for the local modules.
 */


/**
 * Builds the local modules for deployment.
 *
 * @export
 * @param {BuildOptions} [options={}]
 */
export default async function build({
    localModulesDirectory = "./local_modules",
    workspaceIndicator = "workspace:",
    cwdFromModule,
    workspacesRoot = "../",
} = {}) {

    // check if we have an original package.json
    try {
        await fs.stat("./package_original.json")
        console.log(`${chalk.red("!!")} Found original package.json. Clean the directory before trying again.`)
        process.exit(1)
    }
    catch (err) {
        console.log()
    }

    // make local_modules folder
    try {
        await fs.mkdir(localModulesDirectory)
        console.log(chalk.gray("Created local_modules folder."))
    }
    catch (err) {
        console.log(`${chalk.yellow("!")} ${chalk.gray("local_modules exists. Continuing...")}`)
    }

    // read in dependencies
    const packageJson = JSON.parse(
        await fs.readFile("./package.json", "utf-8")
    )

    // find my local deps -- ones with "workspace:"
    const myDeps = Object.keys(packageJson.dependencies)
        .filter(packageName => packageJson.dependencies[packageName].includes(workspaceIndicator))

    console.log(`Preparing ${chalk.cyan(myDeps.length)} dependencies...`)

    // loop through each of my deps
    const resultMap = Object.fromEntries(await Promise.all(
        myDeps.map(async depName => {
            // find the folder for this dependency
            const depFolder = (await Promise.all(
                (await fs.readdir(workspacesRoot))
                    .map(async dirName => {
                        try {
                            const { name } = JSON.parse(await fs.readFile(
                                path.join(workspacesRoot, dirName, "package.json"),
                                "utf-8"
                            ))

                            return [dirName, name == depName]
                        }
                        catch (err) {
                            console.debug(chalk.gray(`Not a package. Skipping ${dirName}`))
                            return [dirName, false]
                        }
                    })
            )).find(([, isMatch]) => isMatch)?.[0]

            // if we didn't find a folder, error out
            if (!depFolder) {
                console.log(`${chalk.red("!!")} Could not find package folder for ${depName}.`)
                process.exit(1)
            }

            // pack this dependency
            const command = `pnpm pack --pack-destination "${path.join(cwdFromModule, localModulesDirectory)}"`
            const cwd = path.join(workspacesRoot, depFolder)
            console.log(`Packing ${chalk.cyan(depName)} from ${chalk.cyan(cwd)}`)
            const { stdout } = await exec(command, { cwd })

            // return entry of dep name -> packaged tarball location
            return [depName, "file:.\\" + path.join(localModulesDirectory, path.basename(stdout.trim()))]
        })
    ))

    console.log(chalk.green("Done packing."))

    // rename our old package.json to preserve it
    await fs.rename("./package.json", "./package_original.json")
    console.log(chalk.gray("Preserved original package.json as package_original.json."))

    // spread in our new dependencies
    packageJson.dependencies = {
        ...packageJson.dependencies,
        ...resultMap,
    }

    // write new package.json
    await fs.writeFile("./package.json", JSON.stringify(packageJson, null, 4))
    console.log(`${chalk.gray("Wrote out package.json.")} ${chalk.green("Ready for deployment!")}`)
}