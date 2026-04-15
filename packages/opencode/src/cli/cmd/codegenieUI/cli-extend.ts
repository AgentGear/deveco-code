import type { Argv } from "yargs"

export function extend(cli: Argv<{ "print-logs": boolean | undefined } & { "log-level": string | undefined }>) {
    return cli
        .middleware(async (opts) => {
            process.env.CODEGENIE = "1"
        })
}