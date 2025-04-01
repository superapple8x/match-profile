# Profile Matching & Analysis Tool

## Introduction

This project provides a web application designed to help users find relevant profiles within datasets based on specified criteria. It allows users to upload datasets (CSV/Excel), define complex search criteria, and view matching profiles ranked by a similarity score.

A key feature is the integration with Large Language Models (LLMs) like DeepSeek or OpenAI. Users can select matched results and perform natural language queries to gain deeper insights, generate summaries, statistics, and even visualizations (like plots) based on the data subset. The LLM interaction happens within a secure, sandboxed Docker environment.

The application features a React frontend and a Node.js/Express backend, using PostgreSQL for data storage and JWT for user authentication and session management.

## Key Features

*   **Dataset Upload:** Supports CSV and Excel file uploads.
*   **Dynamic Schema Handling:** Infers data types and creates database tables dynamically for uploaded datasets.
*   **Profile Matching:**
    *   Build complex search criteria using various operators (`=`, `>`, `<`, `LIKE`, `IN`, etc.).
    *   Apply weights to different attributes to influence match scores.
    *   Define specific matching rules (e.g., partial text matching).
    *   View paginated and sortable matching results ranked by relevance.
*   **LLM-Powered Data Analysis:**
    *   Select matched profiles for deeper analysis.
    *   Use natural language queries to interact with an LLM (DeepSeek/OpenAI).
    *   Generate Python code executed in a secure Docker sandbox.
    *   View results including generated plots, statistics (JSON), and textual summaries.
    *   Real-time progress updates via Server-Sent Events (SSE).
*   **User Authentication & Sessions:**
    *   Secure user registration and login using JWT.
    *   Save and load analysis sessions (search criteria, LLM chat history).
*   **API Documentation:** Interactive API documentation available via Swagger UI (`/api-docs`).
*   **Development Tooling:** Includes database migrations (`node-pg-migrate`) and code linting/formatting (ESLint/Prettier).

## Development Setup Guide (Linux)

This guide provides a comprehensive, step-by-step walkthrough for setting up and running the application on a Linux system for development and testing.

### Prerequisites

1.  **Operating System:** Assumes a Debian/Ubuntu-based Linux distribution. Adapt package installation commands for other distributions.
2.  **Terminal Access:** Required for executing commands.
3.  **Basic Linux Knowledge:** Familiarity with `cd`, `ls`, `mkdir`, `sudo`.
4.  **Git:** For cloning the repository.
5.  **Node.js and npm:** JavaScript runtime and package manager.
6.  **PostgreSQL:** Database server.
7.  **Docker:** For the sandboxed Python execution environment.

### 1. Installing Prerequisites

1.  **Node.js and npm:**
    ```bash
    sudo apt update
    sudo apt install nodejs npm
    ```
    Verify installation:
    ```bash
    node -v
    npm -v
    ```
    *(A recent LTS version, e.g., v18+, is recommended. Use `nvm` if needed.)*

2.  **Git:**
    ```bash
    sudo apt install git
    ```
    Verify installation:
    ```bash
    git --version
    ```

3.  **Docker & Docker Compose:**
    ```bash
    sudo apt install docker.io docker-compose
    ```
    Add your user to the `docker` group:
    ```bash
    sudo usermod -aG docker ${USER}
    ```
    **Important:** Log out and log back in for this change to take effect. Verify by running `docker ps` without `sudo`.

### 2. Setting up PostgreSQL

1.  **Install PostgreSQL:**
    ```bash
    sudo apt install postgresql postgresql-contrib
    ```

2.  **Create Database User Password (if needed):**
    *(Optional, only if you need to set/change the password for the default `postgres` user)*
    ```bash
    # Set OS password for postgres user (if not set)
    sudo passwd postgres
    # Switch to postgres user
    sudo -i -u postgres
    # Set DB password for postgres user
    psql -c "ALTER USER postgres PASSWORD 'your_strong_password';"
    # Exit postgres user session
    exit
    ```
    Replace `your_strong_password` with a secure password.

3.  **Create Database:**
    ```bash
    sudo -i -u postgres
    createdb profile_matching
    exit
    ```

