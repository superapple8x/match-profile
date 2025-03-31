import React, { useState, useEffect } from 'react';

// TODO: Consider moving CSS to a separate file (e.g., AuthPage.css)

const AuthPage = ({ onLoginSuccess }) => { // Accept onLoginSuccess prop
  const [activeTab, setActiveTab] = useState('login'); // 'login' or 'register'

  // State for both forms
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerUsername, setRegisterUsername] = useState('');
  // Removed registerEmail state
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const showTab = (tabName) => {
    setActiveTab(tabName);
    setError(''); // Clear errors when switching tabs
    setIsLoading(false); // Reset loading state
  };

  // Effect to handle initial display based on state (React way)
  // This replaces the inline style manipulation in the original JS
  useEffect(() => {
    // Logic to manage active classes could be added here if needed,
    // but conditional rendering based on `activeTab` state is more idiomatic.
  }, [activeTab]);

  // --- Login Handler ---
  const handleSubmitLogin = async (e) => {
    e.preventDefault();
    setError('');
    if (!loginUsername || !loginPassword) {
      setError('Login Name and Password are required.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword }),
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

  // --- Register Handler ---
   const handleSubmitRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (registerPassword !== registerConfirmPassword) {
      setError('Passwords (Secret Codes) do not match.');
      return;
    }
    // Removed email validation
    if (!registerUsername || !registerPassword) { // Removed email check
        setError('Username and Password are required.'); // Updated error message
        return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: registerUsername, password: registerPassword }), // Removed email from body
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }

      console.log('Registration successful:', data);
      alert('Registration successful! Please log in.'); // Simple feedback
      showTab('login'); // Switch to login tab after successful registration
      // Clear registration form fields
      setRegisterUsername('');
      // Removed clearing email state
      setRegisterPassword('');
      setRegisterConfirmPassword('');


    } catch (err) {
      console.error('Registration error:', err);
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <>
      {/* Embedding styles directly for now, consider moving to CSS file */}
      <style>{`
        /* --- 90s/00s Maximalist Styles --- */

        /* Tiled background using CSS gradients for a retro pattern */
        body {
            font-family: Arial, Helvetica, sans-serif; /* Default font */
            font-size: 12px;
            /* Repeating radial gradient for a 'space' or 'techno' feel */
            background-color: #000033; /* Dark blue fallback */
            background-image: repeating-radial-gradient(circle at 0 0, transparent 0, #000044 10px),
                              repeating-linear-gradient(#003366, #004488);
            background-size: 10px 10px, 100% 100%; /* Control pattern size */
            color: #FFFFFF; /* Default white text on dark bg */
            margin: 0;
            padding: 15px; /* Padding around the main table */
        }

        /* Main container table - the centerpiece! */
        .main-container-table {
            width: 500px; /* Wider than before */
            margin: 20px auto; /* Center it somewhat */
            border: 5px ridge #FFFF00; /* Thick, bright yellow ridge border */
            background-color: #000080; /* Navy blue background */
            padding: 0; /* No padding, use cell padding */
        }

        /* Header cell */
        .header-cell {
            background-color: #C0C0C0; /* Silver header background */
            padding: 10px;
            border-bottom: 3px double #000000; /* Double black border */
            text-align: center;
        }

        /* The main title - Impact font, bright color, maybe shadow */
        .main-title {
            font-family: Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif; /* Classic chunky font */
            font-size: 32px; /* BIG */
            color: #FF00FF; /* Bright Magenta */
            letter-spacing: 2px;
            /* Simple text shadow (works in older browsers too) */
            text-shadow: 2px 2px #00FFFF; /* Cyan shadow */
            margin: 0;
        }

        /* Blinking text effect */
        @keyframes blink {
            0% { opacity: 1; }
            49% { opacity: 1; }
            50% { opacity: 0; }
            100% { opacity: 0; }
        }
        .blink {
            animation: blink 1s linear infinite;
            font-weight: bold;
            color: #FFFF00; /* Blinking yellow */
        }

        /* Horizontal rule styling */
        hr {
            height: 3px;
            border: none;
            background-color: #00FF00; /* Lime green */
            color: #00FF00; /* For older IE */
            margin: 10px 0;
        }

        /* Tab area styling using table cells */
        .tabs-table {
            width: 100%;
            border-collapse: collapse; /* Remove spacing between cells */
            margin-bottom: 10px;
            background-color: #444444; /* Dark gray tab background */
        }
        .tab-button-cell {
            border: 2px outset #888888;
            padding: 8px;
            text-align: center;
            cursor: pointer;
            font-weight: bold;
            color: #FFFFFF;
            background-color: #666666; /* Default tab color */
            width: 50%; /* Ensure tabs take equal width */
        }
        .tab-button-cell.active {
            border-style: inset;
            background-color: #0055AA; /* Brighter blue for active tab */
            color: #FFFF00; /* Yellow text for active tab */
        }
        .tab-button-cell:hover {
             background-color: #888888; /* Simple hover effect */
        }

        /* Content area */
        .content-cell {
            padding: 15px;
            background-color: #EEEEEE; /* Light gray content background */
            color: #000000; /* Black text for content */
            border-top: 3px groove #FF0000; /* Red groove border */
        }

        /* Form styling */
        .form-title {
            font-family: "Comic Sans MS", cursive, sans-serif; /* The infamous Comic Sans */
            font-size: 20px;
            color: #FF0000; /* Red heading */
            margin-top: 0;
            margin-bottom: 15px;
            text-align: center;
            font-weight: bold;
        }

        .form-table {
            margin: 0 auto; /* Center form table */
            background-color: #D0D0D0; /* Slightly darker gray for form bg */
            padding: 10px;
            border: 1px solid #000000;
        }
        .form-table td {
           padding: 5px;
        }
        .form-table label {
            font-weight: bold;
            color: #000080; /* Navy label text */
            font-size: 13px; /* Slightly larger label */
        }
        input[type="text"],
        input[type="password"],
        input[type="email"] {
            width: 180px;
            padding: 3px;
            border: 1px solid #000000; /* Simple black border */
            font-size: 12px;
            background-color: #FFFFFF;
            color: #000000;
            margin-left: 5px; /* Space from label */
        }

        /* Buttons - more colorful! */
        .button {
            font-family: Arial, Helvetica, sans-serif;
            font-size: 14px; /* Larger button text */
            font-weight: bold;
            padding: 6px 18px;
            background-color: #00FF00; /* LIME GREEN button */
            border: 3px outset #00AA00; /* Darker green border */
            cursor: pointer;
            color: #000000; /* Black text */
        }
        .button:active {
            border-style: inset;
            background-color: #00DD00; /* Slightly lighter green when pressed */
        }
        .button-register { /* Different color for register */
             background-color: #FF00FF; /* MAGENTA button */
             border-color: #AA00AA;
        }
         .button-register:active {
             background-color: #DD00DD;
         }

        /* Links */
        a {
            color: #00FFFF; /* Cyan links */
            text-decoration: underline;
            font-weight: bold;
        }
        a:visited {
            color: #FF00FF; /* Magenta visited links */
        }
        a:hover {
            color: #FFFF00; /* Yellow hover */
        }

        /* Fake Hit Counter / Banner */
        .fake-graphic {
            border: 1px dashed #FFFF00;
            padding: 5px;
            margin-top: 15px;
            text-align: center;
            font-family: monospace;
            font-size: 10px;
            color: #CCCCCC;
            background-color: #222222;
        }

        /* Hide inactive tab content using conditional rendering in React */
        /* .tab-content { display: none; } */
        /* .tab-content.active { display: block; } */

        .center-align { text-align: center; padding-top: 10px; }
        .small-text { font-size: 11px; color: #333333; text-align: center; margin-top: 15px; }

      `}</style>

      <table className="main-container-table" cellPadding="0" cellSpacing="0">
        <tbody>
          <tr>
            <td className="header-cell">
              <h1 className="main-title">Web Portal Access</h1>
              <span style={{ color: '#FF0000', fontWeight: 'bold' }}>
                Your Gateway to the Information Superhighway!
              </span>
            </td>
          </tr>

          <tr>
            <td>
              <table className="tabs-table" cellPadding="0" cellSpacing="0">
                <tbody>
                  <tr>
                    <td
                      id="login-tab-button"
                      className={`tab-button-cell ${activeTab === 'login' ? 'active' : ''}`}
                      onClick={() => showTab('login')}
                    >
                      &gt;&gt; Member Login &lt;&lt;
                    </td>
                    <td
                      id="register-tab-button"
                      className={`tab-button-cell ${activeTab === 'register' ? 'active' : ''}`}
                      onClick={() => showTab('register')}
                    >
                      Join the <span className="blink">FUN!</span> Register!
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>

          <tr>
            <td className="content-cell">
              {/* Login Tab Content */}
              {activeTab === 'login' && (
                <div id="login-tab" className="tab-content active">
                  <h2 className="form-title">-- Enter the Member Zone --</h2>
                  {error && <p style={{ color: 'red', fontSize: '0.9em', textAlign: 'center', marginBottom: '10px' }}>{error}</p>}
                  <form name="loginForm" onSubmit={handleSubmitLogin}>
                    <table className="form-table" align="center">
                      <tbody>
                        <tr>
                          <td><label htmlFor="login-user">Login Name:</label></td>
                          <td>
                            <input
                              type="text"
                              id="login-user"
                              name="username"
                              value={loginUsername}
                              onChange={(e) => setLoginUsername(e.target.value)}
                              required
                              disabled={isLoading}
                            />
                          </td>
                        </tr>
                        <tr>
                          <td><label htmlFor="login-pass">Password:</label></td>
                          <td>
                            <input
                              type="password"
                              id="login-pass"
                              name="password"
                              value={loginPassword}
                              onChange={(e) => setLoginPassword(e.target.value)}
                              required
                              disabled={isLoading}
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
                            {/* TODO: Implement forgot password functionality */}
                            <a href="#">Forgot Password?! Click Here!</a>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    <p className="small-text">
                      Need an account?{' '}
                      <a href="#" onClick={(e) => { e.preventDefault(); showTab('register'); }}>
                        Sign Up NOW!
                      </a>
                    </p>
                  </form>
                  <hr />
                  <div className="fake-graphic">
                    ** Site Optimized for Netscape Navigator 4.0+ ** <br />
                    Best Viewed at 800x600 Resolution
                  </div>
                </div>
              )}

              {/* Register Tab Content */}
              {activeTab === 'register' && (
                <div id="register-tab" className="tab-content active">
                  <h2 className="form-title">** Become a NEW Member! **</h2>
                  {error && <p style={{ color: 'red', fontSize: '0.9em', textAlign: 'center', marginBottom: '10px' }}>{error}</p>}
                  <form name="registerForm" onSubmit={handleSubmitRegister}>
                    <table className="form-table" align="center">
                      <tbody>
                        <tr>
                          <td><label htmlFor="reg-user">Choose Login:</label></td>
                          <td>
                            <input
                              type="text"
                              id="reg-user"
                              name="username"
                              value={registerUsername}
                              onChange={(e) => setRegisterUsername(e.target.value)}
                              required
                              disabled={isLoading}
                            />
                          </td>
                        </tr>
                        {/* Removed Email Row */}
                        <tr>
                          <td><label htmlFor="reg-pass">Secret Code:</label></td>
                          <td>
                            <input
                              type="password"
                              id="reg-pass"
                              name="password"
                              value={registerPassword}
                              onChange={(e) => setRegisterPassword(e.target.value)}
                              required
                              disabled={isLoading}
                            />
                          </td>
                        </tr>
                        <tr>
                          <td><label htmlFor="reg-confirm-pass">Confirm Code:</label></td>
                          <td>
                            <input
                              type="password"
                              id="reg-confirm-pass"
                              name="confirm_password"
                              value={registerConfirmPassword}
                              onChange={(e) => setRegisterConfirmPassword(e.target.value)}
                              required
                              disabled={isLoading}
                            />
                          </td>
                        </tr>
                        <tr>
                          <td colSpan="2" className="center-align">
                            <button type="submit" className="button button-register" disabled={isLoading}>
                              {isLoading ? 'Registering...' : 'Sign Me Up!'}
                            </button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    <p className="small-text">
                      Already got an account?{' '}
                      <a href="#" onClick={(e) => { e.preventDefault(); showTab('login'); }}>
                        Login Over Here!
                      </a>
                    </p>
                  </form>
                  <hr />
                  <div className="fake-graphic">
                    Your IP: 192.168.1.100 | Hits Today: 00001234 <br />
                    (c) 1999-2001 MegaWeb Corp.
                  </div>
                </div>
              )}
            </td>
          </tr>
          <tr>
            <td style={{ textAlign: 'center', padding: '5px', fontSize: '10px', color: '#AAAAAA', borderTop: '1px solid #FFFF00' }}>
              This page was last updated: Monday, March 31, 2025 at 6:22 AM WIB (Indonesia Time). Wow!
            </td>
          </tr>
        </tbody>
      </table>
    </>
  );
};

export default AuthPage;
