/**
 * List jobs use case - Command
 */

export interface ListJobsCommand {
    readonly limit?: number;
    readonly offset: number;
}
