import React from 'react'; // Removed useState, useEffect, useCallback
import PropTypes from 'prop-types';
// import { v4 as uuidv4 } from 'uuid'; // No longer needed here
import NotebookCell from './NotebookCell';
import { PlusCircleIcon } from '@heroicons/react/24/outline';

// Receive cells state and handlers from parent
function CodeNotebook({ sessionId, datasetId, cells, onAddCell, onDeleteCell, onCodeChange }) {
  // const [cells, setCells] = useState([]); // State lifted to parent

  // Initialization logic moved to parent (DataAnalysisPage)

  // Cell management handlers are now passed as props:
  // onAddCell
  // onDeleteCell
  // onCodeChange

  return (
    <div className="p-4 bg-gray-100 dark:bg-gray-900 h-full overflow-y-auto">
       <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
           Python Notebook {datasetId ? <span className="text-sm font-normal text-gray-500 dark:text-gray-400">({datasetId})</span> : ''}
       </h2>

      {/* Render Cells */}
      {cells.map((cell) => (
        <NotebookCell
          key={cell.id}
          cellData={cell} // cellData contains { id, code }
          sessionId={sessionId}
          datasetId={datasetId} // Pass datasetId down
          onCodeChange={onCodeChange} // Pass the prop received from parent
          onDeleteCell={onDeleteCell} // Use prop
        />
      ))}

      {/* Add Cell Button */}
      <div className="mt-4 flex justify-center">
        <button
          onClick={onAddCell} // Use prop
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-900 disabled:opacity-50"
          disabled={!sessionId} // Disable if session isn't ready
          title={!sessionId ? "Waiting for session..." : "Add new code cell"}
        >
          <PlusCircleIcon className="h-5 w-5 mr-2" />
          Add Cell
        </button>
      </div>
    </div>
  );
}

CodeNotebook.propTypes = {
  sessionId: PropTypes.string, // Can be null while session is starting
  datasetId: PropTypes.string,
  // initialCode prop removed, handled by parent
  cells: PropTypes.arrayOf(PropTypes.shape({
      id: PropTypes.string.isRequired,
      code: PropTypes.string.isRequired,
  })).isRequired,
  onAddCell: PropTypes.func.isRequired,
  onDeleteCell: PropTypes.func.isRequired,
  onCodeChange: PropTypes.func.isRequired,
};

export default CodeNotebook;
