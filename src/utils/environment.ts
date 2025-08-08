// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

/**
 * Utility functions and constants related to environment variables.
 */

/**
 * Extract organization name from Azure DevOps organization URL
 * For TFS on-premises, this returns a meaningful identifier
 */
export function getOrgNameFromUrl(url?: string): string {
  if (!url) return 'unknown-organization';

  // Handle Azure DevOps Cloud URLs
  const devMatch = url.match(/https?:\/\/dev\.azure\.com\/([^/]+)/);
  if (devMatch) {
    return devMatch[1];
  }

  // Handle TFS on-premises URLs (e.g., https://tfs.deltek.com/tfs/Deltek)
  const tfsMatch = url.match(/https?:\/\/([^/]+)\/tfs\/([^/]+)/);
  if (tfsMatch) {
    return `${tfsMatch[1]}-${tfsMatch[2]}`; // e.g., "tfs.deltek.com-Deltek"
  }

  // Fallback for other Azure DevOps Server URLs
  if (url.includes('azure')) {
    const fallbackMatch = url.match(/https?:\/\/[^/]+\/([^/]+)/);
    return fallbackMatch ? fallbackMatch[1] : 'unknown-organization';
  }

  return 'unknown-organization';
}

/**
 * Get the base URL for Azure DevOps API calls
 * For TFS on-premises, this returns the full URL including collection path
 * For Azure DevOps Cloud, this returns the dev.azure.com URL
 */
export function getBaseUrl(url?: string): string {
  if (!url) return 'https://dev.azure.com/unknown-organization';

  // If it's already a dev.azure.com URL, construct the standard format
  const devMatch = url.match(/https?:\/\/dev\.azure\.com\/([^/]+)/);
  if (devMatch) {
    return `https://dev.azure.com/${devMatch[1]}`;
  }

  // For on-premises TFS, return the URL as-is
  // This should be in format: https://tfs.deltek.com/tfs/Deltek
  return url;
}

/**
 * Default project name from environment variables
 */
export const defaultProject =
  process.env.AZURE_DEVOPS_DEFAULT_PROJECT || 'no default project';

/**
 * Default organization name derived from the organization URL
 */
export const defaultOrg = getOrgNameFromUrl(process.env.AZURE_DEVOPS_ORG_URL);

/**
 * Default base URL for Azure DevOps API calls
 */
export const defaultBaseUrl = getBaseUrl(process.env.AZURE_DEVOPS_ORG_URL);
