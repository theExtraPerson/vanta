import Link from "next/link";

/** In-app screen header: back chevron, title, optional trailing slot. */
export function ScreenHeader({
  title,
  subtitle,
  back,
  right,
}: {
  title: string;
  subtitle?: string;
  back?: string | null;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-2">
      <div className="flex min-w-0 items-start gap-2.5">
        {back !== null && (
          <Link
            href={back ?? "/dashboard"}
            aria-label="Back"
            className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-electric/20 text-mist transition-colors hover:border-electric/45 hover:text-fog"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M14.5 5.5 8 12l6.5 6.5" />
            </svg>
          </Link>
        )}
        <div className="min-w-0">
          <h1 className="font-display text-[19px] leading-tight font-bold text-white">{title}</h1>
          {subtitle && <p className="mt-1 text-[11.5px] leading-relaxed text-mist">{subtitle}</p>}
        </div>
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}