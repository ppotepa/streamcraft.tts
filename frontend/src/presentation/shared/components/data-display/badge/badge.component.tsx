/**
 * Badge component.
 */

import React from 'react';
import { BadgeProps, BadgeVariant, BadgeSize } from './badge.props';

const variantStyles: Record<BadgeVariant, string> = {
    [BadgeVariant.Default]: 'bg-slate-200 text-slate-800',
    [BadgeVariant.Primary]: 'bg-blue-500 text-white',
    [BadgeVariant.Success]: 'bg-green-500 text-white',
    [BadgeVariant.Warning]: 'bg-yellow-500 text-black',
    [BadgeVariant.Error]: 'bg-red-500 text-white',
    [BadgeVariant.Info]: 'bg-cyan-500 text-white',
};

const sizeStyles: Record<BadgeSize, string> = {
    [BadgeSize.Small]: 'px-2 py-0.5 text-xs',
    [BadgeSize.Medium]: 'px-3 py-1 text-sm',
    [BadgeSize.Large]: 'px-4 py-1.5 text-base',
};

export const Badge: React.FC<BadgeProps> = ({
    children,
    variant = BadgeVariant.Default,
    size = BadgeSize.Medium,
    className = '',
    onClick,
}) => {
    const baseStyles = 'inline-flex items-center rounded-full font-medium';
    const variantClass = variantStyles[variant];
    const sizeClass = sizeStyles[size];
    const interactiveClass = onClick ? 'cursor-pointer hover:opacity-80' : '';

    return (
        <span
            className={`${baseStyles} ${variantClass} ${sizeClass} ${interactiveClass} ${className}`}
            onClick={onClick}
        >
            {children}
        </span>
    );
};
