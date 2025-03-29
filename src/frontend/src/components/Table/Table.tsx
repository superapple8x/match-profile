import React, { useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  useReactTable,
  SortingState,
  ColumnDef,
  ColumnResizeMode,
  RowSelectionState,
  PaginationState,
  Table as ReactTable,
  Header,
  Cell,
} from '@tanstack/react-table';
// Import Heroicons, using ChevronUpDownIcon as alternative
import { BarsArrowUpIcon, BarsArrowDownIcon, ChevronUpDownIcon } from '@heroicons/react/24/outline';


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
  initialPageSize?: number;
}

export function GenericTable<T>({
  data,
  columns,
  enableRowSelection = false,
  enableColumnResizing = false,
  onRowSelectionChange,
  initialPageSize = 10
}: TableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [columnResizeMode] = useState<ColumnResizeMode>('onChange');
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: initialPageSize,
  });

  const table: ReactTable<T> = useReactTable({
    data,
    columns,
    state: {
      sorting,
      rowSelection,
      pagination,
    },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableRowSelection,
    enableColumnResizing,
    columnResizeMode,
    getRowId: (row, index) => (row as any).id ?? `${index}`,
    // debugTable: true,
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
    <div className="w-full rounded-xl border border-gray-200/80 dark:border-gray-700/50 shadow-lg overflow-hidden backdrop-blur-md bg-indigo-100/60 dark:bg-gray-800/60 transition-all duration-300 ease-in-out hover:shadow-xl">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse bg-transparent text-left text-sm text-gray-800 dark:text-gray-200">
           <thead className="bg-indigo-100/80 dark:bg-gray-700/70 backdrop-blur-sm sticky top-0 z-10">
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th
                    key={header.id}
                    colSpan={header.colSpan}
                    style={{ width: header.getSize() }}
                    className={`
                       ${getHeaderClassName(header)}
                       font-semibold text-gray-700 dark:text-gray-100
                       cursor-pointer select-none transition-colors duration-150
                       hover:bg-indigo-200/70 dark:hover:bg-gray-600/60
                       border-b border-gray-300/60 dark:border-gray-600/40
                       relative group
                     `}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {/* Flex container to center content and place icon */}
                    <div className="flex items-center justify-center gap-2">
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                      {/* Sorting Indicator */}
                      {header.column.getCanSort() && (
                        <span className="inline-flex text-gray-400 dark:text-gray-500 transition-all duration-200 group-hover:text-indigo-500 dark:group-hover:text-indigo-400">
                          {header.column.getIsSorted() === 'asc' ? (
                            <BarsArrowUpIcon className="h-4 w-4" aria-label="Sorted ascending"/>
                          ) : header.column.getIsSorted() === 'desc' ? (
                            <BarsArrowDownIcon className="h-4 w-4" aria-label="Sorted descending"/>
                          ) : (
                            // Use ChevronUpDownIcon as alternative
                            <ChevronUpDownIcon className="h-4 w-4 opacity-0 group-hover:opacity-50" aria-label="Sortable"/>
                          )}
                        </span>
                      )}
                    </div>
                    {/* Resizing handle */}
                    {enableColumnResizing && header.column.getCanResize() && (
                      <div
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        className={`
                          absolute top-0 right-0 h-full w-1.5 cursor-col-resize select-none touch-none
                          bg-gray-300/50 dark:bg-gray-600/50 opacity-0 group-hover:opacity-100 transition-opacity duration-150
                          ${header.column.getIsResizing() ? 'bg-indigo-500 opacity-100' : ''}
                        `}
                      />
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-200/70 dark:divide-gray-700/50">
            {table.getRowModel().rows.map(row => (
              <tr
                key={row.id}
                className={`
                  transition-colors duration-150 ease-in-out
                  hover:bg-indigo-100/60 dark:hover:bg-gray-700/50
                  ${row.getIsSelected() ? 'bg-primary-100/60 dark:bg-primary-900/30' : ''}
                `}
              >
                {row.getVisibleCells().map(cell => (
                  <td
                    key={cell.id}
                    style={{ width: cell.column.getSize() }} // Apply size to cells too for consistency
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

      {/* Pagination Controls */}
      <div className="flex items-center justify-between p-3 border-t border-gray-200/80 dark:border-gray-700/50 bg-indigo-50/80 dark:bg-gray-700/60 backdrop-blur-sm text-gray-600 dark:text-gray-300 text-sm sticky bottom-0 z-10">
        <div className="flex-1 min-w-0">
          {enableRowSelection && (
             <span className="truncate">
               {Object.keys(rowSelection).length} of {table.getPrePaginationRowModel().rows.length} row(s) selected.
             </span>
           )}
        </div>
        <div className="flex items-center gap-1 mx-4">
          <button
            className="px-2 py-1 border border-gray-300/70 dark:border-gray-600/50 rounded-md disabled:opacity-40 disabled:cursor-not-allowed hover:bg-indigo-100/70 dark:hover:bg-gray-600/50 transition-all duration-150 ease-out active:scale-95 transform focus:outline-none focus:ring-1 focus:ring-primary-500"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
            aria-label="Go to first page"
          >
            {'<<'}
          </button>
          <button
            className="px-2 py-1 border border-gray-300/70 dark:border-gray-600/50 rounded-md disabled:opacity-40 disabled:cursor-not-allowed hover:bg-indigo-100/70 dark:hover:bg-gray-600/50 transition-all duration-150 ease-out active:scale-95 transform focus:outline-none focus:ring-1 focus:ring-primary-500"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            aria-label="Go to previous page"
          >
            {'<'}
          </button>
          <span className="mx-2 whitespace-nowrap">
            Page{' '}
            <strong>
              {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
            </strong>
          </span>
          <button
            className="px-2 py-1 border border-gray-300/70 dark:border-gray-600/50 rounded-md disabled:opacity-40 disabled:cursor-not-allowed hover:bg-indigo-100/70 dark:hover:bg-gray-600/50 transition-all duration-150 ease-out active:scale-95 transform focus:outline-none focus:ring-1 focus:ring-primary-500"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            aria-label="Go to next page"
          >
            {'>'}
          </button>
          <button
            className="px-2 py-1 border border-gray-300/70 dark:border-gray-600/50 rounded-md disabled:opacity-40 disabled:cursor-not-allowed hover:bg-indigo-100/70 dark:hover:bg-gray-600/50 transition-all duration-150 ease-out active:scale-95 transform focus:outline-none focus:ring-1 focus:ring-primary-500"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
            aria-label="Go to last page"
          >
            {'>>'}
          </button>
        </div>
        <div className="flex flex-1 justify-end items-center gap-2 min-w-0">
           <span className="whitespace-nowrap">Rows per page:</span>
           <select
             value={table.getState().pagination.pageSize}
             onChange={e => {
               table.setPageSize(Number(e.target.value))
             }}
             className="p-1.5 border border-indigo-200/70 dark:border-gray-600/50 rounded-md bg-indigo-50/80 dark:bg-gray-700/80 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm transition-colors duration-150"
           >
             {[10, 25, 50, 100].map(pageSize => (
               <option key={pageSize} value={pageSize}>
                 {pageSize}
               </option>
             ))}
           </select>
        </div>
      </div>
    </div>
  );
}

export { GenericTable as Table };
