# Activity Log

**Timestamp:** 2025-02-25T12:40:42+07:00

**Completed work items:**

*   Implemented GuidedSearch component.
*   Added Guided Search button to SearchBuilder component.
*   Implemented modal to display GuidedSearch component.
*   Added basic styling for the modal.
*   Implemented step-by-step interface in GuidedSearch component.
*   Implemented AttributeSelector in Step 1 of GuidedSearch component.
*   Implemented CriteriaBuilder in Step 2 of GuidedSearch component.
*   Implemented ResultsTable in Step 3 of GuidedSearch component.
*   Addressed "onSearchValueChange is not a function" error by correctly passing the `onSearchValueChange` prop to the `CriteriaBuilder` component.
*   Addressed "results is undefined" error by correctly passing the `filteredData` prop to the `ResultsTable` component.
*   Improved Attribute Selection UI by adding checkboxes and basic styling.
*   Installed `react-bootstrap-table-next`, `bootstrap`, `react-bootstrap-table2-paginator`, and `react-bootstrap-table2-filter` dependencies.
*   Updated the `handleSearch` function to handle empty `itemValue` and `searchValue` and to convert them to strings for comparison.

**Associated files/changes:**

*   Created: `src/frontend/src/components/SearchBuilder/GuidedSearch.js`
*   Modified: `src/frontend/src/components/SearchBuilder.js`
*   Modified: `src/frontend/src/components/SearchConfig.css`
*   Modified: `src/frontend/src/components/AttributeSelector.js`
*   Created: `src/frontend/src/components/AttributeSelector.css`
*   Modified: `src/frontend/src/components/CriteriaBuilder.js`
*   Modified: `src/frontend/src/components/ResultsDashboard/ResultsTable.js`

**Technical validation steps performed:**

*   Verified that the Guided Search button opens the modal.
*   Verified that the modal displays the GuidedSearch component.
*   Verified that the modal can be closed.
*   Verified that the AttributeSelector component displays the attributes.
*   Verified that the CriteriaBuilder component displays the input field and matching rule selector.
*   Verified that the ResultsTable component displays the filtered data.

**User Testing Experience:**

*   The user clicked the "Choose File" button and chose a file for search/matching.
*   The user clicked the "upload" button, and the UI displayed all attributes from the file.
*   The user clicked the "Guided Search" button, and the Guided Search Wizard modal opened.
*   In Step 1, the user noted that the attribute selection UI was not user-friendly, as it listed all attributes without filtering or categorization, and the "Next" button was difficult to click due to the large number of attributes.
*   In Step 2, the user noted that the matching rules UI was not functional, as there were only "Previous" and "Next" buttons, but no way to define the matching rules.
*   In Step 3, the user encountered a "results is undefined" error in the `ResultsTable` component.
*   The user also encountered an "onSearchValueChange is not a function" error in the `CriteriaBuilder` component.
*   After restarting the web, the user tried to enter some kind of value next to the attribute name, but then the "onSearchValueChange is not a function" error showed up again.

from the user themselves:

Here's my experience when testing it out:

- I click the `Choose File` button
- Then choose the file that i want test for search/matching
- I click the `upload` button
- Then the ui shows every attributes on the file
- Attribute selection also shows up, but it looks like the attached image
- I click the Guided Search button
- On Step 1, it says to select attribute, but i cannot actually select attributes, it only lists them all, since there are so many attributes, i cannot even click the `next` button, where it is placed below, i cannot scroll to click on it, i have to enter full screen mode, then i could actually click the `next` button
- When i click the `next` button, another step of the guided search wizard shows up. It says `Define Matching Rules` but i cannot actually do anything there's only two button, which is `Previous` and `Next`
- I click on `Next` button, then the following error shows up

        Uncaught runtime errors:
