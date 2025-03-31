import React, { useState } from 'react';

// Refactored RegisterForm to match the provided HTML structure/classes
function RegisterForm({ onRegisterSuccess, onSwitchToLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState(''); // Added email state based on example
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Passwords (Secret Codes) do not match.');
      return;
    }
    // Basic email validation (optional, can be improved)
    if (email && !/\S+@\S+\.\S+/.test(email)) {
        setError('Please enter a valid email address.');
        return;
    }
    if (!username || !password || !email) { // Added email check
        setError('Username, Email, and Password are required.');
        return;
    }


    setIsLoading(true);
    try {
      // Include email in the request body if your backend expects it
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, email }), // Added email
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }

      console.log('Registration successful:', data);
      if (onRegisterSuccess) {
        onRegisterSuccess(data.user);
      }
      alert('Registration successful! Please log in.'); // Simple feedback
      if (onSwitchToLogin) onSwitchToLogin();

    } catch (err) {
      console.error('Registration error:', err);
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    // Container div matches the structure in AuthView
    <div>
      <h2 className="form-title">** Become a NEW Member! **</h2>
      {error && <p style={{ color: 'red', fontSize: '0.9em', textAlign: 'center', marginBottom: '10px' }}>{error}</p>}
       <form onSubmit={handleSubmit} name="registerForm">
         <table className="form-table" align="center">
            <tbody>
                 <tr>
                     <td><label htmlFor="reg-user">Choose Login:</label></td>
                     <td>
                         <input
                            type="text"
                            id="reg-user"
                            name="username" // Added name
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            disabled={isLoading}
                            // size="20"
                         />
                     </td>
                 </tr>
                  <tr>
                     <td><label htmlFor="reg-email">Your E-Mail:</label></td>
                     <td>
                         <input
                            type="email" // Changed type to email
                            id="reg-email"
                            name="email" // Added name
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            disabled={isLoading}
                            // size="20"
                         />
                     </td>
                 </tr>
                 <tr>
                     <td><label htmlFor="reg-pass">Secret Code:</label></td>
                     <td>
                         <input
                            type="password"
                            id="reg-pass"
                            name="password" // Added name
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            disabled={isLoading}
                            // size="20"
                         />
                     </td>
                 </tr>
                  <tr>
                     <td><label htmlFor="reg-confirm-pass">Confirm Code:</label></td>
                     <td>
                         <input
                            type="password"
                            id="reg-confirm-pass"
                            name="confirm_password" // Added name
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            disabled={isLoading}
                            // size="20"
                         />
                     </td>
                 </tr>
                 <tr>
                     <td colSpan="2" className="center-align">
                         {/* Apply specific register button class */}
                         <button type="submit" className="button button-register" disabled={isLoading}>
                            {isLoading ? 'Registering...' : 'Sign Me Up!'}
                         </button>
                     </td>
                 </tr>
             </tbody>
         </table>
          <p className="small-text">
              Already got an account?{' '}
              {/* Use a link/button styled element to trigger the switch */}
              <a href="#" onClick={(e) => { e.preventDefault(); onSwitchToLogin(); }}>
                Login Over Here!
              </a>
           </p>
      </form>
      {/* Fake graphic moved to AuthView */}
    </div>
  );
}

export default RegisterForm;