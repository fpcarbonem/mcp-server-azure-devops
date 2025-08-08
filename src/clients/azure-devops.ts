import axios, { AxiosError } from 'axios';
import { DefaultAzureCredential, AzureCliCredential } from '@azure/identity';
import {
  AzureDevOpsError,
  AzureDevOpsResourceNotFoundError,
  AzureDevOpsValidationError,
  AzureDevOpsPermissionError,
} from '../shared/errors';
import {
  defaultOrg,
  defaultProject,
  defaultBaseUrl,
} from '../utils/environment';

interface AzureDevOpsApiErrorResponse {
  message?: string;
  typeKey?: string;
  errorCode?: number;
  eventId?: number;
}

interface ClientOptions {
  organizationId?: string;
}

interface WikiCreateParameters {
  name: string;
  projectId: string;
  type: 'projectWiki' | 'codeWiki';
  repositoryId?: string;
  mappedPath?: string;
  version?: {
    version: string;
    versionType?: 'branch' | 'tag' | 'commit';
  };
}

interface WikiPageContent {
  content: string;
}

export interface WikiPageSummary {
  id: number;
  path: string;
  url?: string;
  order?: number;
  remoteUrl?: string;
  gitItemPath?: string;
  isParentPage?: boolean;
  content?: string;
}

interface PageUpdateOptions {
  comment?: string;
  versionDescriptor?: {
    version?: string;
  };
}

export class WikiClient {
  private baseUrl: string;

  constructor(_organizationId?: string) {
    // Use the base URL from environment utils which handles both TFS and Azure DevOps Cloud
    this.baseUrl = defaultBaseUrl;
  }

  /**
   * Gets a project's ID from its name or verifies a project ID
   * @param projectNameOrId - Project name or ID
   * @returns The project ID
   */
  private async getProjectId(projectNameOrId: string): Promise<string> {
    try {
      // Try to get project details using the provided name or ID
      const url = `${this.baseUrl}/_apis/projects/${projectNameOrId}`;
      const authHeader = await getAuthorizationHeader();

      const response = await axios.get(url, {
        params: {
          'api-version': '7.1',
        },
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
      });

      // Return the project ID from the response
      return response.data.id;
    } catch (error) {
      const axiosError = error as AxiosError;

      if (axiosError.response) {
        const status = axiosError.response.status;
        const errorMessage =
          typeof axiosError.response.data === 'object' &&
          axiosError.response.data
            ? (axiosError.response.data as AzureDevOpsApiErrorResponse)
                .message || axiosError.message
            : axiosError.message;

        if (status === 404) {
          throw new AzureDevOpsResourceNotFoundError(
            `Project not found: ${projectNameOrId}`,
          );
        }

        if (status === 401 || status === 403) {
          throw new AzureDevOpsPermissionError(
            `Permission denied to access project: ${projectNameOrId}`,
          );
        }

        throw new AzureDevOpsError(
          `Failed to get project details: ${errorMessage}`,
        );
      }

      throw new AzureDevOpsError(
        `Network error when getting project details: ${axiosError.message}`,
      );
    }
  }

