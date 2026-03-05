from pydantic import BaseModel
from typing import List, Optional
import datetime

class RawTrialCreate(BaseModel):
    task_name: str
    trial_number: int
    stimulus_onset: float
    keypress_timestamp: Optional[float] = None
    reaction_time: Optional[float] = None
    correctness: int
    stimulus_type: Optional[str] = None

class SessionCreate(BaseModel):
    user_id: str
    trials: List[RawTrialCreate]

class UserCreate(BaseModel):
    name: str

class UserResponse(BaseModel):
    id: str
    name: str
    created_at: datetime.datetime
    baseline_established: int

    class Config:
        from_attributes = True

class SessionResponse(BaseModel):
    id: str
    user_id: str
    timestamp: datetime.datetime
    session_number: int

    class Config:
        from_attributes = True
