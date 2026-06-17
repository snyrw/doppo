"use client";

import React from "react";
import Link from "next/link";
import { cn } from "../../lib/cn";

/**
 * Chunky chamfered button with a tactile sink-on-press (the house button).
 * Renders the layered structure (base + face [+ inner cut border for ghost]).
 *
 * - `variant`       — "primary" (filled accent) or "ghost" (cut border)
 * - `faceClassName` — padding / typography overrides (applies to the face, or
 *                     the inner element for ghost so the cut border stays even)
 * - `block`         — stretch full width
 * - `href`          — render as a Next.js <Link> instead of <button>
 *
 * Geometry is driven by CSS vars on `.tactile` (--c chamfer, --depth, --bw);
 * override per-instance via `style={{ ["--depth" as string]: "4px" }}`.
 */
type Variant = "primary" | "ghost";

type BaseProps = {
  variant?: Variant;
  faceClassName?: string;
  block?: boolean;
  children: React.ReactNode;
  className?: string;
};

type ButtonProps = BaseProps &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & {
    href?: undefined;
  };

type LinkProps = BaseProps &
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "className" | "children" | "href"> & {
    href: string;
  };

export function TactileButton(props: ButtonProps | LinkProps) {
  const { variant = "primary", faceClassName, block, className, children, href, ...rest } =
    props as BaseProps & { href?: string } & Record<string, unknown>;

  const rootCls = cn(
    "tactile",
    variant === "ghost" ? "tactile--ghost" : "tactile--primary",
    block && "flex w-full",
    className,
  );

  const base = <span className="tactile__base chamfer" aria-hidden="true" />;
  const face =
    variant === "ghost" ? (
      <span className={cn("tactile__face chamfer", block && "w-full")}>
        <span className={cn("tactile__inner chamfer-inner", block && "w-full", faceClassName)}>
          {children}
        </span>
      </span>
    ) : (
      <span className={cn("tactile__face chamfer", block && "w-full", faceClassName)}>
        {children}
      </span>
    );

  if (href !== undefined) {
    return (
      <Link href={href} {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)} className={cn(rootCls, "no-underline")}>
        {base}
        {face}
      </Link>
    );
  }

  return (
    <button {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)} className={rootCls}>
      {base}
      {face}
    </button>
  );
}