  /**
   * Creates a new wiki in Azure DevOps
   * @param projectId - Project ID or name
   * @param params - Parameters for creating the wiki
   * @returns The created wiki
   */
  async createWiki(projectId: string, params: WikiCreateParameters) {
    // Use the default project if not provided
    const project = projectId || defaultProject;

    try {
      // Get the actual project ID (whether the input was a name or ID)
      const actualProjectId = await this.getProjectId(project);

      // Construct the URL to create the wiki
      const url = `${this.baseUrl}/${project}/_apis/wiki/wikis`;

      // Get authorization header
      const authHeader = await getAuthorizationHeader();

      // Make the API request
      const response = await axios.post(
        url,
        {
          name: params.name,
          type: params.type,
          projectId: actualProjectId,
          ...(params.type === 'codeWiki' && {
            repositoryId: params.repositoryId,
            mappedPath: params.mappedPath,
            version: params.version,
          }),
        },
        {
          params: {
            'api-version': '7.1',
          },
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
          },
        },
      );

      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;

      // Handle specific error cases
      if (axiosError.response) {
        const status = axiosError.response.status;
        const errorMessage =
          typeof axiosError.response.data === 'object' &&
          axiosError.response.data
            ? (axiosError.response.data as AzureDevOpsApiErrorResponse)
                .message || axiosError.message
            : axiosError.message;

        // Handle 404 Not Found
        if (status === 404) {
          throw new AzureDevOpsResourceNotFoundError(
            `Project not found: ${projectId}`,
          );
        }

        // Handle 401 Unauthorized or 403 Forbidden
        if (status === 401 || status === 403) {
          throw new AzureDevOpsPermissionError(
            `Permission denied to create wiki in project: ${projectId}`,
          );
        }

        // Handle validation errors
        if (status === 400) {
          throw new AzureDevOpsValidationError(
            `Invalid wiki creation parameters: ${errorMessage}`,
          );
        }

        // Handle other error statuses
        throw new AzureDevOpsError(`Failed to create wiki: ${errorMessage}`);
      }

      // Handle network errors
      throw new AzureDevOpsError(
        `Network error when creating wiki: ${axiosError.message}`,
      );
    }
  }

  /**
   * Normalizes a wiki page path according to Azure DevOps wiki path rules
   * - Removes .md extension
   * - Converts hyphens to spaces in the final segment (filename)
   * - Ensures path starts with /
   * @param path - The raw path to normalize
   * @returns The normalized wiki path
   */
  private normalizeWikiPath(path: string): string {
    let normalizedPath = path;

    // Ensure path starts with /
    if (!normalizedPath.startsWith('/')) {
      normalizedPath = '/' + normalizedPath;
    }

    // Remove .md extension if present
    if (normalizedPath.endsWith('.md')) {
      normalizedPath = normalizedPath.slice(0, -3);
    }

    // Convert hyphens to spaces in the final segment only
    const segments = normalizedPath.split('/');
    if (segments.length > 0) {
      const lastSegment = segments[segments.length - 1];
      if (lastSegment) {
        // Replace hyphens with spaces in the filename part
        segments[segments.length - 1] = lastSegment.replace(/-/g, ' ');
        normalizedPath = segments.join('/');
      }
    }

    return normalizedPath;
  }

  /**
   * Gets a wiki page's content
   * @param projectId - Project ID or name
   * @param wikiId - Wiki ID or name
   * @param pagePath - Path of the wiki page
   * @param includeContent - Whether to include page content (default: true)
   * @returns The wiki page content and metadata
   */
  async getPage(
    projectId: string,
    wikiId: string,
    pagePath: string,
    includeContent: boolean = true,
  ) {
    // Use the default project if not provided
    const project = projectId || defaultProject;

    // Normalize the wiki path according to Azure DevOps wiki path rules
    const normalizedPath = this.normalizeWikiPath(pagePath);

    // URL encode the path, preserving forward slashes
    const encodedPagePath = encodeURIComponent(normalizedPath).replace(
      /%2F/g,
      '/',
    );

    // Construct the URL to get the wiki page using project name
    const url = `${this.baseUrl}/${project}/_apis/wiki/wikis/${wikiId}/pages`;
    const params: Record<string, string> = {
      'api-version': '7.1',
      path: encodedPagePath,
      includeContent: includeContent.toString(),
      'versionDescriptor.version': 'wikiMaster',
    };

    try {
      // Get authorization header
      const authHeader = await getAuthorizationHeader();

      // Make the API request for JSON content
      const response = await axios.get(url, {
        params,
        headers: {
          Authorization: authHeader,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      });

      // Extract content from the JSON response
      const pageData = response.data;

      // Return both the content and the ETag
      return {
        content: pageData.content || '',
        eTag: response.headers.etag?.replace(/"/g, ''), // Remove quotes from ETag
        path: pageData.path,
        gitItemPath: pageData.gitItemPath,
        id: pageData.id,
      };
    } catch (error) {
      const axiosError = error as AxiosError;

      // Handle specific error cases
      if (axiosError.response) {
        const status = axiosError.response.status;
        const errorMessage =
          typeof axiosError.response.data === 'object' &&
          axiosError.response.data
            ? (axiosError.response.data as AzureDevOpsApiErrorResponse)
                .message || axiosError.message
            : axiosError.message;

        // Handle 404 Not Found
        if (status === 404) {
          throw new AzureDevOpsResourceNotFoundError(
            `Wiki page not found: ${pagePath} (normalized to: ${normalizedPath}) in wiki ${wikiId}. ` +
              'Make sure the path follows wiki path rules: no .md extension, spaces instead of hyphens in filenames.',
          );
        }

        // Handle 401 Unauthorized or 403 Forbidden
        if (status === 401 || status === 403) {
          throw new AzureDevOpsPermissionError(
            `Permission denied to access wiki page: ${pagePath}`,
          );
        }

        // Handle other error statuses
        throw new AzureDevOpsError(
          `Failed to get wiki page: ${errorMessage} ${axiosError.response?.data}`,
        );
      }

      // Handle network errors
      throw new AzureDevOpsError(
        `Network error when getting wiki page: ${axiosError.message}`,
      );
    }
  }

  /**
   * Creates a new wiki page with the provided content
   * @param content - Content for the new wiki page
   * @param projectId - Project ID or name
   * @param wikiId - Wiki ID or name
   * @param pagePath - Path of the wiki page to create
   * @param options - Additional options like comment
   * @returns The created wiki page
   */
  async createPage(
    content: string,
    projectId: string,
    wikiId: string,
    pagePath: string,
    options?: { comment?: string },
  ) {
    // Use the default project if not provided
    const project = projectId || defaultProject;

    // Encode the page path, handling forward slashes properly
    const encodedPagePath = encodeURIComponent(pagePath).replace(/%2F/g, '/');

    // Construct the URL to create the wiki page using project name
    const url = `${this.baseUrl}/${project}/_apis/wiki/wikis/${wikiId}/pages`;

    const params: Record<string, string> = {
      'api-version': '5.0',
      path: encodedPagePath,
    };

    // Prepare the request payload
    const payload: Record<string, string> = {
      content,
    };

    // Add comment if provided
    if (options?.comment) {
      payload.comment = options.comment;
    }

    try {
      // Get authorization header
      const authHeader = await getAuthorizationHeader();

      // Make the API request
      const response = await axios.put(url, payload, {
        params,
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      });

      // The ETag header contains the version
      const eTag = response.headers.etag;

      // Return the page content along with metadata
      return {
        ...response.data,
        version: eTag ? eTag.replace(/"/g, '') : undefined, // Remove quotes from ETag
      };
    } catch (error) {
      const axiosError = error as AxiosError;

      // Handle specific error cases
      if (axiosError.response) {
        const status = axiosError.response.status;
        const errorMessage =
          typeof axiosError.response.data === 'object' &&
          axiosError.response.data
            ? (axiosError.response.data as AzureDevOpsApiErrorResponse)
                .message || axiosError.message
            : axiosError.message;

        // Handle 404 Not Found - usually means the parent path doesn't exist
        if (status === 404) {
          throw new AzureDevOpsResourceNotFoundError(
            `Cannot create wiki page: parent path for ${pagePath} does not exist`,
          );
        }

        // Handle 401 Unauthorized or 403 Forbidden
        if (status === 401 || status === 403) {
          throw new AzureDevOpsPermissionError(
            `Permission denied to create wiki page: ${pagePath}`,
          );
        }

        // Handle 412 Precondition Failed - page might already exist
        if (status === 412) {
          throw new AzureDevOpsValidationError(
            `Wiki page already exists: ${pagePath}`,
          );
        }

        // Handle 400 Bad Request - usually validation errors
        if (status === 400) {
          throw new AzureDevOpsValidationError(
            `Invalid request when creating wiki page: ${errorMessage}`,
          );
        }

        // Handle other error statuses
        throw new AzureDevOpsError(
          `Failed to create wiki page: ${errorMessage}`,
        );
      }

      // Handle network errors
      throw new AzureDevOpsError(
        `Network error when creating wiki page: ${axiosError.message}`,
      );
    }
  }

  /**
   * Updates a wiki page with the provided content
   * @param content - Content for the wiki page
   * @param projectId - Project ID or name
   * @param wikiId - Wiki ID or name
   * @param pagePath - Path of the wiki page
   * @param options - Additional options like comment and version
   * @returns The updated wiki page
   */
  async updatePage(
    content: WikiPageContent,
    projectId: string,
    wikiId: string,
    pagePath: string,
    options?: PageUpdateOptions,
  ) {
    // Use the default project if not provided
    const project = projectId || defaultProject;

    // First get the current page version
    let currentETag;
    try {
      const currentPage = await this.getPage(project, wikiId, pagePath, false);
      currentETag = currentPage.eTag;
    } catch (error) {
      if (error instanceof AzureDevOpsResourceNotFoundError) {
        // If page doesn't exist, we'll create it (no If-Match header needed)
        currentETag = undefined;
      } else {
        throw error;
      }
    }

    // Encode the page path, handling forward slashes properly
    const encodedPagePath = encodeURIComponent(pagePath).replace(/%2F/g, '/');

    // Construct the URL to update the wiki page using project name
    const url = `${this.baseUrl}/${project}/_apis/wiki/wikis/${wikiId}/pages`;
    const params: Record<string, string> = {
      'api-version': '5.0',
      path: encodedPagePath,
    };

    // Add optional comment parameter if provided
    if (options?.comment) {
      params.comment = options.comment;
    }

    try {
      // Get authorization header
      const authHeader = await getAuthorizationHeader();

      // Prepare request headers
      const headers: Record<string, string> = {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      };

      // Add If-Match header if we have an ETag (for updates)
      if (currentETag) {
        headers['If-Match'] = `"${currentETag}"`; // Wrap in quotes as required by API
      }

      // Create a properly typed payload
      const payload: Record<string, string> = {
        content: content.content,
      };

      // Make the API request
      const response = await axios.put(url, payload, {
        params,
        headers,
      });

      // The ETag header contains the version
      const eTag = response.headers.etag;

      // Return the page content along with metadata
      return {
        ...response.data,
        version: eTag ? eTag.replace(/"/g, '') : undefined, // Remove quotes from ETag
        message:
          response.status === 201
            ? 'Page created successfully'
            : 'Page updated successfully',
      };
    } catch (error) {
      const axiosError = error as AxiosError;

      // Handle specific error cases
      if (axiosError.response) {
        const status = axiosError.response.status;
        const errorMessage =
          typeof axiosError.response.data === 'object' &&
          axiosError.response.data
            ? (axiosError.response.data as AzureDevOpsApiErrorResponse)
                .message || axiosError.message
            : axiosError.message;

        // Handle 404 Not Found
        if (status === 404) {
          throw new AzureDevOpsResourceNotFoundError(
            `Wiki page not found: ${pagePath} in wiki ${wikiId}`,
          );
        }

        // Handle 401 Unauthorized or 403 Forbidden
        if (status === 401 || status === 403) {
          throw new AzureDevOpsPermissionError(
            `Permission denied to update wiki page: ${pagePath}`,
          );
        }

        // Handle 412 Precondition Failed (version conflict)
        if (status === 412) {
          throw new AzureDevOpsValidationError(
            `Version conflict: The wiki page has been modified since you retrieved it. Please get the latest version and try again.`,
          );
        }

        // Handle other error statuses
        throw new AzureDevOpsError(
          `Failed to update wiki page: ${errorMessage}`,
        );
      }

      // Handle network errors
      throw new AzureDevOpsError(
        `Network error when updating wiki page: ${axiosError.message}`,
      );
    }
  }

  /**
   * Maps raw page data to WikiPageSummary interface
   * @param page - Raw page data from API
   * @returns WikiPageSummary object
   */
  private mapPageData(page: any): WikiPageSummary {
    return {
      id: page.id,
      path: page.path,
      url: page.url,
      order: page.order,
      remoteUrl: page.remoteUrl,
      gitItemPath: page.gitItemPath,
      isParentPage: page.isParentPage,
      content: page.content,
    };
  }

  /**
   * Lists wiki pages from a wiki using the Pages API
   * @param projectId - Project ID or name
   * @param wikiId - Wiki ID or name
   * @param options - Optional parameters for listing
   * @returns Array of wiki page summaries sorted by order then path
   */
  async listWikiPages(
    projectId: string,
    wikiId: string,
    options?: {
      path?: string;
      recursionLevel?: 'oneLevel' | 'full';
      includeContent?: boolean;
      versionDescriptor?: string;
    },
  ): Promise<WikiPageSummary[]> {
    // Use the default project if not provided
    const project = projectId || defaultProject;

    // Use project name directly in URL as per Microsoft documentation
    const url = `${this.baseUrl}/${project}/_apis/wiki/wikis/${wikiId}/pages`;

    const allPages: WikiPageSummary[] = [];

    try {
      // Get authorization header
      const authHeader = await getAuthorizationHeader();

      // Build query parameters based on options
      const params: Record<string, string> = {
        'api-version': '7.1',
        recursionLevel: options?.recursionLevel || 'oneLevel',
      };

      if (options?.path) {
        params.path = encodeURIComponent(options.path).replace(/%2F/g, '/');
      }

      if (options?.includeContent !== undefined) {
        params.includeContent = options.includeContent.toString();
      }

      if (options?.versionDescriptor) {
        params['versionDescriptor.version'] = options.versionDescriptor;
      }

      // Make a GET request to list pages with correct API version
      const response = await axios.get(url, {
        params,
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
      });

      // Handle the response format
      if (response.data && Array.isArray(response.data)) {
        // Azure DevOps Cloud format - flat array
        allPages.push(...response.data.map(this.mapPageData));
      } else if (response.data.value && Array.isArray(response.data.value)) {
        // Azure DevOps Cloud paged format
        allPages.push(...response.data.value.map(this.mapPageData));
      } else if (response.data && response.data.subPages) {
        // TFS on-premises format - hierarchical structure
        // Extract all pages recursively from the hierarchy
        const extractPagesRecursively = (page: any): WikiPageSummary[] => {
          const pages: WikiPageSummary[] = [];

          // Add the current page if it has a path (all valid pages should have paths)
          // For TFS, we might need to generate an ID or use path as ID
          if (page.path && page.path !== '/') {
            pages.push({
              id:
                page.id ||
                Math.abs(
                  page.path
                    .split('')
                    .reduce(
                      (a: number, b: string) =>
                        ((a << 5) - a + b.charCodeAt(0)) & 0xffffffff,
                      0,
                    ),
                ), // Generate hash ID if no ID exists
              path: page.path,
              url: page.url,
              order: page.order,
              remoteUrl: page.remoteUrl,
              gitItemPath: page.gitItemPath,
              isParentPage:
                page.isParentPage ||
                (page.subPages && page.subPages.length > 0),
              content: page.content,
            });
          }

          // Recursively extract subpages
          if (page.subPages && Array.isArray(page.subPages)) {
            for (const subPage of page.subPages) {
              pages.push(...extractPagesRecursively(subPage));
            }
          }

          return pages;
        };

        // Extract all pages starting from the root
        allPages.push(...extractPagesRecursively(response.data));
      }

      // Sort results by order then path
      return allPages.sort((a, b) => {
        // Handle optional order field
        const aOrder = a.order ?? Number.MAX_SAFE_INTEGER;
        const bOrder = b.order ?? Number.MAX_SAFE_INTEGER;

        if (aOrder !== bOrder) {
          return aOrder - bOrder;
        }
        return a.path.localeCompare(b.path);
      });
    } catch (error) {
      const axiosError = error as AxiosError;

      // Handle specific error cases
      if (axiosError.response) {
        const status = axiosError.response.status;
        const errorMessage =
          typeof axiosError.response.data === 'object' &&
          axiosError.response.data
            ? (axiosError.response.data as AzureDevOpsApiErrorResponse)
                .message || axiosError.message
            : axiosError.message;

        // Handle 404 Not Found
        if (status === 404) {
          throw new AzureDevOpsResourceNotFoundError(
            `Wiki not found: ${wikiId} in project ${projectId}`,
          );
        }

        // Handle 401 Unauthorized or 403 Forbidden
        if (status === 401 || status === 403) {
          throw new AzureDevOpsPermissionError(
            `Permission denied to list wiki pages in wiki: ${wikiId}`,
          );
        }

        // Handle other error statuses
        throw new AzureDevOpsError(
          `Failed to list wiki pages: ${errorMessage}`,
        );
      }

      // Handle network errors
      throw new AzureDevOpsError(
        `Network error when listing wiki pages: ${axiosError.message}`,
      );
    }
  }

  /**
   * Lists all wikis in a project
   * @param projectId - Project ID or name
   * @returns Array of wiki metadata
   */
  async listWikis(projectId: string) {
    // Use the default project if not provided
    const project = projectId || defaultProject;

    // Construct the URL to list wikis in the project
    const url = `${this.baseUrl}/${project}/_apis/wiki/wikis`;

    try {
      // Get authorization header
      const authHeader = await getAuthorizationHeader();

      // Make the API request
      const response = await axios.get(url, {
        params: {
          'api-version': '7.1',
        },
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
      });

      // Return the wikis from the response
      return response.data.value || [];
    } catch (error) {
      const axiosError = error as AxiosError;

      // Handle specific error cases
      if (axiosError.response) {
        const status = axiosError.response.status;
        const errorMessage =
          typeof axiosError.response.data === 'object' &&
          axiosError.response.data
            ? (axiosError.response.data as AzureDevOpsApiErrorResponse)
                .message || axiosError.message
            : axiosError.message;

        // Handle 404 Not Found - project not found or no wikis
        if (status === 404) {
          throw new AzureDevOpsResourceNotFoundError(
            `Project not found or no wiki access: ${projectId}`,
          );
        }

        // Handle 401 Unauthorized or 403 Forbidden
        if (status === 401 || status === 403) {
          throw new AzureDevOpsPermissionError(
            `Permission denied to list wikis in project: ${projectId}`,
          );
        }

        // Handle other error statuses
        throw new AzureDevOpsError(`Failed to list wikis: ${errorMessage}`);
      }

      // Handle network errors
      throw new AzureDevOpsError(
        `Network error when listing wikis: ${axiosError.message}`,
      );
    }
  }
}

/**
 * Creates a Wiki client for Azure DevOps operations
 * @param options - Options for creating the client
 * @returns A Wiki client instance
 */
export async function getWikiClient(
  options: ClientOptions,
): Promise<WikiClient> {
  const { organizationId } = options;

  return new WikiClient(organizationId || defaultOrg);
}

/**
 * Get the authorization header for Azure DevOps API requests
 * @returns The authorization header
 */
export async function getAuthorizationHeader(): Promise<string> {
  try {
    // For PAT authentication, we can construct the header directly
    if (
      process.env.AZURE_DEVOPS_AUTH_METHOD?.toLowerCase() === 'pat' &&
      process.env.AZURE_DEVOPS_PAT
    ) {
      // For PAT auth, we can construct the Basic auth header directly
      const token = process.env.AZURE_DEVOPS_PAT;
      const base64Token = Buffer.from(`:${token}`).toString('base64');
      return `Basic ${base64Token}`;
    }

    // For Azure Identity / Azure CLI auth, we need to get a token
    // using the Azure DevOps resource ID
    // Choose the appropriate credential based on auth method
    const credential =
      process.env.AZURE_DEVOPS_AUTH_METHOD?.toLowerCase() === 'azure-cli'
        ? new AzureCliCredential()
        : new DefaultAzureCredential();

    // Azure DevOps resource ID for token acquisition
    const AZURE_DEVOPS_RESOURCE_ID = '499b84ac-1321-427f-aa17-267ca6975798';

    // Get token for Azure DevOps
    const token = await credential.getToken(
      `${AZURE_DEVOPS_RESOURCE_ID}/.default`,
    );

    if (!token || !token.token) {
      throw new Error('Failed to acquire token for Azure DevOps');
    }

    return `Bearer ${token.token}`;
  } catch (error) {
    throw new AzureDevOpsValidationError(
      `Failed to get authorization header: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
