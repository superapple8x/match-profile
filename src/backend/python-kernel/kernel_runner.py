import sys
import json
import io
import contextlib
import traceback
import base64
import os
import argparse
import pandas as pd
import matplotlib
matplotlib.use('Agg') # Use non-interactive backend BEFORE importing pyplot
import matplotlib.pyplot as plt

# --- Global State ---
execution_scope = {} # Holds variables between exec calls
dataset_path = None
df = None # Holds pre-loaded DataFrame if successful

# --- Helper Functions ---

# Use original stdout for sending JSON messages back to Node.js
original_stdout = sys.__stdout__
# Use original stderr for kernel's own critical errors/logs, not captured output
original_stderr = sys.__stderr__

class StreamingOutputWrapper:
    """A file-like object that captures writes and sends them as JSON messages."""
    def __init__(self, stream_type):
        self.stream_type = stream_type # 'stdout' or 'stderr'
        self.buffer = ""

    def write(self, data):
        # Append data to internal buffer
        self.buffer += data
        # Send complete lines as separate messages
        while '\n' in self.buffer:
            line, self.buffer = self.buffer.split('\n', 1)
            # Send the line including the newline
            self._send_message(line + '\n')

    def flush(self):
        # Send any remaining buffered content when flush is called
        if self.buffer:
            self._send_message(self.buffer)
            self.buffer = ""

    def _send_message(self, content):
        """Sends the captured content as a JSON message."""
        message = {'type': self.stream_type, 'content': content}
        try:
            json_message = json.dumps(message)
            # Print JSON to the *original* stdout
            print(json_message, file=original_stdout, flush=True)
            # DEBUG: Log to original stderr what was sent
            # print(f"KERNEL DEBUG: Sent {self.stream_type}: {json_message[:100]}...", file=original_stderr, flush=True)
        except Exception as e:
            # Log error to original stderr if sending fails
            print(f"KERNEL STREAMING ERROR: Failed to send {self.stream_type} JSON ({message}): {e}", file=original_stderr, flush=True)

    def isatty(self):
        # Required for some libraries that check if output is a terminal
        return False

@contextlib.contextmanager
def capture_and_stream_stdio():
    """Context manager to replace stdout/stderr with streaming wrappers."""
    old_stdout, old_stderr = sys.stdout, sys.stderr
    stdout_wrapper = StreamingOutputWrapper('stdout')
    stderr_wrapper = StreamingOutputWrapper('stderr')
    sys.stdout = stdout_wrapper
    sys.stderr = stderr_wrapper
    try:
        yield # The wrappers handle output directly
    finally:
        # Ensure any remaining buffered output is sent
        stdout_wrapper.flush()
        stderr_wrapper.flush()
        # Restore original streams
        sys.stdout = old_stdout
        sys.stderr = old_stderr

def handle_plots():
    """Checks for active matplotlib plots, saves them to base64, and closes them."""
    images_base64 = []
    try:
        fig_nums = plt.get_fignums()
        for i in fig_nums:
            fig = plt.figure(i)
            buf = io.BytesIO()
            fig.savefig(buf, format='png', bbox_inches='tight')
            buf.seek(0)
            images_base64.append(base64.b64encode(buf.read()).decode('utf-8'))
            plt.close(fig) # Close the figure to free memory
    except Exception as e:
        # Log error during plot handling to original stderr
        print(f"KERNEL PLOT ERROR: {traceback.format_exc()}", file=original_stderr, flush=True)
    return images_base64

