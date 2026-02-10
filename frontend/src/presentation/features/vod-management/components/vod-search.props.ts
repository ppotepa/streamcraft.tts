/**
 * VOD Search component props
 */

export interface VodSearchProps {
    readonly onSearch: (vodUrl: string) => void;
    readonly isLoading?: boolean;
    readonly placeholder?: string;
    readonly value?: string;
    readonly onChange?: (vodUrl: string) => void;
    readonly showButton?: boolean;
    readonly showPlatformHints?: boolean;
}
