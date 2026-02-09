/**
 * Transcript text value object.
 */

export class TranscriptText {
    private constructor(public readonly value: string) {
        if (!value.trim()) {
            throw new Error('Transcript text cannot be empty');
        }
    }

    static create(text: string): TranscriptText {
        const normalized = text.split(/\s+/).join(' ').trim();
        return new TranscriptText(normalized);
    }

    get wordCount(): number {
        return this.value.split(/\s+/).length;
    }

    get characterCount(): number {
        return this.value.length;
    }

    equals(other: TranscriptText): boolean {
        return this.value === other.value;
    }
}
