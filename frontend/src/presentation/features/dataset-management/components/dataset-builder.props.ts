/**
 * Dataset Builder component props
 */

import { DatasetEntry } from './dataset-entry-table.props';

export interface DatasetBuilderProps {
    readonly entries: readonly DatasetEntry[];
    readonly onAddEntry: (entry: DatasetEntry) => void;
    readonly onRemoveEntry: (index: number) => void;
    readonly onCreateDataset: (name: string) => void;
    readonly isCreating?: boolean;
}
