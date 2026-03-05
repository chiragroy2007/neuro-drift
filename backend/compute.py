import numpy as np
import scipy.stats as stats
import statsmodels.api as sm
from typing import List, Dict, Tuple
import os
import math

import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# CONSTANTS
MIN_RT = 150.0  # ms
MAX_RT = 3000.0 # ms
SD_FILTER = 3.0
MIN_VALID_TRIALS_OVERALL = 15 # Reduced for frontend demo (20 trials total)
MIN_VALID_TRIALS_SWITCH = 20
PVT_LAPSE_THRESHOLD = 500.0

def filter_rts(rts: List[float]) -> List[float]:
    """Applies anticipatory, extreme, and ±3 SD filtering."""
    valid = [rt for rt in rts if rt is not None and MIN_RT <= rt <= MAX_RT]
    if not valid:
        return []
    
    mean = np.mean(valid)
    std = np.std(valid)
    if std == 0:
        return valid
        
    filtered = [rt for rt in valid if abs(rt - mean) <= SD_FILTER * std]
    return filtered

def compute_basic_stats(rts: List[float], correct: List[int], expected_responses: List[int]) -> Dict:
    filtered_rts = filter_rts(rts)
    
    # Needs to check overall validity later, returning raw values
    if len(filtered_rts) > 0:
        mean_rt = float(np.mean(filtered_rts))
        sd_rt = float(np.std(filtered_rts))
        cv_rt = float(sd_rt / mean_rt) if mean_rt > 0 else 0.0
    else:
        mean_rt, sd_rt, cv_rt = None, None, None

    omissions = sum(1 for e, c in zip(expected_responses, correct) if e == 1 and c == 0)
    commissions = sum(1 for e, c in zip(expected_responses, correct) if e == 0 and c == 0)

    total_go = sum(expected_responses)
    total_nogo = len(expected_responses) - total_go

    o_rate = omissions / total_go if total_go > 0 else 0.0
    c_rate = commissions / total_nogo if total_nogo > 0 else 0.0

    return {
        "mean_rt": mean_rt,
        "sd_rt": sd_rt,
        "cv_rt": cv_rt,
        "omission_rate": o_rate,
        "commission_rate": c_rate,
        "valid_rt_count": len(filtered_rts)
    }

def compute_ex_gauss(rts: List[float]) -> Dict:
    filtered_rts = filter_rts(rts)
    if len(filtered_rts) < 20: # Need reasonable N for MLE Ex-Gaussian
        return {"mu": None, "sigma": None, "tau": None}
    
    # Maximum Likelihood Estimation via scipy
    # stats.exponnorm parameters: K (shape), loc (mu), scale (sigma)
    # where K = tau / sigma, so tau = K * scale
    try:
        K, loc, scale = stats.exponnorm.fit(filtered_rts)
        
        # Simple goodness of fit check (KS Test)
        d_stat, p_val = stats.kstest(filtered_rts, 'exponnorm', args=(K, loc, scale))
        
        # Only return tau if fit is somewhat acceptable (p > 0.01) to avoid garbage noise
        if p_val > 0.01:
            return {"mu": loc, "sigma": scale, "tau": K * scale}
        else:
            return {"mu": None, "sigma": None, "tau": None}
    except Exception:
        return {"mu": None, "sigma": None, "tau": None}

def compute_post_error_slowing(rts: List[float], correct: List[int]) -> float:
    # Post-Error Slowing: Mean RT correct trials immediately following error 
    # MINUS Mean RT correct trials immediately preceding error
    pre_error_rts = []
    post_error_rts = []
    
    for i in range(1, len(correct) - 1):
        if correct[i] == 0: # found error
            # Check if previous was correct and has valid RT
            if correct[i-1] == 1 and rts[i-1] is not None and MIN_RT <= rts[i-1] <= MAX_RT:
                pre_error_rts.append(rts[i-1])
            # Check if next was correct and has valid RT
            if correct[i+1] == 1 and rts[i+1] is not None and MIN_RT <= rts[i+1] <= MAX_RT:
                post_error_rts.append(rts[i+1])
                
    if not pre_error_rts or not post_error_rts:
        return None
        
    return float(np.mean(post_error_rts) - np.mean(pre_error_rts))

