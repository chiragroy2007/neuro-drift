import axios from 'axios';

const API_URL = 'http://localhost:8000';

export const createUser = async (name) => {
    const res = await axios.post(`${API_URL}/users/`, { name });
    return res.data;
};

export const submitSession = async (userId, trials) => {
    const res = await axios.post(`${API_URL}/ingest/`, {
        user_id: userId,
        trials: trials
    });
    return res.data;
};

export const getDashboard = async (userId) => {
    const res = await axios.get(`${API_URL}/users/${userId}/dashboard`);
    return res.data;
};

export const generateHealthReportData = async (weekType) => {
    const res = await axios.get(`${API_URL}/health-report/generate?week_type=${weekType}`);
    return res.data;
};
