import sys
import json
import io
import sys
import json
import io
import contextlib
import traceback
import base64
import os
import argparse
import ast # Import Abstract Syntax Trees module
import os
import select
import threading
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
            print(f"KERNEL STREAMING ERROR: Failed to send {self.stream_type} JSON ({type(e).__name__}: {e})", file=original_stderr, flush=True) # Include error type

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
    """Checks for active matplotlib plots OR saved images in /output, saves them to base64, and closes active plots."""
    images_base64 = []
    output_dir = '/output' # Standard output directory in container
    processed_files = set() # Keep track of files processed from /output

    try:
        # 1. Check for active matplotlib figures
        fig_nums = plt.get_fignums()
        if fig_nums:
            print(f"KERNEL INFO: Found active matplotlib figures: {fig_nums}", file=original_stderr, flush=True)
        for i in fig_nums:
            fig = plt.figure(i)
            try:
                buf = io.BytesIO()
                fig.savefig(buf, format='png', bbox_inches='tight')
                buf.seek(0)
                images_base64.append(base64.b64encode(buf.read()).decode('utf-8'))
                plt.close(fig) # Close the figure to free memory
            except Exception as fig_error:
                 print(f"KERNEL WARNING: Failed to save/close active figure {i}: {fig_error}", file=original_stderr, flush=True)

        # 2. Check /output directory for PNG files if no active figures were processed
        #    or even if they were, to catch explicitly saved files.
        try:
            if os.path.exists(output_dir):
                for filename in os.listdir(output_dir):
                    if filename.lower().endswith('.png'):
                        file_path = os.path.join(output_dir, filename)
                        if file_path not in processed_files: # Avoid double-processing if saved AND kept open
                            try:
                                with open(file_path, 'rb') as f:
                                    img_bytes = f.read()
                                    images_base64.append(base64.b64encode(img_bytes).decode('utf-8'))
                                    processed_files.add(file_path)
                            except Exception as read_error:
                                print(f"KERNEL WARNING: Failed to read saved image file {filename}: {read_error}", file=original_stderr, flush=True)
            else:
                 print(f"KERNEL INFO: Output directory {output_dir} not found.", file=original_stderr, flush=True)
        except Exception as dir_error:
             print(f"KERNEL WARNING: Error accessing output directory {output_dir}: {dir_error}", file=original_stderr, flush=True)

    except Exception as outer_error:
        # Catch errors during the overall plot handling process (e.g., plt.get_fignums fails)
        tb = traceback.format_exc()
        error_message = {
            'type': 'error',
            'message': f"Error handling plot: {str(sys.exc_info()[1])}",
            'traceback': tb
        }
        try:
            print(json.dumps(error_message), file=original_stdout, flush=True)
        except Exception as report_err:
            # Fallback to original stderr if sending JSON fails
            print(f"KERNEL CRITICAL: Failed to send plot error JSON: {report_err}\nOriginal Traceback:\n{tb}", file=original_stderr, flush=True)
    return images_base64

def read_pipe_and_send(pipe_fd, stream_type, stop_event):
    """Reads from a pipe FD, sends data via JSON, runs in a thread."""
    wrapper = StreamingOutputWrapper(stream_type)
    try:
        while not stop_event.is_set():
            # Use select for non-blocking read with timeout
            rlist, _, _ = select.select([pipe_fd], [], [], 0.1)
            if pipe_fd in rlist:
                data_bytes = os.read(pipe_fd, 1024)
                if not data_bytes: # Pipe closed
                    break
                wrapper.write(data_bytes.decode('utf-8', errors='replace')) # Decode assuming utf-8
            # If select times out, loop continues and checks stop_event
        wrapper.flush() # Send any remaining buffer
    except Exception as e:
        print(f"KERNEL PIPE READ ERROR ({stream_type}): {type(e).__name__}: {e}", file=original_stderr, flush=True)
    finally:
        os.close(pipe_fd) # Ensure pipe read end is closed

