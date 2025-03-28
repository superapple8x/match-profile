# Development Setup Guide

This guide outlines the steps required to set up and run the Profile Matching application locally for development and testing after the migration to Vite and Tailwind CSS.

## Prerequisites

*   **Node.js:** Ensure you have Node.js installed (which includes npm). A recent LTS version is recommended (e.g., v18 or later). You can download it from [nodejs.org](https://nodejs.org/).
*   **npm:** Node Package Manager, comes with Node.js.
*   **Git:** For cloning the repository (if not already done).

## Installation

1.  **Clone the Repository (if needed):**
    ```bash
    git clone <repository_url>
    cd match-profile
    ```

2.  **Install Backend Dependencies:** Navigate to the backend directory and install its dependencies.
    ```bash
    cd src/backend
    npm install
    cd ../..
    ```

3.  **Install Frontend Dependencies:** Navigate to the frontend directory and install its dependencies.
    ```bash
    cd src/frontend
    npm install
    cd ../..
    ```

## Running the Application

You need to run both the backend and frontend servers concurrently. Open two separate terminal windows or tabs in the project's root directory (`match-profile`).

1.  **Start the Backend Server:**
    *   In the first terminal, navigate to the backend directory and run the start script:
        ```bash
        cd src/backend
        npm start
        ```
    *   This will typically start the Express server on `http://localhost:3001` (or the configured port). Keep this terminal running.

2.  **Start the Frontend Development Server:**
    *   In the second terminal, navigate to the frontend directory and run the Vite development script:
        ```bash
        cd src/frontend
        npm run dev
        ```
    *   Vite will compile the application and start a development server, usually on `http://localhost:5173`. It will also watch for file changes and automatically update the browser (Hot Module Replacement - HMR). Keep this terminal running.

## Accessing the Application

Once both servers are running:

1.  Open your web browser.
2.  Navigate to the frontend server's address, typically `http://localhost:5173`.

You should now be able to use the Profile Matching application. The frontend will make requests to the backend server (running on port 3001 by default) for actions like matching profiles.

## Stopping the Servers

To stop the servers, go to each terminal window where they are running and press `Ctrl + C`.