import type { BusinessRuleDto } from '@brd/shared';
import { useRules } from '../hooks/use-knowledge';
import { useKnowledgeFilters } from '../hooks/use-knowledge-filters';
import { AuthorCell, DateCell, ModuleCell, SourceCell, TitleCell } from './KnowledgeCells';
import { KnowledgeList, StatusCell } from './KnowledgeList';

export function RulesTab({ projectId }: { projectId: string }) {
  const filterState = useKnowledgeFilters('rules');
  const query = useRules(projectId, filterState.filters);
  return (
    <KnowledgeList<BusinessRuleDto>
      projectId={projectId}
      kind="rules"
      noun="rules"
      searchLabel="Search rules"
      query={query}
      filterState={filterState}
      columns={(openSource) => [
        {
          id: 'title',
          header: 'Rule',
          cell: (r) => <TitleCell title={r.title} description={r.description} />,
        },
        { id: 'status', header: 'Status', cell: (r) => <StatusCell row={r} /> },
        { id: 'module', header: 'Module', cell: (r) => <ModuleCell module={r.module} /> },
        {
          id: 'source',
          header: 'Source',
          cell: (r) => <SourceCell source={r.source} otherSources={r.otherSources} onOpen={openSource} />,
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