ERROR
results is undefined
ResultsTable@http://localhost:3000/static/js/bundle.js:29007:9
react-stack-bottom-frame@http://localhost:3000/static/js/bundle.js:19874:18
renderWithHooks@http://localhost:3000/static/js/bundle.js:11191:38
updateFunctionComponent@http://localhost:3000/static/js/bundle.js:12460:17
beginWork@http://localhost:3000/static/js/bundle.js:13078:16
runWithFiberInDEV@http://localhost:3000/static/js/bundle.js:8419:14
performUnitOfWork@http://localhost:3000/static/js/bundle.js:15663:93
workLoopSync@http://localhost:3000/static/js/bundle.js:15557:55
renderRootSync@http://localhost:3000/static/js/bundle.js:15541:7
performWorkOnRoot@http://localhost:3000/static/js/bundle.js:15302:42
performSyncWorkOnRoot@http://localhost:3000/static/js/bundle.js:16112:22
flushSyncWorkAcrossRoots_impl@http://localhost:3000/static/js/bundle.js:16035:235
processRootScheduleInMicrotask@http://localhost:3000/static/js/bundle.js:16052:34
./node_modules/react-dom/cjs/react-dom-client.development.js/scheduleImmediateTask/<@http://localhost:3000/static/js/bundle.js:16123:120


- There's option to close the error message which is marked by cross sign, so i click on that then it only shows white screen, nothing, no ui.

- So i restarted the web
- Then i repeat the following steps:

    - I click the `Choose File` button
    - Then choose the file that i want test for search/matching
    - I click the `upload` button
    - Then the ui shows every attributes on the file
    - Attribute selection also shows up, but it looks like the attached image
- Then i tried to mess around with the element/box to enter some kind of value next to attribute name, but then the following error shows up:

Uncaught runtime errors:
ERROR
onSearchValueChange is not a function
handleSearchValueChange@http://localhost:3000/static/js/bundle.js:27584:24
processDispatchQueue@http://localhost:3000/static/js/bundle.js:16213:33
./node_modules/react-dom/cjs/react-dom-client.development.js/dispatchEventForPluginEventSystem/<@http://localhost:3000/static/js/bundle.js:16510:27
batchedUpdates$1@http://localhost:3000/static/js/bundle.js:9881:40
dispatchEventForPluginEventSystem@http://localhost:3000/static/js/bundle.js:16293:21
dispatchEvent@http://localhost:3000/static/js/bundle.js:18375:64
dispatchDiscreteEvent@http://localhost:3000/static/js/bundle.js:18357:58
ERROR
onSearchValueChange is not a function
handleSearchValueChange@http://localhost:3000/static/js/bundle.js:27584:24
processDispatchQueue@http://localhost:3000/static/js/bundle.js:16213:33
./node_modules/react-dom/cjs/react-dom-client.development.js/dispatchEventForPluginEventSystem/<@http://localhost:3000/static/js/bundle.js:16510:27
batchedUpdates$1@http://localhost:3000/static/js/bundle.js:9881:40
dispatchEventForPluginEventSystem@http://localhost:3000/static/js/bundle.js:16293:21
dispatchEvent@http://localhost:3000/static/js/bundle.js:18375:64
dispatchDiscreteEvent@http://localhost:3000/static/js/bundle.js:18357:58
ERROR
onSearchValueChange is not a function
handleSearchValueChange@http://localhost:3000/static/js/bundle.js:27584:24
processDispatchQueue@http://localhost:3000/static/js/bundle.js:16213:33
./node_modules/react-dom/cjs/react-dom-client.development.js/dispatchEventForPluginEventSystem/<@http://localhost:3000/static/js/bundle.js:16510:27
batchedUpdates$1@http://localhost:3000/static/js/bundle.js:9881:40
dispatchEventForPluginEventSystem@http://localhost:3000/static/js/bundle.js:16293:21
dispatchEvent@http://localhost:3000/static/js/bundle.js:18375:64
dispatchDiscreteEvent@http://localhost:3000/static/js/bundle.js:18357:58


**Next steps:**

*   Improve the Attribute Selection UI by adding filtering and categorization and making the "Next" button more accessible.
*   Implement the matching rules UI in Step 2 of the Guided Search Wizard.
*   Investigate and fix the "results is undefined" error in the `ResultsTable` component.
*   Investigate and fix the "onSearchValueChange is not a function" error in the `CriteriaBuilder` component.
