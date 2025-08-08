import * as azureDevOpsClient from '../../../clients/azure-devops';
import { AzureDevOpsError } from '../../../shared/errors/azure-devops-errors';

/**
 * Normalize a wiki page path.
 * Accepts paths like "/Folder/File-Name.md" and converts to "/Folder/File Name"
 * - Ensures leading "/"
 * - Strips trailing ".md" (case-insensitive)
 * - Decodes percent-encodings (e.g., %2D -> -)
 * - Converts hyphens to spaces in the last segment only
 * - Collapses multiple slashes
 */
function normalizeWikiPath(input: string): string {
  if (!input) return '/';
  let path = input.trim();

  // Ensure leading slash
  if (!path.startsWith('/')) path = `/${path}`;

  // Decode percent-encodings safely
  try {
    path = decodeURIComponent(path);
  } catch {
    // keep as-is if decoding fails
  }

  // Remove trailing .md (case-insensitive)
  path = path.replace(/\.md$/i, '');

  // Collapse multiple slashes
  path = path.replace(/\/+/g, '/');

  // Replace hyphens with spaces in the last segment only
  const parts = path.split('/');
  const last = parts.pop() ?? '';
  const normalizedLast = last.replace(/-/g, ' ');
  parts.push(normalizedLast);

  const normalized = parts.join('/') || '/';
  return normalized;
}
/**
 * Options for getting a wiki page
 */
export interface GetWikiPageOptions {
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

  /**
   * The ID or name of the wiki
   */
  wikiId: string;

  /**
   * The path of the page within the wiki
   * Path will be automatically normalized (removes .md extension, converts hyphens to spaces in filenames)
   */
  pagePath: string;

  /**
   * Whether to include the page content in the response
   * Defaults to true if not specified
   */
  includeContent?: boolean;
}

/**
 * Get a wiki page from a wiki
 *
 * @param options Options for getting a wiki page
 * @returns Wiki page content and metadata as JSON string
 * @throws {AzureDevOpsResourceNotFoundError} When the wiki page is not found
 * @throws {AzureDevOpsPermissionError} When the user does not have permission to access the wiki page
 * @throws {AzureDevOpsError} When an error occurs while fetching the wiki page
 */
export async function getWikiPage(
  options: GetWikiPageOptions,
): Promise<string> {
  const {
    organizationId,
    projectId,
    wikiId,
    pagePath,
    includeContent = true,
  } = options;

  const normalizedPagePath = normalizeWikiPath(pagePath);

  try {
    // Create the client
    const client = await azureDevOpsClient.getWikiClient({
      organizationId,
    });

    // Get the wiki page with structured response
    const pageData = await client.getPage(
      projectId,
      wikiId,
      normalizedPagePath,
      includeContent,
    );

    // Return the structured data as JSON string for MCP compatibility
    return JSON.stringify(pageData, null, 2);
  } catch (error) {
    // If it's already an AzureDevOpsError, rethrow it
    if (error instanceof AzureDevOpsError) {
      throw error;
    }
    // Otherwise wrap it in an AzureDevOpsError
    throw new AzureDevOpsError('Failed to get wiki page', { cause: error });
  }
}
