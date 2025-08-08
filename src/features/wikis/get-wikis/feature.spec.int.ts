import { getWikis } from './feature';
import { shouldSkipIntegrationTest } from '@/shared/test/test-helpers';
import { getOrgNameFromUrl } from '@/utils/environment';

describe('getWikis integration', () => {
  let projectName: string;
  let organizationId: string;

  beforeAll(async () => {
    // Get project name from environment variables
    projectName = process.env.AZURE_DEVOPS_DEFAULT_PROJECT || 'DefaultProject';

    // Get organization ID from URL
    const orgUrl =
      process.env.AZURE_DEVOPS_ORG_URL || 'https://example.visualstudio.com';
    organizationId = getOrgNameFromUrl(orgUrl);
  });

  test('should retrieve wikis from Azure DevOps', async () => {
    // Skip if integration tests are disabled
    if (shouldSkipIntegrationTest()) {
      return;
    }

    // Get the wikis using new API
    const resultJson = await getWikis({
      organizationId,
      projectId: projectName,
    });

    // Parse JSON result
    const result = JSON.parse(resultJson);

    // Verify the result structure
    expect(result).toBeDefined();
    expect(result).toHaveProperty('value');
    expect(result).toHaveProperty('count');
    expect(Array.isArray(result.value)).toBe(true);

    // If wikis exist, verify their structure
    if (result.value.length > 0) {
      const wiki = result.value[0];
      expect(wiki.name).toBeDefined();
      expect(wiki.id).toBeDefined();
      expect(wiki.type).toBeDefined();
    }
  });
});
