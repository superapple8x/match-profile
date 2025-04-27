# Plan: Integrate Local Supabase (Full Migration)

This plan outlines the steps to integrate a local Supabase development environment into the backend, replacing the existing PostgreSQL setup, custom authentication, and migration tools.

**Chosen Approach:**

*   **Authentication:** Migrate fully to Supabase Auth.
*   **Database Interaction:** Use the `@supabase/supabase-js` client library.
*   **Migrations:** Adopt the Supabase CLI migration system.

**Steps:**

1.  **Setup Supabase CLI & Local Environment:**
    *   Install Supabase CLI globally (if not already installed).
    *   Run `supabase init` in the project root (`d:/match-profile`).
    *   Run `supabase start` to launch the local Supabase Docker stack.
    *   **Important:** Note the API URL and `anon` key provided by `supabase start`. These will be needed for configuration.

2.  **Configure Backend (`src/backend`):**
    *   Add the Supabase client library dependency: `npm install @supabase/supabase-js` (run in `src/backend`).
    *   Create a new configuration file `src/backend/config/supabaseClient.js` to initialize and export the Supabase client. Use environment variables for the URL and key.
    *   Update the `.env` file (or create one if it doesn't exist in `src/backend`) with `SUPABASE_URL` and `SUPABASE_ANON_KEY` using the values from step 1.

3.  **Refactor Authentication (`src/backend/routes/auth.js` & Middleware):**
    *   Remove unused authentication dependencies: `npm uninstall bcryptjs jsonwebtoken` (run in `src/backend`).
    *   Modify `src/backend/routes/auth.js`:
        *   Import the initialized Supabase client from `supabaseClient.js`.
        *   Replace the registration logic (`/register` route) to use `supabase.auth.signUp()`.
        *   Replace the login logic (`/login` route) to use `supabase.auth.signInWithPassword()`.
    *   Update authentication middleware (`src/backend/middleware/authMiddleware.js`) to validate Supabase JWTs obtained from the `Authorization: Bearer <token>` header.

4.  **Refactor Database Interactions (Throughout `src/backend`):**
    *   Identify all files currently importing `require('../config/db')` or `require('./config/db')`.
    *   Replace those imports with the import for the new Supabase client (`require('./config/supabaseClient')`).
    *   Replace all instances of `db.query(...)` with the equivalent Supabase client methods (e.g., `supabase.from('table_name').select('*')`, `supabase.from('table_name').insert(...)`, etc.). Pay close attention to table names and required data transformations.
    *   Remove the PostgreSQL driver dependency: `npm uninstall pg` (run in `src/backend`).
    *   Delete the old database configuration file: `src/backend/config/db.js`.

5.  **Handle Database Migrations:**
    *   Remove the old migration tool dependency: `npm uninstall node-pg-migrate` (run in `src/backend`).
    *   Remove the `db:migrate:*` scripts from `src/backend/package.json`.
    *   Delete the old migration configuration file: `src/backend/db-migrate-config.js`.
    *   Examine the existing migration file (`src/backend/migrations/1743470540580_initial-schema.js`) and potentially the `src/backend/db/schema.sql` file.
    *   Translate the necessary `CREATE TABLE` and other SQL statements into new SQL files within the `supabase/migrations/` directory (e.g., `supabase/migrations/YYYYMMDDHHMMSS_initial_schema.sql`). Ensure table/column names match what the refactored code expects.
    *   Apply the schema to the local Supabase database using the Supabase CLI: `supabase db reset` (for a clean start) or `supabase migration up`.

6.  **User Data Migration (Post-Setup Task):**
    *   This needs careful planning *after* the initial setup is working.
    *   Since we only have password hashes (`bcryptjs`), migrating existing users directly into Supabase Auth will require users to reset their passwords.
    *   A possible strategy:
        *   Export user data (usernames, IDs, etc., *excluding* hashes) from the old database.
        *   Create users in Supabase Auth programmatically using the exported data (e.g., via a script using the Supabase Admin client or manually).
        *   Implement a "force password reset" flow for users upon their next login attempt.

7.  **Review Docker Configuration:**
    *   Examine `docker-compose.yml` and `src/backend/Dockerfile`.
    *   The backend service likely no longer needs a direct `depends_on` or `link` to a separate Postgres container defined in the compose file (as Supabase runs its own).
    *   Ensure the `SUPABASE_URL` and `SUPABASE_ANON_KEY` environment variables are correctly passed into the backend container if running via Docker Compose.

8.  **Testing:**
    *   Start the backend service (`npm start` or via Docker).
    *   Thoroughly test:
        *   User registration.
        *   User login.
        *   Any API endpoints protected by authentication.
        *   Endpoints that perform database operations (e.g., the data analysis endpoint in `index.js`, session saving/loading).
        *   Health checks (`/healthz`, `/readyz`).

**Mermaid Diagram:**

```mermaid
graph TD
    subgraph Setup
        A[Install Supabase CLI] --> B[Run supabase init];
        B --> C[Run supabase start];
        C --> D[Note Supabase URL/Keys];
    end

    subgraph Configuration
        E[Add @supabase/supabase-js dep] --> F[Create supabaseClient.js];
        F --> G[Update .env];
    end

    subgraph Refactoring
        H[Refactor auth.js (use Supabase Auth)] --> I[Remove bcrypt/jwt deps];
        J[Refactor db calls (use Supabase client)] --> K[Remove pg dep];
        K --> L[Delete config/db.js];
        M[Update authMiddleware.js];
    end

    subgraph Migrations
        N[Remove node-pg-migrate dep/scripts] --> O[Delete db-migrate-config.js];
        O --> P[Translate schema to supabase/migrations/*.sql];
        P --> Q[Run supabase db reset/migration up];
    end

    subgraph Finalization
        R[Plan User Data Migration];
        S[Review Docker Config];
        T[Comprehensive Testing];
    end

    D --> F;
    G --> F;
    C --> S;
    Setup --> Configuration;
    Configuration --> Refactoring;
    Refactoring --> Migrations;
    Migrations --> Finalization;

    classDef default fill:#f9f,stroke:#333,stroke-width:2px;
    classDef action fill:#cfc,stroke:#333,stroke-width:2px;
    classDef config fill:#ffc,stroke:#333,stroke-width:2px;
    classDef removal fill:#fcc,stroke:#333,stroke-width:2px;

    class A,B,C,E,F,H,J,M,P,Q,R,S,T action;
    class D,G config;
    class I,K,L,N,O removal;