import { useEffect, useRef } from "react";
import type { ProjectSummaryDto } from "../../api/schemawise-contracts";

function date(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(parsed);
}

export function ProjectListPanel({ projects, loading, error, onOpen, onDelete, onClose }: { readonly projects: readonly ProjectSummaryDto[]; readonly loading: boolean; readonly error?: string; onOpen(id: string): void; onDelete(project: ProjectSummaryDto): void; onClose(): void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { closeRef.current?.focus(); }, []);
  return (
    <section className="transient-panel projects-panel" aria-labelledby="projects-heading" aria-busy={loading}>
      <div className="panel-heading"><div><p className="eyebrow">Persistence</p><h2 id="projects-heading">Open projects</h2></div><button ref={closeRef} className="button button--quiet" type="button" onClick={onClose}>Close</button></div>
      {loading ? <p role="status">Loading projects…</p> : error ? <p className="panel-error" role="alert">{error}</p> : projects.length === 0 ? <p>You have no saved projects yet.</p> : (
        <ul className="project-list">{projects.map((project) => <li key={project.id}>
          <button className="project-list__open" type="button" onClick={() => onOpen(project.id)}><strong>{project.name}</strong><span>{project.relationName || "Unnamed relation"} · {project.attributeCount} attributes · {project.functionalDependencyCount} FDs</span><small>Updated {date(project.updatedAt)}</small></button>
          <button className="button button--quiet button--danger" type="button" onClick={() => onDelete(project)} aria-label={`Delete project ${project.name}`}>Delete</button>
        </li>)}</ul>
      )}
    </section>
  );
}
