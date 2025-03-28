# Profile Matching Project - Docker Setup Guide

This guide provides instructions on how to clone and run the Profile Matching project using Docker.

## Prerequisites

*   [Docker](https://www.docker.com/get-started) installed on your system
*   [Docker Compose](https://docs.docker.com/compose/install/) installed on your system
*   Git

## Steps

1.  **Clone the repository:**

    ```bash
    git clone <repository_url>
    cd match-profile
    ```

2.  **Build and run the Docker containers:**

    ```bash
    sudo docker-compose up --build
    ```

    This command will build the Docker images for the frontend and backend services and start the containers. You may need to use `sudo` to run this command if you encounter permission errors.

3.  **Access the application:**

    *   Frontend: `http://localhost:3000`
    *   Backend: `http://localhost:3001`

## Troubleshooting

*   **If you encounter a `Permission denied` error, make sure you have the necessary permissions to connect to the Docker daemon socket. Try running the `docker-compose up --build` command with `sudo`.**
*   **If you encounter a `net/http: TLS handshake timeout` error, this indicates a network issue when trying to download the base image from Docker Hub. Try running the `docker-compose up --build` command again.**
*   **If you encounter a `ModuleNotFoundError: No module named 'distutils'` error, this indicates that the `distutils` module is missing. This can be resolved by installing the `python3-distutils` package using `sudo apt install python3-distutils`.**
*   **If you encounter any errors during the build process, make sure that you have the latest version of Docker and Docker Compose installed.**
*   **If you encounter any errors related to missing dependencies, make sure that you have run `npm install` in both the `src/frontend` and `src/backend` directories.**

## Notes

*   This setup uses a `docker-compose.yml` file to define the services, networks, and volumes for the application.
*   The frontend is served on port 3000 and the backend is served on port 3001.
*   The backend depends on the frontend, so the frontend container will be started before the backend container.