4.  **Initialize/Migrate the Database Schema:**
    Database schema changes are managed using `node-pg-migrate`.
    *   Navigate to the backend directory:
        ```bash
        cd src/backend
        ```
    *   Run the migrations (ensure backend dependencies are installed first: `npm install`):
        ```bash
        npm run db:migrate:up
        ```
    *   This command uses the `.env` file (see next step) for connection details and applies pending migrations from the `migrations/` directory. Run this after cloning and whenever new migrations are added.

### 3. Configuring the Backend

The backend requires environment variables.

1.  **Create `.env` file:** In the `src/backend` directory:
    ```bash
    cd src/backend
    touch .env
    ```

2.  **Edit `.env` file:** Open `.env` (e.g., `nano .env`) and add the following, replacing placeholders:

    ```dotenv
    # LLM Configuration
    LLM_PROVIDER=deepseek # Options: openai, deepseek (gemini, ollama not fully implemented)

    # --- API Keys & Config (Add your keys/prefs here) ---

    # OpenAI (if LLM_PROVIDER=openai)
    OPENAI_API_KEY=your_openai_key
    OPENAI_CODE_MODEL=gpt-3.5-turbo
    OPENAI_TEXT_MODEL=gpt-3.5-turbo

    # DeepSeek (if LLM_PROVIDER=deepseek)
    DEEPSEEK_API_KEY=your_deepseek_key
    DEEPSEEK_BASE_URL=https://api.deepseek.com/v1 # OpenAI compatible endpoint
    DEEPSEEK_CODE_MODEL=deepseek-coder # Or deepseek-chat, deepseek-reasoner
    DEEPSEEK_TEXT_MODEL=deepseek-chat # Or deepseek-reasoner

    # PostgreSQL Configuration
    DB_USER=postgres # Default: postgres
    DB_HOST=localhost # Default: localhost
    DB_NAME=profile_matching # Default: profile_matching
    DB_PASSWORD=your_db_password # Default: (empty string) - Set your actual password here if you created one
    DB_PORT=5432 # Default: 5432

    # JWT Configuration (Required for Authentication)
    # Generate a strong, random secret (e.g., using openssl rand -hex 32)
    JWT_SECRET=your_strong_random_jwt_secret_here
    JWT_EXPIRES_IN=1h # Optional: Default is 1 hour
    ```
    *   Set `LLM_PROVIDER` and fill in the corresponding API key.
    *   Adjust `DB_*` variables if your PostgreSQL setup differs from the defaults. Set `DB_PASSWORD` if you configured one.
    *   Generate and set a strong `JWT_SECRET`.

### 4. Running the Application

Run the backend and frontend servers concurrently in separate terminals from the project root (`match-profile`).

1.  **Start the Backend Server:**
    *   Navigate to the backend directory:
        ```bash
        cd src/backend
        npm install # If you haven't already
        ```
    *   Run migrations (if you haven't already):
        ```bash
        npm run db:migrate:up
        ```
    *   Start the server:
        ```bash
        npm start
        ```
    *   *(Alternatively, use `npm run start:prod` for `pm2` single-instance management)*
    *   Keep this terminal running. Logs are in `src/backend/logs/`.

2.  **Start the Frontend Development Server:**
    *   Navigate to the frontend directory:
        ```bash
        cd src/frontend
        npm install # If you haven't already
        ```
    *   Start the Vite dev server:
        ```bash
        npm run dev
        ```
    *   Keep this terminal running. Access the UI at the address shown (usually `http://localhost:5173`).

### 5. Accessing the Application

1.  Open your web browser.
2.  Navigate to the frontend server's address (e.g., `http://localhost:5173`).

You can now register/login, upload datasets, perform matching, and use the LLM analysis features.

### 6. Stopping the Servers

Go to each terminal window and press `Ctrl + C`. If using `pm2`, run `npm run stop:prod` in the `src/backend` directory.

## API Documentation

Interactive API documentation is generated using Swagger UI. Once the backend server is running, access it at `/api-docs` (e.g., `http://localhost:3001/api-docs`).

## Docker Setup (Alternative)

A `docker-compose.yml` file is included for running the application using Docker Compose. This might be useful for deployment or isolated environments, but the manual setup above is recommended for active development.

```bash
# From the project root directory
sudo docker-compose up --build
```
*   Frontend: `http://localhost:3000` (Note the different port from dev server)
*   Backend: `http://localhost:3001`

*(Note: The Docker setup might require adjustments to environment variable handling and database connections compared to the manual setup.)*
