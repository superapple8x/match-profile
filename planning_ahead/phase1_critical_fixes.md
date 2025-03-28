# Phase 1: Fix Critical Issues

This document outlines the detailed plan to address the critical issues in the Profile Matching Application.

## 1.1 Fix ResultsTable Sorting Functionality

The current implementation has several issues:

*   `remote.sort` is set to true, but there's no server-side sorting implementation
*   The table data isn't being sorted locally when sort state changes

**Solution:**

1.  Implement local sorting in the ResultsTable component:

    ```javascript
    // Add this effect to sort data locally
    useEffect(() => {
      if (tableData.length > 0) {
        const sortedData = [...tableData].sort((a, b) => {
          const aValue = getNestedValue(a, sortState.dataField);
          const bValue = getNestedValue(b, sortState.dataField);

          if (sortState.order === 'asc') {
            return aValue > bValue ? 1 : -1;
          } else {
            return aValue < bValue ? 1 : -1;
          }
        });

        setTableData(sortedData);
      }
    }, [sortState]);

    // Helper function to get nested values (e.g., profile.name)
    const getNestedValue = (obj, path) => {
      const keys = path.split('.');
      return keys.reduce((o, key) => (o && o[key] !== undefined) ? o[key] : null, obj);
    };
    ```

2.  Set `remote.sort` to false to use client-side sorting:

    ```javascript
    <BootstrapTable
      bootstrap4
      keyField={keyField}
      data={tableData}
      columns={columns}
      defaultSorted={[sortState]}
      onTableChange={handleTableChange}
      remote={{ sort: false }} // Change to false for client-side sorting
    />
    ```

## 1.2 Fix Component Prop Issues

1.  Fix AttributeSelector component:

    *   Add prop validation and fallbacks
    *   Ensure proper event handling

2.  Fix CriteriaBuilder component:

    *   Add prop validation for onSearchValueChange
    *   Fix dependency arrays in useCallback hooks

3.  Fix SearchBuilder and GuidedSearch components:

    *   Ensure proper prop passing
    *   Fix modal display issues

### Detailed Steps:

1.  **ResultsTable.js**:
    *   Modify the `ResultsTable` component to implement local sorting using the `useEffect` hook and the `getNestedValue` helper function.
    *   Set the `remote.sort` property to `false` in the `BootstrapTable` component.
2.  **AttributeSelector.js**:
    *   Add prop validation to ensure that `onAttributeSelect` and `onAttributeDeselect` are functions.
    *   Provide fallback functions if the props are not provided.
3.  **CriteriaBuilder.js**:
    *   Add prop validation to ensure that `onSearchValueChange` is a function.
    *   Provide a fallback function if the prop is not provided.
4.  **GuidedSearch.js**:
    *   Update the `useCallback` hooks to include the correct dependencies.
5.  **SearchBuilder.js**:
    *   Ensure that the `AttributeSelector` and `CriteriaBuilder` components are receiving the correct props.
    *   Fix any modal display issues.

### Testing:

1.  Verify that the sort functionality now works correctly for all columns in the ResultsTable component.
2.  Verify that the sort order is correctly updated when a column header is clicked.
3.  Test the sort functionality with different data sets and search criteria to identify any patterns or edge cases.
4.  Verify that the AttributeSelector and CriteriaBuilder components are working correctly and that no errors are thrown.
5.  Verify that the GuidedSearch modal is displaying correctly and that the search functionality is working as expected.
