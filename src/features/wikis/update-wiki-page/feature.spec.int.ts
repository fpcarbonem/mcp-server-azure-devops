import { updateWikiPage } from './feature';
import { shouldSkipIntegrationTest } from '@/shared/test/test-helpers';

describe('updateWikiPage integration', () => {
  let projectName: string;
  let organizationName: string;
  let wikiId: string;

  beforeAll(async () => {
    // Get project and organization from environment variables
    projectName = process.env.AZURE_DEVOPS_DEFAULT_PROJECT || 'DefaultProject';
    organizationName = process.env.AZURE_DEVOPS_ORGANIZATION || '';
    // Note: You'll need to set this to a valid wiki ID in your environment
    wikiId = `${projectName}.wiki`;
  });

  test('should update a wiki page in Azure DevOps', async () => {
    // Skip if integration tests are disabled
    if (shouldSkipIntegrationTest()) {
      return;
    }

    // Skip if no wiki ID is provided
    if (!wikiId) {
      console.log('Skipping test: No wiki ID provided');
      return;
    }

    const testPagePath = '/test-page';
    const testContent = '# Test Content\nThis is a test update.';
    const testComment = 'Test update from integration test';

    // Update the wiki page
    const resultJson = await updateWikiPage({
      organizationId: organizationName,
      projectId: projectName,
      wikiId: wikiId,
      pagePath: testPagePath,
      content: testContent,
      comment: testComment,
    });

    // Parse JSON result
    const result = JSON.parse(resultJson);

    // Verify the result
    expect(result).toBeDefined();
    expect(result.data).toBeDefined();
    expect(result.data.path).toBe(testPagePath);
    expect(result.data.content).toBe(testContent);
    expect(result.metadata).toBeDefined();
    expect(result.metadata.operation).toBe('update_wiki_page');
  });
});
