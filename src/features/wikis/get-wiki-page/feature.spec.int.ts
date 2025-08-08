import { getWikiPage } from './feature';
import { getWikis } from '../get-wikis/feature';
import { shouldSkipIntegrationTest } from '@/shared/test/test-helpers';
import { getOrgNameFromUrl } from '@/utils/environment';

process.env.AZURE_DEVOPS_DEFAULT_PROJECT =
  process.env.AZURE_DEVOPS_DEFAULT_PROJECT || 'default-project';

describe('getWikiPage integration', () => {
  let projectName: string;
  let orgUrl: string;

  beforeAll(async () => {
    // Mock the required environment variable for testing
    process.env.AZURE_DEVOPS_ORG_URL =
      process.env.AZURE_DEVOPS_ORG_URL || 'https://example.visualstudio.com';

    // Get and validate required environment variables
    const envProjectName = process.env.AZURE_DEVOPS_DEFAULT_PROJECT;
    if (!envProjectName) {
      throw new Error(
        'AZURE_DEVOPS_DEFAULT_PROJECT environment variable is required',
      );
    }
    projectName = envProjectName;

    const envOrgUrl = process.env.AZURE_DEVOPS_ORG_URL;
    if (!envOrgUrl) {
      throw new Error('AZURE_DEVOPS_ORG_URL environment variable is required');
    }
    orgUrl = envOrgUrl;
  });

  test('should retrieve a wiki page', async () => {
    // Skip if integration tests are disabled
    if (shouldSkipIntegrationTest()) {
      return;
    }

    // First get available wikis using new API
    const wikisJson = await getWikis({
      organizationId: getOrgNameFromUrl(orgUrl),
      projectId: projectName,
    });

    // Parse JSON result
    const wikisResult = JSON.parse(wikisJson);

    // Skip if no wikis are available
    if (wikisResult.value.length === 0) {
      console.log('Skipping test: No wikis available in the project');
      return;
    }

    // Use the first available wiki
    const wiki = wikisResult.value[0];
    if (!wiki.name) {
      throw new Error('Wiki name is undefined');
    }

    // Get the wiki page
    const result = await getWikiPage({
      organizationId: getOrgNameFromUrl(orgUrl),
      projectId: projectName,
      wikiId: wiki.name,
      pagePath: '/test',
    });

    // Verify the result
    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
  });
});
