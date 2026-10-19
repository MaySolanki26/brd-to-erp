import type { ModuleDto } from '@brd/shared';
import { useModules } from '../hooks/use-knowledge';
import { useKnowledgeFilters } from '../hooks/use-knowledge-filters';
import { AuthorCell, DateCell, DescriptionCell, SourceCell, TitleCell } from './KnowledgeCells';
import { KnowledgeList, StatusCell } from './KnowledgeList';

export function ModulesTab({ projectId }: { projectId: string }) {
  const filterState = useKnowledgeFilters('modules');
  const query = useModules(projectId, filterState.filters);
  return (
    <KnowledgeList<ModuleDto>
      projectId={projectId}
      kind="modules"
      noun="modules"
      searchLabel="Search modules"
      query={query}
      filterState={filterState}
      columns={(openSource) => [
        {
          id: 'name',
          header: 'Module',
          cell: (m) => <TitleCell title={`${m.name} (${m.code})`} />,
        },
        {
          id: 'description',
          header: 'Description',
          cell: (m) => <DescriptionCell description={m.description} />,
        },
        { id: 'status', header: 'Status', cell: (m) => <StatusCell row={m} /> },
        {
          id: 'requirements',
          header: 'Requirements',
          cell: (m) => <span>{m.requirementCount}</span>,
        },
        {
          id: 'source',
          header: 'Source',
          cell: (m) => (
            <SourceCell source={m.source} otherSources={m.otherSources} onOpen={openSource} />
          ),
        },
        {
          id: 'createdBy',
          header: 'Added by',
          cell: (m) => <AuthorCell createdBy={m.createdBy} />,
        },
        { id: 'updatedAt', header: 'Updated', cell: (m) => <DateCell iso={m.updatedAt} /> },
      ]}
    />
  );
}
