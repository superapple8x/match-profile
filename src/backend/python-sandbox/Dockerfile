# Use a specific, slim Python version
FROM python:3.10-slim

# Set environment variables to prevent buffering and optimize Python
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Create a non-root user and group
RUN groupadd --gid 1001 pythonuser && \
    useradd --uid 1001 --gid 1001 --create-home pythonuser

# Create necessary directories and set permissions
# /app will contain the script, /input the data, /output the results
RUN mkdir -p /app /input /output && \
    chown -R pythonuser:pythonuser /app /input /output

# Install necessary Python packages
# Using --no-cache-dir to reduce image size
RUN pip install --no-cache-dir pandas matplotlib seaborn

# Set the working directory
WORKDIR /app

# Switch to the non-root user
USER pythonuser

# Default command (can be overridden) - useful for testing the image
# CMD ["python", "--version"]