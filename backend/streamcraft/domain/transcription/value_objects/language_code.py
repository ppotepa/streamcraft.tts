"""Language code value object."""

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class LanguageCode:
    """ISO 639-1 language code."""

    code: str

    def __post_init__(self) -> None:
        """Validate language code."""
        if len(self.code) != 2:
            raise ValueError("Language code must be 2 characters (ISO 639-1)")
        if not self.code.isalpha():
            raise ValueError("Language code must contain only letters")

    @classmethod
    def english(cls) -> "LanguageCode":
        """Create English language code."""
        return cls(code="en")

    @classmethod
    def spanish(cls) -> "LanguageCode":
        """Create Spanish language code."""
        return cls(code="es")

    @classmethod
    def french(cls) -> "LanguageCode":
        """Create French language code."""
        return cls(code="fr")

    @classmethod
    def german(cls) -> "LanguageCode":
        """Create German language code."""
        return cls(code="de")
