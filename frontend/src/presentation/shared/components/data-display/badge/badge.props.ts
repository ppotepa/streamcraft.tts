/**
 * Badge component properties.
 */

import { ReactNode } from 'react';

export enum BadgeVariant {
    Default = 'default',
    Primary = 'primary',
    Success = 'success',
    Warning = 'warning',
    Error = 'error',
    Info = 'info',
}

export enum BadgeSize {
    Small = 'small',
    Medium = 'medium',
    Large = 'large',
}

export interface BadgeProps {
    readonly children: ReactNode;
    readonly variant?: BadgeVariant;
    readonly size?: BadgeSize;
    readonly className?: string;
    readonly onClick?: () => void;
}
