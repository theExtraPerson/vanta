"use client";

import { useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { ButtonLink } from "@/components/ui/primitives";
import { navLinks } from "@/lib/brand";

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-electric/12 bg-navy-950/88 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-2 px-4 py-2.5">
        <Logo size="sm" />

        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="rounded-lg border border-electric/20 px-2.5 py-1.5 font-display text-[10px] font-bold tracking-[0.1em] text-mist uppercase transition-colors hover:border-electric/45 hover:text-fog"
          >
            Sign in
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-electric/20 text-fog"
          >
            <span className="relative block h-2.5 w-3.5">
              <span
                className={`absolute left-0 h-[1.5px] w-3.5 bg-current transition-all ${
                  open ? "top-1 rotate-45" : "top-0"
                }`}
              />
              <span
                className={`absolute top-1 left-0 h-[1.5px] w-3.5 bg-current transition-opacity ${
                  open ? "opacity-0" : "opacity-100"
                }`}
              />
              <span
                className={`absolute left-0 h-[1.5px] w-3.5 bg-current transition-all ${
                  open ? "top-1 -rotate-45" : "top-2"
                }`}
              />
            </span>
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-electric/10 px-4 pt-2 pb-4">
          <nav className="flex flex-col" aria-label="Main">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="border-b border-white/5 py-2.5 font-display text-[12px] font-semibold tracking-[0.08em] text-fog uppercase"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-3 flex flex-col gap-2">
            <ButtonLink href="/register" variant="primary" size="md" className="w-full">
              Create an account
            </ButtonLink>
            <ButtonLink href="/login" variant="outline" size="md" className="w-full">
              Sign in
            </ButtonLink>
          </div>
        </div>
      )}
    </header>
  );
}