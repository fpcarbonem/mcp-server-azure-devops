import * as azureDevOpsClient from '../../../clients/azure-devops';
import { AzureDevOpsError } from '../../../shared/errors/azure-devops-errors';
import { defaultOrg, defaultProject } from '../../../utils/environment';
import { ListWikiPagesOptions } from './schema';

/**
 * Summary information for a wiki page
 */
export interface WikiPageSummary {
  id: number;
  path: string;
  url?: string;
  order?: number;
}

/**
 * List wiki pages from a wiki
 *
 * @param options Options for listing wiki pages
 * @returns Wiki pages as JSON string with count and value fields
 * @throws {AzureDevOpsResourceNotFoundError} When the wiki is not found
 * @throws {AzureDevOpsPermissionError} When the user does not have permission to access the wiki
 * @throws {AzureDevOpsError} When an error occurs while fetching the wiki pages
 */
export async function listWikiPages(
  options: ListWikiPagesOptions,
): Promise<string> {
  const {
    organizationId,
    projectId,
    wikiId,
    path,
    recursionLevel,
    includeContent,
    versionDescriptor,
  } = options;

  // Use defaults if not provided
  const orgId = organizationId || defaultOrg;
  const projId = projectId || defaultProject;

  try {
    // Create the client
    const client = await azureDevOpsClient.getWikiClient({
      organizationId: orgId,
    });

    // Get the wiki pages with all options
    const pages = await client.listWikiPages(projId, wikiId, {
      path,
      recursionLevel,
      includeContent,
      versionDescriptor,
    });

    // Return as JSON string for MCP compatibility with count and value format
    return JSON.stringify({ count: pages.length, value: pages }, null, 2);
  } catch (error) {
    // If it's already an AzureDevOpsError, rethrow it
    if (error instanceof AzureDevOpsError) {
      throw error;
    }
    // Otherwise wrap it in an AzureDevOpsError
    throw new AzureDevOpsError('Failed to list wiki pages', { cause: error });
  }
}
