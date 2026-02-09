/**
 * VOD Search component props
 */

export interface VodSearchProps {
    readonly onSearch: (vodUrl: string) => void;
    readonly isLoading?: boolean;
    readonly placeholder?: string;
}
