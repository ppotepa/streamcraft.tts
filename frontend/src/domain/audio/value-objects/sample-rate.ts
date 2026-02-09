/**
 * Sample rate value object.
 */

export class SampleRate {
    private constructor(public readonly hertz: number) {
        if (hertz <= 0) {
            throw new Error('Sample rate must be positive');
        }
        if (hertz > 192000) {
            throw new Error('Sample rate cannot exceed 192kHz');
        }
    }

    static create(hertz: number): SampleRate {
        return new SampleRate(hertz);
    }

    static rate16k(): SampleRate {
        return new SampleRate(16000);
    }

    static rate22k(): SampleRate {
        return new SampleRate(22050);
    }

    static rate44k(): SampleRate {
        return new SampleRate(44100);
    }

    static rate48k(): SampleRate {
        return new SampleRate(48000);
    }

    get kilohertz(): number {
        return this.hertz / 1000;
    }

    equals(other: SampleRate): boolean {
        return this.hertz === other.hertz;
    }
}
