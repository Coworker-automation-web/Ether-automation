import { useParams } from "react-router-dom";
import { WorkspaceEditor } from "../features/workspace/WorkspaceEditor";

export function Component() {
  const { orgId, workspaceId } = useParams();
  if (!orgId || !workspaceId) return <div role="alert">Page not found.</div>;
  return <WorkspaceEditor orgId={orgId} workspaceId={workspaceId} />;
}
