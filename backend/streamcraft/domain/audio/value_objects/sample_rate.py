"""Sample rate value object."""

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class SampleRate:
    """Audio sample rate in Hz."""

    hertz: int

    def __post_init__(self) -> None:
        """Validate sample rate."""
        if self.hertz <= 0:
            raise ValueError("Sample rate must be positive")
        if self.hertz > 192000:
            raise ValueError("Sample rate cannot exceed 192kHz")

    @classmethod
    def rate_16k(cls) -> "SampleRate":
        """Create 16kHz sample rate."""
        return cls(hertz=16000)

    @classmethod
    def rate_22k(cls) -> "SampleRate":
        """Create 22.05kHz sample rate."""
        return cls(hertz=22050)

    @classmethod
    def rate_44k(cls) -> "SampleRate":
        """Create 44.1kHz sample rate."""
        return cls(hertz=44100)

    @classmethod
    def rate_48k(cls) -> "SampleRate":
        """Create 48kHz sample rate."""
        return cls(hertz=48000)

    @property
    def kilohertz(self) -> float:
        """Get sample rate in kHz."""
        return self.hertz / 1000.0
