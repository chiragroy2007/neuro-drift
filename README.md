# NeuroDrift

<div align="center">
  <h3>Quantifiable Cognitive Stability & Neural Drift Trajectory Modeling</h3>
  <p>A high-fidelity temporal monitoring platform engineered to map intra-individual variability, post-error slowing, and executive function decay through millisecond-accurate psychomotor task batteries.</p>
</div>

---

## The Concept & Scientific Rationale

**NeuroDrift** is built upon the premise that subjective feelings of fatigue and burnout do not correlate perfectly with objective cognitive deterioration. In high-stakes environments—such as surgical theaters, aviation, long-haul transportation, and rigorous academic research—individuals often unknowingly enter states of "cognitive drift," where executive function, working memory, and response inhibition begin to fray before catastrophic task failure occurs.

Instead of relying on self-reported questionnaires, NeuroDrift administers a strict, 4-5 minute, millisecond-accurate psychomotor battery. By capturing microscopic fluctuations within response times (down to the <150ms anticipatory phase and the >500ms psychomotor vigilance lapses), we construct a high-dimensional tensor representing a user's *active cognitive baseline*. 

### Why Temporal Fidelity Matters
Human response time is not simply a Gaussian distribution. It is statistically described by an **Ex-Gaussian distribution** (a convolution of normal and exponential components). As fatigue accumulates, the "tail" of this distribution—represented by the exponential coefficient $\\tau$ (tau)—lengthens drastically. This means a fatigued user might maintain a normal *average* reaction time, but their variance sky-rockets, indicating fleeting attentional lapses. NeuroDrift captures this invisible decay.

---

## Core System Architecture & The "Neural Drift Index" (NDI)

NeuroDrift is designed around a strictly functional, minimalist paradigm to eliminate visual distraction, utilizing a React frontend bound tightly to `performance.now()` loops, and a rigorous Python computational backend.

### The Algorithm Breakdown
Once a user completes a testing block, data is not merely averaged. It is fed into statistical models to extract key psychological markers:
1. **Coefficient of Variation (CV of RT):** Intra-individual variability. As the central nervous system fatigues, maintaining stable RTs becomes metabolically harder.
2. **Post-Error Slowing (PES):** A measure of the brain's error-monitoring network (Anterior Cingulate Cortex). Fatigued individuals often fail to slow down after making an error, indicating compromised top-down behavioral regulation.
3. **Inhibitory Commission Rate:** The failure to stop a pre-planned motor action (tested via Go/No-Go). Maps directly to frontal lobe exhaustion.
4. **Working Memory Decay Slope:** Using Ordinary Least Squares (OLS) regression over continuous 1-back trials, this measures how rapidly cognitive load saturates.
5. **PVT Micro-Lapses:** Absolute counts of RTs >500ms.

These metrics are synthesized, weighted natively, and normalized against the user's historical rolling baseline using $Z$-score logic (clipped at $\\pm5\\sigma$ to prevent arithmetic explosions) to produce the **Neural Drift Index (NDI)**.

---

## Technical Coding & Implementation

NeuroDrift uses a highly separated architecture:

- **Frontend Engine (React + Vite):** 
  - Utilitarian, strict-white theme. No CSS animations, no visual noise.
  - Custom React Engine iterating state based purely on timestamp deltas rather than relying on inconsistent `setTimeout` calls.
  - Integrates `react-katex` to dynamically render the $Z$-score breakdown formulas in mathematical notation.

- **Backend Aggregator (FastAPI / Python):**
  - **Dependencies:** `scipy`, `numpy`, `statsmodels`. We explicitly utilize Maximum Likelihood Estimation (MLE) to fit the Ex-Gaussian parameters and run tests of goodness-of-fit (KS Tests) to validate incoming session data.
  - **Database:** Standardized SQLite relational design caching thousands of individual keypress intervals cleanly apart from derived Z-score aggregations.
  - **CUSUM (Cumulative Sum Control Chart):** We implement manufacturing-grade change-detection algorithms ($S_t = \\max(0, S_{t-1} + (Z_t - k))$) to identify statistically significant cognitive shifts across multiple weeks.

---

## Physiological Workspace Integration (The Health Module)

A purely cognitive platform is incomplete without intersecting with physiological states. The NeuroDrift **Health Integration Protocol** demonstrates how objective neural efficiency scores map onto wearable sensor data.

### Fusing Cognitive and Biometric Data
By ingesting data points such as:
- **Heart Rate Variability (HRV):** The balance of the autonomic nervous system.
- **Sleep Architecture (Quality & Duration):** Ensuring sufficient REM for memory consolidation.
- **Resting Heart Rate (RHR) & Basal Temperature:** Tracking immunological strain.
- **Pharmacological Load (Caffeine mg):** Adjusting baseline models based on nervous system stimulants.

NeuroDrift generates a **Combined Risk Prediction**. For example, a user exhibiting stable NDI metrics but displaying fundamentally crushed HRV and 600mg of caffeine intake is scientifically predicted to experience a catastrophic cliff-edge cognitive drop within 24 hours. The platform detects this masking effect and alerts the user *before* the crash.

---

## Future Scopes & Theoretical Expansions

To transition this from a clinical research tool into a ubiquitous global protocol, we intend to implement the following expansions:

1. **Continuous Real-Time Integration**
   - Evolving from a weekly 5-minute task into a background service that passively monitors typing cadence, cursor jitter, and interaction decay times during normal operating hours to extrapolate an "Invisible NDI."
2. **Chronotype Auto-Adjustment**
   - Everyone has a specific Circadian Phase (Morning Larks vs. Night Owls). The models should stretch baseline algorithms to excuse "lapses" that occur during an individual's known circadian trough.
3. **Machine Learning Predictive Modeling**
   - Replacing static weight vectors ($W_i$) with personalized Random Forest classifiers or LSTMs to identify the unique leading indicators of burnout for specific demographics.
4. **Hardware Haptic Feedback**
   - Interfacing NeuroDrift with smart-watches to provide subtle haptic vibrations when a user in a high-risk operational environment unconsciously begins exceeding their optimal variance thresholds.
