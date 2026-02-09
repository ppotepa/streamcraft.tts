/**
 * Language code value object.
 */

export class LanguageCode {
    private constructor(public readonly code: string) {
        if (code.length !== 2) {
            throw new Error('Language code must be 2 characters (ISO 639-1)');
        }
        if (!/^[a-z]{2}$/i.test(code)) {
            throw new Error('Language code must contain only letters');
        }
    }

    static create(code: string): LanguageCode {
        return new LanguageCode(code.toLowerCase());
    }

    static english(): LanguageCode {
        return new LanguageCode('en');
    }

    static spanish(): LanguageCode {
        return new LanguageCode('es');
    }

    static french(): LanguageCode {
        return new LanguageCode('fr');
    }

    static german(): LanguageCode {
        return new LanguageCode('de');
    }

    equals(other: LanguageCode): boolean {
        return this.code === other.code;
    }
}
