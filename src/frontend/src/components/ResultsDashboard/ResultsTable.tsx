import React, { useState, useEffect, useMemo } from 'react';
// Removed: import './ResultsTable.css';
import { Table } from '../Table/Table.tsx';
// Removed useNavigate import
import {
  createColumnHelper,
  ColumnDef,
  // Removed: flexRender (now handled inside Table.tsx)
  // Removed: getCoreRowModel, getSortedRowModel, useReactTable, SortingState
} from '@tanstack/react-table';

// Define the structure of the dataset attributes metadata
type DatasetAttribute = {
  originalName: string;
  sanitizedName: string;
  type: string;
};

// Update ResultData type to include profileData
type ResultData = {
  matchPercentage?: number;
  profileData: Record<string, any>; // Contains data with sanitized keys + DB id
  uniqueKey?: string; // Keep uniqueKey for the table
};

const columnHelper = createColumnHelper<ResultData>();

// Update props: accept datasetAttributes, remove filteredData
interface ResultsTableProps {
  results?: ResultData[];
  datasetAttributes: DatasetAttribute[]; // Add datasetAttributes prop
  onMatchClick?: (data: ResultData) => void;
}

// Update function signature
function ResultsTable({ results, datasetAttributes, onMatchClick }: ResultsTableProps) {
  const [data, setData] = useState<ResultData[]>([]);

  // Define columns based on datasetAttributes
  const columns = useMemo(() => {
    const cols: ColumnDef<ResultData, any>[] = [];

    // 1. Add Match Percentage column
    cols.push(columnHelper.accessor('matchPercentage', {
      id: 'matchPercentage',
      header: 'Match %',
      cell: info => {
        const value = info.getValue();
        // Check if value is a valid number before formatting
        if (typeof value === 'number' && !isNaN(value)) {
          return `${value.toFixed(1)}%`;
        }
        return '-'; // Fallback for undefined, null, NaN, or non-numeric types
      },
      enableSorting: true,
      size: 120, // Set default size
      meta: { className: 'px-4 py-2 text-center font-semibold' }
    }));

    // 2. Add Profile ID column (using original_row_index)
    cols.push(columnHelper.accessor(row => row.profileData['original_row_index'], {
        id: 'profileId',
        header: 'Profile ID', // Correct Header
        cell: info => String(info.getValue() ?? '-'),
        enableSorting: true,
        size: 100, // Set default size
        meta: { className: 'px-4 py-2 text-center' }
    }));

    // 3. Add Actions column
    if (onMatchClick) {
       cols.push(columnHelper.display({
         id: 'actions',
         header: 'Actions',
         size: 100, // Set default size
         cell: ({ row }) => (
           <button
             onClick={() => onMatchClick(row.original)}
             // Updated Details button style: subtle link-like appearance
             className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium text-sm transition-colors duration-150 ease-in-out focus:outline-none focus:ring-1 focus:ring-primary-500 rounded"
           >
             Details
           </button>
         ),
         meta: { className: 'px-4 py-2 text-center' }
       }));
     }

    return cols;
  // Update dependencies: datasetAttributes is now needed
  }, [results, datasetAttributes, onMatchClick]);

  // Process input data - Update uniqueKey generation
  useEffect(() => {
    const sourceData = results || []; // Use results directly, filteredData removed
    const processedData = sourceData.map((item) => ({
      ...item,
      // Use the database ID from profileData if available, otherwise fallback
      uniqueKey: String(item.profileData?.id ?? `fallback-${Math.random()}`)
    }));
    setData(processedData);
  }, [results]); // Update dependency

  // Removed handleViewChart function

  // Removed: useReactTable hook call

  if (data.length === 0) {
    return <div className="text-center py-10 text-gray-500 dark:text-gray-400">No results to display in table.</div>;
  }

  return (
    // Apply min-w-full to the wrapping div
    <div className="overflow-x-auto min-w-full">
      {/* Pass data and columns directly to the Table component */}
      <Table<ResultData> // Specify the type for the generic Table
        data={data}
        columns={columns}
        // Removed className prop from Table
        // Add other props Table might need
        // enableRowSelection={false} // Example: if row selection isn't needed here
      />
    </div>
  );
}

export default ResultsTable;
