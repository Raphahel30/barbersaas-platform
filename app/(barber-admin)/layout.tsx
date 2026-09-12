import React from 'react'

export default function BarberAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-[#080706] text-[#fbf8f1] antialiased selection:bg-[#d4af37] selection:text-black">
      {children}
    </div>
  )
}
