import React, { useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel, // <-- Add pagination model
  // Removed getFilteredRowModel for now, can add later if filtering is needed
  useReactTable,
  SortingState,
  ColumnDef,
  ColumnResizeMode,
  RowSelectionState,
  PaginationState, // <-- Add pagination state type
  Table as ReactTable,
  Header,
  Cell,
} from '@tanstack/react-table';

// Define a type for the meta property to pass classNames
declare module '@tanstack/react-table' {
  interface ColumnMeta<TData extends unknown, TValue> {
    className?: string;
  }
}

interface TableProps<T> {
  data: T[];
  columns: ColumnDef<T, any>[];
  enableRowSelection?: boolean;
  enableColumnResizing?: boolean;
  onRowSelectionChange?: (selected: T[]) => void;
  initialPageSize?: number; // Allow setting initial page size
}

export function GenericTable<T>({
  data,
  columns,
  enableRowSelection = false,
  enableColumnResizing = false,
  onRowSelectionChange,
  initialPageSize = 10 // Default page size
}: TableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [columnResizeMode] = useState<ColumnResizeMode>('onChange');
  const [pagination, setPagination] = useState<PaginationState>({ // <-- Add pagination state
    pageIndex: 0, //initial page index
    pageSize: initialPageSize, //initial page size
  });

  const table: ReactTable<T> = useReactTable({
    data,
    columns,
    state: {
      sorting,
      rowSelection,
      pagination, // <-- Pass pagination state to table
    },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination, // <-- Add handler for pagination changes
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(), // <-- Add pagination model
    enableRowSelection,
    enableColumnResizing,
    columnResizeMode,
    getRowId: (row, index) => (row as any).id ?? `${index}`,
    // debugTable: true, // Uncomment for debugging
  });

  React.useEffect(() => {
    if (onRowSelectionChange) {
      const selectedRows = table.getSelectedRowModel().flatRows.map(row => row.original);
      onRowSelectionChange(selectedRows);
    }
  }, [rowSelection, onRowSelectionChange, table]);

  const getHeaderClassName = (header: Header<T, unknown>) => {
    return header.column.columnDef.meta?.className ?? 'px-4 py-3';
  };
  const getCellClassName = (cell: Cell<T, unknown>) => {
    return cell.column.columnDef.meta?.className ?? 'px-4 py-3';
  };


  return (
    // Main container div
    <div className="w-full rounded-lg border border-gray-200 dark:border-gray-700 shadow-md overflow-hidden"> {/* Added overflow-hidden */}
      {/* Table container */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse bg-white dark:bg-gray-800 text-left text-sm text-gray-800 dark:text-gray-200">
          {/* ... (thead and tbody remain the same) ... */}
           <thead className="bg-gray-50 dark:bg-gray-700">
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th
                    key={header.id}
                    colSpan={header.colSpan}
                    style={{ width: header.getSize() }}
                    className={`
                      ${getHeaderClassName(header)}
                      font-semibold text-gray-900 dark:text-gray-100
                      cursor-pointer select-none transition-colors duration-200
                      hover:bg-gray-100 dark:hover:bg-gray-600
                      active:bg-gray-200 dark:active:bg-gray-500
                      relative group
                    `}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center justify-between">
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                      <span className="ml-2 inline-flex text-teal-500 dark:text-teal-400 transition-transform duration-200 group-hover:scale-110">
                        {
                          {
                            asc: '🔼',
                            desc: '🔽',
                          }[header.column.getIsSorted() as string] ?? null
                        }
                      </span>
                    </div>
                    {enableColumnResizing && (
                      <div
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        className={`
                          absolute top-0 right-0 h-full w-1 cursor-col-resize select-none touch-none
                          bg-gray-300 dark:bg-gray-600 opacity-0 group-hover:opacity-100
                          ${header.column.getIsResizing() ? 'bg-blue-500 opacity-100' : ''}
                        `}
                      />
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700 border-t border-gray-100 dark:border-gray-700">
            {table.getRowModel().rows.map(row => ( // <-- Renders only rows for the current page
              <tr
                key={row.id}
                className={`
                  transition-colors duration-150
                  hover:bg-gray-50 dark:hover:bg-gray-700/50
                  ${row.getIsSelected() ? 'bg-blue-50 dark:bg-blue-900/30' : ''}
                `}
              >
                {row.getVisibleCells().map(cell => (
                  <td
                    key={cell.id}
                    className={`
                      ${getCellClassName(cell)}
                      transition-colors duration-150
                    `}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls START */}
      <div className="flex items-center justify-between p-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-sm">
        {/* Left Side: Row Selection Info (Optional) */}
        <div className="flex-1">
          {enableRowSelection && (
             <span>
               {Object.keys(rowSelection).length} of {table.getPrePaginationRowModel().rows.length} row(s) selected.
             </span>
           )}
        </div>

        {/* Center: Page Navigation */}
        <div className="flex items-center gap-1">
          <button
            className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
            aria-label="Go to first page"
          >
            {'<<'}
          </button>
          <button
            className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            aria-label="Go to previous page"
          >
            {'<'}
          </button>
          <span className="mx-2">
            Page{' '}
            <strong>
              {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
            </strong>
          </span>
          <button
            className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            aria-label="Go to next page"
          >
            {'>'}
          </button>
          <button
            className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
            aria-label="Go to last page"
          >
            {'>>'}
          </button>
        </div>

        {/* Right Side: Page Size Selector */}
        <div className="flex flex-1 justify-end items-center gap-2">
           <span>Rows per page:</span>
           <select
             value={table.getState().pagination.pageSize}
             onChange={e => {
               table.setPageSize(Number(e.target.value))
             }}
             className="p-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
           >
             {[10, 25, 50, 100].map(pageSize => (
               <option key={pageSize} value={pageSize}>
                 {pageSize}
               </option>
             ))}
           </select>
        </div>
      </div>
      {/* Pagination Controls END */}
    </div> // End main container div
  );
}

// Exporting with the original name 'Table' for compatibility
export { GenericTable as Table };
