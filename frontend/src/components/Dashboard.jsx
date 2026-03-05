import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { getDashboard, generateHealthReportData } from '../api';
import 'katex/dist/katex.min.css';
import { BlockMath, InlineMath } from 'react-katex';

function Dashboard({ userId }) {
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showHealthReport, setShowHealthReport] = useState(false);
    const [healthData, setHealthData] = useState(null);
    const [showWeekModal, setShowWeekModal] = useState(false);

    useEffect(() => {
        if (!userId) {
            navigate('/');
            return;
        }

        const fetchData = async () => {
            try {
                const result = await getDashboard(userId);
                setData(result);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [userId, navigate]);

    if (loading) return <div style={{ marginTop: '20vh' }}>Loading Longitudinal Data...</div>;

    if (!data || data.chart_data.length === 0) {
        return (
            <div style={{ marginTop: '20vh' }}>
                <p>No session data available yet.</p>
                <button onClick={() => navigate('/')} style={{ marginTop: '2rem' }}>Back to Home</button>
            </div>
        );
    }

    const isEstablishing = data.status === "Establishing Baseline";

    const fetchHealthReport = async (weekType) => {
        try {
            const result = await generateHealthReportData(weekType);
            setHealthData(result);
            setShowWeekModal(false);
            setShowHealthReport(true);
        } catch (err) {
            console.error(err);
            alert("Failed to generate health report.");
        }
    };

    if (showHealthReport && healthData) {
        // Adjusted score combining cognitive base score and health penalty
        const cognitiveScore = data.latest_score !== null ? data.latest_score : 100;
        const healthPenalty = healthData.healthPenalty || 0;
        const combinedScoreNum = (cognitiveScore - healthPenalty);
        const combinedScore = combinedScoreNum.toFixed(1);

        let riskText = "HIGH BURN-OUT RISK";
        let riskColor = "#d9534f"; // Red

        if (combinedScoreNum >= 95) {
            riskText = "OPTIMAL READINESS";
            riskColor = "#5cb85c"; // Green
        } else if (combinedScoreNum >= 85) {
            riskText = "MAINTAINING / MODERATE RISK";
            riskColor = "#f0ad4e"; // Orange
        }

        return (
            <div style={{ maxWidth: '800px', margin: '10vh auto 0', textAlign: 'left' }}>
                <h2 style={{ fontSize: '2rem', fontWeight: 600, marginBottom: '1rem' }}>Comprehensive Health & Cognitive Report</h2>
                <div style={{ padding: '15px', background: '#fff3cd', color: '#856404', borderRadius: '4px', marginBottom: '2rem', fontSize: '0.95rem' }}>
                    <strong>Demo Profile Loaded:</strong> This report simulates integrating your actual cognitive data with wearable biometric data for a "{healthData.profile}" week.
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '3rem' }}>
                    <div style={{ padding: '2rem', border: '1px solid #eee', borderRadius: '4px', background: '#fafafa' }}>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '1.5rem', borderBottom: '2px solid #ddd', paddingBottom: '0.5rem' }}>Biometrics (Last 7 Days)</h3>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                            <span style={{ color: '#666' }}>Avg. Sleep Duration</span>
                            <span style={{ fontWeight: 500, color: '#111' }}>{healthData.sleepDuration}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                            <span style={{ color: '#666' }}>Sleep Quality</span>
                            <span style={{ fontWeight: 500, color: '#111' }}>{healthData.sleepQuality}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                            <span style={{ color: '#666' }}>Daily Caffeine</span>
                            <span style={{ fontWeight: 500, color: '#111' }}>{healthData.caffeineIntake}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                            <span style={{ color: '#666' }}>Heart Rate Var. (HRV)</span>
                            <span style={{ fontWeight: 500, color: '#111' }}>{healthData.hrv}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                            <span style={{ color: '#666' }}>Resting Heart Rate</span>
                            <span style={{ fontWeight: 500, color: '#111' }}>{healthData.restingHR}</span>
                        </div>
                    </div>

                    <div style={{ padding: '2rem', border: '1px solid #111', borderRadius: '4px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '1rem', textTransform: 'uppercase' }}>Combined Risk Prediction</div>
                        <div style={{ fontSize: '4rem', fontWeight: 300, lineHeight: 1, color: riskColor }}>
                            {combinedScore}
                        </div>
                        <div style={{ fontSize: '1rem', fontWeight: 500, marginTop: '1rem', color: riskColor }}>
                            {riskText}
                        </div>
                        <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '1.5rem', lineHeight: 1.5 }}>
                            Cognitive Base: {cognitiveScore.toFixed(1)}<br />
                            Biometric Adjustment: {healthPenalty > 0 ? '-' : '+'}{Math.abs(healthPenalty)}<br />
                        </p>
                    </div>
                </div>

                <div style={{ padding: '2rem', background: '#fafafa', border: '1px solid #eaeaea', borderRadius: '4px', marginBottom: '4rem' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>Clinical Interpretation</h3>
                    <p style={{ color: '#444', lineHeight: 1.6, fontSize: '0.95rem' }}>
                        {healthData.interpretation}
                    </p>
                </div>

                <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
                    <button onClick={() => setShowHealthReport(false)} style={{ background: '#fff', color: '#111', border: '1px solid #111', marginRight: '1rem' }}>Back to Dashboard</button>
                    <button onClick={() => navigate('/')}>Return Home</button>
                </div>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: '800px', margin: '10vh auto 0', textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '1px solid #eee', paddingBottom: '1rem', marginBottom: '3rem' }}>
                <h2 style={{ fontSize: '2rem', fontWeight: 600, margin: 0 }}>Cognitive Stability</h2>
                <div style={{ fontSize: '1.2rem', fontWeight: 500, color: data.status === 'Stable' ? '#111' : (data.status === 'Significant Drift' ? '#ff3333' : '#666') }}>
                    {data.status.toUpperCase()}
                </div>
            </div>

            <div style={{ display: 'flex', gap: '4rem', marginBottom: '4rem' }}>
                <div>
                    <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.5rem' }}>CURRENT SCORE</div>
                    <div style={{ fontSize: '3rem', fontWeight: 300, leading: 1 }}>
                        {isEstablishing ? '--' : (data.latest_score !== null ? data.latest_score.toFixed(1) : '--')}
                    </div>
                </div>
                <div>
                    <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.5rem' }}>TOTAL SESSIONS</div>
                    <div style={{ fontSize: '3rem', fontWeight: 300, leading: 1 }}>
                        {data.chart_data.length}
                    </div>
                </div>
            </div>

            {data.chart_data.length > 0 && !isEstablishing && (
                <div style={{ width: '100%', height: '300px', marginTop: '2rem' }}>
                    <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '1rem' }}>LONGITUDINAL TREND (SCORE)</div>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data.chart_data}>
                            <XAxis dataKey="session" stroke="#999" tick={{ fill: '#666', fontSize: 12 }} />
                            <YAxis domain={['auto', 'auto']} stroke="#999" tick={{ fill: '#666', fontSize: 12 }} />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#fff', border: '1px solid #111', borderRadius: 0 }}
                                itemStyle={{ color: '#111' }}
                            />
                            <Line type="monotone" dataKey="score" stroke="#111" strokeWidth={2} dot={{ r: 4, fill: '#111' }} activeDot={{ r: 6 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            )}

            {isEstablishing && (
                <div style={{ marginTop: '2rem', color: '#666', fontStyle: 'italic' }}>
                    {data.chart_data.length >= 3
                        ? "Initial baseline data collected. Your next session will lock the baseline and generate your first Cognitive Stability Score."
                        : `Complete ${Math.max(0, 3 - data.chart_data.length)} more session(s) to establish your personal cognitive baseline.`
                    }
                </div>
            )}

            {!isEstablishing && data.calc_details && (
                <div style={{ marginTop: '4rem', padding: '2rem', background: '#fafafa', border: '1px solid #eaeaea', borderRadius: '4px' }}>
                    <h3 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', fontWeight: 600 }}>Algorithm Breakdown (Latest Session)</h3>

                    <div style={{ marginBottom: '2rem' }}>
                        <h4 style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.5rem', textTransform: 'uppercase' }}>1. Formula (Neural Drift Index)</h4>
                        <BlockMath math="\text{NDI} = \frac{\sum_{i=1}^{n} (Z_i \times W_i)}{\sum_{i=1}^{n} W_i}" />
                        <p style={{ fontSize: '0.9rem', color: '#555', marginTop: '0.5rem' }}>
                            Where <InlineMath math="Z_i = \max(-5, \min(5, \frac{X_{current} - \mu_{baseline}}{\sigma_{baseline}}))" />
                        </p>
                    </div>

                    <div style={{ marginBottom: '2rem' }}>
                        <h4 style={{ fontSize: '0.9rem', color: '#666', marginBottom: '1rem', textTransform: 'uppercase' }}>2. Component Z-Scores</h4>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid #ddd', textAlign: 'left' }}>
                                    <th style={{ padding: '8px' }}>Metric</th>
                                    <th style={{ padding: '8px' }}>Current</th>
                                    <th style={{ padding: '8px' }}>Base μ</th>
                                    <th style={{ padding: '8px' }}>Base σ</th>
                                    <th style={{ padding: '8px' }}>Weight</th>
                                    <th style={{ padding: '8px' }}>Z-Score</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr style={{ borderBottom: '1px solid #eee' }}>
                                    <td style={{ padding: '8px' }}>CV of RT</td>
                                    <td style={{ padding: '8px' }}>{data.calc_details.metrics.cv_rt?.toFixed(3) || 'N/A'}</td>
                                    <td style={{ padding: '8px' }}>{data.calc_details.baselines.cv_mean?.toFixed(3) || '0'}</td>
                                    <td style={{ padding: '8px' }}>{data.calc_details.baselines.cv_sd?.toFixed(3) || '0'}</td>
                                    <td style={{ padding: '8px' }}>{data.calc_details.weights.cv_rt}</td>
                                    <td style={{ padding: '8px' }}>{data.calc_details.z_scores.cv_rt?.toFixed(2) || '0'}</td>
                                </tr>
                                <tr style={{ borderBottom: '1px solid #eee' }}>
                                    <td style={{ padding: '8px' }}>Commission Rate</td>
                                    <td style={{ padding: '8px' }}>{data.calc_details.metrics.commission_rate?.toFixed(3) || 'N/A'}</td>
                                    <td style={{ padding: '8px' }}>{data.calc_details.baselines.comm_mean?.toFixed(3) || '0'}</td>
                                    <td style={{ padding: '8px' }}>{data.calc_details.baselines.comm_sd?.toFixed(3) || '0'}</td>
                                    <td style={{ padding: '8px' }}>{data.calc_details.weights.commission}</td>
                                    <td style={{ padding: '8px' }}>{data.calc_details.z_scores.commission?.toFixed(2) || '0'}</td>
                                </tr>
                                <tr style={{ borderBottom: '1px solid #eee' }}>
                                    <td style={{ padding: '8px' }}>WM Decay Slope</td>
                                    <td style={{ padding: '8px' }}>{data.calc_details.metrics.wm_slope?.toFixed(3) || 'N/A'}</td>
                                    <td style={{ padding: '8px' }}>{data.calc_details.baselines.wm_mean?.toFixed(3) || '0'}</td>
                                    <td style={{ padding: '8px' }}>{data.calc_details.baselines.wm_sd?.toFixed(3) || '0'}</td>
                                    <td style={{ padding: '8px' }}>{data.calc_details.weights.wm_slope}</td>
                                    <td style={{ padding: '8px' }}>{data.calc_details.z_scores.wm_slope?.toFixed(2) || '0'}</td>
                                </tr>
                                <tr style={{ borderBottom: '1px solid #eee' }}>
                                    <td style={{ padding: '8px' }}>PES Difference</td>
                                    <td style={{ padding: '8px' }}>{data.calc_details.metrics.pes?.toFixed(1) || 'N/A'} ms</td>
                                    <td style={{ padding: '8px' }}>{data.calc_details.baselines.pes_mean?.toFixed(1) || '0'}</td>
                                    <td style={{ padding: '8px' }}>{data.calc_details.baselines.pes_sd?.toFixed(1) || '0'}</td>
                                    <td style={{ padding: '8px' }}>{data.calc_details.weights.pes}</td>
                                    <td style={{ padding: '8px' }}>{data.calc_details.z_scores.pes?.toFixed(2) || '0'}</td>
                                </tr>
                                <tr>
                                    <td style={{ padding: '8px' }}>PVT Lapses</td>
                                    <td style={{ padding: '8px' }}>{data.calc_details.metrics.pvt_lapses || 0}</td>
                                    <td style={{ padding: '8px' }}>{data.calc_details.baselines.lapse_mean?.toFixed(1) || '0'}</td>
                                    <td style={{ padding: '8px' }}>{data.calc_details.baselines.lapse_sd?.toFixed(1) || '0'}</td>
                                    <td style={{ padding: '8px' }}>{data.calc_details.weights.lapses}</td>
                                    <td style={{ padding: '8px' }}>{data.calc_details.z_scores.lapses?.toFixed(2) || '0'}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div>
                        <h4 style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.5rem', textTransform: 'uppercase' }}>3. Final Aggregation</h4>
                        <BlockMath math={`\\text{Raw NDI} = ${data.calc_details.ndi?.toFixed(3) || '0'}`} />
                        <BlockMath math={`\\text{Base Score} = 100 - (\\text{NDI} \\times 10) = ${data.calc_details.final_score?.toFixed(1) || '0'}`} />
                    </div>
                </div>
            )}

            <div style={{ marginTop: '4rem', textAlign: 'center', display: 'flex', justifyContent: 'center', gap: '1rem' }}>
                {!isEstablishing && <button onClick={() => setShowWeekModal(true)} style={{ background: '#111', color: '#fff', border: '1px solid #111' }}>Get Health Report</button>}
                <button onClick={() => navigate('/')} style={{ background: '#fff', color: '#111', border: '1px solid #111' }}>Return Home</button>
            </div>

            {showWeekModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255, 255, 255, 0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ background: '#fff', border: '1px solid #eaeaea', padding: '3rem', width: '600px', boxShadow: '0 10px 40px rgba(0,0,0,0.05)', borderRadius: '4px' }}>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1rem', textAlign: 'center' }}>Demo Profile Selection</h2>
                        <p style={{ textAlign: 'center', color: '#666', marginBottom: '2rem', fontSize: '0.95rem' }}>
                            Select the type of "week" this user experienced. The model will dynamically pull simulated biometric data (sleep, heart rate, caffeine intake) and fuse it with the cognitive baseline.
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <button onClick={() => fetchHealthReport('happy')} style={{ background: '#fafafa', color: '#333', border: '1px solid #ddd', padding: '1rem', textAlign: 'left' }}>
                                <strong>Optimal & Rested</strong><br /><span style={{ fontSize: '0.8rem', color: '#888' }}>Perfect sleep, low stress, low risk.</span>
                            </button>
                            <button onClick={() => fetchHealthReport('robust')} style={{ background: '#fafafa', color: '#333', border: '1px solid #ddd', padding: '1rem', textAlign: 'left' }}>
                                <strong>Hectic Labs / High Workload</strong><br /><span style={{ fontSize: '0.8rem', color: '#888' }}>Maintaining effort, mild strain.</span>
                            </button>
                            <button onClick={() => fetchHealthReport('stressful')} style={{ background: '#fafafa', color: '#333', border: '1px solid #ddd', padding: '1rem', textAlign: 'left' }}>
                                <strong>High Stress & Sleep Deprived</strong><br /><span style={{ fontSize: '0.8rem', color: '#888' }}>Severe physiological burnout warning.</span>
                            </button>
                            <button onClick={() => fetchHealthReport('caffeine')} style={{ background: '#fafafa', color: '#333', border: '1px solid #ddd', padding: '1rem', textAlign: 'left' }}>
                                <strong>Caffeine Overload</strong><br /><span style={{ fontSize: '0.8rem', color: '#888' }}>High stimulation masking exhaustion.</span>
                            </button>
                            <button onClick={() => fetchHealthReport('sick')} style={{ background: '#fafafa', color: '#333', border: '1px solid #ddd', padding: '1rem', textAlign: 'left' }}>
                                <strong>Sick & Recovering</strong><br /><span style={{ fontSize: '0.8rem', color: '#888' }}>Low resources, immune strain.</span>
                            </button>
                            <button onClick={() => fetchHealthReport('vacation')} style={{ background: '#fafafa', color: '#333', border: '1px solid #ddd', padding: '1rem', textAlign: 'left' }}>
                                <strong>Vacation / Unplugged</strong><br /><span style={{ fontSize: '0.8rem', color: '#888' }}>Deep physiological recovery.</span>
                            </button>
                        </div>
                        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                            <button onClick={() => setShowWeekModal(false)} style={{ background: 'transparent', color: '#999', padding: '0.5rem 1rem' }}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Dashboard;
