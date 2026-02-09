/**
 * Platform badge component props.
 */

import { Platform } from '../../../../../domain/vod/value-objects/platform';

export interface PlatformBadgeProps {
    readonly platform: Platform;
    readonly className?: string;
}
