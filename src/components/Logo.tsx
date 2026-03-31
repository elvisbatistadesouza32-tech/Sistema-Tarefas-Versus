import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const Logo = ({ className, dark = false }: { className?: string, dark?: boolean }) => (
  <div className={cn("logo-versus", className)}>
    <span className={cn("logo-versus-clinica", dark && "text-white/60")}>Clínica</span>
    <span className={cn("logo-versus-main", dark && "text-white")}>VERSUS</span>
  </div>
);
