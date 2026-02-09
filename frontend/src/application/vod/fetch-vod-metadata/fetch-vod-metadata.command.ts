/**
 * Fetch VOD metadata use case - Command
 */

import { VodId } from '../../../domain/vod/value-objects/vod-id';
import { Platform } from '../../../domain/vod/value-objects/platform';

export interface FetchVodMetadataCommand {
    readonly vodId: VodId;
    readonly platform: Platform;
}
