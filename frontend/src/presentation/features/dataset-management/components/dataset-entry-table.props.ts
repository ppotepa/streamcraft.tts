/**
 * Dataset Entry Table component props
 */

export interface DatasetEntry {
    readonly audioPath: string;
    readonly text: string;
    readonly durationSeconds?: number;
}

export interface DatasetEntryTableProps {
    readonly entries: readonly DatasetEntry[];
    readonly onEntryClick?: (entry: DatasetEntry, index: number) => void;
    readonly onEntryDelete?: (index: number) => void;
}
