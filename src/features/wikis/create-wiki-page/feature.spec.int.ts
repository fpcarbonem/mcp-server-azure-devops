import { createWikiPage } from './feature';
import { CreateWikiPageSchema } from './schema';
import { getWikiPage } from '../get-wiki-page/feature';
import { getWikis } from '../get-wikis/feature';
import { shouldSkipIntegrationTest } from '@/shared/test/test-helpers';
import { getOrgNameFromUrl } from '@/utils/environment';
import { AzureDevOpsError } from '@/shared/errors/azure-devops-errors';
import { z } from 'zod';

// Ensure environment variables are set for testing
process.env.AZURE_DEVOPS_DEFAULT_PROJECT =
  process.env.AZURE_DEVOPS_DEFAULT_PROJECT || 'default-project';

describe('createWikiPage Integration Tests', () => {
  let projectName: string;
  let orgUrl: string;
  let organizationId: string;
  const testPagePath = '/IntegrationTestPage';
  const testPagePathSub = '/IntegrationTestPage/SubPage';
  const testPagePathDefault = '/DefaultPathPage';
  const testPagePathComment = '/CommentTestPage';

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
    organizationId = getOrgNameFromUrl(orgUrl);
  });

  // Helper function to get a valid wiki ID
  async function getValidWikiId(): Promise<string | null> {
    try {
      // Get available wikis using new API
      const wikisJson = await getWikis({
        organizationId,
        projectId: projectName,
      });

      // Parse JSON result
      const wikisResult = JSON.parse(wikisJson);

      // Skip if no wikis are available
      if (wikisResult.value.length === 0) {
        console.log('No wikis available in the project');
        return null;
      }

      // Use the first available wiki
      const wiki = wikisResult.value[0];
      if (!wiki.name) {
        console.log('Wiki name is undefined');
        return null;
      }

      return wiki.name;
    } catch (error) {
      console.error('Error getting wikis:', error);
      return null;
    }
  }

  test('should create a new wiki page at the root', async () => {
    // Skip if integration tests are disabled
    if (shouldSkipIntegrationTest()) {
      console.log('Skipping test due to missing connection');
      return;
    }

    // Get a valid wiki ID
    const wikiId = await getValidWikiId();
    if (!wikiId) {
      console.log('Skipping test: No valid wiki ID available');
      return;
    }

    const params: z.infer<typeof CreateWikiPageSchema> = {
      organizationId,
      projectId: projectName,
      wikiId,
      pagePath: testPagePath,
      content: 'This is content for the integration test page (root).',
    };

    try {
      // Create the wiki page
      const createdPageJson = await createWikiPage(params);
      const createdPage = JSON.parse(createdPageJson);

      // Verify the result
      expect(createdPage).toBeDefined();
      expect(createdPage.data).toBeDefined();
      expect(createdPage.data.path).toBe(testPagePath);
      expect(createdPage.data.content).toBe(params.content);
      expect(createdPage.metadata).toBeDefined();
      expect(createdPage.metadata.operation).toBe('create_wiki_page');

      // Verify by fetching the page
      const fetchedPageJson = await getWikiPage({
        organizationId,
        projectId: projectName,
        wikiId,
        pagePath: testPagePath,
      });

      // Parse fetched page JSON
      const fetchedPage = JSON.parse(fetchedPageJson);
      expect(fetchedPage).toBeDefined();
      expect(fetchedPage.content).toContain(params.content);
    } catch (error) {
      console.error('Error in test:', error);
      throw error;
    }
  });

  test('should create a new wiki sub-page', async () => {
    // Skip if integration tests are disabled
    if (shouldSkipIntegrationTest()) {
      console.log('Skipping test due to missing connection');
      return;
    }

    // Get a valid wiki ID
    const wikiId = await getValidWikiId();
    if (!wikiId) {
      console.log('Skipping test: No valid wiki ID available');
      return;
    }

    // First, ensure the parent page exists
    const parentParams: z.infer<typeof CreateWikiPageSchema> = {
      organizationId,
      projectId: projectName,
      wikiId,
      pagePath: testPagePath,
      content: 'This is the parent page for the sub-page test.',
    };

    try {
      // Create the parent page
      await createWikiPage(parentParams);

      // Now create the sub-page
      const subPageParams: z.infer<typeof CreateWikiPageSchema> = {
        organizationId,
        projectId: projectName,
        wikiId,
        pagePath: testPagePathSub,
        content: 'This is content for the integration test sub-page.',
      };

      const createdSubPageJson = await createWikiPage(subPageParams);
      const createdSubPage = JSON.parse(createdSubPageJson);

      // Verify the result
      expect(createdSubPage).toBeDefined();
      expect(createdSubPage.data).toBeDefined();
      expect(createdSubPage.data.path).toBe(testPagePathSub);
      expect(createdSubPage.data.content).toBe(subPageParams.content);

      // Verify by fetching the sub-page
      const fetchedSubPageJson = await getWikiPage({
        organizationId,
        projectId: projectName,
        wikiId,
        pagePath: testPagePathSub,
      });

      // Parse fetched page JSON
      const fetchedSubPage = JSON.parse(fetchedSubPageJson);
      expect(fetchedSubPage).toBeDefined();
      expect(fetchedSubPage.content).toContain(subPageParams.content);
    } catch (error) {
      console.error('Error in test:', error);
      throw error;
    }
  });

  test('should update an existing wiki page if path already exists', async () => {
    // Skip if integration tests are disabled
    if (shouldSkipIntegrationTest()) {
      console.log('Skipping test due to missing connection');
      return;
    }

    // Get a valid wiki ID
    const wikiId = await getValidWikiId();
    if (!wikiId) {
      console.log('Skipping test: No valid wiki ID available');
      return;
    }

    try {
      // First create a page with initial content
      const initialParams: z.infer<typeof CreateWikiPageSchema> = {
        organizationId,
        projectId: projectName,
        wikiId,
        pagePath: testPagePath,
        content: 'Initial content.',
      };

      await createWikiPage(initialParams);

      // Now update the page with new content
      const updatedParams: z.infer<typeof CreateWikiPageSchema> = {
        ...initialParams,
        content: 'Updated content for the page.',
      };

      const updatedPageJson = await createWikiPage(updatedParams);
      const updatedPage = JSON.parse(updatedPageJson);

      // Verify the result
      expect(updatedPage).toBeDefined();
      expect(updatedPage.data).toBeDefined();
      expect(updatedPage.data.path).toBe(testPagePath);
      expect(updatedPage.data.content).toBe(updatedParams.content);

      // Verify by fetching the page
      const fetchedPageJson = await getWikiPage({
        organizationId,
        projectId: projectName,
        wikiId,
        pagePath: testPagePath,
      });

      // Parse fetched page JSON
      const fetchedPage = JSON.parse(fetchedPageJson);
      expect(fetchedPage).toBeDefined();
      expect(fetchedPage.content).toContain(updatedParams.content);
    } catch (error) {
      console.error('Error in test:', error);
      throw error;
    }
  });

  test('should create a page with a default path if specified', async () => {
    // Skip if integration tests are disabled
    if (shouldSkipIntegrationTest()) {
      console.log('Skipping test due to missing connection');
      return;
    }

    // Get a valid wiki ID
    const wikiId = await getValidWikiId();
    if (!wikiId) {
      console.log('Skipping test: No valid wiki ID available');
      return;
    }

    try {
      const params: z.infer<typeof CreateWikiPageSchema> = {
        organizationId,
        projectId: projectName,
        wikiId,
        pagePath: testPagePathDefault,
        content: 'Content for page created with default path.',
      };

      const createdPageJson = await createWikiPage(params);
      const createdPage = JSON.parse(createdPageJson);

      // Verify the result
      expect(createdPage).toBeDefined();
      expect(createdPage.data).toBeDefined();
      expect(createdPage.data.path).toBe(testPagePathDefault);
      expect(createdPage.data.content).toBe(params.content);

      // Verify by fetching the page
      const fetchedPageJson = await getWikiPage({
        organizationId,
        projectId: projectName,
        wikiId,
        pagePath: testPagePathDefault,
      });

      // Parse fetched page JSON
      const fetchedPage = JSON.parse(fetchedPageJson);
      expect(fetchedPage).toBeDefined();
      expect(fetchedPage.content).toContain(params.content);
    } catch (error) {
      console.error('Error in test:', error);
      throw error;
    }
  });

  test('should include comment in the wiki page creation when provided', async () => {
    // Skip if integration tests are disabled
    if (shouldSkipIntegrationTest()) {
      console.log('Skipping test due to missing connection');
      return;
    }

    // Get a valid wiki ID
    const wikiId = await getValidWikiId();
    if (!wikiId) {
      console.log('Skipping test: No valid wiki ID available');
      return;
    }

    try {
      const params: z.infer<typeof CreateWikiPageSchema> = {
        organizationId,
        projectId: projectName,
        wikiId,
        pagePath: testPagePathComment,
        content: 'Content with comment.',
        comment: 'This is a test comment for the wiki page creation',
      };

      const createdPageJson = await createWikiPage(params);
      const createdPage = JSON.parse(createdPageJson);

      // Verify the result
      expect(createdPage).toBeDefined();
      expect(createdPage.data).toBeDefined();
      expect(createdPage.data.path).toBe(testPagePathComment);
      expect(createdPage.data.content).toBe(params.content);

      // Verify by fetching the page
      const fetchedPageJson = await getWikiPage({
        organizationId,
        projectId: projectName,
        wikiId,
        pagePath: testPagePathComment,
      });

      // Parse fetched page JSON
      const fetchedPage = JSON.parse(fetchedPageJson);
      expect(fetchedPage).toBeDefined();
      expect(fetchedPage.content).toContain(params.content);

      // Note: The API might not return the comment in the response
      // This test primarily verifies that including a comment doesn't break the API call
    } catch (error) {
      console.error('Error in test:', error);
      throw error;
    }
  });

  test('should handle error when wiki does not exist', async () => {
    // Skip if no connection is available
    if (shouldSkipIntegrationTest()) {
      console.log('Skipping test due to missing connection');
      return;
    }

    const nonExistentWikiId = 'non-existent-wiki-12345';

    const params: z.infer<typeof CreateWikiPageSchema> = {
      organizationId,
      projectId: projectName,
      wikiId: nonExistentWikiId,
      pagePath: '/test-page',
      content: 'This should fail.',
    };

    await expect(createWikiPage(params)).rejects.toThrow(AzureDevOpsError);
  });

  test('should handle error when project does not exist', async () => {
    // Skip if no connection is available
    if (shouldSkipIntegrationTest()) {
      console.log('Skipping test due to missing connection');
      return;
    }

    const nonExistentProjectId = 'non-existent-project-12345';

    const params: z.infer<typeof CreateWikiPageSchema> = {
      organizationId,
      projectId: nonExistentProjectId,
      wikiId: 'any-wiki',
      pagePath: '/test-page',
      content: 'This should fail.',
    };

    await expect(createWikiPage(params)).rejects.toThrow(AzureDevOpsError);
  });

  test('should handle error when organization does not exist', async () => {
    // Skip if no connection is available
    if (shouldSkipIntegrationTest()) {
      console.log('Skipping test due to missing connection');
      return;
    }

    const nonExistentOrgId = 'non-existent-org-12345';

    const params: z.infer<typeof CreateWikiPageSchema> = {
      organizationId: nonExistentOrgId,
      projectId: projectName,
      wikiId: 'any-wiki',
      pagePath: '/test-page',
      content: 'This should fail.',
    };

    await expect(createWikiPage(params)).rejects.toThrow(AzureDevOpsError);
  });
});
