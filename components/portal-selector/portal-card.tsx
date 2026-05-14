import Link from "next/link";

interface PortalCardProps {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
}

export function PortalCard({ title, description, href, icon }: PortalCardProps) {
  return (
    <Link
      href={href}
      className="group flex h-full min-h-[238px] flex-col items-center justify-between rounded-lg border border-gray-200 bg-white p-7 text-center shadow-sm transition-all duration-300 hover:border-brand-tangerina/40 hover:shadow-xl"
    >
      <div className="flex flex-1 flex-col items-center">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-brand-verde/10 text-brand-verde transition-colors duration-300 group-hover:bg-brand-verde group-hover:text-white">
          {icon}
        </div>
        <div className="mt-5 flex flex-1 flex-col items-center">
          <h2 className="flex min-h-[28px] items-center text-lg font-display font-semibold leading-tight text-brand-verde">
            {title}
          </h2>
          <p className="mt-2 flex min-h-[42px] max-w-[17rem] items-start text-sm leading-5 text-gray-500">
            {description}
          </p>
        </div>
      </div>
      <span className="mt-6 inline-flex h-10 min-w-28 items-center justify-center rounded-md bg-brand-tangerina px-5 text-sm font-semibold text-white transition group-hover:opacity-90">
        Acessar
      </span>
    </Link>
  );
}
