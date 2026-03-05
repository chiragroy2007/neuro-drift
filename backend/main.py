from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
import logging

from . import models, schemas
from .database import engine, get_db
from .compute import (
    compute_basic_stats, 
    compute_ex_gauss, 
    compute_wm_decay, 
    compute_pvt_metrics, 
    calculate_ndi,
    compute_post_error_slowing,
    calculate_cusum,
    check_integrity
)

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="BioDrift API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "BioDrift Backend Running"}

@app.post("/users/", response_model=schemas.UserResponse)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = models.User(name=user.name)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@app.post("/ingest/", response_model=schemas.SessionResponse)
def ingest_session_data(session_data: schemas.SessionCreate, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == session_data.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    session_count = db.query(models.Session).filter(models.Session.user_id == user.id).count()
    session_number = session_count + 1

    db_session = models.Session(user_id=user.id, session_number=session_number)
    db.add(db_session)
    db.commit()
    db.refresh(db_session)


    trials_to_insert = []
    for t in session_data.trials:
        db_trial = models.RawTrial(
            session_id=db_session.id,
            task_name=t.task_name,
            trial_number=t.trial_number,
            stimulus_onset=t.stimulus_onset,
            keypress_timestamp=t.keypress_timestamp,
            reaction_time=t.reaction_time,
            correctness=t.correctness,
            stimulus_type=t.stimulus_type
        )
        trials_to_insert.append(db_trial)
    
    db.bulk_save_objects(trials_to_insert)
    db.commit()

    logger.info(f"Ingesting session {session_number} for user {user.id} with {len(session_data.trials)} trials")

    # --- Compute Derived Metrics ---
    rts = [t.reaction_time for t in session_data.trials]
    expected_responses = [1 if t.stimulus_type == "go" or t.task_name != "go_nogo" else 0 for t in session_data.trials]
    correct = [t.correctness for t in session_data.trials]

    stats = compute_basic_stats(rts, correct, expected_responses)
    ex_gauss = compute_ex_gauss(rts)
    pes = compute_post_error_slowing(rts, correct)

    wm_trials = [t for t in session_data.trials if t.task_name == "1_back"]
    wm_decay = compute_wm_decay([t.trial_number for t in wm_trials], [t.reaction_time for t in wm_trials]) if wm_trials else {"slope": None, "r2": None}

    pvt_trials = [t for t in session_data.trials if t.task_name == "pvt"]
    pvt_metrics = compute_pvt_metrics([t.reaction_time for t in pvt_trials]) if pvt_trials else {"lapses": None, "slowest_10_mean": None, "skewness": None}

    # Integrity Check
    is_valid = 1 if check_integrity(stats["cv_rt"], rts) else 0
    if not is_valid:
        logger.warning(f"Session {session_number} marked INVALID. It will not be used for metrics.")
    else:
        logger.info(f"Session {session_number} statistics computed safely.")

    derived = models.DerivedMetrics(
        session_id=db_session.id,
        mean_rt=stats["mean_rt"],
        sd_rt=stats["sd_rt"],
        cv_rt=stats["cv_rt"],
        omission_rate=stats["omission_rate"],
        commission_rate=stats["commission_rate"],
        wm_decay_slope=wm_decay["slope"],
        pvt_lapses=pvt_metrics["lapses"],
        ex_gauss_mu=ex_gauss.get("mu"),
        ex_gauss_sigma=ex_gauss.get("sigma"),
        ex_gauss_tau=ex_gauss.get("tau"),
        pes=pes,
        is_valid=is_valid
    )

    # --- Baseline & NDI Calculation ---
    prev_valid_sessions = db.query(models.Session).join(models.DerivedMetrics).filter(
        models.Session.user_id == user.id, 
        models.DerivedMetrics.is_valid == 1
    ).order_by(models.Session.session_number.asc()).all()
    
    # Establish Baseline if 3 valid sessions
    if not user.baseline_established and len(prev_valid_sessions) >= 3:
        user.baseline_established = 1
        db.commit()

    if user.baseline_established == 1 and is_valid == 1:
        # History for normalization is first 3 valid sessions
        baseline_history = db.query(models.DerivedMetrics).join(models.Session).filter(
            models.Session.user_id == user.id, 
            models.DerivedMetrics.is_valid == 1
        ).order_by(models.Session.session_number.asc()).limit(3).all()
        
        def safe_z(val, history_list):
            valid_hist = [h for h in history_list if h is not None]
            if not valid_hist or val is None: return None
            mean = np.mean(valid_hist)
            sd = np.std(valid_hist)
            
            # Robustness against zero-variance baselines
            if sd < 1e-5:
                if abs(val - mean) < 1e-5:
                    return 0.0
                return 5.0 if val > mean else -5.0
                
            raw_z = (val - mean) / sd
            # Cap Z-scores tightly to prevent algorithmic drift explosion
            return float(np.clip(raw_z, -5.0, 5.0))

        z_cv = safe_z(stats["cv_rt"], [m.cv_rt for m in baseline_history])
        z_comm = safe_z(stats["commission_rate"], [m.commission_rate for m in baseline_history])
        z_wm = safe_z(wm_decay["slope"], [m.wm_decay_slope for m in baseline_history])
        z_pes = safe_z(pes, [m.pes for m in baseline_history])
        
        # Invert PES Z-score if required: PES is theoretically *good* if high (more cautious after error)
        # However, standard drift assumes PES decreases with fatigue. Thus lower PES -> worse. 
        # Z = (Current - Base) / SD. If Current < Base, Z is negative.
        # But for NDI, High Z = BAD. So we invert Z_PES: (Base - Current)/SD.
        # But safe_z does (Current - Base). So we multiply by -1.
        z_pes = -z_pes if z_pes is not None else None
        
        z_lapse = safe_z(pvt_metrics["lapses"], [m.pvt_lapses for m in baseline_history])

        z_scores = {
            "cv_rt": z_cv,
            "commission": z_comm,
            "wm_slope": z_wm,
            "pes": z_pes,
            "lapses": z_lapse
        }

        ndi = calculate_ndi(z_scores)
        derived.ndi = ndi
        derived.ndi_zscore = ndi # As ndi is already composite z-score
        
        # CUSUM Calculation
        last_metric = db.query(models.DerivedMetrics).join(models.Session).filter(
            models.Session.user_id == user.id,
            models.DerivedMetrics.is_valid == 1
        ).order_by(models.Session.session_number.desc()).limit(2).all()
        
        # last_metric[0] is the current session (not yet saved), last_metric[0] if exists in DB is the previous
        prev_cusum = last_metric[0].cusum if last_metric else 0.0
        current_cusum = calculate_cusum(ndi, prev_cusum)
        derived.cusum = current_cusum
        
        if current_cusum > 3.0 or ndi > 2.0:
            derived.status = "Significant Drift"
        elif current_cusum > 1.5 or ndi > 1.0:
            derived.status = "Mild Drift"
        else:
            derived.status = "Stable"
    else:
        if not is_valid:
            derived.status = "Invalid Session (Filtered)"
        else:
            derived.status = "Establishing Baseline"

    db.add(derived)
    db.commit()

    return db_session

@app.get("/users/{user_id}/dashboard")
def get_user_dashboard(user_id: str, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    sessions = db.query(models.Session).filter(models.Session.user_id == user_id).order_by(models.Session.session_number.asc()).all()
    
    chart_data = []
    current_status = "Stable"
    latest_score = None
    latest_valid_session = None
    
    for s in sessions:
        dm = db.query(models.DerivedMetrics).filter(models.DerivedMetrics.session_id == s.id).first()
        if dm and dm.is_valid == 1:
            score = 100 - (dm.ndi * 10) if dm.ndi is not None else None
            chart_data.append({
                "session": f"S{s.session_number}",
                "ndi": dm.ndi if dm.ndi is not None else 0,
                "score": score,
                "status": dm.status
            })
            if dm.status != "Invalid Session (Filtered)":
                current_status = dm.status
            if score is not None:
                latest_score = score
            latest_valid_session = dm
            
    calc_details = None
    baseline_history = db.query(models.DerivedMetrics).join(models.Session).filter(
        models.Session.user_id == user.id, 
        models.DerivedMetrics.is_valid == 1
    ).order_by(models.Session.session_number.asc()).limit(3).all()

    if len(baseline_history) >= 3 and latest_valid_session:
        import os
        from .compute import MIN_RT, MAX_RT
        def get_stats(history_list):
            valid_hist = [h for h in history_list if h is not None]
            if not valid_hist: return 0.0, 0.0
            return float(np.mean(valid_hist)), float(np.std(valid_hist))
            
        cv_mean, cv_sd = get_stats([m.cv_rt for m in baseline_history])
        comm_mean, comm_sd = get_stats([m.commission_rate for m in baseline_history])
        wm_mean, wm_sd = get_stats([m.wm_decay_slope for m in baseline_history])
        pes_mean, pes_sd = get_stats([m.pes for m in baseline_history])
        lapse_mean, lapse_sd = get_stats([m.pvt_lapses for m in baseline_history])
        
        def safe_z(val, mean, sd):
            if val is None: return None
            if sd < 1e-5:
                if abs(val - mean) < 1e-5: return 0.0
                return 5.0 if val > mean else -5.0
            return float(np.clip((val - mean) / sd, -5.0, 5.0))
            
        z_cv = safe_z(latest_valid_session.cv_rt, cv_mean, cv_sd)
        z_comm = safe_z(latest_valid_session.commission_rate, comm_mean, comm_sd)
        z_wm = safe_z(latest_valid_session.wm_decay_slope, wm_mean, wm_sd)
        z_pes = safe_z(latest_valid_session.pes, pes_mean, pes_sd)
        z_pes = -z_pes if z_pes is not None else None
        z_lapse = safe_z(latest_valid_session.pvt_lapses, lapse_mean, lapse_sd)
        
        calc_details = {
            "metrics": {
                "cv_rt": latest_valid_session.cv_rt,
                "commission_rate": latest_valid_session.commission_rate,
                "wm_slope": latest_valid_session.wm_decay_slope,
                "pes": latest_valid_session.pes,
                "pvt_lapses": latest_valid_session.pvt_lapses
            },
            "baselines": {
                "cv_mean": cv_mean, "cv_sd": cv_sd,
                "comm_mean": comm_mean, "comm_sd": comm_sd,
                "wm_mean": wm_mean, "wm_sd": wm_sd,
                "pes_mean": pes_mean, "pes_sd": pes_sd,
                "lapse_mean": lapse_mean, "lapse_sd": lapse_sd
            },
            "z_scores": {
                "cv_rt": z_cv,
                "commission": z_comm,
                "wm_slope": z_wm,
                "pes": z_pes,
                "lapses": z_lapse
            },
            "weights": {
                "cv_rt": float(os.getenv("WEIGHT_CV", 0.25)),
                "commission": float(os.getenv("WEIGHT_INHIB", 0.20)),
                "wm_slope": float(os.getenv("WEIGHT_WM", 0.20)),
                "pes": float(os.getenv("WEIGHT_PES", 0.15)),
                "lapses": float(os.getenv("WEIGHT_VIG", 0.10))
            },
            "ndi": latest_valid_session.ndi,
            "final_score": latest_score
        }
            
    return {
        "status": current_status,
        "latest_score": latest_score,
        "chart_data": chart_data,
        "calc_details": calc_details
    }

@app.get("/health-report/generate")
def generate_health_report(week_type: str):
    reports = {
        "happy": {
            "profile": "Optimal & Rested",
            "sleepDuration": "8h 15m",
            "sleepQuality": "Excellent",
            "caffeineIntake": "150mg (Normal)",
            "hrv": "65 ms (Optimal)",
            "restingHR": "58 bpm (Healthy)",
            "healthPenalty": -5,
            "interpretation": "Your biometric markers indicate high resilience and excellent recovery. Combined with your cognitive metrics, your burnout risk is phenomenally low."
        },
        "robust": {
            "profile": "Hectic Labs / High Workload",
            "sleepDuration": "6h 30m",
            "sleepQuality": "Fair",
            "caffeineIntake": "350mg (Elevated)",
            "hrv": "45 ms (Normal-Low)",
            "restingHR": "70 bpm (Slightly Elevated)",
            "healthPenalty": 5,
            "interpretation": "You are maintaining cognitive performance through sheer effort, but your physiological markers show early signs of strain. Monitor your sleep debt closely to avoid a drop in NDI."
        },
        "stressful": {
            "profile": "High Stress / Sleep Deprived",
            "sleepDuration": "4h 15m",
            "sleepQuality": "Poor (Frequent Waking)",
            "caffeineIntake": "450mg (High)",
            "hrv": "22 ms (Low)",
            "restingHR": "82 bpm (Elevated)",
            "healthPenalty": 15,
            "interpretation": "Your cognitive stability (NDI) has remained relatively controlled, but your biometric wearable data indicates severe physiological strain. The combination of elevated resting heart rate, suppressed HRV, and critically low sleep strongly predicts an impending crash in executive function."
        },
        "caffeine": {
            "profile": "Caffeine Overload",
            "sleepDuration": "5h 30m",
            "sleepQuality": "Restless",
            "caffeineIntake": "650mg (Extreme)",
            "hrv": "30 ms (Low)",
            "restingHR": "88 bpm (High)",
            "healthPenalty": 12,
            "interpretation": "Extreme caffeine consumption is artificially preserving your reaction times, but it is disrupting your sleep architecture and cardiovascular recovery. NDI scores may plummet suddenly when caffeine wears off."
        },
        "sick": {
            "profile": "Sick & Recovering",
            "sleepDuration": "9h 45m",
            "sleepQuality": "Poor (Feverish)",
            "caffeineIntake": "0mg (None)",
            "hrv": "25 ms (Low)",
            "restingHR": "78 bpm (Elevated)",
            "healthPenalty": 10,
            "interpretation": "Your body is fighting an infection. Even if your baseline cognitive output looks stable momentarily, your physiological resources are depleted, creating a hidden risk for task-switching errors."
        },
        "vacation": {
            "profile": "Vacation / Unplugged",
            "sleepDuration": "8h 45m",
            "sleepQuality": "Deep & Uninterrupted",
            "caffeineIntake": "50mg (Low)",
            "hrv": "75 ms (Optimal)",
            "restingHR": "52 bpm (Athletic)",
            "healthPenalty": -10,
            "interpretation": "Maximum recovery achieved. Your physiological metrics indicate peak readiness and virtually zero burnout risk. You are completely cognitively and physically restored."
        }
    }
    
    return reports.get(week_type, reports["stressful"])