def execute_code_streaming(code_to_exec):
    """Executes code, streams output/plots, and sends completion/error messages."""
    try:
        # Execute code with stdout/stderr redirected to our streaming wrappers
        with capture_and_stream_stdio():
            exec(code_to_exec, execution_scope, execution_scope)

        # --- Execution finished without exception ---

        # Handle plots after execution completes
        images_base64 = handle_plots()
        for img_b64 in images_base64:
            img_message = {'type': 'image', 'format': 'png', 'content': img_b64}
            json_img_message = json.dumps(img_message)
            print(json_img_message, file=original_stdout, flush=True)
            # print(f"KERNEL DEBUG: Sent image message.", file=original_stderr, flush=True) # Less verbose debug

        # Send a final 'result' message indicating successful completion
        # The actual output was streamed, so the payload here is minimal/confirmatory
        completion_message = {'type': 'result', 'output': {}} # Empty output dict signifies success
        json_completion_message = json.dumps(completion_message)
        print(json_completion_message, file=original_stdout, flush=True)
        # print(f"KERNEL DEBUG: Sent completion message: {json_completion_message}", file=original_stderr, flush=True)

    except Exception:
        # --- Execution failed with an exception ---
        tb = traceback.format_exc()

        # Ensure any buffered stderr from the exception itself is flushed *before* sending the error message
        # This relies on the capture_and_stream_stdio context manager's finally block

        # Send a structured error message
        error_message = {
            'type': 'error',
            'message': str(sys.exc_info()[1]), # Get the exception message
            'traceback': tb
        }
        json_error_message = json.dumps(error_message)
        try:
            print(json_error_message, file=original_stdout, flush=True)
            # print(f"KERNEL DEBUG: Sent error message: {json_error_message[:100]}...", file=original_stderr, flush=True)
        except Exception as e:
            # If we can't even report the error via JSON, log to original stderr
            print(f"KERNEL CRITICAL: Failed to send execution error JSON: {e}\nOriginal Traceback:\n{tb}", file=original_stderr, flush=True)

    # No return value needed; all communication happens via print to original_stdout

# --- Main Execution ---
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Python Kernel Runner')
    parser.add_argument('dataset_path', type=str, help='Path to the dataset CSV file')
    args = parser.parse_args()
    dataset_path = args.dataset_path

    # Pre-load dataset (optional, adjust based on needs)
    if dataset_path and os.path.exists(dataset_path):
        try:
            df = pd.read_csv(dataset_path)
            execution_scope['df'] = df # Make df available globally in the exec scope
            # Optional: Send a confirmation back? For now, just load.
        except Exception as load_error:
             # If loading fails, print error to stderr (Node.js will see this)
             # and potentially exit or just continue without df.
             print(f"KERNEL DATA LOAD ERROR: Failed to load dataset {dataset_path}: {load_error}", file=original_stderr, flush=True)
             # Decide if kernel should exit on load failure. For now, continue.
             # sys.exit(1)

    # Signal that the kernel is ready (after attempting dataset load)
    print(json.dumps({'type': 'status', 'status': 'ready'}), file=original_stdout, flush=True)
    # print(f"KERNEL DEBUG: Sent ready status.", file=original_stderr, flush=True)

    # --- Communication Loop ---
    while True:
        try:
            line = sys.stdin.readline()
            if not line: # EOF
                break

            line = line.strip()
            if not line: # Empty line
                continue

            try:
                command = json.loads(line)
            except json.JSONDecodeError:
                print(json.dumps({'type': 'error', 'message': 'Invalid JSON command received.'}), file=original_stdout, flush=True)
                continue

            if command.get('type') == 'execute':
                code = command.get('code', '')
                # Call the streaming execution function
                execute_code_streaming(code)
                # Output is now handled within execute_code_streaming via print

            elif command.get('type') == 'shutdown':
                # Acknowledge shutdown command before breaking
                print(json.dumps({'type': 'shutdown_ack'}), file=original_stdout, flush=True)
                break # Exit the loop

            else:
                 print(json.dumps({'type': 'error', 'message': f'Unknown command type: {command.get("type")}'}), file=original_stdout, flush=True)


        except EOFError:
            # Handle case where stdin pipe is closed unexpectedly
            break
        except Exception as loop_error:
            # Catch-all for unexpected errors in the loop/communication
            # Report unexpected loop errors as structured JSON if possible
            error_report = {'type': 'error', 'message': f'Kernel loop error: {traceback.format_exc()}'}
            try:
                print(json.dumps(error_report), file=original_stdout, flush=True)
            except Exception as report_err:
                # If we can't even report the error via JSON, print raw error to original stderr
                print(f"KERNEL CRITICAL LOOP ERROR: {loop_error}\nREPORTING FAILED: {report_err}", file=original_stderr, flush=True)
            # Consider if the kernel should exit on loop errors. Usually yes.
            break

    # Kernel exiting
    # print("KERNEL INFO: Process exiting.", file=original_stderr, flush=True) # Optional debug message