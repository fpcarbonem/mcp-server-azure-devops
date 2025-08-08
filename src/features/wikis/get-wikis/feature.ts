import * as azureDevOpsClient from '../../../clients/azure-devops';
import { AzureDevOpsError } from '../../../shared/errors';

/**
 * Options for getting wikis
 */
export interface GetWikisOptions {
  /**
   * The ID or name of the organization
   * If not provided, the default organization will be used
   */
  organizationId: string;

  /**
   * The ID or name of the project
   * If not provided, the default project will be used
   */
  projectId: string;
}

/**
 * Get wikis in a project
 *
 * @param options Options for getting wikis
 * @returns List of wikis as JSON string
 * @throws {AzureDevOpsResourceNotFoundError} When the project is not found or user lacks wiki access
 * @throws {AzureDevOpsPermissionError} When the user does not have permission to access wikis
 * @throws {AzureDevOpsError} When an error occurs while fetching wikis
 */
export async function getWikis(options: GetWikisOptions): Promise<string> {
  const { organizationId, projectId } = options;

  try {
    // Create the client
    const client = await azureDevOpsClient.getWikiClient({
      organizationId,
    });

    // Get the wikis for the project
    const wikis = await client.listWikis(projectId);

    // Return the wikis as JSON string for MCP compatibility
    return JSON.stringify({ count: wikis.length, value: wikis }, null, 2);
  } catch (error) {
    // If it's already an AzureDevOpsError, rethrow it
    if (error instanceof AzureDevOpsError) {
      throw error;
    }
    // Otherwise wrap it in an AzureDevOpsError
    throw new AzureDevOpsError('Failed to get wikis', { cause: error });
  }
}
