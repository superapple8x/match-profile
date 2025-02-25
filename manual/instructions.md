# Profile Matching Application - Instructions

## Required Programs

*   [Node.js](https://nodejs.org/) (version >= 16)
*   [npm](https://www.npmjs.com/) (version >= 8)

## Programming Languages

*   JavaScript

## Packages

### Backend

*   express
*   cors
*   csv-parser
*   multer
*   papaparse
*   pg
*   xlsx
*   nodemon (dev dependency)
*   jest (dev dependency)
*   supertest (dev dependency)

### Frontend

*   @testing-library/dom
*   @testing-library/jest-dom
*   @testing-library/react
*   @testing-library/user-event
*   papaparse
*   react
*   react-dom
*   react-router-dom
*   react-scripts
*   web-vitals

## How to Run the App

1.  **Clone the repository:**

    ```bash
    git clone <repository_url>
    cd <repository_directory>
    ```

2.  **Install dependencies:**

    *   **Backend:**

        ```bash
        cd src/backend
        npm install
        ```

    *   **Frontend:**

        ```bash
        cd src/frontend
        npm install
        ```

3.  **Run the application:**

    *   **Backend:**

        ```bash
        cd src/backend
        npm run dev
        ```

        This will start the backend server on port 3000.

    *   **Frontend:**

        ```bash
        cd src/frontend
        npm start
        ```

        This will start the frontend application in development mode. It will usually open in your browser at `http://localhost:3001`.

## How to Use the App

1.  **Import a CSV file:**

    *   Use the `File Import` component to select and import a CSV file containing profile data.

2.  **Configure the search:**

    *   Use the `Search Configuration` component to select the attributes you want to use for matching.
    *   Adjust the weights and matching rules for each attribute.

3.  **View the results:**

    *   The `Results Dashboard` component will display the matching profiles, sorted by match percentage.
    *   You can view more details about each match by clicking on the profile.