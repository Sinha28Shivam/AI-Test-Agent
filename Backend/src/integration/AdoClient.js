/**
 * AdoClient interacts with the Azure DevOps REST API.
 * It uses the Personal Access Token (PAT) for basic authentication.
 */
class AdoClient {
  constructor(org, project, pat) {
    if (!org || !project || !pat) {
      throw new Error('Azure DevOps client requires organization, project, and PAT.');
    }
    this.org = org;
    this.project = project;
    this.baseUrl = `https://dev.azure.com/${org}/${encodeURIComponent(project)}`;
    
    // Auth header format for ADO: Basic Base64(":" + PAT)
    const token = Buffer.from(`:${pat}`).toString('base64');
    this.headers = {
      'Authorization': `Basic ${token}`,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Fetches the list of test cases in a Test Suite.
   * @param {string|number} planId - The Test Plan ID
   * @param {string|number} suiteId - The Test Suite ID
   * @returns {Promise<Array>} - List of test case descriptors { id, url, name }
   */
  async fetchTestCasesFromSuite(planId, suiteId) {
    const url = `${this.baseUrl}/_apis/test/Plans/${planId}/Suites/${suiteId}/testcases?api-version=7.0`;
    console.log(`[ADO Client] Fetching test cases from plan ${planId}, suite ${suiteId}...`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: this.headers
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch test cases from suite. Status ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    if (!data.value || !Array.isArray(data.value)) {
      return [];
    }

    return data.value.map(item => ({
      id: item.testCase?.id,
      url: item.testCase?.url,
      name: item.testCase?.name
    })).filter(tc => tc.id);
  }

  /**
   * Fetches work item details (Title, Description, and Steps) for a list of work item IDs.
   * @param {Array<string|number>} ids - Array of work item IDs
   * @returns {Promise<Array>} - List of work item details
   */
  async fetchWorkItemDetails(ids) {
    if (!ids || ids.length === 0) return [];
    
    const idList = ids.join(',');
    const fields = 'System.Title,System.Description,Microsoft.VSTS.TCM.Steps';
    const url = `${this.baseUrl}/_apis/wit/workitems?ids=${idList}&fields=${fields}&api-version=7.0`;
    
    console.log(`[ADO Client] Fetching work item details for IDs: ${idList}...`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: this.headers
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch work item details. Status ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    if (!data.value || !Array.isArray(data.value)) {
      return [];
    }

    return data.value.map(item => ({
      id: item.id,
      title: item.fields?.['System.Title'],
      description: item.fields?.['System.Description'] || '',
      stepsXml: item.fields?.['Microsoft.VSTS.TCM.Steps'] || ''
    }));
  }

  /**
   * Fetches all Test Points in a Test Suite.
   * @param {string|number} planId - The Test Plan ID
   * @param {string|number} suiteId - The Test Suite ID
   * @returns {Promise<Array>} - List of test points
   */
  async fetchSuitePoints(planId, suiteId) {
    const url = `${this.baseUrl}/_apis/test/Plans/${planId}/Suites/${suiteId}/points?api-version=7.0`;
    console.log(`[ADO Client] Fetching suite points. GET URL: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: this.headers
    });

    console.log(`[ADO Client] fetchSuitePoints response status: ${response.status}`);
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ADO Client Error] GET ${url} failed: ${errorText}`);
      throw new Error(`Failed to fetch suite points. Status ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    return data.value || [];
  }

  /**
   * Creates a new Test Run.
   * @param {string} runName - The name of the test run
   * @param {string|number} planId - The Test Plan ID
   * @param {Array<number>} pointIds - The Test Point IDs included in the run
   * @returns {Promise<Object>} - The created test run details
   */
  async createTestRun(runName, planId, pointIds) {
    const url = `${this.baseUrl}/_apis/test/runs?api-version=7.0`;
    console.log(`[ADO Client] Creating test run. POST URL: ${url}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        name: runName,
        plan: { id: planId.toString() },
        pointIds: pointIds,
        isAutomated: true
      })
    });

    console.log(`[ADO Client] createTestRun response status: ${response.status}`);
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ADO Client Error] POST ${url} failed: ${errorText}`);
      throw new Error(`Failed to create test run. Status ${response.status}: ${errorText}`);
    }

    return await response.json();
  }

  /**
   * Publishes test case results to a Test Run.
   * @param {string|number} runId - The Test Run ID
   * @param {Array<Object>} results - The test case outcomes and logs
   * @returns {Promise<Object>} - Response details
   */
  async publishTestResults(runId, results) {
    const url = `${this.baseUrl}/_apis/test/runs/${runId}/results?api-version=7.0`;
    console.log(`[ADO Client] Publishing test results. POST URL: ${url}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(results)
    });

    console.log(`[ADO Client] publishTestResults response status: ${response.status}`);
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ADO Client Error] POST ${url} failed: ${errorText}`);
      throw new Error(`Failed to publish test results. Status ${response.status}: ${errorText}`);
    }

    return await response.json();
  }

  /**
   * Marks a Test Run as completed.
   * @param {string|number} runId - The Test Run ID
   * @returns {Promise<Object>} - The updated test run details
   */
  async completeTestRun(runId) {
    const url = `${this.baseUrl}/_apis/test/runs/${runId}?api-version=7.0`;
    console.log(`[ADO Client] Completing test run. PATCH URL: ${url}`);
    
    const response = await fetch(url, {
      method: 'PATCH',
      headers: this.headers,
      body: JSON.stringify({
        state: 'Completed'
      })
    });

    console.log(`[ADO Client] completeTestRun response status: ${response.status}`);
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ADO Client Error] PATCH ${url} failed: ${errorText}`);
      throw new Error(`Failed to complete test run. Status ${response.status}: ${errorText}`);
    }

    return await response.json();
  }
}

export default AdoClient;
