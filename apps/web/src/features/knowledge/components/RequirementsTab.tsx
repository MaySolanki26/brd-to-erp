import type { RequirementDto } from '@brd/shared';
import { useRequirements } from '../hooks/use-knowledge';
import { useKnowledgeFilters } from '../hooks/use-knowledge-filters';
import { AuthorCell, DateCell, ModuleCell, SourceCell, TitleCell } from './KnowledgeCells';
import { KnowledgeList, StatusCell } from './KnowledgeList';

export function RequirementsTab({ projectId }: { projectId: string }) {
  const filterState = useKnowledgeFilters('requirements');
  const query = useRequirements(projectId, filterState.filters);
  return (
    <KnowledgeList<RequirementDto>
      projectId={projectId}
      kind="requirements"
      noun="requirements"
      searchLabel="Search requirements"
      query={query}
      filterState={filterState}
      columns={(openSource) => [
        {
          id: 'title',
          header: 'Requirement',
          cell: (r) => <TitleCell title={r.title} description={r.description} />,
        },
        { id: 'status', header: 'Status', cell: (r) => <StatusCell row={r} /> },
        { id: 'module', header: 'Module', cell: (r) => <ModuleCell module={r.module} /> },
        {
          id: 'source',
          header: 'Source',
          cell: (r) => <SourceCell source={r.source} onOpen={openSource} />,
        },
        {
          id: 'createdBy',
          header: 'Added by',
          cell: (r) => <AuthorCell createdBy={r.createdBy} />,
        },
        { id: 'updatedAt', header: 'Updated', cell: (r) => <DateCell iso={r.updatedAt} /> },
      ]}
    />
  );
}
