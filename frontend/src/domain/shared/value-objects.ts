/**
 * Common value objects used across domains.
 *
 * Value objects are immutable, validated data structures that represent concepts
 * without identity. They are compared by value, not by reference.
 */

export class Duration {
    private constructor(readonly seconds: number) {
        if (seconds < 0) {
            throw new Error('Duration cannot be negative');
        }
    }

    static fromSeconds(seconds: number): Duration {
        return new Duration(seconds);
    }

    static fromMilliseconds(milliseconds: number): Duration {
        return new Duration(milliseconds / 1000);
    }

    static fromMinutes(minutes: number): Duration {
        return new Duration(minutes * 60);
    }

    toMilliseconds(): number {
        return this.seconds * 1000;
    }

    toMinutes(): number {
        return this.seconds / 60;
    }

    equals(other: Duration): boolean {
        return this.seconds === other.seconds;
    }
}

export class Timestamp {
    private constructor(readonly value: Date) { }

    static now(): Timestamp {
        return new Timestamp(new Date());
    }

    static fromIso(iso: string): Timestamp {
        return new Timestamp(new Date(iso));
    }

    static fromDate(date: Date): Timestamp {
        return new Timestamp(new Date(date));
    }

    toIso(): string {
        return this.value.toISOString();
    }

    equals(other: Timestamp): boolean {
        return this.value.getTime() === other.value.getTime();
    }
}

export class FilePath {
    private constructor(readonly path: string) {
        if (!path) {
            throw new Error('File path cannot be empty');
        }
        if (path.includes('..')) {
            throw new Error("File path cannot contain '..'");
        }
    }

    static create(path: string): FilePath {
        return new FilePath(path);
    }

    get extension(): string {
        const parts = this.path.split('.');
        return parts.length > 1 ? parts[parts.length - 1] ?? '' : '';
    }

    get name(): string {
        const fileName = this.path.split('/').pop() ?? '';
        const parts = fileName.split('.');
        return parts.length > 1 ? parts.slice(0, -1).join('.') : fileName;
    }

    equals(other: FilePath): boolean {
        return this.path === other.path;
    }
}

export class AudioQuality {
    private constructor(
        readonly sampleRate: number,
        readonly bitDepth: number,
        readonly channels: number
    ) {
        if (sampleRate <= 0) {
            throw new Error('Sample rate must be positive');
        }
        if (![8, 16, 24, 32].includes(bitDepth)) {
            throw new Error('Bit depth must be 8, 16, 24, or 32');
        }
        if (channels <= 0) {
            throw new Error('Channels must be positive');
        }
    }

    static create(
        sampleRate: number,
        bitDepth: number,
        channels: number
    ): AudioQuality {
        return new AudioQuality(sampleRate, bitDepth, channels);
    }

    static readonly QUALITY_16K_MONO = new AudioQuality(16000, 16, 1);
    static readonly QUALITY_48K_STEREO = new AudioQuality(48000, 16, 2);

    equals(other: AudioQuality): boolean {
        return (
            this.sampleRate === other.sampleRate &&
            this.bitDepth === other.bitDepth &&
            this.channels === other.channels
        );
    }
}
