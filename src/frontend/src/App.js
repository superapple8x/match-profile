import FileImport from './components/FileImport';
import SearchConfig from './components/SearchConfig';
import ResultsDashboard from './components/ResultsDashboard';
import SavedSearches from './components/SavedSearches';
import './App.css';

function App() {
  return (
    <div>
      <FileImport />
      <SearchConfig />
      <ResultsDashboard />
      <SavedSearches />
    </div>
  );
}

export default App;