def compute_wm_decay(trial_numbers: List[int], rts: List[float]) -> Dict:
    # Filter RTs but keep associated trial number
    valid = []
    for num, rt in zip(trial_numbers, rts):
        if rt is not None and MIN_RT <= rt <= MAX_RT:
            valid.append((num, rt))
            
    if len(valid) < 5:
        return {"slope": None, "r2": None}
        
    # Extract cleaned X and Y
    rt_vals = [v[1] for v in valid]
    mean = np.mean(rt_vals)
    std = np.std(rt_vals)
    
    final_valid = [v for v in valid if abs(v[1] - mean) <= SD_FILTER * std]
    if len(final_valid) < 5:
        return {"slope": None, "r2": None}
        
    X = [v[0] for v in final_valid]
    Y = [v[1] for v in final_valid]
    
    X_sm = sm.add_constant(X)
    model = sm.OLS(Y, X_sm)
    results = model.fit()
    
    return {
        "slope": float(results.params[1]),
        "r2": float(results.rsquared)
    }

def compute_pvt_metrics(rts: List[float]) -> Dict:
    filtered_rts = filter_rts(rts)
    if not filtered_rts:
         return {"lapses": None, "slowest_10_mean": None, "skewness": None}
         
    # Raw RTs for lapses (including anticipatory/extreme potentially, but filtered is safer)
    # Lapses strictly defined as > 500ms
    lapses = sum(1 for rt in rts if rt is not None and rt > PVT_LAPSE_THRESHOLD)
    
    sorted_rts = sorted(filtered_rts)
    n_10_percent = max(1, int(len(sorted_rts) * 0.10))
    slowest_10 = sorted_rts[-n_10_percent:]
    slowest_10_mean = np.mean(slowest_10) if slowest_10 else None
    
    skewness = float(stats.skew(filtered_rts)) if len(filtered_rts) > 2 else None
    
    return {
        "lapses": lapses,
        "slowest_10_mean": float(slowest_10_mean) if slowest_10_mean else None,
        "skewness": skewness
    }

def calculate_ndi(z_scores: Dict[str, float]) -> float:
    # Neural Drift Index (NDI) - Composite weighted z-score
    weights = {
        "cv_rt": float(os.getenv("WEIGHT_CV", 0.25)),
        "commission": float(os.getenv("WEIGHT_INHIB", 0.20)),
        "wm_slope": float(os.getenv("WEIGHT_WM", 0.20)),
        "pes": float(os.getenv("WEIGHT_PES", 0.15)),
        "lapses": float(os.getenv("WEIGHT_VIG", 0.10))
    }
    
    # Renormalize weights if data is missing
    total_active_weight = 0.0
    ndi_sum = 0.0
    
    for key, z_val in z_scores.items():
        if z_val is not None and not math.isnan(z_val):
            weight = weights.get(key, 0.0)
            total_active_weight += weight
            ndi_sum += z_val * weight
            
    if total_active_weight == 0:
        return 0.0
        
    renormalized_ndi = ndi_sum / total_active_weight
    return float(renormalized_ndi)

def calculate_cusum(current_ndi_z: float, prev_cusum: float, k: float = 0.5) -> float:
    """CUSUM detection for positive drift (deterioration)"""
    # S_t = max(0, S_{t-1} + (Z_t - k))
    if current_ndi_z is None: return prev_cusum
    return max(0.0, prev_cusum + (current_ndi_z - k))


def check_integrity(cv_rt: float, all_rts: List[float]) -> bool:
    """Safeguards against robotic responses or impossible perfection."""
    if not all_rts: 
        logger.warning("Integrity Check Failed: No RTs provided.")
        return False
    
    if cv_rt is not None and cv_rt < 0.05:
        # Variance is suspiciously low (like an auto-clicker)
        logger.warning(f"Integrity Check Failed: Variance suspiciously low (cv_rt={cv_rt}).")
        return False
        
    filtered_rts = filter_rts(all_rts)
    if len(filtered_rts) < MIN_VALID_TRIALS_OVERALL:
        # Not enough valid data points overall
        logger.warning(f"Integrity Check Failed: Not enough valid trials ({len(filtered_rts)} < {MIN_VALID_TRIALS_OVERALL}).")
        return False
        
    logger.info("Integrity Check Passed.")
    return True
