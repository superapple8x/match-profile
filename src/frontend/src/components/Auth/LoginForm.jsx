import React, { useState } from 'react';

// Refactored LoginForm to match the provided HTML structure/classes
function LoginForm({ onLoginSuccess, onSwitchToRegister }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
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
        throw new Error(data.message || `Login failed. Status: ${response.status}`);
      }

      console.log('Login successful, token:', data.token);
      localStorage.setItem('authToken', data.token);

      if (onLoginSuccess) {
        onLoginSuccess(data.token);
      }

    } catch (err) {
      console.error('Login error:', err);
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    // Container div matches the structure in AuthView
    <div>
      <h2 className="form-title">-- Enter the Member Zone --</h2>
      {error && <p style={{ color: 'red', fontSize: '0.9em', textAlign: 'center', marginBottom: '10px' }}>{error}</p>}
      <form onSubmit={handleSubmit} name="loginForm">
         <table className="form-table" align="center">
             <tbody>
                 <tr>
                     <td><label htmlFor="login-user">Login Name:</label></td>
                     <td>
                         <input
                            type="text"
                            id="login-user"
                            name="username" // Added name attribute
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            disabled={isLoading}
                            // size="20" // Size attribute is less common in React, handled by CSS/input style
                         />
                     </td>
                 </tr>
                 <tr>
                     <td><label htmlFor="login-pass">Password:</label></td>
                     <td>
                         <input
                            type="password"
                            id="login-pass"
                            name="password" // Added name attribute
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            disabled={isLoading}
                            // size="20"
                         />
                     </td>
                 </tr>
                 <tr>
                     <td colSpan="2" className="center-align">
                         <button type="submit" className="button" disabled={isLoading}>
                            {isLoading ? 'Logging in...' : 'GO!'}
                         </button>
                     </td>
                 </tr>
                 <tr>
                     <td colSpan="2" style={{ textAlign: 'center', paddingTop: '10px' }}>
                         {/* Using a simple link for now, functionality can be added later */}
                         <a href="#">Forgot Password?! Click Here!</a>
                     </td>
                 </tr>
             </tbody>
         </table>
           <p className="small-text">
              Need an account?{' '}
              {/* Use a link/button styled element to trigger the switch */}
              <a href="#" onClick={(e) => { e.preventDefault(); onSwitchToRegister(); }}>
                Sign Up NOW!
              </a>
           </p>
      </form>
      {/* Fake graphic moved to AuthView */}
    </div>
  );
}

export default LoginForm;