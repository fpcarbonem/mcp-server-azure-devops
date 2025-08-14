import { WebApi } from 'azure-devops-node-api';
import axios from 'axios';
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
    // First try the standard Profile API (for Azure DevOps Services/cloud)
    try {
      const profileApi = await connection.getProfileApi();
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
    } catch (profileError) {
      // If Profile API fails (common on on-premises), try the TFS-style endpoint
      const errorMessage =
        profileError instanceof Error
          ? profileError.message
          : String(profileError);

      // Check if this is a "Failed to find api location for area: Profile" error
      if (
        errorMessage.includes('Failed to find api location for area: Profile')
      ) {
        // Use the TFS/on-premises specific endpoint
        return await getMeFromTfsEndpoint(connection);
      }

      // If it's a different error, rethrow it
      throw profileError;
    }
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
 * Get user profile from TFS/on-premises Azure DevOps Server using the legacy endpoint
 *
 * @param connection The Azure DevOps WebApi connection
 * @returns User profile information
 */
async function getMeFromTfsEndpoint(connection: WebApi): Promise<UserProfile> {
  try {
    // Use the TFS-specific GetUserProfile endpoint that we know works
    const profileUrl = `${connection.serverUrl}/_api/_common/GetUserProfile?__v=7.0`;

    // Get authentication headers from the connection
    const authHandler = (
      connection as unknown as {
        authHandler?: {
          prepareRequest: (
            options: object,
          ) => Promise<{ headers?: Record<string, string> }>;
        };
      }
    ).authHandler;
    const authHeader = authHandler ? await authHandler.prepareRequest({}) : {};

    // Import https module at the top level to avoid require() in function
    const https = await import('https');

    const response = await axios.get(profileUrl, {
      headers: {
        Accept: 'application/json',
        ...authHeader.headers,
      },
      // Disable SSL verification if needed for self-signed certificates
      httpsAgent:
        process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0'
          ? new https.Agent({ rejectUnauthorized: false })
          : undefined,
    });

    if (!response.data) {
      throw new AzureDevOpsError(
        'No user profile data returned from TFS endpoint',
      );
    }

    const profileData = response.data;

    // Extract user information from the TFS response structure
    const identity = profileData.identity;
    if (!identity) {
      throw new AzureDevOpsError(
        'No identity information found in TFS profile response',
      );
    }

    return {
      id: identity.TeamFoundationId || identity.EntityId || '',
      displayName: identity.DisplayName || identity.FriendlyDisplayName || '',
      email: identity.MailAddress || profileData.defaultMailAddress || '',
    };
  } catch (error) {
    // Handle axios errors specifically
    if (axios.isAxiosError(error)) {
      throw new AzureDevOpsError(
        `HTTP request failed: ${error.response?.status} ${error.response?.statusText} - ${error.message}`,
      );
    }

    throw new AzureDevOpsError(
      `Failed to get user information from TFS endpoint: ${error instanceof Error ? error.message : String(error)}`,
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
