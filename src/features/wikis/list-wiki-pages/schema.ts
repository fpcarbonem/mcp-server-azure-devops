import { z } from 'zod';

import { defaultProject, defaultOrg } from '../../../utils/environment';

/**
 * Schema for listing wiki pages from an Azure DevOps wiki
 */
export const ListWikiPagesSchema = z.object({
  organizationId: z
    .string()
    .optional()
    .nullable()
    .describe(`The ID or name of the organization (Default: ${defaultOrg})`),
  projectId: z
    .string()
    .optional()
    .nullable()
    .describe(`The ID or name of the project (Default: ${defaultProject})`),
  wikiId: z.string().describe('The ID or name of the wiki'),
  path: z
    .string()
    .optional()
    .describe('The folder or page path to list from (Default: / for root)'),
  recursionLevel: z
    .enum(['oneLevel', 'full'])
    .optional()
    .describe(
      'oneLevel lists only immediate children, full lists entire subtree (Default: oneLevel)',
    ),
  includeContent: z
    .boolean()
    .optional()
    .describe(
      'Whether to include the markdown content in each result (Default: false)',
    ),
  versionDescriptor: z
    .string()
    .optional()
    .describe("Branch to query, e.g. wikiMaster (Default: wiki's main branch)"),
});

export type ListWikiPagesOptions = z.infer<typeof ListWikiPagesSchema>;
