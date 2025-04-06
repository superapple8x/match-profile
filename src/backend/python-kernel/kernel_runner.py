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

def execute_code_streaming(code_to_exec):
    """Executes code, streams output/plots, captures last expression result, and sends completion/error messages."""
    captured_result = None
    try:
        # --- Execute the entire code block first ---
        compiled_exec = compile(code_to_exec, '<string>', 'exec')
        with capture_and_stream_stdio():
            exec(compiled_exec, execution_scope, execution_scope)
        # --- Execution finished (or raised exception handled below) ---

        # --- Try to capture the result of the last expression ---
        try:
            tree = ast.parse(code_to_exec)
            final_node = tree.body[-1] if tree.body else None
            if isinstance(final_node, ast.Expr):
                # Compile and evaluate the last expression *again* to capture its value
                eval_part = ast.Expression(final_node.value)
                compiled_eval_part = compile(eval_part, '<string>', 'eval')
                # Don't capture stdio here, just get the value
                captured_result = eval(compiled_eval_part, execution_scope, execution_scope)
        except Exception as eval_error:
            # Ignore errors during the re-evaluation phase, just means we couldn't capture
            print(f"KERNEL INFO: Could not capture final expression result: {eval_error}", file=original_stderr, flush=True)
            captured_result = None
        # --- End result capture ---


        # --- Send captured result if it exists and isn't None ---
        if captured_result is not None:
            try:
                # Use repr() for a generally useful string representation
                # Handle pandas DataFrames specifically for better output if needed (e.g., to_html)
                if isinstance(captured_result, pd.DataFrame):
                    # Option 1: Send HTML representation (requires frontend support)
                    # result_content = captured_result.to_html(max_rows=20, max_cols=10, border=0, classes='dataframe')
                    # result_mimetype = 'text/html'
                    # Option 2: Send string representation (more basic)
                    result_content = repr(captured_result)
                    result_mimetype = 'text/plain'
                elif isinstance(captured_result, (plt.Figure, plt.Axes)):
                     # If the result is a plot object itself, handle_plots should have caught it.
                     # Avoid sending the object representation here.
                     pass # Plot handled by handle_plots
                else:
                    result_content = repr(captured_result)
                    result_mimetype = 'text/plain'

                # Only send if we have content to display (avoid sending None repr or plot objects)
                if result_mimetype:
                    display_message = {
                        'type': 'display_data',
                        'content': result_content,
                        'mimetype': result_mimetype
                    }
                    print(json.dumps(display_message), file=original_stdout, flush=True)
            except Exception as display_err:
                 print(f"KERNEL WARNING: Failed to serialize/send captured result: {display_err}", file=original_stderr, flush=True)

        # Handle plots (check if any figures were created and not explicitly closed)
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
