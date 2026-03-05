import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { submitSession } from '../api';

const BLOCK_ORDER = ["go_nogo", "1_back", "pvt", "switch"];
const TRIALS_PER_BLOCK = 5;

const BLOCK_INSTRUCTIONS = {
    "go_nogo": {
        title: "Task 1: Go / No-Go",
        desc: "You will see a letter on the screen.\n\nPress SPACEBAR as quickly as possible if you see 'T'.\nDo NOTHING if you see 'O'."
    },
    "1_back": {
        title: "Task 2: 1-Back Memory",
        desc: "You will see a sequence of numbers.\n\nPress SPACEBAR ONLY if the current number matches the immediately previous number."
    },
    "pvt": {
        title: "Task 3: Vigilance (PVT)",
        desc: "Watch the screen carefully.\n\nPress SPACEBAR the instant the timer '00:00' appears. Respond as quickly as you can."
    },
    "switch": {
        title: "Task 4: Task Switching",
        desc: "You will see color words. For this simplified test:\n\nPress SPACEBAR for ANY word you see, as quickly as possible."
    }
};

const TASK_DISPLAY_NAMES = {
    "go_nogo": "Go / No-Go",
    "1_back": "1-Back Working Memory",
    "pvt": "Psychomotor Vigilance",
    "switch": "Task Switching"
};

