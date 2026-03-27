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
      className="group flex flex-col items-center gap-4 p-8 bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-xl hover:border-brand-tangerina/30 transition-all duration-300"
    >
      <div className="w-14 h-14 rounded-xl bg-brand-verde/10 flex items-center justify-center text-brand-verde group-hover:bg-brand-verde group-hover:text-white transition-colors duration-300">
        {icon}
      </div>
      <div className="text-center">
        <h2 className="text-lg font-display font-semibold text-brand-verde">
          {title}
        </h2>
        <p className="text-sm text-gray-500 mt-1">{description}</p>
      </div>
      <span className="px-5 py-2.5 rounded-xl bg-brand-tangerina text-white text-sm font-semibold group-hover:opacity-90 transition">
        Acessar
      </span>
    </Link>
  );
}
