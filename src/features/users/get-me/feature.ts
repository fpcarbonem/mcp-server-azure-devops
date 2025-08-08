import { WebApi } from 'azure-devops-node-api';
import { AzureDevOpsError } from '../../../shared/errors';
import { UserProfile } from '../types';

/**
 * Get details of the currently authenticated user
 *
 * This function returns basic profile information about the authenticated user.
 *
 * @param connection The Azure DevOps WebApi connection
 * @returns User profile information including id, displayName, and email
 * @throws {AzureDevOpsError} If retrieval of user information fails
 */
export async function getMe(connection: WebApi): Promise<UserProfile> {
  try {
    // Use the authenticated WebApi connection to access the Profile API
    const profileApi = await connection.getProfileApi();

    // getUserDefaults returns the current user's profile
    const profile = await profileApi.getUserDefaults(true);

    // coreAttributes is a dictionary; extract values safely with light typing
    const core = (profile.coreAttributes || {}) as Record<
      string,
      { value?: string }
    >;
    const getAttr = (key: string): string | undefined => {
      const foundKey = Object.keys(core).find(
        (k) => k.toLowerCase() === key.toLowerCase(),
      );
      return foundKey ? core[foundKey]?.value : undefined;
    };

    const displayName = getAttr('DisplayName') || '';
    const email = getAttr('EmailAddress') || getAttr('Mail') || '';

    return {
      id: profile.id,
      displayName,
      email,
    };
  } catch (error) {
    // If it's already an AzureDevOpsError, rethrow it
    if (error instanceof AzureDevOpsError) {
      throw error;
    }

    // Otherwise, wrap it in a generic error
    throw new AzureDevOpsError(
      `Failed to get user information: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Get the profile API base URL from the connection URL
 * Handles both Azure DevOps Services (cloud) and on-premises Azure DevOps Server/TFS
 *
 * @param connection The Azure DevOps WebApi connection
 * @returns The base URL for profile API calls
 */
// (Intentionally left no-op utilities; axios-based code removed in favor of WebApi.)
