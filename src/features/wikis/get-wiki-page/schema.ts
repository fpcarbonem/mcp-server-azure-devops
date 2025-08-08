import { z } from 'zod';

import { defaultProject, defaultOrg } from '../../../utils/environment';

/**
 * Schema for getting a wiki page from an Azure DevOps wiki
 */
export const GetWikiPageSchema = z.object({
  organizationId: z
    .string()
    .optional()
    .describe(`The ID or name of the organization (Default: ${defaultOrg})`),
  projectId: z
    .string()
    .optional()
    .describe(`The ID or name of the project (Default: ${defaultProject})`),
  wikiId: z.string().describe('The ID or name of the wiki'),
  pagePath: z
    .string()
    .describe(
      'The path of the page within the wiki. Path will be automatically normalized (removes .md extension, converts hyphens to spaces in filenames)',
    ),
  includeContent: z
    .boolean()
    .optional()
    .describe(
      'Whether to include the page content in the response (Default: true)',
    ),
});
