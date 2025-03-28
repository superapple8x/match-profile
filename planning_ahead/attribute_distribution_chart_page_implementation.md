# Attribute Distribution Chart Page Implementation Plan

## Objective
Move the Attribute Distribution chart to its own page, accessible via navigation from the Results Table.

## Current Implementation
- Chart is rendered inline within ResultsTable.tsx
- Data is processed from search results
- Uses react-chartjs-2 for visualization

## Proposed Changes

### 1. Routing Setup
- Add new route in App.js
```js
{
  path: '/attribute-distribution',
  element: <AttributeDistributionPage />
}
```
- Configure React Router to handle the new route
- Pass matchResults data via route state

### 2. Create Page Component
- Create new file: `src/components/ResultsDashboard/AttributeDistributionPage.js`
```js
import AttributeDistributionChart from './AttributeDistributionChart';

function AttributeDistributionPage() {
  // Get data from route state
  // Handle loading/error states
  return (
    <div className="chart-page">
      <AttributeDistributionChart />
      <BackButton />
    </div>
  );
}
```

### 3. Update Data Flow
- Modify ResultsTable to prepare data for navigation
```js
const navigate = useNavigate();

const handleViewChart = () => {
  navigate('/attribute-distribution', {
    state: { matchResults: processedData }
  });
};
```

### 4. Navigation
- Add "View Attribute Distribution" button in ResultsTable
```js
<button onClick={handleViewChart}>
  View Attribute Distribution
</button>
```
- Implement back navigation
```js
<button onClick={() => navigate(-1)}>
  Back to Results
</button>
```

### 5. Update ResultsTable
- Remove inline AttributeDistributionChart component
- Update table layout
```js
// Remove:
<AttributeDistributionChart matchResults={matchResults} />
```

### 6. State Management
- Ensure data consistency between components
- Handle edge cases:
  - Empty data
  - Loading states
  - Error handling

## Implementation Steps
1. Create new page component
2. Set up routing
3. Update ResultsTable
4. Implement navigation
5. Test data flow
6. Add error handling
7. Update documentation

## Testing Plan
- Verify chart renders correctly on new page
- Test navigation between pages
- Validate data consistency
- Check edge cases
- Verify responsive design

## Documentation Updates
- Update component documentation
- Add new route to API docs
- Update user documentation