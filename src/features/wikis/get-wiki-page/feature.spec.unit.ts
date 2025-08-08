import { getWikiPage, GetWikiPageOptions } from './feature';
import {
  AzureDevOpsResourceNotFoundError,
  AzureDevOpsPermissionError,
  AzureDevOpsError,
} from '../../../shared/errors';
import * as azureDevOpsClient from '../../../clients/azure-devops';

// Mock Azure DevOps client
jest.mock('../../../clients/azure-devops');
const mockGetPage = jest.fn();

(azureDevOpsClient.getWikiClient as jest.Mock).mockImplementation(() => {
  return Promise.resolve({
    getPage: mockGetPage,
  });
});

describe('getWikiPage unit', () => {
  const mockWikiPageContent = 'Wiki page content text';
  const mockPageData = {
    content: mockWikiPageContent,
    path: '/Home',
    id: 123,
    gitItemPath: '/Home.md',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetPage.mockResolvedValue(mockPageData);
  });

  it('should return wiki page content as structured JSON', async () => {
    // Arrange
    const options: GetWikiPageOptions = {
      organizationId: 'testOrg',
      projectId: 'testProject',
      wikiId: 'testWiki',
      pagePath: '/Home',
    };

    // Act
    const result = await getWikiPage(options);

    // Assert - The result should be JSON string of the page data
    expect(JSON.parse(result)).toEqual(mockPageData);
    expect(azureDevOpsClient.getWikiClient).toHaveBeenCalledWith({
      organizationId: 'testOrg',
    });
    expect(mockGetPage).toHaveBeenCalledWith(
      'testProject',
      'testWiki',
      '/Home',
      true, // includeContent defaults to true
    );
  });

  it('should properly handle wiki page path and includeContent parameter', async () => {
    // Arrange
    const options: GetWikiPageOptions = {
      organizationId: 'testOrg',
      projectId: 'testProject',
      wikiId: 'testWiki',
      pagePath: '/Path with spaces/And special chars $&+,/:;=?@',
      includeContent: false,
    };

    // Act
    await getWikiPage(options);

    // Assert
    expect(mockGetPage).toHaveBeenCalledWith(
      'testProject',
      'testWiki',
      '/Path with spaces/And special chars $&+,/:;=?@',
      false, // includeContent explicitly set to false
    );
  });

  it('should throw ResourceNotFoundError when wiki page is not found', async () => {
    // Arrange
    mockGetPage.mockRejectedValue(
      new AzureDevOpsResourceNotFoundError('Page not found'),
    );

    // Act & Assert
    const options: GetWikiPageOptions = {
      organizationId: 'testOrg',
      projectId: 'testProject',
      wikiId: 'testWiki',
      pagePath: '/NonExistentPage',
    };

    await expect(getWikiPage(options)).rejects.toThrow(
      AzureDevOpsResourceNotFoundError,
    );
  });

  it('should throw PermissionError when user lacks permissions', async () => {
    // Arrange
    mockGetPage.mockRejectedValue(
      new AzureDevOpsPermissionError('Permission denied'),
    );

    // Act & Assert
    const options: GetWikiPageOptions = {
      organizationId: 'testOrg',
      projectId: 'testProject',
      wikiId: 'testWiki',
      pagePath: '/RestrictedPage',
    };

    await expect(getWikiPage(options)).rejects.toThrow(
      AzureDevOpsPermissionError,
    );
  });

  it('should throw generic error for other failures', async () => {
    // Arrange
    mockGetPage.mockRejectedValue(new Error('Network error'));

    // Act & Assert
    const options: GetWikiPageOptions = {
      organizationId: 'testOrg',
      projectId: 'testProject',
      wikiId: 'testWiki',
      pagePath: '/AnyPage',
    };

    await expect(getWikiPage(options)).rejects.toThrow(AzureDevOpsError);
  });
});
