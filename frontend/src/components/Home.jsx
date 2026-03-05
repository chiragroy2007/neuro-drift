import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createUser } from '../api';

function Home({ userId, setUserId }) {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [name, setName] = useState('');

    const handleStart = async () => {
        if (!userId && !name.trim()) {
            alert("Please enter a name to create a profile.");
            return;
        }

        setLoading(true);
        if (!userId) {
            try {
                const user = await createUser(name.trim());
                setUserId(user.id);
            } catch (e) {
                console.error("Failed to create user", e);
                setLoading(false);
                return;
            }
        }
        navigate('/task');
    };

    return (
        <div style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'left', marginTop: '10vh' }}>
            <h1 style={{ fontWeight: 600, letterSpacing: '-0.02em', fontSize: '2.5rem', marginBottom: '1rem' }}>NeuroDrift</h1>
            <p style={{ fontSize: '1.1rem', color: '#444', lineHeight: 1.6, marginBottom: '2rem' }}>
                Strict-minimalist cognitive monitoring battery. The session takes approximately 4-5 minutes and measures core cognitive stability through high-fidelity temporal tasks.
            </p>
            <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '3rem' }}>
                Instructions will be provided before each block. Ensure you are in a quiet environment and ready to focus.
            </p>

            {!userId && (
                <div style={{ marginBottom: '2rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>
                        Participant Name / ID
                    </label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Enter name..."
                        style={{
                            padding: '10px',
                            border: '1px solid #ccc',
                            fontSize: '1rem',
                            width: '100%',
                            maxWidth: '300px',
                            boxSizing: 'border-box'
                        }}
                    />
                </div>
            )}

            <button
                onClick={handleStart}
                disabled={loading}
                style={{
                    backgroundColor: '#111',
                    color: '#fff',
                    padding: '12px 24px',
                    border: 'none',
                    fontSize: '1rem',
                    fontWeight: 500
                }}
            >
                {loading ? 'Initializing...' : (userId ? 'Start Weekly Session' : 'Create Profile & Start')}
            </button>

            {userId && (
                <button
                    onClick={() => navigate('/dashboard')}
                    style={{
                        marginLeft: '1rem',
                        backgroundColor: 'transparent',
                        color: '#111',
                        border: '1px solid #111',
                        padding: '11px 23px',
                        fontSize: '1rem'
                    }}
                >
                    View Dashboard
                </button>
            )}

            {userId && (
                <div style={{ marginTop: '4rem', fontSize: '0.8rem', color: '#999', borderTop: '1px solid #eee', paddingTop: '1rem' }}>
                    Subject ID: {userId}
                    <button
                        onClick={() => {
                            localStorage.removeItem('neurodrift_user_id');
                            setUserId(null);
                        }}
                        style={{ marginLeft: '10px', padding: '2px 8px', fontSize: '0.7rem', color: '#fff', backgroundColor: '#d9534f', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                    >
                        Reset Local Data
                    </button>
                </div>
            )}
        </div>
    );
}

export default Home;
