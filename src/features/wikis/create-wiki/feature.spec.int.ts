import { createWiki } from './feature';
import { WikiType } from './schema';
import { getOrgNameFromUrl } from '@/utils/environment';
import axios from 'axios';

axios.interceptors.request.use((request) => {
  console.log('Starting Request', JSON.stringify(request, null, 2));
  return request;
});

describe('createWiki (Integration)', () => {
  let projectName: string;
  let organizationId: string;
  const testWikiName = `TestWiki_${new Date().getTime()}`;

  beforeAll(async () => {
    // Get project name and organization from environment variables
    projectName = process.env.AZURE_DEVOPS_DEFAULT_PROJECT || 'DefaultProject';

    // Get organization ID from URL
    const orgUrl =
      process.env.AZURE_DEVOPS_ORG_URL || 'https://example.visualstudio.com';
    organizationId = getOrgNameFromUrl(orgUrl);
  });

  test.skip('should create a project wiki', async () => {
    // PERMANENTLY SKIPPED: Azure DevOps only allows one wiki per project.
    // Running this test multiple times would fail after the first wiki is created.
    // This test is kept for reference but cannot be run repeatedly.

    // Create the wiki using new API (deprecated connection parameter is still needed but ignored)
    const resultJson = await createWiki(null, {
      organizationId,
      name: testWikiName,
      projectId: projectName,
      type: WikiType.ProjectWiki,
    });

    // Parse JSON result
    const result = JSON.parse(resultJson);

    // Verify the wiki was created
    expect(result).toBeDefined();
    expect(result.data).toBeDefined();
    expect(result.data.name).toBe(testWikiName);
    expect(result.data.projectId).toBe(projectName);
    expect(result.data.type).toBe(WikiType.ProjectWiki);
    expect(result.metadata).toBeDefined();
    expect(result.metadata.operation).toBe('create_wiki');
  });

  // NOTE: We're not testing code wiki creation since that requires a repository
  // that would need to be created/cleaned up and is outside the scope of this test
});
