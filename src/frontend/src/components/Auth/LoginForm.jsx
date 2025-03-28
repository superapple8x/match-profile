import React, { useState } from 'react';

function LoginForm({ onLoginSuccess, onSwitchToRegister }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); // Clear previous errors
     if (!username || !password) {
        setError('Username and password are required.');
        return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Use message from backend if available, otherwise construct one
        throw new Error(data.message || `Login failed. Status: ${response.status}`);
      }

      console.log('Login successful, token:', data.token);
      // Store the token (e.g., in localStorage or context)
      localStorage.setItem('authToken', data.token); // Example: using localStorage

      // Call the success handler passed via props
      if (onLoginSuccess) {
        onLoginSuccess(data.token); // Pass token up
      }

    } catch (err) {
      console.error('Login error:', err);
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

   // Basic form styling (can be enhanced with Tailwind)
  const inputStyle = "w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white";
  const buttonStyle = `w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${isLoading ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'} dark:focus:ring-offset-gray-800`;
  const labelStyle = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";


  return (
    <div className="max-w-md mx-auto mt-8 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-6">Login</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-red-500 text-sm text-center">{error}</p>}
        <div>
          <label htmlFor="login-username" className={labelStyle}>Username</label>
          <input
            type="text"
            id="login-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className={inputStyle}
            disabled={isLoading}
          />
        </div>
        <div>
          <label htmlFor="login-password" className={labelStyle}>Password</label>
          <input
            type="password"
            id="login-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className={inputStyle}
            disabled={isLoading}
          />
        </div>
        <button type="submit" className={buttonStyle} disabled={isLoading}>
          {isLoading ? 'Logging in...' : 'Login'}
        </button>
      </form>
       <p className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
        Don't have an account?{' '}
        <button onClick={onSwitchToRegister} className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
          Register
        </button>
      </p>
    </div>
  );
}

export default LoginForm;