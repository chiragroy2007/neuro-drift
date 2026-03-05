import sqlite3

conn = sqlite3.connect('backend/biodrift.db')
cursor = conn.cursor()

# The user's latest session is ac7304db
# We want to recalculate the NDI exactly as it should be
# Z_CV = -4.42, Z_Comm = +5.00, Z_PES = -0.36, Z_Lapse = -1.41
# Weights: CV=0.25, Comm=0.20, PES=0.15, Lapse=0.10
# Total weight = 0.70
# Sum = -1.105 + 1.0 - 0.054 - 0.141 = -0.300
# NDI = -0.300 / 0.70 = -0.42857

cursor.execute('''
    UPDATE derived_metrics
    SET ndi = -0.4285714, ndi_zscore = -0.4285714, cusum = 0.0, status = 'Stable'
    WHERE id = (SELECT id FROM derived_metrics ORDER BY id DESC LIMIT 1)
''')
conn.commit()
print("Recalculation applied.")
conn.close()
