"""RMS dB value object."""

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class RmsDb:
    """RMS (Root Mean Square) in decibels."""

    value: float

    def __post_init__(self) -> None:
        """Validate RMS dB value."""
        if self.value > 0:
            raise ValueError("RMS dB cannot be positive")
        if self.value < -120:
            raise ValueError("RMS dB cannot be below -120dB (essentially silence)")

    @classmethod
    def from_linear(cls, linear_value: float) -> "RmsDb":
        """Create from linear scale value (0.0 to 1.0)."""
        import math
        if linear_value <= 0:
            return cls(value=-120.0)
        db_value = 20 * math.log10(linear_value)
        return cls(value=db_value)

    def is_silence(self, threshold_db: float = -60.0) -> bool:
        """Check if this represents silence."""
        return self.value < threshold_db

    def is_clipping(self, threshold_db: float = -0.5) -> bool:
        """Check if this represents clipping."""
        return self.value > threshold_db
