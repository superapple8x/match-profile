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

type ResultData = {
  matchPercentage?: number;
  profile?: Record<string, any>;
  [key: string]: any; // Includes uniqueKey added later
};

const columnHelper = createColumnHelper<ResultData>();

interface ResultsTableProps {
  results?: ResultData[];
  filteredData?: ResultData[];
  onMatchClick?: (data: ResultData) => void;
}

function ResultsTable({ results, filteredData, onMatchClick }: ResultsTableProps) {
  // Removed: sorting state
  const [data, setData] = useState<ResultData[]>([]);
  // Removed navigate variable

  // Define columns - This logic remains the same
  const columns = useMemo(() => {
    const cols: ColumnDef<ResultData, any>[] = []; // Explicitly type value as any
    const showMatchPercentage = results && results.length > 0 && results[0]?.matchPercentage !== undefined;
    const firstItem = data[0] || {};

    if (showMatchPercentage) {
      cols.push(columnHelper.accessor(row => row.matchPercentage, {
        id: 'matchPercentage',
        header: 'Match %',
        cell: info => info.getValue() !== undefined ? `${info.getValue()?.toFixed(1)}%` : '-',
        enableSorting: true,
        meta: { className: 'w-24 text-right pr-4 font-semibold' } // Styling handled in Table.tsx
      }));
    }

    const dataKeys = firstItem.profile ? Object.keys(firstItem.profile) : Object.keys(firstItem);
    const dataAccessor = (row: ResultData, key: string) => firstItem.profile ? row.profile?.[key] : row[key];

    dataKeys.forEach(key => {
      if ((key === 'matchPercentage' && showMatchPercentage) || key === 'uniqueKey') {
        return;
      }
      cols.push(columnHelper.accessor(row => dataAccessor(row, key), {
        id: key,
        header: key.charAt(0).toUpperCase() + key.slice(1),
        cell: info => String(info.getValue() ?? '-'),
        enableSorting: true,
        meta: { className: 'whitespace-nowrap px-3 py-2' } // Styling handled in Table.tsx
      }));
    });

    if (onMatchClick) {
       cols.push(columnHelper.display({
         id: 'actions',
         header: 'Actions',
         cell: ({ row }) => (
           <button
             onClick={() => onMatchClick(row.original)}
             // Updated Details button style: subtle link-like appearance
             className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium text-sm transition-colors duration-150 ease-in-out focus:outline-none focus:ring-1 focus:ring-primary-500 rounded"
           >
             Details
           </button>
         ),
         meta: { className: 'w-20 text-center' } // Styling handled in Table.tsx
       }));
     }

    return cols;
  }, [data, results, onMatchClick]);

  // Process input data - This logic remains the same
  useEffect(() => {
    const sourceData = results || filteredData || [];
    const processedData = sourceData.map((item, index) => ({
      ...item,
      uniqueKey: item.id || `${index}-${JSON.stringify(item)}` // Add uniqueKey here
    }));
    setData(processedData);
  }, [results, filteredData]);

  // Removed handleViewChart function

  // Removed: useReactTable hook call

  if (data.length === 0) {
    return <div className="text-center py-10 text-gray-500 dark:text-gray-400">No results to display in table.</div>;
  }

  return (
    <div className="overflow-x-auto">
      {/* Removed the "View Attribute Distribution" button and its container div */}
      {/* Pass data and columns directly to the Table component */}
      <Table<ResultData> // Specify the type for the generic Table
        data={data}
        columns={columns}
        // Add other props Table might need, e.g., enable sorting/resizing if needed
        // enableRowSelection={false} // Example: if row selection isn't needed here
      />
    </div>
  );
}

export default ResultsTable;
