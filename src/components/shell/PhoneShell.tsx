/**
 * The Vanta app shell.
 *
 * Quintaris ships a mobile-first product: on a desktop browser you get the
 * phone view, centred, with the app chrome (bar + tab bar) hugging the column.
 * Every page renders inside this frame so desktop and handset look identical.
 *
 * The frame is exactly one viewport tall and never scrolls itself — the screen
 * region between the app bar and the tab bar is the only scroll container. That
 * keeps the chrome static while you scroll, and stops the document from
 * snapping back to the top when a screen re-renders.
 */
export function PhoneShell({
  children,
  top,
  bottom,
}: {
  children: React.ReactNode;
  top?: React.ReactNode;
  bottom?: React.ReactNode;
}) {
  return (
    <div className="relative flex h-dvh w-full justify-center overflow-hidden bg-ink">
      {/* ambient field */}
      <div className="pointer-events-none absolute inset-0 grid-texture opacity-70" />
      <div className="pointer-events-none absolute top-[-14rem] left-1/2 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-electric/8 blur-[140px]" />
      <div className="pointer-events-none absolute right-[-10rem] bottom-[-12rem] h-[26rem] w-[26rem] rounded-full bg-royal/12 blur-[130px]" />

      <div className="relative flex h-dvh w-full max-w-[430px] flex-col overflow-hidden border-electric/10 bg-navy-950/55 shadow-[0_0_120px_-20px_rgba(0,229,255,0.22)] sm:border-x">
        {top}

        <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {children}
        </div>

        {bottom}
      </div>
    </div>
  );
}
