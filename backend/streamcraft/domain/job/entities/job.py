"""Job entity - aggregate root for job management."""

from dataclasses import dataclass, field
from typing import Sequence

from streamcraft.domain.job.errors.job_errors import InvalidJobTransitionError
from streamcraft.domain.job.value_objects.job_status import (
    DoneStatus,
    ErrorStatus,
    IdleStatus,
    JobStatus,
    RunningStatus,
    create_done,
    create_error,
    create_idle,
    create_running,
)
from streamcraft.domain.job.value_objects.step_name import StepName
from streamcraft.domain.shared.branded_types import JobId, VodId
from streamcraft.domain.shared.result import Failure, Result, Success
from streamcraft.domain.shared.value_objects import Timestamp


@dataclass(frozen=True, slots=True)
class JobStep:
    """Individual step in a job."""

    name: StepName
    status: JobStatus
    started_at: Timestamp | None = None
    completed_at: Timestamp | None = None
    log_messages: Sequence[str] = field(default_factory=tuple)


@dataclass(frozen=True)
class Job:
    """Job aggregate root."""

    id: JobId
    vod_id: VodId
    vod_url: str
    status: JobStatus
    steps: Sequence[JobStep]
    created_at: Timestamp
    updated_at: Timestamp

    def start_step(self, step_name: StepName) -> Result["Job", InvalidJobTransitionError]:
        """Start a specific step."""
        # Can only start steps if job is idle or running
        if isinstance(self.status, ErrorStatus):
            return Failure(
                InvalidJobTransitionError(
                    current_state="error", attempted_transition=f"start {step_name}"
                )
            )

        # Find the step and update it
        updated_steps = list(self.steps)
        for i, step in enumerate(updated_steps):
            if step.name == step_name:
                updated_steps[i] = JobStep(
                    name=step.name,
                    status=create_running(current_step=step_name.value, progress=0.0),
                    started_at=Timestamp.now(),
                    completed_at=None,
                    log_messages=step.log_messages,
                )
                break

        return Success(
            Job(
                id=self.id,
                vod_id=self.vod_id,
                vod_url=self.vod_url,
                status=create_running(current_step=step_name.value, progress=0.0),
                steps=tuple(updated_steps),
                created_at=self.created_at,
                updated_at=Timestamp.now(),
            )
        )

    def complete_step(
        self, step_name: StepName, exit_code: int
    ) -> Result["Job", InvalidJobTransitionError]:
        """Complete a specific step."""
        if not isinstance(self.status, RunningStatus):
            return Failure(
                InvalidJobTransitionError(
                    current_state=str(self.status.kind), attempted_transition="complete step"
                )
            )

        # Update the step
        updated_steps = list(self.steps)
        for i, step in enumerate(updated_steps):
            if step.name == step_name:
                updated_steps[i] = JobStep(
                    name=step.name,
                    status=create_done(exit_code=exit_code),
                    started_at=step.started_at,
                    completed_at=Timestamp.now(),
                    log_messages=step.log_messages,
                )
                break

        # Check if all steps are done
        all_done = all(isinstance(s.status, DoneStatus) for s in updated_steps)
        new_status: JobStatus = create_done(exit_code=0) if all_done else self.status

        return Success(
            Job(
                id=self.id,
                vod_id=self.vod_id,
                vod_url=self.vod_url,
                status=new_status,
                steps=tuple(updated_steps),
                created_at=self.created_at,
                updated_at=Timestamp.now(),
            )
        )

    def fail(self, message: str, exit_code: int) -> "Job":
        """Mark job as failed."""
        return Job(
            id=self.id,
            vod_id=self.vod_id,
            vod_url=self.vod_url,
            status=create_error(message=message, exit_code=exit_code),
            steps=self.steps,
            created_at=self.created_at,
            updated_at=Timestamp.now(),
        )


def create_job(job_id: JobId, vod_id: VodId, vod_url: str) -> Job:
    """Factory function to create a new job."""
    now = Timestamp.now()

    # Create default steps
    steps = tuple(
        JobStep(name=step_name, status=create_idle(), log_messages=tuple())
        for step_name in StepName
    )

    return Job(
        id=job_id,
        vod_id=vod_id,
        vod_url=vod_url,
        status=create_idle(),
        steps=steps,
        created_at=now,
        updated_at=now,
    )
