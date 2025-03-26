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

  // Helper functions to apply meta classNames with defaults
  const getHeaderClassName = (header: Header<T, unknown>) => {
    return header.column.columnDef.meta?.className ?? 'px-4 py-3'; // Default padding
  };
  const getCellClassName = (cell: Cell<T, unknown>) => {
    return cell.column.columnDef.meta?.className ?? 'px-4 py-3'; // Default padding
  };


  return (
    // Main container div - Apply consistent glass effect
    <div className="w-full rounded-xl border border-gray-200/80 dark:border-gray-700/50 shadow-lg overflow-hidden backdrop-blur-md bg-white/70 dark:bg-gray-800/60 transition-all duration-300 ease-in-out hover:shadow-xl"> {/* Matched parent styles */}
      {/* Table container */}
      <div className="overflow-x-auto">
        {/* Adjusted table background for contrast */}
        <table className="w-full border-collapse bg-transparent text-left text-sm text-gray-800 dark:text-gray-200">
           {/* Refined header styling */}
           <thead className="bg-gray-100/80 dark:bg-gray-700/70 backdrop-blur-sm sticky top-0 z-10"> {/* Sticky header */}
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th
                    key={header.id}
                    colSpan={header.colSpan}
                    style={{ width: header.getSize() }}
                    className={`
                       ${getHeaderClassName(header)} /* Apply padding from meta */
                       font-semibold text-gray-700 dark:text-gray-100 /* Adjusted text color */
                       cursor-pointer select-none transition-colors duration-150
                       hover:bg-gray-200/70 dark:hover:bg-gray-600/60 /* Adjusted hover */
                       border-b border-gray-300/60 dark:border-gray-600/40 /* Subtle bottom border */
                       relative group
                     `}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center justify-between">
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                      {/* Refined sorting indicator */}
                      <span className="ml-2 inline-flex text-gray-400 dark:text-gray-500 transition-all duration-200 group-hover:text-primary-500 dark:group-hover:text-primary-400">
                        {
                          {
                            asc: '▲', // Use arrows
                            desc: '▼',
                          }[header.column.getIsSorted() as string] ?? <span className="opacity-0 group-hover:opacity-50">↕</span> // Placeholder for unsorted hover
                        }
                      </span>
                    </div>
                    {/* Refined resizing handle */}
                    {enableColumnResizing && (
                      <div
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        className={`
                          absolute top-0 right-0 h-full w-1.5 cursor-col-resize select-none touch-none
                          bg-gray-300/50 dark:bg-gray-600/50 opacity-0 group-hover:opacity-100 transition-opacity duration-150
                          ${header.column.getIsResizing() ? 'bg-primary-500 opacity-100' : ''} /* Use primary color when resizing */
                        `}
                      />
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          {/* Refined body styling */}
          <tbody className="divide-y divide-gray-200/70 dark:divide-gray-700/50">
            {table.getRowModel().rows.map(row => ( // <-- Renders only rows for the current page
              <tr
                key={row.id}
                className={`
                  transition-colors duration-150 ease-in-out
                  hover:bg-gray-100/60 dark:hover:bg-gray-700/50 /* Subtle hover */
                  ${row.getIsSelected() ? 'bg-primary-50/60 dark:bg-primary-900/30' : ''} /* Subtle selection */
                `}
              >
                {row.getVisibleCells().map(cell => (
                  <td
                    key={cell.id}
                    className={`
                      ${getCellClassName(cell)} /* Apply padding from meta */
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

      {/* Pagination Controls START - Refined Styling */}
      <div className="flex items-center justify-between p-3 border-t border-gray-200/80 dark:border-gray-700/50 bg-gray-50/80 dark:bg-gray-700/60 backdrop-blur-sm text-gray-600 dark:text-gray-300 text-sm sticky bottom-0 z-10"> {/* Sticky footer */}
        {/* Left Side: Row Selection Info (Optional) */}
        <div className="flex-1 min-w-0"> {/* Added min-w-0 for flex shrink */}
          {enableRowSelection && (
             <span className="truncate"> {/* Added truncate */}
               {Object.keys(rowSelection).length} of {table.getPrePaginationRowModel().rows.length} row(s) selected.
             </span>
           )}
        </div>

        {/* Center: Page Navigation */}
        <div className="flex items-center gap-1 mx-4"> {/* Added horizontal margin */}
          {/* Styled Buttons */}
          <button
            className="px-2 py-1 border border-gray-300/70 dark:border-gray-600/50 rounded-md disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-200/60 dark:hover:bg-gray-600/50 transition-all duration-150 ease-out active:scale-95 transform focus:outline-none focus:ring-1 focus:ring-primary-500"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
            aria-label="Go to first page"
          >
            {'<<'}
          </button>
          <button
            className="px-2 py-1 border border-gray-300/70 dark:border-gray-600/50 rounded-md disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-200/60 dark:hover:bg-gray-600/50 transition-all duration-150 ease-out active:scale-95 transform focus:outline-none focus:ring-1 focus:ring-primary-500"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            aria-label="Go to previous page"
          >
            {'<'}
          </button>
          <span className="mx-2 whitespace-nowrap"> {/* Added whitespace-nowrap */}
            Page{' '}
            <strong>
              {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
            </strong>
          </span>
          <button
            className="px-2 py-1 border border-gray-300/70 dark:border-gray-600/50 rounded-md disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-200/60 dark:hover:bg-gray-600/50 transition-all duration-150 ease-out active:scale-95 transform focus:outline-none focus:ring-1 focus:ring-primary-500"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            aria-label="Go to next page"
          >
            {'>'}
          </button>
          <button
            className="px-2 py-1 border border-gray-300/70 dark:border-gray-600/50 rounded-md disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-200/60 dark:hover:bg-gray-600/50 transition-all duration-150 ease-out active:scale-95 transform focus:outline-none focus:ring-1 focus:ring-primary-500"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
            aria-label="Go to last page"
          >
            {'>>'}
          </button>
        </div>

        {/* Right Side: Page Size Selector */}
        <div className="flex flex-1 justify-end items-center gap-2 min-w-0"> {/* Added min-w-0 */}
           <span className="whitespace-nowrap">Rows per page:</span> {/* Added whitespace-nowrap */}
           {/* Styled Select */}
           <select
             value={table.getState().pagination.pageSize}
             onChange={e => {
               table.setPageSize(Number(e.target.value))
             }}
             className="p-1.5 border border-gray-300/70 dark:border-gray-600/50 rounded-md bg-white/80 dark:bg-gray-700/80 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm transition-colors duration-150"
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
