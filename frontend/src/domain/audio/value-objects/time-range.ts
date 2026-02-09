/**
 * Time range value object.
 */

export class TimeRange {
    constructor(
        public readonly start: number,
        public readonly end: number
    ) {
        if (start < 0) {
            throw new Error('Start time cannot be negative');
        }
        if (end < 0) {
            throw new Error('End time cannot be negative');
        }
        if (start >= end) {
            throw new Error('Start time must be before end time');
        }
    }

    static create(start: number, end: number): TimeRange {
        return new TimeRange(start, end);
    }

    get duration(): number {
        return this.end - this.start;
    }

    contains(time: number): boolean {
        return time >= this.start && time <= this.end;
    }

    overlaps(other: TimeRange): boolean {
        return this.start < other.end && this.end > other.start;
    }

    equals(other: TimeRange): boolean {
        return this.start === other.start && this.end === other.end;
    }
}
