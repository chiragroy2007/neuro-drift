import numpy as np
from backend.compute import compute_basic_stats, compute_ex_gauss, compute_pvt_metrics, compute_wm_decay, compute_post_error_slowing

# Dummy data that mimics a very short session
rts = [200.0, 250.0, 300.0, 100.0, 3500.0, 250.0]  # Includes an anticipatory and extreme
correct = [1, 1, 0, 1, 0, 1]
expected = [1, 1, 1, 1, 1, 1]

try:
    print("Testing Basic Stats...")
    stats = compute_basic_stats(rts, correct, expected)
    print(stats)
except Exception as e:
    import traceback
    traceback.print_exc()

try:
    print("\nTesting Ex-Gauss...")
    gauss = compute_ex_gauss(rts)
    print(gauss)
except Exception as e:
    import traceback
    traceback.print_exc()

try:
    print("\nTesting PES...")
    pes = compute_post_error_slowing(rts, correct)
    print(pes)
except Exception as e:
    import traceback
    traceback.print_exc()

try:
    print("\nTesting WM Decay...")
    wm = compute_wm_decay([1, 2, 3, 4, 5, 6], rts)
    print(wm)
except Exception as e:
    import traceback
    traceback.print_exc()

try:    
    print("\nTesting PVT...")
    pvt = compute_pvt_metrics(rts)
    print(pvt)
except Exception as e:
    import traceback
    traceback.print_exc()
