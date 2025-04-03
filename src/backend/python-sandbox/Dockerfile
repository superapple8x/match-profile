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

# Copy the kernel runner script into the image
# Assumes the build context is src/backend/
COPY ../python-kernel/kernel_runner.py /app/kernel_runner.py
RUN chown pythonuser:pythonuser /app/kernel_runner.py

# Set the working directory
WORKDIR /app

# Switch to the non-root user
USER pythonuser

# Default command to run the kernel script
# It expects the dataset path as a command-line argument passed by the spawner
CMD ["python", "/app/kernel_runner.py"]