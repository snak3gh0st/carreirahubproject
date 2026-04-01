"use client";

// TODO: Implemented in Phase 15 Plan 02
// This stub exists to allow the build to compile while the API routes (Plan 01) are in place.
// Plan 02 will replace this with the full Kanban board implementation.

interface PipelineBoardProps {
  currentUserId: string;
  currentUserName: string;
}

export function PipelineBoard({ currentUserId, currentUserName }: PipelineBoardProps) {
  return (
    <div className="flex items-center justify-center h-64 text-gray-400">
      Pipeline board coming soon
    </div>
  );
}
