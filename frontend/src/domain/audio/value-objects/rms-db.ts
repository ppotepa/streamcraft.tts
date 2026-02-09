/**
 * RMS dB value object.
 */

export class RmsDb {
    private constructor(public readonly value: number) {
        if (value > 0) {
            throw new Error('RMS dB cannot be positive');
        }
        if (value < -120) {
            throw new Error('RMS dB cannot be below -120dB (essentially silence)');
        }
    }

    static create(value: number): RmsDb {
        return new RmsDb(value);
    }

    static fromLinear(linearValue: number): RmsDb {
        if (linearValue <= 0) {
            return new RmsDb(-120.0);
        }
        const dbValue = 20 * Math.log10(linearValue);
        return new RmsDb(dbValue);
    }

    isSilence(thresholdDb: number = -60.0): boolean {
        return this.value < thresholdDb;
    }

    isClipping(thresholdDb: number = -0.5): boolean {
        return this.value > thresholdDb;
    }

    equals(other: RmsDb): boolean {
        return Math.abs(this.value - other.value) < 0.01;
    }
}
