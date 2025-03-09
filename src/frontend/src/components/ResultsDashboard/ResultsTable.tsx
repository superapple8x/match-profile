import React, { useState, useEffect, useMemo } from 'react';
import './ResultsTable.css';
import { Table } from '../Table/Table.tsx';
import {
  createColumnHelper,
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  SortingState
} from '@tanstack/react-table';

type ResultData = {
  matchPercentage?: number;
  profile?: Record<string, any>;
  [key: string]: any;
};

const columnHelper = createColumnHelper<ResultData>();

interface ResultsTableProps {
  results?: ResultData[];
  filteredData?: ResultData[];
  onMatchClick?: (data: ResultData) => void;
  darkMode?: boolean;
}

function ResultsTable({ results, filteredData, onMatchClick, darkMode = false }: ResultsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [data, setData] = useState<ResultData[]>([]);
  
  // Define columns with proper typing
  const columns = useMemo(() => {
    const cols: ColumnDef<ResultData>[] = [];
    const showMatchPercentage = results && Array.isArray(results);
    const firstItem = data[0] || {};

    if (showMatchPercentage) {
      cols.push(columnHelper.accessor(row => row.matchPercentage, {
        id: 'matchPercentage',
        header: 'Match %',
        cell: info => `${info.getValue()?.toFixed(2)}%`,
        enableSorting: true
      }));
    }

    if (firstItem.profile) {
      Object.keys(firstItem.profile).forEach(key => {
        cols.push(columnHelper.accessor(row => row.profile?.[key], {
          id: `profile.${key}`,
          header: key,
          enableSorting: true
        }));
      });
    } else {
      Object.keys(firstItem).forEach(key => {
        if (key !== 'matchPercentage' || !showMatchPercentage) {
          cols.push(columnHelper.accessor(row => row[key], {
            id: key,
            header: key,
            enableSorting: true
          }));
        }
      });
    }

    return cols;
  }, [data, results]);

  // Process input data
  useEffect(() => {
    const processedData = (results || filteredData || []).map((item, index) => ({
      ...item,
      uniqueKey: `${index}-${item.matchPercentage || '0'}`
    }));
    setData(processedData);
  }, [results, filteredData]);


  // Create table instance with proper typing
  const table = useReactTable<ResultData>({
    data,
    columns,
    state: {
      sorting
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel()
  });

  if (data.length === 0) {
    return <div>No data to display.</div>;
  }

  return (
    <Table
      data={data}
      columns={columns}
      darkMode={darkMode}
    />
  );
}

export default ResultsTable;
