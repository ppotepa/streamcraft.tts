/**
 * Platform badge component.
 */

import React from 'react';
import { Platform, getDisplayName } from '../../../../../domain/vod/value-objects/platform';
import { Badge } from '../../../../shared/components/data-display/badge/badge.component';
import { BadgeVariant } from '../../../../shared/components/data-display/badge/badge.props';
import { PlatformBadgeProps } from './platform-badge.props';

const getPlatformVariant = (platform: Platform): BadgeVariant => {
    switch (platform) {
        case Platform.Twitch:
            return BadgeVariant.Primary;
        case Platform.YouTube:
            return BadgeVariant.Error;
    }
};

export const PlatformBadge: React.FC<PlatformBadgeProps> = ({
    platform,
    className,
}) => {
    return (
        <Badge variant={getPlatformVariant(platform)} className={className}>
            {getDisplayName(platform)}
        </Badge>
    );
};