def execute_code_streaming(code_to_exec):
    """Executes code in a child process, capturing all FD 1/2 output via pipes."""

    stdout_r, stdout_w = os.pipe()
    stderr_r, stderr_w = os.pipe()
    pid = -1 # Initialize pid

    # Threading stop event
    stop_event = threading.Event()

    # Reader threads
    stdout_thread = threading.Thread(target=read_pipe_and_send, args=(stdout_r, 'stdout', stop_event))
    stderr_thread = threading.Thread(target=read_pipe_and_send, args=(stderr_r, 'stderr', stop_event))

    child_error_occurred = False
    child_exit_status = -1

    try:
        pid = os.fork()

        if pid == 0:
            # --- Child Process ---
            # Close pipe ends not used by child
            os.close(stdout_r)
            os.close(stderr_r)
            # Redirect child's stdout/stderr FDs to the pipes
            os.dup2(stdout_w, 1)
            os.dup2(stderr_w, 2)
            # Close original pipe write ends after dup2
            os.close(stdout_w)
            os.close(stderr_w)

            exit_code = 0
            try:
                # Execute the user's code
                compiled_exec = compile(code_to_exec, '<string>', 'exec')
                # IMPORTANT: exec runs in the *child's* scope. Changes won't affect the parent.
                # execution_scope is not shared here.
                exec(compiled_exec, execution_scope, execution_scope)
            except Exception:
                # Print traceback to the redirected stderr
                traceback.print_exc()
                exit_code = 1 # Indicate error
            finally:
                # Use os._exit to prevent finally blocks in parent from running
                os._exit(exit_code)
            # --- End Child Process ---

        else:
            # --- Parent Process ---
            # Close pipe ends not used by parent
            os.close(stdout_w)
            os.close(stderr_w)

            # Start reader threads
            stdout_thread.start()
            stderr_thread.start()

            # Wait for child process to complete
            _pid, status = os.waitpid(pid, 0)
            child_exit_status = os.waitstatus_to_exitcode(status) if os.WIFEXITED(status) else -1
            if child_exit_status != 0:
                 child_error_occurred = True
                 # Error details should have been captured by stderr pipe reader

            # Signal threads to stop and wait for them
            stop_event.set()
            stdout_thread.join()
            stderr_thread.join()

            # --- Post-Execution (Parent) ---

            # Handle plots (runs in parent, uses parent's scope - might be empty if plots depend on child state)
            # Note: If code saves plots to /output, this will still work.
            # If plots rely on variables computed in the child, they won't render here unless
            # some form of IPC is used (which we are avoiding for now).
            images_base64 = handle_plots()
            for img_b64 in images_base64:
                img_message = {'type': 'image', 'format': 'png', 'content': img_b64}
                json_img_message = json.dumps(img_message)
                print(json_img_message, file=original_stdout, flush=True)

            # Send final completion or error message based on child exit status
            if child_error_occurred:
                # Error details should have been sent via stderr thread already
                # Send a generic error completion message
                error_message = {
                    'type': 'error',
                    'message': f'Code execution failed with exit status {child_exit_status}. Check stderr output for details.',
                    'traceback': None # Traceback was sent via stderr stream
                }
                json_error_message = json.dumps(error_message)
                print(json_error_message, file=original_stdout, flush=True)
            else:
                # Send success completion message
                completion_message = {'type': 'result', 'output': {}} # Empty output dict signifies success
                json_completion_message = json.dumps(completion_message)
                print(json_completion_message, file=original_stdout, flush=True)

    except Exception as parent_error:
        # Catch errors in the parent process (forking, waiting, etc.)
        tb = traceback.format_exc()
        print(f"KERNEL PARENT ERROR: {type(parent_error).__name__}: {parent_error}\n{tb}", file=original_stderr, flush=True)
        # Try to send a structured error back to Node.js
        error_message = {
            'type': 'error',
            'message': f"Kernel internal error: {str(parent_error)}",
            'traceback': tb
        }
        try:
            print(json.dumps(error_message), file=original_stdout, flush=True)
        except Exception as report_err:
            print(f"KERNEL CRITICAL: Failed to send parent error JSON: {report_err}", file=original_stderr, flush=True)

    finally:
        # Ensure threads are signaled to stop even if parent errors occurred before join
        stop_event.set()
        # Clean up pipe FDs if they are still open (best effort)
        for fd in [stdout_r, stdout_w, stderr_r, stderr_w]:
            try:
                # Check if fd is valid before closing
                if os.isatty(fd) == False and fd >= 0: # Basic check
                   os.close(fd)
            except OSError:
                pass # Ignore errors on close (already closed, invalid fd)
        # Ensure child is terminated if parent errored before waitpid
        if pid > 0:
            try:
                os.kill(pid, 9) # Send SIGKILL if still running
                os.waitpid(pid, 0) # Reap zombie
            except OSError:
                pass # Ignore if already exited or doesn't exist


# --- Main Execution ---
if __name__ == "__main__":
    # Remove the capture_and_stream_stdio context manager as it's replaced by contextlib redirects
    # @contextlib.contextmanager
    # def capture_and_stream_stdio(): ... (Keep the definition but don't use it globally)

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
        except Exception:
            # If loading fails, send a structured error message back
            tb = traceback.format_exc()
            error_message = {
                'type': 'error',
                'message': f"Failed to load dataset '{os.path.basename(dataset_path)}': {str(sys.exc_info()[1])}",
                'traceback': tb,
                'context': 'initial_load' # Add context for the frontend/backend
            }
            try:
                print(json.dumps(error_message), file=original_stdout, flush=True)
            except Exception as report_err:
                # Fallback to original stderr if sending JSON fails
                print(f"KERNEL CRITICAL: Failed to send data load error JSON: {report_err}\nOriginal Traceback:\n{tb}", file=original_stderr, flush=True)
            # Kernel will still signal ready, but df will be None

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
