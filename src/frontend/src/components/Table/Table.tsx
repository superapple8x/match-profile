import React, { useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  SortingState,
  ColumnDef,
  ColumnResizeMode,
  RowSelectionState,
} from '@tanstack/react-table';
import './Table.css';

interface TableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  darkMode?: boolean;
  enableRowSelection?: boolean;
  enableColumnResizing?: boolean;
  onRowSelectionChange?: (selected: T[]) => void;
}

export function Table<T>({ 
  data, 
  columns, 
  darkMode = false,
  enableRowSelection = false,
  enableColumnResizing = false,
  onRowSelectionChange
}: TableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [columnResizeMode] = useState<ColumnResizeMode>('onChange');

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      rowSelection,
    },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableRowSelection,
    enableColumnResizing,
    columnResizeMode,
  });

  React.useEffect(() => {
    if (onRowSelectionChange) {
      const selectedRows = table.getSelectedRowModel().flatRows.map(row => row.original);
      onRowSelectionChange(selectedRows);
    }
  }, [rowSelection]);

  return (
    <div className={`table-container ${darkMode ? 'dark' : ''}`}>
      <table className="table">
        <thead>
          {table.getHeaderGroups().map(headerGroup => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map(header => (
                <th
                  key={header.id}
                  colSpan={header.colSpan}
                  style={{ width: header.getSize() }}
                  className="header-cell"
                >
                  <div
                    onClick={header.column.getToggleSortingHandler()}
                    className="header-content"
                  >
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
                    <span className="sort-indicator">{
                      {
                        asc: ' 🔼',
                        desc: ' 🔽',
                      }[header.column.getIsSorted() as string] ?? null
                    }</span>
                  </div>
                  {enableColumnResizing && (
                    <div
                      onMouseDown={header.getResizeHandler()}
                      onTouchStart={header.getResizeHandler()}
                      className={`resizer ${header.column.getIsResizing() ? 'isResizing' : ''}`}
                    />
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map(row => (
            <tr 
              key={row.id} 
              className={`row ${row.getIsSelected() ? 'selected' : ''}`}
            >
              {row.getVisibleCells().map(cell => (
                <td key={cell.id} className="cell">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
