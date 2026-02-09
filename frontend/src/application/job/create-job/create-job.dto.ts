/**
 * Create job DTO.
 */

export interface CreateJobDto {
    readonly jobId: string;
    readonly vodId: string;
    readonly vodUrl: string;
    readonly status: string;
    readonly createdAt: string;
}
