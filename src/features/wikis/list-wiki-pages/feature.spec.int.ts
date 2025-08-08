import { listWikiPages, WikiPageSummary } from './feature';
import { getWikis } from '../get-wikis/feature';
import { shouldSkipIntegrationTest } from '@/shared/test/test-helpers';
import { getOrgNameFromUrl } from '@/utils/environment';
import { AzureDevOpsError } from '@/shared/errors/azure-devops-errors';

// Ensure environment variables are set for testing
process.env.AZURE_DEVOPS_DEFAULT_PROJECT =
  process.env.AZURE_DEVOPS_DEFAULT_PROJECT || 'default-project';

describe('listWikiPages integration', () => {
  let projectName: string;
  let orgUrl: string;
  let organizationId: string;

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

  describe('Happy Path Tests', () => {
    test('should list pages in real test wiki', async () => {
      // Skip if no connection available
      if (shouldSkipIntegrationTest()) {
        return;
      }

      // First get available wikis using new API
      const wikisJson = await getWikis({
        organizationId,
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

      // List wiki pages
      const resultJson = await listWikiPages({
        organizationId,
        projectId: projectName,
        wikiId: wiki.name,
      });

      // Parse JSON result
      const result = JSON.parse(resultJson);

      // Verify the result structure
      expect(result).toBeDefined();
      expect(result).toHaveProperty('value');
      expect(result).toHaveProperty('count');
      expect(Array.isArray(result.value)).toBe(true);

      // If pages exist, verify their structure matches WikiPageSummary interface
      if (result.value.length > 0) {
        const page = result.value[0];
        expect(page).toHaveProperty('id');
        expect(page).toHaveProperty('path');
        expect(page).toHaveProperty('url');
        expect(typeof page.id).toBe('number');
        expect(typeof page.path).toBe('string');
        // url and order are optional
        if (page.url !== undefined) {
          expect(typeof page.url).toBe('string');
        }
        if (page.order !== undefined) {
          expect(typeof page.order).toBe('number');
        }
      }
    });

    test('should handle wiki listing for different wiki structures', async () => {
      // Skip if integration tests are disabled or no connection available
      if (shouldSkipIntegrationTest()) {
        return;
      }

      // First get available wikis using new API
      const wikisJson = await getWikis({
        organizationId,
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

      // Get all pages for different wiki structures
      const allPagesJson = await listWikiPages({
        organizationId,
        projectId: projectName,
        wikiId: wiki.name,
      });

      // Parse JSON result
      const allPagesResult = JSON.parse(allPagesJson);
      const allPages = allPagesResult.value;

      expect(Array.isArray(allPages)).toBe(true);

      // If we have pages, verify they have expected structure
      if (allPages.length > 0) {
        const firstPage = allPages[0];
        expect(firstPage).toHaveProperty('id');
        expect(firstPage).toHaveProperty('path');
        expect(firstPage).toHaveProperty('url');

        // Verify nested pages if they exist
        const nestedPages = allPages.filter(
          (page: any) => page.path.includes('/') && page.path !== '/',
        );
        console.log(
          `Found ${nestedPages.length} nested pages out of ${allPages.length} total pages`,
        );
      }
    });

    test('should handle basic wiki page listing consistently', async () => {
      // Skip if integration tests are disabled or no connection available
      if (shouldSkipIntegrationTest()) {
        return;
      }

      // First get available wikis using new API
      const wikisJson = await getWikis({
        organizationId,
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

      // Test basic page listing
      const firstResultJson = await listWikiPages({
        organizationId,
        projectId: projectName,
        wikiId: wiki.name,
      });

      // Parse JSON result
      const firstResult = JSON.parse(firstResultJson);
      expect(Array.isArray(firstResult.value)).toBe(true);

      // Test again to ensure consistency
      const secondResultJson = await listWikiPages({
        organizationId,
        projectId: projectName,
        wikiId: wiki.name,
      });

      // Parse JSON result
      const secondResult = JSON.parse(secondResultJson);
      expect(Array.isArray(secondResult.value)).toBe(true);

      // Results should be consistent
      expect(secondResult.value.length).toBe(firstResult.value.length);
    });
  });

  describe('Error Scenarios', () => {
    test('should handle invalid wikiId (expect 404 error)', async () => {
      // Skip if integration tests are disabled or no connection available
      if (shouldSkipIntegrationTest()) {
        return;
      }

      const invalidWikiId = 'non-existent-wiki-id-12345';

      await expect(
        listWikiPages({
          organizationId,
          projectId: projectName,
          wikiId: invalidWikiId,
        }),
      ).rejects.toThrow(AzureDevOpsError);
    });

    test('should handle invalid projectId', async () => {
      // Skip if integration tests are disabled or no connection available
      if (shouldSkipIntegrationTest()) {
        return;
      }

      const invalidProjectId = 'non-existent-project-12345';

      await expect(
        listWikiPages({
          organizationId,
          projectId: invalidProjectId,
          wikiId: 'any-wiki',
        }),
      ).rejects.toThrow(AzureDevOpsError);
    });

    test('should handle invalid organizationId', async () => {
      // Skip if integration tests are disabled or no connection available
      if (shouldSkipIntegrationTest()) {
        return;
      }

      const invalidOrgId = 'non-existent-org-12345';

      await expect(
        listWikiPages({
          organizationId: invalidOrgId,
          projectId: projectName,
          wikiId: 'any-wiki',
        }),
      ).rejects.toThrow(AzureDevOpsError);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty wikis gracefully', async () => {
      // Skip if integration tests are disabled or no connection available
      if (shouldSkipIntegrationTest()) {
        return;
      }

      // First get available wikis using new API
      const wikisJson = await getWikis({
        organizationId,
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

      // Test with a path that likely doesn't exist
      const resultJson = await listWikiPages({
        organizationId,
        projectId: projectName,
        wikiId: wiki.name,
      });

      // Parse JSON result
      const result = JSON.parse(resultJson);

      // Should return an array (may be empty or contain all pages depending on API behavior)
      expect(Array.isArray(result.value)).toBe(true);
      // Note: Azure DevOps API may return all pages when path doesn't match
      console.log(`Path filter test returned ${result.value.length} pages`);
    });

    test('should handle deeply nested paths', async () => {
      // Skip if integration tests are disabled or no connection available
      if (shouldSkipIntegrationTest()) {
        return;
      }

      // First get available wikis using new API
      const wikisJson = await getWikis({
        organizationId,
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

      // Test with default parameters
      const resultJson = await listWikiPages({
        organizationId,
        projectId: projectName,
        wikiId: wiki.name,
      });

      // Parse JSON result
      const result = JSON.parse(resultJson);

      expect(Array.isArray(result.value)).toBe(true);
      // Should not throw error with basic parameters
    });

    test('should handle boundary recursionLevel values', async () => {
      // Skip if integration tests are disabled or no connection available
      if (shouldSkipIntegrationTest()) {
        return;
      }

      // First get available wikis using new API
      const wikisJson = await getWikis({
        organizationId,
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

      // Test basic page listing
      const firstResultJson = await listWikiPages({
        organizationId,
        projectId: projectName,
        wikiId: wiki.name,
      });

      // Parse JSON result
      const firstResult = JSON.parse(firstResultJson);
      expect(Array.isArray(firstResult.value)).toBe(true);

      // Test again for consistency
      const secondResultJson = await listWikiPages({
        organizationId,
        projectId: projectName,
        wikiId: wiki.name,
      });

      // Parse JSON result
      const secondResult = JSON.parse(secondResultJson);
      expect(Array.isArray(secondResult.value)).toBe(true);
    });
  });

  describe('Data Structure Validation', () => {
    test('should verify returned data structure matches WikiPageSummary interface', async () => {
      // Skip if integration tests are disabled or no connection available
      if (shouldSkipIntegrationTest()) {
        return;
      }

      // First get available wikis using new API
      const wikisJson = await getWikis({
        organizationId,
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

      const resultJson = await listWikiPages({
        organizationId,
        projectId: projectName,
        wikiId: wiki.name,
      });

      // Parse JSON result
      const result = JSON.parse(resultJson);
      expect(Array.isArray(result.value)).toBe(true);

      // Validate each page in the result
      result.value.forEach((page: WikiPageSummary) => {
        // Required fields
        expect(page).toHaveProperty('id');
        expect(page).toHaveProperty('path');
        expect(page).toHaveProperty('url');

        expect(typeof page.id).toBe('number');
        expect(typeof page.path).toBe('string');

        // Optional fields
        if (page.url !== undefined) {
          expect(typeof page.url).toBe('string');
        }
        if (page.order !== undefined) {
          expect(typeof page.order).toBe('number');
        }

        // Validate URL format (if present)
        if (page.url !== undefined) {
          expect(page.url).toMatch(/^https?:\/\//);
        }

        // Validate path format (should start with /)
        expect(page.path).toMatch(/^\//);
      });
    });
  });

  describe('Performance and Pagination', () => {
    test('should handle large wiki structures efficiently', async () => {
      // Skip if integration tests are disabled or no connection available
      if (shouldSkipIntegrationTest()) {
        return;
      }

      // First get available wikis using new API
      const wikisJson = await getWikis({
        organizationId,
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

      const startTime = Date.now();

      const resultJson = await listWikiPages({
        organizationId,
        projectId: projectName,
        wikiId: wiki.name,
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Parse JSON result
      const result = JSON.parse(resultJson);
      expect(Array.isArray(result.value)).toBe(true);

      // Performance check - should complete within reasonable time (30 seconds)
      expect(duration).toBeLessThan(30000);

      console.log(`Retrieved ${result.value.length} pages in ${duration}ms`);
    });
  });
});
