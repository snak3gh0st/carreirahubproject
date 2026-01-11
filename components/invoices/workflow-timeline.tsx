"use client";

interface WorkflowStep {
  title: string;
  status: "completed" | "current" | "pending" | "failed";
  date?: Date | null;
  description?: string;
}

interface WorkflowTimelineProps {
  steps: WorkflowStep[];
}

export function WorkflowTimeline({ steps }: WorkflowTimelineProps) {
  const getStatusColor = (status: WorkflowStep["status"]) => {
    switch (status) {
      case "completed":
        return "bg-green-500";
      case "current":
        return "bg-blue-500";
      case "failed":
        return "bg-red-500";
      default:
        return "bg-gray-300";
    }
  };

  const getStatusIcon = (status: WorkflowStep["status"]) => {
    switch (status) {
      case "completed":
        return "✓";
      case "current":
        return "●";
      case "failed":
        return "✗";
      default:
        return "○";
    }
  };

  const getStatusTextColor = (status: WorkflowStep["status"]) => {
    switch (status) {
      case "completed":
        return "text-green-700";
      case "current":
        return "text-blue-700";
      case "failed":
        return "text-red-700";
      default:
        return "text-gray-500";
    }
  };

  return (
    <div className="flow-root">
      <ul className="-mb-8">
        {steps.map((step, stepIdx) => (
          <li key={step.title}>
            <div className="relative pb-8">
              {stepIdx !== steps.length - 1 ? (
                <span
                  className={`absolute top-4 left-4 -ml-px h-full w-0.5 ${
                    step.status === "completed" ? "bg-green-500" : "bg-gray-300"
                  }`}
                  aria-hidden="true"
                />
              ) : null}
              <div className="relative flex space-x-3">
                <div>
                  <span
                    className={`h-8 w-8 rounded-full ${getStatusColor(
                      step.status
                    )} flex items-center justify-center ring-8 ring-white text-white font-bold text-sm`}
                  >
                    {getStatusIcon(step.status)}
                  </span>
                </div>
                <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                  <div>
                    <p
                      className={`text-sm font-medium ${getStatusTextColor(
                        step.status
                      )}`}
                    >
                      {step.title}
                    </p>
                    {step.description && (
                      <p className="mt-1 text-xs text-gray-500">
                        {step.description}
                      </p>
                    )}
                  </div>
                  {step.date && (
                    <div className="text-right text-sm whitespace-nowrap text-gray-500">
                      {new Date(step.date).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
