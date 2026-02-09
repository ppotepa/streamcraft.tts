/**
 * Confidence score value object.
 */

export class ConfidenceScore {
    private constructor(public readonly value: number) {
        if (value < 0 || value > 1) {
            throw new Error('Confidence score must be between 0.0 and 1.0');
        }
    }

    static create(value: number): ConfidenceScore {
        return new ConfidenceScore(value);
    }

    static high(): ConfidenceScore {
        return new ConfidenceScore(0.9);
    }

    static medium(): ConfidenceScore {
        return new ConfidenceScore(0.7);
    }

    static low(): ConfidenceScore {
        return new ConfidenceScore(0.5);
    }

    isHigh(threshold: number = 0.8): boolean {
        return this.value >= threshold;
    }

    isLow(threshold: number = 0.6): boolean {
        return this.value < threshold;
    }

    equals(other: ConfidenceScore): boolean {
        return Math.abs(this.value - other.value) < 0.001;
    }
}
