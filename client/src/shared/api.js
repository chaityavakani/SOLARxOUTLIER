import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1',
  withCredentials: true,
});

export function errorText(error) {
  const payload = error?.response?.data?.error;
  if (payload?.details?.fields) {
    const fields = Object.values(payload.details.fields).flat();
    if (fields.length) return fields.join(' ');
  }
  return payload?.message || error?.response?.data?.message || 'Something went wrong. Please try again.';
}