function TaskEngine({ userId }) {
    const navigate = useNavigate();
    const [blockIndex, setBlockIndex] = useState(-1);
    const [trialIndex, setTrialIndex] = useState(0);
    const [state, setState] = useState('global_instructions');
    // States: global_instructions -> task_instructions -> fixation -> stimulus -> feedback -> uploading
    const [currentStimulus, setCurrentStimulus] = useState('');

    const trialsRef = useRef([]);
    const trialDataRef = useRef({});
    const timeoutRef = useRef(null);

    const currentBlock = blockIndex >= 0 ? BLOCK_ORDER[blockIndex] : null;

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === ' ' && state === 'stimulus') {
                const rt = performance.now() - trialDataRef.current.stimulus_onset;
                trialDataRef.current.keypress_timestamp = performance.now();
                trialDataRef.current.reaction_time = rt;

                let correct = 0;
                if (currentBlock === 'go_nogo') {
                    correct = trialDataRef.current.stimulus_type === 'go' ? 1 : 0;
                } else if (currentBlock === '1_back') {
                    correct = trialDataRef.current.stimulus_type === 'match' ? 1 : 0;
                } else if (currentBlock === 'pvt') {
                    correct = 1;
                } else if (currentBlock === 'switch') {
                    correct = 1;
                }

                trialDataRef.current.correctness = correct;

                clearTimeout(timeoutRef.current);
                endTrial();
            } else if (e.key === ' ' && state === 'global_instructions') {
                setBlockIndex(0);
                setTrialIndex(0);
                setState('task_instructions');
            } else if (e.key === ' ' && state === 'task_instructions') {
                startFixation();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [state, blockIndex, currentBlock]);

    const startTask = useCallback(async () => {
        setState('uploading');
        try {
            await submitSession(userId, trialsRef.current);
            navigate('/dashboard');
        } catch (err) {
            console.error(err);
            alert("Upload failed. Check backend.");
        }
    }, [userId, navigate]);

    const endTrial = useCallback(() => {
        if (trialDataRef.current.reaction_time === null) {
            if (currentBlock === 'go_nogo') {
                trialDataRef.current.correctness = trialDataRef.current.stimulus_type === 'nogo' ? 1 : 0;
            } else {
                trialDataRef.current.correctness = 0;
            }
        }

        trialsRef.current.push({ ...trialDataRef.current });

        if (trialIndex + 1 < TRIALS_PER_BLOCK) {
            setTrialIndex(prev => prev + 1);
            startFixation();
        } else {
            if (blockIndex + 1 < BLOCK_ORDER.length) {
                setBlockIndex(prev => prev + 1);
                setTrialIndex(0);
                setState('task_instructions');
            } else {
                startTask();
            }
        }
    }, [trialIndex, blockIndex, currentBlock, startTask]);

    const showStimulus = useCallback(() => {
        setState('stimulus');
        let stimText = '';
        let type = '';

        if (currentBlock === 'go_nogo') {
            const isGo = Math.random() > 0.3;
            stimText = isGo ? 'T' : 'O';
            type = isGo ? 'go' : 'nogo';
        } else if (currentBlock === '1_back') {
            const isMatch = Math.random() > 0.5 && trialIndex > 0;
            stimText = isMatch ? "7" : Math.floor(Math.random() * 9).toString();
            type = isMatch ? 'match' : 'non-match';
        } else if (currentBlock === 'pvt') {
            stimText = '00:00';
            type = 'go';
        } else if (currentBlock === 'switch') {
            stimText = Math.random() > 0.5 ? 'RED' : 'BLUE';
            type = 'go';
        }

        setCurrentStimulus(stimText);

        trialDataRef.current = {
            task_name: currentBlock,
            trial_number: trialIndex + 1,
            stimulus_onset: performance.now(),
            keypress_timestamp: null,
            reaction_time: null,
            correctness: null,
            stimulus_type: type
        };

        const max_wait = currentBlock === 'pvt' ? 2000 : 1500;
        timeoutRef.current = setTimeout(() => {
            endTrial();
        }, max_wait);
    }, [currentBlock, trialIndex, endTrial]);

    const startFixation = useCallback(() => {
        setState('fixation');
        const isi = currentBlock === 'pvt' ? 1000 + Math.random() * 2000 : 500 + Math.random() * 500;
        setTimeout(() => showStimulus(), isi);
    }, [currentBlock, showStimulus]);

    if (state === 'uploading') {
        return <div style={{ fontSize: '1.2rem', marginTop: '20vh', textAlign: 'center' }}>Synchronizing temporal data...</div>;
    }

    if (state === 'global_instructions') {
        return (
            <div style={{ marginTop: '20vh', maxWidth: '600px', margin: '20vh auto 0', textAlign: 'center' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 500, marginBottom: '2rem' }}>Battery Initialized</h2>
                <p style={{ color: '#444', lineHeight: 1.6 }}>
                    This battery contains 4 very short modules. You will be given specific instructions before each module begins.
                </p>
                <div style={{ padding: '20px', border: '1px solid #eee', marginTop: '2rem', textAlign: 'left', backgroundColor: '#fafafa' }}>
                    <p style={{ fontSize: '0.9rem', color: '#666', margin: 0 }}><strong>General Rule:</strong> Keep your finger resting lightly on the SPACEBAR at all times.</p>
                </div>
                <p style={{ marginTop: '3rem', fontWeight: 600, fontSize: '0.9rem' }}>PRESS SPACEBAR TO PROCEED</p>
            </div>
        );
    }

    if (state === 'task_instructions') {
        const inst = BLOCK_INSTRUCTIONS[currentBlock];
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', textAlign: 'center' }}>
                <h2 style={{ fontSize: '2rem', fontWeight: 600, marginBottom: '2rem' }}>{inst.title}</h2>
                <p style={{ color: '#111', fontSize: '1.2rem', lineHeight: 1.8, maxWidth: '500px', whiteSpace: 'pre-line' }}>
                    {inst.desc}
                </p>
                <div style={{ marginTop: '4rem', fontWeight: 600, fontSize: '1rem', color: '#666' }}>
                    PRESS SPACEBAR TO START THIS TASK
                </div>
            </div>
        );
    }

    return (
        <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '2rem', left: '2rem', fontSize: '0.9rem', color: '#999', fontWeight: 500 }}>
                {TASK_DISPLAY_NAMES[currentBlock]}
            </div>
            <div style={{ position: 'absolute', top: '2rem', right: '2rem', fontSize: '0.9rem', color: '#999' }}>
                Trial {trialIndex + 1} / {TRIALS_PER_BLOCK}
            </div>

            {state === 'fixation' && <div style={{ fontSize: '4rem', fontWeight: 300 }}>+</div>}
            {state === 'stimulus' && <div style={{ fontSize: '5rem', fontWeight: 600 }}>{currentStimulus}</div>}
        </div>
    );
}

export default TaskEngine;
