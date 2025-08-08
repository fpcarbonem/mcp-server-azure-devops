import { getWikis, GetWikisOptions } from './feature';
import {
  AzureDevOpsError,
  AzureDevOpsResourceNotFoundError,
  AzureDevOpsPermissionError,
} from '../../../shared/errors';
import * as azureDevOpsClient from '../../../clients/azure-devops';

// Mock Azure DevOps client
jest.mock('../../../clients/azure-devops');
const mockListWikis = jest.fn();

(azureDevOpsClient.getWikiClient as jest.Mock).mockImplementation(() => {
  return Promise.resolve({
    listWikis: mockListWikis,
  });
});

describe('getWikis unit', () => {
  const mockWikis = [
    {
      id: '4ebdc992-4531-4b20-83ce-d3872ef0fa51',
      versions: [{ version: 'wikiMaster' }],
      url: 'https://tfs.deltek.com/tfs/Deltek/1bc91b4b-388e-4883-8070-c3147ab03f66/_apis/wiki/wikis/4ebdc992-4531-4b20-83ce-d3872ef0fa51',
      remoteUrl:
        'https://tfs.deltek.com/tfs/Deltek/1bc91b4b-388e-4883-8070-c3147ab03f66/_wiki/wikis/4ebdc992-4531-4b20-83ce-d3872ef0fa51',
      type: 'projectWiki',
      name: 'StrategicSolutionsSharedServices.wiki',
      projectId: '1bc91b4b-388e-4883-8070-c3147ab03f66',
      repositoryId: '4ebdc992-4531-4b20-83ce-d3872ef0fa51',
      mappedPath: '/',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockListWikis.mockResolvedValue(mockWikis);
  });

  it('should return wikis as structured JSON', async () => {
    // Arrange
    const options: GetWikisOptions = {
      organizationId: 'testOrg',
      projectId: 'testProject',
    };

    // Act
    const result = await getWikis(options);

    // Assert - The result should be JSON string with count and value
    const parsedResult = JSON.parse(result);
    expect(parsedResult).toEqual({
      count: 1,
      value: mockWikis,
    });
    expect(azureDevOpsClient.getWikiClient).toHaveBeenCalledWith({
      organizationId: 'testOrg',
    });
    expect(mockListWikis).toHaveBeenCalledWith('testProject');
  });

  it('should handle empty wikis list', async () => {
    // Arrange
    mockListWikis.mockResolvedValue([]);
    const options: GetWikisOptions = {
      organizationId: 'testOrg',
      projectId: 'testProject',
    };

    // Act
    const result = await getWikis(options);

    // Assert
    const parsedResult = JSON.parse(result);
    expect(parsedResult).toEqual({
      count: 0,
      value: [],
    });
  });

  it('should throw ResourceNotFoundError when project is not found', async () => {
    // Arrange
    mockListWikis.mockRejectedValue(
      new AzureDevOpsResourceNotFoundError('Project not found'),
    );

    // Act & Assert
    const options: GetWikisOptions = {
      organizationId: 'testOrg',
      projectId: 'nonExistentProject',
    };

    await expect(getWikis(options)).rejects.toThrow(
      AzureDevOpsResourceNotFoundError,
    );
  });

  it('should throw PermissionError when user lacks permissions', async () => {
    // Arrange
    mockListWikis.mockRejectedValue(
      new AzureDevOpsPermissionError('Permission denied'),
    );

    // Act & Assert
    const options: GetWikisOptions = {
      organizationId: 'testOrg',
      projectId: 'testProject',
    };

    await expect(getWikis(options)).rejects.toThrow(AzureDevOpsPermissionError);
  });

  it('should throw generic error for other failures', async () => {
    // Arrange
    mockListWikis.mockRejectedValue(new Error('Network error'));

    // Act & Assert
    const options: GetWikisOptions = {
      organizationId: 'testOrg',
      projectId: 'testProject',
    };

    await expect(getWikis(options)).rejects.toThrow(AzureDevOpsError);
  });
});
