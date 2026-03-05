from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.orm import relationship
import datetime
import uuid
from .database import Base

def generate_uuid():
    return str(uuid.uuid4())

class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, index=True, default=generate_uuid)
    name = Column(String, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    baseline_established = Column(Integer, default=0) # 0 for false, 1 for true

    sessions = relationship("Session", back_populates="user")

class Session(Base):
    __tablename__ = "sessions"
    id = Column(String, primary_key=True, index=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"))
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    session_number = Column(Integer)
    
    user = relationship("User", back_populates="sessions")
    raw_trials = relationship("RawTrial", back_populates="session")
    derived_metrics = relationship("DerivedMetrics", back_populates="session", uselist=False)

class RawTrial(Base):
    __tablename__ = "raw_trials"
    id = Column(String, primary_key=True, index=True, default=generate_uuid)
    session_id = Column(String, ForeignKey("sessions.id"))
    task_name = Column(String, index=True) # go_nogo, 1_back, pvt, switch
    trial_number = Column(Integer)
    stimulus_onset = Column(Float)
    keypress_timestamp = Column(Float, nullable=True)
    reaction_time = Column(Float, nullable=True)
    correctness = Column(Integer) # 1 for correct, 0 for incorrect
    stimulus_type = Column(String, nullable=True)
    
    session = relationship("Session", back_populates="raw_trials")

class DerivedMetrics(Base):
    __tablename__ = "derived_metrics"
    id = Column(String, primary_key=True, index=True, default=generate_uuid)
    session_id = Column(String, ForeignKey("sessions.id"), unique=True)
    mean_rt = Column(Float, nullable=True)
    sd_rt = Column(Float, nullable=True)
    cv_rt = Column(Float, nullable=True)
    omission_rate = Column(Float, nullable=True)
    commission_rate = Column(Float, nullable=True)
    wm_decay_slope = Column(Float, nullable=True)
    pvt_lapses = Column(Integer, nullable=True)
    ex_gauss_mu = Column(Float, nullable=True)
    ex_gauss_sigma = Column(Float, nullable=True)
    ex_gauss_tau = Column(Float, nullable=True)
    pes = Column(Float, nullable=True) # Post Error Slowing
    switch_cost = Column(Float, nullable=True)
    ndi = Column(Float, nullable=True) # Neural Drift Index
    ndi_zscore = Column(Float, nullable=True)
    cusum = Column(Float, default=0.0) # Cumulative sum for change detection
    is_valid = Column(Integer, default=1) # 1 valid, 0 filtered by integrity check
    status = Column(String, default="Stable")

    session = relationship("Session", back_populates="derived_metrics")
