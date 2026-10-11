import type { ReactNode } from "react"

import { Logo } from "@/components/common/Logo"

/**
 * Login and register layout, same as the rental project: campus photo on the left,
 * QNU crest and a white card on the right. Below lg the photo is hidden.
 */
export function AuthShell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="flex min-h-svh bg-neutral-100 dark:bg-neutral-950">
      <div className="relative hidden lg:block lg:w-[58%] xl:w-[62%]">
        <img
          src="/campus-qnu.webp"
          alt="Cổng chính Trường Đại học Quy Nhơn"
          // Shifted left so the "QNU" sign on the gate stays in the frame
          className="absolute inset-0 size-full object-cover object-[35%_center]"
          loading="eager"
          fetchPriority="high"
          decoding="async"
        />
      </div>

      <div className="flex w-full min-w-0 flex-col items-center justify-center px-5 py-10 sm:px-6 lg:w-[42%] xl:w-[38%]">
        <div className="w-full max-w-md">
          <div className="flex flex-col items-center text-center">
            <Logo size={96} />
            <p className="mt-4 text-sm font-bold tracking-wide text-[#0066CA] uppercase dark:text-sky-400">Trường Đại học Quy Nhơn</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-[#023E85] dark:text-sky-300">NamBeDe</h1>
            <p className="mt-1 text-sm text-muted-foreground">Hệ thống học tập cho sinh viên</p>
          </div>

          <div className="mt-8 rounded-2xl bg-white p-8 shadow-lg shadow-black/5 dark:bg-neutral-900 dark:shadow-black/40">
            <h2 className="text-3xl font-bold text-[#E1202E] uppercase">{title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{description}</p>
            <div className="mt-6">{children}</div>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">© 2026 Trường Đại học Quy Nhơn — Hệ thống học tập NamBeDe</p>
        </div>
      </div>
    </div>
  )
}
